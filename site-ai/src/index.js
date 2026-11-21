// Site AI for jonathanmccallum.com — a stateless RAG Worker.
//
// SEPARATION (hard rule): this Worker knows ONLY Jonathan's published
// writing. It reads one Vectorize index built from the public posts folder
// and nothing else. It has no tools, no web access, no memory, no history,
// no personal data in its prompt, and no connection to his personal
// assistant (Muse/Bobby). If it is not in a published post, it cannot
// answer it — by construction, not by promise.
//
// Flow: embed the question → retrieve the top 5 chunks → ask a small
// Workers AI model to answer ONLY from those chunks, with citations →
// check the draft answer in code → return it, or a fixed warm refusal.
// On any AI error or daily-limit hit, return the graceful "resting"
// message and let the Pagefind search on the site do the work.
//
// Routes (set in the Cloudflare dashboard after sign-in):
//   jonathanmccallum.com/api/ask   →  this Worker (chat)
//   jonathanmccallum.com/api/note  →  this Worker (anonymous reader notes)
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
- Name the post your answer comes from, by its title only. The page already shows the link, so do not write a link or a URL in your answer.
- If the answer is not in the sources, or the question is about Jonathan himself, his family, his contact details, his private life, or anything unpublished, say you can only help with his published writing and suggest one of the source posts.
- Keep to what the sources say. Do not add facts, dates or quotes that are not there, and do not offer moral or theological advice beyond what the sources themselves say.
- Be honest about suffering: a simple "I don't know" is better than a quick answer that harms people. Questions over lectures.`;

const PII_PATTERNS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // email address
  /\+?\d[\d\s().-]{7,}\d/, // phone-like number
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/api/note")) {
      return handleNote(request, env);
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

    try {
      // 1. Embed the question (same model as the index was built with).
      const embedding = await env.AI.run(
        env.EMBED_MODEL || "@cf/baai/bge-m3",
        { text: [question] },
        gateway
      );
      const vector = embedding.data[0];

      // 2. Retrieve the top chunks from the published posts ONLY.
      const topK = Number(env.TOP_K || 5);
      const results = await env.VECTORIZE.query(vector, { topK, returnMetadata: "all" });
      const matches = (results.matches || []).filter((m) => m.score > MIN_SCORE);
      if (matches.length === 0) {
        return json({
          answer: FIXED_REFUSAL,
          sources: [],
          paused: false,
        });
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

      // 3. Ask the model — grounded, low temperature, capped output.
      // Guardrails run on the AI Gateway (Prompt Guard on the prompt,
      // Llama Guard on the response): a block comes back as an error and
      // lands in the catch below, which returns the warm refusal.
      const completion = await env.AI.run(
        env.CHAT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
        {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Question: ${question}\n\n${sourceBlock}\n\nAnswer only from the sources above, citing the post title and linking to it.`,
            },
          ],
          temperature: 0.2,
          max_tokens: Number(env.MAX_ANSWER_TOKENS || 350),
        },
        gateway
      );

      const draft = (completion.response || "").trim();

      // 4. Code-level output check. Any failure → fixed refusal, whole answer.
      if (!answerIsSafe(draft, sourceList)) {
        return json({
          answer: `${FIXED_REFUSAL} ${sourceList[0].title} — ${sourceList[0].url}`,
          sources: sourceList,
          paused: false,
        });
      }

      return json({ answer: draft, sources: sourceList, paused: false });
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
