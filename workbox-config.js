/* eslint-env node */
/** @type {import('workbox-build').GenerateSWOptions} */
module.exports = {
  globDirectory: "dist",
  globPatterns: ["**/*.{html,js,css,png,ico,json,svg,woff2,webmanifest}"],
  swDest: "dist/sw.js",
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
};
