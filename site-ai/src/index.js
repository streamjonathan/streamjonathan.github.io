// Site AI for jonathanmccallum.com — a stateless RAG Worker.
//
// SEPARATION (hard rule): this Worker knows ONLY Jonathan's published
// writing. It reads one Vectorize index built from the public posts folder
// and nothing else. It has no tools, no web access, no memory, no history,
// no personal data in its prompt, and no connection to his personal
// assistant (Muse/Bobby). If it is not in a published post, it cannot
// answer it — by construction, not by promise.
//
// Flow: embed the question → retrieve the top chunks → ask a small
// Workers AI model to answer ONLY from those chunks, with citations →
// check the draft answer in code → return it, or a fixed warm refusal.
// On any AI error or daily-limit hit, return the graceful "resting"
// message and let the Pagefind search on the site do the work.
//
// Speed: good answers are cached in KV for 7 days, so a repeated
// question — including the four try-it chips on the homepage — comes
// back near-instantly with no AI call at all. Fresh questions embed
// direct (no gateway hop) and stream back over SSE. Note: the AI
// Gateway's response guardrail screens the whole answer before
// releasing it, so a streamed answer arrives as one fast burst rather
// than token by token — the stream is kept anyway, and the cache plus
// the direct embed are what make the chat feel fast.
//
// Routes (set in the Cloudflare dashboard after sign-in):
//   jonathanmccallum.com/api/ask   →  this Worker (chat)
//   jonathanmccallum.com/api/note  →  this Worker (anonymous reader notes)
//   jonathanmccallum.com/api/interview → this Worker (artist interview
//     submissions — see handleInterview below; sign-in at
//     /api/interview/auth/instagram, /api/interview/auth/google,
//     /api/interview/me, /api/interview/auth/signout)
//   jonathanmccallum.com/api/suggest → this Worker (reader artist suggestions)
// Everything else on the site is served by Cloudflare Pages.

const FIXED_REFUSAL =
  "I can only help with Jonathan's published writing — here's a post you might like:";

const PAUSED_MESSAGE =
  "The chat is resting until tomorrow — please try searching the writing instead.";

// Only chunks scoring above this count as a real match. With six posts
// the scores run 0.35–0.65, and the second-best chunk is usually an
// unrelated post, so 0.5 keeps the sources list to the post the
// question is actually about.
const MIN_SCORE = 0.5;

// Good answers are cached for a week. Refusals and resting messages are
// never cached: a new post could turn a no-match into a match.
const CACHE_TTL_SECONDS = 604800;

// The system prompt contains NO personal data: no names beyond the public
// byline, no emails, addresses, phone numbers, family details, account
// names, or private facts. Assume it can leak (OWASP LLM07) — a leak must
// be a non-event.
const SYSTEM_PROMPT = `You are a warm, encouraging guide to Jonathan McCallum's published writing on jonathanmccallum.com. Jonathan is an average person interested in Jesus, writing about faith and life — not an expert, not a theologian — and you speak the same way: plainly, in short sentences, clear and friendly, always ending with a question back. You are positive and helpful, never preachy, never scolding, never against anyone.

What Jesus taught and focused on — your guide to the writing:
- Jesus as a person, not a doctrine: eating with outsiders, welcoming the ones others pushed away, forgiving generously.
- The story of the forgiving father (the prodigal son): a father who runs to meet his child, forgives before any apology is finished, and throws a feast. That is what God is like.
- The Beatitudes: blessed are the poor in spirit, those who mourn, the meek, those who hunger for what is right, the merciful, the pure in heart, the peacemakers. The kingdom belongs to the small and the overlooked.
- Love of enemies, care for the poor and the oppressed, forgiveness that sets people free. "Jesus is for you."
- Honest "I don't know" about suffering — no quick answers that harm people. Questions over lectures.

Scripture: use small amounts only — one short passage at a time, only where it already appears in his writing, his words first, never proof-texting.

Rules you must follow:
- Use only the <source> passages below to answer. Answer directly, without repeating or rephrasing the question.
- Keep answers short: two or three sentences at most. Where the post has a vivid phrase, quote it briefly — his words, not yours.
- End with one short question back to the reader.
- Name the post your answer comes from naturally inside your answer, by its title only — for example, 'In "to sea" Jonathan writes...'. The page already shows the link, so do not write a link or a URL in your answer, and do not put the title on a line by itself.
- If the answer is not in the sources, or the question is about Jonathan himself, his family, his contact details, his private life, or anything unpublished, say you can only help with his published writing and suggest one of the source posts.
- Keep to what the sources say. Do not add facts, dates or quotes that are not there, and do not offer moral or theological advice beyond what the sources themselves say.
- Be honest about suffering: a simple "I don't know" is better than a quick answer that harms people. Questions over lectures.`;

