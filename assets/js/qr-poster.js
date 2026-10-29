/* ============================================================
   KIRANA SMART - QR POSTER MAKER
   Builds an A4 counter poster with a QR code for the shop's
   website link. The QR is drawn as SVG on the device with the
   vendored qrcode-generator library (assets/vendor, MIT).
   No network calls. Print with the browser's print dialog.
   ============================================================ */
(function (global) {
  "use strict";

  var doc = global.document;
  var SVGNS = "http://www.w3.org/2000/svg";
  var SITE = global.KS_SITE || {};
  var API = global.KS_SITE_API;
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
    var theme = doc.querySelector('input[name="qrTheme"]:checked');
    var poster = $("poster");
    poster.className = "poster theme-" + (theme && /^(green|maroon|brown)$/.test(theme.value) ? theme.value : "green");
    return true;
  }

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(global.location.search || "");
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return ""; }
  }

  function init() {
    if (typeof global.qrcode !== "function") return;
    $("qrName").value = param("name").slice(0, 40);
    var u = param("url");
    $("qrUrl").value = cleanUrl(u) ? u : String(SITE.siteUrl || "https://anisgupta01.github.io/kirana-smart/") + "store/";
    $("qrForm").addEventListener("submit", function (e) { e.preventDefault(); render(); });
    $("qrPrint").addEventListener("click", function () { if (render()) global.print(); });
    var radios = doc.querySelectorAll('input[name="qrTheme"]');
    for (var i = 0; i < radios.length; i++) radios[i].addEventListener("change", render);
    $("qrName").addEventListener("input", render);
    $("qrLine").addEventListener("input", render);
    render();
  }

  global.KS_QR = { cleanUrl: cleanUrl, qrMatrix: qrMatrix, render: render };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
