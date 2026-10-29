/* Browser tests for the sell kit: landing page, niche demos, Udhaar Khata,
   QR poster, city + legal pages, PWA/offline.
   Runs as part of tests/e2e.js, or on its own:  node tests/e2e-sellkit.js
   Optional: the "jsqr" npm package lets the QR poster test decode the QR. */
"use strict";
const fs = require("fs");
const path = require("path");

const REAL = "919876543210"; /* test-only number, never shipped */
const WIDTHS = [360, 390, 768, 1280];

async function noOverflow(ok, page, overflowX, label) {
  const bad = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(60);
    const o = await overflowX(page);
    if (o > 0) bad.push(w + "px:+" + o);
  }
  await page.setViewportSize({ width: 390, height: 800 });
  ok(bad.length === 0, label + ": no horizontal overflow at 360/390/768/1280px", bad.join(" "));
}

/* serve site-config.js / a shop JSON with a real number, only inside this test context */
async function withRealNumber(ctx, root) {
  const cfg = fs.readFileSync(path.join(root, "assets/js/site-config.js"), "utf8").replace("91XXXXXXXXXX", REAL);
  await ctx.route("**/assets/js/site-config.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: cfg }));
  await ctx.route(/\/store\/shops\/[a-z0-9-]+\.json$/, (r) => {
    const id = r.request().url().split("/").pop();
    const f = path.join(root, "store/shops", id);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "not found" });
    r.fulfill({ status: 200, contentType: "application/json", body: fs.readFileSync(f, "utf8").replace("91XXXXXXXXXX", REAL) });
  });
}

