/* Phase 1 browser tests (Playwright + Chromium), served under /kirana-smart/
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
