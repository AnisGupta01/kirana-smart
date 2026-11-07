/* "Pro" browser tests (Playwright + Chromium) for the upgrade.
   The site is served at the domain root exactly like Cloudflare Pages
   (https://kiranayap.pages.dev/, tests/serve-subpath.js), at 360x800 and
   1280x800. SERVE_BASE=/kirana-smart serves it under a sub-path instead.

   Run all:            node tests/pro.e2e.js
   Run one part:       PRO_PART=pages node tests/pro.e2e.js
   Parts: pages (every page + every link, 404s, overflow, images, console,
   touch targets, SEO tags), demos (4 shops: search, filter, cart maths,
   stock flags, validation, WhatsApp message), qr (QR per shop decodes to
   the shop URL, PNG download, A4 + A6 print), misc (landing CTAs, pricing
   WhatsApp messages, Hindi, contact, setup-tool export, sitemap, no fake
   social proof).
   Needs: playwright (+ Chromium), jsqr. */
"use strict";
const fs = require("fs");
const path = require("path");
const { serve, BASE, ROOT } = require("./serve-subpath.js");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/npm-tools/node_modules/playwright")); }
let jsQR = null;
try { jsQR = require("jsqr"); } catch (e) { /* QR decode checks fail loudly below */ }

const PAGES_DOMAIN = "https://kiranayap.pages.dev/";
const OWNER = "917266042235";
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 1280, height: 800 }];
const PART = process.env.PRO_PART || "all";
const part = (p) => PART === "all" || PART.split(",").indexOf(p) >= 0;

let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (extra ? "  -> " + String(extra).slice(0, 600) : "")); }
}
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const REGISTRY = readJSON("store/shops/shops.json").shops.map((s) => s.id);
const SHOP = (id) => readJSON("store/shops/" + id + ".json");
const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

async function ctxPage(browser, viewport, problems, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport, locale: "en-IN", serviceWorkers: "block", acceptDownloads: true }, opts || {}));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push("pageerror " + page.url() + ": " + e.message));
  page.on("console", (m) => { if (m.type() === "error") problems.push("console " + page.url() + ": " + m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) problems.push("HTTP " + r.status() + " " + r.url()); });
  page.on("requestfailed", (r) => { const u = r.url(); const ft = (r.failure() && r.failure().errorText) || ""; if (!/^(blob:|data:)/.test(u) && !/wa\.me/.test(u) && ft !== "net::ERR_ABORTED") problems.push("requestfailed " + u + " " + (r.failure() && r.failure().errorText)); });
  return { ctx, page };
}

/* scroll through the page so lazy images load, then report broken ones */
async function brokenImages(page) {
  return page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((i) => !i.closest("[hidden]") && getComputedStyle(i).display !== "none");
    imgs.forEach((i) => { i.loading = "eager"; });
    for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 25)); }
    window.scrollTo(0, 0);
    await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); setTimeout(r, 5000); }))));
    return { n: imgs.length, bad: imgs.filter((i) => i.naturalWidth === 0).map((i) => i.currentSrc || i.src) };
  });
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* Visible controls smaller than 44x44 css px (WCAG 2.5.5 / Android guidance).
   Inline text links inside sentences are exempt (WCAG exception). */
async function smallTargets(page) {
  return page.evaluate(() => {
    const sel = "button, select, input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea, [role=tab], .btn, .lx-btn, nav a, .lx-tools a, .lx-addon, .lx-tab, .lx-foot-links a, .lx-link, .lx-cartbar-go";
    const out = [];
    document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || el.closest("[hidden], [aria-hidden=true], .lx-sticky:not(.is-on), .lx-screen, .poster")) return;
      if (r.height < 43.5 || r.width < 43.5) out.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]) + " " + Math.round(r.width) + "x" + Math.round(r.height) + " '" + (el.textContent || el.value || "").trim().slice(0, 24) + "'");
    });
    return out;
  });
}

