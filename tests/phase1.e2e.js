/* Phase 1 browser tests (Playwright + Chromium), served at the site root (SERVE_BASE)
   like GitHub Pages (tests/serve-subpath.js).

   Run all:        node tests/phase1.e2e.js
   Run one part:   P1_PART=fresh node tests/phase1.e2e.js
   Parts:
     fresh    C1: a returning visitor gets the shop JSON's current price/stock
              (Rs 560 -> Rs 671, then out of stock), cart flags the changes
     live     H1: a demo:false shop shows no demo/setup-tool/sample wording
     preview  H2: static per-shop pages carry the shop's own title, OG tags
              and canonical in the HTML; ?shop= keeps working
     promises H3/M2: one go-live promise and one stock-update phrase everywhere
     landing  M1/M4/M7/M5: one main CTA, plain kirana hero, FAQ additions
     upi      UPI line in the order message, Hindi order message
     misc     404 page, WhatsApp button contrast, 360px header, QR ?url= limit
   Needs: playwright (+ Chromium). */
"use strict";
const fs = require("fs");
const path = require("path");
const { serve, BASE, ROOT } = require("./serve-subpath.js");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/npm-tools/node_modules/playwright")); }

const PART = process.env.P1_PART || "all";
const part = (p) => PART === "all" || PART.split(",").indexOf(p) >= 0;
let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (extra ? "  -> " + String(extra).slice(0, 600) : "")); }
}
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const SHOP = (id) => readJSON("store/shops/" + id + ".json");

async function ctxPage(browser, viewport, problems, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: viewport || { width: 360, height: 800 }, locale: "en-IN", serviceWorkers: "block" }, opts || {}));
  const page = await ctx.newPage();
  if (problems) {
    page.on("pageerror", (e) => problems.push("pageerror " + page.url() + ": " + e.message));
    page.on("console", (m) => { if (m.type() === "error") problems.push("console " + page.url() + ": " + m.text()); });
  }
  return { ctx, page };
}

