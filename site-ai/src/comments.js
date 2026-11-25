// Comments for jonathanmccallum.com — sign-in, real names only.
//
// Readers sign in with Google, Instagram, LINE, or email — the same
// interview session the interview form uses — so a comment always
// carries a verified identity. A Google ID token in the POST body is
// also accepted (the original comments flow). Either way, the identity
// comes from the verified token or session server-side, never from the
// request body, so nobody can post as someone else.
//
// Every stored comment carries the signer's verified details for
// Jonathan only — provider, username, profile link, and verified
// email — and none of those fields is ever returned in the public
// list. Only the name, avatar, text, video, and the reader's own
// optional social link are public.
//
// A comment may also carry ONE optional social profile link — the
// reader's own Instagram, X, Threads, YouTube or Facebook profile —
// shown next to their name as "on Instagram" (or whichever it is).
// Only those five hosts are accepted, and only https profile URLs;
// anything else is refused. The link is the reader's own to give, and
// it is shown as a plain link, never fetched or embedded.
//
// Moderation: a reader comment is stored "pending" and does NOT show
// publicly until Jonathan approves it. The public list returns only
// approved comments (plus older ones stored before moderation, which
// have no status field and are treated as approved). Signed in as the
// site owner, the list also returns pending comments with an Approve
// button. Approval is POST /api/comment/approve with a fresh Google
// token from the owner's account; deleting is the way to refuse one.
//
// Helper updates: Jonathan's own helper Muses (Walkbare, Beyond,
// Clubhouse) can post an update from his social media onto an article
// with POST /api/update { secret, post, text, source }. The secret is
// the Worker secret HELPER_SECRET — set at deploy time, never in the
// repo — and without it the endpoint is switched off. An update is
// Jonathan's own already-public social post, so it shows straight
// away, clearly labelled "Update from Jonathan's social media" with a
// link back to the original post. Nothing else can post this way: the
// secret is the whole check, so it is shared only with his helpers.
//
// Storage: the NOTES KV namespace, keys `comment-<thread>-<ts>-<rand>`.
// A thread is `<lang>:<slug>` — one thread per article per language,
// so the Japanese article has its own conversation and the English one
// has its own. Each stored comment also carries the signer's verified
// details for Jonathan only — provider, username, profile link, and
// verified email. Those fields are never returned in the public list;
// only the public name, avatar URL, text, an optional YouTube video,
// an optional social profile link, and whether the writer is the site
// owner are public. No Google id is stored.
//
// Admin: the Worker var ADMIN_EMAIL holds the site owner's Google
// address (set at deploy time, never in the repo). Only that account
// can delete or approve a comment, with its own fresh ID token.
//
// Mirrors have no Worker of their own: they call this API on the main
// domain, cross-origin. CORS below allows the main domain, its
// subdomains, and any *.pages.dev preview or mirror — and nothing else.
//
// This module is shared. site-ai/src/index.js routes /api/comments and
// /api/comment to handleComments(), and the preview test Worker
// (jonathanmccallum-comments-test) is a bundle of this file only, so
// the preview site can be tested without touching the live AI Worker.

const COMMENTS_MAX_CHARS = 1000;

// Social profiles a reader (or a helper update) may link to. Only
// these hosts, only https, and only a real profile path — a bare
// domain with no username is refused.
const COMMENT_SOCIAL_HOSTS = {
  "instagram.com": "Instagram",
  "www.instagram.com": "Instagram",
  "x.com": "X",
  "twitter.com": "X",
  "www.twitter.com": "X",
  "threads.net": "Threads",
  "www.threads.net": "Threads",
  "youtube.com": "YouTube",
  "www.youtube.com": "YouTube",
  "facebook.com": "Facebook",
  "www.facebook.com": "Facebook",
};

// Returns { url, label } for a good social profile link, or null.
function socialLink(raw) {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const label = COMMENT_SOCIAL_HOSTS[parsed.hostname.toLowerCase()];
  if (!label) return null;
  // A profile link needs a path with something in it — "/username",
  // "/@handle", "/channel/..." — not just the bare domain.
  if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname.length < 2) return null;
  return { url, label };
}