async function decodeQrSvg(page, selector) {
  const px = await page.evaluate(async (sel) => {
    const svg = document.querySelector(sel);
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 300;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, 300, 300);
    const d = g.getImageData(0, 0, 300, 300).data;
    let s = ""; for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode.apply(null, d.subarray(i, i + 8192));
    return btoa(s);
  }, selector);
  const res = jsQR ? jsQR(Uint8ClampedArray.from(Buffer.from(px, "base64")), 300, 300) : null;
  return res && res.data;
}
async function decodePngFile(page, file) {
  const b64 = fs.readFileSync(file).toString("base64");
  const r = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    const k = 400 / img.naturalWidth;
    c.width = 400; c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = ""; for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode.apply(null, d.subarray(i, i + 8192));
    return { w: img.naturalWidth, h: img.naturalHeight, cw: c.width, ch: c.height, px: btoa(s) };
  }, b64);
  const res = jsQR ? jsQR(Uint8ClampedArray.from(Buffer.from(r.px, "base64")), r.cw, r.ch) : null;
  return { w: r.w, h: r.h, data: res && res.data };
}
function pdfInfo(buf) {
  const s = buf.toString("latin1");
  const pages = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const mb = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(s);
  return { pages, w: mb ? Number(mb[3]) - Number(mb[1]) : 0, h: mb ? Number(mb[4]) - Number(mb[2]) : 0 };
}

