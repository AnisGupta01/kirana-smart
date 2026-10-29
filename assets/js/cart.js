/* ============================================================
   KIRANA SMART - SHOPPING CART
   Keeps [{id, qty}] in LocalStorage. Quantities can never go
   above the available demo stock and never below 1.
   ============================================================ */
(function (global) {
  "use strict";

  var KS = global.KS;
  var items = [];
  var listeners = [];

  function load() {
    var raw = KS.readJSON(KS.KEYS.cart, []);
    items = [];
    if (!Array.isArray(raw)) return;
    raw.forEach(function (r) {
      if (!r || typeof r.id !== "string") return;
      var q = Number(r.qty);
      if (!Number.isInteger(q) || q < 1 || q > 9999) return;
      if (items.some(function (i) { return i.id === r.id; })) return;
      items.push({ id: r.id, qty: q });
    });
  }
  function save() { KS.writeJSON(KS.KEYS.cart, items); }
  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function find(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function maxFor(p) { return p && p.available && p.stock > 0 ? p.stock : 0; }

  var cart = {
    load: load,
    onChange: function (fn) { listeners.push(fn); },
    qty: function (id) { var it = find(id); return it ? it.qty : 0; },
    count: function () {
      var n = 0;
      items.forEach(function (i) { n += i.qty; });
      return n;
    },
    maxFor: function (id) { return maxFor(KS.getProduct(id)); },

    add: function (id) {
      var p = KS.getProduct(id);
      if (!p) return { ok: false, reason: "missing" };
      var max = maxFor(p);
      if (max <= 0) return { ok: false, reason: "unavailable" };
      var it = find(id);
      var cur = it ? it.qty : 0;
      if (cur + 1 > max) return { ok: false, reason: "max", max: max };
      if (it) it.qty = cur + 1;
      else items.push({ id: id, qty: 1 });
      save();
      notify();
      return { ok: true, qty: cur + 1 };
    },

    setQty: function (id, qty) {
      qty = Math.floor(Number(qty));
      if (!isFinite(qty) || qty <= 0) return cart.remove(id);
      var p = KS.getProduct(id);
      var max = maxFor(p);
      var it = find(id);
      if (!p || max <= 0) { if (it) cart.remove(id); return { ok: false, reason: "unavailable" }; }
      var res = { ok: true, qty: qty };
      if (qty > max) { qty = max; res = { ok: false, reason: "max", max: max, qty: max }; }
      if (it) it.qty = qty;
      else items.push({ id: id, qty: qty });
      save();
      notify();
      return res;
    },

    remove: function (id) {
      var before = items.length;
      items = items.filter(function (i) { return i.id !== id; });
      if (items.length !== before) { save(); notify(); }
      return { ok: true, qty: 0 };
    },

    clear: function () {
      items = [];
      save();
      notify();
    },

    /* Resolved lines: [{product, qty, line}] (line total in INR) */
    lines: function () {
      var out = [];
      items.forEach(function (i) {
        var p = KS.getProduct(i.id);
        if (p) out.push({ product: p, qty: i.qty, line: KS.toPaise(p.price) * i.qty / 100 });
      });
      return out;
    },

    /* Drops missing/unavailable products and trims quantities to
       the current stock. Returns true when anything changed. */
    reconcile: function () {
      var changed = false;
      var next = [];
      items.forEach(function (i) {
        var p = KS.getProduct(i.id);
        var max = maxFor(p);
        if (!p || max <= 0) { changed = true; return; }
        if (i.qty > max) { i.qty = max; changed = true; }
        next.push(i);
      });
      items = next;
      if (changed) { save(); notify(); }
      return changed;
    },

    totals: function (type, settings) {
      return KS.calcTotals(cart.lines().map(function (l) { return { price: l.product.price, qty: l.qty }; }), type, settings);
    }
  };

  KS.cart = cart;
  load();
})(window);
