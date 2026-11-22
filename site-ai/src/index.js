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
