/* ============================================================
   KIRANA SMART - MARKETING PAGES SCRIPT
   Landing page, city pages, QR poster and legal pages.
   - English / Hindi switch (same data-i18n approach and the same
     saved-language key as the store, so the choice carries over)
   - Builds every "Free demo maango" WhatsApp link from the ONE
     number in assets/js/site-config.js
   - Live demo preview switcher on the landing page
   Text is only ever set with textContent.
   ============================================================ */
(function (global) {
  "use strict";

  var doc = global.document;
  var SITE = global.KS_SITE || {};
  var DICT = global.KS_SITE_I18N || { en: {}, hi: {} };
  var LANG_KEY = "ks_lang_v1";
  var lang = "en";
  var listeners = [];

  function lsGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) { /* storage blocked: language just won't be remembered */ } }

  function t(key, vars) {
    var s = DICT[lang] && DICT[lang][key];
    if (s === undefined) s = DICT.en && DICT.en[key];
    if (s === undefined) return null;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
    return s;
  }

  function apply(root) {
    root = root || doc;
    var i, els, v;
    els = root.querySelectorAll("[data-i18n]");
    for (i = 0; i < els.length; i++) { v = t(els[i].getAttribute("data-i18n")); if (v !== null) els[i].textContent = v; }
    els = root.querySelectorAll("[data-i18n-aria]");
    for (i = 0; i < els.length; i++) { v = t(els[i].getAttribute("data-i18n-aria")); if (v !== null) els[i].setAttribute("aria-label", v); }
    els = root.querySelectorAll("[data-i18n-placeholder]");
    for (i = 0; i < els.length; i++) { v = t(els[i].getAttribute("data-i18n-placeholder")); if (v !== null) els[i].setAttribute("placeholder", v); }
    doc.documentElement.lang = lang;
    labelTables(root);
  }

  /* Small screens show the comparison table as cards: each cell gets its column name */
  function labelTables(root) {
    var tables = (root || doc).querySelectorAll("table.cmp");
    for (var i = 0; i < tables.length; i++) {
      var heads = tables[i].querySelectorAll("thead th");
      var rows = tables[i].querySelectorAll("tbody tr");
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].children;
        for (var c = 1; c < cells.length; c++) {
          if (heads[c]) cells[c].setAttribute("data-label", heads[c].textContent);
        }
      }
    }
  }

  function setLang(l) {
    if (l !== "en" && l !== "hi") return;
    lang = l;
    lsSet(LANG_KEY, l);
    apply(doc);
    updateLangBtn();
    buildWaLinks();
    listeners.forEach(function (fn) { fn(l); });
  }

  function updateLangBtn() {
    var btn = doc.getElementById("langBtn");
    if (!btn) return;
    btn.textContent = lang === "en" ? "हिंदी" : "English";
    btn.setAttribute("lang", lang === "en" ? "hi" : "en");
    btn.setAttribute("aria-label", lang === "en" ? "हिंदी में देखें" : "Switch to English");
  }

  /* ---------------- WhatsApp ---------------- */
  /* Digits only. 10 digits starting 6-9 get 91 in front. Placeholder => null. */
  function normalizeNumber(raw) {
    var d = String(raw === null || raw === undefined ? "" : raw).replace(/[\s+()-]/g, "");
    if (!/^\d+$/.test(d)) return null;
    if (/^[6-9]\d{9}$/.test(d)) d = "91" + d;
    return /^91[6-9]\d{9}$/.test(d) ? d : null;
  }

  function waMessage(type) {
    var city = doc.body.getAttribute("data-city") || "";
    var msg = t("l.wa." + type) || t("l.wa.demo") || "DEMO";
    return msg.replace("{city}", city || (t("l.wa.cityBlank") || ""));
  }

  function waUrl(type) {
    var num = normalizeNumber(SITE.ownerWhatsApp);
    if (!num) return null;
    return "https://wa.me/" + num + "?text=" + encodeURIComponent(waMessage(type));
  }

  function buildWaLinks() {
    var els = doc.querySelectorAll("[data-wa]");
    for (var i = 0; i < els.length; i++) {
      var url = waUrl(els[i].getAttribute("data-wa"));
      if (url) {
        els[i].setAttribute("href", url);
        els[i].setAttribute("target", "_blank");
        els[i].setAttribute("rel", "noopener noreferrer");
        els[i].removeAttribute("data-wa-missing");
      } else {
        els[i].setAttribute("data-wa-missing", "1");
      }
    }
  }

  function showNotice(text) {
    var n = doc.getElementById("waNotice");
    if (!n) {
      n = doc.createElement("p");
      n.id = "waNotice";
      n.className = "wa-notice wa-notice-float";
      n.setAttribute("role", "status");
      doc.body.appendChild(n);
    }
    n.textContent = text;
    n.hidden = false;
    if (n.scrollIntoView && !/float/.test(n.className)) n.scrollIntoView({ block: "center", behavior: "smooth" });
    clearTimeout(showNotice.timer);
    showNotice.timer = setTimeout(function () { n.hidden = true; }, 7000);
  }

  doc.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("[data-wa-missing]") : null;
    if (!a) return;
    e.preventDefault();
    showNotice(t("l.wa.notSet") || "WhatsApp number not set yet.");
  });

  /* ---------------- Landing: live preview ---------------- */
  function bindPreview() {
    var frame = doc.getElementById("previewFrame");
    if (!frame) return;
    var open = doc.getElementById("previewOpen");
    var tabs = doc.querySelectorAll(".lp-ptab");
    function select(btn) {
      var shop = btn.getAttribute("data-shop");
      if (!/^[a-z0-9-]+$/.test(shop)) return;
      for (var i = 0; i < tabs.length; i++) {
        var on = tabs[i] === btn;
        tabs[i].setAttribute("aria-selected", on ? "true" : "false");
        tabs[i].tabIndex = on ? 0 : -1;
      }
      var url = "store/index.html?shop=" + shop;
      frame.setAttribute("src", url);
      if (open) open.setAttribute("href", url);
    }
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].tabIndex = tabs[i].getAttribute("aria-selected") === "true" ? 0 : -1;
      tabs[i].addEventListener("click", function () { select(this); });
      tabs[i].addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var list = Array.prototype.slice.call(tabs);
        var idx = list.indexOf(this) + (e.key === "ArrowRight" ? 1 : -1);
        var next = list[(idx + list.length) % list.length];
        next.focus();
        select(next);
      });
    }
  }

  function init() {
    var saved = lsGet(LANG_KEY);
    lang = saved === "hi" || saved === "en" ? saved : (SITE.defaultLanguage === "hi" ? "hi" : "en");
    apply(doc);
    updateLangBtn();
    buildWaLinks();
    bindPreview();
    var btn = doc.getElementById("langBtn");
    if (btn) btn.addEventListener("click", function () { setLang(lang === "en" ? "hi" : "en"); });
    /* desktop: the floating demo button appears once the hero has scrolled away */
    var sticky = doc.querySelector(".lp-sticky");
    if (sticky) {
      var onScroll = function () { sticky.classList.toggle("is-on", (global.pageYOffset || 0) > 480); };
      global.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    var ig = doc.getElementById("igLink");
    if (ig && /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.\/-]+$/.test(SITE.instagram || "")) {
      ig.setAttribute("href", SITE.instagram);
      ig.hidden = false;
    }
  }

  global.KS_SITE_API = {
    t: t, setLang: setLang, getLang: function () { return lang; }, onLangChange: function (fn) { listeners.push(fn); },
    normalizeNumber: normalizeNumber, waUrl: waUrl, waMessage: waMessage, buildWaLinks: buildWaLinks, apply: apply
  };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
