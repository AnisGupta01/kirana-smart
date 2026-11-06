/* ============================================================
   KIRANAYAP - SHOP QR CODE, A4 POSTER AND COUNTER CARD
   - Pick a shop from store/shops/shops.json (or type any link):
     fills the shop name, its store URL and its brand colour.
   - QR drawn on the device with the vendored qrcode-generator
     library (assets/vendor, MIT): SVG for the poster, <canvas>
     for the PNG download. No network calls for the QR itself.
   - A4 poster or A6 counter card, printed with the browser's
     print dialog (named @page sizes in tools.css).
   Text is only ever set with textContent.
   ============================================================ */
(function (global) {
  "use strict";

  var doc = global.document;
  var SVGNS = "http://www.w3.org/2000/svg";
  var SITE = global.KS_SITE || {};
  var API = global.KS_SITE_API;
  var SITE_URL = String(SITE.siteUrl || "https://kiranayap.pages.dev/");
  var shopColour = null; /* {main, dark} from the selected shop's JSON */
  var shopCache = {};
  function $(id) { return doc.getElementById(id); }
  function tr(key, fallback) { var v = API && API.t(key); return v === null || v === undefined ? fallback : v; }

  /* Accepts http(s) links only (adds https:// when missing). Returns null if invalid. */
  function cleanUrl(raw) {
    var s = String(raw || "").trim();
    if (!s || s.length > 300 || /\s/.test(s)) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
    if (!/^https?:\/\/[^\s/?#]+\.[^\s/?#]+/i.test(s) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(s)) return null;
    try {
      var u = new URL(s);
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      return u.href;
    } catch (e) { return null; }
  }

  /* The public address of a shop: <site>/store/<id>/ (static page with the
     shop's own link preview, made by tools/build-shop-pages.js) */
  function shopUrl(id) { return SITE_URL.replace(/\/?$/, "/") + "store/" + encodeURIComponent(id) + "/"; }

  /* Returns the QR matrix as an array of rows of booleans */
  function qrMatrix(text) {
    var q = global.qrcode(0, "M");
    if (global.qrcode.stringToBytesFuncs && global.qrcode.stringToBytesFuncs["UTF-8"]) {
      global.qrcode.stringToBytes = global.qrcode.stringToBytesFuncs["UTF-8"];
    }
    q.addData(text, "Byte");
    q.make();
    var n = q.getModuleCount();
    var rows = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(q.isDark(r, c));
      rows.push(row);
    }
    return rows;
  }

  /* One <path> for all dark modules, with a 4-module quiet zone */
  function qrSvg(text) {
    var m = qrMatrix(text);
    var n = m.length;
    var size = n + 8;
    var d = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) if (m[r][c]) d.push("M" + (c + 4) + " " + (r + 4) + "h1v1h-1z");
    }
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("aria-hidden", "true");
    var bg = doc.createElementNS(SVGNS, "rect");
    bg.setAttribute("width", String(size));
    bg.setAttribute("height", String(size));
    bg.setAttribute("fill", "#ffffff");
    var path = doc.createElementNS(SVGNS, "path");
    path.setAttribute("d", d.join(""));
    path.setAttribute("fill", "#000000");
    svg.appendChild(bg);
    svg.appendChild(path);
    svg.setAttribute("data-modules", String(n));
    return svg;
  }

  function prettyUrl(u) { return u.replace(/^https?:\/\//, "").replace(/\/$/, ""); }

  function hexOk(v) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v); }
  function darken(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function currentTheme() {
    var t = doc.querySelector('input[name="qrTheme"]:checked');
    var v = t ? t.value : "green";
    if (v === "shop") return shopColour ? "shop" : "green";
    return /^(green|maroon|brown)$/.test(v) ? v : "green";
  }
  function currentFormat() {
    var f = doc.querySelector('input[name="qrFormat"]:checked');
    return f && f.value === "a6" ? "a6" : "a4";
  }
  function colours() {
    var th = currentTheme();
    if (th === "shop" && shopColour) return shopColour;
    return { green: { main: "#14532d", dark: "#0d361e" }, maroon: { main: "#7f1d1d", dark: "#4c0d0d" }, brown: { main: "#7c2d12", dark: "#4a1a0a" } }[th];
  }

  function render() {
    var url = cleanUrl($("qrUrl").value);
    var err = $("qrUrlErr");
    if (!url) {
      err.textContent = tr("q.urlErr", "Enter a full website link, like https://yourshop.in");
      err.hidden = false;
      $("qrUrl").setAttribute("aria-invalid", "true");
      return false;
    }
    err.hidden = true;
    $("qrUrl").removeAttribute("aria-invalid");
    var name = String($("qrName").value || "").trim().slice(0, 40);
    var line = String($("qrLine").value || "").trim().slice(0, 60);
    $("pShop").textContent = name || tr("q.defaultName", "Your Shop Name");
    $("pLine").textContent = line;
    $("pLine").hidden = !line;
    $("pUrl").textContent = prettyUrl(url);
    var box = $("pQr");
    while (box.firstChild) box.removeChild(box.firstChild);
    box.appendChild(qrSvg(url));
    box.setAttribute("data-url", url);
    var poster = $("poster");
    var th = currentTheme();
    var fmt = currentFormat();
    poster.className = "poster theme-" + th + " fmt-" + fmt;
    var a6 = $("printA6");
    if (a6 && a6.sheet) a6.sheet.disabled = fmt !== "a6";
    else if (a6) a6.disabled = fmt !== "a6";
    if (th === "shop" && shopColour) {
      poster.style.setProperty("--p-main", shopColour.main);
      poster.style.setProperty("--p-dark", shopColour.dark);
    } else {
      poster.style.removeProperty("--p-main");
      poster.style.removeProperty("--p-dark");
    }
    return true;
  }

  /* ---------- PNG download: shop name band, QR, link, call to action ---------- */
  function wrapFit(g, text, maxW, size, minSize, weight) {
    var s = size;
    for (; s > minSize; s -= 2) {
      g.font = weight + " " + s + "px Inter, system-ui, sans-serif";
      if (g.measureText(text).width <= maxW) break;
    }
    return s;
  }
  function drawPng() {
    if (!render()) return null;
    var url = $("pQr").getAttribute("data-url");
    var name = $("pShop").textContent;
    var c = colours();
    var W = 1200, H = 1560, Q = 960;
    var cv = doc.createElement("canvas");
    cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
    g.fillStyle = c.main; g.fillRect(0, 0, W, 230);
    g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
    var fs = wrapFit(g, name, W - 120, 84, 36, "800");
    g.font = "800 " + fs + "px Inter, system-ui, sans-serif";
    g.fillText(name, W / 2, 118);
    var m = qrMatrix(url), n = m.length, cell = Math.floor(Q / (n + 8)), size = cell * (n + 8);
    var x0 = Math.round((W - size) / 2), y0 = 270;
    g.fillStyle = "#ffffff"; g.fillRect(x0, y0, size, size);
    g.fillStyle = "#000000";
    for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (m[r][col]) g.fillRect(x0 + (col + 4) * cell, y0 + (r + 4) * cell, cell, cell);
    g.fillStyle = "#111827";
    var y = y0 + size + 60;
    var u = prettyUrl(url);
    g.font = "600 " + wrapFit(g, u, W - 100, 38, 18, "600") + "px Inter, system-ui, sans-serif";
    g.fillText(u, W / 2, y);
    g.fillStyle = c.main;
    g.font = "800 50px Inter, system-ui, sans-serif";
    g.fillText("Scan karo, WhatsApp pe order karo", W / 2, y + 90);
    return cv;
  }
  function fileSlug() {
    var id = $("qrShop").value;
    var base = id || String($("qrName").value || "shop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shop";
    return base.slice(0, 40) + "-qr.png";
  }
  function downloadPng() {
    var cv = drawPng();
    if (!cv) return;
    var name = fileSlug();
    function save(href, revoke) {
      var a = doc.createElement("a");
      a.href = href; a.download = name; a.rel = "noopener";
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
      if (revoke) global.setTimeout(function () { global.URL.revokeObjectURL(href); }, 4000);
      $("qrStatus").textContent = tr("q.pngDone", "QR downloaded: ") + name;
    }
    if (cv.toBlob && global.URL && global.URL.createObjectURL) {
      cv.toBlob(function (blob) { if (blob) save(global.URL.createObjectURL(blob), true); else save(cv.toDataURL("image/png"), false); }, "image/png");
    } else save(cv.toDataURL("image/png"), false);
  }

  /* ---------- shops from store/shops/shops.json ---------- */
  function fetchJson(u) {
    return global.fetch(u, { credentials: "same-origin" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function loadShop(id) {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || id === "shops") return Promise.reject(new Error("bad id"));
    if (shopCache[id]) return Promise.resolve(shopCache[id]);
    return fetchJson("store/shops/" + id + ".json").then(function (j) { shopCache[id] = j; return j; });
  }
  function selectShop(id, keepName) {
    if (!id) { shopColour = null; render(); return Promise.resolve(); }
    return loadShop(id).then(function (j) {
      if (!keepName) $("qrName").value = String(j.storeName || id).slice(0, 40);
      $("qrUrl").value = shopUrl(id);
      var main = j.colors && hexOk(j.colors.brand) ? j.colors.brand : null;
      shopColour = main ? { main: main, dark: darken(main, 0.62) } : null;
      render();
    }, function () {
      $("qrStatus").textContent = tr("q.shopErr", "Could not load this shop. Check the shop file.");
    });
  }
  function fillShops() {
    var sel = $("qrShop");
    return fetchJson("store/shops/shops.json").then(function (reg) {
      (reg && Array.isArray(reg.shops) ? reg.shops : []).forEach(function (s) {
        if (!s || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(s.id)) return;
        var o = doc.createElement("option");
        o.value = s.id;
        o.textContent = s.id + (s.demo ? " (demo)" : "");
        sel.appendChild(o);
        loadShop(s.id).then(function (j) { o.textContent = String(j.storeName || s.id); }, function () {});
      });
    }, function () { /* offline without cache: custom link still works */ });
  }

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(global.location.search || "");
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return ""; }
  }

  function init() {
    if (typeof global.qrcode !== "function") return;
    var a6link = $("printA6");
    if (a6link) a6link.addEventListener("load", function () { render(); });
    $("qrName").value = param("name").slice(0, 40);
    var u = param("url");
    $("qrUrl").value = cleanUrl(u) ? u : SITE_URL + "store/";
    if (param("format") === "a6") { var a6 = doc.querySelector('input[name="qrFormat"][value="a6"]'); if (a6) a6.checked = true; }
    $("qrForm").addEventListener("submit", function (e) { e.preventDefault(); render(); });
    $("qrPrint").addEventListener("click", function () { if (render()) global.print(); });
    $("qrPng").addEventListener("click", downloadPng);
    var radios = doc.querySelectorAll('input[name="qrTheme"], input[name="qrFormat"]');
    for (var i = 0; i < radios.length; i++) radios[i].addEventListener("change", render);
    $("qrName").addEventListener("input", render);
    $("qrLine").addEventListener("input", render);
    $("qrShop").addEventListener("change", function () { selectShop(this.value, false); });
    render();
    var want = param("shop");
    fillShops().then(function () {
      if (want && /^[a-z0-9][a-z0-9-]{0,39}$/.test(want)) {
        $("qrShop").value = want;
        if ($("qrShop").value === want) selectShop(want, !!param("name"));
      }
    });
  }

  global.KS_QR = { cleanUrl: cleanUrl, qrMatrix: qrMatrix, render: render, shopUrl: shopUrl, drawPng: drawPng };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