module.exports = async function sellkit(t) {
  const { browser, base, problems, ok, newPage, overflowX, root } = t;
  const NOSW = { serviceWorkers: "block" };
  const shop = (id) => JSON.parse(fs.readFileSync(path.join(root, "store/shops", id + ".json"), "utf8"));

  /* ---------------- Landing page ---------------- */
  console.log("Landing page");
  {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    await page.goto(base + "/");
    ok((await page.textContent("h1")).trim() === "Apni dukaan ki website, 1 din mein. WhatsApp pe order. Koi commission nahi.", "hero headline");
    ok((await page.title()).includes("Kirana Smart"), "landing title");
    const sections = ["demos", "why", "features", "how", "pricing", "agency", "reviews", "faq", "contact"];
    const have = await page.evaluate((ids) => ids.filter((i) => document.getElementById(i)), sections);
    ok(have.length === sections.length, "all sections present (" + have.join(",") + ")");
    ok((await page.locator(".niche-card").count()) === 4, "4 niche demo cards");
    const hrefs = await page.locator(".niche-card").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
    ok(["kirana", "mithai", "bakery", "cloud-kitchen"].every((s, i) => hrefs[i] === "store/index.html?shop=" + s), "niche cards open their demos");
    ok(await page.locator(".lp-sticky .btn-whatsapp").isVisible(), "sticky green demo button visible on mobile");
    ok((await page.locator('#reviews .rev-tag').count()) === 3 && /placeholder/i.test(await page.textContent(".sample-note")), "testimonials marked SAMPLE");
    ok((await page.locator('a[href="udhaar.html"]').count()) >= 2 && (await page.locator('a[href="qr-poster.html"]').count()) >= 1, "links to Udhaar Khata and QR poster");
    /* placeholder number: no WhatsApp, friendly notice */
    ok((await page.locator("[data-wa][data-wa-missing]").count()) >= 5, "with placeholder number, demo buttons are marked missing");
    await page.locator(".lp-sticky .btn-whatsapp").click();
    ok(await page.locator("#waNotice").isVisible() && /not set/i.test(await page.textContent("#waNotice")), "placeholder number shows 'number not set' notice");
    ok(!page.url().includes("wa.me"), "no navigation to WhatsApp with placeholder");
    /* FAQ */
    await page.locator("#faq summary").first().click();
    ok(await page.locator("#faq details").first().evaluate((d) => d.open), "FAQ opens");
    /* live preview */
    const frame = page.frameLocator("#previewFrame");
    await page.locator("#preview").scrollIntoViewIfNeeded();
    await frame.locator("#productGrid .product-card").first().waitFor({ timeout: 8000 });
    ok((await frame.locator("#storeLine").textContent()).includes("Sharma Kirana"), "phone preview shows the kirana demo");
    await page.click('.lp-ptab[data-shop="mithai"]');
    await page.waitForFunction(() => document.getElementById("previewFrame").getAttribute("src").includes("mithai"));
    await page.waitForTimeout(300);
    await frame.locator("#productGrid .product-card").first().waitFor({ timeout: 8000 });
    ok((await frame.locator(".brand-text strong").first().textContent()).includes("Shree Mithai Ghar"), "preview switches to the mithai demo");
    ok((await page.getAttribute("#previewOpen", "href")) === "store/index.html?shop=mithai", "'open full screen' link follows the preview");
    ok((await page.getAttribute('.lp-ptab[data-shop="mithai"]', "aria-selected")) === "true", "selected preview tab marked");
    /* images */
    const imgs = await page.evaluate(async () => {
      const list = Array.from(document.images);
      list.forEach((i) => { i.loading = "eager"; });
      await Promise.all(list.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
      return { total: list.length, broken: list.filter((i) => i.naturalWidth === 0).map((i) => i.src) };
    });
    ok(imgs.broken.length === 0, "all landing images load (" + imgs.total + ")", imgs.broken.join(","));
    /* language */
    await page.click("#langBtn");
    ok(/अपनी दुकान की वेबसाइट/.test(await page.textContent("h1")) && (await page.getAttribute("html", "lang")) === "hi", "Hindi switch translates the hero");
    ok(/सवाल/.test(await page.textContent("#faqTitle")), "Hindi FAQ heading");
    await page.reload();
    ok((await page.getAttribute("html", "lang")) === "hi", "language remembered on landing");
    await page.click("#langBtn");
    await noOverflow(ok, page, overflowX, "landing");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, base, { width: 1280, height: 800 }, problems, NOSW);
    await withRealNumber(ctx, root);
    await page.goto(base + "/index.html");
    const href = await page.getAttribute(".lp-hero .btn-whatsapp", "href");
    ok(href.startsWith("https://wa.me/" + REAL + "?text="), "with a real number, demo button opens wa.me");
    const msg = decodeURIComponent(href.split("?text=")[1]);
    ok(/^DEMO\n/.test(msg) && /Dukaan ka naam/.test(msg), "prefilled DEMO message");
    ok((await page.getAttribute(".lp-hero .btn-whatsapp", "target")) === "_blank" && /noopener/.test(await page.getAttribute(".lp-hero .btn-whatsapp", "rel")), "WhatsApp opens in a new tab safely");
    ok(/^AGENCY/.test(decodeURIComponent((await page.getAttribute('[data-wa="agency"]', "href")).split("?text=")[1])), "agency button has its own message");
    ok(await page.locator(".lp-nav").isVisible(), "desktop nav visible");
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector(".niche-grid")).gridTemplateColumns.split(" ").length);
    ok(cols === 4, "desktop niche grid has 4 columns");
    await ctx.close();
  }

  /* ---------------- Niche demos ---------------- */
  console.log("Niche demos");
  for (const id of ["mithai", "bakery", "cloud-kitchen"]) {
    const s = shop(id);
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    await withRealNumber(ctx, root);
    await page.goto(base + "/store/?shop=" + id);
    await page.waitForSelector("#productGrid .product-card");
    ok((await page.locator("#productGrid .product-card").count()) === s.products.length, id + ": all " + s.products.length + " products shown");
    ok((await page.textContent(".brand-text strong")) === s.storeName, id + ": shop name is the brand");
    ok((await page.textContent(".brand-mono")) === s.logoText, id + ": monogram logo " + s.logoText);
    ok((await page.locator("#catGrid .cat-tile").count()) === s.categories.length, id + ": " + s.categories.length + " category tiles");
    ok((await page.textContent("#heroTitle")) === s.text.en["hero.title"], id + ": hero text from its JSON");
    ok((await page.getAttribute('meta[name="theme-color"]', "content")) === s.colors.brand, id + ": theme colour from JSON");
    ok((await page.title()) === s.text.en["page.title.store"], id + ": page title from JSON");
    ok((await page.textContent(".site-footer")).includes(s.hours.en), id + ": opening hours in footer");
    ok((await page.getAttribute(".made-with a", "href")) === "../index.html", id + ": 'Website by Kirana Smart' link back to landing");
    /* order flow */
    await page.evaluate(() => { window.__opened = []; KS.openExternal = (u) => window.__opened.push(u); });
    const first = s.products.find((p) => p.stock > 5 && p.available);
    await page.locator('#productGrid .product-card[data-product="' + first.id + '"] button.btn-primary').click();
    await page.click("#cartBtn");
    await page.click("#checkoutBtn");
    await page.fill("#f-name", "Test Customer");
    await page.fill("#f-phone", "9876500000");
    await page.check('input[name="ordertype"][value="pickup"]');
    await page.click("#sendOrderBtn");
    await page.waitForTimeout(200);
    const opened = await page.evaluate(() => window.__opened);
    const text = opened[0] ? decodeURIComponent(opened[0].split("?text=")[1]) : "";
    ok(opened.length === 1 && opened[0].startsWith("https://wa.me/" + REAL), id + ": checkout opens WhatsApp to the shop number");
    ok(text.includes(first.name) && text.includes(s.storeName), id + ": WhatsApp order lists the item and the shop name");
    /* dashboard of this shop */
    await page.goto(base + "/store/admin.html?shop=" + id);
    await page.waitForSelector("#overviewStats .stat");
    ok((await page.textContent("#stat-total .stat-value")) === String(s.products.length), id + ": dashboard counts this shop's products");
    ok((await page.getAttribute("#backToStore", "href")) === "index.html?shop=" + id, id + ": dashboard links back to this shop");
    ok((await page.getAttribute("#udhaarLink", "href")).startsWith("../udhaar.html?name=") && decodeURIComponent(await page.getAttribute("#udhaarLink", "href")).includes(s.storeName), id + ": Udhaar Khata link carries the shop name");
    const qr = decodeURIComponent(await page.getAttribute("#qrLink", "href"));
    ok(qr.includes("url=" + base + "/store/index.html?shop=" + id), id + ": QR poster link carries the store address");
    if (id === "mithai") {
      await page.goto(base + "/store/?shop=mithai");
      await noOverflow(ok, page, overflowX, "mithai demo");
      /* each shop keeps its own cart */
      const mithaiCart = await page.textContent("#cartCount");
      await page.goto(base + "/store/");
      await page.waitForSelector("#productGrid .product-card");
      ok(mithaiCart !== "0" && (await page.textContent("#cartCount")) === "0", "kirana and mithai carts are separate");
      ok((await page.locator("#productGrid .product-card").count()) === 33, "kirana demo unaffected (33 products)");
    }
    await ctx.close();
  }
  {
    const beforeBad = problems.length;
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    await page.goto(base + "/store/?shop=not-a-shop");
    await page.waitForSelector("#appError:not([hidden])");
    ok(/not found/.test(await page.textContent("#appErrorDetail")), "unknown shop shows a clear error");
    ok((await page.locator('#appError a[href="../index.html#demos"]').count()) === 1, "error offers a link to all demos");
    await page.goto(base + "/store/?shop=%3Cimg%20src%3Dx%3E");
    await page.waitForSelector("#appError:not([hidden])");
    ok((await page.locator("#appError img").count()) === 0 && /not valid/.test(await page.textContent("#appErrorDetail")), "bad shop id rejected safely");
    await ctx.close();
    /* the 404 for the unknown shop file is expected here */
    problems.splice(beforeBad).filter((p) => !/not-a-shop|404/.test(p)).forEach((p) => problems.push(p));
  }

  /* ---------------- Udhaar Khata ---------------- */
  console.log("Digital Udhaar Khata");
  {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    await page.goto(base + "/udhaar.html?name=Sharma%20Kirana");
    ok(/demo/i.test(await page.textContent(".demo-banner")) && /not lend/i.test(await page.textContent(".demo-banner")), "clearly labelled demo, no lending");
    ok((await page.inputValue("#udShopName")) === "Sharma Kirana", "shop name taken from the link");
    ok(await page.locator("#udEmpty").isVisible(), "empty state shown");
    await page.click("#udSample");
    ok((await page.locator("#udList .ud-row").count()) === 3, "sample customers loaded");
    ok((await page.textContent("#udTotalDue")) === "₹890.50", "total due of samples (₹470 + ₹420.50 + ₹0)");
    ok((await page.textContent("#udDueCount")) === "2", "customers with dues = 2");
    /* add customer with validation */
    await page.fill("#udName", "");
    await page.click("#udAddForm button[type=submit]");
    ok(await page.locator("#udErrName").isVisible(), "empty name shows an error");
    await page.fill("#udName", "Anil Verma");
    await page.fill("#udPhone", "12345");
    await page.click("#udAddForm button[type=submit]");
    ok(await page.locator("#udErrPhone").isVisible(), "bad phone shows an error");
    await page.fill("#udPhone", "9876511111");
    await page.click("#udAddForm button[type=submit]");
    ok(await page.locator("#udCustView").isVisible() && (await page.textContent("#udCustName")) === "Anil Verma", "new customer opened");
    /* entries */
    await page.fill("#udAmount", "abc");
    await page.click("#udGave");
    ok(await page.locator("#udErrAmount").isVisible(), "invalid amount rejected");
    await page.fill("#udAmount", "1250.50");
    await page.fill("#udNote", "Monthly ration");
    await page.click("#udGave");
    ok((await page.textContent("#udBalance")) === "₹1,250.50", "udhaar added: balance ₹1,250.50");
    await page.fill("#udAmount", "250.50");
    await page.click("#udGot");
    ok((await page.textContent("#udBalance")) === "₹1,000", "payment recorded: balance ₹1,000");
    ok((await page.locator("#udLedger tr").count()) === 2, "history shows 2 entries");
    const remind = await page.getAttribute("#udRemind", "href");
    const rtext = decodeURIComponent(remind.split("?text=")[1]);
    ok(remind.startsWith("https://wa.me/919876511111?text=") && /Anil Verma जी/.test(rtext) && rtext.includes("₹1,000") && rtext.includes("Sharma Kirana"), "WhatsApp reminder: right number, Hindi text, amount, shop");
    ok((await page.getAttribute("#udRemind", "target")) === "_blank", "reminder opens in a new tab");
    /* delete an entry */
    await page.locator("#udLedger [data-del-entry]").first().click();
    await page.click("[data-confirm-ok]");
    ok((await page.textContent("#udBalance")) === "₹1,250.50" && (await page.locator("#udLedger tr").count()) === 1, "deleting the payment restores the balance");
    /* CSV */
    await page.click("#udBack");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#udExport")]);
    const csvPath = await dl.path();
    const csv = fs.readFileSync(csvPath, "utf8");
    ok(/^udhaar-khata-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), "CSV file name has the date");
    ok(csv.includes("Anil Verma,9876511111") && csv.includes("1250.50") && csv.includes("Ramesh Ji (sample)"), "CSV contains all customers and entries");
    /* persistence + Hindi */
    await page.reload();
    ok((await page.locator("#udList .ud-row").count()) === 4 && (await page.textContent("#udTotalDue")) === "₹2,141", "khata saved on this device after reload");
    await page.click("#langBtn");
    ok(/उधार खाता/.test(await page.textContent("#udSumTitle")) && /देने हैं/.test(await page.textContent("#udList")), "Hindi labels in the khata");
    await page.fill("#udSearch", "anil");
    ok((await page.locator("#udList .ud-row").count()) === 1, "search filters customers");
    await page.fill("#udSearch", "");
    await page.click("#langBtn");
    /* delete customer */
    await page.locator('#udList [data-open]').first().click();
    const victim = await page.textContent("#udCustName");
    await page.click("#udDelete");
    await page.click("[data-confirm-ok]");
    ok((await page.locator("#udList .ud-row").count()) === 3 && !(await page.textContent("#udList")).includes(victim), "delete customer");
    await noOverflow(ok, page, overflowX, "udhaar");
    await page.locator('#udList [data-open]').first().click();
    await noOverflow(ok, page, overflowX, "udhaar customer view");
    await ctx.close();
  }

  /* ---------------- QR poster ---------------- */
  console.log("QR poster");
  {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    const target = "https://anisgupta01.github.io/kirana-smart/store/?shop=mithai";
    await page.goto(base + "/qr-poster.html?name=Shree%20Mithai%20Ghar&url=" + encodeURIComponent(target));
    ok((await page.textContent("#pShop")) === "Shree Mithai Ghar", "poster shows the shop name from the link");
    ok((await page.locator("#pQr svg path").count()) === 1, "QR drawn as SVG on the device");
    ok((await page.textContent(".poster-head")).includes("Scan karo") && (await page.textContent(".poster-head")).includes("WhatsApp pe order karo"), "poster headline");
    ok((await page.textContent("#pUrl")) === "anisgupta01.github.io/kirana-smart/store/?shop=mithai", "poster shows the short link");
    /* decode the QR the user actually sees */
    let jsQR = null;
    try { jsQR = require("jsqr"); } catch (e) { /* optional */ }
    const px = await page.evaluate(async () => {
      const svg = document.querySelector("#pQr svg");
      const xml = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 400;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, 400, 400);
      return Array.from(g.getImageData(0, 0, 400, 400).data);
    });
    if (jsQR) {
      const res = jsQR(Uint8ClampedArray.from(px), 400, 400);
      ok(res && res.data === target, "QR on the poster scans to the shop link", res && res.data);
    } else console.log("  SKIP  QR scan check (npm i jsqr)");
    await page.fill("#qrUrl", "javascript:alert(1)");
    await page.click("#qrForm button[type=submit]");
    ok(await page.locator("#qrUrlErr").isVisible(), "unsafe link rejected with an error");
    await page.fill("#qrUrl", "gupta-sweets.in");
    await page.fill("#qrLine", "Free delivery above ₹500");
    await page.check('input[name="qrTheme"][value="maroon"]');
    await page.click("#qrForm button[type=submit]");
    ok((await page.getAttribute("#pQr", "data-url")) === "https://gupta-sweets.in/" && (await page.textContent("#pLine")) === "Free delivery above ₹500", "poster updates with new link and extra line");
    ok((await page.getAttribute("#poster", "class")).includes("theme-maroon"), "poster colour changes");
    await noOverflow(ok, page, overflowX, "QR poster page");
    /* print layout: only the poster, exactly one A4 page */
    await page.emulateMedia({ media: "print" });
    ok(await page.locator("#qrForm").isHidden() && await page.locator(".lp-header").isHidden(), "print hides the form and header");
    const w = await page.evaluate(() => document.getElementById("poster").getBoundingClientRect().width);
    ok(Math.abs(w - 793.7) < 3, "printed poster is A4 width (210mm), got " + Math.round(w) + "px");
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages === 1, "print-to-PDF gives exactly 1 A4 page (got " + pages + ")");
    if (process.env.KS_SCREENS) fs.writeFileSync(path.join(process.env.KS_SCREENS, "qr-poster.pdf"), pdf);
    const fits = await page.evaluate(() => { const p = document.getElementById("poster"); return p.scrollHeight <= p.clientHeight + 1; });
    ok(fits, "poster content fits on the A4 sheet (nothing cut off)");
    await page.emulateMedia({ media: "screen" });
    await ctx.close();
  }

  /* ---------------- City + legal pages ---------------- */
  console.log("City and legal pages");
  for (const [slug, city] of [["lucknow", "Lucknow"], ["kanpur", "Kanpur"], ["varanasi", "Varanasi"]]) {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    await withRealNumber(ctx, root);
    await page.goto(base + "/shop-website-" + slug + ".html");
    ok((await page.textContent("#heroTitle")).length > 20 && (await page.title()).includes(city), city + ": page loads with its own title");
    const msg = decodeURIComponent((await page.getAttribute(".lp-hero .btn-whatsapp", "href")).split("?text=")[1]);
    ok(msg.includes("Shehar: " + city), city + ": WhatsApp message includes the city");
    await page.click("#langBtn");
    ok(/[\u0900-\u097F]/.test(await page.textContent("#heroTitle")), city + ": Hindi version");
    await page.click("#langBtn");
    if (slug === "lucknow") await noOverflow(ok, page, overflowX, "Lucknow page");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, base, { width: 360, height: 800 }, problems, NOSW);
    for (const [p, re] of [["privacy", /DPDP/], ["refund", /3 working days/], ["terms", /FSSAI/]]) {
      await page.goto(base + "/" + p + ".html");
      ok(re.test(await page.textContent("main")) && /[\u0900-\u097F]/.test(await page.textContent(".legal-hi")), p + " page: key terms + Hindi summary");
      ok((await overflowX(page)) <= 0, p + " page: no overflow at 360px");
    }
    ok(/GST registration/.test(await page.textContent("main")), "terms: shops handle their own GST");
    await ctx.close();
  }

  /* ---------------- PWA ---------------- */
  console.log("Installable app (PWA)");
  {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems);
    await page.goto(base + "/index.html");
    ok((await page.getAttribute('link[rel="manifest"]', "href")) === "manifest.webmanifest", "manifest linked");
    const reg = await page.evaluate(async () => {
      const r = await Promise.race([navigator.serviceWorker.ready, new Promise((res) => setTimeout(() => res(null), 8000))]);
      if (!r) return null;
      await new Promise((res) => setTimeout(res, 800));
      const keys = await caches.keys();
      const c = await caches.open(keys[0]);
      const hit = await c.match("store/shops/mithai.json");
      return { scope: r.scope, keys, cachedShop: !!hit };
    });
    ok(reg && /\/$/.test(reg.scope), "service worker registered for the whole site");
    ok(reg && reg.keys.some((k) => k.indexOf("ks-shell-") === 0) && reg.cachedShop, "offline shell cached (incl. shop files)");
    await page.reload();
    const before = problems.length;
    await ctx.setOffline(true);
    let offlineOk = false;
    try {
      await page.goto(base + "/store/?shop=mithai", { timeout: 8000 });
      await page.waitForSelector("#productGrid .product-card", { timeout: 8000 });
      offlineOk = (await page.locator("#productGrid .product-card").count()) > 10;
    } catch (e) { offlineOk = false; }
    ok(offlineOk, "mithai demo opens with no internet after first visit");
    await page.goto(base + "/udhaar.html", { timeout: 8000 }).catch(() => {});
    ok((await page.locator("#udSumTitle").count()) === 1, "Udhaar Khata opens offline");
    await ctx.setOffline(false);
    await ctx.close();
    /* while offline on purpose, failed network requests are expected; keep real page errors */
    const offlineProblems = problems.splice(before);
    offlineProblems.filter((p) => p.indexOf("pageerror") === 0).forEach((p) => problems.push(p));
  }
};

