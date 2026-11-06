/* ============================================================
   KIRANAYAP - SHOP LOADER
   Loaded FIRST on store/index.html and store/admin.html.
   Picks the shop from the address (?shop=mithai) and starts
   downloading store/shops/<id>.json straight away, while the
   other scripts load. No ?shop= means the kirana demo.
   The JSON is fetched NETWORK-FIRST (it is revalidated with the
   server every time, so price/stock changes show at once) and
   falls back to the browser/offline copy only when the network
   fails. KS_FETCH_SHOP() re-fetches it later (before checkout).
   To add a shop: copy a JSON file in store/shops/ - see
   docs/NEW-SHOP.md.
   ============================================================ */
(function (global) {
  "use strict";
  var search = (global.location && global.location.search) || "";
  var m = /[?&]shop=([^&#]*)/.exec(search);
  var root = global.document && global.document.documentElement;
  /* Static per-shop pages (store/<id>/index.html, made by
     tools/build-shop-pages.js) preset the shop on <html data-shop>. */
  var preset = root && root.getAttribute && root.getAttribute("data-shop");
  var id = "kirana";
  if (preset) id = String(preset).toLowerCase();
  else if (m) {
    try { id = decodeURIComponent(m[1]).toLowerCase(); } catch (e) { id = ""; }
  }
  global.KS_SHOP_ID = id;
  var base = (root && root.getAttribute && root.getAttribute("data-shops-base")) || "shops/";
  if (base !== "shops/" && base !== "../shops/") base = "shops/";

  function get(mode) {
    return global.fetch(base + id + ".json", { credentials: "same-origin", cache: mode }).then(function (r) {
      if (!r.ok) {
        var err = new Error("Shop \"" + id + "\" was not found.");
        err.notFound = true;
        throw err;
      }
      return r.json();
    });
  }

  /* network first; on a network error use whatever copy the browser has */
  function fetchShop() {
    return get("no-cache").catch(function (e) {
      if (e && e.notFound) throw e;
      return get("force-cache");
    }).then(function (shop) {
      if (shop && typeof shop === "object") shop.id = id;
      return shop;
    });
  }

  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || id === "shops") {
    global.KS_SHOP_PROMISE = Promise.reject(new Error("Shop address is not valid: use letters, numbers and dashes only."));
    global.KS_FETCH_SHOP = function () { return global.KS_SHOP_PROMISE; };
  } else {
    global.KS_SHOP_PROMISE = fetchShop();
    global.KS_FETCH_SHOP = fetchShop;
  }
  /* avoid an "unhandled rejection" console error before the app attaches */
  global.KS_SHOP_PROMISE.catch(function () {});
})(window);
