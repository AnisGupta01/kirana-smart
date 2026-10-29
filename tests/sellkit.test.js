/* Sell-kit logic tests - plain Node, no installs needed.
   Run:  node tests/sellkit.test.js
   Covers: shop JSON files (niche demos), the shop loader helpers,
   Digital Udhaar Khata logic, landing-page WhatsApp links and texts,
   and the QR poster (QR is decoded back if the optional "jsqr"
   package is installed). */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name); }
}
function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) console.log("        expected " + JSON.stringify(b) + " got " + JSON.stringify(a));
  ok(same, name);
}
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function memStore() {
  const store = {};
  return {
    store,
    api: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    }
  };
}
function storeWindow(files) {
  const m = memStore();
  const win = {
    localStorage: m.api,
    document: { documentElement: { lang: "en", style: { setProperty() {} }, getAttribute: () => null }, querySelectorAll: () => [], querySelector: () => null },
    navigator: {}, setTimeout, console, Date, URL, encodeURIComponent, decodeURIComponent
  };
  win.window = win;
  vm.createContext(win);
  (files || ["i18n.js", "common.js", "cart.js"]).forEach((f) => vm.runInContext(read("assets/js/" + f), win, { filename: f }));
  return { win, store: m.store };
}
const SHOPS = ["kirana", "mithai", "bakery", "cloud-kitchen"];
const shopJson = (id) => JSON.parse(read("store/shops/" + id + ".json"));

