/* ============================================================
   KIRANA SMART - SERVICE WORKER (offline shell)
   - Pre-caches the pages, styles, scripts and shop files so the
     site opens without internet after the first visit.
   - Pages: network first (always fresh when online), cache when
     offline. Other files: cache first, refreshed in background.
   Bump CACHE when you change files so phones pick up the update.
   ============================================================ */
"use strict";
var CACHE = "ks-shell-v1";
var SHELL = [
  "./", "./index.html", "./udhaar.html", "./qr-poster.html",
  "./privacy.html", "./terms.html", "./refund.html",
  "./shop-website-lucknow.html", "./shop-website-kanpur.html", "./shop-website-varanasi.html",
  "./store/", "./store/index.html", "./store/admin.html",
  "./store/shops/kirana.json", "./store/shops/mithai.json", "./store/shops/bakery.json", "./store/shops/cloud-kitchen.json",
  "./manifest.webmanifest",
  "./assets/css/style.css", "./assets/css/site.css", "./assets/css/tools.css",
  "./assets/js/site-config.js", "./assets/js/site-i18n.js", "./assets/js/site.js", "./assets/js/pwa.js",
  "./assets/js/shop-loader.js", "./assets/js/i18n.js", "./assets/js/common.js", "./assets/js/cart.js",
  "./assets/js/app.js", "./assets/js/admin.js", "./assets/js/udhaar-core.js", "./assets/js/udhaar.js",
  "./assets/js/qr-poster.js", "./assets/vendor/qrcode-generator/qrcode.js",
  "./assets/images/logo.svg", "./assets/images/placeholder.svg", "./assets/images/check.svg",
  "./assets/images/cart.svg", "./assets/images/chat.svg", "./assets/images/search.svg", "./assets/images/chevron.svg",
  "./assets/images/hero-basket.svg", "./assets/images/hero-mithai.svg", "./assets/images/hero-bakery.svg", "./assets/images/hero-kitchen.svg",
  "./assets/images/icon-192.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* add one by one so a single missing file does not break install */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: "reload" })).catch(function () { /* skip */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf("ks-shell-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var isPage = req.mode === "navigate" || /\.json$/.test(url.pathname);
  if (isPage) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          /* "/store/?shop=x" -> cached "/store/index.html" */
          if (/\/$/.test(url.pathname)) return caches.match(url.pathname + "index.html").then(function (h2) { return h2 || caches.match("./index.html"); });
          return caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (hit) {
      var refresh = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || refresh;
    })
  );
});
