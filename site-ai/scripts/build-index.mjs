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
// Usage:  node site-ai/scripts/build-index.mjs
// Output: site-ai/index/chunks.jsonl  (generated, public-safe, git-ignored)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const POSTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "content",
  "posts"
);
const OUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "index",
  "chunks.jsonl"
);

const CHUNK_WORDS = 400;
const OVERLAP_WORDS = 50;

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
  if (data.original_url) {
    try {
      return new URL(data.original_url).pathname;
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

for (const file of files.sort()) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
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
      id: `${data.slug || file.replace(/\.md$/, "")}-${i}`,
      text: chunk,
      metadata: { title, url, date: data.date || "", chunk: i },
    });
  });
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(
  OUT_FILE,
  chunks.map((c) => JSON.stringify(c)).join("\n") + (chunks.length ? "\n" : "")
);

console.log(`posts published: ${published}, drafts skipped: ${skippedDraft}`);
console.log(`chunks written: ${chunks.length} → ${OUT_FILE}`);
if (chunks.length === 0) {
  console.log("NOTE: the index is empty because no posts are published yet.");
  console.log("Publish posts first (see MAINTENANCE.md), then re-run this script.");
}
