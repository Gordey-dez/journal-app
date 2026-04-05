/**
 * Injects PWA tags into every HTML file in dist/ after `expo export -p web`.
 * Static export does not merge link/meta from public/index.html into prerendered pages.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const marker = "<!--expo-pwa-->";
const headSnippet = `${marker}<link rel="manifest" href="/manifest.json"/><meta name="theme-color" content="#000000"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><link rel="apple-touch-icon" href="/pwa-icon.png"/>`;
const bodySnippet = `<script>if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>`;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

if (!fs.existsSync(dist)) {
  console.error("inject-pwa-html: dist/ not found. Run expo export -p web first.");
  process.exit(1);
}

const files = walk(dist);
let n = 0;
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes(marker)) continue;
  if (!html.includes("<head>")) {
    console.warn("inject-pwa-html: skip (no <head>)", path.relative(root, file));
    continue;
  }
  html = html.replace("<head>", `<head>${headSnippet}`);
  if (!html.includes("</body>")) {
    console.warn("inject-pwa-html: skip (no </body>)", path.relative(root, file));
    continue;
  }
  html = html.replace("</body>", `${bodySnippet}</body>`);
  fs.writeFileSync(file, html);
  n++;
}
console.log("inject-pwa-html: updated", n, "file(s)");
