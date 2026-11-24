// Generate the 150px WebP thumbnails the suggest carousel references.
//
// Why this exists: the carousel data (_data/suggest_carousel.json) points
// at /images/<handle>-150w.webp, but no original JPEG is ever copied into
// the build output (there is deliberately no passthrough for
// content/images), and the responsiveImages transform only emits WebP/AVIF
// derivatives for <img> tags it sees in server-rendered HTML. The carousel
// cards past the first 30 are built in the browser by js/suggest.js from
// embedded JSON, so their images never go through that transform — and the
// original /images/suggest-carousel/*.jpg and /images/music-faith/*.jpg
// paths 404 live. This step generates the WebP files the data references,
// from the local 150px JPEG sources, using the same filename format as the
// transform (<name>-150w.webp). Only the carousel images are generated —
// NOT the whole content/images folder (the ~121 MB of recovered originals
// stays out of the deploy, per the note in .eleventy.js). Runs at build
// time from package.json postbuild. Fails soft, like build-og-images.mjs:
// a missing file is logged, never a build failure.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Image from "@11ty/eleventy-img";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "_data", "suggest_carousel.json");
const outDir = path.join(root, "_site", "images");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

let generated = 0;
let alreadyThere = 0;
let missing = 0;
for (const artist of data) {
  const handle = artist.handle;
  if (!handle) continue;
  const dest = path.join(outDir, `${handle}-150w.webp`);
  // The transform may already have produced this file for images the
  // server-rendered pages reference (homepage first 30, lang taster).
  if (fs.existsSync(dest)) {
    alreadyThere++;
    continue;
  }
  const candidates = [
    path.join(root, "content", "images", "suggest-carousel", `${handle}.jpg`),
    path.join(root, "content", "images", "music-faith", `${handle}.jpg`),
  ];
  const src = candidates.find((c) => fs.existsSync(c));
  if (!src) {
    console.log(`carousel image missing, skipping: ${handle}`);
    missing++;
    continue;
  }
  await Image(src, {
    widths: [150],
    formats: ["webp"],
    outputDir: outDir,
    urlPath: "/images/",
    filenameFormat: (id, srcPath, width, format) => {
      const name = path.parse(srcPath).name;
      return `${name}-${width}w.${format}`;
    },
  });
  generated++;
}
console.log(
  `carousel images: ${generated} generated, ${alreadyThere} already there (${missing} missing)`
);
