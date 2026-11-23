// Copy each published post's shareImage JPEG into the build output, so the
// og:image / twitter:image URLs the pages already carry actually resolve.
// The responsiveImages transform only emits AVIF/WebP derivatives, so
// without this step every per-post og:image 404s. Only published posts'
// shareImages are copied (about 26 small files) — NOT the whole
// content/images folder (the ~121 MB of recovered originals stays out of
// the deploy, per the note in .eleventy.js). Runs at build time from
// package.json postbuild. Fails soft, like build-share-image.mjs: a
// missing file is logged, never a build failure.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content", "posts");
const outDir = path.join(root, "_site", "images");

let copied = 0;
let missing = 0;
for (const file of fs.readdirSync(postsDir)) {
  if (!file.endsWith(".md")) continue;
  const text = fs.readFileSync(path.join(postsDir, file), "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) continue;
  const draft = fm[1].match(/^draft:\s*(.+)$/m);
  if (draft && draft[1].trim() === "true") continue;
  const img = fm[1].match(/^shareImage:\s*(.+)$/m);
  if (!img) continue;
  const rel = img[1].trim().replace(/^\/+/, "");
  const src = path.join(root, "content", rel);
  const dest = path.join(root, "_site", rel);
  if (!fs.existsSync(src)) {
    console.log(`og image missing, skipping: ${rel} (${file})`);
    missing++;
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}
console.log(`og images copied: ${copied} (${missing} missing)`);
