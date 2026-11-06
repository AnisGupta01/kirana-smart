/* Renders tools/og/og-image.html to assets/images/og-image.png (1200x630).
   Needs playwright + Chromium (same as the browser tests).
   Run: node tools/og/render-og.js */
"use strict";
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/npm-tools/node_modules/playwright")); }
(async () => {
  const root = path.join(__dirname, "..", "..");
  const browser = await chromium.launch({ args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto("file://" + path.join(__dirname, "og-image.html"));
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(root, "assets/images/og-image.png");
  await page.locator("#og").screenshot({ path: out });
  /* keep it small (static test: images <= 150 KB): 256-colour PNG via ImageMagick when available */
  try { require("child_process").execFileSync("magick", [out, "-dither", "FloydSteinberg", "-colors", "256", "-strip", "PNG8:" + out]); } catch (e) { console.log("(ImageMagick not found: PNG left uncompressed)"); }
  await browser.close();
  console.log("wrote assets/images/og-image.png");
})();
