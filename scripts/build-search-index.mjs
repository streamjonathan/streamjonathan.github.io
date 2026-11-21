// Build the Pagefind search index over the built site (_site/).
// Pagefind only indexes what is actually published, so draft posts are
// never searchable — the index grows automatically as posts go live.
// If Pagefind is not installed (e.g. a fresh checkout before `npm install`),
// this skips cleanly instead of failing the build.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// pagefind ships as an ESM-only binary package (no CJS export), so detect
// it by the installed binary rather than require.resolve().
const pagefindBin = path.join(root, "node_modules", ".bin", "pagefind");
if (!fs.existsSync(pagefindBin)) {
  console.log("pagefind not installed — search index skipped (run `npm install`).");
  process.exit(0);
}

try {
  execSync("npx pagefind --site _site --output-subdir pagefind", {
    cwd: root,
    stdio: "inherit",
  });
} catch (err) {
  console.log("pagefind index build failed — continuing without search:", err.message);
  process.exit(0);
}
