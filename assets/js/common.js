/* ============================================================
   KIRANA SMART - SHARED HELPERS
   Storage, validation, money, WhatsApp message, translations,
   and small UI helpers (toast, modal, confirm).
   No dynamic code execution, and user text is ALWAYS inserted with textContent.
   ============================================================ */
(function (global) {
  "use strict";

  var KS = (global.KS = global.KS || {});
  /* Shop settings come from store/shops/<id>.json (see KS.applyShop).
     Read lazily so the JSON can arrive after this file has loaded. */
  function cfg() { return global.KS_CONFIG || {}; }
  var doc = global.document;

  var KEYS = {
    products: "ks_products_v1",
    orders: "ks_orders_v1",
    settings: "ks_settings_v1",
    cart: "ks_cart_v1",
    lang: "ks_lang_v1"
  };
  KS.KEYS = KEYS;
  /* Default (kirana) categories. A shop JSON replaces these in place. */
  KS.CATEGORIES = ["atta", "rice", "dal", "oil", "dairy", "snacks", "beverages", "personal", "cleaning"];
  KS.ORDER_STATUSES = ["Pending", "Accepted", "Ready", "Completed", "Cancelled"];

  /* ---------------------------------------------------------
     Safe LocalStorage (falls back to memory if blocked)
     --------------------------------------------------------- */
  var memoryStore = {};
  KS.storageWorks = true;

  function lsGet(key) {
    try {
      var v = global.localStorage.getItem(key);
      return v === null ? null : v;
    } catch (e) {
      KS.storageWorks = false;
      return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
    }
  }
  function lsSet(key, val) {
    try {
      global.localStorage.setItem(key, val);
      return true;
    } catch (e) {
      KS.storageWorks = false;
      memoryStore[key] = val;
      return false;
    }
  }
  function lsRemove(key) {
    try { global.localStorage.removeItem(key); } catch (e) { KS.storageWorks = false; }
    delete memoryStore[key];
  }
  function readJSON(key, fallback) {
    var raw = lsGet(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }
  function writeJSON(key, value) { return lsSet(key, JSON.stringify(value)); }
  KS.readJSON = readJSON;
  KS.writeJSON = writeJSON;
  KS.lsGet = lsGet;
  KS.lsSet = lsSet;

  /* ---------------------------------------------------------
     Text and number helpers
     --------------------------------------------------------- */
  function cleanText(v, max) {
    if (v === null || v === undefined) v = "";
    v = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (max && v.length > max) v = v.slice(0, max);
    return v;
  }
  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function toPaise(n) { return Math.round(Number(n) * 100); }
  KS.cleanText = cleanText;
  KS.round2 = round2;
  KS.toPaise = toPaise;

  /* Parses "45", "45.5", "45.50" -> number; anything else -> null */
  function parseMoney(v) {
    var s = String(v === null || v === undefined ? "" : v).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  KS.parseMoney = parseMoney;

  KS.money = function (n) {
    n = Number(n) || 0;
    var sym = cfg().currency || "₹";
    var whole = Math.abs(n - Math.round(n)) < 0.000001;
    var txt = whole
      ? Math.round(n).toLocaleString("en-IN")
      : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sym + txt;
  };

  function safeImageUrl(u) {
    u = cleanText(u, 300);
    if (!u) return "";
    if (/^https:\/\/[^\s"'<>()]+$/i.test(u)) return u;
    if (/^assets\/images\/[A-Za-z0-9_\-./]+$/.test(u) && u.indexOf("..") < 0) return u;
    return "";
  }
  KS.safeImageUrl = safeImageUrl;

  /* Pages inside a sub-folder (store/) set <html data-base="../"> so
     shared assets/... paths still resolve. */
  KS.asset = function (u) {
    var base = (doc && doc.documentElement && doc.documentElement.getAttribute && doc.documentElement.getAttribute("data-base")) || "";
    if (!/^(\.\.\/)*$/.test(base)) base = "";
    return /^assets\//.test(u) ? base + u : u;
  };

  /* ---------------------------------------------------------
     Products
     --------------------------------------------------------- */
  function sanitizeProduct(p) {
    if (!p || typeof p !== "object") return null;
    var id = cleanText(p.id, 40);
    var name = cleanText(p.name, 80);
    var price = Number(p.price);
    if (!id || !name || !isFinite(price) || price <= 0 || price > 100000) return null;
    if (KS.CATEGORIES.indexOf(p.category) < 0) return null;
    var mrp = p.mrp === undefined || p.mrp === null || p.mrp === "" ? null : Number(p.mrp);
    if (mrp !== null && (!isFinite(mrp) || mrp < price || mrp > 100000)) mrp = null;
    var stock = Math.floor(Number(p.stock));
    if (!isFinite(stock) || stock < 0) stock = 0;
    if (stock > 9999) stock = 9999;
    return {
      id: id,
      name: name,
      nameHi: cleanText(p.nameHi, 80),
      category: p.category,
      price: round2(price),
      mrp: mrp === null ? null : round2(mrp),
      unit: cleanText(p.unit, 30) || "1 pc",
      stock: stock,
      available: p.available !== false,
      featured: !!p.featured,
      popular: !!p.popular,
      image: safeImageUrl(p.image)
    };
  }
  KS.sanitizeProduct = sanitizeProduct;

  function defaultProducts() {
    return (global.KS_DEFAULT_PRODUCTS || []).map(sanitizeProduct).filter(Boolean);
  }

  var productsCache = null;
  var settingsCache = null;
  KS.invalidateCaches = function () { productsCache = null; settingsCache = null; };

  KS.getProducts = function () {
    if (productsCache) return productsCache;
    var raw = readJSON(KEYS.products, null);
    var list = null;
    if (Array.isArray(raw)) {
      list = [];
      var seen = {};
      raw.forEach(function (p) {
        var s = sanitizeProduct(p);
        if (s && !seen[s.id]) { seen[s.id] = true; list.push(s); }
      });
    }
    if (!list) {
      list = defaultProducts();
      writeJSON(KEYS.products, list);
    }
    productsCache = list;
    return list;
  };

  KS.saveProducts = function (list) {
    var seen = {};
    var clean = [];
    (list || []).forEach(function (p) {
      var s = sanitizeProduct(p);
      if (s && !seen[s.id]) { seen[s.id] = true; clean.push(s); }
    });
    productsCache = clean;
    writeJSON(KEYS.products, clean);
    return clean;
  };

  KS.getProduct = function (id) {
    var list = KS.getProducts();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  KS.nextProductId = function () {
    var max = 0;
    KS.getProducts().forEach(function (p) {
      var m = /^p(\d+)$/.exec(p.id);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var id;
    do { max += 1; id = "p" + String(max).padStart(3, "0"); } while (KS.getProduct(id));
    return id;
  };

  /* stock status: in | low | out | unavailable */
  KS.productStatus = function (p, settings) {
    var threshold = settings && isFinite(settings.lowStockThreshold) ? settings.lowStockThreshold : 5;
    if (!p.available) return "unavailable";
    if (p.stock <= 0) return "out";
    if (p.stock <= threshold) return "low";
    return "in";
  };

  /* ---------------------------------------------------------
     Settings (config.js defaults + optional local overrides)
     --------------------------------------------------------- */
  function numOr(v, d, min, max) {
    var n = Number(v);
    if (!isFinite(n) || n < min || n > max) return d;
    return n;
  }
  KS.defaultSettings = function () {
    return {
      storeName: cleanText(cfg().storeName, 60) || "My Kirana Store",
      storeLocation: cleanText(cfg().storeLocation, 100),
      whatsappNumber: cleanText(cfg().whatsappNumber, 30),
      deliveryFee: numOr(cfg().deliveryFee, 0, 0, 1000),
      freeDeliveryAbove: numOr(cfg().freeDeliveryAbove, 0, 0, 100000),
      lowStockThreshold: Math.floor(numOr(cfg().lowStockThreshold, 5, 0, 1000)),
      deliveryNote: cleanText(cfg().deliveryNote, 120),
      pickupNote: cleanText(cfg().pickupNote, 120)
    };
  };
  KS.getSettings = function () {
    if (settingsCache) return settingsCache;
    var d = KS.defaultSettings();
    var s = readJSON(KEYS.settings, null);
    if (s && typeof s === "object") {
      if (typeof s.storeName === "string" && cleanText(s.storeName, 60).length >= 2) d.storeName = cleanText(s.storeName, 60);
      if (typeof s.storeLocation === "string") d.storeLocation = cleanText(s.storeLocation, 100);
      if (typeof s.whatsappNumber === "string") d.whatsappNumber = cleanText(s.whatsappNumber, 30);
      d.deliveryFee = numOr(s.deliveryFee, d.deliveryFee, 0, 1000);
      d.freeDeliveryAbove = numOr(s.freeDeliveryAbove, d.freeDeliveryAbove, 0, 100000);
      d.lowStockThreshold = Math.floor(numOr(s.lowStockThreshold, d.lowStockThreshold, 0, 1000));
      if (typeof s.deliveryNote === "string") d.deliveryNote = cleanText(s.deliveryNote, 120);
    }
    settingsCache = d;
    return d;
  };
  KS.saveSettings = function (s) {
    settingsCache = null;
    writeJSON(KEYS.settings, s);
    return KS.getSettings();
  };

  /* ---------------------------------------------------------
     Totals (integer paise to avoid floating-point errors)
     --------------------------------------------------------- */
  KS.calcTotals = function (lines, type, settings) {
    var sub = 0;
    lines.forEach(function (l) { sub += toPaise(l.price) * l.qty; });
    var fee = 0;
    var free = false;
    var feeP = toPaise(settings.deliveryFee);
    var freeAbove = toPaise(settings.freeDeliveryAbove);
    if (type === "delivery" && sub > 0 && feeP > 0) {
      if (freeAbove > 0 && sub >= freeAbove) free = true;
      else fee = feeP;
    }
    return {
      subtotal: sub / 100,
      delivery: fee / 100,
      total: (sub + fee) / 100,
      freeDelivery: free,
      feeApplies: feeP > 0
    };
  };

  /* ---------------------------------------------------------
     Orders (dashboard demo data only)
     --------------------------------------------------------- */
  function sanitizeOrder(o) {
    if (!o || typeof o !== "object") return null;
    var id = cleanText(o.id, 40);
    if (!id) return null;
    var d = new Date(o.createdAt);
    var items = [];
    (Array.isArray(o.items) ? o.items : []).forEach(function (it) {
      if (!it) return;
      var price = Number(it.price);
      var qty = Math.floor(Number(it.qty));
      if (!isFinite(price) || price < 0 || !isFinite(qty) || qty < 1) return;
      items.push({ id: cleanText(it.id, 40), name: cleanText(it.name, 80), unit: cleanText(it.unit, 30), price: round2(price), qty: qty });
    });
    return {
      id: id,
      createdAt: isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(),
      customerName: cleanText(o.customerName, 60),
      phone: cleanText(o.phone, 20),
      type: o.type === "pickup" ? "pickup" : "delivery",
      address: cleanText(o.address, 250),
      notes: cleanText(o.notes, 200),
      status: KS.ORDER_STATUSES.indexOf(o.status) >= 0 ? o.status : "Pending",
      items: items,
      subtotal: round2(Number(o.subtotal) || 0),
      deliveryFee: round2(Number(o.deliveryFee) || 0),
      total: round2(Number(o.total) || 0),
      sample: o.sample !== false
    };
  }

  KS.makeSampleOrders = function (products, now) {
    products = products || defaultProducts();
    now = now || Date.now();
    var settings = KS.defaultSettings();
    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });
    var out = [];
    (global.KS_SAMPLE_ORDER_DEFS || []).forEach(function (def) {
      var items = [];
      def.items.forEach(function (pair) {
        var p = byId[pair[0]];
        if (p) items.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, qty: pair[1] });
      });
      var totals = KS.calcTotals(items, def.type, settings);
      out.push({
        id: "DEMO-" + (1000 + def.n),
        createdAt: new Date(now - def.minsAgo * 60000).toISOString(),
        customerName: def.name,
        phone: def.phone,
        type: def.type,
        address: def.address,
        notes: def.notes,
        status: def.status,
        items: items,
        subtotal: totals.subtotal,
        deliveryFee: totals.delivery,
        total: totals.total,
        sample: true
      });
    });
    return out;
  };

  KS.getOrders = function () {
    var raw = readJSON(KEYS.orders, null);
    if (!Array.isArray(raw)) {
      raw = KS.makeSampleOrders();
      writeJSON(KEYS.orders, raw);
    }
    return raw.map(sanitizeOrder).filter(Boolean);
  };
  KS.saveOrders = function (list) {
    var clean = (list || []).map(sanitizeOrder).filter(Boolean);
    writeJSON(KEYS.orders, clean);
    return clean;
  };

  KS.resetDemoData = function () {
    productsCache = null;
    settingsCache = null;
    var products = defaultProducts();
    writeJSON(KEYS.products, products);
    writeJSON(KEYS.orders, KS.makeSampleOrders(products));
    lsRemove(KEYS.settings);
    productsCache = null;
  };

  KS.maskPhone = function (p) {
    var s = String(p || "");
    if (/^\d{10}$/.test(s)) return s.slice(0, 2) + "XXXXXX" + s.slice(8);
    return s;
  };

  /* ---------------------------------------------------------
     Validation (customer checkout + dashboard)
     --------------------------------------------------------- */
  KS.validateName = function (v) {
    var s = cleanText(v, 200).replace(/\s+/g, " ");
    if (/^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,59}$/u.test(s)) return { ok: true, value: s };
    return { ok: false, key: "err.nameRequired" };
  };

  KS.validatePhone = function (v) {
    var raw = String(v === null || v === undefined ? "" : v).trim();
    if (!raw || /[^\d+\s\-().]/.test(raw)) return { ok: false, key: "err.phoneInvalid" };
    var d = raw.replace(/\D/g, "");
    if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
    if (/^[6-9]\d{9}$/.test(d)) return { ok: true, value: d };
    return { ok: false, key: "err.phoneInvalid" };
  };

  KS.validateAddress = function (v) {
    var s = cleanText(v, 1000);
    if (s.length >= 10 && s.length <= 250) return { ok: true, value: s };
    return { ok: false, key: "err.addressRequired" };
  };

  KS.validateNotes = function (v) {
    var s = String(v === null || v === undefined ? "" : v).trim();
    if (s.length > 200) return { ok: false, key: "err.notesLong" };
    return { ok: true, value: cleanText(s, 200) };
  };

  /* Returns digits like "919876543210" or null if unusable. */
  KS.normalizeStoreNumber = function (raw) {
    var s = String(raw === null || raw === undefined ? "" : raw).trim();
    if (!s || /[^\d+\s\-()]/.test(s)) return null;
    var d = s.replace(/\D/g, "").replace(/^0+/, "");
    if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;
    if (d.length === 12 && d.indexOf("91") === 0 && !/^91[6-9]\d{9}$/.test(d)) return null;
    if (d.length < 11 || d.length > 15) return null;
    return d;
  };

  KS.validateProductInput = function (v) {
    var errs = {};
    var out = {};
    var name = cleanText(v.name, 300).replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) errs.name = "ferr.name";
    out.name = name;

    var nameHi = cleanText(v.nameHi, 300);
    if (nameHi.length > 80) errs.nameHi = "ferr.nameHi";
    out.nameHi = nameHi;

    if (KS.CATEGORIES.indexOf(v.category) < 0) errs.category = "ferr.category";
    out.category = v.category;

    var price = parseMoney(v.price);
    if (price === null || price <= 0 || price > 100000) { errs.price = "ferr.price"; price = null; }
    out.price = price;

    var mrpRaw = String(v.mrp === null || v.mrp === undefined ? "" : v.mrp).trim();
    var mrp = null;
    if (mrpRaw !== "") {
      mrp = parseMoney(mrpRaw);
      if (mrp === null || mrp > 100000 || (price !== null && mrp < price)) { errs.mrp = "ferr.mrp"; mrp = null; }
    }
    out.mrp = mrp;

    var unit = cleanText(v.unit, 300);
    if (unit.length < 1 || unit.length > 30) errs.unit = "ferr.unit";
    out.unit = unit;

    var stockRaw = String(v.stock === null || v.stock === undefined ? "" : v.stock).trim();
    if (/^\d{1,4}$/.test(stockRaw)) out.stock = parseInt(stockRaw, 10);
    else { errs.stock = "ferr.stock"; out.stock = null; }

    var imgRaw = cleanText(v.image, 400);
    if (imgRaw !== "" && !safeImageUrl(imgRaw)) errs.image = "ferr.image";
    out.image = safeImageUrl(imgRaw);

    out.available = !!v.available;
    out.featured = !!v.featured;
    out.popular = !!v.popular;
    return { ok: Object.keys(errs).length === 0, errors: errs, value: out };
  };

  KS.validateSettingsInput = function (v) {
    var errs = {};
    var out = {};
    var storeName = cleanText(v.storeName, 200).replace(/\s+/g, " ");
    if (storeName.length < 2 || storeName.length > 60) errs.storeName = "serr.storeName";
    out.storeName = storeName;

    var loc = cleanText(v.storeLocation, 300);
    if (loc.length > 100) errs.storeLocation = "serr.location";
    out.storeLocation = loc;

    var waRaw = cleanText(v.whatsappNumber, 100);
    if (waRaw === "") out.whatsappNumber = "";
    else {
      var wa = KS.normalizeStoreNumber(waRaw);
      if (!wa) errs.whatsappNumber = "serr.whatsapp";
      out.whatsappNumber = wa || waRaw;
    }

    var fee = parseMoney(v.deliveryFee);
    if (fee === null || fee > 1000) errs.deliveryFee = "serr.deliveryFee";
    out.deliveryFee = fee;

    var free = parseMoney(v.freeDeliveryAbove);
    if (free === null || free > 100000) errs.freeDeliveryAbove = "serr.freeAbove";
    out.freeDeliveryAbove = free;

    var lowRaw = String(v.lowStockThreshold === null || v.lowStockThreshold === undefined ? "" : v.lowStockThreshold).trim();
    if (/^\d{1,4}$/.test(lowRaw) && parseInt(lowRaw, 10) <= 1000) out.lowStockThreshold = parseInt(lowRaw, 10);
    else { errs.lowStockThreshold = "serr.lowStock"; out.lowStockThreshold = null; }

    var note = cleanText(v.deliveryNote, 300);
    if (note.length > 120) errs.deliveryNote = "serr.note";
    out.deliveryNote = note;
    return { ok: Object.keys(errs).length === 0, errors: errs, value: out };
  };

  /* ---------------------------------------------------------
     Order reference and WhatsApp message
     --------------------------------------------------------- */
  KS.newOrderRef = function (now) {
    var d = now ? new Date(now) : new Date();
    var yy = String(d.getFullYear()).slice(2);
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var s = "";
    var arr = null;
    try {
      if (global.crypto && global.crypto.getRandomValues) {
        arr = new Uint8Array(4);
        global.crypto.getRandomValues(arr);
      }
    } catch (e) { arr = null; }
    for (var i = 0; i < 4; i++) {
      var r = arr ? arr[i] : Math.floor(Math.random() * 256);
      s += alphabet.charAt(r % alphabet.length);
    }
    return "KS-" + yy + mm + dd + "-" + s;
  };

  function formatDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    } catch (e) { return d.toISOString(); }
  }
  KS.formatDateTime = formatDateTime;

  /* order: {id, createdAt, customerName, phone, type, address, notes,
             items:[{name,unit,price,qty}], subtotal, deliveryFee, total} */
  KS.buildOrderMessage = function (order, settings) {
    var L = [];
    L.push("*New order - " + settings.storeName + "*");
    L.push("Order ref: " + order.id);
    L.push("Date: " + formatDateTime(order.createdAt));
    L.push("");
    L.push("*Customer*");
    L.push("Name: " + order.customerName);
    L.push("Phone: +91 " + order.phone);
    L.push("");
    L.push("*Items*");
    order.items.forEach(function (it, i) {
      var line = toPaise(it.price) * it.qty / 100;
      L.push((i + 1) + ". " + it.name + " (" + it.unit + ") x " + it.qty + " = " + KS.money(line) + " (@ " + KS.money(it.price) + ")");
    });
    L.push("");
    L.push("Subtotal: " + KS.money(order.subtotal));
    if (order.type === "delivery") L.push("Delivery fee: " + (order.deliveryFee > 0 ? KS.money(order.deliveryFee) : "Free"));
    else L.push("Delivery fee: not applicable (pickup)");
    L.push("*Total: " + KS.money(order.total) + "*");
    L.push("");
    L.push("*Order type:* " + (order.type === "delivery" ? "Home delivery" : "Store pickup"));
    if (order.type === "delivery") L.push("Address: " + order.address);
    L.push("Notes: " + (order.notes ? order.notes : "None"));
    L.push("");
    L.push("Payment: to be paid to the shop directly (no online payment was made).");
    L.push("Sent from the Kirana Smart demo store.");
    return L.join("\n");
  };

  KS.buildWhatsAppUrl = function (number, message) {
    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  };

  /* Opens a link in a new tab through a real anchor click (more
     reliable on phones than window.open). Tests can override this. */
  KS.openExternal = function (url) {
    var a = doc.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
  };

  KS.copyText = function (text) {
    return new Promise(function (resolve) {
      function fallback() {
        try {
          var ta = doc.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.className = "sr-only";
          doc.body.appendChild(ta);
          ta.select();
          var ok = doc.execCommand && doc.execCommand("copy");
          doc.body.removeChild(ta);
          resolve(!!ok);
        } catch (e) { resolve(false); }
      }
      try {
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(text).then(function () { resolve(true); }, fallback);
        } else fallback();
      } catch (e) { fallback(); }
    });
  };

  /* ---------------------------------------------------------
     Translations (English / Hindi)
     --------------------------------------------------------- */
  var lang = "en";
  var langListeners = [];

  KS.getLang = function () { return lang; };
  KS.t = function (key, vars) {
    var dicts = global.KS_I18N || {};
    var s = dicts[lang] && dicts[lang][key];
    if (s === undefined) s = dicts.en && dicts.en[key];
    if (s === undefined) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
    }
    return s;
  };
  KS.initLang = function () {
    var saved = lsGet(KEYS.lang);
    lang = saved === "hi" || saved === "en" ? saved : (cfg().defaultLanguage === "hi" ? "hi" : "en");
    doc.documentElement.lang = lang;
  };
  KS.applyI18n = function (root) {
    root = root || doc;
    var i, els;
    els = root.querySelectorAll("[data-i18n]");
    for (i = 0; i < els.length; i++) els[i].textContent = KS.t(els[i].getAttribute("data-i18n"));
    els = root.querySelectorAll("[data-i18n-placeholder]");
    for (i = 0; i < els.length; i++) els[i].setAttribute("placeholder", KS.t(els[i].getAttribute("data-i18n-placeholder")));
    els = root.querySelectorAll("[data-i18n-aria]");
    for (i = 0; i < els.length; i++) els[i].setAttribute("aria-label", KS.t(els[i].getAttribute("data-i18n-aria")));
  };
  KS.onLangChange = function (fn) { langListeners.push(fn); };
  KS.setLang = function (l) {
    if (l !== "en" && l !== "hi") return;
    lang = l;
    lsSet(KEYS.lang, l);
    doc.documentElement.lang = l;
    KS.applyI18n(doc);
    langListeners.forEach(function (fn) { fn(l); });
  };
  KS.categoryLabel = function (id) { return KS.t("cat." + id); };
  KS.displayName = function (p) { return lang === "hi" && p.nameHi ? p.nameHi : p.name; };

  /* ---------------------------------------------------------
     DOM helpers (always textContent - never innerHTML)
     --------------------------------------------------------- */
  function h(tag, attrs, children) {
    var node = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? "" : String(v));
      });
    }
    (function add(c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      node.appendChild(typeof c === "object" ? c : doc.createTextNode(String(c)));
    })(children);
    return node;
  }
  KS.h = h;
  KS.clear = function (node) { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ---------------------------------------------------------
     Product pictures: generated SVG illustrations (no network)
     --------------------------------------------------------- */
  var ART = {
    atta: { shape: "sack", bg: "#fef3c7", fg: "#b45309" },
    rice: { shape: "sack", bg: "#ecfccb", fg: "#4d7c0f" },
    dal: { shape: "sack", bg: "#ffedd5", fg: "#c2410c" },
    oil: { shape: "bottle", bg: "#fef9c3", fg: "#a16207" },
    dairy: { shape: "carton", bg: "#e0f2fe", fg: "#0369a1" },
    snacks: { shape: "packet", bg: "#fee2e2", fg: "#b91c1c" },
    beverages: { shape: "bottle", bg: "#ccfbf1", fg: "#0f766e" },
    personal: { shape: "tub", bg: "#fae8ff", fg: "#a21caf" },
    cleaning: { shape: "bottle", bg: "#dbeafe", fg: "#1d4ed8" }
  };
  function xmlEsc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
    });
  }
  KS.placeholderImage = function (p) {
    var art = ART[p.category] || ART.atta;
    var word = String(p.name || "").split(/\s+/)[0].toUpperCase().slice(0, 10);
    var fg = art.fg;
    var body;
    if (art.shape === "sack") {
      body = '<path d="M62 44 Q50 32 64 24 L96 24 Q110 32 98 44 Q124 66 122 112 Q120 136 80 136 Q40 136 38 112 Q36 66 62 44 Z" fill="' + fg + '"/>' +
        '<path d="M64 42 Q80 48 96 42" stroke="#ffffff" stroke-opacity="0.45" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<path d="M50 70 Q46 92 50 116" stroke="#ffffff" stroke-opacity="0.22" stroke-width="7" fill="none" stroke-linecap="round"/>';
    } else if (art.shape === "bottle") {
      body = '<rect x="68" y="18" width="24" height="12" rx="3" fill="' + fg + '"/>' +
        '<rect x="72" y="30" width="16" height="16" fill="' + fg + '" fill-opacity="0.75"/>' +
        '<rect x="50" y="44" width="60" height="92" rx="16" fill="' + fg + '"/>' +
        '<rect x="58" y="54" width="8" height="72" rx="4" fill="#ffffff" fill-opacity="0.25"/>';
    } else if (art.shape === "carton") {
      body = '<polygon points="50,54 80,32 110,54 110,136 50,136" fill="' + fg + '"/>' +
        '<polygon points="50,54 80,32 110,54 80,66" fill="#ffffff" fill-opacity="0.35"/>' +
        '<rect x="56" y="70" width="7" height="58" rx="3.5" fill="#ffffff" fill-opacity="0.25"/>';
    } else if (art.shape === "packet") {
      body = '<path d="M40 36 h80 l-4 10 4 10 v68 l-4 0 4 12 h-80 l4 -12 -4 0 v-68 l4 -10 z" fill="' + fg + '"/>' +
        '<rect x="40" y="36" width="80" height="10" fill="#ffffff" fill-opacity="0.3"/>' +
        '<rect x="48" y="58" width="8" height="66" rx="4" fill="#ffffff" fill-opacity="0.22"/>';
    } else if (art.shape === "sweet") {
      body = '<ellipse cx="80" cy="126" rx="48" ry="9" fill="' + fg + '" fill-opacity="0.35"/>' +
        '<circle cx="56" cy="112" r="17" fill="' + fg + '"/><circle cx="104" cy="112" r="17" fill="' + fg + '"/>' +
        '<circle cx="80" cy="114" r="18" fill="' + fg + '" fill-opacity="0.85"/>' +
        '<circle cx="68" cy="56" r="17" fill="' + fg + '"/><circle cx="92" cy="56" r="17" fill="' + fg + '" fill-opacity="0.85"/>' +
        '<circle cx="62" cy="50" r="4" fill="#ffffff" fill-opacity="0.4"/><circle cx="86" cy="50" r="4" fill="#ffffff" fill-opacity="0.4"/>';
    } else if (art.shape === "box") {
      body = '<rect x="34" y="50" width="92" height="86" rx="8" fill="' + fg + '"/>' +
        '<rect x="30" y="40" width="100" height="22" rx="6" fill="' + fg + '" fill-opacity="0.8"/>' +
        '<rect x="74" y="40" width="12" height="96" fill="#ffffff" fill-opacity="0.45"/>' +
        '<path d="M80 40 C64 22 52 30 66 40 M80 40 C96 22 108 30 94 40" stroke="' + fg + '" stroke-width="6" fill="none" stroke-linecap="round"/>';
    } else if (art.shape === "cake") {
      body = '<rect x="78" y="18" width="4" height="16" rx="2" fill="' + fg + '"/><ellipse cx="80" cy="16" rx="4" ry="6" fill="#f59e0b"/>' +
        '<rect x="40" y="36" width="80" height="34" rx="8" fill="' + fg + '" fill-opacity="0.75"/>' +
        '<rect x="30" y="66" width="100" height="70" rx="10" fill="' + fg + '"/>' +
        '<path d="M30 76 q12 12 25 0 t25 0 t25 0 t25 0" stroke="#ffffff" stroke-opacity="0.5" stroke-width="6" fill="none"/>';
    } else if (art.shape === "bread") {
      body = '<path d="M36 70 Q36 34 80 34 Q124 34 124 70 L118 70 L118 136 L42 136 L42 70 Z" fill="' + fg + '"/>' +
        '<path d="M60 52 l10 12 M80 48 l10 12 M100 52 l8 10" stroke="#ffffff" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>';
    } else if (art.shape === "bowl") {
      body = '<path d="M66 38 q-8 -10 0 -20 M80 38 q-8 -10 0 -20 M94 38 q-8 -10 0 -20" stroke="' + fg + '" stroke-opacity="0.6" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="80" cy="60" rx="54" ry="12" fill="' + fg + '" fill-opacity="0.55"/>' +
        '<path d="M26 60 Q30 132 80 132 Q130 132 134 60 Z" fill="' + fg + '"/>' +
        '<rect x="56" y="132" width="48" height="6" rx="3" fill="' + fg + '"/>';
    } else if (art.shape === "cup") {
      body = '<path d="M46 34 h68 l-8 102 h-52 z" fill="' + fg + '"/>' +
        '<rect x="42" y="28" width="76" height="10" rx="5" fill="' + fg + '" fill-opacity="0.8"/>' +
        '<rect x="58" y="46" width="7" height="76" rx="3.5" fill="#ffffff" fill-opacity="0.3"/>';
    } else {
      body = '<rect x="42" y="42" width="76" height="18" rx="8" fill="' + fg + '" fill-opacity="0.8"/>' +
        '<rect x="46" y="58" width="68" height="78" rx="14" fill="' + fg + '"/>' +
        '<rect x="54" y="66" width="8" height="60" rx="4" fill="#ffffff" fill-opacity="0.25"/>';
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">' +
      '<rect width="160" height="160" fill="' + art.bg + '"/>' +
      '<circle cx="80" cy="82" r="62" fill="#ffffff" fill-opacity="0.55"/>' +
      '<ellipse cx="80" cy="140" rx="44" ry="6" fill="#000000" fill-opacity="0.08"/>' + body +
      '<rect x="40" y="86" width="80" height="24" rx="12" fill="#ffffff"/>' +
      '<text x="80" y="102.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="' + (word.length > 8 ? 9.5 : word.length > 6 ? 11 : 12.5) + '" font-weight="700" letter-spacing="' + (word.length > 7 ? 0 : 0.5) + '" fill="' + fg + '">' + xmlEsc(word) + '</text>' +
      '</svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  KS.productImg = function (p, cls) {
    var img = h("img", {
      class: cls || "",
      src: p.image ? KS.asset(p.image) : KS.placeholderImage(p),
      alt: KS.displayName(p),
      loading: "lazy",
      width: "160",
      height: "160"
    });
    var stage = 0;
    img.addEventListener("error", function () {
      stage += 1;
      if (stage === 1) img.src = KS.placeholderImage(p);
      else if (stage === 2) img.src = KS.asset("assets/images/placeholder.svg");
    });
    return img;
  };

  /* ---------------------------------------------------------
     Toast, modal and confirm dialogs
     --------------------------------------------------------- */
  KS.toast = function (message, type) {
    var box = doc.getElementById("toasts");
    if (!box) {
      box = h("div", { id: "toasts", class: "toasts", "aria-live": "polite", "aria-atomic": "false" });
      doc.body.appendChild(box);
    }
    var node = h("div", { class: "toast toast-" + (type || "info"), role: type === "error" ? "alert" : "status", text: message });
    box.appendChild(node);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    global.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, type === "error" ? 6000 : 3500);
    return node;
  };

  var modalSeq = 0;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  KS.modal = function (opts) {
    var prevFocus = doc.activeElement;
    var titleId = "modalTitle" + (++modalSeq);
    var closed = false;
    var body = h("div", { class: "modal-body" }, opts.body);
    var closeBtn = h("button", { class: "icon-btn", type: "button", "aria-label": KS.t("common.close"), text: "✕" });
    var dialog = h("div", { class: "modal" + (opts.small ? " modal-sm" : ""), role: "dialog", "aria-modal": "true", "aria-labelledby": titleId }, [
      h("div", { class: "modal-head" }, [h("h2", { id: titleId, text: opts.title || "" }), closeBtn]),
      body
    ]);
    var overlay = h("div", { class: "modal-overlay" }, dialog);

    function close(result) {
      if (closed) return;
      closed = true;
      doc.removeEventListener("keydown", onKey, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (!doc.querySelector(".modal-overlay")) doc.body.classList.remove("modal-open");
      if (prevFocus && prevFocus.focus && doc.body.contains(prevFocus)) { try { prevFocus.focus(); } catch (e) { /* ignore */ } }
      if (opts.onClose) opts.onClose(result);
    }
    closeBtn.addEventListener("click", function () { close(false); });
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(false); });
    /* Listen on the document (not the overlay) so Escape and Tab keep
       working even if the focused button is re-rendered and focus is lost. */
    function onKey(e) {
      var all = doc.querySelectorAll(".modal-overlay");
      if (!all.length || all[all.length - 1] !== overlay) return;
      if (e.key === "Escape") { e.stopPropagation(); close(false); return; }
      if (e.key === "Tab") {
        var f = dialog.querySelectorAll(FOCUSABLE);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (!dialog.contains(doc.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    doc.addEventListener("keydown", onKey, true);
    doc.body.appendChild(overlay);
    doc.body.classList.add("modal-open");
    var target = opts.focus ? dialog.querySelector(opts.focus) : null;
    (target || dialog.querySelector(".modal-body " + "input,.modal-body select,.modal-body textarea,.modal-body button") || closeBtn).focus();
    return { close: close, dialog: dialog, body: body, overlay: overlay };
  };

  KS.confirm = function (o) {
    return new Promise(function (resolve) {
      var settled = false;
      var m;
      function done(v) {
        if (settled) return;
        settled = true;
        m.close(v);
        resolve(v);
      }
      var cancelBtn = h("button", { class: "btn btn-ghost", type: "button", text: o.cancelText || KS.t("common.cancel"), onclick: function () { done(false); } });
      var okBtn = h("button", { class: "btn " + (o.danger ? "btn-danger" : "btn-primary"), type: "button", "data-confirm-ok": "1", text: o.okText || KS.t("common.confirm"), onclick: function () { done(true); } });
      var body = h("div", null, [h("p", { class: "modal-text", text: o.message }), h("div", { class: "modal-actions" }, [cancelBtn, okBtn])]);
      m = KS.modal({
        title: o.title || KS.t("common.confirm"),
        body: body,
        small: true,
        focus: "[data-confirm-ok]",
        onClose: function () { if (!settled) { settled = true; resolve(false); } }
      });
    });
  };

  /* ---------------------------------------------------------
     Branding
     --------------------------------------------------------- */
  KS.applyBranding = function () {
    var c = cfg().brandColor;
    var root = doc.documentElement;
    if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) {
      root.style.setProperty("--brand", c);
      if (cfg().shopColors) { root.style.setProperty("--brand-700", c); root.style.setProperty("--brand-600", c); }
      var meta = doc.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", c);
    }
    var a = cfg().accentColor;
    if (typeof a === "string" && /^#[0-9a-fA-F]{6}$/.test(a)) root.style.setProperty("--accent", a);
    /* A shop's own name is the brand on its pages; the kirana demo keeps "Kirana Smart" */
    if (cfg().shopColors && root.classList) root.classList.add("has-shop-colors");
    var brand = KS.usesShopName() ? KS.getSettings().storeName : (cfg().brandName || "Kirana Smart");
    var nm = doc.querySelectorAll("[data-brand-name]");
    for (var i = 0; i < nm.length; i++) nm[i].textContent = brand;
    /* Shop monogram (logoText) replaces the generic logo in the header */
    var mono = cleanText(cfg().logoText, 3);
    if (mono) {
      var logos = doc.querySelectorAll("img.brand-logo");
      for (var j = 0; j < logos.length; j++) {
        var span = h("span", { class: "brand-logo brand-mono", "aria-hidden": "true", text: mono });
        logos[j].parentNode.replaceChild(span, logos[j]);
      }
    }
    if (cfg().demo === false && root.classList) root.classList.add("is-live-shop");
    var hero = cfg().heroImage ? safeImageUrl(cfg().heroImage) : "";
    var heroImg = hero && doc.querySelector(".hero-art img");
    if (heroImg) heroImg.setAttribute("src", KS.asset(hero));
  };

  KS.usesShopName = function () { return !!(KS.shop && KS.shop.id !== KS.DEFAULT_SHOP); };

  /* ---------------------------------------------------------
     Shops: one JSON file per shop in store/shops/<id>.json
     --------------------------------------------------------- */
  var BASE_KEYS = { products: "ks_products_v1", orders: "ks_orders_v1", settings: "ks_settings_v1", cart: "ks_cart_v1" };
  var ART_SHAPES = ["sack", "bottle", "carton", "packet", "tub", "sweet", "box", "cake", "bread", "bowl", "cup"];
  KS.DEFAULT_SHOP = "kirana";
  KS.isValidShopId = function (id) { return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(id); };
  /* Reads ?shop=<id>. Returns the id, the default when absent, or null when invalid. */
  KS.shopIdFromSearch = function (search) {
    var m = /[?&]shop=([^&#]*)/.exec(search || "");
    if (!m) return KS.DEFAULT_SHOP;
    var id;
    try { id = decodeURIComponent(m[1]).toLowerCase(); } catch (e) { return null; }
    return KS.isValidShopId(id) ? id : null;
  };
  /* Storage keys: the kirana demo keeps the original keys, other shops get their own. */
  KS.keysForShop = function (id) {
    var out = {};
    Object.keys(BASE_KEYS).forEach(function (k) {
      out[k] = !id || id === KS.DEFAULT_SHOP ? BASE_KEYS[k] : BASE_KEYS[k].replace(/^ks_/, "ks_" + id + "_");
    });
    out.lang = "ks_lang_v1";
    return out;
  };
  function hexOr(v, d) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d; }

  /* Validates a shop JSON object and installs it: settings, categories,
     labels, products, sample orders and storage keys. Throws on bad data. */
  KS.applyShop = function (shop) {
    if (!shop || typeof shop !== "object") throw new Error("Shop file is empty or not valid JSON.");
    var id = cleanText(shop.id, 40).toLowerCase();
    if (!KS.isValidShopId(id)) throw new Error("Shop file needs a valid \"id\" (lowercase letters, numbers, dashes).");
    if (!cleanText(shop.storeName, 60)) throw new Error("Shop file needs a \"storeName\".");
    if (!Array.isArray(shop.products) || !shop.products.length) throw new Error("Shop file needs a \"products\" list.");
    var colors = shop.colors || {};
    var dicts = global.KS_I18N = global.KS_I18N || { en: {}, hi: {} };
    dicts.en = dicts.en || {}; dicts.hi = dicts.hi || {};
    function label(key, val) {
      if (!val) return;
      var en = typeof val === "string" ? val : cleanText(val.en, 300);
      var hi = typeof val === "string" ? val : cleanText(val.hi, 300) || en;
      if (!en) return;
      dicts.en[key] = cleanText(en, 300);
      dicts.hi[key] = cleanText(hi, 300);
    }
    if (Array.isArray(shop.categories) && shop.categories.length) {
      var cats = [];
      shop.categories.forEach(function (c) {
        if (!c || !KS.isValidShopId(c.id) || cats.indexOf(c.id) >= 0 || !cleanText(c.en, 40)) return;
        cats.push(c.id);
        label("cat." + c.id, { en: c.en, hi: c.hi });
        ART[c.id] = {
          shape: ART_SHAPES.indexOf(c.art) >= 0 ? c.art : "packet",
          bg: hexOr(c.bg, "#fef3c7"),
          fg: hexOr(c.fg, "#b45309")
        };
      });
      if (!cats.length) throw new Error("Shop file has no valid categories.");
      KS.CATEGORIES.length = 0;
      cats.forEach(function (c) { KS.CATEGORIES.push(c); });
    }
    if (shop.hours) label("footer.hours", shop.hours);
    ["en", "hi"].forEach(function (l) {
      var t = shop.text && shop.text[l];
      if (!t || typeof t !== "object") return;
      Object.keys(t).forEach(function (k) {
        if (!/^[a-zA-Z0-9.]+$/.test(k) || typeof t[k] !== "string") return;
        dicts[l][k] = cleanText(t[k], 300);
        if (dicts[l === "en" ? "hi" : "en"][k] === undefined) dicts[l === "en" ? "hi" : "en"][k] = dicts[l][k];
      });
    });
    global.KS_CONFIG = {
      brandName: cleanText(shop.brandName, 40) || "Kirana Smart",
      brandColor: hexOr(colors.brand, "#14532d"),
      accentColor: hexOr(colors.accent, ""),
      shopColors: id !== KS.DEFAULT_SHOP,
      currency: "₹",
      storeName: cleanText(shop.storeName, 60),
      storeLocation: cleanText(shop.storeLocation, 100),
      whatsappNumber: cleanText(shop.whatsappNumber, 30),
      deliveryFee: shop.deliveryFee,
      freeDeliveryAbove: shop.freeDeliveryAbove,
      deliveryNote: cleanText(shop.deliveryNote, 120),
      pickupNote: cleanText(shop.pickupNote, 120),
      lowStockThreshold: shop.lowStockThreshold,
      defaultLanguage: shop.defaultLanguage === "hi" ? "hi" : "en",
      logoText: cleanText(shop.logoText, 3),
      heroImage: safeImageUrl(shop.heroImage),
      demo: shop.demo !== false
    };
    global.KS_DEFAULT_PRODUCTS = shop.products;
    global.KS_SAMPLE_ORDER_DEFS = Array.isArray(shop.sampleOrders) ? shop.sampleOrders : [];
    var keys = KS.keysForShop(id);
    Object.keys(keys).forEach(function (k) { KEYS[k] = keys[k]; });
    KS.invalidateCaches();
    if (!defaultProducts().length) throw new Error("No product in the shop file passed the checks (price, category).");
    KS.shop = { id: id, demo: shop.demo !== false, niche: cleanText(shop.niche, 30) || id };
    return KS.shop;
  };

  /* Adds ?shop=<id> to links marked data-keep-shop (store <-> dashboard). */
  KS.applyShopLinks = function (root) {
    if (!KS.shop || KS.shop.id === KS.DEFAULT_SHOP) return;
    var els = (root || doc).querySelectorAll("a[data-keep-shop]");
    for (var i = 0; i < els.length; i++) {
      var href = (els[i].getAttribute("href") || "").split("?")[0].split("#");
      els[i].setAttribute("href", href[0] + "?shop=" + encodeURIComponent(KS.shop.id) + (href[1] ? "#" + href[1] : ""));
    }
  };

  /* Runs init once the DOM and the shop JSON (started by shop-loader.js)
     are both ready. Without a loader it runs init straight away. */
  KS.boot = function (init, onFail) {
    function go() {
      var p = global.KS_SHOP_PROMISE;
      if (!p) { init(); return; }
      p.then(function (shop) {
        try { KS.applyShop(shop); } catch (e) { onFail(e); return; }
        KS.applyShopLinks();
        init();
      }, function (err) { onFail(err); });
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go);
    else go();
  };
})(window);
