/* Logic tests - plain Node, no installs needed.
   Run:  node tests/logic.test.js
   Loads the real project scripts into a fake browser window with an
   in-memory LocalStorage and checks the business logic. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name); }
}
function eq(a, b, name) {
  const same = JSON.stringify(a) === JSON.stringify(b);
  if (!same) console.log("        expected " + JSON.stringify(b) + " got " + JSON.stringify(a));
  ok(same, name);
}

function readShop(id) { return JSON.parse(fs.readFileSync(path.join(root, "store/shops", id + ".json"), "utf8")); }

function makeWindow(config, shopId) {
  const store = {};
  const win = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    document: { documentElement: { lang: "en", style: { setProperty() {} }, getAttribute: () => null }, querySelectorAll: () => [], querySelector: () => null },
    navigator: {},
    setTimeout, console
  };
  win.window = win;
  win.global = win;
  vm.createContext(win);
  ["i18n.js", "common.js", "cart.js"].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(root, "assets/js", f), "utf8"), win, { filename: f });
  });
  /* the kirana demo shop: store/shops/kirana.json (what shop-loader.js fetches) */
  win.KS.applyShop(readShop(shopId || "kirana"));
  if (config) Object.assign(win.KS_CONFIG, config);
  return { win, store };
}

console.log("Product data");
{
  const { win } = makeWindow();
  const KS = win.KS;
  const raw = win.KS_DEFAULT_PRODUCTS;
  ok(raw.length >= 24, "at least 24 demo products (" + raw.length + ")");
  const ids = new Set(raw.map((p) => p.id));
  eq(ids.size, raw.length, "product ids are unique");
  ok(raw.every((p) => p.price > 0 && Number.isInteger(p.stock) && p.stock >= 0), "prices positive, stock whole numbers");
  eq(KS.getProducts().length, raw.length, "all demo products pass sanitising");
  const cats = new Set(raw.map((p) => p.category));
  ok(KS.CATEGORIES.every((c) => cats.has(c)), "every required category has products");
  ok(raw.every((p) => p.name && p.unit && "available" in p && "image" in p), "each product has name, unit, availability, image field");
  ok(raw.some((p) => p.stock === 0) && raw.some((p) => p.stock > 0 && p.stock <= 5), "demo data includes out-of-stock and low-stock items");
}

console.log("Validation");
{
  const KS = makeWindow().win.KS;
  ok(KS.validatePhone("9876543210").ok, "valid 10-digit phone");
  eq(KS.validatePhone("+91 98765 43210").value, "9876543210", "phone with +91 and spaces normalised");
  eq(KS.validatePhone("098765 43210").value, "9876543210", "phone with leading 0 normalised");
  ok(!KS.validatePhone("1234567890").ok, "phone starting with 1 rejected");
  ok(!KS.validatePhone("98765").ok, "short phone rejected");
  ok(!KS.validatePhone("98765abc10").ok, "phone with letters rejected");
  ok(!KS.validatePhone("").ok, "empty phone rejected");
  ok(KS.validateName("Anish Gupta").ok, "normal name accepted");
  ok(KS.validateName("अनिश गुप्ता").ok, "Hindi name accepted");
  ok(!KS.validateName("A").ok, "1-letter name rejected");
  ok(!KS.validateName("<script>alert(1)</script>").ok, "name with HTML rejected");
  ok(!KS.validateName("12345").ok, "numeric name rejected");
  ok(KS.validateAddress("House 1, Main Road, City").ok, "address accepted");
  ok(!KS.validateAddress("short").ok, "short address rejected");
  ok(!KS.validateNotes("x".repeat(201)).ok, "notes over 200 chars rejected");
  ok(KS.validateNotes("").ok, "empty notes allowed");
  eq(KS.normalizeStoreNumber("919876543210"), "919876543210", "store number with 91 accepted");
  eq(KS.normalizeStoreNumber("9876543210"), "919876543210", "10-digit store number gets 91");
  eq(KS.normalizeStoreNumber("91XXXXXXXXXX"), null, "placeholder store number rejected");
  eq(KS.normalizeStoreNumber(""), null, "empty store number rejected");
  eq(KS.normalizeStoreNumber("12345"), null, "too-short store number rejected");
  eq(KS.normalizeStoreNumber("911234567890"), null, "Indian number not starting 6-9 rejected");
  eq(KS.parseMoney("45.50"), 45.5, "parseMoney decimal");
  eq(KS.parseMoney("-5"), null, "parseMoney negative rejected");
  eq(KS.parseMoney("1e3"), null, "parseMoney exponent rejected");
  eq(KS.parseMoney("1.234"), null, "parseMoney 3 decimals rejected");
  eq(KS.parseMoney(""), null, "parseMoney empty rejected");
}

