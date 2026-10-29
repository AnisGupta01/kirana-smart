/* Static checks - plain Node. Run: node tests/static.test.js
   Verifies required files, local links/script/style paths on every page,
   CSP-friendly markup, SEO tags, PWA files, sitemap, translations, and that
   the code avoids eval(), innerHTML and hard-coded secrets. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
let failed = 0, passed = 0;
function ok(c, n) { if (c) { passed++; console.log("  PASS  " + n); } else { failed++; console.log("  FAIL  " + n); } }
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const exists = (f) => fs.existsSync(path.join(root, f));

const required = ["index.html", "store/index.html", "store/admin.html", "udhaar.html", "qr-poster.html",
  "shop-website-lucknow.html", "shop-website-kanpur.html", "shop-website-varanasi.html",
  "privacy.html", "terms.html", "refund.html", "sitemap.xml", "robots.txt", "manifest.webmanifest", "sw.js",
  "vercel.json", "README.md", "DEPLOYMENT.md", "TESTING.md", "docs/NEW-SHOP.md", ".gitignore",
  "store/shops/kirana.json", "store/shops/mithai.json", "store/shops/bakery.json", "store/shops/cloud-kitchen.json",
  "assets/css/style.css", "assets/css/site.css", "assets/css/tools.css",
  "assets/js/shop-loader.js", "assets/js/i18n.js", "assets/js/common.js", "assets/js/cart.js", "assets/js/app.js", "assets/js/admin.js",
  "assets/js/site-config.js", "assets/js/site-i18n.js", "assets/js/site.js", "assets/js/pwa.js",
  "assets/js/udhaar-core.js", "assets/js/udhaar.js", "assets/js/qr-poster.js",
  "assets/vendor/qrcode-generator/qrcode.js", "assets/vendor/qrcode-generator/LICENSE",
  "assets/images/logo.svg", "assets/images/placeholder.svg", "assets/images/og-image.png",
  "assets/images/icon-192.png", "assets/images/icon-512.png", "assets/images/icon-maskable-512.png", "assets/images/icon-180.png",
  "demo/chai/index.html", "assets/css/cinema.css", "assets/js/cinema.js", "assets/js/cinema-boot.js", "assets/js/chai-config.js",
  "assets/fonts/cormorant.woff2", "assets/fonts/cormorant-italic.woff2", "assets/fonts/inter.woff2", "assets/fonts/tiro-deva.woff2", "assets/fonts/tiro-deva-italic.woff2", "assets/fonts/LICENSE.md"];
required.forEach((f) => ok(exists(f) && fs.statSync(path.join(root, f)).size > 0, "exists and non-empty: " + f));
ok(!exists("admin.html") && !exists("assets/js/config.js") && !exists("assets/js/products.js"), "old root store files moved/removed (store now in store/, data in store/shops/)");

/* page -> the JS file whose $("id") lookups must exist in that page */
const PAGES = {
  "index.html": null, "store/index.html": "assets/js/app.js", "store/admin.html": "assets/js/admin.js",
  "udhaar.html": "assets/js/udhaar.js", "qr-poster.html": "assets/js/qr-poster.js",
  "shop-website-lucknow.html": null, "shop-website-kanpur.html": null, "shop-website-varanasi.html": null,
  "privacy.html": null, "terms.html": null, "refund.html": null,
  "demo/chai/index.html": "assets/js/cinema.js"
};
const dynamic = /^(tab-|panel-|f-|err-|field-|hint-|pf-|pferr-|pfield-|s-|serr-|stat-|sum|sent|msg|reopen|copyMsg|clearAfter|keepCart|formAlert|checkoutBtn|clearCartBtn|backToCart|checkoutForm|cartSubtotal|summaryBox|sendOrderBtn)/;

