// Embed the chunks from site-ai/index/chunks.jsonl and insert them into
// the Vectorize index, using the Cloudflare REST API.
//
// Requires a Cloudflare account (free) and two environment variables —
// never commit them, never put them in the repo:
//   CF_ACCOUNT_ID   (dashboard → Account ID)
//   CF_API_TOKEN    (dashboard → My Profile → API Tokens; needs
//                    Workers AI:Edit and Vectorize:Edit on this account)
//   --dry-run       print counts only, make no API calls
//
// Usage:
//   node site-ai/scripts/build-index.mjs        # first, build the chunks
//   node site-ai/scripts/embed-and-insert.mjs --dry-run
//   CF_ACCOUNT_ID=... CF_API_TOKEN=... node site-ai/scripts/embed-and-insert.mjs
//
// Free-tier notes: embeddings (bge-m3) cost ~$0.012 per 1M tokens and
// Vectorize free holds 5M stored dimensions — 179 posts chunked is a few
// thousand vectors, far inside the free allowance. Re-running replaces
// chunks by id (upsert), so re-indexing after publishing new posts is safe.
//
// MULTILINGUAL: one shared index, metadata.lang per chunk. Run once per
// language (the chunks file comes from build-index.mjs --lang <code>):
//   node site-ai/scripts/embed-and-insert.mjs --lang es --dry-run
//   CF_ACCOUNT_ID=... CF_API_TOKEN=<redacted> node site-ai/scripts/embed-and-insert.mjs --lang es
// All 50 languages together are ~3,564 chunks × 1024 dims ≈ 3.65M stored
// dimensions — inside the 5M free allowance, with ~1.3M dims of headroom.
// One-time migration note: chunks built before this branch used ids
// without a language prefix (e.g. "to-sea-0"). After the first
// --lang run, delete those old ids from the index (or recreate the
// index empty first) so the old unfiltered English chunks do not linger
// alongside the new "en-…" ones.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function argVal(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const LANG = (argVal("--lang", "en") || "en").toLowerCase();
const CHUNKS_FILE = argVal(
  "--chunks-file",
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "index",
    LANG === "en" ? "chunks.jsonl" : `chunks-${LANG}.jsonl`
  )
);
const INDEX_NAME = "jonathanmccallum-posts";
const EMBED_MODEL = "@cf/baai/bge-m3";
const EMBED_BATCH = 50;
const INSERT_BATCH = 100;

const DRY_RUN = args.includes("--dry-run");
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const API_TOKEN = process.env.CF_API_TOKEN;

if (!fs.existsSync(CHUNKS_FILE)) {
  console.error(`No chunks file. Run: node site-ai/scripts/build-index.mjs --lang ${LANG}`);
  process.exit(1);
}
const chunks = fs
  .readFileSync(CHUNKS_FILE, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

// Safety: every chunk inserted by this run must carry this run's lang,
// so a wrong file can never pollute another language's answers.
const wrongLang = chunks.filter((c) => c.metadata && c.metadata.lang && c.metadata.lang !== LANG);
if (wrongLang.length) {
  console.error(`Refusing: ${wrongLang.length} chunks in ${CHUNKS_FILE} are not lang="${LANG}". Rebuild with build-index.mjs --lang ${LANG} first.`);
  process.exit(1);
}
for (const c of chunks) c.metadata = { ...c.metadata, lang: LANG };

console.log(`lang: ${LANG} — chunks to index: ${chunks.length}`);
if (chunks.length === 0) {
  console.log("Nothing to do — no published posts yet.");
  process.exit(0);
}
if (DRY_RUN) {
  console.log("Dry run — no API calls made.");
  process.exit(0);
}
if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("Set CF_ACCOUNT_ID and CF_API_TOKEN first (see the header of this file).");
  process.exit(1);
}

async function api(pathname, method, payload) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${pathname}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  if (!data.success) {
    throw new Error(`${method} ${pathname} failed: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

let embedded = 0;
try {
  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    const batch = chunks.slice(i, i + EMBED_BATCH);
    const result = await api(`/ai/run/${EMBED_MODEL}`, "POST", {
      text: batch.map((c) => c.text),
    });
    const vectors = result.data.map((values, j) => ({
      id: batch[j].id,
      values,
      metadata: { ...batch[j].metadata, text: batch[j].text },
    }));
    for (let k = 0; k < vectors.length; k += INSERT_BATCH) {
      await api(`/vectorize/v2/indexes/${INDEX_NAME}/insert`, "POST", {
        vectors: vectors.slice(k, k + INSERT_BATCH),
      });
    }
    embedded += batch.length;
    console.log(`embedded + inserted ${embedded}/${chunks.length}`);
  }
  console.log(`Done. ${embedded} chunks live in the "${INDEX_NAME}" index.`);
} catch (err) {
  console.error("FAILED:", err.message);
  process.exit(1);
}