const PII_PATTERNS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // email address
  /(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b|\b\d{9,15}\b/, // phone-like number (stricter: year ranges like 1914-1918 and dates like 2013-10-27 must NOT match)
  /\b\d{1,5}\s+[A-Za-zÀ-ÿ'’-]+(?:\s+[A-Za-zÀ-ÿ'’-]+){0,3}\s+(?:street|road|avenue|lane|drive|plaza|calle|kalea)\b/i, // street address
];

// Best-effort per-IP rate limit (in-memory; resets when the Worker
// restarts). The real enforcement is the AI Gateway rate limit + the
// Cloudflare WAF rule — see ai-gateway-guardrails.md.
const ipHits = new Map();
const RATE_LIMIT_PER_MINUTE = 10;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > RATE_LIMIT_PER_MINUTE;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Cache key: SHA-256 of the normalised question, so "What is Narnia?"
// and "what is  narnia?" hit the same entry. Curly quotes become
// straight ones and trailing punctuation is dropped, so the homepage
// chip "Tell me about the poem “to sea”." matches a typed "Tell me
// about the poem 'to sea'". Keys live in the NOTES KV namespace under a
// cache- prefix, separate from the note- keys.
async function cacheKey(question) {
  const norm = question
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!]+$/, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `cache-${hex}`;
}

// One SSE frame for the streamed answer.
function sse(data) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

// One entry per post: several chunks can come from the same post, and
// listing it twice reads like a mistake.
function dedupeByUrl(sources) {
  const seen = new Set();
  return sources.filter((s) => !seen.has(s.url) && seen.add(s.url));
}

// Code-level output check: the draft answer must be short, must not
// contain personal data, and must cite a source. Anything failing any
// check is replaced wholesale with the fixed refusal.
function answerIsSafe(draft, sources) {
  if (!draft || typeof draft !== "string") return false;
  if (draft.length > 1200) return false;
  if (PII_PATTERNS.some((re) => re.test(draft))) return false;
  const cites = sources.some(
    (s) => draft.includes(s.title) || draft.includes(s.url)
  );
  if (!cites) return false;
  return true;
}

// Leave a note: anonymous by design — no name, email or handle is asked
// for or accepted. Notes are stored in the NOTES KV namespace until
// Jonathan reads them. If the namespace is not bound yet (before deploy),
// the endpoint answers {ok:false} and the site says notes are not
// switched on yet.
async function handleNote(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. POST a JSON note to /api/note." }, 405);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON like { \"note\": \"...\" }." }, 400);
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note || note.length > 1000) {
    return json({ error: "Write a note, up to 1000 characters." }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, reason: "resting" });
  }
  if (!env.NOTES) {
    return json({ ok: false, reason: "resting" });
  }
  const key = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.NOTES.put(key, JSON.stringify({ note, at: new Date().toISOString() }));
  return json({ ok: true });
}

