// Build the site's social share image (1200x630) from Jonathan's own
// wave photo. Runs at build time from package.json postbuild. If sharp or
// the source photo is missing, it skips cleanly instead of failing the
// build — the pages still carry the og:image tag, which then 404s until
// the photo is back, so check the build log.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "content", "images", "2015-08-WaveJMcCallum.jpg");
const out = path.join(root, "_site", "images", "share.jpg");

if (!fs.existsSync(src)) {
  console.log("share image source missing — skipping.");
  process.exit(0);
}

try {
  const { default: sharp } = await import("sharp");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(src).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 80 }).toFile(out);
  console.log("share image written:", out);
} catch (err) {
  console.log("share image build skipped:", err.message);
  process.exit(0);
}