Object.keys(PAGES).forEach((page) => {
  const html = read(page);
  const dir = path.dirname(page);
  const refs = [];
  html.replace(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g, (m, u) => { if (!/^(https?:|mailto:|data:|tel:)/.test(u)) refs.push(u); return m; });
  const missingRefs = refs.filter((u) => !exists(path.join(dir, u)));
  ok(missingRefs.length === 0, page + ": all " + refs.length + " local links resolve" + (missingRefs.length ? " -> missing " + missingRefs.join(", ") : ""));
  ok(!/<script[^>]+src="https?:|<link[^>]+rel="(stylesheet|preload|modulepreload|icon)"[^>]+href="https?:|<iframe[^>]+src="https?:/.test(html), page + ": no external scripts or stylesheets (no CDN)");
  ok(!/\son\w+=/.test(html.replace(/<noscript[\s\S]*?<\/noscript>/g, "")), page + ": no inline event handlers");
  const inline = html.match(/<script(?![^>]*\ssrc=)[^>]*>/g) || [];
  ok(inline.every((t) => /type="application\/ld\+json"/.test(t)), page + ": no inline scripts except JSON-LD (CSP-friendly)");
  const ld = []; html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, j) => { ld.push(j); return m; });
  ld.forEach((j, i) => { let good = true; try { JSON.parse(j); } catch (e) { good = false; } ok(good, page + ": JSON-LD block " + (i + 1) + " is valid JSON"); });
  ok(/<meta name="viewport"/.test(html), page + ": viewport meta");
  ok(/http-equiv="Content-Security-Policy"/.test(html), page + ": Content-Security-Policy meta");
  ok(/<title[^>]*>[^<]{10,}<\/title>/.test(html), page + ": has a title");
  const ids = []; html.replace(/\sid="([^"]+)"/g, (m, i) => { ids.push(i); return m; });
  ok(new Set(ids).size === ids.length, page + ": no duplicate ids");
  if (PAGES[page]) {
    const js = read(PAGES[page]);
    const used = new Set(); js.replace(/\$\("([A-Za-z0-9_-]+)"\)/g, (m, i) => { used.add(i); return m; });
    const missing = Array.from(used).filter((i) => ids.indexOf(i) < 0 && !dynamic.test(i));
    ok(missing.length === 0, page + ": JS element ids all exist in HTML" + (missing.length ? ": " + missing.join(",") : ""));
  }
});