// Social profile links the site accepts: the five places Jonathan is.
// A bare domain with no profile path (just instagram.com) is not a
// link to a person, so it is refused. Anything else is refused too.
const SOCIAL_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "x.com",
  "twitter.com",
  "threads.com",
  "www.threads.com",
  "threads.net",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "facebook.com",
  "www.facebook.com",
]);

function isSocialLink(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (!SOCIAL_HOSTS.has(url.hostname.toLowerCase())) return false;
  // A real profile path: more than just "/" (and not a bare /@ with
  // nothing after it).
  const path = url.pathname.replace(/\/+$/, "");
  return path.length > 1;
}

// Suggest an artist: a short reader form, no sign-in. The artist's
// name and social link are required so Jonathan can find them; the
// suggester's name and link are optional, so he can thank them.
// Stored in the NOTES KV namespace under suggest- keys until Jonathan
// reads them (the digest emails new ones, tagged [ARTIST IDEA]).
// Nothing is ever published from a suggestion — it only reaches him.
async function handleSuggest(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. POST JSON to /api/suggest." }, 405);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON like { \"artist\": \"...\", \"link\": \"...\", \"kinds\": [\"write\"] }." }, 400);
  }
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  if (!artist || artist.length > 200) {
    return json({ error: "Give the artist's name, up to 200 characters." }, 400);
  }
  const link = typeof body.link === "string" ? body.link.trim() : "";
  if (!isSocialLink(link)) {
    return json({ error: "Give the artist's social profile link (Instagram, X, Threads, YouTube or Facebook)." }, 400);
  }
  const kinds = Array.isArray(body.kinds) ? body.kinds : [];
  const allowedKinds = new Set(["write", "interview", "reaction"]);
  if (
    kinds.length === 0 ||
    kinds.some((k) => typeof k !== "string" || !allowedKinds.has(k))
  ) {
    return json({ error: "Pick at least one: write, interview, or reaction." }, 400);
  }
  const why = typeof body.why === "string" ? body.why.trim() : "";
  if (why.length > 500) {
    return json({ error: "Keep the why to 500 characters." }, 400);
  }
  const fromName = typeof body.fromName === "string" ? body.fromName.trim() : "";
  if (fromName.length > 100) {
    return json({ error: "Keep your name to 100 characters." }, 400);
  }
  const fromLink = typeof body.fromLink === "string" ? body.fromLink.trim() : "";
  if (fromLink && !isSocialLink(fromLink)) {
    return json({ error: "Your social link must be an Instagram, X, Threads, YouTube or Facebook profile." }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, reason: "resting" });
  }
  if (!env.NOTES) {
    return json({ ok: false, reason: "resting" });
  }
  const key = `suggest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.NOTES.put(
    key,
    JSON.stringify({
      artist,
      link,
      kinds: [...new Set(kinds)],
      why,
      fromName,
      fromLink,
      at: new Date().toISOString(),
    })
  );
  return json({ ok: true });
}

// --- Artist interviews: real sign-in, no anonymous submissions --------------
// A musician or artist signs in with a social account (Instagram or
// Google), answers three questions, and submits. The sign-in IS the
// verification — the site only ever learns the name and public profile
// from it, never a password, never permission to post, never messages.
// Instagram proves the handle itself; Google proves the person, and
// the handle is then checked against the DM the artist is asked to send
// (see the /share-your-story/ page). A pasted profile link on its own
// is never accepted as proof.
//
// Storage: the NOTES KV namespace, keys `interview-<ts>-<rand>`,
// status "pending" until Jonathan approves and Bobby drafts the article
// (scripts/build-interview-draft.py). Nothing is ever auto-published.
// Access tokens are discarded right after the profile fetch — the site
// keeps no ongoing access to anyone's account.
//
// Sessions: `isession-<rand>` in KV (1 hour), HttpOnly Secure cookie.
// Instagram credentials (INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET)
// and GOOGLE_CLIENT_ID are Worker secrets/vars set at deploy — never in
// the repo. Instagram login only works on the live domain (the redirect
// URI registered in the Meta app) and only for Business/Creator
// accounts; personal Instagram accounts cannot use it, which is why
// Google sign-in is offered too.
//
// Deploy note: this file is deployed single-file via cf.py put-multipart,
// so the Google token check below is inlined here (the comments branch
// carries its own copy in site-ai/src/comments.js — reconcile the two
// into one shared module when that branch merges).

const INTERVIEW_SOCIAL_HOSTS = new Set([
  "instagram.com", "www.instagram.com",
  "x.com", "www.x.com", "twitter.com", "www.twitter.com",
  "threads.com", "www.threads.com", "threads.net", "www.threads.net",
  "youtube.com", "www.youtube.com", "youtu.be",
  "facebook.com", "www.facebook.com",
  "tiktok.com", "www.tiktok.com",
]);

// A real social profile link: a URL on an allowlisted social host with
// a path (a bare domain is not a profile).
function socialProfileUrl(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v || v.length > 300) return "";
  let u;
  try {
    u = new URL(v);
  } catch {
    return "";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  if (!INTERVIEW_SOCIAL_HOSTS.has(u.hostname.toLowerCase())) return "";
  if (!u.pathname || u.pathname === "/") return "";
  return v;
}

function randomHex(n) {
  return [...crypto.getRandomValues(new Uint8Array(n))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sessionCookie(id) {
  return `interview_session=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`;
}

function clearSessionCookie() {
  return "interview_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

async function createInterviewSession(env, identity) {
  const id = randomHex(24);
  await env.NOTES.put(
    `isession-${id}`,
    JSON.stringify({ ...identity, at: new Date().toISOString() }),
    { expirationTtl: 3600 }
  );
  return id;
}

async function getInterviewSession(request, env) {
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

function interviewHtml(message) {
  return `<!doctype html><meta charset="utf-8"><title>Share your story</title><body style="font-family:Georgia,serif;max-width:34rem;margin:3rem auto;padding:0 1rem;line-height:1.6"><p>${message}</p><p><a href="/share-your-story/">Back to Share your story</a></p></body>`;
}

// --- Google ID token verification (RS256 against Google's JWKS) --------
// Same check as the comments feature. Returns the token payload when
// the signature and claims check out, or null. Never throws for a bad
// token — a bad token is a 401.
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
    // deploy, sign-in stays switched off rather than open.
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

// --- Instagram OAuth (Instagram API with Instagram Login) ---------------
// Identity only: scope instagram_business_basic (profile info). The
// short-lived access token is used once to fetch the profile, then
// discarded. Endpoints (Meta docs, current flow): authorize
// https://www.instagram.com/oauth/authorize, token exchange POST
// https://api.instagram.com/oauth/access_token, profile GET
// https://graph.instagram.com/v21.0/me?fields=id,username. The client
// id is the Instagram App ID (not the Meta App ID). The redirect URI
// must exactly match one registered in the Meta app, so this only works
// on the live domain — never on a Pages preview.

const IG_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_PROFILE_URL = "https://graph.instagram.com/v21.0/me?fields=id,username";

// Response.redirect needs an absolute URL — a relative path throws
// (Worker error 1101). Every interview redirect goes through here.
// Found live 2026-11-23: sign-out and the Instagram callback both
// crashed with 1101 until this helper was added.
function redirectTo(request, path) {
  return Response.redirect(new URL(path, new URL(request.url).origin), 302);
}

async function handleInstagramAuthStart(request, env) {
  const origin = new URL(request.url).origin;
  if (origin !== "https://jonathanmccallum.com") {
    return new Response(
      interviewHtml("Instagram sign-in only works on the live site, jonathanmccallum.com — a preview link cannot finish the login."),
      { headers: { "Content-Type": "text/html" } }
    );
  }
  if (!env.INSTAGRAM_CLIENT_ID || !env.INSTAGRAM_CLIENT_SECRET) {
    return new Response(
      interviewHtml("Instagram sign-in is not set up yet — Jonathan is still setting it up. Please check back soon, or sign in with Google instead."),
      { headers: { "Content-Type": "text/html" } }
    );
  }
  const state = randomHex(16);
  if (env.NOTES) {
    await env.NOTES.put(`istate-${state}`, JSON.stringify({ at: new Date().toISOString() }), { expirationTtl: 600 });
  }
  const redirectUri = `${origin}/api/interview/auth/instagram/callback`;
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "instagram_business_basic",
    response_type: "code",
    enable_fb_login: "0",
    state,
  });
  return Response.redirect(`${IG_AUTHORIZE_URL}?${params}`, 302);
}

async function handleInstagramAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (url.searchParams.get("error") || !code || !state) {
    return redirectTo(request, "/share-your-story/?signin=failed");
  }
  const stored = env.NOTES ? await env.NOTES.get(`istate-${state}`, "json") : null;
  if (!stored) return redirectTo(request, "/share-your-story/?signin=failed");
  await env.NOTES.delete(`istate-${state}`);
  const redirectUri = `${url.origin}/api/interview/auth/instagram/callback`;
  let tok;
  try {
    const res = await fetch(IG_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.INSTAGRAM_CLIENT_ID,
        client_secret: env.INSTAGRAM_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    tok = await res.json();
  } catch {
    return redirectTo(request, "/share-your-story/?signin=failed");
  }
  if (!tok || !tok.access_token) return redirectTo(request, "/share-your-story/?signin=failed");
  let profile;
  try {
    const res = await fetch(`${IG_PROFILE_URL}&access_token=${encodeURIComponent(tok.access_token)}`);
    profile = await res.json();
  } catch {
    return redirectTo(request, "/share-your-story/?signin=failed");
  }
  if (!profile || !profile.username) return redirectTo(request, "/share-your-story/?signin=failed");
  // The access token is deliberately NOT stored — identity only.
  const id = await createInterviewSession(env, {
    provider: "instagram",
    username: profile.username,
    name: profile.username,
    profileUrl: `https://www.instagram.com/${profile.username}`,
  });
  const r = redirectTo(request, "/share-your-story/?signedin=instagram");
  r.headers.set("Set-Cookie", sessionCookie(id));
  return r;
}