console.log("Product input validation");
{
  const KS = makeWindow().win.KS;
  const good = { name: "Test Rice", nameHi: "", category: "rice", price: "99.50", mrp: "120", unit: "1 kg", stock: "10", image: "", available: true };
  ok(KS.validateProductInput(good).ok, "valid product accepted");
  ok(!KS.validateProductInput(Object.assign({}, good, { price: "-1" })).ok, "negative price rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { price: "0" })).ok, "zero price rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { price: "abc" })).ok, "text price rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { stock: "-3" })).ok, "negative stock rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { stock: "2.5" })).ok, "fractional stock rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { mrp: "50" })).ok, "MRP below price rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { name: " " })).ok, "blank name rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { category: "weapons" })).ok, "unknown category rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { image: "javascript:alert(1)" })).ok, "javascript: image rejected");
  ok(!KS.validateProductInput(Object.assign({}, good, { image: "http://insecure.example/x.png" })).ok, "http image rejected");
  ok(KS.validateProductInput(Object.assign({}, good, { image: "https://example.com/a.png" })).ok, "https image accepted");
  ok(KS.validateProductInput(Object.assign({}, good, { image: "assets/images/x.png" })).ok, "local image accepted");
  ok(!KS.validateProductInput(Object.assign({}, good, { image: "assets/images/../../x" })).ok, "path traversal image rejected");
}

console.log("Totals (no floating point drift)");
{
  const KS = makeWindow().win.KS;
  const s = { deliveryFee: 20, freeDeliveryAbove: 500 };
  const lines = [{ price: 0.1, qty: 3 }, { price: 0.2, qty: 1 }];
  eq(KS.calcTotals(lines, "pickup", s).subtotal, 0.5, "0.1*3 + 0.2 = 0.5 exactly");
  eq(KS.calcTotals([{ price: 235, qty: 2 }], "delivery", s).total, 490, "delivery fee added under free limit");
  eq(KS.calcTotals([{ price: 235, qty: 2 }], "delivery", s).delivery, 20, "delivery fee value");
  eq(KS.calcTotals([{ price: 250, qty: 2 }], "delivery", s).delivery, 0, "free delivery at threshold");
  eq(KS.calcTotals([{ price: 250, qty: 2 }], "delivery", s).freeDelivery, true, "free delivery flag set");
  eq(KS.calcTotals([{ price: 100, qty: 1 }], "pickup", s).total, 100, "no fee for pickup");
  eq(KS.calcTotals([], "delivery", s).total, 0, "empty cart totals zero");
  eq(KS.calcTotals([{ price: 99.99, qty: 3 }], "pickup", { deliveryFee: 0, freeDeliveryAbove: 0 }).subtotal, 299.97, "99.99 x 3");
  eq(KS.money(1234.5), "₹1,234.50", "money formatting with paise");
  eq(KS.money(1234), "₹1,234", "money formatting whole");
}