/* SEO on public marketing pages */
["index.html", "shop-website-lucknow.html", "shop-website-kanpur.html", "shop-website-varanasi.html"].forEach((page) => {
  const html = read(page);
  ok(/<meta name="description" content="[^"]{60,}"/.test(html), page + ": meta description");
  ok(/<link rel="canonical" href="https:\/\/anisgupta01\.github\.io\/kirana-smart\/[^"]*"/.test(html), page + ": canonical URL");
  ok(/property="og:title"/.test(html) && /property="og:image" content="https:/.test(html), page + ": Open Graph title + image");
  ok(/application\/ld\+json/.test(html), page + ": structured data (JSON-LD)");
  ok(/class="btn btn-whatsapp[^"]*"[^>]*data-wa=/.test(html), page + ": has a WhatsApp demo button");
  ok(/<h1[\s>]/.test(html) && (html.match(/<h1[\s>]/g) || []).length === 1, page + ": exactly one h1");
});
{
  const cityText = ["lucknow", "kanpur", "varanasi"].map((c) => read("shop-website-" + c + ".html").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  ok(cityText[0] !== cityText[1] && cityText[1] !== cityText[2], "city pages have different copy");
  ok(/Aminabad/.test(cityText[0]) && /Swaroop Nagar/.test(cityText[1]) && /Godowlia/.test(cityText[2]), "city pages mention local areas");
}
["store/admin.html"].forEach((p) => ok(/<meta name="robots" content="noindex/.test(read(p)), p + " is noindex"));
ok(/sample/i.test(read("index.html").match(/id="reviews"[\s\S]*?<\/section>/)[0]), "testimonials clearly marked as sample");

/* JavaScript safety */
const jsDir = path.join(root, "assets/js");
fs.readdirSync(jsDir).filter((f) => /\.js$/.test(f)).forEach((f) => {
  const src = fs.readFileSync(path.join(jsDir, f), "utf8");
  ok(!/\beval\s*\(/.test(src), f + ": no eval()");
  ok(!/new Function\s*\(/.test(src), f + ": no new Function()");
  ok(!/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), f + ": no unsafe HTML insertion");
  ok(!/(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{6,}/i.test(src), f + ": no hard-coded secrets");
  ok(!/https?:\/\/(?!wa\.me|www\.instagram|anisgupta01\.github\.io|schema\.org|www\.w3\.org|yourshop|shop\.example)[a-z0-9.-]+\.[a-z]{2,}/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), f + ": no calls to outside services");
});
{
  const v = read("assets/vendor/qrcode-generator/qrcode.js");
  ok(!/\beval\s*\(|new Function\s*\(|document\.write/.test(v), "vendored QR library: no eval / new Function / document.write");
  ok(/MIT/.test(read("assets/vendor/qrcode-generator/LICENSE")), "vendored QR library licence included");
}

/* Cinematic demo + real product photos */
{
  const w = { window: {} }; w.window = w; vm.createContext(w); vm.runInContext(read("assets/js/chai-config.js"), w);
  const C = w.KS_CINEMA;
  ok(C && C.products.length === 6, "chai-config.js: 6 products");
  ok(/^91[6-9]\d{9}$/.test(C.whatsappNumber) && C.whatsappNumber === "917266042235", "chai-config.js: shop WhatsApp number is the owner number");
  ok(C.products.every((p) => Number.isInteger(p.price) && p.price > 0 && p.en.name.length === 2 && p.hi.name.length === 2 && p.en.desc && p.hi.desc && /[\u0900-\u097F]/.test(p.hi.desc)), "chai-config.js: every product has a price and English + Hindi name/description");
  ok(Object.keys(C.text.en).every((k) => C.text.hi[k] !== undefined) && Object.keys(C.text.hi).every((k) => C.text.en[k] !== undefined), "chai-config.js: English and Hindi texts have the same keys");
  const imgDir = "assets/images/chai/";
  const files = new Set(["hero-burst.webp", "grain.webp"]);
  C.products.forEach((p) => { files.add(p.image); p.pieces.forEach((n) => files.add("ing-" + n + ".webp")); });
  const missing = [...files].filter((f) => !exists(imgDir + f));
  ok(missing.length === 0, "cinematic demo: all " + files.size + " photos and cut-outs exist" + (missing.length ? " -> " + missing.join(", ") : ""));
  const big = fs.readdirSync(path.join(root, imgDir)).concat(fs.readdirSync(path.join(root, "assets/images/products")).map((f) => "../products/" + f))
    .filter((f) => fs.statSync(path.join(root, imgDir, f)).size > 150 * 1024);
  ok(big.length === 0, "every product photo / cut-out is 150 KB or less" + (big.length ? " -> " + big.join(", ") : ""));
  ok(fs.readdirSync(path.join(root, imgDir)).every((f) => /\.webp$/.test(f)) && fs.readdirSync(path.join(root, "assets/images/products")).every((f) => /\.webp$/.test(f)), "product photos are WebP");
  ["kirana", "mithai", "bakery", "cloud-kitchen"].forEach((id) => {
    const shop = JSON.parse(read("store/shops/" + id + ".json"));
    const noPhoto = shop.products.filter((p) => !p.image || !exists(p.image));
    ok(noPhoto.length === 0, id + ": every product has a real photo" + (noPhoto.length ? " -> missing " + noPhoto.map((p) => p.id).join(",") : ""));
    ok(/\.webp$/.test(shop.heroImage) && exists(shop.heroImage), id + ": hero is a real photo");
  });
  const css = read("assets/css/cinema.css");
  ok(/prefers-reduced-motion/.test(css) && /\.reduce \.scene/.test(css), "cinema.css has a reduced-motion fallback");
  ok(!/@import|url\(["']?https?:/.test(css + read("assets/css/site.css")), "fonts are self-hosted (no font CDN)");
  const demo = read("demo/chai/index.html");
  ok(/<meta name="robots" content="noindex/.test(demo), "demo/chai is noindex (demo shop)");
  ok(!/(?<![\dX])[6-9]\d{9}(?!\d)/.test(demo), "demo/chai: no phone number hard-coded in the page (comes from the config)");
}

/* Placeholders the owner must fill in */
ok(/ownerWhatsApp:\s*"91[6-9]\d{9}"/.test(read("assets/js/site-config.js")), "site-config.js has a valid owner WhatsApp number");
ok(/TODO\(owner\)/.test(read("assets/js/site-config.js")), "site-config.js has a TODO for the owner");
["kirana", "mithai", "bakery", "cloud-kitchen"].forEach((s) => ok(JSON.parse(read("store/shops/" + s + ".json")).whatsappNumber.match(/^91[6-9]\d{9}$/) !== null, s + ".json has a valid WhatsApp number"));
ok(!/(?<![\dX])[6-9]\d{9}(?!\d)/.test(["index.html"].map(read).join("\n")), "no phone numbers hard-coded in index.html");

/* Translations: every data-i18n key used on a page exists, and English text in HTML matches the dictionary */
function loadDict(file, name) { const w = { window: {} }; w.window = w; vm.createContext(w); vm.runInContext(read(file), w); return w[name]; }
const SITE = loadDict("assets/js/site-i18n.js", "KS_SITE_I18N");
const STORE = loadDict("assets/js/i18n.js", "KS_I18N");
const norm = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/&larr;/g, "←").replace(/&minus;/g, "−").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
[["index.html", SITE], ["shop-website-lucknow.html", SITE], ["shop-website-kanpur.html", SITE], ["shop-website-varanasi.html", SITE], ["qr-poster.html", SITE],
 ["store/index.html", STORE], ["store/admin.html", STORE], ["udhaar.html", STORE]].forEach(([page, dict]) => {
  const html = read(page);
  const keys = []; html.replace(/data-i18n(?:-aria|-placeholder)?="([^"]+)"/g, (m, k) => { keys.push(k); return m; });
  const missing = keys.filter((k) => dict.en[k] === undefined || dict.hi[k] === undefined);
  ok(missing.length === 0, page + ": all " + keys.length + " text keys exist in English and Hindi" + (missing.length ? " -> " + missing.join(", ") : ""));
  if (dict === SITE) {
    const drift = [];
    html.replace(/<(\w+)[^>]*\sdata-i18n="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g, (m, tag, k, inner) => { if (SITE.en[k] !== undefined && norm(inner) !== SITE.en[k]) drift.push(k); return m; });
    ok(drift.length === 0, page + ": English text in HTML matches site-i18n.js" + (drift.length ? " -> " + drift.join(", ") : ""));
  }
});

/* PWA */
let manifest = null;
try { manifest = JSON.parse(read("manifest.webmanifest")); ok(true, "manifest is valid JSON"); } catch (e) { ok(false, "manifest is valid JSON"); }
if (manifest) {
  ok(manifest.name && manifest.short_name && manifest.start_url && manifest.display === "standalone", "manifest: name, start_url, standalone");
  ok(manifest.icons.some((i) => i.sizes === "192x192") && manifest.icons.some((i) => i.sizes === "512x512") && manifest.icons.some((i) => i.purpose === "maskable"), "manifest: 192, 512 and maskable icons");
  ok(manifest.icons.every((i) => exists(i.src)), "manifest: icon files exist");
}
{
  const sw = read("sw.js");
  const list = []; sw.replace(/"\.\/([^"]*)"/g, (m, u) => { list.push(u || "index.html"); return m; });
  const missing = list.filter((u) => !exists(u));
  ok(list.length > 30 && missing.length === 0, "sw.js: all " + list.length + " pre-cached files exist" + (missing.length ? " -> " + missing.join(", ") : ""));
}

/* sitemap + robots */
{
  const sm = read("sitemap.xml");
  ok(/^<\?xml version="1.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm) && /<\/urlset>\s*$/.test(sm), "sitemap.xml is a urlset");
  const locs = []; sm.replace(/<loc>([^<]+)<\/loc>/g, (m, l) => { locs.push(l); return m; });
  const bad = locs.filter((l) => { const p = l.replace("https://anisgupta01.github.io/kirana-smart/", "").split("?")[0] || "index.html"; return !exists(p) || /&(?!amp;)/.test(l); });
  ok(locs.length >= 10 && bad.length === 0, "sitemap: " + locs.length + " URLs, all point to real pages" + (bad.length ? " -> " + bad.join(", ") : ""));
  ok(/Sitemap: https:\/\/anisgupta01\.github\.io\/kirana-smart\/sitemap\.xml/.test(read("robots.txt")), "robots.txt points to the sitemap");
}
try { JSON.parse(read("vercel.json")); ok(true, "vercel.json is valid JSON"); } catch (e) { ok(false, "vercel.json is valid JSON"); }
ok(!/"DENY"/.test(read("vercel.json")), "vercel.json allows same-origin framing (landing preview)");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
