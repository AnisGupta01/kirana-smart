/* ============================================================
   KIRANAYAP - SERVICE WORKER (offline shell)
   - Pre-caches the pages, styles, scripts and shop files so the
     site opens without internet after the first visit.
   - CSS/JS/fonts are requested with ?v=<hash> (tools/version-assets.js),
     so a cached copy is always the right one for the page.
   - Pages: network first (always fresh when online), cache when
     offline. Other files: cache first, refreshed in background.
   Bump CACHE when you change files so phones pick up the update.
   ============================================================ */
"use strict";
var CACHE = "ks-shell-v7-c3dc7a52"; /* v7: "bahi-khata" redesign (tokens.css, Plus Jakarta Sans); v6: "dukaan" redesign, versioned CSS/JS (?v=), small pre-cache. The -<hash> suffix is added by tools/version-assets.js */
/* Only the page shell: pages, styles, scripts, fonts, icons and shop files
   (about 0.6 MB). Product photos are cached the first time they are seen,
   so a first visit on prepaid data does not download every demo photo. */
var SHELL = [
  "./", "./index.html", "./udhaar.html", "./qr-poster.html",
  "./privacy.html", "./terms.html", "./refund.html",
  "./about.html", "./contact.html", "./faq.html", "./onboarding.html", "./resellers.html",
  "./shop-website-lucknow.html", "./shop-website-kanpur.html", "./shop-website-varanasi.html",
  "./store/", "./store/index.html", "./store/admin.html",
  "./store/kirana/", "./store/mithai/", "./store/bakery/", "./store/cloud-kitchen/",
  "./store/shops/shops.json", "./store/shops/kirana.json", "./store/shops/mithai.json", "./store/shops/bakery.json", "./store/shops/cloud-kitchen.json",
  "./manifest.webmanifest", "./404.html",
  "./assets/css/tokens.css?v=e1d0e7e0", "./assets/css/style.css?v=07619f2c", "./assets/css/site.css?v=ab20c8a3", "./assets/css/tools.css?v=295e1f63", "./assets/css/print-a6.css?v=ea575f9c", "./assets/css/landing.css?v=9d5b7967",
  "./assets/js/site-config.js?v=3d3ddc98", "./assets/js/site-i18n.js?v=37347413", "./assets/js/site-i18n-hi.js?v=c04ef667", "./assets/js/site.js?v=5907096a", "./assets/js/pwa.js?v=5222bb28", "./assets/js/landing.js?v=6fb97da6",
  "./assets/js/shop-loader.js?v=fe9a7dfc", "./assets/js/i18n.js?v=7b9810f6", "./assets/js/common.js?v=82023d38", "./assets/js/cart.js?v=2f012e34",
  "./assets/js/app.js?v=bc468df6", "./assets/js/admin.js?v=747c0ae6", "./assets/js/udhaar-core.js?v=ceb3c580", "./assets/js/udhaar.js?v=ba5a4f5e",
  "./assets/js/qr-poster.js?v=a8bcbf2d", "./assets/vendor/qrcode-generator/qrcode.js?v=79ec86f8",
  "./assets/fonts/plusjakarta-latin.woff2?v=082b427a", "./assets/fonts/baloo2-bold-label.woff2?v=ddb0f290",
  "./assets/images/logo.svg", "./assets/images/placeholder.svg", "./assets/images/check.svg", "./assets/images/tick.svg",
  "./assets/images/cart.svg", "./assets/images/chat.svg", "./assets/images/search.svg", "./assets/images/chevron.svg",
  "./assets/images/icon-192.png",
  "./demo/chai/", "./demo/chai/index.html", "./assets/css/cinema.css?v=e7bed2c0",
  "./assets/js/cinema-boot.js?v=88ea53a0", "./assets/js/chai-config.js?v=0cc2fc4d", "./assets/js/cinema.js?v=05b0587e"
];

function cleanCopy(res) {
  return res.blob().then(function (body) {
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* add one by one so a single missing file does not break install */
      return Promise.all(SHELL.map(function (url) {
        return fetch(new Request(url, { cache: "reload" })).then(function (res) {
          if (!res || !res.ok) return;
          /* Cloudflare Pages redirects "about.html" -> "/about". A redirected
             response must not be replayed for a navigation, so store a clean copy. */
          if (res.redirected) return cleanCopy(res).then(function (c) { return cache.put(url, c); });
          return cache.put(url, res);
        }).catch(function () { /* skip */ });
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
          /* a shop file must never be answered with an HTML page */
          if (/\.json$/.test(url.pathname)) return new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } });
          /* "/store/?shop=x" -> cached "/store/index.html" */
          if (/\/$/.test(url.pathname)) return caches.match(url.pathname + "index.html").then(function (h2) { return h2 || caches.match("./index.html"); });
          /* "/about" (Cloudflare Pages short URL) -> cached "/about.html" */
          if (!/\.[a-z0-9]+$/i.test(url.pathname)) return caches.match(url.pathname + ".html").then(function (h3) { return h3 || caches.match("./index.html"); });
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