console.log("Cart");
{
  const { win, store } = makeWindow();
  const KS = win.KS;
  const c = KS.cart;
  eq(c.count(), 0, "cart starts empty");
  ok(c.add("p001").ok, "add product");
  eq(c.qty("p001"), 1, "qty 1 after add");
  c.setQty("p001", 3);
  eq(c.qty("p001"), 3, "setQty 3");
  const r = c.setQty("p001", 9999);
  ok(!r.ok && r.reason === "max", "cannot exceed stock");
  eq(c.qty("p001"), KS.getProduct("p001").stock, "quantity clamped to stock");
  c.setQty("p001", 2);
  c.setQty("p001", 0);
  eq(c.qty("p001"), 0, "qty 0 removes item");
  ok(!c.add("p012").ok, "out-of-stock product cannot be added");
  ok(!c.add("nope").ok, "unknown product cannot be added");
  c.add("p008");
  for (let i = 0; i < 10; i++) c.add("p008");
  eq(c.qty("p008"), 4, "add stops at stock of 4");
  c.add("p001");
  c.add("p001");
  eq(c.count(), 6, "count sums quantities");
  const lines = c.lines();
  const sub = c.totals("pickup", KS.getSettings()).subtotal;
  eq(sub, 4 * 38 + 2 * 235, "cart subtotal correct");
  eq(lines.length, 2, "two cart lines");
  ok(JSON.parse(store.ks_cart_v1).length === 2, "cart saved in LocalStorage");
  c.load();
  eq(c.count(), 6, "cart reloads from LocalStorage");
  /* stock drops below cart quantity */
  const prods = KS.getProducts().map((p) => (p.id === "p008" ? Object.assign({}, p, { stock: 2 }) : p));
  KS.saveProducts(prods);
  ok(c.reconcile(), "reconcile detects stock change");
  eq(c.qty("p008"), 2, "quantity reduced to new stock");
  KS.saveProducts(KS.getProducts().map((p) => (p.id === "p008" ? Object.assign({}, p, { available: false }) : p)));
  c.reconcile();
  eq(c.qty("p008"), 0, "unavailable product removed from cart");
  store.ks_cart_v1 = JSON.stringify([{ id: "p001", qty: -5 }, { id: "p001", qty: 1.5 }, { id: 5 }, { id: "p003", qty: 2 }]);
  c.load();
  eq(c.count(), 2, "corrupt cart entries ignored");
  c.clear();
  eq(c.count(), 0, "clear empties cart");
}

console.log("C1: fresh shop JSON beats a returning visitor's stored copy");
{
  /* Reproduces the Phase 0 probe: a visitor loads mithai, the owner then
     changes Kaju Katli from Rs 560 to Rs 671 and marks it out of stock. */
  const shopV1 = readShop("mithai");
  const kaju = shopV1.products.find((p) => /kaju katli/i.test(p.name));
  ok(!!kaju && kaju.price === 560, "mithai has Kaju Katli at Rs 560 (" + (kaju && kaju.price) + ")");
  const { win, store } = makeWindow(null, "mithai");
  let KS = win.KS;
  ok(KS.cart.add(kaju.id).ok, "visit 1: Kaju Katli added to cart at Rs 560");
  eq(KS.getProduct(kaju.id).price, 560, "visit 1: price Rs 560");
  ok(typeof store.ks_mithai_products_v1 === "string", "visit 1: products copied to LocalStorage");

  /* visit 2, price change only (still in stock) */
  const shopV2 = JSON.parse(JSON.stringify(shopV1));
  shopV2.products.find((p) => p.id === kaju.id).price = 671;
  shopV2.products.find((p) => p.id === kaju.id).mrp = null;
  ok(KS.fingerprint(shopV2) !== KS.fingerprint(shopV1), "changed JSON gets a new fingerprint");
  KS.applyShop(shopV2);
  KS.cart.load();
  eq(KS.getProduct(kaju.id).price, 671, "visit 2: returning visitor sees Rs 671, not the stored Rs 560");
  const r1 = KS.cart.reconcile();
  ok(r1 && r1.repriced.length === 1 && r1.repriced[0].from === 560 && r1.repriced[0].to === 671, "visit 2: cart flags the price change 560 -> 671");
  eq(KS.cart.lines()[0].line, 671, "visit 2: cart line uses Rs 671");
  const msg = KS.buildOrderMessage({ id: "KS-1", createdAt: "2026-11-02T10:00:00Z", customerName: "Test", phone: "", type: "pickup", address: "", notes: "", items: KS.cart.lines().map((l) => ({ name: l.product.name, unit: l.product.unit, price: l.product.price, qty: l.qty })), subtotal: 671, deliveryFee: 0, total: 671 }, KS.getSettings());
  ok(msg.includes("671") && !msg.includes("560"), "visit 2: WhatsApp order uses Rs 671");
  ok(KS.cart.reconcile() === false, "second reconcile: nothing new to flag");

  /* visit 3, out of stock */
  const shopV3 = JSON.parse(JSON.stringify(shopV2));
  Object.assign(shopV3.products.find((p) => p.id === kaju.id), { available: false, stock: 0 });
  KS.applyShop(shopV3);
  KS.cart.load();
  eq(KS.productStatus(KS.getProduct(kaju.id), KS.getSettings()), "unavailable", "visit 3: Kaju Katli shows as unavailable");
  ok(!KS.cart.add(kaju.id).ok, "visit 3: cannot add Kaju Katli to the cart");
  const r2 = KS.cart.reconcile();
  ok(r2 && r2.removed.length === 1 && r2.removed[0].id === kaju.id, "visit 3: out-of-stock item removed from cart and flagged");
  eq(KS.cart.count(), 0, "visit 3: nothing left to check out");

  /* old (pre-fix) LocalStorage format: a plain array is treated as stale */
  store.ks_mithai_products_v1 = JSON.stringify(shopV1.products);
  KS.invalidateCaches();
  eq(KS.getProduct(kaju.id).price, 671, "old plain-array LocalStorage copy is ignored");

  /* setup-tool edits survive while the JSON is unchanged (demo shops) */
  KS.saveProducts(KS.getProducts().map((p) => (p.id === kaju.id ? Object.assign({}, p, { price: 600 }) : p)));
  KS.invalidateCaches();
  eq(KS.getProduct(kaju.id).price, 600, "demo shop: local setup-tool edit kept while JSON unchanged");
  KS.applyShop(shopV2);
  eq(KS.getProduct(kaju.id).price, 671, "demo shop: a newer JSON replaces the local edit");
}

