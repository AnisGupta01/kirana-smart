/* ============================================================
   KIRANA SMART - INSTALLABLE APP (PWA)
   Registers the service worker (sw.js at the site root) so the
   pages open offline and the site can be added to the home
   screen. Silently does nothing where not supported.
   ============================================================ */
(function (global) {
  "use strict";
  var nav = global.navigator;
  if (!nav || !("serviceWorker" in nav) || !global.isSecureContext) return;
  var s = global.document.currentScript;
  /* sw.js sits next to manifest.webmanifest at the site root */
  var swUrl = s && s.src ? s.src.replace(/assets\/js\/pwa\.js(\?.*)?$/, "sw.js") : "sw.js";
  global.addEventListener("load", function () {
    nav.serviceWorker.register(swUrl).catch(function () { /* offline support is optional */ });
  });
})(window);
