/* ============================================================
   KIRANA SMART - SHOP LOADER
   Loaded FIRST on store/index.html and store/admin.html.
   Picks the shop from the address (?shop=mithai) and starts
   downloading store/shops/<id>.json straight away, while the
   other scripts load. No ?shop= means the kirana demo.
   To add a shop: copy a JSON file in store/shops/ - see
   docs/NEW-SHOP.md.
   ============================================================ */
(function (global) {
  "use strict";
  var search = (global.location && global.location.search) || "";
  var m = /[?&]shop=([^&#]*)/.exec(search);
  var id = "kirana";
  if (m) {
    try { id = decodeURIComponent(m[1]).toLowerCase(); } catch (e) { id = ""; }
  }
  global.KS_SHOP_ID = id;
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) {
    global.KS_SHOP_PROMISE = Promise.reject(new Error("Shop address is not valid: use letters, numbers and dashes only."));
  } else {
    global.KS_SHOP_PROMISE = global.fetch("shops/" + id + ".json", { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("Shop \"" + id + "\" was not found.");
      return r.json();
    }).then(function (shop) {
      if (shop && typeof shop === "object") shop.id = id;
      return shop;
    });
  }
  /* avoid an "unhandled rejection" console error before the app attaches */
  global.KS_SHOP_PROMISE.catch(function () {});
})(window);