/* ---------------------------------------------------------------- */
console.log("Shop files (store/shops/*.json)");
SHOPS.forEach((id) => {
  let s;
  try { s = shopJson(id); ok(true, id + ".json is valid JSON"); } catch (e) { ok(false, id + ".json is valid JSON: " + e.message); return; }
  eq(s.id, id, id + ": id matches file name");
  ok(s.whatsappNumber === "91XXXXXXXXXX", id + ": ships the placeholder WhatsApp number");
  ok(s.demo === true && /demo/i.test(s.storeName), id + ": marked as demo and named (Demo)");
  ok(/^#[0-9a-f]{6}$/i.test(s.colors.brand) && /^#[0-9a-f]{6}$/i.test(s.colors.accent), id + ": brand + accent colours are hex");
  ok(s.hours && s.hours.en && s.hours.hi, id + ": opening hours in English and Hindi");
  const cats = s.categories.map((c) => c.id);
  eq(new Set(cats).size, cats.length, id + ": category ids unique");
  ok(s.categories.every((c) => c.en && c.hi), id + ": every category has en + hi label");
  ok(cats.every((c) => s.products.some((p) => p.category === c)), id + ": every category has products");
  const pids = s.products.map((p) => p.id);
  eq(new Set(pids).size, pids.length, id + ": product ids unique");
  ok(s.products.every((p) => p.name && p.nameHi && p.unit && p.price > 0 && Number.isInteger(p.stock)), id + ": products have name, Hindi name, unit, price, whole stock");
  ok(s.products.every((p) => p.mrp === null || p.mrp >= p.price), id + ": MRP is never below price");
  ok(s.products.some((p) => p.featured) && s.products.some((p) => p.popular) && s.products.some((p) => p.mrp > p.price), id + ": has featured, popular and offer items");
  ok(s.products.some((p) => p.stock === 0), id + ": has an out-of-stock item (demo)");
  ok((s.sampleOrders || []).every((o) => o.items.every((it) => pids.indexOf(it[0]) >= 0)), id + ": sample orders reference real products");
  ok((s.sampleOrders || []).every((o) => /X{4,}/.test(o.phone)), id + ": sample order phones are masked placeholders");
  ok(fs.existsSync(path.join(root, s.heroImage)), id + ": hero image exists (" + s.heroImage + ")");
  ["en", "hi"].forEach((l) => ok(!s.text || !s.text[l] || Object.keys(s.text[l]).every((k) => /^[a-zA-Z0-9.]+$/.test(k)), id + ": text keys (" + l + ") are simple keys"));
  if (s.text && s.text.en) eq(Object.keys(s.text.en).sort(), Object.keys(s.text.hi).sort(), id + ": text overrides exist in both languages");
});

console.log("Applying shops");
{
  const { win } = storeWindow();
  const KS = win.KS;
  eq(KS.shopIdFromSearch(""), "kirana", "no ?shop= means the kirana demo");
  eq(KS.shopIdFromSearch("?shop=mithai"), "mithai", "?shop=mithai read");
  eq(KS.shopIdFromSearch("?a=1&shop=Cloud-Kitchen"), "cloud-kitchen", "?shop= is case-insensitive");
  eq(KS.shopIdFromSearch("?shop=../etc"), null, "path tricks rejected");
  eq(KS.shopIdFromSearch("?shop=%3Cscript%3E"), null, "html in shop id rejected");
  eq(KS.keysForShop("kirana").products, "ks_products_v1", "kirana keeps the original storage keys");
  eq(KS.keysForShop("mithai").cart, "ks_mithai_cart_v1", "other shops get their own cart key");
  eq(KS.keysForShop("mithai").lang, "ks_lang_v1", "language choice is shared by all shops");

  KS.applyShop(shopJson("mithai"));
  eq(KS.CATEGORIES.slice(), ["sweets", "bengali", "dryfruit", "namkeen", "gifts"], "mithai categories replace kirana ones");
  eq(KS.getProducts().length, shopJson("mithai").products.length, "all mithai products pass sanitising");
  eq(KS.getSettings().storeName, "Shree Mithai Ghar (Demo)", "mithai shop name in settings");
  eq(KS.categoryLabel("gifts"), "Gift Boxes", "category label (en) from JSON");
  KS.setLang = KS.setLang; /* noop */
  ok(win.KS_I18N.hi["cat.gifts"] === "गिफ़्ट बॉक्स", "category label (hi) from JSON");
  ok(win.KS_I18N.en["hero.title"] === "Fresh mithai, ordered on WhatsApp", "per-shop hero text override");
  ok(win.KS_I18N.en["footer.hours"].indexOf("8 AM") >= 0, "per-shop opening hours");
  eq(KS.KEYS.products, "ks_mithai_products_v1", "mithai products stored under their own key");
  ok(win.KS_CONFIG.brandColor === "#7f1d1d" && win.KS_CONFIG.logoText === "SM", "mithai colour and monogram");
  ok(KS.usesShopName(), "non-kirana shops use their own name as the brand");
  ok(KS.getOrders().length === 3 && KS.getOrders()[0].items.length > 0, "mithai sample orders built");
  const en = Object.keys(win.KS_I18N.en).sort(), hi = Object.keys(win.KS_I18N.hi).sort();
  eq(en, hi, "English/Hindi keys still match after applying a shop");

  const bad = (obj, name) => { let threw = false; try { KS.applyShop(obj); } catch (e) { threw = true; } ok(threw, name); };
  bad(null, "applyShop rejects empty data");
  bad({ id: "x y", storeName: "A", products: [{}] }, "applyShop rejects invalid id");
  bad({ id: "abc", products: [{ id: "a", name: "A", category: "atta", price: 1 }] }, "applyShop rejects missing storeName");
  bad({ id: "abc", storeName: "Abc", products: [] }, "applyShop rejects empty product list");
  bad({ id: "abc", storeName: "Abc", categories: [{ id: "c1", en: "C" }], products: [{ id: "a", name: "A", category: "zzz", price: 1 }] }, "applyShop rejects when no product passes checks");
  const evil = shopJson("bakery");
  evil.colors.brand = "red;background:url(x)";
  evil.heroImage = "javascript:alert(1)";
  KS.applyShop(evil);
  ok(win.KS_CONFIG.brandColor === "#14532d" && win.KS_CONFIG.heroImage === "", "unsafe colour / image values fall back to safe defaults");
}
{
  const { win } = storeWindow();
  const KS = win.KS;
  SHOPS.forEach((id) => {
    const k2 = storeWindow().win.KS;
    let okApply = true;
    try { k2.applyShop(shopJson(id)); } catch (e) { okApply = false; }
    ok(okApply && k2.getProducts().length === shopJson(id).products.length, id + ": applies cleanly, all products valid");
  });
  KS.applyShop(shopJson("kirana"));
  ok(!KS.usesShopName() && KS.getSettings().storeName.indexOf("Sharma") === 0, "kirana demo keeps Kirana Smart branding");
}

/* ---------------------------------------------------------------- */
console.log("Digital Udhaar Khata");
{
  const { win, store } = storeWindow(["i18n.js", "common.js", "udhaar-core.js"]);
  const U = win.KS.udhaar;
  const d = U.load();
  eq(d.customers.length, 0, "starts empty");
  ok(!U.addCustomer(d, { name: "" }).ok, "empty name rejected");
  ok(!U.addCustomer(d, { name: "<b>x</b>" }).ok, "HTML in name rejected");
  eq(U.addCustomer(d, { name: "Ramesh", phone: "12345" }).errors.phone, "ud.err.phone", "bad phone rejected");
  const r1 = U.addCustomer(d, { name: "Ramesh Kumar", phone: "+91 98765 43210" });
  ok(r1.ok && r1.customer.phone === "9876543210", "customer added, phone normalised");
  eq(U.addCustomer(d, { name: "Other", phone: "9876543210" }).errors.phone, "ud.err.dupPhone", "duplicate phone rejected");
  const r2 = U.addCustomer(d, { name: "सुनीता देवी" });
  ok(r2.ok && r2.customer.phone === "", "Hindi name without phone allowed");
  const c = r1.customer;
  ok(!U.addEntry(d, c.id, { type: "credit", amount: "0" }).ok, "zero amount rejected");
  ok(!U.addEntry(d, c.id, { type: "credit", amount: "-5" }).ok, "negative amount rejected");
  ok(!U.addEntry(d, c.id, { type: "credit", amount: "1e3" }).ok, "exponent amount rejected");
  ok(!U.addEntry(d, c.id, { type: "credit", amount: "10.555" }).ok, "3-decimal amount rejected");
  ok(!U.addEntry(d, c.id, { type: "credit", amount: "1000001" }).ok, "amount over ₹10 lakh rejected");
  ok(!U.addEntry(d, c.id, { type: "gift", amount: "10" }).ok, "unknown entry type rejected");
  ok(!U.addEntry(d, c.id, { type: "credit", amount: "10", note: "x".repeat(81) }).ok, "note over 80 chars rejected");
  ok(!U.addEntry(d, "nope", { type: "credit", amount: "10" }).ok, "entry for unknown customer rejected");
  U.addEntry(d, c.id, { type: "credit", amount: "850", note: "Ration", date: "2026-10-01T10:00:00Z" });
  U.addEntry(d, c.id, { type: "payment", amount: "500", date: "2026-10-10T10:00:00Z" });
  const e3 = U.addEntry(d, c.id, { type: "credit", amount: "120.10", date: "2026-10-20T10:00:00Z" });
  eq(U.balance(c), 47010, "balance in paise: 850 - 500 + 120.10 = 470.10");
  eq(U.rupees(U.balance(c)), "₹470.10", "balance formatted");
  eq(U.ledger(c).map((e) => e.balance), [85000, 35000, 47010], "running balance after each entry");
  U.addEntry(d, c.id, { type: "credit", amount: "0.1" });
  U.addEntry(d, c.id, { type: "credit", amount: "0.2" });
  eq(U.balance(c), 47040, "no floating-point drift (0.1 + 0.2)");
  ok(U.deleteEntry(d, c.id, e3.entry.id) && U.balance(c) === 35030, "delete entry recalculates balance");
  U.addEntry(d, r2.customer.id, { type: "payment", amount: "50" });
  const sm = U.summary(d);
  ok(sm.customers === 2 && sm.due === 35030 && sm.dueCount === 1 && sm.advance === 5000, "summary: total due, customers with dues, advance");
  const msg = U.reminderMessage(c, "Sharma Kirana");
  ok(/नमस्ते Ramesh Kumar जी/.test(msg) && msg.indexOf("₹350.30") >= 0 && msg.indexOf("Sharma Kirana") >= 0, "Hindi reminder has name, amount and shop");
  const url = U.reminderUrl(c, "Sharma Kirana");
  ok(url.indexOf("https://wa.me/919876543210?text=") === 0, "reminder goes to the customer's number with 91");
  eq(decodeURIComponent(url.split("?text=")[1]), msg, "reminder text URL-encoded exactly");
  ok(U.reminderUrl(r2.customer, "").indexOf("https://wa.me/?text=") === 0, "no number: WhatsApp lets the shopkeeper pick the contact");
  ok(U.save(d) && store[U.KEY], "saved to LocalStorage key " + U.KEY);
  const back = U.load();
  ok(back.customers.length === 2 && U.balance(back.customers[0]) === 35030, "loads back identically");
  /* CSV */
  U.addCustomer(back, { name: "Mohan" });
  back.customers[0].entries[0].note = "=HYPERLINK(\"x\")";
  back.customers[0].entries[1].note = "dal, chawal \"loose\"";
  const csv = U.toCSV(back);
  ok(csv.charCodeAt(0) === 0xfeff, "CSV starts with a BOM (Excel shows Hindi)");
  ok(csv.split("\r\n")[0].indexOf("Customer,Phone,Date,Type") === 1, "CSV header row");
  ok(csv.indexOf("'=HYPERLINK") >= 0 && csv.indexOf(",=HYPERLINK") < 0, "formula cells neutralised (CSV injection)");
  ok(csv.indexOf('"dal, chawal ""loose"""') >= 0, "commas and quotes escaped");
  ok(csv.indexOf("सुनीता देवी") >= 0 && /Mohan,,,,,,0.00/.test(csv), "Hindi names kept; customer without entries listed");
  /* corrupt storage */
  store[U.KEY] = "{not json";
  eq(U.load().customers.length, 0, "corrupt storage -> empty khata, no crash");
  store[U.KEY] = JSON.stringify({ customers: [{ name: "", entries: [] }, { id: "a", name: "Ok Name", phone: "123", entries: [{ type: "credit", amount: -5 }, { type: "credit", amount: 500 }] }] });
  const s2 = U.load();
  ok(s2.customers.length === 1 && s2.customers[0].phone === "" && s2.customers[0].entries.length === 1, "invalid customers/entries dropped on load");
  ok(U.deleteCustomer(s2, "a") && s2.customers.length === 0, "delete customer");
  const sample = U.sampleData();
  ok(sample.customers.length === 3 && sample.customers.every((x) => /sample/i.test(x.name)), "sample data clearly marked sample");
}

/* ---------------------------------------------------------------- */
console.log("Landing page: WhatsApp links and texts");
function siteWindow(cfg, attrs) {
  const m = memStore();
  const win = {
    localStorage: m.api,
    document: {
      readyState: "complete",
      documentElement: { lang: "en" },
      body: { getAttribute: (k) => (attrs || {})[k] || null },
      querySelectorAll: () => [], querySelector: () => null, getElementById: () => null, addEventListener() {}
    },
    setTimeout, clearTimeout, console
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(read("assets/js/site-config.js"), win);
  if (cfg) Object.assign(win.KS_SITE, cfg);
  vm.runInContext(read("assets/js/site-i18n.js"), win);
  vm.runInContext(read("assets/js/site.js"), win);
  return win;
}
{
  const win = siteWindow();
  const A = win.KS_SITE_API;
  eq(win.KS_SITE.ownerWhatsApp, "91XXXXXXXXXX", "site-config ships the placeholder owner number");
  eq(A.waUrl("demo"), null, "placeholder number -> no WhatsApp link (shows notice)");
  eq(A.normalizeNumber("9876543210"), "919876543210", "10-digit number gets 91");
  eq(A.normalizeNumber("+91 98765-43210"), "919876543210", "spaces, + and dashes removed");
  eq(A.normalizeNumber("911234567890"), null, "Indian number must start 6-9");
  eq(A.normalizeNumber("91XXXXXXXXXX"), null, "placeholder rejected");
  const w2 = siteWindow({ ownerWhatsApp: "919876543210" });
  const u = w2.KS_SITE_API.waUrl("demo");
  ok(u.indexOf("https://wa.me/919876543210?text=") === 0, "real number -> wa.me link");
  const text = decodeURIComponent(u.split("?text=")[1]);
  ok(text.indexOf("DEMO") === 0 && /Dukaan ka naam/.test(text), "prefilled message starts with DEMO and asks for shop name");
  ok(!/\{city\}/.test(text), "no unfilled {city} placeholder");
  const w3 = siteWindow({ ownerWhatsApp: "9876543210" }, { "data-city": "Kanpur" });
  ok(/Shehar: Kanpur/.test(decodeURIComponent(w3.KS_SITE_API.waUrl("city").split("?text=")[1])), "city pages add the city to the message");
  w3.KS_SITE_API.setLang("hi");
  ok(/दुकान का नाम/.test(decodeURIComponent(w3.KS_SITE_API.waUrl("demo").split("?text=")[1])), "Hindi page sends the Hindi message");
  ok(/^AGENCY/.test(decodeURIComponent(w3.KS_SITE_API.waUrl("agency").split("?text=")[1])), "agency button sends AGENCY message");
  const D = win.KS_SITE_I18N;
  eq(Object.keys(D.en).sort(), Object.keys(D.hi).sort(), "site texts: English and Hindi keys match");
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  ok(Object.keys(D.en).every((k) => ph(D.en[k]) === ph(D.hi[k])), "site texts: same {placeholders} in both languages");
  ok(Object.keys(D.hi).filter((k) => /^l\.(hero|faq|price|how)\./.test(k)).every((k) => /[\u0900-\u097F]/.test(D.hi[k]) || /^[₹\d\s.,+%·-]+$/.test(D.hi[k])), "Hindi texts are written in Devanagari");
  ok(D.en["l.hero.title"] === "Apni dukaan ki website, 1 din mein. WhatsApp pe order. Koi commission nahi.", "hero headline exactly as briefed");
  ["₹999", "₹149", "₹99", "₹199", "₹1,499", "₹2,999", "₹499"].forEach((p) => ok(read("index.html").indexOf(p) >= 0, "landing shows price " + p));
}

/* ---------------------------------------------------------------- */
console.log("QR poster");
{
  const win = { document: { readyState: "loading", addEventListener() {}, createElementNS() { return {}; } }, location: { search: "" }, console, URL };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(read("assets/vendor/qrcode-generator/qrcode.js"), win, { filename: "qrcode.js" });
  vm.runInContext(read("assets/js/qr-poster.js"), win, { filename: "qr-poster.js" });
  const Q = win.KS_QR;
  eq(Q.cleanUrl("https://shop.example.in/store/?shop=mithai"), "https://shop.example.in/store/?shop=mithai", "https link accepted");
  eq(Q.cleanUrl("shop.example.in"), "https://shop.example.in/", "missing https:// added");
  eq(Q.cleanUrl("javascript:alert(1)"), null, "javascript: link rejected");
  eq(Q.cleanUrl("ftp://x.in"), null, "non-web link rejected");
  eq(Q.cleanUrl("not a url"), null, "text with spaces rejected");
  eq(Q.cleanUrl("https://" + "a".repeat(300) + ".in"), null, "very long link rejected");
  const url = "https://anisgupta01.github.io/kirana-smart/store/?shop=mithai";
  const m = Q.qrMatrix(url);
  ok(m.length >= 21 && m.length <= 177 && m.every((r) => r.length === m.length), "QR matrix is square (" + m.length + " modules)");
  ok(m[0][0] && m[0][6] && m[6][0] && !m[7][7], "QR has finder pattern corners");
  let jsQR = null;
  try { jsQR = require("jsqr"); } catch (e) { /* optional */ }
  if (jsQR) {
    const scale = 6, quiet = 4, n = m.length, size = (n + quiet * 2) * scale;
    const px = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) {
      for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
        const i = (((r + quiet) * scale + y) * size + ((c + quiet) * scale + x)) * 4;
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
    }
    const res = jsQR(px, size, size);
    eq(res && res.data, url, "QR decodes back to the exact shop link (jsqr)");
  } else {
    console.log("  SKIP  QR decode check (npm i jsqr to enable)");
  }
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
