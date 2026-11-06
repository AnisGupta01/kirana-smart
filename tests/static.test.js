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
  "privacy.html", "terms.html", "refund.html", "about.html", "contact.html", "faq.html", "onboarding.html", "docs/ARCHITECTURE.md", "docs/AUDIT.md", "store/shops/shops.json", "assets/css/print-a6.css", "sitemap.xml", "robots.txt", "manifest.webmanifest", "sw.js",
  "vercel.json", "_headers", "404.html", "README.md", "DEPLOYMENT.md", "TESTING.md", "docs/NEW-SHOP.md", ".gitignore",
  "store/shops/kirana.json", "store/shops/mithai.json", "store/shops/bakery.json", "store/shops/cloud-kitchen.json",
  "assets/css/style.css", "assets/css/site.css", "assets/css/tools.css",
  "assets/js/shop-loader.js", "assets/js/i18n.js", "assets/js/common.js", "assets/js/cart.js", "assets/js/app.js", "assets/js/admin.js",
  "assets/js/site-config.js", "assets/js/site-i18n.js", "assets/js/site.js", "assets/js/pwa.js",
  "assets/js/udhaar-core.js", "assets/js/udhaar.js", "assets/js/qr-poster.js",
  "assets/vendor/qrcode-generator/qrcode.js", "assets/vendor/qrcode-generator/LICENSE",
  "assets/images/logo.svg", "assets/images/placeholder.svg", "assets/images/og-image.png",
  "assets/images/icon-192.png", "assets/images/icon-512.png", "assets/images/icon-maskable-512.png", "assets/images/icon-180.png",
  "demo/chai/index.html", "assets/css/cinema.css", "assets/js/cinema.js", "assets/js/cinema-boot.js", "assets/js/chai-config.js",
  "assets/fonts/cormorant.woff2", "assets/fonts/cormorant-italic.woff2", "assets/fonts/inter.woff2", "assets/fonts/tiro-deva.woff2", "assets/fonts/tiro-deva-italic.woff2", "assets/fonts/LICENSE.md",
  "assets/fonts/baloo2-bold-latin.woff2", "assets/fonts/baloo2-bold-deva.woff2", "assets/fonts/baloo2-bold-label.woff2", "assets/fonts/inter-latin.woff2", "assets/js/site-i18n-hi.js", "tools/version-assets.js"];
required.forEach((f) => ok(exists(f) && fs.statSync(path.join(root, f)).size > 0, "exists and non-empty: " + f));
ok(!exists("admin.html") && !exists("assets/js/config.js") && !exists("assets/js/products.js"), "old root store files moved/removed (store now in store/, data in store/shops/)");