(async () => {
  const srv = await serve();
  const origin = "http://127.0.0.1:" + srv.address().port;
  const base = origin + BASE + "/";
  const browser = await chromium.launch(Object.assign({ args: ["--no-sandbox"] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const problems = [];
  try {
    /* ============ PAGES: crawl every page and link ============ */
    if (part("pages")) {
      console.log("Pages and links (served at " + (BASE || "") + "/)");
      const seeds = ["", "resellers.html", "about.html", "contact.html", "faq.html", "onboarding.html", "privacy.html", "terms.html", "refund.html", "udhaar.html", "qr-poster.html",
        "shop-website-lucknow.html", "shop-website-kanpur.html", "shop-website-varanasi.html", "demo/chai/", "store/admin.html"].concat(REGISTRY.map((id) => "store/index.html?shop=" + id)).concat(REGISTRY.map((id) => "store/" + id + "/"));
      const { ctx, page } = await ctxPage(browser, VIEWPORTS[0], problems);
      const linkStatus = {};
      const allPages = new Set(seeds.map((s) => new URL(s, base).href));
      const rootAbsolute = [];
      for (const s of seeds) {
        await page.goto(new URL(s, base).href, { waitUntil: "load" });
        const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href], link[href], script[src], img[src]")).map((a) => [a.tagName, a.getAttribute("href") || a.getAttribute("src")]));
        for (const [tag, raw] of links) {
          if (!raw || /^(https?:|mailto:|tel:|data:|blob:|#|javascript:)/i.test(raw)) continue;
          if (raw.charAt(0) === "/") rootAbsolute.push(s + " -> " + raw);
          const u = new URL(raw, page.url());
          u.hash = "";
          if (tag === "A" && /\.html$|\/$/.test(u.pathname)) allPages.add(u.href);
          linkStatus[u.href] = linkStatus[u.href] || null;
        }
      }
      ok(rootAbsolute.length === 0, "no root-absolute links (the site stays portable to any sub-path)", rootAbsolute.slice(0, 5).join(", "));
      const bad = [];
      for (const u of Object.keys(linkStatus)) {
        const r = await page.request.get(u);
        linkStatus[u] = r.status();
        if (r.status() !== 200) bad.push(r.status() + " " + u.replace(origin, ""));
      }
      ok(bad.length === 0, "every internal link, script, stylesheet and image returns 200 (" + Object.keys(linkStatus).length + " URLs)", bad.join(", "));
      const nf = await page.request.get(base + "this-page-does-not-exist.html");
      ok(nf.status() === 404, "unknown page gives 404 (server check)");
      await ctx.close();

      const pageList = Array.from(allPages).map((u) => u.replace(base, ""));
      console.log("  ... checking " + pageList.length + " pages at 360 and 1280");
      for (const vp of VIEWPORTS) {
        const { ctx: c2, page: p2 } = await ctxPage(browser, vp, problems);
        const over = [], broken = [], small = [], errs0 = problems.length;
        for (const pth of pageList) {
          const resp = await p2.goto(base + pth, { waitUntil: "load" });
          if (!resp || resp.status() !== 200) { broken.push("HTTP " + (resp && resp.status()) + " " + pth); continue; }
          if (pth.indexOf("store/index.html") === 0) await p2.waitForSelector("#productGrid .product-card", { timeout: 8000 });
          await p2.waitForTimeout(150);
          const o = await overflowX(p2);
          if (o > 0) over.push(pth + " +" + o + "px");
          const im = await brokenImages(p2);
          im.bad.forEach((b) => broken.push(pth + ": " + b));
          if (vp.width === 360) (await smallTargets(p2)).forEach((s) => small.push(pth + ": " + s));
        }
        ok(over.length === 0, vp.width + "px: no horizontal scroll on any page", over.join(", "));
        ok(broken.length === 0, vp.width + "px: no broken images (naturalWidth > 0) on any page", broken.slice(0, 8).join(", "));
        if (vp.width === 360) ok(small.length === 0, "360px: every button, field, tab and nav/CTA link is at least 44x44 px", Array.from(new Set(small)).slice(0, 30).join(" | "));
        ok(problems.length === errs0, vp.width + "px: zero console errors / page errors / failed requests across all pages", problems.slice(errs0, errs0 + 4).join(" | "));
        await c2.close();
      }
      /* extra narrow widths on the key pages */
      {
        const { ctx: c3, page: p3 } = await ctxPage(browser, { width: 320, height: 700 }, problems);
        const over = [];
        for (const pth of ["", "store/index.html?shop=kirana", "qr-poster.html", "contact.html", "onboarding.html"]) {
          for (const w of [320, 375, 412]) {
            await p3.setViewportSize({ width: w, height: 760 });
            await p3.goto(base + pth, { waitUntil: "load" });
            await p3.waitForTimeout(120);
            const o = await overflowX(p3);
            if (o > 0) over.push(w + ":" + pth + " +" + o);
          }
        }
        ok(over.length === 0, "no horizontal scroll at 320/375/412 px on landing, store, QR, contact, onboarding", over.join(", "));
        await c3.close();
      }
      /* SEO tags: absolute URLs on the Pages domain */
      {
        const { ctx: c4, page: p4 } = await ctxPage(browser, VIEWPORTS[1], problems);
        const missing = [];
        for (const pth of pageList.filter((p) => !/admin\.html/.test(p))) {
          await p4.goto(base + pth, { waitUntil: "domcontentloaded" });
          const m = await p4.evaluate(() => {
            const q = (s, a) => { const e = document.querySelector(s); return e ? e.getAttribute(a || "content") : ""; };
            return { title: document.title, desc: q('meta[name="description"]'), canon: q('link[rel="canonical"]', "href"), ogt: q('meta[property="og:title"]'), ogi: q('meta[property="og:image"]'), ogu: q('meta[property="og:url"]'), tw: q('meta[name="twitter:card"]'), twt: q('meta[name="twitter:title"]'), lang: document.documentElement.lang };
          });
          const probs = [];
          if (!m.title || m.title.length < 10) probs.push("title");
          if (!m.desc || m.desc.length < 50) probs.push("description");
          if (!m.canon.startsWith(PAGES_DOMAIN)) probs.push("canonical=" + m.canon);
          if (!m.ogt) probs.push("og:title");
          if (!m.ogi.startsWith(PAGES_DOMAIN)) probs.push("og:image");
          if (!m.ogu.startsWith(PAGES_DOMAIN)) probs.push("og:url");
          if (m.tw !== "summary_large_image" || !m.twt) probs.push("twitter");
          if (probs.length) missing.push(pth + " [" + probs.join(",") + "]");
        }
        ok(missing.length === 0, "every public page has title, description, canonical, Open Graph and Twitter tags with absolute " + PAGES_DOMAIN + " URLs", missing.join(" "));
        await p4.goto(base + "store/index.html?shop=bakery");
        await p4.waitForSelector("#productGrid .product-card");
        ok((await p4.getAttribute('link[rel="canonical"]', "href")) === PAGES_DOMAIN + "store/bakery/", "?shop=bakery canonical points at the shop's static page store/bakery/");
        await c4.close();
      }
    }

    /* ============ DEMOS: all 4 shops really work ============ */
    if (part("demos")) {
      console.log("Demo shops (search, filter, cart, stock, checkout, WhatsApp)");
      for (const id of REGISTRY) {
        const shop = SHOP(id);
        const vp = id === "bakery" ? VIEWPORTS[1] : VIEWPORTS[0];
        const { ctx, page } = await ctxPage(browser, vp, problems);
        await page.goto(base + "store/index.html?shop=" + id);
        await page.waitForSelector("#productGrid .product-card", { timeout: 8000 });
        const L = id + " @" + vp.width + ": ";
        const products = shop.products;
        ok((await page.locator("#productGrid .product-card").count()) === products.length, L + "all " + products.length + " products from the JSON are listed");
        ok(/demo/i.test(await page.locator(".demo-banner").first().textContent()) || /sample/i.test(await page.locator(".demo-banner").first().textContent()), L + "labelled as a demo");
        const imgs = await brokenImages(page);
        ok(imgs.bad.length === 0 && imgs.n >= products.length, L + "product images load (" + imgs.n + ")", imgs.bad.join(","));
        const prices = await page.locator("#productGrid .card-price strong").allTextContents();
        ok(prices.length === products.length && prices.every((p) => /^₹[\d,]+(\.\d\d)?$/.test(p)), L + "every card shows a ₹ price");
        /* categories */
        const opts = await page.locator("#catFilter option").evaluateAll((o) => o.map((x) => x.value));
        ok(shop.categories.every((c) => opts.indexOf(c.id) >= 0), L + "category filter lists every category from the JSON");
        const cat = shop.categories.find((c) => products.filter((p) => p.category === c.id).length >= 2) || shop.categories[0];
        await page.selectOption("#catFilter", cat.id);
        const inCat = products.filter((p) => p.category === cat.id).map((p) => p.id).sort();
        const shown = (await page.locator("#productGrid .product-card").evaluateAll((a) => a.map((x) => x.getAttribute("data-product")))).sort();
        ok(JSON.stringify(shown) === JSON.stringify(inCat), L + "filter '" + cat.en + "' shows exactly its " + inCat.length + " products");
        /* search within the filter, then on its own */
        const word = products.find((p) => p.category === cat.id).name.split(/[\s(]+/)[0];
        await page.fill("#searchInput", word.toLowerCase());
        const sids = await page.locator("#productGrid .product-card").evaluateAll((a) => a.map((x) => x.getAttribute("data-product")));
        const sexp = products.filter((p) => p.category === cat.id && (p.name + " " + (p.nameHi || "") + " " + cat.en).toLowerCase().indexOf(word.toLowerCase()) >= 0).map((p) => p.id);
        ok(sids.length >= 1 && JSON.stringify(sids.slice().sort()) === JSON.stringify(sexp.slice().sort()), L + "search + filter combined ('" + word + "' in " + cat.en + ") returns exactly " + sexp.length, sids.join(","));
        await page.click("#clearFilters");
        await page.fill("#searchInput", word.toUpperCase());
        const expect = products.filter((p) => (p.name + " " + (p.nameHi || "") + " " + (shop.categories.find((c) => c.id === p.category) || {}).en).toLowerCase().indexOf(word.toLowerCase()) >= 0).length;
        ok((await page.locator("#productGrid .product-card").count()) === expect, L + "search '" + word.toUpperCase() + "' (case-insensitive) finds " + expect);
        await page.fill("#searchInput", "zzqqxx");
        ok(await page.locator("#noResults").isVisible(), L + "no-results state for nonsense search");
        await page.click("#noResultsClear");
        /* stock flags: out of stock / unavailable products can't be added */
        const off = products.filter((p) => p.available === false || Number(p.stock) <= 0);
        if (off.length) {
          const offOk = await page.evaluate((ids) => ids.every((pid) => { const c = document.querySelector('#productGrid [data-product="' + pid + '"]'); return c && c.classList.contains("is-off") && !c.querySelector(".btn-primary"); }), off.map((p) => p.id));
          ok(offOk, L + off.length + " out-of-stock / unavailable product(s) shown without an Add button");
        } else ok(true, L + "(no out-of-stock product in this JSON)");
        /* cart: 2 products, qty controls */
        const buy = products.filter((p) => p.available !== false && p.stock >= 3).slice(0, 2);
        const [a, b] = buy;
        await page.click('#productGrid [data-product="' + a.id + '"] .btn-primary');
        await page.click('#productGrid [data-product="' + a.id + '"] .step-btn:last-child');
        await page.click('#productGrid [data-product="' + a.id + '"] .step-btn:last-child');
        await page.click('#productGrid [data-product="' + a.id + '"] .step-btn:first-child');
        await page.click('#productGrid [data-product="' + b.id + '"] .btn-primary');
        ok((await page.textContent('#productGrid [data-product="' + a.id + '"] .step-qty')) === "2", L + "+ / − quantity controls (1 → 3 → 2)");
        ok((await page.textContent("#cartCount")) === "3", L + "cart count 3");
        await page.click("#cartBtn");
        await page.waitForSelector("#cartDrawer:not([hidden]) .cart-line");
        const sub = a.price * 2 + b.price;
        const lineTexts = await page.locator(".cart-line .cart-side strong").allTextContents();
        ok(lineTexts[0] === money(a.price * 2) && lineTexts[1] === money(b.price), L + "line totals " + lineTexts.join(" + "));
        ok((await page.textContent("#cartSubtotal")) === money(sub), L + "cart subtotal " + money(sub));
        await page.click("#checkoutBtn");
        const isDelivery = await page.isChecked('input[name="ordertype"][value="delivery"]');
        const fee = isDelivery && shop.deliveryFee > 0 && !(shop.freeDeliveryAbove > 0 && sub >= shop.freeDeliveryAbove) ? shop.deliveryFee : 0;
        ok((await page.textContent("#sumSubtotal")) === money(sub) && (await page.textContent("#sumTotal")) === money(sub + fee), L + "checkout summary subtotal " + money(sub) + " + delivery " + money(fee) + " = " + money(sub + fee));
        /* validation */
        await page.check('input[name="ordertype"][value="delivery"]');
        await page.click("#sendOrderBtn");
        ok(await page.locator("#err-name").isVisible() && await page.locator("#err-address").isVisible() && await page.locator("#err-phone").isHidden(), L + "empty form: name + address required, phone optional");
        await page.fill("#f-name", "Ravi Kumar");
        await page.fill("#f-address", "short");
        await page.fill("#f-phone", "123");
        await page.click("#sendOrderBtn");
        ok(await page.locator("#err-address").isVisible() && await page.locator("#err-phone").isVisible(), L + "too-short address and invalid phone rejected");
        await page.fill("#f-phone", "");
        await page.fill("#f-address", "House 12, Gali 3, Aminabad, Lucknow 226018");
        await page.evaluate(() => { window.__opened = []; KS.openExternal = (u) => window.__opened.push(u); });
        await page.click("#sendOrderBtn");
        const urls = await page.evaluate(() => window.__opened.slice());
        ok(urls.length === 1 && urls[0].startsWith("https://wa.me/" + shop.whatsappNumber + "?text="), L + "opens https://wa.me/" + shop.whatsappNumber + "?text=…");
        const enc = urls[0].split("?text=")[1] || "";
        ok(!/[\s\n#&]/.test(enc) && encodeURIComponent(decodeURIComponent(enc)) === enc, L + "message is fully URL-encoded");
        const msg = decodeURIComponent(enc);
        const total = sub + fee;
        const need = [shop.storeName, a.name + " (" + a.unit + ") x 2 = " + money(a.price * 2), b.name + " (" + b.unit + ") x 1 = " + money(b.price), "Subtotal: " + money(sub), "*Total: " + money(total) + "*", "Name: Ravi Kumar", "Address: House 12, Gali 3, Aminabad, Lucknow 226018"];
        const miss = need.filter((n) => msg.indexOf(n) < 0);
        ok(miss.length === 0, L + "WhatsApp message has items, qty, line totals, total, name, address", "missing: " + miss.join(" | ") + "\n" + msg);
        ok(!/Phone:/.test(msg), L + "no phone line when phone is left empty");
        ok(/demo store/i.test(msg), L + "demo order is marked as a demo in the message");
        /* with phone */
        await page.click("#keepCart");
        await page.click("#checkoutBtn");
        await page.fill("#f-name", "Ravi Kumar");
        await page.fill("#f-address", "House 12, Gali 3, Aminabad, Lucknow 226018");
        await page.fill("#f-phone", "+91 98765 43210");
        await page.click("#sendOrderBtn");
        const msg2 = decodeURIComponent((await page.evaluate(() => window.__opened[1] || "")).split("?text=")[1] || "");
        ok(/Phone: \+91 9876543210/.test(msg2), L + "phone included (normalised) when given");
        await ctx.close();
      }
      /* invalid / unknown shop slug */
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[0], []);
        await page.goto(base + "store/index.html?shop=shops");
        await page.waitForSelector("#appError:not([hidden])", { timeout: 8000 });
        ok(true, "?shop=shops (the registry file) is rejected with a friendly error");
        await ctx.close();
      }
    }

    /* ============ QR ============ */
    if (part("qr")) {
      console.log("QR code, PNG, A4 poster, A6 counter card");
      ok(!!jsQR, "jsqr available for decoding");
      const dl = fs.mkdtempSync(path.join(require("os").tmpdir(), "ksqr-"));
      for (const id of REGISTRY) {
        const shop = SHOP(id);
        const { ctx, page } = await ctxPage(browser, id === "kirana" ? VIEWPORTS[1] : VIEWPORTS[0], problems);
        await page.goto(base + "qr-poster.html?shop=" + id);
        const want = PAGES_DOMAIN + "store/" + id + "/";
        await page.waitForFunction((w) => { const q = document.getElementById("pQr"); return q && q.getAttribute("data-url") === w; }, want, { timeout: 8000 });
        ok((await page.textContent("#pShop")) === shop.storeName, id + ": poster shows the shop name from its JSON");
        ok((await decodeQrSvg(page, "#pQr svg")) === want, id + ": on-screen QR decodes to " + want);
        const pm = await page.evaluate(() => getComputedStyle(document.getElementById("poster")).getPropertyValue("--p-main").trim());
        ok(pm.toLowerCase() === shop.colors.brand.toLowerCase(), id + ": poster uses the shop brand colour " + shop.colors.brand);
        const [download] = await Promise.all([page.waitForEvent("download"), page.click("#qrPng")]);
        const f = path.join(dl, download.suggestedFilename());
        await download.saveAs(f);
        ok(download.suggestedFilename() === id + "-qr.png", id + ": PNG download named " + id + "-qr.png");
        const png = await decodePngFile(page, f);
        ok(png.data === want && png.w >= 1000, id + ": downloaded PNG (" + png.w + "x" + png.h + ") decodes to the shop URL", png.data);
        if (id === "kirana" || id === "mithai") {
          await page.emulateMedia({ media: "print" });
          const a4 = pdfInfo(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
          ok(a4.pages === 1 && Math.abs(a4.w - 595) < 3 && Math.abs(a4.h - 842) < 3, id + ": A4 poster prints as exactly 1 A4 page (" + a4.pages + " page, " + Math.round(a4.w) + "x" + Math.round(a4.h) + "pt)");
          await page.emulateMedia({ media: "screen" });
          await page.check('input[name="qrFormat"][value="a6"]');
          await page.emulateMedia({ media: "print" });
          const a6 = pdfInfo(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
          ok(a6.pages === 1 && Math.abs(a6.w - 298) < 3 && Math.abs(a6.h - 420) < 3, id + ": counter card prints as exactly 1 A6 page (" + a6.pages + " page, " + Math.round(a6.w) + "x" + Math.round(a6.h) + "pt)");
          const fits = await page.evaluate(() => { const p = document.getElementById("poster"); return p.scrollHeight <= p.clientHeight + 1; });
          ok(fits, id + ": counter card content fits (nothing cut off)");
          await page.emulateMedia({ media: "screen" });
          ok((await decodeQrSvg(page, "#pQr svg")) === want, id + ": A6 card QR still decodes to the shop URL");
        }
        await ctx.close();
      }
      /* offline: QR page works with the network cut after load (no network needed to draw) */
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[0], []);
        await page.goto(base + "qr-poster.html?shop=bakery");
        await page.waitForFunction(() => document.getElementById("pShop").textContent.indexOf("Bakery") >= 0);
        await ctx.setOffline(true);
        await page.fill("#qrUrl", "https://example-shop.in/order");
        await page.click("#qrForm button[type=submit]");
        ok((await decodeQrSvg(page, "#pQr svg")) === "https://example-shop.in/order", "QR is generated on the device while offline");
        await ctx.close();
      }
    }

    /* ============ MISC: landing CTAs, pricing, Hindi, contact, setup tool, sitemap ============ */
    if (part("misc")) {
      console.log("Landing CTAs, pricing WhatsApp messages, trust and honesty checks");
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[1], problems);
        await page.goto(base);
        ok((await page.textContent("h1")).replace(/\s+/g, " ").trim() === "Apni Dukaan Ko Digital Banao. Orders WhatsApp Par Pao.", "hero headline exactly as briefed");
        ok((await page.textContent(".lx-sub")).trim() === "Apne customers ko online products dikhao, WhatsApp par orders receive karo aur apne business ko digital banao. Bina commission ke.", "hero subheading exactly as briefed");
        const cta = await page.locator(".lx-hero .lx-ctas a").evaluateAll((a) => a.map((x) => [x.textContent.trim(), x.getAttribute("href")]));
        ok(cta.length === 1 && cta[0][0] === "Free demo WhatsApp par maango" && cta[0][1].startsWith("https://wa.me/" + OWNER + "?text="), "hero: one main button, 'Free demo WhatsApp par maango' → wa.me", JSON.stringify(cta));
        const sub = await page.locator(".lx-hero .lx-cta-sub a").evaluateAll((a) => a.map((x) => [x.textContent.trim(), x.getAttribute("href")]));
        ok(sub.length === 1 && sub[0][0] === "Live demo dekho" && sub[0][1] === "#demos", "hero: 'Live demo dekho' is a small text link under it", JSON.stringify(sub));
        const ids = ["shop", "how", "features", "pricing", "faq", "contact"];
        ok((await page.evaluate((ids) => ids.every((i) => document.getElementById(i)), ids)) && (await page.locator(".lx-phone").count()) === 1, "mobile preview, How it works, Features, Pricing, FAQ and final CTA sections present");
        const plan = async (sel) => decodeURIComponent((await page.getAttribute(sel, "href")).split("?text=")[1]);
        const s = await plan('.price-main [data-wa="starter"]');
        const p = await plan('.price-premium [data-wa="premium"]');
        ok(/^STARTER PLAN\n/.test(s) && s.indexOf("₹999 setup + ₹149/month") >= 0, "Starter button: WhatsApp message names the Starter plan and price", s);
        ok(/^PREMIUM PLAN\n/.test(p) && p.indexOf("₹2,999 setup + ₹199/month") >= 0, "Premium button: WhatsApp message names the Premium plan and price", p);
        ok((await page.getAttribute('.price-main [data-wa="starter"]', "href")).startsWith("https://wa.me/" + OWNER + "?text=") && (await page.getAttribute('.price-premium [data-wa="premium"]', "target")) === "_blank", "plan buttons open wa.me/" + OWNER + " in a new tab");
        const st = await page.textContent(".price-main"), pr = await page.textContent(".price-premium"), rn = await page.textContent(".lx-renew");
        ok(/₹999/.test(st) && /₹149/.test(st) && /60 products/.test(st) && /10 price/.test(st) && /Mon–Sat/.test(st), "Starter card: price, product limit, monthly changes, support hours");
        ok(/₹2,999/.test(pr) && /₹199/.test(pr) && /150 products/.test(pr) && /25 price/.test(pr), "Premium card: price, product limit, monthly changes");
        ok(/No online payment/.test(rn) && /stop anytime/i.test(rn) && /end of the paid month/.test(rn), "renewal terms stated (UPI, no lock-in, offline at end of paid month)");
        ok((await page.locator("form[action], input[type=password], [data-pay], .razorpay, .stripe").count()) === 0, "no payment form on the site");
        const txt = (await page.textContent("body")).toLowerCase();
        ok(!/testimonial|★|⭐|happy customers|trusted by|\d+\+ shops|rated \d/.test(txt) && (await page.locator("#reviews, .reviews, .testimonials, .logos").count()) === 0, "no testimonials, star ratings, fake stats or client logos");
        ok((await page.locator(".lx-dcard .lx-dcard-demo").count()) === 5, "every demo card is labelled DEMO");
        /* starter card has no big empty gap on desktop */
        const gap = await page.evaluate(() => { const c = document.querySelector(".price-main"); const btn = c.querySelector(".lx-btn"); return c.getBoundingClientRect().bottom - btn.getBoundingClientRect().bottom; });
        ok(gap < 60, "Starter card: no extra empty space under its button on desktop (" + Math.round(gap) + "px)");
        await ctx.close();
      }
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[0], problems);
        await page.goto(base);
        await page.click("#langBtn"); await page.waitForFunction(() => !window.KS_SITE_I18N || (!!window.KS_SITE_I18N.hi && document.documentElement.lang === (localStorage.getItem("ks_lang_v1") || "en")));
        ok(/अपनी दुकान को डिजिटल बनाओ/.test(await page.textContent("h1")) && (await page.getAttribute("html", "lang")) === "hi", "Hindi: hero translated, <html lang=hi>");
        ok((await overflowX(page)) <= 0, "Hindi at 360px: no horizontal scroll");
        const fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check("16px 'KS Devanagari'", "अ") || document.fonts.check("16px 'Noto Sans Devanagari'", "अ"); });
        ok(fontOk, "Hindi text has a Devanagari font (bundled fallback when the phone has none)");
        const lh = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".lx-sub")).lineHeight) / parseFloat(getComputedStyle(document.querySelector(".lx-sub")).fontSize));
        ok(lh >= 1.5, "Hindi body line-height ≥ 1.5 for readability (" + lh.toFixed(2) + ")");
        const sp = decodeURIComponent((await page.getAttribute('.price-main [data-wa="starter"]', "href")).split("?text=")[1]);
        ok(/स्टार्टर प्लान/.test(sp), "Hindi: plan WhatsApp message in Hindi");
        await page.click("#langBtn"); await page.waitForFunction(() => !window.KS_SITE_I18N || (!!window.KS_SITE_I18N.hi && document.documentElement.lang === (localStorage.getItem("ks_lang_v1") || "en")));
        await ctx.close();
      }
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[0], problems);
        await page.goto(base + "contact.html");
        ok((await page.textContent("main")).indexOf("+91 72660 42235") >= 0 && (await page.getAttribute('a[href^="mailto:"]', "href")) === "mailto:anishgupt43@gmail.com", "contact page shows WhatsApp +91 72660 42235 and anishgupt43@gmail.com");
        const sup = decodeURIComponent((await page.getAttribute('main [data-wa="support"]', "href")).split("?text=")[1]);
        ok((await page.getAttribute('main [data-wa="support"]', "href")).startsWith("https://wa.me/" + OWNER) && /^HELP\n/.test(sup), "contact WhatsApp button opens the owner chat with a help message");
        ok(/Monday to Saturday/.test(await page.textContent("main")), "support hours stated");
        for (const [pg, re] of [["about.html", /Anish Gupta/], ["faq.html", /Needs a backend/], ["onboarding.html", /Go live/], ["terms.html", /no online payments, no order database/]]) {
          await page.goto(base + pg);
          ok(re.test(await page.textContent("main")), pg + " has its key content (" + re + ")");
        }
        await ctx.close();
      }
      /* setup tool: honest label + JSON export that reflects edits */
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[1], problems);
        await page.goto(base + "store/admin.html?shop=mithai");
        await page.waitForSelector("#adminApp");
        ok(/local demo/i.test(await page.textContent("header")) && /do NOT reach customers/.test(await page.textContent(".demo-banner")), "setup tool is labelled 'local demo' and says changes don't reach customers");
        await page.evaluate(() => { const list = KS.getProducts(); list[0].price = 999; list[0].stock = 0; KS.saveProducts(list); });
        await page.click("#tab-settings");
        const [d] = await Promise.all([page.waitForEvent("download"), page.click("#exportShopBtn")]);
        ok(d.suggestedFilename() === "mithai.json", "export downloads mithai.json");
        const fp = await d.path();
        const j = JSON.parse(fs.readFileSync(fp, "utf8"));
        const orig = SHOP("mithai");
        ok(j.id === "mithai" && j.products.length === orig.products.length && j.products[0].price === 999 && j.products[0].stock === 0, "exported JSON contains the edited price and stock");
        ok(j.categories.length === orig.categories.length && j.colors.brand === orig.colors.brand && j.storeName === orig.storeName, "exported JSON keeps categories, colours and branding");
        await ctx.close();
      }
      /* sitemap + robots */
      {
        const { ctx, page } = await ctxPage(browser, VIEWPORTS[0], []);
        const xml = await (await page.request.get(base + "sitemap.xml")).text();
        const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1].replace(/&amp;/g, "&"));
        const bad = [];
        for (const l of locs) { const r = await page.request.get(l.replace(PAGES_DOMAIN, base)); if (r.status() !== 200) bad.push(r.status() + " " + l); }
        ok(locs.length >= 13 && locs.every((l) => l.indexOf(PAGES_DOMAIN) === 0) && bad.length === 0, "sitemap: " + locs.length + " URLs, all on the Pages domain and all 200 locally", bad.join(", "));
        ok(["about", "contact", "faq", "onboarding"].every((p) => locs.indexOf(PAGES_DOMAIN + p) >= 0), "sitemap lists the trust pages (short URLs)");
        const robots = await (await page.request.get(base + "robots.txt")).text();
        ok(/Sitemap: https:\/\/kiranayap\.pages\.dev\/sitemap\.xml/.test(robots), "robots.txt points at the sitemap");
        const sw = await (await page.request.get(base + "sw.js")).text();
        ok(/ks-shell-v7-[0-9a-f]{8}/.test(sw) && /about\.html/.test(sw) && /shops\.json/.test(sw) && !/images\/products\//.test(sw), "service worker cache bumped to ks-shell-v7-<hash>, pre-caches pages, no product photos");
        await ctx.close();
      }
    }
  } catch (err) {
    failed++;
    console.log("  FAIL  test run crashed: " + (err && err.stack ? err.stack : err));
  } finally {
    await browser.close();
    srv.close();
  }
  console.log("Runtime problems seen by the browser");
  ok(problems.length === 0, "no console errors, page errors, failed requests or HTTP errors", problems.slice(0, 6).join(" | "));
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