/* Serve a modified copy of a shop JSON to the page (the "owner changed it" case) */
async function routeShop(ctx, id, mutate) {
  await ctx.unroute("**/store/shops/" + id + ".json");
  if (!mutate) return;
  const shop = SHOP(id);
  mutate(shop);
  await ctx.route("**/store/shops/" + id + ".json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shop) }));
}

(async () => {
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port + BASE + "/";
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const problems = [];
  try {
    /* ============ C1: stale cache ============ */
    if (part("fresh")) {
      console.log("C1: returning visitor sees current price and stock");
      const kaju = SHOP("mithai").products.find((p) => /kaju katli/i.test(p.name));
      const { ctx, page } = await ctxPage(browser, null, problems);
      await ctx.addInitScript(() => {
        const f = window.fetch;
        window.__fetchModes = [];
        window.fetch = function (u, o) { if (/shops\/[a-z0-9-]+\.json/.test(String(u))) window.__fetchModes.push((o && o.cache) || "default"); return f.apply(this, arguments); };
      });
      const url = base + "store/index.html?shop=mithai";
      await page.goto(url);
      await page.waitForSelector("#productGrid .product-card");
      const card = '#productGrid [data-product="' + kaju.id + '"]';
      ok((await page.textContent(card + " .card-price strong")) === "₹560", "visit 1: Kaju Katli shows ₹560");
      await page.click(card + " .btn-primary");
      ok((await page.textContent("#cartCount")) === "1", "visit 1: Kaju Katli in cart");

      /* the owner changes the price; the JSON is fetched network-first */
      await routeShop(ctx, "mithai", (s) => { const p = s.products.find((x) => x.id === kaju.id); p.price = 671; p.mrp = null; });
      await page.goto(url);
      await page.waitForSelector("#productGrid .product-card");
      const modes = await page.evaluate(() => window.__fetchModes || []);
      ok(modes.length >= 1 && modes[0] === "no-cache", "shop JSON fetched network-first (cache: no-cache)", JSON.stringify(modes));
      ok((await page.textContent(card + " .card-price strong")) === "₹671", "visit 2: returning visitor sees ₹671 (not the stored ₹560)");
      await page.click("#cartBtn");
      await page.waitForSelector("#cartDrawer:not([hidden])");
      const note = await page.locator("#cartChanges").textContent().catch(() => "");
      ok(/₹560/.test(note) && /₹671/.test(note), "visit 2: cart flags the price change ₹560 → ₹671", note);
      ok((await page.textContent("#cartSubtotal")) === "₹671", "visit 2: cart subtotal ₹671");
      await page.click("#cartChangesOk");
      ok((await page.locator("#cartChanges").count()) === 0, "visit 2: notice can be dismissed");
      await page.click("#checkoutBtn");
      await page.check('input[name="ordertype"][value="pickup"]');
      await page.fill("#f-name", "Ravi Kumar");
      await page.evaluate(() => { window.__opened = []; KS.openExternal = (u) => window.__opened.push(u); });
      await page.click("#sendOrderBtn");
      const msg = decodeURIComponent(((await page.evaluate(() => window.__opened[0] || "")).split("?text=")[1]) || "");
      ok(/₹671/.test(msg) && !/₹560/.test(msg), "visit 2: WhatsApp order uses ₹671", msg);
      await page.click("#keepCart").catch(() => {});

      /* the owner marks it out of stock */
      await routeShop(ctx, "mithai", (s) => { const p = s.products.find((x) => x.id === kaju.id); p.price = 671; p.mrp = null; p.available = false; p.stock = 0; });
      await page.goto(url);
      await page.waitForSelector("#productGrid .product-card");
      ok(await page.evaluate((sel) => { const c = document.querySelector(sel); return !!c && c.classList.contains("is-off") && !c.querySelector(".btn-primary"); }, card), "visit 3: Kaju Katli shown as unavailable, no Add button");
      ok((await page.textContent("#cartCount")) === "0", "visit 3: out-of-stock item removed from the cart");
      await page.click("#cartBtn");
      const note2 = await page.locator("#cartChanges").textContent().catch(() => "");
      ok(/out of stock/i.test(note2) && /Kaju Katli/.test(note2), "visit 3: cart says Kaju Katli is out of stock now", note2);

      /* tab left open: the change arrives while the customer is at checkout */
      await routeShop(ctx, "mithai", null);
      await page.goto(url);
      await page.waitForSelector("#productGrid .product-card");
      await page.click("#cartChangesOk").catch(() => {});
      await page.click("#drawerClose").catch(() => {});
      await page.click(card + " .btn-primary");
      await routeShop(ctx, "mithai", (s) => { const p = s.products.find((x) => x.id === kaju.id); p.price = 671; p.mrp = null; });
      await page.click("#cartBtn");
      await page.click("#checkoutBtn");
      await page.waitForSelector("#cartChanges", { timeout: 5000 }).catch(() => {});
      const note3 = await page.locator("#cartChanges").textContent().catch(() => "");
      ok(/₹671/.test(note3) && (await page.locator("#checkoutForm").count()) === 0, "open tab: price change found when checkout starts, customer sent back to the cart", note3);


      /* offline: with the service worker, the last copy is used */
      {
        const { ctx: c2, page: p2 } = await ctxPage(browser, null, null, { serviceWorkers: "allow" }); /* offline image misses are expected */
        await p2.goto(url);
        await p2.waitForSelector("#productGrid .product-card");
        await p2.evaluate(() => navigator.serviceWorker.ready);
        await p2.reload();
        await p2.waitForSelector("#productGrid .product-card");
        await c2.setOffline(true);
        await p2.reload().catch(() => {});
        const n = await p2.waitForSelector("#productGrid .product-card", { timeout: 6000 }).then(() => p2.locator("#productGrid .product-card").count(), () => 0);
        ok(n === SHOP("mithai").products.length, "offline (service worker): store still opens with the last shop data (" + n + " products)");
        await c2.setOffline(false);
        await c2.close();
      }
      await ctx.close();
    }

    /* ============ H1: live shops show no demo wording ============ */
    if (part("live")) {
      console.log("H1: demo:false shop hides every demo string");
      const DEMO = /\b(demo|sample|setup tool|fictional)\b|डेमो|नमूना|सेटअप/i;
      const { ctx, page } = await ctxPage(browser, null, problems);
      await routeShop(ctx, "mithai", (s) => {
        s.demo = false;
        s.storeName = "Shree Mithai Ghar";
        s.storeLocation = "Aminabad, Lucknow";
        s.hours = { en: "Every day, 8 AM to 10 PM", hi: "रोज़, सुबह 8 से रात 10 बजे तक" };
        s.deliveryNote = "Home delivery within 2 km.";
        /* text.page.title.store still says "(Demo)", as in a JSON copied from the demo */
      });
      const visibleDemo = () => page.evaluate((src) => {
        const re = new RegExp(src, "i");
        const out = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode())) {
          const el = n.parentElement;
          if (!el || !el.getClientRects().length) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;
          if (re.test(n.textContent)) out.push(n.textContent.trim().slice(0, 80));
        }
        document.querySelectorAll("a[href]").forEach((a) => { if (/admin\.html/.test(a.getAttribute("href")) && a.getClientRects().length) out.push("link to " + a.getAttribute("href")); });
        return out;
      }, DEMO.source);
      await page.goto(base + "store/index.html?shop=mithai");
      await page.waitForSelector("#productGrid .product-card");
      await page.click("#menuBtn");
      ok(await page.evaluate(() => document.documentElement.classList.contains("is-live-shop")), "live shop: is-live-shop class set");
      let found = await visibleDemo();
      ok(found.length === 0, "live shop (EN, menu open): no visible demo / sample / setup-tool text or admin link", found.join(" | "));
      ok(!DEMO.test(await page.title()) && /Shree Mithai Ghar/.test(await page.title()), "live shop: page title has the shop name and no 'Demo' (" + await page.title() + ")");
      await page.click("#menuBtn");
      const buy = SHOP("mithai").products.find((p) => p.available !== false && p.stock > 2);
      await page.click('#productGrid [data-product="' + buy.id + '"] .btn-primary');
      await page.click("#cartBtn");
      found = await visibleDemo();
      ok(found.length === 0, "live shop: cart drawer has no demo text", found.join(" | "));
      await page.click("#checkoutBtn");
      found = await visibleDemo();
      ok(found.length === 0, "live shop: checkout has no demo text", found.join(" | "));
      await page.check('input[name="ordertype"][value="pickup"]');
      await page.fill("#f-name", "Ravi Kumar");
      await page.evaluate(() => { window.__opened = []; KS.openExternal = (u) => window.__opened.push(u); });
      await page.click("#sendOrderBtn");
      const msg = decodeURIComponent(((await page.evaluate(() => window.__opened[0] || "")).split("?text=")[1]) || "");
      ok(msg.length > 50 && !DEMO.test(msg) && /Sent from the Shree Mithai Ghar website/.test(msg), "live shop: WhatsApp message has no demo wording", msg.slice(-200));
      found = await visibleDemo();
      ok(found.length === 0, "live shop: 'sent' screen has no demo text", found.join(" | "));
      await page.click("#keepCart").catch(() => {});
      await page.click("#drawerClose").catch(() => {});
      await page.click("#langBtn"); await page.waitForFunction(() => !window.KS_SITE_I18N || (!!window.KS_SITE_I18N.hi && document.documentElement.lang === (localStorage.getItem("ks_lang_v1") || "en")));
      await page.waitForFunction(() => document.documentElement.lang === "hi");
      await page.click("#menuBtn");
      found = await visibleDemo();
      ok(found.length === 0, "live shop (Hindi, menu open): no visible डेमो / नमूना / setup text", found.join(" | "));
      ok(!DEMO.test(await page.title()), "live shop (Hindi): title has no demo word (" + await page.title() + ")");
      /* hours missing in a live JSON: no "(sample hours)" fallback */
      await routeShop(ctx, "mithai", (s) => { s.demo = false; s.storeName = "Shree Mithai Ghar"; s.storeLocation = "Aminabad, Lucknow"; s.deliveryNote = "Home delivery within 2 km."; delete s.hours; });
      await page.evaluate(() => localStorage.setItem("ks_lang_v1", "en"));
      await page.goto(base + "store/index.html?shop=mithai");
      await page.waitForSelector("#productGrid .product-card");
      found = await visibleDemo();
      ok(found.length === 0, "live shop without hours: no '(sample hours)' fallback", found.join(" | "));
      /* the same shop as a demo still shows its demo labels */
      await routeShop(ctx, "mithai", null);
      await page.goto(base + "store/index.html?shop=mithai");
      await page.waitForSelector("#productGrid .product-card");
      ok((await visibleDemo()).length > 0 && await page.locator(".demo-banner").first().isVisible(), "demo shop still shows its DEMO labels");
      await ctx.close();
    }

    /* ============ H2: static per-shop preview pages ============ */
    if (part("preview")) {
      console.log("H2: per-shop static pages carry their own preview tags");
      const SITE = "https://kiranayap.pages.dev/";
      const reg = readJSON("store/shops/shops.json").shops.map((x) => x.id);
      const { ctx, page } = await ctxPage(browser, null, problems);
      for (const id of reg) {
        const shop = SHOP(id);
        const raw = await (await page.request.get(base + "store/" + id + "/")).text();
        const tag = (re) => { const m = re.exec(raw); return m ? m[1] : ""; };
        const name = shop.storeName.replace(/ \(Demo\)$/, "");
        ok(tag(/<title[^>]*>([^<]+)</).indexOf(name) >= 0 && tag(/property="og:title" content="([^"]+)"/).indexOf(name) >= 0, id + ": raw HTML (no JS) title + og:title name the shop");
        ok(tag(/rel="canonical" href="([^"]+)"/) === SITE + "store/" + id + "/" && tag(/property="og:url" content="([^"]+)"/) === SITE + "store/" + id + "/", id + ": raw HTML canonical/og:url = store/" + id + "/");
        const img = tag(/property="og:image" content="([^"]+)"/);
        const imgRes = await page.request.get(img.replace(SITE, base));
        ok(imgRes.status() === 200 && /image\/jpeg/.test(imgRes.headers()["content-type"] || ""), id + ": og:image is served (" + img.replace(SITE, "") + ")");
        await page.goto(base + "store/" + id + "/");
        await page.waitForSelector("#productGrid .product-card");
        ok((await page.locator("#productGrid .product-card").count()) === shop.products.length, id + ": static page runs the store with this shop's " + shop.products.length + " products");
        ok((await page.getAttribute('link[rel="canonical"]', "href")) === SITE + "store/" + id + "/", id + ": canonical stays on the static page after JS");
        const buy = shop.products.find((p) => p.available !== false && p.stock > 2);
        await page.click('#productGrid [data-product="' + buy.id + '"] .btn-primary');
        ok((await page.textContent("#cartCount")) === "1", id + ": add to cart works on the static page");
        const imgsOk = await page.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length);
        ok(imgsOk === 0, id + ": no broken images on the static page");
        if (id !== "kirana") {
          await page.click("#menuBtn");
          const adm = await page.getAttribute('#siteNav a[href*="admin.html"]', "href");
          ok(adm === "../admin.html?shop=" + id, id + ": setup-tool link keeps the shop (" + adm + ")");
          await page.click("#menuBtn");
        }
        /* the ?shop= address still works and shares the same cart */
        await page.goto(base + "store/index.html?shop=" + id);
        await page.waitForSelector("#productGrid .product-card");
        ok((await page.textContent("#cartCount")) === "1", id + ": ?shop=" + id + " still works and shares the cart");
        ok((await page.getAttribute('link[rel="canonical"]', "href")) === SITE + "store/" + id + "/", id + ": ?shop= canonical points at store/" + id + "/");
        await page.evaluate(() => localStorage.clear());
      }
      await ctx.close();
    }

    /* ============ H3/M2: one promise set ============ */
    if (part("promises")) {
      console.log("H3/M2: rendered pages show one go-live promise and one update phrase");
      const EN_STOCK = "Stock/price changes WhatsApp par bhejiye — 24 ghante ke andar update (Mon–Sat)";
      const HI_STOCK = "स्टॉक/दाम के बदलाव WhatsApp पर भेजिए — 24 घंटे के अंदर अपडेट (सोम–शनि)";
      const { ctx, page } = await ctxPage(browser, null, problems);
      const text = () => page.evaluate(() => { document.querySelectorAll("details").forEach((d) => { d.open = true; }); return document.body.innerText; });
      await page.goto(base);
      let t = await text();
      ok(t.indexOf(EN_STOCK) >= 0, "landing (EN): FAQ shows the exact stock-update phrase");
      ok(/1–2 working days after we receive your details/.test(t) && !/in 1 day|1 din/i.test(t), "landing (EN): go-live 1–2 working days after details, no '1 day'");
      await page.click("[data-lang-toggle], #langBtn, .lang-btn"); await page.waitForFunction(() => !window.KS_SITE_I18N || (!!window.KS_SITE_I18N.hi && document.documentElement.lang === (localStorage.getItem("ks_lang_v1") || "en")));
      await page.waitForFunction(() => document.documentElement.lang === "hi");
      t = await text();
      ok(t.indexOf(HI_STOCK) >= 0, "landing (HI): FAQ shows the Devanagari stock-update phrase");
      ok(/डिटेल मिलने के बाद 1–2 कामकाजी दिन/.test(t) && !/1 दिन में/.test(t), "landing (HI): go-live 1–2 कामकाजी दिन, no '1 दिन में'");
      for (const pg of ["faq.html", "terms.html", "refund.html"]) {
        await page.goto(base + pg);
        t = await text();
        ok(t.indexOf(EN_STOCK) >= 0 && t.indexOf(HI_STOCK) >= 0, pg + ": both phrases visible (EN text + Hindi summary)");
      }
      await page.goto(base + "shop-website-lucknow.html");
      t = await text();
      ok(/1–2 (working days|कामकाजी दिन)/.test(t) && !/in 1 day|1 दिन में/.test(t), "Lucknow page: '1–2 working days' (in the saved language)");
      await ctx.close();
    }

    /* ============ M1/M4/M7: one CTA, plain hero, no jargon, resellers elsewhere ============ */
    if (part("landing")) {
      console.log("M1/M4/M7: landing has one main CTA, a plain kirana hero, no jargon");
      for (const vp of [{ width: 360, height: 800 }, { width: 1280, height: 800 }]) {
        const L = "@" + vp.width + ": ";
        const { ctx, page } = await ctxPage(browser, vp, problems);
        await page.goto(base);
        const heroBtns = await page.locator(".lx-hero .lx-btn").evaluateAll((a) => a.map((x) => x.textContent.trim()));
        ok(heroBtns.length === 1 && heroBtns[0] === "Free demo WhatsApp par maango" && await page.locator(".lx-hero .lx-btn").getAttribute("data-wa") === "demo", L + "hero has exactly one button: the WhatsApp demo request", JSON.stringify(heroBtns));
        const live = page.locator(".lx-hero .lx-cta-sub a");
        ok(await live.isVisible() && (await live.textContent()).trim() === "Live demo dekho", L + "'Live demo dekho' text link right under it");
        const body = await page.evaluate(() => document.body.innerText);
        ok(!/Get Started/i.test(body), L + "no 'Get Started' anywhere on the landing");
        ok(!/cinematic|sell on looks/i.test(body), L + "no jargon ('cinematic', 'sell on looks')");
        ok(!/₹1,499|Reseller|Template licen[cs]e/i.test(body) && (await page.locator('a[href="resellers"]').count()) === 1, L + "reseller / template-licence offer is off the landing; footer links to resellers");
        ok((await page.locator('a[href*="admin.html"]').count()) === 0, L + "no setup-tool link on the landing");
        const chai = await page.locator('a[href*="demo/chai"]').evaluateAll((a) => a.map((x) => !!(x.closest("#demoCarousel") || x.closest(".price-premium"))));
        ok(chai.length >= 1 && chai.every(Boolean), L + "chai demo only in the carousel and the Premium card (" + chai.length + " links)");
        ok((await page.locator(".lx-hero .lx-phone").getAttribute("href")) === "store/kirana/" && /Sharma Kirana Store/.test(await page.locator(".lx-hero .lx-phone").textContent()), L + "hero phone = plain kirana demo store");
        await page.evaluate(() => window.scrollTo(0, document.getElementById("pricing").offsetTop));
        await page.waitForTimeout(700);
        const stickyShown = await page.evaluate(() => { const s = document.querySelector(".lp-sticky"); const r = s.getBoundingClientRect(); return getComputedStyle(s).display !== "none" && r.top < innerHeight && r.height > 0; });
        ok(vp.width < 760 ? stickyShown : !stickyShown, L + (vp.width < 760 ? "sticky WhatsApp bar shows on mobile" : "no sticky WhatsApp bar on desktop"));
        await page.click("#langBtn"); await page.waitForFunction(() => !window.KS_SITE_I18N || (!!window.KS_SITE_I18N.hi && document.documentElement.lang === (localStorage.getItem("ks_lang_v1") || "en")));
        await page.waitForFunction(() => document.documentElement.lang === "hi");
        const hi = await page.evaluate(() => document.body.innerText);
        ok(!/सिनेमैटिक|सिनेमा जैसा|दिखावट से बिक्री/.test(hi) && (await page.locator(".lx-hero .lx-btn").textContent()).trim() === "WhatsApp पर फ़्री डेमो माँगिए", L + "Hindi: main CTA in Devanagari, no jargon");
        await page.click("#langBtn"); await page.waitForFunction(() => !window.KS_SITE_I18N || (!!window.KS_SITE_I18N.hi && document.documentElement.lang === (localStorage.getItem("ks_lang_v1") || "en")));
        await ctx.close();
      }
      const { ctx, page } = await ctxPage(browser, null, problems);
      await page.goto(base + "resellers.html");
      ok(/₹1,499/.test(await page.textContent("main")) && /₹499/.test(await page.textContent("main")) && (await page.locator('[data-wa="agency"]').count()) === 1, "resellers.html: licence + reseller prices and its own WhatsApp button");
      await ctx.close();
    }
  } catch (err) {
    failed++;
    console.log("  FAIL  test run crashed: " + (err && err.stack ? err.stack : err));
  } finally {
    await browser.close();
    srv.close();
  }
  console.log("Runtime problems seen by the browser");
  const real = problems.filter((p) => !/mithai\.json/.test(p) && !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(p));
  ok(real.length === 0, "no console errors or page errors", real.slice(0, 6).join(" | "));
  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