/* a local link resolves to a file, a folder with index.html, or (short Cloudflare/GitHub Pages URL) "<name>.html" */
function resolvesLocal(p) { return exists(p) || (!path.extname(p) && exists(p + ".html")); }

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
  const missingRefs = refs.filter((u) => !resolvesLocal(path.join(dir, u)));
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
  ok(/<link rel="canonical" href="https:\/\/kiranayap\.pages\.dev\/[^"]*"/.test(html), page + ": canonical URL");
  ok(/property="og:title"/.test(html) && /property="og:image" content="https:/.test(html), page + ": Open Graph title + image");
  ok(/application\/ld\+json/.test(html), page + ": structured data (JSON-LD)");
  ok(/class="[^"]*\bbtn-whatsapp\b[^"]*"[^>]*data-wa=/.test(html), page + ": has a WhatsApp demo button");
  ok(/<h1[\s>]/.test(html) && (html.match(/<h1[\s>]/g) || []).length === 1, page + ": exactly one h1");
});
{
  const cityText = ["lucknow", "kanpur", "varanasi"].map((c) => read("shop-website-" + c + ".html").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  ok(cityText[0] !== cityText[1] && cityText[1] !== cityText[2], "city pages have different copy");
  ok(/Aminabad/.test(cityText[0]) && /Swaroop Nagar/.test(cityText[1]) && /Godowlia/.test(cityText[2]), "city pages mention local areas");
}
["store/admin.html"].forEach((p) => ok(/<meta name="robots" content="noindex/.test(read(p)), p + " is noindex"));

/* JavaScript safety */
const jsDir = path.join(root, "assets/js");
fs.readdirSync(jsDir).filter((f) => /\.js$/.test(f)).forEach((f) => {
  const src = fs.readFileSync(path.join(jsDir, f), "utf8");
  ok(!/\beval\s*\(/.test(src), f + ": no eval()");
  ok(!/new Function\s*\(/.test(src), f + ": no new Function()");
  ok(!/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), f + ": no unsafe HTML insertion");
  ok(!/(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{6,}/i.test(src), f + ": no hard-coded secrets");
  ok(!/https?:\/\/(?!wa\.me|www\.instagram|kiranayap\.pages\.dev|schema\.org|www\.w3\.org|yourshop|shop\.example)[a-z0-9.-]+\.[a-z]{2,}/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), f + ": no calls to outside services");
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
function loadDict(file, name, extra) { const w = { window: {} }; w.window = w; vm.createContext(w); vm.runInContext(read(file), w); if (extra) vm.runInContext(read(extra), w); return w[name]; }
const SITE = loadDict("assets/js/site-i18n.js", "KS_SITE_I18N", "assets/js/site-i18n-hi.js");
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
  const list = []; sw.replace(/"\.\/([^"?]*)(?:\?v=[0-9a-f]+)?"/g, (m, u) => { list.push(u || "index.html"); return m; });
  const missing = list.filter((u) => !exists(u));
  ok(list.length > 30 && missing.length === 0, "sw.js: all " + list.length + " pre-cached files exist" + (missing.length ? " -> " + missing.join(", ") : ""));
}

/* sitemap + robots */
{
  const sm = read("sitemap.xml");
  ok(/^<\?xml version="1.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sm) && /<\/urlset>\s*$/.test(sm), "sitemap.xml is a urlset");
  const locs = []; sm.replace(/<loc>([^<]+)<\/loc>/g, (m, l) => { locs.push(l); return m; });
  const bad = locs.filter((l) => { const p = l.replace("https://kiranayap.pages.dev/", "").split("?")[0] || "index.html"; return !resolvesLocal(p) || /&(?!amp;)/.test(l); });
  ok(locs.length >= 10 && bad.length === 0, "sitemap: " + locs.length + " URLs, all point to real pages" + (bad.length ? " -> " + bad.join(", ") : ""));
  ok(/Sitemap: https:\/\/kiranayap\.pages\.dev\/sitemap\.xml/.test(read("robots.txt")), "robots.txt points to the sitemap");
}

/* ---------------- pro upgrade: honesty, trust, contact ---------------- */
console.log("Trust pages, honesty, contact details");
{
  const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html")).concat(["store/index.html", "store/admin.html", "demo/chai/index.html"]);
  const fake = pages.filter((f) => /testimonial|★|⭐|happy customers|trusted by \d|\d+\+ (shops|happy)|client logos?:/i.test(read(f).replace(/No reviews, ratings or client logos[^<]*/g, "").replace(/no testimonials[^<.]*/gi, "").replace(/will not see testimonials[^<]*/gi, "")));
  ok(fake.length === 0, "no testimonials, star ratings, fake stats or logo walls in any page" + (fake.length ? " -> " + fake.join(",") : ""));
  ["about.html", "contact.html", "faq.html", "onboarding.html", "privacy.html", "terms.html", "refund.html"].forEach((f) => ok(/anishgupt43@gmail\.com/.test(read(f)) && /href="contact"/.test(read(f)), f + ": shows the support email and links to Contact"));
  ok(/\+91 72660 42235/.test(read("contact.html")) && /https:\/\/wa\.me\/917266042235/.test(read("contact.html")), "contact.html shows the WhatsApp number (works without JavaScript too)");
  ok(/contactEmail: "anishgupt43@gmail\.com"/.test(read("assets/js/site-config.js")), "support email set once in site-config.js");
  ok(read("index.html").indexOf("Apni Dukaan Ko Digital Banao.") >= 0 && read("index.html").indexOf("Orders WhatsApp Par Pao.") >= 0, "landing HTML carries the exact headline (no-JS / SEO)");
  ["kirana", "mithai", "bakery", "cloud-kitchen"].forEach((id) => ok(JSON.parse(read("store/shops/" + id + ".json")).demo === true && /\(Demo\)/.test(JSON.parse(read("store/shops/" + id + ".json")).storeName), id + " demo shop is flagged demo and named '(Demo)'"));
  ok(/local demo/i.test(read("store/admin.html")) && /exportShopBtn/.test(read("store/admin.html")), "setup tool is labelled local demo and has a working export button");
  ok(/Needs a backend/.test(read("docs/ARCHITECTURE.md")) || /needs a backend/i.test(read("docs/ARCHITECTURE.md")), "ARCHITECTURE.md documents what needs a backend");
  ok(/var CACHE = "ks-shell-v6-[0-9a-f]{8}"/.test(read("sw.js")), "service worker cache version bumped (ks-shell-v6-<hash>)");
  const htmlFiles = pages;
  /* 404.html is the one exception: the host serves it for any missing address, at any depth */
  const rootAbs = htmlFiles.filter((f) => f !== "404.html" && /\s(href|src)="\/(?!\/)/.test(read(f)));
  ok(rootAbs.length === 0, "no root-absolute href/src (relative links work at kiranayap.pages.dev/ and under any sub-path)" + (rootAbs.length ? " -> " + rootAbs.join(",") : ""));
  const imgsNoSize = htmlFiles.filter((f) => /<img(?![^>]*\bwidth=)[^>]*>/.test(read(f)));
  ok(imgsNoSize.length === 0, "every <img> in HTML has width/height (no layout shift)" + (imgsNoSize.length ? " -> " + imgsNoSize.join(",") : ""));
  const imgsNoAlt = htmlFiles.filter((f) => /<img(?![^>]*\balt=)[^>]*>/.test(read(f)));
  ok(imgsNoAlt.length === 0, "every <img> has an alt attribute" + (imgsNoAlt.length ? " -> " + imgsNoAlt.join(",") : ""));
  const big = []; (function walk(d) { fs.readdirSync(path.join(root, d)).forEach((f) => { const p = path.join(d, f); const st = fs.statSync(path.join(root, p)); if (st.isDirectory()) walk(p); else if (/\.(webp|png|jpe?g)$/i.test(f) && st.size > 150 * 1024) big.push(p + " " + Math.round(st.size / 1024) + "KB"); }); })("assets/images");
  ok(big.length === 0, "no image over 150 KB" + (big.length ? " -> " + big.join(",") : ""));
}

/* ---------------- Phase 1: static per-shop preview pages (H2) ---------------- */
console.log("Per-shop static pages (store/<id>/index.html)");
{
  const build = require(path.join(root, "tools/build-shop-pages.js"));
  const res = build.main(true);
  const reg = JSON.parse(read("store/shops/shops.json")).shops.map((x) => x.id);
  const jsonFiles = fs.readdirSync(path.join(root, "store/shops")).filter((f) => f.endsWith(".json") && f !== "shops.json").map((f) => f.replace(/\.json$/, ""));
  ok(jsonFiles.every((id) => reg.indexOf(id) >= 0), "every store/shops/<id>.json is listed in shops.json");
  Object.keys(res.pages).forEach((f) => {
    ok(exists(f) && read(f) === res.pages[f], f + " is up to date (run: node tools/build-shop-pages.js)");
  });
  ok(res.sitemapOk, "sitemap.xml lists exactly the registered shops as store/<id>/");
  ok(!/store\/index\.html\?shop=/.test(read("sitemap.xml")), "sitemap no longer lists ?shop= duplicates");
  reg.forEach((id) => {
    const f = "store/" + id + "/index.html";
    const html = read(f);
    const shop = JSON.parse(read("store/shops/" + id + ".json"));
    const url = build.SITE + "store/" + id + "/";
    const attr = (re) => { const m = re.exec(html); return m ? m[1] : ""; };
    ok(attr(/<link rel="canonical" href="([^"]+)"/) === url && attr(/<meta property="og:url" content="([^"]+)"/) === url, f + ": canonical + og:url = " + url);
    const title = attr(/<title[^>]*>([^<]+)<\/title>/);
    ok(title.indexOf(shop.storeName.replace(/ \(Demo\)$/, "")) >= 0 && attr(/<meta property="og:title" content="([^"]+)"/) === title, f + ": <title> and og:title name the shop (" + title + ")");
    const desc = attr(/<meta property="og:description" content="([^"]+)"/);
    ok(desc.length >= 60 && desc === attr(/<meta name="description" content="([^"]+)"/), f + ": og:description = meta description, shop-specific");
    ok(shop.demo === false ? !/demo|sample/i.test(title + desc) : /demo/i.test(desc), f + ": preview text is honest about demo status");
    const img = attr(/<meta property="og:image" content="([^"]+)"/);
    ok(img === build.SITE + "assets/images/og/" + id + ".jpg" && exists("assets/images/og/" + id + ".jpg"), f + ": og:image is the shop's own preview image (JPEG, exists)");
    ok(new RegExp('data-shop="' + id + '"').test(html) && /data-base="\.\.\/\.\.\/"/.test(html), f + ": presets the shop and the asset base");
    const refs = []; html.replace(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g, (m, u) => { if (!/^(https?:|mailto:|data:|tel:)/.test(u)) refs.push(u); return m; });
    const miss = refs.filter((u) => !resolvesLocal(path.join("store/" + id, u)));
    ok(miss.length === 0, f + ": all " + refs.length + " local links resolve" + (miss.length ? " -> " + miss.join(",") : ""));
  });
  {
    const live = Object.assign(JSON.parse(read("store/shops/mithai.json")), { id: "gupta-sweets", demo: false, storeName: "Gupta Sweets", storeLocation: "Aminabad, Lucknow" });
    const html = build.buildPage(read("store/index.html"), live);
    const head = html.slice(0, html.indexOf("</head>"));
    ok(/class="is-live-shop"/.test(html) && !/\b(demo|sample)\b/i.test(head.replace(/data-demo-only/g, "")), "a live shop's generated page: no demo wording in <head>, demo blocks hidden from first paint");
    ok(/<title[^>]*>Gupta Sweets - order on WhatsApp<\/title>/.test(html) && /Order from Gupta Sweets, Aminabad, Lucknow on WhatsApp/.test(head), "a live shop's generated page: title + description from its JSON");
  }
  ok(/data-shop/.test(read("assets/js/shop-loader.js")) && /data-shops-base/.test(read("assets/js/shop-loader.js")), "shop-loader reads the static page's preset shop");
  ok(/build-shop-pages/.test(read("README.md")) && /build-shop-pages/.test(read("docs/NEW-SHOP.md")), "README and NEW-SHOP document the page generator");
}

/* ---------------- Phase 1: one promise set everywhere (H3/M2) ---------------- */
console.log("One go-live promise and one stock-update phrase everywhere");
{
  const EN_STOCK = "Stock/price changes WhatsApp par bhejiye — 24 ghante ke andar update (Mon–Sat)";
  const HI_STOCK = "स्टॉक/दाम के बदलाव WhatsApp पर भेजिए — 24 घंटे के अंदर अपडेट (सोम–शनि)";
  const site = fs.readdirSync(root).filter((f) => f.endsWith(".html")).concat(["store/index.html", "demo/chai/index.html", "assets/js/site-i18n.js", "assets/js/i18n.js", "assets/js/chai-config.js", "tools/og/og-image.html", "README.md", "docs/NEW-SHOP.md"]);
  const bad = site.filter((f) => /\b(live|website)[^.]{0,20}\b(in|within) (1|one) (working )?day\b|\b1 din\b|1 दिन में|\b3 working days\b|3 कामकाजी|we update (it|the file)|हम बदल देंगे|हम अपडेट कर देंगे/i.test(read(f)));
  ok(bad.length === 0, "no conflicting go-live / update promises (1 day, 3 working days, 'we update it')" + (bad.length ? " -> " + bad.join(",") : ""));
  ["index.html", "faq.html", "terms.html", "refund.html"].forEach((f) => ok(read(f).indexOf(EN_STOCK) >= 0, f + ": exact stock-update phrase"));
  ["faq.html", "terms.html", "refund.html", "onboarding.html"].forEach((f) => ok(read(f).indexOf(HI_STOCK) >= 0, f + ": exact Devanagari stock-update phrase"));
  const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(read("assets/js/site-i18n.js"), sandbox); vm.runInContext(read("assets/js/site-i18n-hi.js"), sandbox);
  const D = sandbox.window.KS_SITE_I18N || sandbox.window.KS_I18N_SITE || null;
  const dicts = D || (function () { const w = {}; vm.runInNewContext(read("assets/js/site-i18n.js"), { window: w }); return w[Object.keys(w)[0]]; })();
  ok(dicts && dicts.en["l.faq.a8"].indexOf(EN_STOCK) >= 0 && dicts.hi["l.faq.a8"].indexOf(HI_STOCK) >= 0, "site-i18n: landing FAQ answer uses the exact phrase in EN and HI");
  ok(/1–2 working days after we receive your details/.test(dicts.en["l.how.s4d"]) && /डिटेल मिलने के बाद 1–2 कामकाजी दिन/.test(dicts.hi["l.how.s4d"]), "site-i18n: go-live = 1–2 working days after details (EN + HI)");
  ["index.html", "faq.html", "terms.html", "onboarding.html"].forEach((f) => ok(/1–2 working days after we receive your details/.test(read(f)), f + ": go-live promise '1–2 working days after we receive your details'"));
  ok(/within 2 working days of receiving/.test(read("refund.html")) && /1–2 working days after we receive your details/.test(read("refund.html")), "refund.html: refund trigger matches the 1–2 working day promise");
  ok(/1–2 din mein live/.test(read("tools/og/og-image.html")) && /Details milne ke baad 1–2 working din/.test(read("tools/og/og-image.html")), "share image source (tools/og/og-image.html) says 1–2 din after details");
}
try { JSON.parse(read("vercel.json")); ok(true, "vercel.json is valid JSON"); } catch (e) { ok(false, "vercel.json is valid JSON"); }
ok(!/"DENY"/.test(read("vercel.json")), "vercel.json allows same-origin framing (landing preview)");

/* KiranaYap rebrand + Cloudflare Pages (kiranayap.pages.dev root) */
{
  const pub = fs.readdirSync(root).filter((f) => /\.(html|xml|txt|webmanifest)$/.test(f)).concat(["store/index.html", "store/admin.html", "demo/chai/index.html", "assets/js/site-config.js", "assets/js/site-i18n.js", "assets/js/i18n.js", "assets/js/common.js", "assets/js/chai-config.js", "assets/js/qr-poster.js"],
    fs.readdirSync(path.join(root, "store/shops")).map((f) => "store/shops/" + f));
  const oldUrl = pub.filter((f) => /anisgupta01\.github\.io|\/kirana-smart\//.test(read(f)));
  ok(oldUrl.length === 0, "no old github.io / /kirana-smart/ URLs in public files" + (oldUrl.length ? " -> " + oldUrl.join(",") : ""));
  /* the old name may only appear as JSON-LD alternateName (continuity for search engines) */
  const oldName = pub.filter((f) => /kirana ?smart/i.test(read(f).replace(/"alternateName": *(\[[^\]]*\]|"[^"]*")/g, "")));
  ok(oldName.length === 0, "brand is KiranaYap everywhere (old name only in alternateName)" + (oldName.length ? " -> " + oldName.join(",") : ""));
  ok(/"alternateName": *"Kirana Smart"/.test(read("index.html")), "index.html ProfessionalService keeps alternateName 'Kirana Smart'");
  const mf = JSON.parse(read("manifest.webmanifest"));
  ok(/KiranaYap/.test(mf.name) && mf.short_name === "KiranaYap" && mf.start_url.indexOf("/") !== 0 && mf.scope === "./", "manifest: KiranaYap name/short_name, relative start_url and scope");
  const sm = read("sitemap.xml");
  ok((sm.match(/<loc>https:\/\/kiranayap\.pages\.dev\//g) || []).length === (sm.match(/<loc>/g) || []).length && (sm.match(/<lastmod>2026-11-06<\/lastmod>/g) || []).length === (sm.match(/<loc>/g) || []).length, "sitemap: every URL on kiranayap.pages.dev with lastmod 2026-11-06");
  ok(/siteUrl: "https:\/\/kiranayap\.pages\.dev\/"/.test(read("assets/js/site-config.js")), "site-config.js siteUrl is https://kiranayap.pages.dev/");
  const h = read("_headers");
  ["css", "js", "fonts", "vendor"].forEach((d) => ok(new RegExp("^/assets/" + d + "/\\*\\n\\s+Cache-Control: public, max-age=31536000, immutable$", "m").test(h), "_headers: /assets/" + d + "/* immutable for a year (every reference is ?v=versioned)"));
  ok(/^\/assets\/images\/\*\n\s+Cache-Control: public, max-age=86400$/m.test(h) && !/^\/assets\/\*$/m.test(h), "_headers: images (unversioned names) cached 1 day; no overlapping /assets/* rule");
  const stale = require("../tools/version-assets.js").check();
  ok(stale.length === 0, "every CSS/JS/font/vendor reference carries its current ?v=<hash> (run: node tools/version-assets.js)" + (stale.length ? " -> " + stale.slice(0, 6).join("; ") : ""));
  ok(!/\.html<\/loc>/.test(sm) && !/index\.html/.test(sm), "sitemap: short Cloudflare URLs (no .html, no index.html)");
  const longCanon = fs.readdirSync(root).filter((f) => f.endsWith(".html")).concat(["store/index.html"]).filter((f) => /<link rel="canonical" href="[^"]*\.html"|property="og:url" content="[^"]*\.html"/.test(read(f)));
  ok(longCanon.length === 0, "canonical + og:url use short URLs (no .html)" + (longCanon.length ? " -> " + longCanon.join(",") : ""));
  ok(/^\/sw\.js\n\s+Cache-Control: no-cache$/m.test(h) && /^\/manifest\.webmanifest\n\s+Cache-Control: no-cache$/m.test(h) && /^\/\*\.html\n\s+Cache-Control: no-cache$/m.test(h), "_headers: no-cache for pages, sw.js and manifest");
  ok(/X-Content-Type-Options: nosniff/.test(h) && /Referrer-Policy: strict-origin-when-cross-origin/.test(h), "_headers: nosniff + strict-origin-when-cross-origin");
  const nf = read("404.html");
  ok(/KiranaYap/.test(nf) && /href="\/"/.test(nf) && /noindex/.test(nf) && nf.replace(/<!--[\s\S]*?-->/g, "").match(/(?:href|src)="\/[^"]*"/g).every((u) => /^(href|src)="\/(assets\/[^"]+|store\/kirana\/|contact)?"$/.test(u) && resolvesLocal(u.replace(/^(href|src)="\//, "").replace(/"$/, "").split("?")[0] || "index.html")), "404.html: branded, noindex, links home, every root path exists");
}

/* v5: thumbnails, fonts, Hindi split */
{
  const prods = fs.readdirSync(path.join(root, "assets/images/products"));
  const noThumb = prods.filter((f) => !exists("assets/images/thumbs/" + f));
  ok(noThumb.length === 0, "every product photo has a 320 px thumbnail (run: bash tools/make-thumbs.sh)" + (noThumb.length ? " -> " + noThumb.join(",") : ""));
  ok(/KS\.thumbFor = function/.test(read("assets/js/common.js")) && /thumbOf\(/.test(read("assets/js/landing.js")), "store cards and landing grid use thumbnails");
  const big = fs.readdirSync(path.join(root, "assets/images/thumbs")).filter((f) => fs.statSync(path.join(root, "assets/images/thumbs", f)).size > 80 * 1024);
  ok(big.length === 0, "thumbnails are small (<= 80 KB)" + (big.length ? " -> " + big.join(",") : ""));
  const css = read("assets/css/landing.css");
  const faces = css.match(/@font-face\s*{[^}]*}/g) || [];
  ok(faces.length >= 3 && faces.every((f) => /font-display:\s*swap/.test(f) && /unicode-range/.test(f)), "landing fonts: every @font-face uses font-display: swap and a unicode-range subset");
  ok(fs.statSync(path.join(root, "assets/fonts/baloo2-bold-latin.woff2")).size < 30 * 1024 && fs.statSync(path.join(root, "assets/fonts/inter-latin.woff2")).size < 35 * 1024, "subset fonts are small (Baloo Latin < 30 KB, Inter Latin < 35 KB)");
  ok(!/tiro-deva\.woff2|inter\.woff2/.test(css), "landing no longer downloads the 99 KB Tiro or the full Inter font");
  ok(/SIL OPEN FONT LICENSE Version 1\.1/.test(read("assets/fonts/LICENSE.md")) && /Baloo 2/.test(read("assets/fonts/LICENSE.md")), "fonts/LICENSE.md carries the full OFL text and lists Baloo 2");
  ok(!/"hi":\s*{|\bhi: {/.test(read("assets/js/site-i18n.js")) && /\.hi = {/.test(read("assets/js/site-i18n-hi.js")), "site-i18n.js holds English only; Hindi is in site-i18n-hi.js");
  ok(!/initSlides|heroFrame|lx-slide/.test(read("assets/js/landing.js") + read("assets/css/landing.css")), "dead chai slideshow code removed");
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