// YouTube IDs: same shapes as the site's videoFacade transform —
// watch?v=, /shorts/, /embed/, youtu.be/.
const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:embed\/|shorts\/|watch\?[^#]*v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/;

function youtubeId(url) {
  const m = String(url || "").match(YOUTUBE_ID_RE);
  return m ? m[1] : null;
}

const THREAD_RE = /^[a-z]{2}:[a-z0-9][a-z0-9-]{0,120}$/;

// Posting is stricter than asking: 5 comments per 10 minutes per IP.
const commentHits = new Map();
function commentRateLimited(ip) {
  const now = Date.now();
  const hits = (commentHits.get(ip) || []).filter((t) => now - t < 600_000);
  hits.push(now);
  commentHits.set(ip, hits);
  return hits.length > 5;
}

// Only the site's own origins may call the API from a browser. The
// main domain, its subdomains, and any *.pages.dev host (live mirrors
// and Pages preview deployments) are in; everything else gets no CORS
// headers and the browser blocks the call.
function allowedOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (
    origin === "https://jonathanmccallum.com" ||
    /^https:\/\/[a-z0-9-]+\.jonathanmccallum\.com$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.jonathanmccallum\.pages\.dev$/.test(origin) ||
    /^http:\/\/localhost:\d+$/.test(origin)
  ) {
    return origin;
  }
  return "";
}

function corsHeaders(request) {
  const origin = allowedOrigin(request);
  return origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

function commentJson(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
    },
  });
}

// --- Interview session (shared with the main Worker) ----------------------
// Comments accept the same interview session the interview form uses
// (Google, Instagram, LINE, or email). The session is read from the
// `interview_session` cookie and looked up in KV — never from the
// request body, so nobody can post as someone else. This is a copy of
// the helper in site-ai/src/index.js (the Worker is deployed
// single-file, so the two files cannot import each other).
async function commentGetInterviewSession(request, env) {
  if (!env.NOTES) return null;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)interview_session=([A-Za-z0-9]+)/);
  if (!m) return null;
  try {
    return await env.NOTES.get(`isession-${m[1]}`, "json");
  } catch {
    return null;
  }
}

// --- Google ID token verification ---------------------------------------
// A Google ID token is a JWT signed RS256. The public keys live at
// googleapis.com/oauth2/v3/certs and rotate, so they are fetched and
// cached for an hour (refetched early if an unknown kid shows up).

let commentJwksCache = null;

async function commentGetJwks() {
  const now = Date.now();
  if (commentJwksCache && now - commentJwksCache.at < 3600_000) return commentJwksCache.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("jwks fetch failed");
  const data = await res.json();
  commentJwksCache = { keys: data.keys || [], at: now };
  return commentJwksCache.keys;
}

function commentB64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function commentB64urlToJson(s) {
  const bytes = commentB64urlToBytes(s);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Returns the token payload when the signature and claims check out,
// or null. Never throws for a bad token — a bad token is a 401.
async function commentVerifyGoogleToken(token, env) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = commentB64urlToJson(parts[0]);
    const payload = commentB64urlToJson(parts[1]);
    if (!header.kid || header.alg !== "RS256") return null;

    let keys = await commentGetJwks();
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      commentJwksCache = null;
      keys = await commentGetJwks();
      jwk = keys.find((k) => k.kid === header.kid);
      if (!jwk) return null;
    }
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      commentB64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return null;

    // Claims: issued by Google, for this site's OAuth client, still
    // valid, and the email address verified. The audience check is
    // what ties the token to this site — without a client id set at
    // deploy, posting stays switched off rather than open.
    if (!env.GOOGLE_CLIENT_ID) return null;
    if (payload.aud !== env.GOOGLE_CLIENT_ID) return null;
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now - 60) return null;
    if (typeof payload.iat === "number" && payload.iat > now + 60) return null;
    if (!payload.email_verified) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

function bearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/);
  return m ? m[1] : "";
}

// Constant-time comparison, so the helper secret is not leaked by
// how long a wrong guess takes to fail.
function secretsEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// --- Handlers ------------------------------------------------------------

