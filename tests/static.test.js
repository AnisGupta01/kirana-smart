/* Static checks - plain Node. Run: node tests/static.test.js
   Verifies required files, local links/script/style paths, and that the
   code avoids eval(), innerHTML and hard-coded secrets. */
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
let failed = 0, passed = 0;
function ok(c, n) { if (c) { passed++; console.log("  PASS  " + n); } else { failed++; console.log("  FAIL  " + n); } }

const required = ["index.html", "admin.html", "vercel.json", "README.md", "DEPLOYMENT.md", "TESTING.md", ".gitignore",
  "assets/css/style.css", "assets/js/config.js", "assets/js/products.js", "assets/js/i18n.js", "assets/js/common.js",
  "assets/js/cart.js", "assets/js/app.js", "assets/js/admin.js", "assets/images/logo.svg", "assets/images/placeholder.svg"];
required.forEach((f) => ok(fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).size > 0, "exists and non-empty: " + f));

["index.html", "admin.html"].forEach((page) => {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const refs = [];
  html.replace(/(?:src|href)="([^"#]+)(?:#[^"]*)?"/g, (m, u) => { if (!/^(https?:|mailto:|data:)/.test(u)) refs.push(u); return m; });
  refs.forEach((u) => ok(fs.existsSync(path.join(root, u)), page + " -> " + u));
  ok(!/\son\w+=/.test(html.replace(/<noscript[\s\S]*?<\/noscript>/g, "")), page + " has no inline event handlers");
  ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), page + " has no inline scripts (CSP-friendly)");
  ok(/<meta name="viewport"/.test(html), page + " has viewport meta");
  const ids = []; html.replace(/\sid="([^"]+)"/g, (m, i) => { ids.push(i); return m; });
  ok(new Set(ids).size === ids.length, page + " has no duplicate ids");
  const jsRefs = []; html.replace(/getElementById/g, "");
  /* every id used by app/admin JS exists in the HTML */
  const js = fs.readFileSync(path.join(root, page === "index.html" ? "assets/js/app.js" : "assets/js/admin.js"), "utf8");
  const used = new Set(); js.replace(/\$\("([A-Za-z0-9_-]+)"\)/g, (m, i) => { used.add(i); return m; });
  const dynamic = /^(tab-|panel-|f-|err-|field-|hint-|pf-|pferr-|pfield-|s-|serr-|stat-|sum|sent|msg|reopen|copyMsg|clearAfter|keepCart|formAlert|checkoutBtn|clearCartBtn|backToCart|checkoutForm|cartSubtotal|summaryBox|sendOrderBtn)/;
  const missing = Array.from(used).filter((i) => ids.indexOf(i) < 0 && !dynamic.test(i));
  ok(missing.length === 0, page + " JS element ids all exist in HTML" + (missing.length ? ": " + missing.join(",") : ""));
});

const jsDir = path.join(root, "assets/js");
fs.readdirSync(jsDir).forEach((f) => {
  const src = fs.readFileSync(path.join(jsDir, f), "utf8");
  ok(!/\beval\s*\(/.test(src), f + ": no eval()");
  ok(!/new Function\s*\(/.test(src), f + ": no new Function()");
  ok(!/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), f + ": no unsafe HTML insertion");
  ok(!/(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{6,}/i.test(src), f + ": no hard-coded secrets");
});
const cfg = fs.readFileSync(path.join(jsDir, "config.js"), "utf8");
ok(/whatsappNumber:\s*"91XXXXXXXXXX"/.test(cfg), "config.js ships a placeholder WhatsApp number");
try { JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")); ok(true, "vercel.json is valid JSON"); } catch (e) { ok(false, "vercel.json is valid JSON"); }

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
