/* ============================================================
   KIRANAYAP - SHOPPING CART
   Keeps [{id, qty, price}] in LocalStorage. Quantities can never go
   above the available stock and never below 1. "price" is the price
   the customer saw when adding; reconcile() compares it with the
   shop's current price so a change is shown before checkout.
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
      var pr = Number(r.price);
      items.push({ id: r.id, qty: q, price: isFinite(pr) && pr > 0 ? pr : null });
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
      if (it) { it.qty = cur + 1; if (it.price === null || it.price === undefined) it.price = p.price; }
      else items.push({ id: id, qty: 1, price: p.price });
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
      if (it) { it.qty = qty; if (it.price === null || it.price === undefined) it.price = p.price; }
      else items.push({ id: id, qty: qty, price: p.price });
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

    /* Checks the cart against the shop's CURRENT products (fresh from
       the shop JSON): drops missing / out-of-stock / unavailable items,
       trims quantities to stock and picks up price changes.
       Returns false when nothing changed, otherwise a report:
       { removed:[{id,name}], trimmed:[{id,name,qty}], repriced:[{id,name,from,to}] }
       The report is also kept in cart.lastChanges until cleared. */
    reconcile: function () {
      var report = { removed: [], trimmed: [], repriced: [] };
      var next = [];
      items.forEach(function (i) {
        var p = KS.getProduct(i.id);
        var max = maxFor(p);
        if (!p || max <= 0) { report.removed.push({ id: i.id, name: p ? p.name : i.id }); return; }
        if (i.qty > max) { i.qty = max; report.trimmed.push({ id: i.id, name: p.name, qty: max }); }
        if (i.price !== null && i.price !== undefined && KS.toPaise(i.price) !== KS.toPaise(p.price)) {
          report.repriced.push({ id: i.id, name: p.name, from: i.price, to: p.price });
        }
        i.price = p.price;
        next.push(i);
      });
      var changed = report.removed.length + report.trimmed.length + report.repriced.length > 0;
      var priceFilled = items.length === next.length && !changed;
      items = next;
      if (changed) {
        cart.lastChanges = report;
        save();
        notify();
        return report;
      }
      if (priceFilled) save();
      return false;
    },
    lastChanges: null,
    clearChanges: function () { cart.lastChanges = null; },

    totals: function (type, settings) {
      return KS.calcTotals(cart.lines().map(function (l) { return { price: l.product.price, qty: l.qty }; }), type, settings);
    }
  };

  KS.cart = cart;
  load();
})(window);