// GET /api/comments?post=<lang>:<slug> — public. Only approved
// comments are listed. With a valid admin token, pending comments are
// listed too, each carrying canApprove so the owner sees an Approve
// button; everyone else gets the plain approved list.
async function handleListComments(request, env, url) {
  const post = (url.searchParams.get("post") || "").trim();
  if (!THREAD_RE.test(post)) {
    return commentJson(request, { error: "Ask for a post like en:narnia-and-what-id-like-everyone-to-know." }, 400);
  }
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);

  let isAdmin = false;
  const token = bearerToken(request);
  if (token && env.ADMIN_EMAIL) {
    const payload = await commentVerifyGoogleToken(token, env);
    isAdmin = !!payload && payload.email === env.ADMIN_EMAIL;
  }

  const listed = await env.NOTES.list({ prefix: `comment-${post}-`, limit: 100 });
  const comments = [];
  for (const k of listed.keys) {
    try {
      const c = await env.NOTES.get(k.name, "json");
      if (c && c.post === post) {
        // No status field means stored before moderation existed
        // (the seeded test comments) — those stay visible.
        const pending = c.status === "pending";
        if (pending && !isAdmin) continue;
        comments.push({
          id: k.name,
          name: c.name,
          avatar: c.avatar || "",
          text: c.text,
          video: c.video || "",
          videoId: c.videoId || "",
          social: c.social || "",
          socialLabel: c.socialLabel || "",
          kind: c.kind || "comment",
          source: c.source || "",
          sourceLabel: c.sourceLabel || "",
          author: !!c.author,
          at: c.at,
          ...(pending ? { pending: true } : {}),
          ...(isAdmin ? { canDelete: true, ...(pending ? { canApprove: true } : {}) } : {}),
        });
      }
    } catch {}
  }
  comments.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return commentJson(request, { comments });
}

// Email Jonathan when a reader comments, via Resend — same pattern
// as sendSigninCodeEmail in index.js. Returns true when Resend
// accepted it, false otherwise (missing key, network error, non-2xx).
// The notification address is the deploy-time var NOTIFY_EMAIL, set to
// mccallumhome@gmail.com — never ADMIN_EMAIL, which is unconfirmed.
// The subject and sender match the Gmail filter that stars and labels
// tree mail ("Family tree").
async function sendCommentNotificationEmail(env, c) {
  if (!env.RESEND_API_KEY || !env.NOTIFY_EMAIL) return false;
  const slug = c.post.split(":").slice(1).join(":") || c.post;
  const text = [
    `New comment on ${slug} — jonathanmccallum.com`,
    ``,
    `From: ${c.name}${c.email ? ` (${c.email})` : ""}${c.provider ? ` via ${c.provider}` : ""}${c.username ? ` (${c.username})` : ""}`,
    `Thread: ${c.post}`,
    ``,
    c.text,
    ``,
    `Page: https://jonathanmccallum.com/${slug}/`,
    ``,
    `This comment is pending — it needs approval. Sign in on the page to approve it.`,
  ].join("\n");
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jonathan McCallum <hello@jonathanmccallum.com>",
        to: env.NOTIFY_EMAIL,
        subject: `[COMMENT] New comment on ${slug} — jonathanmccallum.com`,
        text,
      }),
    });
  } catch {
    return false;
  }
  return res.ok;
}