// POST /api/interview/auth/google { credential } — Google ID token from
// Google Identity Services on the page. Verified server-side; on success
// a session is created exactly like the Instagram one.
async function handleGoogleAuth(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. POST JSON to /api/interview/auth/google." }, 405);
  }
  if (!env.NOTES) return json({ ok: false, reason: "resting" });
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON like { \"credential\": \"...\" }." }, 400);
  }
  const payload = await verifyGoogleToken(body.credential || "", env);
  if (!payload) {
    return json({ error: "That Google sign-in did not check out — please try again." }, 401);
  }
  const id = await createInterviewSession(env, {
    provider: "google",
    username: "",
    name: payload.name || "",
    profileUrl: "",
  });
  return new Response(JSON.stringify({ ok: true, provider: "google", name: payload.name || "" }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": sessionCookie(id) },
  });
}

// GET /api/interview/me — who is signed in, if anyone, and whether
// Instagram sign-in is configured on this Worker.
async function handleInterviewMe(request, env) {
  const s = await getInterviewSession(request, env);
  return json({
    signedIn: !!s,
    provider: s ? s.provider : "",
    username: s ? s.username : "",
    name: s ? s.name : "",
    profileUrl: s ? s.profileUrl : "",
    instagramConfigured: !!env.INSTAGRAM_CLIENT_ID,
  });
}

