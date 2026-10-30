/* ============================================================
   KIRANA SMART - LANDING PAGE INTERACTIONS (v3)
   - Hero phone slideshow (crossfade) + desktop live demo iframe
   - Live demos carousel: prev/next + progress bar
   - Product grid: shop tabs (store/shops/<shop>.json), Add / qty,
     cart bar total, re-render on language change
   - FAQ accordion (one open at a time)
   - Scroll reveals (IntersectionObserver, off for reduced motion)
   Works with site.js (language + WhatsApp links). Text is only
   ever set with textContent / DOM nodes (no innerHTML).
   ============================================================ */
(function (global) {
  "use strict";

  var doc = global.document;
  var API = global.KS_SITE_API || null;
  var reduceMQ = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var desktopMQ = global.matchMedia ? global.matchMedia("(min-width: 1024px)") : { matches: false };

  function t(key, vars, fallback) {
    var s = API ? API.t(key, vars) : null;
    if (s === null || s === undefined) {
      s = fallback || "";
      if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? String(vars[k]) : m; });
    }
    return s;
  }
  function lang() { return API ? API.getLang() : "en"; }
  function rupees(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  /* ---------------- Hero slideshow ---------------- */
  var slideTimer = null;
  function initSlides() {
    var screen = doc.querySelector(".lx-screen");
    if (!screen) return;
    var slides = screen.querySelectorAll(".lx-slide");
    var dots = screen.querySelectorAll(".lx-dots i");
    if (slides.length < 2) return;
    var idx = 0, visible = true;
    function show(n) {
      idx = (n + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) {
        slides[i].classList.toggle("is-on", i === idx);
        if (dots[i]) dots[i].classList.toggle("is-on", i === idx);
      }
    }
    function tick() {
      if (!visible || doc.hidden || screen.classList.contains("is-live")) return;
      show(idx + 1);
    }
    slideTimer = global.setInterval(tick, reduceMQ.matches ? 5000 : 2800);
    if ("IntersectionObserver" in global) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(screen);
    }
  }

  /* Desktop only: swap the slideshow for the real cinematic demo after load */
  function initHeroFrame() {
    var frame = doc.getElementById("heroFrame");
    if (!frame) return;
    var src = frame.getAttribute("data-src");
    if (!src || !/^demo\/chai\/[^:]*$/.test(src)) return;
    var conn = global.navigator && global.navigator.connection;
    function go() {
      if (!desktopMQ.matches || reduceMQ.matches || (conn && conn.saveData)) return;
      if (frame.getAttribute("src")) return;
      frame.addEventListener("load", function () {
        global.setTimeout(function () {
          var s = frame.closest(".lx-screen");
          if (s) s.classList.add("is-live");
          if (slideTimer) { global.clearInterval(slideTimer); slideTimer = null; }
        }, 900);
      }, { once: true });
      frame.setAttribute("src", src);
      frame.hidden = false;
    }
    if (doc.readyState === "complete") global.setTimeout(go, 300);
    else global.addEventListener("load", function () { global.setTimeout(go, 300); }, { once: true });
  }

  /* ---------------- Demos carousel ---------------- */
  function initCarousel() {
    var car = doc.getElementById("demoCarousel");
    if (!car) return;
    var bar = doc.getElementById("carBar");
    var prev = doc.querySelector('[data-car="prev"]');
    var next = doc.querySelector('[data-car="next"]');
    function step() {
      var card = car.querySelector(".lx-dcard");
      if (!card) return car.clientWidth * 0.8;
      var gap = parseFloat(global.getComputedStyle(car).columnGap) || 16;
      return card.getBoundingClientRect().width + gap;
    }
    function update() {
      var max = car.scrollWidth - car.clientWidth;
      var p = max > 0 ? car.scrollLeft / max : 1;
      var visibleShare = car.scrollWidth > 0 ? car.clientWidth / car.scrollWidth : 1;
      var scale = Math.min(1, visibleShare + (1 - visibleShare) * p);
      if (bar) bar.style.transform = "scaleX(" + scale.toFixed(4) + ")";
      if (prev) prev.disabled = car.scrollLeft <= 2;
      if (next) next.disabled = car.scrollLeft >= max - 2;
    }
    function go(dir) {
      car.scrollBy({ left: dir * step(), behavior: reduceMQ.matches ? "auto" : "smooth" });
    }
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    car.addEventListener("keydown", function (e) {
      if (e.target !== car) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
    var raf = 0;
    car.addEventListener("scroll", function () {
      if (raf) return;
      raf = global.requestAnimationFrame(function () { raf = 0; update(); });
    }, { passive: true });
    global.addEventListener("resize", update);
    update();
  }

  /* ---------------- Product grid ---------------- */
  var PICKS = {
    "kirana": ["p001", "p005", "p009", "p013", "p015", "p017", "p022", "p024"],
    "mithai": ["m001", "m002", "m007", "m009", "m011", "m004", "m012", "m016"],
    "bakery": ["b003", "b001", "b005", "b007", "b015", "b013", "b008", "b017"],
    "cloud-kitchen": ["k002", "k001", "k008", "k004", "k005", "k007", "k011", "k013"]
  };
  var shopData = {};      /* shop -> [products] */
  var carts = {};         /* shop -> { id: qty } */
  var current = "kirana";
  var loadToken = 0;
  var grid, bar, barTxt, barGo, openLink;

  function safeImg(src) {
    return typeof src === "string" && /^assets\/images\/[A-Za-z0-9_\/.-]+\.(webp|png|jpg|jpeg|svg)$/.test(src) ? src : "assets/images/placeholder.svg";
  }

  function pick(json, shop) {
    var list = (json && json.products) || [];
    var byId = {};
    for (var i = 0; i < list.length; i++) byId[list[i].id] = list[i];
    return PICKS[shop].map(function (id) { return byId[id]; }).filter(function (p) {
      return p && typeof p.price === "number";
    });
  }

  function nameOf(p) { return lang() === "hi" && p.nameHi ? p.nameHi : p.name; }

  function actionNode(p) {
    var q = (carts[current] || {})[p.id] || 0;
    var wrap = el("div", "lx-card-act");
    if (!q) {
      var add = el("button", "lx-add", t("l.shop.add", null, "Add"));
      add.type = "button";
      add.setAttribute("data-add", p.id);
      add.setAttribute("data-i18n", "l.shop.add");
      add.setAttribute("aria-label", t("l.shop.add", null, "Add") + ": " + nameOf(p));
      wrap.appendChild(add);
    } else {
      var box = el("div", "lx-qty");
      var dec = el("button", null, "−");
      dec.type = "button"; dec.setAttribute("data-dec", p.id); dec.setAttribute("aria-label", "− " + nameOf(p));
      var n = el("span", "lx-qty-n", String(q));
      n.setAttribute("aria-live", "polite");
      var inc = el("button", null, "+");
      inc.type = "button"; inc.setAttribute("data-inc", p.id); inc.setAttribute("aria-label", "+ " + nameOf(p));
      box.appendChild(dec); box.appendChild(n); box.appendChild(inc);
      wrap.appendChild(box);
    }
    return wrap;
  }

  function card(p) {
    var a = el("article", "lx-card");
    a.setAttribute("data-id", p.id);
    var media = el("div", "lx-card-media");
    var img = doc.createElement("img");
    img.src = safeImg(p.image);
    img.alt = nameOf(p);
    img.width = 480; img.height = 480;
    img.loading = "lazy"; img.decoding = "async";
    media.appendChild(img);
    if (p.mrp && p.mrp > p.price) {
      media.appendChild(el("span", "lx-card-off", t("l.shop.off", { n: Math.round((p.mrp - p.price) / p.mrp * 100) }, "{n}% off")));
    }
    a.appendChild(media);
    var body = el("div", "lx-card-body");
    body.appendChild(el("h3", "lx-card-name", nameOf(p)));
    body.appendChild(el("p", "lx-card-unit", p.unit || ""));
    var row = el("p", "lx-card-row");
    row.appendChild(el("span", "lx-card-price", rupees(p.price)));
    if (p.mrp && p.mrp > p.price) { row.appendChild(doc.createTextNode(" ")); row.appendChild(el("s", "lx-card-mrp", rupees(p.mrp))); }
    body.appendChild(row);
    body.appendChild(actionNode(p));
    a.appendChild(body);
    return a;
  }

  function render() {
    var list = shopData[current];
    if (!grid || !list) return;
    var frag = doc.createDocumentFragment();
    list.forEach(function (p) { frag.appendChild(card(p)); });
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    grid.appendChild(frag);
    updateBar();
  }

  function refreshCard(id) {
    var list = shopData[current] || [];
    var p = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) p = list[i];
    var node = grid.querySelector('.lx-card[data-id="' + id + '"]');
    if (!p || !node) return render();
    var act = node.querySelector(".lx-card-act");
    var fresh = actionNode(p);
    act.parentNode.replaceChild(fresh, act);
    var focusTarget = fresh.querySelector("[data-inc]") || fresh.querySelector("[data-add]");
    return focusTarget;
  }

  function updateBar() {
    if (!bar) return;
    var cart = carts[current] || {};
    var list = shopData[current] || [];
    var n = 0, amt = 0;
    list.forEach(function (p) { var q = cart[p.id] || 0; n += q; amt += q * p.price; });
    if (!n) { bar.hidden = true; return; }
    if (barTxt) barTxt.textContent = t("l.shop.bar", { n: n, amt: rupees(amt) }, "{n} items · {amt}");
    bar.hidden = false;
  }

  function setLinks(shop) {
    var url = "store/index.html?shop=" + shop;
    if (barGo) barGo.setAttribute("href", url);
    if (openLink) openLink.setAttribute("href", url);
  }

  function load(shop) {
    if (!PICKS[shop]) return;
    current = shop;
    setLinks(shop);
    if (!carts[shop]) carts[shop] = {};
    if (shopData[shop]) { render(); return; }
    var token = ++loadToken;
    grid.classList.add("is-loading");
    grid.setAttribute("aria-busy", "true");
    fetch("store/shops/" + shop + ".json", { cache: "default" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (json) {
        shopData[shop] = pick(json, shop);
        if (token === loadToken && current === shop) render();
      })
      .catch(function () { /* keep whatever is on screen (static kirana grid) */ })
      .then(function () {
        if (token === loadToken) { grid.classList.remove("is-loading"); grid.removeAttribute("aria-busy"); }
      });
  }

  function initShop() {
    grid = doc.getElementById("shopGrid");
    if (!grid) return;
    bar = doc.getElementById("shopBar");
    barTxt = doc.getElementById("shopBarTxt");
    barGo = doc.getElementById("shopBarGo");
    openLink = doc.getElementById("shopOpen");
    var tabs = Array.prototype.slice.call(doc.querySelectorAll(".lx-tab[data-shop]"));

    function select(btn, focus) {
      tabs.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      load(btn.getAttribute("data-shop"));
    }
    tabs.forEach(function (b) {
      b.tabIndex = b.getAttribute("aria-selected") === "true" ? 0 : -1;
      b.addEventListener("click", function () { select(b, false); });
      b.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(b), n = -1;
        if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = tabs.length - 1;
        if (n < 0) return;
        e.preventDefault();
        select(tabs[n], true);
      });
    });

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button") : null;
      if (!btn || !grid.contains(btn)) return;
      var id = btn.getAttribute("data-add") || btn.getAttribute("data-inc") || btn.getAttribute("data-dec");
      if (!id) return;
      var cart = carts[current] || (carts[current] = {});
      var q = cart[id] || 0;
      if (btn.hasAttribute("data-dec")) q = Math.max(0, q - 1); else q = Math.min(99, q + 1);
      if (q) cart[id] = q; else delete cart[id];
      if (!shopData[current]) return; /* data not loaded yet (offline/static): just ignore */
      var hadFocus = doc.activeElement === btn;
      var wasDec = btn.hasAttribute("data-dec");
      var target = refreshCard(id);
      if (hadFocus) {
        var node = grid.querySelector('.lx-card[data-id="' + id + '"]');
        var f = node && (wasDec ? (node.querySelector("[data-dec]") || node.querySelector("[data-add]")) : (target || null));
        if (f) f.focus();
      }
      updateBar();
    });

    var start = tabs.filter(function (b) { return b.getAttribute("aria-selected") === "true"; })[0];
    current = start ? start.getAttribute("data-shop") : "kirana";
    load(current); /* replaces the static grid with live data (Hindi names when Hindi is on) */
  }

  /* ---------------- FAQ accordion ---------------- */
  function initFaq() {
    var items = Array.prototype.slice.call(doc.querySelectorAll(".lx-acc details"));
    items.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        items.forEach(function (o) { if (o !== d && o.open) o.open = false; });
      });
    });
  }

  /* ---------------- Reveals ---------------- */
  function initReveals() {
    if (reduceMQ.matches || !("IntersectionObserver" in global)) return;
    var sel = ".lx-sec-head, .lx-dcard, .lx-ben, .lx-more li, .lx-step, .lx-plan, .lx-addon, .lx-agency, .lx-cmp, .lx-acc details, .lx-final-in, .lx-tools";
    var els = doc.querySelectorAll(sel);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    var vh = global.innerHeight || 800;
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) continue; /* already on screen: never hide it */
      els[i].classList.add("lx-rv");
      var sib = els[i].parentNode ? Array.prototype.indexOf.call(els[i].parentNode.children, els[i]) : 0;
      if (sib > 0) els[i].style.transitionDelay = Math.min(sib, 4) * 70 + "ms";
      io.observe(els[i]);
    }
  }

  /* Desktop sticky CTA appears only after the hero phone has scrolled away */
  function initHeroOut() {
    var hero = doc.querySelector(".lx-hero");
    if (!hero || !("IntersectionObserver" in global)) { doc.body.classList.add("lx-hero-out"); return; }
    new IntersectionObserver(function (entries) {
      doc.body.classList.toggle("lx-hero-out", !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);
  }

  function init() {
    initSlides();
    initHeroFrame();
    initCarousel();
    initShop();
    initFaq();
    initHeroOut();
    initReveals();
    if (API && API.onLangChange) API.onLangChange(function () { render(); });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
