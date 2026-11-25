// Build the site AI's knowledge store from PUBLISHED posts only.
//
// Reads content/posts/*.md, skips anything still a draft (draft: true in
// front matter, or the directory default in posts.11tydata.js), chunks the
// text, scrubs personal data, and writes site-ai/index/chunks.jsonl — one
// JSON object per chunk: { id, text, metadata: { title, url, date } }.
//
// This script never touches anything outside content/posts/. Anything not
// in the public posts folder cannot enter the index — that is the point.
// Run it after publishing new posts, then run embed-and-insert.mjs to put
// the new chunks into Vectorize.
//
// Usage:  node site-ai/scripts/build-index.mjs [--lang <code>]
//         [--posts-dir <path>] [--out <path>]
// Output: site-ai/index/chunks.jsonl  (generated, public-safe, git-ignored)
//         or site-ai/index/chunks-<lang>.jsonl with --lang.
//
// Multilingual Ask: one Vectorize index holds every language, and each
// chunk carries metadata.lang. The Worker filters retrieval by lang, so a
// visitor only ever gets answers from writing in their own language.
// Run once per language repo, e.g.:
//   node site-ai/scripts/build-index.mjs --lang es \
//     --posts-dir ~/workspace/jonathanmccallum-es/content/posts
//   node site-ai/scripts/embed-and-insert.mjs --lang es --dry-run
// The chunks files are build artefacts (git-ignored); the Vectorize
// insert is what the Worker reads. Never answer from another language's
// chunks — if a language has no chunks, the Worker says so instead.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function argVal(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const LANG = (argVal("--lang", "en") || "en").toLowerCase();
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = argVal(
  "--posts-dir",
  path.join(SCRIPT_DIR, "..", "..", "content", "posts")
);
const OUT_FILE = argVal(
  "--out",
  path.join(
    SCRIPT_DIR,
    "..",
    "index",
    LANG === "en" ? "chunks.jsonl" : `chunks-${LANG}.jsonl`
  )
);

const CHUNK_WORDS = 400;
const OVERLAP_WORDS = 50;

// Excluded from the index, always — even if a post is published one day:
// anything about Carl Medearis (someone else speaking, not Jonathan)
// and anything about AI (Jonathan does not want AI talked about in posts).
const EXCLUDED_FILES = ["carl-medearis", "chatgpt"];
const EXCLUDED_CONTENT = ["Medearis"];

// Personal-data scrub: if it ever appears in a post, it must not reach
// the index. Public bylines and place names in the writing stay — those
// are the published words themselves.
const PII_PATTERNS = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email removed]"],
  [/\+?\d[\d\s().-]{7,}\d/g, "[phone removed]"],
];

function parseFrontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { data, body: m[2] };
}

function cleanBody(body) {
  return body
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → link text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scrub(text) {
  let out = text;
  for (const [re, replacement] of PII_PATTERNS) out = out.replace(re, replacement);
  return out;
}

function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += CHUNK_WORDS - OVERLAP_WORDS) {
    const slice = words.slice(i, i + CHUNK_WORDS);
    if (slice.length < 20 && chunks.length > 0) break; // drop tiny tail
    chunks.push(slice.join(" "));
    if (i + CHUNK_WORDS >= words.length) break;
  }
  return chunks;
}

function postUrl(data, file) {
  // Keep old jonathanmccallum.com addresses working; anything from
  // elsewhere (e.g. Substack) gets the same date-based address the site
  // itself publishes the post at — never a Substack "/p/" address.
  if (data.original_url) {
    try {
      const u = new URL(data.original_url);
      if (u.hostname === "jonathanmccallum.com" || u.hostname === "www.jonathanmccallum.com") {
        let p = u.pathname;
        if (!p.endsWith("/")) p += "/";
        return p;
      }
    } catch {
      // fall through
    }
  }
  const m = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (m) return `/${m[1]}/${m[2]}/${m[3]}/${m[4]}/`;
  return `/${file.replace(/\.md$/, "")}/`;
}

const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
const chunks = [];
let published = 0;
let skippedDraft = 0;
let skippedExcluded = 0;

for (const file of files.sort()) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
  if (
    EXCLUDED_FILES.some((s) => file.includes(s)) ||
    EXCLUDED_CONTENT.some((s) => raw.includes(s))
  ) {
    skippedExcluded++;
    continue;
  }
  const { data, body } = parseFrontMatter(raw);
  // Drafts are held back by posts.11tydata.js (draft: true) unless a post
  // opts out with `draft: false` in its own front matter.
  if (data.draft !== "false") {
    skippedDraft++;
    continue;
  }
  published++;
  const text = scrub(cleanBody(body));
  if (!text) continue;
  const url = postUrl(data, file);
  const title = data.title || file.replace(/\.md$/, "");
  chunkText(text).forEach((chunk, i) => {
    chunks.push({
      // Chunk ids are namespaced by language, so re-indexing one language
      // never overwrites another's chunks in the shared Vectorize index.
      id: `${LANG}-${data.slug || file.replace(/\.md$/, "")}-${i}`,
      text: chunk,
      metadata: { title, url, date: data.date || "", chunk: i, lang: LANG },
    });
  });
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(
  OUT_FILE,
  chunks.map((c) => JSON.stringify(c)).join("\n") + (chunks.length ? "\n" : "")
);

console.log(`posts published: ${published}, drafts skipped: ${skippedDraft}, excluded: ${skippedExcluded}`);
console.log(`chunks written: ${chunks.length} → ${OUT_FILE}`);
if (chunks.length === 0) {
  console.log("NOTE: the index is empty because no posts are published yet.");
  console.log("Publish posts first (see MAINTENANCE.md), then re-run this script.");
}
