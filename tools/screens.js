/* Screenshots for review (not part of the site).
   node tools/screens.js <outDir> [page...]   pages like "index.html@360" or "store/?shop=kirana@360" */
"use strict";
const { serve, BASE } = require("../tests/serve-subpath.js");
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const out = process.argv[2] || "screens";
  fs.mkdirSync(out, { recursive: true });
  const list = process.argv.slice(3);
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port + BASE + "/";
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const item of list) {
    const [url, w, mode] = item.split("@");
    const width = Number(w) || 360;
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1, serviceWorkers: "block", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
    await page.goto(base + url, { waitUntil: "load" });
    await page.evaluate(async () => {
      document.querySelectorAll("img[loading=lazy]").forEach((i) => { i.loading = "eager"; });
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
      window.scrollTo(0, 0);
      await Promise.all(Array.from(document.images).map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })));
    });
    await page.waitForTimeout(500);
    const name = (url.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home") + "-" + width + (mode === "fold" ? "-fold" : "") + ".png";
    await page.screenshot({ path: out + "/" + name, fullPage: mode !== "fold" });
    console.log(out + "/" + name);
    await ctx.close();
  }
  await browser.close(); srv.close();
})();