// POST /api/comment { credential?, post, text, video?, social? } —
// signed-in readers only. Identity comes from a Google ID token in
// the POST body OR from the interview session cookie (Google,
// Instagram, LINE, or email) — either way it is verified server-side,
// never from the request body, so nobody can post as someone else.
// The comment is stored pending and only shows after Jonathan
// approves it. The stored comment carries the signer's verified
// details (provider, username, profile link, verified email) for
// Jonathan only; the public list never returns them.
async function handlePostComment(request, env) {
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") {
    return commentJson(request, { error: "Send JSON like { \"post\": \"en:slug\", \"text\": \"...\" }." }, 400);
  }

  // Identity: a Google ID token, or a signed-in interview session
  // (Google, Instagram, LINE, or email). The session cookie is read,
  // never a value from the request body — nobody can post as someone else.
  let payload = null;
  let session = null;
  if (body.credential) {
    if (!env.GOOGLE_CLIENT_ID) {
      return commentJson(request, { error: "Sign-in with Google is not set up yet." }, 503);
    }
    payload = await commentVerifyGoogleToken(body.credential, env);
    if (!payload) return commentJson(request, { error: "Sign in with Google first — that sign-in did not check out." }, 401);
  } else {
    session = await commentGetInterviewSession(request, env);
    if (!session) return commentJson(request, { error: "Sign in first — with Google, Instagram, LINE, or email — so the site knows the comment is really yours." }, 401);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (commentRateLimited(ip)) {
    return commentJson(request, { error: "Slow down — a few comments at a time." }, 429);
  }

  const post = typeof body.post === "string" ? body.post.trim() : "";
  if (!THREAD_RE.test(post)) {
    return commentJson(request, { error: "That post does not exist." }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > COMMENTS_MAX_CHARS) {
    return commentJson(request, { error: `Write a comment, up to ${COMMENTS_MAX_CHARS} characters.` }, 400);
  }

  // An optional YouTube link — a video reply from the author, or a
  // reader sharing a video. Only YouTube links, and only the id is
  // kept: the front end builds the same tap-to-load facade the articles
  // use, so nothing auto-plays and no third-party script loads.
  let video = "";
  let videoId = "";
  if (typeof body.video === "string" && body.video.trim()) {
    videoId = youtubeId(body.video.trim());
    if (!videoId) {
      return commentJson(request, { error: "The video link has to be a YouTube link." }, 400);
    }
    video = body.video.trim();
  }

  // An optional link to the reader's own social profile — Instagram,
  // X, Threads, YouTube or Facebook. Anything else is refused, and
  // the link is only ever shown as a plain link to that profile.
  let social = "";
  let socialLabel = "";
  if (typeof body.social === "string" && body.social.trim()) {
    const link = socialLink(body.social);
    if (!link) {
      return commentJson(request, { error: "That social link has to be your Instagram, X, Threads, YouTube or Facebook profile." }, 400);
    }
    social = link.url;
    socialLabel = link.label;
  }

  // Identity, from the verified token or the verified session —
  // never from the request body. The public name and avatar are what
  // readers see; the provider, username, profile link, and verified
  // email are stored for Jonathan only and never returned publicly.
  const name = payload
    ? String(payload.name || "A reader").slice(0, 100)
    : String((session && session.name) || "A reader").slice(0, 100);
  const avatar = payload &&
    typeof payload.picture === "string" &&
    payload.picture.startsWith("https://lh3.googleusercontent.com/")
    ? payload.picture
    : "";
  const provider = payload ? "google" : String((session && session.provider) || "");
  const username = payload ? "" : String((session && session.username) || "");
  const profileUrl = payload ? "" : String((session && session.profileUrl) || "");
  // The verified email, for Jonathan only — from a Google token, or
  // from a Google or email session. Instagram and LINE sessions carry
  // no email. Never returned in the public list or the POST reply.
  const email = payload
    ? String(payload.email || "")
    : (session && (session.provider === "google" || session.provider === "email")
      ? String(session.email || "")
      : "");
  // Only the site owner's Google account is approved straight away —
  // a Google token or a Google session carrying the admin email. An
  // email-code session is never the owner, and Instagram/LINE sessions
  // carry no email.
  const isOwner = !!env.ADMIN_EMAIL && (
    (payload && payload.email === env.ADMIN_EMAIL) ||
    (session && session.provider === "google" && session.email === env.ADMIN_EMAIL)
  );
  const at = new Date().toISOString();
  const comment = {
    post,
    kind: "comment",
    status: isOwner ? "approved" : "pending",
    name,
    avatar,
    text,
    video,
    videoId,
    social,
    socialLabel,
    author: isOwner,
    at,
    // For Jonathan only — never in the public list (see
    // handleListComments) and never in the POST reply below.
    provider,
    username,
    profileUrl,
    email,
  };
  const key = `comment-${post}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.NOTES.put(key, JSON.stringify(comment));
  // Notify Jonathan by email — reader comments only, never his own
  // (isOwner) and never helper updates (those go through
  // handleHelperUpdate, untouched). A failed send must never fail the
  // comment post: the comment is already stored above.
  if (!isOwner) {
    try {
      await sendCommentNotificationEmail(env, {
        post,
        name,
        text,
        email,
        provider,
        username,
      });
    } catch {}
  }
  // Reply with the public fields only — the verified details stay
  // in KV for Jonathan and are never sent back to the browser.
  const { provider: _p, username: _u, profileUrl: _l, email: _e, ...publicComment } = comment;
  return commentJson(request, { ok: true, comment: { id: key, ...publicComment } });
}

// POST /api/comment/approve { credential, id } — the site owner only.
// Flips a pending comment to approved so it shows publicly. Refusing
// one is the existing DELETE — no separate reject step.
async function handleApproveComment(request, env) {
  if (!env.ADMIN_EMAIL) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return commentJson(request, { error: "Send JSON like { \"credential\": \"...\", \"id\": \"comment-...\" }." }, 400);
  }
  const payload = body.credential ? await commentVerifyGoogleToken(body.credential, env) : null;
  if (!payload || payload.email !== env.ADMIN_EMAIL) {
    return commentJson(request, { error: "Only the site owner can approve a comment." }, 403);
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id.startsWith("comment-")) {
    return commentJson(request, { error: "That is not a comment." }, 400);
  }
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  const c = await env.NOTES.get(id, "json");
  if (!c) return commentJson(request, { error: "That comment is not there any more." }, 404);
  c.status = "approved";
  await env.NOTES.put(id, JSON.stringify(c));
  return commentJson(request, { ok: true });
}

// POST /api/update { secret, post, text, source } — Jonathan's helper
// Muses only. Posts an update from his social media onto an article:
// the text of his social post plus a link back to it. The shared
// secret HELPER_SECRET is the whole check — set it as a Worker secret
// at deploy time, never in the repo, and share it only with his
// helpers. Without it set, this endpoint is switched off. An update
// is his own already-public post, so it shows straight away.
async function handleHelperUpdate(request, env) {
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  if (!env.HELPER_SECRET) {
    return commentJson(request, { error: "Helper updates are not switched on yet." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return commentJson(request, { error: "Send JSON like { \"secret\": \"...\", \"post\": \"en:slug\", \"text\": \"...\", \"source\": \"https://...\" }." }, 400);
  }
  if (!secretsEqual(body.secret, env.HELPER_SECRET)) {
    return commentJson(request, { error: "That secret did not check out." }, 401);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (commentRateLimited(ip)) {
    return commentJson(request, { error: "Slow down — a few updates at a time." }, 429);
  }

  const post = typeof body.post === "string" ? body.post.trim() : "";
  if (!THREAD_RE.test(post)) {
    return commentJson(request, { error: "That post does not exist." }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > COMMENTS_MAX_CHARS) {
    return commentJson(request, { error: `Write an update, up to ${COMMENTS_MAX_CHARS} characters.` }, 400);
  }
  const link = socialLink(body.source);
  if (!link) {
    return commentJson(request, { error: "The source has to be a link to Jonathan's Instagram, X, Threads, YouTube or Facebook post." }, 400);
  }

  const at = new Date().toISOString();
  const update = {
    post,
    kind: "update",
    status: "approved",
    name: "Jonathan McCallum",
    avatar: "",
    text,
    video: "",
    videoId: "",
    social: "",
    socialLabel: "",
    source: link.url,
    sourceLabel: link.label,
    author: true,
    at,
  };
  const key = `comment-${post}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.NOTES.put(key, JSON.stringify(update));
  return commentJson(request, { ok: true, comment: { id: key, ...update } });
}

// DELETE /api/comment?id=<key> — the site owner only, with a fresh
// Google token. Only comment- keys can ever be deleted this way.
async function handleDeleteComment(request, env, url) {
  if (!env.ADMIN_EMAIL) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  const token = bearerToken(request);
  const payload = token ? await commentVerifyGoogleToken(token, env) : null;
  if (!payload || payload.email !== env.ADMIN_EMAIL) {
    return commentJson(request, { error: "Only the site owner can delete a comment." }, 403);
  }
  const id = url.searchParams.get("id") || "";
  if (!id.startsWith("comment-")) {
    return commentJson(request, { error: "That is not a comment." }, 400);
  }
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  await env.NOTES.delete(id);
  return commentJson(request, { ok: true });
}

// Returns a Response for comment routes, or null so the host Worker
// can fall through to its own routes.
export async function handleComments(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isList = path.endsWith("/api/comments");
  const isItem = path.endsWith("/api/comment");
  const isApprove = path.endsWith("/api/comment/approve");
  const isUpdate = path.endsWith("/api/update");
  if (!isList && !isItem && !isApprove && !isUpdate) return null;

  if (request.method === "OPTIONS") {
    const origin = allowedOrigin(request);
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (isList) {
    if (request.method !== "GET") {
      return commentJson(request, { error: "GET /api/comments?post=<lang>:<slug> lists a post's comments." }, 405);
    }
    return handleListComments(request, env, url);
  }
  if (isApprove) {
    if (request.method !== "POST") {
      return commentJson(request, { error: "POST to /api/comment/approve to approve a comment." }, 405);
    }
    return handleApproveComment(request, env);
  }
  if (isUpdate) {
    if (request.method !== "POST") {
      return commentJson(request, { error: "POST to /api/update to post an update from Jonathan's social media." }, 405);
    }
    return handleHelperUpdate(request, env);
  }
  if (request.method === "POST") return handlePostComment(request, env);
  if (request.method === "DELETE") return handleDeleteComment(request, env, url);
  return commentJson(request, { error: "POST a comment, or DELETE one as the site owner." }, 405);
}