// GET /api/interview/auth/signout — clears the session and the cookie.
async function handleInterviewSignOut(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/(?:^|;\s*)interview_session=([A-Za-z0-9]+)/);
  if (m && env.NOTES) await env.NOTES.delete(`isession-${m[1]}`);
  const r = redirectTo(request, "/share-your-story/");
  r.headers.set("Set-Cookie", clearSessionCookie());
  return r;
}

// POST /api/interview — signed-in artists only. The identity comes from
// the session, never from the request body, so nobody can submit as
// someone else. Instagram sessions lock the social link to the verified
// handle; Google sessions take the pasted link (allowlisted), and the
// handle is then checked against the DM the artist is asked to send.
async function handleInterview(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. POST JSON to /api/interview." }, 405);
  }
  if (!env.NOTES) return json({ ok: false, reason: "resting" });
  const session = await getInterviewSession(request, env);
  if (!session) {
    return json({ error: "Please sign in first — that is how the site knows the account is really yours." }, 401);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send JSON like { \"name\": \"...\", \"social\": \"...\", \"q1\": \"...\", \"q2\": \"...\", \"q3\": \"...\", \"permission\": true }." }, 400);
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return json({ error: "Please give your name (up to 100 characters)." }, 400);
  }
  let social = "";
  let handleVerified = false;
  let verifiedBy = session.provider;
  if (session.provider === "instagram") {
    social = session.profileUrl;
    handleVerified = true;
  } else {
    social = socialProfileUrl(body.social);
    if (!social) {
      return json({ error: "Please paste a link to your social profile — Instagram, X, Threads, YouTube, Facebook or TikTok." }, 400);
    }
  }
  const social2 = body.social2 ? socialProfileUrl(body.social2) : "";
  if (body.social2 && !social2) {
    return json({ error: "That second social link does not look like a profile link — check it, or leave it blank." }, 400);
  }
  const answers = {};
  for (const q of ["q1", "q2", "q3"]) {
    const a = typeof body[q] === "string" ? body[q].trim() : "";
    if (a.length < 10 || a.length > 5000) {
      return json({ error: "Please answer all three questions — a few sentences each is plenty, up to 5000 characters per answer." }, 400);
    }
    answers[q] = a;
  }
  if (body.permission !== true) {
    return json({ error: "Please tick the permission box — without it your story cannot be shared." }, 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (rateLimited(ip)) {
    return json({ ok: false, reason: "resting" });
  }
  const key = `interview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await env.NOTES.put(
    key,
    JSON.stringify({
      name,
      social,
      social2: social2 || "",
      q1: answers.q1,
      q2: answers.q2,
      q3: answers.q3,
      permission: true,
      identity: {
        provider: session.provider,
        username: session.username || "",
        name: session.name || "",
        profileUrl: session.profileUrl || "",
      },
      verifiedBy,
      handleVerified,
      verified: handleVerified,
      status: "pending",
      at: new Date().toISOString(),
    })
  );
  return json({ ok: true });
}

// Non-streaming answer: the original whole-answer path, kept as the
// fallback when streaming is unavailable, and the path that populates
// the cache. Returns {answer, sources, paused}.
async function answerOnce(question, env, gateway) {
  // The embed call goes DIRECT to Workers AI, not through the gateway:
  // an embedding turns text into numbers and cannot produce text, leak
  // anything, or be talked into saying anything — guardrails on it are
  // pure overhead (measured: ~1.4s of guard time per embed). The same
  // question text is still screened by Prompt Guard when it reaches the
  // chat model through the gateway, and the answer is still screened by
  // Llama Guard there, so the safety posture does not change.
  const embedding = await env.AI.run(env.EMBED_MODEL || "@cf/baai/bge-m3", {
    text: [question],
  });
  const vector = embedding.data[0];

  const topK = Number(env.TOP_K || 5);
  const results = await env.VECTORIZE.query(vector, { topK, returnMetadata: "all" });
  const matches = (results.matches || []).filter((m) => m.score > MIN_SCORE);
  if (matches.length === 0) {
    return { answer: FIXED_REFUSAL, sources: [], paused: false, noMatch: true };
  }

  const sources = dedupeByUrl(
    matches.map((m) => ({
      title: m.metadata.title,
      url: m.metadata.url,
      chunk: m.metadata.text,
    }))
  );
  const sourceBlock = sources
    .map((s, i) => `<source id="${i + 1}" title="${s.title}" url="${s.url}">\n${s.chunk}\n</source>`)
    .join("\n\n");
  const sourceList = sources.map((s) => ({ title: s.title, url: s.url }));

  // Guardrails run on the AI Gateway (Prompt Guard on the prompt,
  // Llama Guard on the response): a block comes back as an error and
  // lands in the caller's catch, which returns the warm refusal.
  const completion = await env.AI.run(
    env.CHAT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Question: ${question}\n\n${sourceBlock}\n\nAnswer only from the sources above, citing the post title only. Do not write any link.`,
        },
      ],
      temperature: 0.2,
      max_tokens: Number(env.MAX_ANSWER_TOKENS || 350),
    },
    gateway
  );

  const draft = (completion.response || "").trim();
  if (!answerIsSafe(draft, sourceList)) {
    return {
      answer: `${FIXED_REFUSAL} ${sourceList[0].title} — ${sourceList[0].url}`,
      sources: sourceList,
      paused: false,
      unsafe: true,
    };
  }
  return { answer: draft, sources: sourceList, paused: false };
}