console.log("C1: live shops (demo:false) never use local product/settings edits");
{
  const live = Object.assign(readShop("mithai"), { demo: false });
  const { win, store } = makeWindow(null, "mithai");
  const KS = win.KS;
  KS.applyShop(live);
  const first = live.products[0];
  store.ks_mithai_products_v1 = JSON.stringify({ src: KS.shop.src, products: live.products.map((p) => Object.assign({}, p, { price: 1 })) });
  store.ks_mithai_settings_v1 = JSON.stringify({ storeName: "Hacked", whatsappNumber: "919999999999", _src: KS.shop.src });
  KS.invalidateCaches();
  eq(KS.getProduct(first.id).price, first.price, "live shop: storefront ignores a LocalStorage price edit");
  eq(KS.getSettings().whatsappNumber, live.whatsappNumber, "live shop: storefront ignores a LocalStorage WhatsApp number");
  KS.setupTool = true;
  KS.invalidateCaches();
  eq(KS.getProduct(first.id).price, 1, "live shop: the setup tool still edits its local copy");
}

console.log("Storage resilience");
{
  const { win, store } = makeWindow();
  store.ks_products_v1 = "{not json";
  win.KS.invalidateCaches();
  eq(win.KS.getProducts().length, win.KS_DEFAULT_PRODUCTS.length, "corrupt product JSON falls back to defaults");
  store.ks_products_v1 = JSON.stringify({ src: win.KS.shop.src, products: [{ id: "x", name: "Bad", category: "rice", price: -5, unit: "1", stock: 1 }, { id: "ok1", name: "Fine", category: "rice", price: 5, unit: "1 kg", stock: 1 }] });
  win.KS.invalidateCaches();
  eq(win.KS.getProducts().map((p) => p.id), ["ok1"], "invalid stored products dropped");
  store.ks_settings_v1 = JSON.stringify({ storeName: "X", deliveryFee: -50, lowStockThreshold: "abc", _src: win.KS.shop.src });
  win.KS.invalidateCaches();
  const s = win.KS.getSettings();
  eq(s.storeName.length >= 2, true, "short stored shop name ignored");
  eq(s.deliveryFee, win.KS_CONFIG.deliveryFee, "invalid stored fee falls back to config");
}