/* standalone run */
if (require.main === module) {
  const http = require("http");
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (e) { ({ chromium } = require("/opt/npm-tools/node_modules/playwright")); }
  const root = path.join(__dirname, "..");
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };
  let passed = 0, failed = 0;
  const ok = (c, n, extra) => { if (c) { passed++; console.log("  PASS  " + n); } else { failed++; console.log("  FAIL  " + n + (extra ? "  -> " + extra : "")); } };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  srv.listen(0, "127.0.0.1", async () => {
    const base = "http://127.0.0.1:" + srv.address().port;
    const browser = await chromium.launch({ args: ["--no-sandbox"] });
    const problems = [];
    async function newPage(b, _base, viewport, probs, opts) {
      const ctx = await b.newContext(Object.assign({ viewport: viewport || { width: 390, height: 800 }, locale: "en-IN" }, opts || {}));
      const page = await ctx.newPage();
      page.on("pageerror", (e) => probs.push("pageerror: " + e.message));
      page.on("console", (m) => { if (m.type() === "error") probs.push("console: " + m.text()); });
      page.on("requestfailed", (r) => probs.push("requestfailed: " + r.url() + " " + (r.failure() && r.failure().errorText)));
      page.on("response", (r) => { if (r.status() >= 400) probs.push("HTTP " + r.status() + " " + r.url()); });
      return { ctx, page };
    }
    const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    try {
      await module.exports({ browser, base, problems, ok, newPage, overflowX, root });
    } catch (err) { failed++; console.log("  FAIL  crashed: " + (err && err.stack)); }
    await browser.close();
    srv.close();
    console.log("Runtime problems seen by the browser");
    ok(problems.length === 0, "no console errors, page errors, failed requests or HTTP errors", problems.join(" | "));
    console.log("\n" + passed + " passed, " + failed + " failed");
    process.exit(failed ? 1 : 0);
  });
}
