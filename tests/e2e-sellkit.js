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

/* every card matching `sel` has a WebP <img> that really loaded (scrolls each card into view first, so lazy images load) */
async function cardImages(page, sel) {
  return page.evaluate(async (sel) => {
    const els = Array.from(document.querySelectorAll(sel));
    const bad = [];
    for (const e of els) {
      e.scrollIntoView({ block: "center", behavior: "instant" });
      const img = e.querySelector("img");
      if (!img) { bad.push("no <img> in " + (e.getAttribute("data-id") || e.getAttribute("data-product") || e.getAttribute("href") || e.className)); continue; }
      if (!(img.complete && img.naturalWidth > 0)) {
        await new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); setTimeout(r, 6000); });
      }
      const src = img.currentSrc || img.src;
      if (!/\.webp(\?|$)/i.test(src) || img.naturalWidth === 0) bad.push(src + " (w=" + img.naturalWidth + ")");
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    return { n: els.length, bad };
  }, sel);
}

/* serve site-config.js / a shop JSON with a real number, only inside this test context */
async function withRealNumber(ctx, root) {
  const cfg = fs.readFileSync(path.join(root, "assets/js/site-config.js"), "utf8").replace(/91XXXXXXXXXX|917266042235/g, REAL);
  await ctx.route("**/assets/js/site-config.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: cfg }));
  await ctx.route(/\/store\/shops\/[a-z0-9-]+\.json$/, (r) => {
    const id = r.request().url().split("/").pop();
    const f = path.join(root, "store/shops", id);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "not found" });
    r.fulfill({ status: 200, contentType: "application/json", body: fs.readFileSync(f, "utf8").replace(/91XXXXXXXXXX|917266042235/g, REAL) });
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
    { const pcfg = fs.readFileSync(path.join(root, "assets/js/site-config.js"), "utf8").replace(/917266042235/g, "91XXXXXXXXXX");
      await ctx.route("**/assets/js/site-config.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: pcfg })); }
    await page.goto(base + "/");
    ok((await page.textContent("h1")).replace(/\s+/g, " ").trim() === "Apni dukaan ki website, itni sundar ki customer ruk jaaye.", "hero headline");
    ok((await page.textContent(".lph-promise")).trim() === "1 din mein live. WhatsApp pe order. Koi commission nahi.", "hero promise line (1 day, WhatsApp, no commission)");
    ok((await page.title()).includes("Kirana Smart"), "landing title");
    const sections = ["demos", "shop", "features", "how", "pricing", "agency", "why", "faq", "contact"];
    const have = await page.evaluate((ids) => ids.filter((i) => document.getElementById(i)), sections);
    ok(have.length === sections.length, "all sections present (" + have.join(",") + ")");
    ok((await page.locator("#reviews").count()) === 0, "no testimonials section (no fake reviews)");
    ok((await page.locator("#demoCarousel .lx-dcard").count()) === 5 && (await page.locator("#demoCarousel .niche-card").count()) === 4, "demo carousel: premium card + 4 niche demo cards");
    const hrefs = await page.locator(".niche-card").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
    ok(["kirana", "mithai", "bakery", "cloud-kitchen"].every((s, i) => hrefs[i] === "store/index.html?shop=" + s), "niche cards open their demos");
    await page.evaluate(() => window.scrollTo({ top: document.getElementById("features").offsetTop, behavior: "instant" }));
    await page.waitForSelector(".lp-sticky.is-on", { timeout: 4000 });
    ok(await page.locator(".lp-sticky .btn-whatsapp").isVisible(), "sticky green demo button slides in on mobile after scrolling");
    /* hero phone: lightweight slideshow on mobile, the demo iframe is not loaded */
    ok((await page.getAttribute("#heroFrame", "data-src")).startsWith("demo/chai/") && !(await page.getAttribute("#heroFrame", "src")), "mobile hero shows the photo slideshow (demo iframe not loaded)");
    ok((await page.locator(".lx-slide img").count()) === 6, "hero slideshow has 6 product photos");
    ok((await page.locator('a[href="udhaar.html"]').count()) >= 2 && (await page.locator('a[href="qr-poster.html"]').count()) >= 1, "links to Udhaar Khata and QR poster");
    /* placeholder number: no WhatsApp, friendly notice */
    ok((await page.locator("[data-wa][data-wa-missing]").count()) >= 5, "with placeholder number, demo buttons are marked missing");
    await page.locator(".lp-sticky .btn-whatsapp").click();
    ok(await page.locator("#waNotice").isVisible() && /not set/i.test(await page.textContent("#waNotice")), "placeholder number shows 'number not set' notice");
    ok(!page.url().includes("wa.me"), "no navigation to WhatsApp with placeholder");
    /* FAQ */
    await page.locator("#faq summary").first().click();
    ok(await page.locator("#faq details").first().evaluate((d) => d.open), "FAQ opens");
    /* demos carousel */
    {
      const car = page.locator("#demoCarousel");
      await car.scrollIntoViewIfNeeded();
      ok(await car.evaluate((c) => c.scrollWidth > c.clientWidth + 50), "demo carousel scrolls sideways on mobile");
      ok(await car.evaluate((c) => getComputedStyle(c).scrollSnapType.includes("x")), "carousel snaps card by card");
      await car.evaluate((c) => c.scrollTo({ left: c.scrollWidth, behavior: "instant" }));
      await page.waitForTimeout(250);
      ok(await page.locator("#demoCarousel .lx-dcard").last().evaluate((e) => { const r = e.getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= 0; }), "last demo card can be swiped fully into view");
      await car.evaluate((c) => c.scrollTo({ left: 0, behavior: "instant" }));
    }
    /* shop tabs + product grid */
    {
      await page.locator("#shop").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !document.getElementById("shopGrid").classList.contains("is-loading"));
      ok((await page.locator("#shopGrid .lx-card").count()) === 8, "product grid shows 8 kirana products");
      ok((await page.getAttribute('.lx-tab[data-shop="kirana"]', "aria-selected")) === "true", "kirana tab selected first");
      await page.click('#shopGrid [data-add="p001"]');
      await page.click('#shopGrid [data-inc="p001"]');
      await page.click('#shopGrid [data-add="p005"]');
      ok((await page.textContent('#shopGrid .lx-card[data-id="p001"] .lx-qty-n')) === "2", "Add then + sets quantity 2");
      ok(await page.locator("#shopBar").isVisible() && /3/.test(await page.textContent("#shopBarTxt")) && (await page.textContent("#shopBarTxt")).includes("₹990"), "cart bar shows 3 items and ₹990 (2 × ₹235 + ₹520)");
      await page.click('#shopGrid [data-dec="p005"]');
      ok((await page.locator('#shopGrid [data-add="p005"]').count()) === 1, "− back to zero shows Add again");
      await page.click('.lx-tab[data-shop="mithai"]');
      await page.waitForFunction(() => { const c = document.querySelector("#shopGrid .lx-card"); return c && c.getAttribute("data-id") === "m001"; }, null, { timeout: 8000 });
      ok((await page.textContent("#shopGrid .lx-card .lx-card-name")).includes("Kaju Katli"), "mithai tab loads the mithai products");
      ok((await page.getAttribute('.lx-tab[data-shop="mithai"]', "aria-selected")) === "true" && (await page.getAttribute('.lx-tab[data-shop="kirana"]', "aria-selected")) === "false", "selected tab marked");
      ok((await page.getAttribute("#shopOpen", "href")) === "store/index.html?shop=mithai", "'open full screen' link follows the tab");
      ok(await page.locator("#shopBar").isHidden(), "each shop has its own cart (mithai cart empty)");
      await page.focus('.lx-tab[data-shop="mithai"]');
      await page.keyboard.press("ArrowRight");
      ok((await page.getAttribute('.lx-tab[data-shop="bakery"]', "aria-selected")) === "true", "arrow keys move between tabs");
      await page.click('.lx-tab[data-shop="kirana"]');
      await page.waitForFunction(() => document.querySelector("#shopGrid .lx-card").getAttribute("data-id") === "p001");
      ok((await page.textContent('#shopGrid .lx-card[data-id="p001"] .lx-qty-n')) === "2", "kirana cart kept when switching back");
    }
    /* every product photo is a real WebP that loads */
    {
      const dc = await cardImages(page, ".niche-card, .premium-demo");
      ok(dc.n === 5 && dc.bad.length === 0, "demo cards: every card has a WebP photo that loads (" + dc.n + ")", dc.bad.join(","));
      for (const id of ["kirana", "mithai", "bakery", "cloud-kitchen"]) {
        await page.click('.lx-tab[data-shop="' + id + '"]');
        await page.waitForFunction(() => !document.getElementById("shopGrid").classList.contains("is-loading") && document.querySelectorAll("#shopGrid .lx-card").length === 8, null, { timeout: 8000 });
        const g = await cardImages(page, "#shopGrid .lx-card");
        ok(g.n === 8 && g.bad.length === 0, "landing grid (" + id + "): every product card has a WebP photo that loads", g.bad.join(","));
      }
      await page.click('.lx-tab[data-shop="kirana"]');
    }
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
    const row = await page.evaluate(() => { const c = [...document.querySelectorAll("#demoCarousel .lx-dcard")].map((e) => e.getBoundingClientRect()); return { sameRow: c.slice(0, 4).every((r) => Math.abs(r.top - c[0].top) < 2), shown: c.filter((r) => r.left >= 0 && r.right <= innerWidth + 1).length }; });
    {
      await page.locator("#demoCarousel").scrollIntoViewIfNeeded();
      ok(await page.locator('[data-car="prev"]').isDisabled(), "desktop carousel: 'previous' disabled at the start");
      const x0 = await page.locator("#demoCarousel").evaluate((c) => c.scrollLeft);
      await page.click('[data-car="next"]');
      await page.waitForFunction((x) => document.getElementById("demoCarousel").scrollLeft > x + 50, x0, { timeout: 4000 });
      await page.waitForTimeout(700);
      ok(!(await page.locator('[data-car="prev"]').isDisabled()), "desktop carousel: 'next' scrolls and enables 'previous'");
    }
    ok(row.sameRow && row.shown >= 3, "desktop demo carousel shows at least 3 cards side by side (" + row.shown + ")");
    ok((await page.locator("#shopGrid").evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length)) === 4, "desktop product grid has 4 columns");
    await ctx.close();
  }

  /* ---------------- Cinematic premium demo ---------------- */
  console.log("Cinematic premium demo (demo/chai)");
  {
    const OWNER = "917266042235";
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 844 }, problems, NOSW);
    await page.goto(base + "/demo/chai/index.html");
    await page.waitForSelector(".scene");
    ok((await page.locator(".scene").count()) === 6, "6 full-screen product sections");
    const names = await page.locator(".s-name").evaluateAll((a) => a.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
    ok(["Kulhad Chai", "Kesar Rasmalai", "Kaju Katli", "Garam Samosa", "Bun Maska", "Malai Lassi"].every((n, i) => names[i] === n), "products in order: " + names.join(", "));
    const nums = await page.locator(".s-k-n").evaluateAll((a) => a.map((x) => x.textContent));
    ok(nums.join(",") === "01,02,03,04,05,06", "numbered 01 to 06");
    ok((await page.textContent("h1")).replace(/\s+/g, " ").trim() === "Subah ki pehli chai. Shaam ki meethi yaadein.", "hero line");
    ok((await page.locator(".scene .s-piece").count()) >= 6 * 10, "ingredient cut-outs around every product");
    const heights = await page.evaluate(() => [...document.querySelectorAll(".scene")].map((s) => s.offsetHeight / innerHeight));
    ok(heights.every((h) => h >= 1.5), "each scene is taller than the screen (pinned scroll scene)");
    /* scroll-driven burst */
    const midY = await page.evaluate(() => { const s = document.querySelectorAll(".scene")[2]; return s.getBoundingClientRect().top + scrollY + (s.offsetHeight - innerHeight) * 0.4; });
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), midY);
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => { const s = document.querySelectorAll(".scene")[2]; const op = [...s.querySelectorAll(".s-piece")].map((x) => parseFloat(x.style.opacity || "0")); return { inn: s.classList.contains("is-in"), vis: op.filter((o) => o > 0.6).length, tf: s.querySelector(".s-piece").style.transform, rail: document.getElementById("railNum").textContent, onlyTransform: !s.querySelector(".s-piece").style.left }; });
    ok(st.inn && st.vis >= 6, "scrolling into a scene reveals the text and bursts the ingredients (" + st.vis + " pieces visible)");
    ok(/translate3d/.test(st.tf) && st.onlyTransform, "pieces move with transform only (no layout properties)");
    ok(st.rail === "03", "bottom rail shows the current item number");
    const posA = await page.evaluate(() => document.querySelectorAll(".scene")[2].querySelector(".s-piece").style.transform);
    await page.evaluate((y) => window.scrollTo({ top: y + 220, behavior: "instant" }), midY);
    await page.waitForTimeout(250);
    const posB = await page.evaluate(() => document.querySelectorAll(".scene")[2].querySelector(".s-piece").style.transform);
    ok(posA !== posB, "ingredient positions follow the scroll");
    /* cart */
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.click('[data-add="kulhad-chai"]');
    await page.click('[data-inc="kulhad-chai"]');
    await page.click('[data-add="samosa"]');
    ok((await page.textContent("#cartCount")) === "3", "add-to-cart and + update the cart count");
    ok((await page.textContent("#pillTotal")) === "₹70", "mini cart total ₹70 (2 × ₹20 + ₹30)");
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: "instant" }));
    await page.waitForTimeout(400);
    ok(await page.locator("#cartPill").isVisible(), "sticky mini cart visible after the hero");
    await page.click("#cartPill");
    ok(await page.locator("#sheet").isVisible(), "order sheet opens");
    ok((await page.locator("#cartLines .cin-line").count()) === 2, "order sheet lists 2 lines");
    let href = await page.getAttribute("#waSend", "href");
    let msg = decodeURIComponent(href.split("?text=")[1] || "");
    ok(href.startsWith("https://wa.me/" + OWNER + "?text="), "WhatsApp order goes to the shop number from the config (" + OWNER + ")");
    ok(msg.includes("Sharma Chai & Mithai (Demo)") && msg.includes("Kulhad Chai (per kulhad) x 2 = ₹40") && msg.includes("Garam Samosa") && msg.includes("Total: ₹70"), "WhatsApp message lists items, quantities and total");
    ok((await page.getAttribute("#waSend", "target")) === "_blank" && /noopener/.test(await page.getAttribute("#waSend", "rel")), "WhatsApp link opens safely in a new tab");
    await page.check('input[name="mode"][value="delivery"]');
    let popups = 0; ctx.on("page", () => { popups++; });
    await page.click("#waSend");
    await page.waitForTimeout(150);
    ok(await page.locator("#addrErr").isVisible() && popups === 0, "home delivery without an address is blocked with a message");
    await page.fill("#fName", "Test Customer");
    await page.fill("#fAddress", "House 5, Test Lane");
    msg = decodeURIComponent((await page.getAttribute("#waSend", "href")).split("?text=")[1] || "");
    ok(msg.includes("Name: Test Customer") && msg.includes("Address: House 5, Test Lane") && msg.includes("Home delivery"), "name, delivery mode and address go into the message");
    await page.keyboard.press("Escape");
    ok(await page.locator("#sheet").isHidden(), "Escape closes the order sheet");
    await page.click('[data-dec="samosa"]');
    ok((await page.textContent("#cartCount")) === "2", "− removes an item");
    /* language */
    await page.click("#langBtn");
    ok((await page.getAttribute("html", "lang")) === "hi" && (await page.locator(".s-name").first().textContent()).includes("कुल्हड़"), "Hindi toggle switches the whole menu");
    ok(decodeURIComponent((await page.getAttribute("#waSend", "href")).split("?text=")[1] || "").includes("नमस्ते"), "WhatsApp message in Hindi after switching");
    await page.reload();
    await page.waitForSelector(".scene");
    ok((await page.getAttribute("html", "lang")) === "hi" && (await page.textContent("#cartCount")) === "2", "language and cart are remembered after reload");
    await page.click("#langBtn");
    ok((await page.getAttribute("#helloBtn", "href")).startsWith("https://wa.me/" + OWNER + "?text="), "'Say hello' button opens WhatsApp to the shop");
    const imgs = await page.evaluate(() => [...document.images].filter((i) => !i.getAttribute("width") || !i.getAttribute("height")).length);
    ok(imgs === 0, "every image has width/height (no layout shift)");
    await noOverflow(ok, page, overflowX, "cinematic demo");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 844 }, problems, Object.assign({ reducedMotion: "reduce" }, NOSW));
    await page.goto(base + "/demo/chai/index.html");
    await page.waitForSelector(".scene");
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ reduce: document.documentElement.classList.contains("reduce"), allIn: [...document.querySelectorAll(".scene")].every((s) => s.classList.contains("is-in")), h: document.querySelector(".scene").offsetHeight / innerHeight }));
    ok(r.reduce && r.allIn && r.h < 1.3, "reduced motion: no pinned scroll scenes, all text shown");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, base, { width: 1280, height: 800 }, problems, NOSW);
    await page.goto(base + "/");
    await page.waitForFunction(() => { const f = document.getElementById("heroFrame"); return f && f.getAttribute("src"); }, null, { timeout: 8000 });
    ok((await page.getAttribute("#heroFrame", "src")).startsWith("demo/chai/") && !(await page.locator("#heroFrame").evaluate((f) => f.hidden)), "desktop: hero phone loads the cinematic demo after page load");
    await page.waitForFunction(() => document.querySelector(".lx-screen").classList.contains("is-live"), null, { timeout: 8000 });
    ok(true, "desktop: hero phone swaps the slideshow for the live demo");
    ok((await page.getAttribute(".premium-demo", "href")) === "demo/chai/index.html" && /premium/i.test(await page.textContent(".premium-demo .pd-badge")), "first demo card is the Premium cinematic demo");
    const prem = await page.textContent(".price-premium");
    ok(/₹2,999/.test(prem) && /₹199/.test(prem), "Premium tier ₹2,999 setup + ₹199/month");
    const starter = await page.textContent(".price-main");
    ok(/₹999/.test(starter) && /₹149/.test(starter), "Starter tier still ₹999 + ₹149");
    ok((await page.getAttribute('.price-premium [data-wa="premium"]', "href")).startsWith("https://wa.me/917266042235?text=PREMIUM"), "Premium button opens WhatsApp to the owner");
    await ctx.close();
  }

  /* ---------------- Demo store photos ---------------- */
  console.log("Demo store product photos");
  for (const id of ["kirana", "mithai", "bakery", "cloud-kitchen"]) {
    const { ctx, page } = await newPage(browser, base, { width: 390, height: 800 }, problems, NOSW);
    await page.goto(base + "/store/index.html?shop=" + id);
    await page.waitForSelector("#productGrid .product-card", { timeout: 8000 });
    const r = await cardImages(page, ".product-card");
    ok(r.n >= shop(id).products.length && r.bad.length === 0, "demo store " + id + ": every product card has a WebP photo that loads (" + r.n + ")", r.bad.join(","));
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
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".woff2": "font/woff2" };
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
