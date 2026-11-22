// Comments for jonathanmccallum.com — Google sign-in, real names only.
//
// Readers sign in with their Google account (the same login as
// YouTube), so a comment always carries a real name and photo. No
// anonymous comments, no made-up names. The Worker verifies the Google
// ID token server-side (RS256 against Google's JWKS) before storing
// anything, and the front end only ever shows what the server stored.
//
// Storage: the NOTES KV namespace, keys `comment-<thread>-<ts>-<rand>`.
// A thread is `<lang>:<slug>` — one thread per article per language,
// so the Japanese article has its own conversation and the English one
// has its own. Nothing personal is stored: no email address, no Google
// id — only the public name, avatar URL, text, an optional YouTube
// video, and whether the writer is the site owner.
//
// Admin: the Worker var ADMIN_EMAIL holds the site owner's Google
// address (set at deploy time, never in the repo). Only that account
// can delete a comment, with its own fresh ID token.
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

// --- Google ID token verification ---------------------------------------
// A Google ID token is a JWT signed RS256. The public keys live at
// googleapis.com/oauth2/v3/certs and rotate, so they are fetched and
// cached for an hour (refetched early if an unknown kid shows up).

let jwksCache = null;

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) throw new Error("jwks fetch failed");
  const data = await res.json();
  jwksCache = { keys: data.keys || [], at: now };
  return jwksCache.keys;
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlToJson(s) {
  const bytes = b64urlToBytes(s);
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Returns the token payload when the signature and claims check out,
// or null. Never throws for a bad token — a bad token is a 401.
async function verifyGoogleToken(token, env) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = b64urlToJson(parts[0]);
    const payload = b64urlToJson(parts[1]);
    if (!header.kid || header.alg !== "RS256") return null;

    let keys = await getJwks();
    let jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      jwksCache = null;
      keys = await getJwks();
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
      b64urlToBytes(parts[2]),
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

// --- Handlers ------------------------------------------------------------

// GET /api/comments?post=<lang>:<slug> — public. With a valid admin
// token, each comment also carries canDelete so the owner sees a
// delete button; everyone else gets the plain list.
async function handleListComments(request, env, url) {
  const post = (url.searchParams.get("post") || "").trim();
  if (!THREAD_RE.test(post)) {
    return commentJson(request, { error: "Ask for a post like en:narnia-and-what-id-like-everyone-to-know." }, 400);
  }
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);

  let isAdmin = false;
  const token = bearerToken(request);
  if (token && env.ADMIN_EMAIL) {
    const payload = await verifyGoogleToken(token, env);
    isAdmin = !!payload && payload.email === env.ADMIN_EMAIL;
  }

  const listed = await env.NOTES.list({ prefix: `comment-${post}-`, limit: 100 });
  const comments = [];
  for (const k of listed.keys) {
    try {
      const c = await env.NOTES.get(k.name, "json");
      if (c && c.post === post) {
        comments.push({
          id: k.name,
          name: c.name,
          avatar: c.avatar || "",
          text: c.text,
          video: c.video || "",
          videoId: c.videoId || "",
          author: !!c.author,
          at: c.at,
          ...(isAdmin ? { canDelete: true } : {}),
        });
      }
    } catch {}
  }
  comments.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return commentJson(request, { comments });
}

// POST /api/comment { credential, post, text, video? } — signed-in
// readers only. The name and photo come from the verified token, never
// from the request body, so nobody can post as someone else.
async function handlePostComment(request, env) {
  if (!env.NOTES) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  if (!env.GOOGLE_CLIENT_ID) {
    return commentJson(request, { error: "Sign-in with Google is not set up yet." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return commentJson(request, { error: "Send JSON like { \"credential\": \"...\", \"post\": \"en:slug\", \"text\": \"...\" }." }, 400);
  }
  const payload = await verifyGoogleToken(body.credential, env);
  if (!payload) return commentJson(request, { error: "Sign in with Google first — that sign-in did not check out." }, 401);

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

  const name = String(payload.name || "A reader").slice(0, 100);
  const avatar =
    typeof payload.picture === "string" && payload.picture.startsWith("https://lh3.googleusercontent.com/")
      ? payload.picture
      : "";
  const at = new Date().toISOString();
  const comment = {
    post,
    name,
    avatar,
    text,
    video,
    videoId,
    author: payload.email === env.ADMIN_EMAIL,
    at,
  };
  const key = `comment-${post}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.NOTES.put(key, JSON.stringify(comment));
  return commentJson(request, { ok: true, comment: { id: key, ...comment } });
}

// DELETE /api/comment?id=<key> — the site owner only, with a fresh
// Google token. Only comment- keys can ever be deleted this way.
async function handleDeleteComment(request, env, url) {
  if (!env.ADMIN_EMAIL) return commentJson(request, { error: "Comments are not switched on yet." }, 503);
  const token = bearerToken(request);
  const payload = token ? await verifyGoogleToken(token, env) : null;
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
  if (!isList && !isItem) return null;

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
  if (request.method === "POST") return handlePostComment(request, env);
  if (request.method === "DELETE") return handleDeleteComment(request, env, url);
  return commentJson(request, { error: "POST a comment, or DELETE one as the site owner." }, 405);
}
