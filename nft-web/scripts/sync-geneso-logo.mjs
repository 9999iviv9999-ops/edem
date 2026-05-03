/**
 * Single source: src/assets/geneso-logo.jpg → public/geneso-logo.jpg
 * (guides and direct URLs). Runs via npm predev / prebuild.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "src", "assets", "geneso-logo.jpg");
const dest = path.join(root, "public", "geneso-logo.jpg");

if (!fs.existsSync(src)) {
  console.error("sync-geneso-logo: missing source file:", src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