console.log("WhatsApp message and URL");
{
  const { win } = makeWindow();
  const KS = win.KS;
  const settings = Object.assign(KS.getSettings(), { storeName: "Sharma Kirana Store (Demo)" });
  const order = {
    id: "KS-261010-AB23", createdAt: "2026-10-10T10:00:00.000Z", customerName: "Anish Gupta", phone: "9876543210",
    type: "delivery", address: "12 Main Road & Co, Lucknow", notes: "Call me #1 & ring bell 100%",
    items: [{ name: "Whole Wheat Atta", unit: "5 kg", price: 235, qty: 2 }, { name: "Eggs", unit: "12 pcs", price: 84, qty: 1 }],
    subtotal: 554, deliveryFee: 0, total: 554
  };
  const msg = KS.buildOrderMessage(order, settings);
  ["Sharma Kirana Store (Demo)", "KS-261010-AB23", "Anish Gupta", "9876543210", "Whole Wheat Atta", "x 2", "₹470", "Subtotal: ₹554", "Total: ₹554", "Home delivery", "12 Main Road & Co, Lucknow", "Call me #1 & ring bell 100%", "no online payment"]
    .forEach((needle) => ok(msg.indexOf(needle) >= 0, "message contains: " + needle));
  const pick = KS.buildOrderMessage(Object.assign({}, order, { type: "pickup", address: "", notes: "", deliveryFee: 0 }), settings);
  ok(pick.indexOf("Store pickup") >= 0 && pick.indexOf("Address:") < 0, "pickup message has no address line");
  ok(pick.indexOf("Notes: None") >= 0, "empty notes shown as None");
  const url = KS.buildWhatsAppUrl("919876543210", msg);
  ok(url.indexOf("https://wa.me/919876543210?text=") === 0, "wa.me URL prefix");
  const text = url.split("?text=")[1];
  ok(!/[ \n&#]/.test(text), "encoded text has no raw spaces, newlines, & or #");
  eq(decodeURIComponent(text), msg, "URL decodes back to the exact message");
  ok(KS.newOrderRef().match(/^KS-\d{6}-[A-Z2-9]{4}$/) !== null, "order reference format");
  ok(KS.newOrderRef() !== KS.newOrderRef(), "order references differ");
}

console.log("Sample orders and reset");
{
  const { win, store } = makeWindow();
  const KS = win.KS;
  const orders = KS.getOrders();
  eq(orders.length, win.KS_SAMPLE_ORDER_DEFS.length, "sample orders created");
  ok(orders.every((o) => o.sample && o.items.length > 0 && o.total > 0), "sample orders have items and totals");
  eq(Array.from(new Set(orders.map((o) => o.status))).sort(), ["Accepted", "Cancelled", "Completed", "Pending", "Ready"], "all five statuses present in samples");
  ok(orders.every((o) => /X/.test(o.phone)), "sample phone numbers are masked placeholders");
  const o4 = orders.find((o) => o.id === "DEMO-1004");
  eq(o4.total, o4.subtotal + o4.deliveryFee, "sample order total = subtotal + delivery");
  KS.cart.add("p001");
  KS.saveProducts([]);
  KS.saveOrders([]);
  KS.saveSettings({ storeName: "Changed Shop", deliveryFee: 99 });
  KS.resetDemoData();
  KS.invalidateCaches();
  eq(KS.getProducts().length, win.KS_DEFAULT_PRODUCTS.length, "reset restores products");
  eq(KS.getOrders().length, win.KS_SAMPLE_ORDER_DEFS.length, "reset restores sample orders");
  eq(KS.getSettings().storeName, win.KS_CONFIG.storeName, "reset restores settings");
  eq(KS.cart.qty("p001"), 1, "reset does not touch the cart");
}

console.log("Language files");
{
  const { win } = makeWindow();
  const en = Object.keys(win.KS_I18N.en).sort();
  const hi = Object.keys(win.KS_I18N.hi).sort();
  eq(hi.filter((k) => en.indexOf(k) < 0), [], "no Hindi keys missing in English");
  eq(en.filter((k) => hi.indexOf(k) < 0), [], "no English keys missing in Hindi");
  const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(",");
  const bad = en.filter((k) => placeholders(win.KS_I18N.en[k]) !== placeholders(win.KS_I18N.hi[k]));
  eq(bad, [], "placeholders match in both languages");
  ok(win.KS_DEFAULT_PRODUCTS.every((p) => p.nameHi), "every demo product has a Hindi name");
  const KS = win.KS;
  KS.setLang("hi");
  ok(KS.t("cart.title") !== win.KS_I18N.en["cart.title"], "Hindi text differs from English");
  eq(KS.t("cart.open", { n: 3 }).indexOf("3") >= 0, true, "placeholder filled in Hindi");
  eq(KS.t("no.such.key"), "no.such.key", "missing key returns the key");
  KS.setLang("en");
  eq(win.localStorage.getItem("ks_lang_v1"), "en", "language saved");
}

console.log("Settings validation");
{
  const KS = makeWindow().win.KS;
  const good = { storeName: "Gupta Store", storeLocation: "Lucknow", whatsappNumber: "9876543210", deliveryFee: "25", freeDeliveryAbove: "600", lowStockThreshold: "4", deliveryNote: "Within 3 km" };
  const r = KS.validateSettingsInput(good);
  ok(r.ok, "valid settings accepted");
  eq(r.value.whatsappNumber, "919876543210", "10-digit WhatsApp number normalised to 91...");
  ok(!KS.validateSettingsInput(Object.assign({}, good, { deliveryFee: "-1" })).ok, "negative delivery fee rejected");
  ok(!KS.validateSettingsInput(Object.assign({}, good, { whatsappNumber: "12" })).ok, "bad WhatsApp number rejected");
  ok(!KS.validateSettingsInput(Object.assign({}, good, { storeName: "" })).ok, "empty shop name rejected");
  ok(KS.validateSettingsInput(Object.assign({}, good, { whatsappNumber: "" })).ok, "empty WhatsApp number allowed (shows setup error at checkout)");
}

console.log("Pro upgrade: optional phone, honest order footer, shop export, registry");
{
  const { win } = makeWindow();
  const KS = win.KS;
  ok(KS.validatePhoneOptional("").ok && KS.validatePhoneOptional("").value === "", "empty phone allowed at checkout (optional)");
  ok(KS.validatePhoneOptional("   ").ok, "blank phone allowed at checkout");
  eq(KS.validatePhoneOptional("+91 98765 43210").value, "9876543210", "typed phone still normalised");
  ok(!KS.validatePhoneOptional("12345").ok, "typed but invalid phone still rejected");
  const settings = Object.assign(KS.getSettings(), { storeName: "Sharma Kirana Store (Demo)" });
  const order = { id: "KS-261102-AB23", createdAt: "2026-11-02T10:00:00Z", customerName: "Ravi", phone: "", type: "delivery", address: "House 12, Aminabad, Lucknow", notes: "",
    items: [{ name: "Whole Wheat Atta", unit: "5 kg", price: 235, qty: 3 }], subtotal: 705, deliveryFee: 0, total: 705 };
  const msg = KS.buildOrderMessage(order, settings);
  ok(msg.indexOf("Phone:") < 0, "no phone line when the customer leaves it empty");
  ok(msg.indexOf("Whole Wheat Atta (5 kg) x 3 = ₹705") >= 0, "item line has qty and line total");
  ok(/demo store/i.test(msg), "demo shop: message says it came from a demo store");
  win.KS_CONFIG.demo = false;
  const real = KS.buildOrderMessage(order, Object.assign({}, settings, { storeName: "Gupta General Store" }));
  ok(real.indexOf("Sent from the Gupta General Store website.") >= 0 && !/demo/i.test(real), "real shop (demo:false): no demo wording in the order");
  win.KS_CONFIG.demo = true;
  const orig = readShop("kirana");
  const list = KS.getProducts(); list[0].price = 250; list[1].available = false; KS.saveProducts(list);
  const ex = KS.buildShopExport(orig);
  ok(ex.id === "kirana" && ex.products.length === orig.products.length, "export keeps every product");
  ok(ex.products[0].price === 250 && ex.products[1].available === false, "export contains local edits (price, availability)");
  ok(JSON.stringify(ex.categories) === JSON.stringify(orig.categories) && ex.colors.brand === orig.colors.brand, "export keeps categories and branding");
  ok(orig.products[0].price !== 250, "export does not mutate the original shop object");
  const reg = JSON.parse(fs.readFileSync(path.join(root, "store/shops/shops.json"), "utf8"));
  const files = fs.readdirSync(path.join(root, "store/shops")).filter((f) => f.endsWith(".json") && f !== "shops.json").map((f) => f.replace(".json", "")).sort();
  eq(reg.shops.map((x) => x.id).sort(), files, "shops.json registry lists exactly the shop files");
  reg.shops.forEach((x) => { const j = readShop(x.id); ok(j.id === x.id && (j.demo !== false) === !!x.demo && /^91[6-9]\d{9}$/.test(j.whatsappNumber), "registry entry " + x.id + " matches its file (id, demo flag, WhatsApp number)"); });
  reg.shops.forEach((x) => { const j = readShop(x.id); ok(j.products.every((p) => typeof p.available === "boolean" && Number.isInteger(p.stock)), x.id + ": every product has an available flag and a whole-number stock"); });
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