// Streaming answer: same retrieval, but the model's tokens flow to the
// reader as SSE events ({delta}) as they arrive, with a final event
// carrying the sources ({sources, done:true}). Safety runs as the text
// accumulates: personal data appearing mid-stream aborts the stream and
// the reader is told to show the fixed refusal instead ({refusal}).
// The citation check still runs on the finished text before the final
// event, so an answer that never cites its source is replaced too.
// A good streamed answer is cached, so the next identical question is
// instant. Returns a Response, or null when streaming could not start
// (the caller then falls back to answerOnce).
async function answerStream(question, env, gateway) {
  // Embed direct, not through the gateway — see answerOnce for why.
  const embedding = await env.AI.run(env.EMBED_MODEL || "@cf/baai/bge-m3", {
    text: [question],
  });
  const vector = embedding.data[0];

  const topK = Number(env.TOP_K || 5);
  const results = await env.VECTORIZE.query(vector, { topK, returnMetadata: "all" });
  const matches = (results.matches || []).filter((m) => m.score > MIN_SCORE);
  if (matches.length === 0) {
    return json({ answer: FIXED_REFUSAL, sources: [], paused: false });
  }

  const sources = dedupeByUrl(
    matches.map((m) => ({
      title: m.metadata.title,
      url: m.metadata.url,
      chunk: m.metadata.text,
    }))
  );
  const sourceBlock = sources
    .map((s, i) => `<source id="${i + 1}" title="${s.title}" url="${s.url}">\n${s.chunk}\n</source>`)
    .join("\n\n");
  const sourceList = sources.map((s) => ({ title: s.title, url: s.url }));
  const refusalText = `${FIXED_REFUSAL} ${sourceList[0].title} — ${sourceList[0].url}`;

  let stream;
  try {
    stream = await env.AI.run(
      env.CHAT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
      {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Question: ${question}\n\n${sourceBlock}\n\nAnswer only from the sources above, citing the post title only. Do not write any link.`,
          },
        ],
        temperature: 0.2,
        max_tokens: Number(env.MAX_ANSWER_TOKENS || 350),
        stream: true,
      },
      gateway
    );
  } catch {
    // Streaming not available through this route — caller falls back.
    return null;
  }
  if (!stream || typeof stream.getReader !== "function") return null;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const key = env.NOTES ? await cacheKey(question) : null;

  (async () => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let aborted = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          let parsed;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }
          const piece = parsed.response || "";
          if (!piece) continue;
          full += piece;
          if (PII_PATTERNS.some((re) => re.test(full))) {
            aborted = true;
            await writer.write(sse({ refusal: refusalText, sources: sourceList }));
            await writer.close();
            try {
              reader.cancel();
            } catch {}
            return;
          }
          await writer.write(sse({ delta: piece }));
        }
      }
      const draft = full.trim();
      if (!answerIsSafe(draft, sourceList)) {
        await writer.write(sse({ refusal: refusalText, sources: sourceList }));
      } else {
        if (env.NOTES && key) {
          await env.NOTES
            .put(key, JSON.stringify({ answer: draft, sources: sourceList }), {
              expirationTtl: CACHE_TTL_SECONDS,
            })
            .catch(() => {});
        }
        await writer.write(sse({ sources: sourceList, done: true }));
      }
      await writer.close();
    } catch {
      if (!aborted) {
        try {
          await writer.write(sse({ refusal: FIXED_REFUSAL, sources: [] }));
          await writer.close();
        } catch {}
      }
    }
  })();

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/api/note")) {
      return handleNote(request, env);
    }
    if (url.pathname.endsWith("/api/interview/auth/instagram/callback")) {
      return handleInstagramAuthCallback(request, env);
    }
    if (url.pathname.endsWith("/api/interview/auth/instagram")) {
      return handleInstagramAuthStart(request, env);
    }
    if (url.pathname.endsWith("/api/interview/auth/google")) {
      return handleGoogleAuth(request, env);
    }
    if (url.pathname.endsWith("/api/interview/auth/signout")) {
      return handleInterviewSignOut(request, env);
    }
    if (url.pathname.endsWith("/api/interview/me")) {
      return handleInterviewMe(request, env);
    }
    if (url.pathname.endsWith("/api/interview")) {
      return handleInterview(request, env);
    }
    if (url.pathname.endsWith("/api/suggest")) {
      return handleSuggest(request, env);
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed. POST a JSON question to /api/ask." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Send JSON like { \"question\": \"...\" }." }, 400);
    }

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const maxChars = Number(env.MAX_QUESTION_CHARS || 500);
    if (!question || question.length > maxChars) {
      return json({ error: `Ask one question, up to ${maxChars} characters.` }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) {
      return json({
        answer: PAUSED_MESSAGE,
        sources: [],
        paused: true,
      });
    }

    const gateway = env.AI_GATEWAY_ID ? { gateway: { id: env.AI_GATEWAY_ID } } : undefined;

    // Repeated questions come straight from the cache — no AI call.
    const key = env.NOTES ? await cacheKey(question) : null;
    if (env.NOTES && key) {
      try {
        const hit = await env.NOTES.get(key, "json");
        if (hit && hit.answer && hit.sources) {
          return json({ answer: hit.answer, sources: hit.sources, paused: false, cached: true });
        }
      } catch {}
    }

    try {
      // Fast path: stream the answer as it is written.
      const streamed = await answerStream(question, env, gateway);
      if (streamed) return streamed;

      // Fallback: whole-answer path (also populates the cache).
      const result = await answerOnce(question, env, gateway);
      if (!result.noMatch && !result.unsafe && !result.paused && env.NOTES && key) {
        await env.NOTES
          .put(key, JSON.stringify({ answer: result.answer, sources: result.sources }), {
            expirationTtl: CACHE_TTL_SECONDS,
          })
          .catch(() => {});
      }
      return json({ answer: result.answer, sources: result.sources, paused: result.paused });
    } catch (err) {
      // Daily neuron allowance used up, gateway block, or any AI error:
      // never show an error page. The chat rests; search keeps working.
      // (A gateway prompt/response block also lands here with a 2016/2017
      // error — same warm refusal, never the raw error.)
      const message = String(err && err.message ? err.message : err);
      if (/2016|2017|prompt.*block|guardrail/i.test(message)) {
        return json({
          answer: FIXED_REFUSAL,
          sources: [],
          paused: false,
        });
      }
      return json({
        answer: PAUSED_MESSAGE,
        sources: [],
        paused: true,
      });
    }
  },
};
