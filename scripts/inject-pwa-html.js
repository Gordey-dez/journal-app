/**
 * Injects PWA tags into every HTML file in dist/ after `expo export -p web`.
 * Static export does not merge link/meta from public/index.html into prerendered pages.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const marker = "<!--expo-pwa-->";
const headSnippet = `${marker}<style id="pwa-text-adjust">html{-webkit-text-size-adjust:100%;text-size-adjust:100%}</style><link rel="manifest" href="/manifest.json"/><meta name="theme-color" content="#000000"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><link rel="apple-touch-icon" href="/pwa-icon.png"/>`;
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
let injected = 0;
let viewportFixed = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let html = original;
  const beforeVp = html;
  html = html.replace(
    /name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/g,
    'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"'
  );
  if (html !== beforeVp) viewportFixed++;

  if (!html.includes(marker)) {
    if (!html.includes("<head>")) {
      console.warn("inject-pwa-html: skip PWA inject (no <head>)", path.relative(root, file));
    } else if (!html.includes("</body>")) {
      console.warn("inject-pwa-html: skip PWA inject (no </body>)", path.relative(root, file));
    } else {
      html = html.replace("<head>", `<head>${headSnippet}`);
      html = html.replace("</body>", `${bodySnippet}</body>`);
      injected++;
    }
  }

  if (html !== original) {
    fs.writeFileSync(file, html);
  }
}
console.log(
  "inject-pwa-html: PWA tags in",
  injected,
  "file(s); viewport normalized in",
  viewportFixed,
  "file(s)"
);
