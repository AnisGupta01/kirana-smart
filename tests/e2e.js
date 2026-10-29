/* Browser end-to-end tests with a real Chromium (Playwright).
   Run:  node tests/e2e.js
   Needs the "playwright" npm package and a Chromium browser. In this
   project's build environment Chromium is at /opt/pw-browsers/chromium.
   Set CHROMIUM_PATH to use another browser binary. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/npm-tools/node_modules/playwright")); }

const root = path.join(__dirname, "..");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };

let passed = 0, failed = 0;
function ok(cond, name, extra) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const file = path.join(root, p);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

async function newPage(browser, base, viewport, problems, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: viewport || { width: 390, height: 800 }, locale: "en-IN" }, opts || {}));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });
  page.on("requestfailed", (r) => problems.push("requestfailed: " + r.url()));
  page.on("response", (r) => { if (r.status() >= 400) problems.push("HTTP " + r.status() + " " + r.url()); });
  return { ctx, page };
}

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

(async () => {
  const srv = await serve();
  const base = "http://127.0.0.1:" + srv.address().port;
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ["--no-sandbox", "--disable-background-networking", "--disable-sync", "--disable-component-update", "--no-first-run", "--disable-default-apps"] } : { args: ["--no-sandbox"] });
  const problems = [];

  try {
    /* ---------------- Storefront ---------------- */
    console.log("Storefront - load and layout");
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems);
    await page.goto(base + "/store/index.html");
    await page.waitForSelector("#productGrid .product-card");
    ok((await page.locator("#productGrid .product-card").count()) === 33, "33 products rendered in catalog");
    ok((await page.title()).includes("Kirana Smart"), "page title");
    ok((await page.textContent("#storeLine")).includes("Sharma Kirana Store"), "store name in header");
    ok((await page.locator("#featuredGrid .product-card").count()) > 0, "featured section has products");
    ok((await page.locator("#popularGrid .product-card").count()) > 0, "popular section has products");
    ok((await page.locator("#offersGrid .product-card").count()) > 0, "offers section has products");
    ok((await page.locator(".demo-banner").first().textContent()).toLowerCase().includes("sample"), "demo/sample banner visible");
    ok((await page.locator("#catGrid .cat-tile").count()) === 9, "9 category shortcuts");
    ok((await overflowX(page)) <= 0, "no horizontal overflow at 390px");
    await page.waitForTimeout(400);
    const imgs = await page.evaluate(async () => {
      const list = Array.from(document.images);
      list.forEach((i) => { i.loading = "eager"; });
      await Promise.all(list.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); }))));
      return { total: list.length, broken: list.filter((i) => i.naturalWidth === 0).length };
    });
    ok(imgs.total > 30 && imgs.broken === 0, "all images load (" + imgs.total + " images, " + imgs.broken + " broken)");

    for (const w of [360, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      ok((await overflowX(page)) <= 0, "no horizontal overflow at " + w + "px");
    }
    await page.setViewportSize({ width: 390, height: 800 });

    /* mobile menu */
    console.log("Storefront - navigation");
    ok(await page.locator("#siteNav").isHidden(), "mobile menu closed initially");
    await page.click("#menuBtn");
    ok(await page.locator("#siteNav").isVisible(), "mobile menu opens");
    ok((await page.locator('#siteNav a[href="admin.html"]').count()) === 1, "dashboard demo link present");
    await page.click("#menuBtn");

    /* search */
    console.log("Storefront - search, filter, sort");
    await page.fill("#searchInput", "dal");
    const names = await page.locator("#productGrid .card-name").allTextContents();
    ok(names.length >= 4 && names.every((n) => /dal/i.test(n)), "search 'dal' returns only dal products (" + names.length + ")");
    ok(await page.locator("#homeSections").isHidden(), "home sections hidden while searching");
    await page.fill("#searchInput", "zzzzqq");
    ok(await page.locator("#noResults").isVisible(), "no-results message shown");
    ok((await page.locator("#productGrid .product-card").count()) === 0, "no cards when nothing matches");
    await page.click("#noResultsClear");
    ok((await page.locator("#productGrid .product-card").count()) === 33, "clear filters restores all products");
    ok((await page.inputValue("#searchInput")) === "", "search box cleared");
    await page.fill("#searchInput", "ATTA");
    ok((await page.locator("#productGrid .product-card").count()) >= 3, "search is case-insensitive");
    await page.click("#searchClear");
    await page.selectOption("#catFilter", "oil");
    const oilNames = await page.locator("#productGrid .card-name").allTextContents();
    ok(oilNames.length === 3, "category filter oil -> 3 products");
    await page.selectOption("#sortSelect", "priceAsc");
    const prices = (await page.locator("#productGrid .card-price strong").allTextContents()).map((t) => Number(t.replace(/[^\d.]/g, "")));
    ok(prices.every((p, i) => i === 0 || prices[i - 1] <= p), "price low-to-high ordering: " + prices.join(","));
    await page.selectOption("#sortSelect", "priceDesc");
    const pricesD = (await page.locator("#productGrid .card-price strong").allTextContents()).map((t) => Number(t.replace(/[^\d.]/g, "")));
    ok(pricesD.every((p, i) => i === 0 || pricesD[i - 1] >= p), "price high-to-low ordering");
    await page.click("#clearFilters");
    ok((await page.locator("#productGrid .product-card").count()) === 33 && (await page.inputValue("#sortSelect")) === "default", "clear filters resets category and sort");
    await page.locator('#catGrid .cat-tile[data-cat="dairy"]').click();
    ok((await page.inputValue("#catFilter")) === "dairy" && (await page.locator("#productGrid .product-card").count()) === 4, "category tile filters to dairy (4)");
    await page.click("#clearFilters");

    /* cart */
    console.log("Storefront - cart");
    const card = (id) => page.locator('#productGrid .product-card[data-product="' + id + '"]');
    await card("p001").locator("button.btn-primary").click();
    ok((await page.textContent("#cartCount")) === "1", "cart badge shows 1");
    await card("p001").locator('button[aria-label^="Increase"]').click();
    ok((await page.textContent("#cartCount")) === "2", "increase quantity -> 2");
    ok((await card("p001").locator(".step-qty").textContent()) === "2", "stepper shows 2");
    /* stock limit: p008 stock = 4 */
    await card("p008").locator("button.btn-primary").click();
    for (let i = 0; i < 6; i++) {
      const inc = card("p008").locator('button[aria-label^="Increase"]');
      if (await inc.isDisabled()) break;
      await inc.click();
    }
    ok((await card("p008").locator(".step-qty").textContent()) === "4", "quantity stops at stock (4)");
    ok(await card("p008").locator('button[aria-label^="Increase"]').isDisabled(), "increase disabled at stock limit");
    ok((await card("p008").textContent()).includes("Only 4 available"), "stock-limit message shown");
    ok((await card("p012").textContent()).includes("Out of stock") && (await card("p012").locator("button").count()) === 0, "out-of-stock product has no Add button");
    ok((await card("p032").textContent()).includes("Only 3 left"), "low-stock badge shown");

    await page.click("#cartBtn");
    ok(await page.locator("#cartDrawer").isVisible(), "cart drawer opens");
    ok((await page.locator("#drawerBody .cart-line").count()) === 2, "two lines in cart");
    const subtotal = await page.textContent("#cartSubtotal");
    ok(subtotal === "₹" + (2 * 235 + 4 * 38).toLocaleString("en-IN"), "subtotal correct: " + subtotal);
    await page.locator('#drawerBody [data-cart-line="p008"] button[aria-label^="Decrease"]').click();
    ok((await page.textContent("#cartSubtotal")) === "₹" + (2 * 235 + 3 * 38), "decrease updates subtotal");
    ok(await page.locator("#cartDrawer").isVisible(), "drawer stays open after changing quantity");
    await page.locator('#drawerBody [data-cart-line="p008"] .link-btn').click();
    ok((await page.locator("#drawerBody .cart-line").count()) === 1, "remove line works");

    /* persistence */
    await page.reload();
    await page.waitForSelector("#productGrid .product-card");
    ok((await page.textContent("#cartCount")) === "2", "cart persists after refresh");
    await page.click("#cartBtn");
    ok((await page.locator("#drawerBody .cart-line").count()) === 1, "cart line persists after refresh");

    /* checkout validation */
    console.log("Storefront - checkout and WhatsApp");
    await page.click("#checkoutBtn");
    ok(await page.locator("#checkoutForm").isVisible(), "checkout form shown");
    ok(await page.locator("#field-address").isVisible(), "address visible for delivery");
    ok((await page.textContent("#sumDelivery")) === "₹20", "delivery fee shown (470 < 500)");
    ok((await page.textContent("#sumTotal")) === "₹490", "delivery total 490");
    await page.check('input[name="ordertype"][value="pickup"]');
    ok(await page.locator("#field-address").isHidden(), "address hidden for pickup");
    ok((await page.textContent("#sumTotal")) === "₹470", "pickup total 470");
    await page.check('input[name="ordertype"][value="delivery"]');
    await page.click("#sendOrderBtn");
    ok(await page.locator("#err-name").isVisible() && await page.locator("#err-phone").isVisible() && await page.locator("#err-address").isVisible(), "empty form shows name/phone/address errors");
    ok((await page.getAttribute("#f-name", "aria-invalid")) === "true", "invalid field marked aria-invalid");
    await page.fill("#f-name", "<b>X</b>");
    await page.fill("#f-phone", "12345");
    await page.fill("#f-address", "short");
    await page.click("#sendOrderBtn");
    ok((await page.locator("#err-name").textContent()).length > 5 && (await page.locator("#err-phone").textContent()).length > 5 && (await page.locator("#err-address").textContent()).length > 5, "bad values rejected");
    await page.fill("#f-name", "Anish Gupta");
    await page.fill("#f-phone", "98765 43210");
    await page.fill("#f-address", "12 Main Road & Co, Near Park, Lucknow");
    await page.fill("#f-notes", "Please call #1 & ring bell 100%");
    await page.evaluate(() => { window.__opened = []; KS.openExternal = (u) => window.__opened.push(u); });
    await page.click("#sendOrderBtn");
    ok(await page.locator("#formAlert").isVisible(), "placeholder store number blocks sending");
    ok((await page.textContent("#formAlert")).includes("WhatsApp number"), "clear message about missing store number");
    ok((await page.evaluate(() => window.__opened.length)) === 0, "WhatsApp NOT opened with placeholder number");

    /* configure number through settings (as shopkeeper would) */
    await page.evaluate(() => KS.saveSettings(Object.assign({}, KS.getSettings(), { whatsappNumber: "919876543210" })));
    await page.click("#sendOrderBtn");
    const opened = await page.evaluate(() => window.__opened.slice());
    ok(opened.length === 1 && opened[0].startsWith("https://wa.me/919876543210?text="), "WhatsApp URL opened for configured number");
    const msg = decodeURIComponent(opened[0].split("?text=")[1]);
    ["Sharma Kirana Store (Demo)", "Anish Gupta", "9876543210", "Whole Wheat Atta", "x 2", "Subtotal: ₹470", "Delivery fee: ₹20", "Total: ₹490", "Home delivery", "12 Main Road & Co, Near Park, Lucknow", "Please call #1 & ring bell 100%"]
      .forEach((n) => ok(msg.includes(n), "WhatsApp message contains: " + n));
    ok(/Order ref: KS-\d{6}-[A-Z0-9]{4}/.test(msg), "message has order reference");
    ok((await page.textContent("#sentNotice")).toLowerCase().includes("not sent yet"), "after opening WhatsApp the order is NOT shown as confirmed");
    ok(!(await page.textContent("#drawerBody")).toLowerCase().includes("order confirmed"), "no 'confirmed' claim");
    ok((await page.textContent("#cartCount")) === "2", "cart kept until customer says they pressed Send");
    ok((await page.locator("#reopenWa").getAttribute("href")).startsWith("https://wa.me/919876543210"), "re-open link available");
    await page.click("#copyMsgBtn");
    await page.click("#keepCart");
    ok(await page.locator("#drawerBody .cart-line").count() === 1, "keep cart returns to cart");
    await page.click("#drawerClose");
    ok(await page.locator("#cartDrawer").isHidden(), "drawer closes");
    await page.click("#cartBtn");
    await page.click("#checkoutBtn");
    await page.fill("#f-name", "Anish Gupta");
    await page.fill("#f-phone", "9876543210");
    await page.check('input[name="ordertype"][value="pickup"]');
    await page.click("#sendOrderBtn");
    await page.click("#clearAfterSend");
    ok((await page.textContent("#cartCount")) === "0", "cart cleared after customer confirms they sent it");
    await page.click("#cartBtn");
    ok(await page.locator("#drawerBody .state-panel").isVisible(), "empty cart state shown");
    await page.keyboard.press("Escape");
    ok(await page.locator("#cartDrawer").isHidden(), "Escape closes drawer");

    /* language */
    console.log("Storefront - language");
    await page.click("#langBtn");
    ok((await page.textContent("#heroTitle")).includes("किराना"), "Hindi hero title");
    ok((await page.getAttribute("html", "lang")) === "hi", "html lang=hi");
    ok((await page.locator("#productGrid .card-name").first().textContent()).match(/[ऀ-ॿ]/) !== null, "Hindi product names shown");
    ok((await page.locator("#productGrid .card-price strong").first().textContent()).startsWith("₹"), "prices stay in rupees");
    ok((await page.locator("#catFilter option").nth(1).textContent()).match(/[ऀ-ॿ]/) !== null, "Hindi category names");
    await page.reload();
    await page.waitForSelector("#productGrid .product-card");
    ok((await page.getAttribute("html", "lang")) === "hi", "language remembered after refresh");
    await page.fill("#searchInput", "दाल");
    ok((await page.locator("#productGrid .product-card").count()) >= 4, "Hindi search works");
    await page.click("#searchClear");
    await page.click("#langBtn");
    ok((await page.textContent("#heroTitle")).startsWith("Your neighbourhood"), "back to English");

    /* ---------------- Dashboard ---------------- */
    console.log("Dashboard - overview and products");
    await page.goto(base + "/store/admin.html");
    await page.waitForSelector("#overviewStats .stat");
    ok((await page.locator("#overviewStats .stat").count()) === 6, "6 overview stats");
    ok((await page.textContent("#stat-total .stat-value")) === "33", "overview total products 33");
    ok((await page.textContent("#stat-low .stat-value")) === "2", "overview low-stock count 2");
    ok((await page.textContent("#stat-out .stat-value")) === "1", "overview out-of-stock count 1");
    ok((await page.textContent("#stat-sales .stat-value")).startsWith("₹"), "sales summary shown");
    ok((await page.locator(".demo-banner").textContent()).includes("do NOT reach customers"), "dashboard states changes stay local");
    await page.click("#tab-products");
    ok((await page.locator("#invList .inv-row").count()) === 33, "inventory lists 33 products");
    await page.fill("#invSearch", "atta");
    ok((await page.locator("#invList .inv-row").count()) === 2, "inventory search 'atta' -> 2");
    await page.fill("#invSearch", "");
    await page.selectOption("#invStatus", "low");
    ok((await page.locator("#invList .inv-row").count()) === 2, "low-stock filter -> 2");
    await page.selectOption("#invStatus", "out");
    ok((await page.locator("#invList .inv-row").count()) === 1, "out-of-stock filter -> 1");
    await page.selectOption("#invStatus", "all");

    const row = (id) => page.locator('#invList .inv-row[data-product="' + id + '"]');
    /* price update */
    await row("p001").locator('[data-field="price"]').fill("-5");
    await row("p001").locator('[data-field="price"]').blur();
    ok((await row("p001").locator('[data-field="price"]').inputValue()) === "235", "negative price rejected and reverted");
    await row("p001").locator('[data-field="price"]').fill("240");
    await row("p001").locator('[data-field="price"]').blur();
    ok((await page.evaluate(() => KS.getProduct("p001").price)) === 240, "price update saved");
    /* stock update */
    await row("p001").locator('[data-field="stock"]').fill("2.5");
    await row("p001").locator('[data-field="stock"]').blur();
    ok((await page.evaluate(() => KS.getProduct("p001").stock)) === 40, "fractional stock rejected");
    await row("p001").locator('[data-field="stock"]').fill("3");
    await row("p001").locator('[data-field="stock"]').blur();
    ok((await page.evaluate(() => KS.getProduct("p001").stock)) === 3, "stock update saved");
    ok((await row("p001").locator(".badge").textContent()) === "Low stock", "low-stock badge after update");
    /* availability */
    await row("p002").locator('[data-field="available"]').uncheck();
    ok((await page.evaluate(() => KS.getProduct("p002").available)) === false, "mark unavailable saved");
    ok((await row("p002").locator(".badge").textContent()) === "Unavailable", "unavailable badge");

    /* add product */
    await page.click("#addProductBtn");
    ok(await page.locator("#productForm").isVisible(), "add-product form opens");
    await page.click("#pf-save");
    ok(await page.locator("#pferr-name").isVisible() && await page.locator("#pferr-price").isVisible() && await page.locator("#pferr-unit").isVisible() && await page.locator("#pferr-stock").isVisible(), "empty add form shows validation errors");
    await page.fill("#pf-name", '<img src=x onerror="window.__xss=1">Test Item');
    await page.fill("#pf-price", "-3");
    await page.fill("#pf-unit", "1 kg");
    await page.fill("#pf-stock", "7");
    await page.click("#pf-save");
    ok(await page.locator("#pferr-price").isVisible(), "negative price in form rejected");
    await page.fill("#pf-price", "49.5");
    await page.fill("#pf-mrp", "40");
    await page.click("#pf-save");
    ok(await page.locator("#pferr-mrp").isVisible(), "MRP lower than price rejected");
    await page.fill("#pf-mrp", "55");
    await page.fill("#pf-image", "javascript:alert(1)");
    await page.click("#pf-save");
    ok(await page.locator("#pferr-image").isVisible(), "unsafe image link rejected");
    await page.fill("#pf-image", "");
    await page.selectOption("#pf-category", "snacks");
    await page.check("#pf-featured");
    await page.click("#pf-save");
    ok(await page.locator("#productForm").count() === 0, "form closes after saving");
    ok((await page.evaluate(() => KS.getProducts().length)) === 34, "product added (34)");
    ok((await page.evaluate(() => window.__xss)) === undefined, "HTML in product name did not execute");
    await page.fill("#invSearch", "Test Item");
    ok((await page.locator("#invList .inv-name").first().textContent()).includes("<img"), "HTML shown as plain text, not rendered");
    ok((await page.locator("#invList img[onerror]").count()) === 0, "no injected img element");

    /* edit product */
    await row("p034").locator('[data-action="edit"]').click();
    ok((await page.inputValue("#pf-unit")) === "1 kg", "edit form pre-filled");
    await page.fill("#pf-name", "Edited Item");
    await page.fill("#pf-price", "52");
    await page.click("#pf-save");
    ok((await page.evaluate(() => KS.getProduct("p034").name)) === "Edited Item", "edit product saved");
    ok((await page.evaluate(() => KS.getProduct("p034").price)) === 52, "edited price saved");

    /* delete with confirmation */
    await page.fill("#invSearch", "");
    await row("p034").locator('[data-action="delete"]').click();
    ok(await page.locator(".modal").isVisible(), "delete asks for confirmation");
    await page.click(".modal .btn-ghost");
    ok((await page.evaluate(() => KS.getProducts().length)) === 34, "cancel keeps the product");
    await row("p034").locator('[data-action="delete"]').click();
    await page.click("[data-confirm-ok]");
    ok((await page.evaluate(() => KS.getProducts().length)) === 33, "confirm deletes the product");

    /* changes reach the storefront in the same browser */
    console.log("Dashboard - orders and settings");
    await page.click("#tab-orders");
    ok((await page.locator("#orderList .order-card").count()) === 6, "6 sample orders listed");
    ok((await page.locator("#orderList .badge-sample").count()) === 6, "orders labelled as samples");
    await page.selectOption("#ordFilter", "Pending");
    ok((await page.locator("#orderList .order-card").count()) === 1, "filter by Pending -> 1");
    await page.selectOption("#ordFilter", "all");
    const sel = page.locator('[data-order="DEMO-1001"]');
    for (const s of ["Accepted", "Ready", "Completed", "Cancelled", "Pending"]) {
      await sel.selectOption(s);
      ok((await page.evaluate(() => KS.getOrders().find((o) => o.id === "DEMO-1001").status)) === s, "order status -> " + s);
    }
    await page.locator('[data-order-card="DEMO-1001"] [data-action="details"]').click();
    const detail = await page.locator(".modal").textContent();
    ok(detail.includes("Demo Customer A") && detail.includes("Whole Wheat Atta") && detail.includes("98XXXXXX01"), "order detail shows customer, items, masked phone");
    await page.click('.modal .seg-btn[data-status="Accepted"]');
    ok((await page.evaluate(() => KS.getOrders().find((o) => o.id === "DEMO-1001").status)) === "Accepted", "status change from detail view");
    await page.keyboard.press("Escape");
    ok((await page.locator(".modal").count()) === 0, "Escape closes order detail");

    await page.click("#tab-settings");
    await page.fill("#s-whatsappNumber", "abc");
    await page.click("#saveSettingsBtn");
    ok(await page.locator("#serr-whatsappNumber").isVisible(), "invalid WhatsApp number rejected");
    await page.fill("#s-whatsappNumber", "9123456789");
    await page.fill("#s-deliveryFee", "-1");
    await page.click("#saveSettingsBtn");
    ok(await page.locator("#serr-deliveryFee").isVisible(), "negative delivery fee rejected");
    await page.fill("#s-deliveryFee", "30");
    await page.fill("#s-storeName", "Gupta General Store");
    await page.click("#saveSettingsBtn");
    ok(await page.locator("#settingsMsg").isVisible(), "settings saved message");

    await page.goto(base + "/store/index.html");
    await page.waitForSelector("#productGrid .product-card");
    ok((await page.textContent("#storeLine")).includes("Gupta General Store"), "store name change visible on storefront (same browser)");
    ok((await page.locator('#productGrid .product-card[data-product="p002"]').textContent()).includes("Currently unavailable"), "unavailable product shown as unavailable on storefront");
    ok((await page.locator('#productGrid .product-card[data-product="p001"] .card-price strong').textContent()) === "₹240", "price change visible on storefront");

    /* reset demo */
    await page.goto(base + "/store/admin.html#settings");
    await page.waitForSelector("#resetDemoBtn");
    await page.click("#resetDemoBtn");
    await page.click(".modal .btn-ghost");
    ok((await page.evaluate(() => KS.getSettings().storeName)) === "Gupta General Store", "cancel keeps data");
    await page.click("#resetDemoBtn");
    await page.click("[data-confirm-ok]");
    ok((await page.evaluate(() => KS.getSettings().storeName)) === "Sharma Kirana Store (Demo)", "reset restores shop name");
    ok((await page.evaluate(() => KS.getProduct("p001").price)) === 235 && (await page.evaluate(() => KS.getProduct("p002").available)) === true, "reset restores products");

    /* language on dashboard */
    await page.click("#langBtn");
    ok((await page.textContent("#tab-products")) === "सामान", "dashboard switches to Hindi");
    await page.click("#tab-orders");
    ok((await page.locator("#orderList .badge").first().textContent()).match(/[ऀ-ॿ]/) !== null, "Hindi order status labels");
    await page.click("#langBtn");

    for (const w of [360, 768, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const t of ["overview", "products", "orders", "settings"]) {
        await page.click("#tab-" + t);
        if ((await overflowX(page)) > 0) ok(false, "dashboard " + t + " overflows at " + w + "px");
      }
    }
    ok(true, "dashboard has no horizontal overflow at 360/768/1280px");
    await ctx.close();

    /* desktop layout */
    console.log("Desktop and keyboard");
    const d = await newPage(browser, base, { width: 1280, height: 800 }, problems);
    await d.page.goto(base + "/store/index.html");
    await d.page.waitForSelector("#productGrid .product-card");
    ok(await d.page.locator("#siteNav").isVisible(), "nav bar visible on desktop");
    ok(await d.page.locator("#menuBtn").isHidden(), "hamburger hidden on desktop");
    const cols = await d.page.evaluate(() => getComputedStyle(document.getElementById("productGrid")).gridTemplateColumns.split(" ").length);
    ok(cols >= 4, "desktop grid has " + cols + " columns");
    await d.page.keyboard.press("Tab");
    ok((await d.page.evaluate(() => document.activeElement.className)).includes("skip-link"), "first Tab stops on skip link");
    await d.ctx.close();

    /* blocked storage */
    console.log("Edge cases");
    const e = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await e.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
    const ep = await e.newPage();
    const eerrs = [];
    ep.on("pageerror", (x) => eerrs.push(x.message));
    await ep.goto(base + "/store/index.html");
    await ep.waitForSelector("#productGrid .product-card");
    ok(eerrs.length === 0 && (await ep.locator("#productGrid .product-card").count()) === 33, "store still works when browser blocks storage");
    await e.close();

    const c2 = await browser.newContext({ viewport: { width: 390, height: 800 } });
    await c2.addInitScript(() => {
      localStorage.setItem("ks_products_v1", "garbage{");
      localStorage.setItem("ks_cart_v1", '[{"id":"p001","qty":"x"},{"id":"zzz","qty":3}]');
    });
    const p2 = await c2.newPage();
    const e2 = [];
    p2.on("pageerror", (x) => e2.push(x.message));
    await p2.goto(base + "/store/index.html");
    await p2.waitForSelector("#productGrid .product-card");
    ok(e2.length === 0 && (await p2.locator("#productGrid .product-card").count()) === 33 && (await p2.textContent("#cartCount")) === "0", "corrupt LocalStorage handled gracefully");
    await c2.close();

    await require("./e2e-sellkit.js")({ browser, base, problems, ok, newPage, overflowX, root });

    const nf = await browser.newContext();
    const np = await nf.newPage();
    const resp = await np.goto(base + "/missing.html");
    ok(resp.status() === 404, "unknown page gives 404 (static host behaviour)");
    await nf.close();
  } catch (err) {
    failed++;
    console.log("  FAIL  test run crashed: " + (err && err.stack ? err.stack : err));
  } finally {
    await browser.close();
    srv.close();
  }

  console.log("Runtime problems seen by the browser");
  const real = problems.filter((p) => !p.includes("/missing.html") && !p.includes("favicon"));
  ok(real.length === 0, "no console errors, page errors, failed requests or HTTP errors", real.slice(0, 5).join(" | "));

  console.log("\n" + passed + " passed, " + failed + " failed");
  process.exit(failed ? 1 : 0);
})();
