/**
 * Copies the app icon into public/ for the PWA manifest (picked up by `expo export -p web`).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "assets", "images", "icon.png");
const destDir = path.join(root, "public");
const dest = path.join(destDir, "pwa-icon.png");

if (!fs.existsSync(src)) {
  console.error("copy-pwa-icon: missing", src);
  process.exit(1);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("copy-pwa-icon:", path.relative(root, dest));
