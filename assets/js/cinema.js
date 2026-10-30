/* ============================================================
   KIRANA SMART - CINEMATIC SHOP
   One product per full screen. As you scroll, the photo grows in
   and its ingredients burst out around it (scroll-driven, using
   transform + opacity only, so it stays smooth on cheap phones).
   Also: Hindi/English, mini cart, WhatsApp order.
   Settings and products come from window.KS_CINEMA
   (assets/js/chai-config.js).
   ============================================================ */
(function (w, d) {
  "use strict";
  var C = w.KS_CINEMA;
  if (!C || !C.products) return;

  var root = d.documentElement;
  var reduce = root.classList.contains("reduce");
  var autoplay = root.classList.contains("autoplay");
  var MAX_QTY = 20;
  var LANG_KEY = "ks-cinema-lang";
  var CART_KEY = "ks-cinema-cart-" + C.id;

  function $(id) { return d.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function store(get, key, val) {
    try {
      if (get) return w.localStorage.getItem(key);
      w.localStorage.setItem(key, val);
    } catch (e) { /* storage blocked: keep going without saving */ }
    return null;
  }
  function el(tag, attrs, kids) {
    var n = d.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? d.createTextNode(c) : c); });
    return n;
  }

  /* ---------------- language ---------------- */
  var lang = store(true, LANG_KEY) || C.defaultLanguage || "en";
  if (!C.text[lang]) lang = "en";
  function t(key, vars) {
    var s = (C.text[lang] && C.text[lang][key]) || C.text.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function P(p) { return p[lang] || p.en; }
  function money(n) { return C.currency + Number(n).toLocaleString("en-IN"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------------- cart ---------------- */
  var byId = {};
  C.products.forEach(function (p) { byId[p.id] = p; });
  var cart = {};
  try {
    var saved = JSON.parse(store(true, CART_KEY) || "{}");
    if (saved && typeof saved === "object") Object.keys(saved).forEach(function (id) {
      var q = parseInt(saved[id], 10);
      if (byId[id] && q > 0) cart[id] = Math.min(q, MAX_QTY);
    });
  } catch (e) { cart = {}; }
  function qty(id) { return cart[id] || 0; }
  function count() { return Object.keys(cart).reduce(function (a, id) { return a + cart[id]; }, 0); }
  function total() { return Object.keys(cart).reduce(function (a, id) { return a + cart[id] * byId[id].price; }, 0); }
  function setQty(id, q) {
    q = clamp(q, 0, MAX_QTY);
    if (q) cart[id] = q; else delete cart[id];
    store(false, CART_KEY, JSON.stringify(cart));
    renderCart();
  }

  /* ---------------- build the scenes ---------------- */
  var menu = $("menu");
  var scenes = [];
  var DEPTHS = [0.7, 1.3, 0.85, 1.15, 0.6, 1.45, 0.95, 1.2, 0.75];

  C.products.forEach(function (p, i) {
    var s = { p: p, i: i, pieces: [], inState: null, outState: null };
    var num = pad(i + 1);
    s.img = el("img", { class: "s-img", src: C.img + p.image, alt: "", width: "860", height: "860", loading: i === 0 ? "eager" : "lazy", decoding: "async" });
    var back = el("div", { class: "s-pieces s-back", "aria-hidden": "true" });
    var front = el("div", { class: "s-pieces s-front", "aria-hidden": "true" });
    var n = p.pieces.length;
    /* main ring of big pieces + an outer ring of small "dust" pieces */
    p.pieces.concat(p.pieces.slice(0, 7)).forEach(function (name, k) {
      var dust = k >= n;
      var j = dust ? k - n : k;
      var depth = dust ? 0.42 + (j % 3) * 0.1 : DEPTHS[k % DEPTHS.length];
      var a = dust ? ((j + 0.5) / 7) * Math.PI * 2 + i * 1.3 : (k / n) * Math.PI * 2 + i * 0.9 + ((k * 53) % 7 - 3) * 0.06;
      var piece = {
        a: a,
        r: dust ? 0.62 + (j % 3) * 0.09 : 0.42 + ((k * 37) % 5) * 0.05,
        depth: depth,
        size: (0.17 + ((k * 29) % 4) * 0.03) * depth,
        rot: ((k * 67) % 160) - 80,
        spin: (k % 2 ? 1 : -1) * (20 + (k * 13) % 40),
        node: el("img", { class: "s-piece", src: C.img + "ing-" + name + ".webp", alt: "", width: "200", height: "200", loading: i === 0 ? "eager" : "lazy", decoding: "async" })
      };
      (depth > 1.1 ? front : back).appendChild(piece.node);
      s.pieces.push(piece);
    });
    s.visual = el("div", { class: "s-visual" }, [back, s.img, front]);
    s.kickT = el("span", { class: "s-k-t" });
    s.nameA = el("span", { class: "ln-in" });
    s.nameB = el("span", { class: "ln-in" });
    s.desc = el("p", { class: "s-desc" });
    s.unit = el("small");
    s.act = el("div", { class: "s-act" });
    s.copy = el("div", { class: "s-copy" }, [
      el("p", { class: "s-kicker" }, [el("span", { class: "s-k-n", text: num }), s.kickT]),
      el("h2", { class: "s-name", id: "name-" + p.id }, [
        el("span", { class: "ln" }, [s.nameA]), " ",
        el("span", { class: "ln ln-it" }, [s.nameB])
      ]),
      s.desc,
      el("div", { class: "s-buy" }, [el("p", { class: "s-price" }, [el("strong", { text: money(p.price) }), s.unit]), s.act])
    ]);
    s.num = el("span", { class: "s-num", "aria-hidden": "true", text: num });
    s.stage = el("div", { class: "stage" }, [el("div", { class: "s-glow", "aria-hidden": "true" }), s.num, s.visual, s.copy]);
    s.el = el("section", { class: "scene", id: "item-" + p.id, "data-product": p.id, "aria-labelledby": "name-" + p.id }, [s.stage]);
    var hex = /^#([0-9a-f]{6})$/i.exec(p.glow || "") ? p.glow.slice(1) : "c7782e";
    s.el.style.setProperty("--glow-a", "rgba(" + parseInt(hex.slice(0, 2), 16) + "," + parseInt(hex.slice(2, 4), 16) + "," + parseInt(hex.slice(4, 6), 16) + ",0.36)");
    menu.appendChild(s.el);
    scenes.push(s);
  });

  /* rail tabs */
  var railTabs = $("railTabs");
  scenes.forEach(function (s) {
    s.tab = el("a", { href: "#item-" + s.p.id, class: "cin-tab" });
    railTabs.appendChild(s.tab);
  });
  $("railTotal").textContent = pad(scenes.length);

  /* hero floating pieces */
  var floats = [];
  [["cardamom", 8, 18, 0.9], ["cinnamon", 84, 12, 1.2], ["staranise", 78, 46, 0.8], ["rose", 12, 52, 1.1], ["saffron", 90, 70, 0.7], ["tealeaves", 6, 80, 0.9], ["clove", 62, 8, 0.6]].forEach(function (f, k) {
    var inner = el("img", { src: C.img + "ing-" + f[0] + ".webp", alt: "", width: "200", height: "200", decoding: "async", class: "hf-img" });
    var outer = el("span", { class: "hf hf-" + k }, [inner]);
    outer.style.left = f[1] + "%";
    outer.style.top = f[2] + "%";
    outer.style.setProperty("--d", f[3]);
    $("heroFloats").appendChild(outer);
    floats.push({ node: outer, depth: f[3] });
  });

  /* ---------------- text (language) ---------------- */
  function renderAct(s) {
    var p = s.p, q = qty(p.id), name = P(p).name.join(" ");
    s.act.textContent = "";
    if (!q) {
      s.act.appendChild(el("button", {
        class: "cin-add", type: "button", "data-add": p.id,
        "aria-label": t("add") + " " + name,
        onclick: function (e) { setQty(p.id, 1); flyToCart(e.currentTarget); toast(t("toast.added", { name: name })); focusAfter(s, "inc"); }
      }, [el("span", { class: "cin-add-plus", "aria-hidden": "true", text: "+" }), el("span", { text: t("add") })]));
    } else {
      s.act.appendChild(el("div", { class: "cin-step" }, [
        el("button", { type: "button", class: "cin-step-b", "data-dec": p.id, "aria-label": t("dec", { name: name }), text: "−", onclick: function () { setQty(p.id, q - 1); focusAfter(s, q - 1 ? "dec" : "add"); } }),
        el("output", { class: "cin-step-q", "aria-live": "polite", text: String(q) }),
        el("button", { type: "button", class: "cin-step-b", "data-inc": p.id, "aria-label": t("inc", { name: name }), text: "+", disabled: q >= MAX_QTY, onclick: function (e) { setQty(p.id, q + 1); flyToCart(e.currentTarget); focusAfter(s, "inc"); } })
      ]));
    }
  }
  function focusAfter(s, what) {
    var b = s.act.querySelector(what === "add" ? "[data-add]" : what === "dec" ? "[data-dec]" : "[data-inc]");
    if (b && !b.disabled) b.focus({ preventScroll: true });
  }
  function renderText() {
    root.lang = lang;
    root.classList.toggle("lang-hi", lang === "hi");
    d.querySelectorAll("[data-t]").forEach(function (n) { n.textContent = t(n.getAttribute("data-t")); });
    var sh = C.shop[lang] || C.shop.en;
    $("brandName").textContent = sh.name;
    $("brandLine").textContent = sh.line;
    var lb = $("langBtn");
    lb.textContent = t("lang");
    lb.setAttribute("lang", lang === "hi" ? "en" : "hi");
    lb.setAttribute("aria-label", t("lang.aria"));
    $("sheetClose").setAttribute("aria-label", t("cart.close"));
    scenes.forEach(function (s) {
      var x = P(s.p);
      s.kickT.textContent = x.kicker;
      s.nameA.textContent = x.name[0];
      s.nameB.textContent = x.name[1];
      s.desc.textContent = x.desc;
      s.unit.textContent = x.unit;
      s.tab.textContent = x.name[1];
      s.img.alt = x.name.join(" ");
      renderAct(s);
    });
    renderCart();
  }
  $("langBtn").addEventListener("click", function () {
    lang = lang === "hi" ? "en" : "hi";
    store(false, LANG_KEY, lang);
    renderText();
    measure();
  });

  /* ---------------- cart UI ---------------- */
  function itemsLabel(n) { return n === 1 ? t("cart.item") : t("cart.items", { n: n }); }
  function waUrl(text) { return "https://wa.me/" + String(C.whatsappNumber).replace(/\D/g, "") + "?text=" + encodeURIComponent(text); }
  function mode() { var r = d.querySelector('input[name="mode"]:checked'); return r ? r.value : "pickup"; }
  function orderMessage() {
    var sh = C.shop[lang] || C.shop.en, lines = [t("wa.head", { shop: sh.full }), ""], k = 0;
    C.products.forEach(function (p) {
      var q = qty(p.id);
      if (!q) return;
      k += 1;
      lines.push(k + ". " + P(p).name.join(" ") + " (" + P(p).unit + ") x " + q + " = " + money(q * p.price));
    });
    lines.push("", t("wa.total") + ": " + money(total()));
    var name = $("fName").value.trim(), addr = $("fAddress").value.trim(), note = $("fNote").value.trim();
    if (name) lines.push(t("wa.name") + ": " + name);
    lines.push(t("wa.mode") + ": " + (mode() === "delivery" ? t("f.delivery") : t("f.pickup")));
    if (mode() === "delivery" && addr) lines.push(t("wa.address") + ": " + addr);
    if (note) lines.push(t("wa.note") + ": " + note);
    lines.push("", t("wa.foot"));
    return lines.join("\n");
  }
  function renderCart() {
    var n = count(), sum = total();
    $("cartCount").textContent = String(n);
    $("cartBtn").setAttribute("aria-label", t("cart.title") + ", " + itemsLabel(n));
    root.classList.toggle("has-cart", n > 0);
    var pill = $("cartPill");
    pill.hidden = n === 0;
    $("pillCount").textContent = itemsLabel(n);
    $("pillTotal").textContent = money(sum);
    $("cartTotal").textContent = money(sum);
    var list = $("cartLines");
    list.textContent = "";
    C.products.forEach(function (p) {
      var q = qty(p.id);
      if (!q) return;
      var name = P(p).name.join(" ");
      list.appendChild(el("li", { class: "cin-line", "data-line": p.id }, [
        el("img", { src: C.img + p.image, alt: "", width: "56", height: "56", class: "cin-line-img" }),
        el("span", { class: "cin-line-info" }, [el("b", { text: name }), el("small", { text: P(p).unit + " · " + money(p.price) })]),
        el("span", { class: "cin-step cin-step-sm" }, [
          el("button", { type: "button", class: "cin-step-b", "aria-label": t("dec", { name: name }), text: "−", onclick: function () { setQty(p.id, q - 1); } }),
          el("output", { class: "cin-step-q", text: String(q) }),
          el("button", { type: "button", class: "cin-step-b", "aria-label": t("inc", { name: name }), text: "+", disabled: q >= MAX_QTY, onclick: function () { setQty(p.id, q + 1); } })
        ])
      ]));
    });
    $("cartEmpty").hidden = n > 0;
    $("cartForm").hidden = n === 0;
    $("waSend").href = n ? waUrl(orderMessage()) : "#";
    scenes.forEach(function (s) { if (s.act.firstChild) renderActIfChanged(s); });
  }
  function renderActIfChanged(s) {
    var q = qty(s.p.id), shown = s.act.querySelector("output");
    var shownQ = shown ? parseInt(shown.textContent, 10) : 0;
    if (shownQ !== q) renderAct(s);
  }
  ["fName", "fAddress", "fNote"].forEach(function (id) {
    $(id).addEventListener("input", function () {
      if (id === "fAddress" && $("fAddress").value.trim()) $("addrErr").hidden = true;
      if (count()) $("waSend").href = waUrl(orderMessage());
    });
  });
  d.querySelectorAll('input[name="mode"]').forEach(function (r) {
    r.addEventListener("change", function () {
      $("addrWrap").hidden = mode() !== "delivery";
      $("addrErr").hidden = true;
      if (count()) $("waSend").href = waUrl(orderMessage());
    });
  });
  $("waSend").addEventListener("click", function (e) {
    if (!count()) { e.preventDefault(); return; }
    if (mode() === "delivery" && !$("fAddress").value.trim()) {
      e.preventDefault();
      $("addrErr").hidden = false;
      $("fAddress").focus();
      return;
    }
    this.href = waUrl(orderMessage());
  });
  $("helloBtn").href = waUrl(t("wa.hello"));
  $("langBtn").addEventListener("click", function () { $("helloBtn").href = waUrl(t("wa.hello")); });

  var lastFocus = null;
  function openSheet() {
    lastFocus = d.activeElement;
    $("sheet").hidden = false;
    $("sheetBg").hidden = false;
    root.classList.add("sheet-open");
    w.requestAnimationFrame(function () { root.classList.add("sheet-in"); });
    $("sheetClose").focus();
  }
  function closeSheet() {
    root.classList.remove("sheet-in", "sheet-open");
    $("sheet").hidden = true;
    $("sheetBg").hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $("cartBtn").addEventListener("click", openSheet);
  $("cartPill").addEventListener("click", openSheet);
  $("sheetClose").addEventListener("click", closeSheet);
  $("sheetBg").addEventListener("click", closeSheet);
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("sheet").hidden) closeSheet();
    if (e.key === "Tab" && !$("sheet").hidden) {
      var f = $("sheet").querySelectorAll("button:not([disabled]), input, textarea, a[href]");
      var vis = Array.prototype.filter.call(f, function (x) { return x.offsetParent !== null; });
      if (!vis.length) return;
      if (e.shiftKey && d.activeElement === vis[0]) { e.preventDefault(); vis[vis.length - 1].focus(); }
      else if (!e.shiftKey && d.activeElement === vis[vis.length - 1]) { e.preventDefault(); vis[0].focus(); }
    }
  });

  var toastTimer = 0;
  function toast(msg) {
    var n = $("toast");
    n.textContent = msg;
    n.classList.add("show");
    w.clearTimeout(toastTimer);
    toastTimer = w.setTimeout(function () { n.classList.remove("show"); }, 1800);
  }
  function flyToCart(from) {
    var target = $("cartBtn");
    target.classList.remove("bump");
    void target.offsetWidth; /* restart the bump animation */
    target.classList.add("bump");
    if (reduce || !from || !from.getBoundingClientRect || !d.body.animate) return;
    var a = from.getBoundingClientRect(), b = target.getBoundingClientRect();
    var dot = el("span", { class: "cin-fly", "aria-hidden": "true" });
    dot.style.left = (a.left + a.width / 2 - 7) + "px";
    dot.style.top = (a.top + a.height / 2 - 7) + "px";
    d.body.appendChild(dot);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    var anim = dot.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(" + dx * 0.5 + "px," + (dy * 0.5 - 60) + "px) scale(1.25)", opacity: 1, offset: 0.55 },
      { transform: "translate(" + dx + "px," + dy + "px) scale(0.4)", opacity: 0.2 }
    ], { duration: 650, easing: "cubic-bezier(.5,0,.3,1)" });
    anim.onfinish = function () { dot.remove(); };
  }

  /* ---------------- scroll engine ---------------- */
  var vh = w.innerHeight, vw = w.innerWidth, heroH = vh;
  function measure() {
    vh = w.innerHeight; vw = w.innerWidth;
    var y = w.scrollY || w.pageYOffset || 0;
    heroH = $("hero").offsetHeight;
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      s.top = r.top + y;
      s.h = s.el.offsetHeight;
      s.size = s.visual.offsetWidth || 300;
      s.pieces.forEach(function (pc) { pc.px = Math.round(pc.size * s.size); pc.node.style.width = pc.px + "px"; pc.node.style.height = pc.px + "px"; });
    });
    visitTop = $("visit").getBoundingClientRect().top + y;
    requestFrame();
  }
  var visitTop = 0, ticking = false, activeIdx = -1;
  function requestFrame() { if (!ticking) { ticking = true; w.requestAnimationFrame(frame); } }

  function paintScene(s, p) {
    /* p: <0 while the scene scrolls in, 0..1 while pinned, >1 while it leaves */
    var e = easeOut(clamp((p + 0.75) / 1.0, 0, 1));          /* burst */
    var drift = clamp(p, 0, 1.8);
    var S = s.size;
    var squash = vw < 760 ? 0.72 : 1;
    for (var k = 0; k < s.pieces.length; k++) {
      var pc = s.pieces[k];
      var dist = pc.r * (0.12 + 0.88 * e) + drift * 0.16 * pc.depth;
      var x = Math.cos(pc.a) * dist * S;
      var sn = Math.sin(pc.a);
      var y = sn * dist * S * (sn > 0 ? squash : 1.05) - p * 46 * pc.depth;
      var sc = 0.35 + 0.65 * e;
      var rot = pc.rot * e + p * pc.spin;
      var op = clamp(e * 1.6, 0, 1) * (1 - clamp((p - 1.1) / 0.6, 0, 1));
      pc.node.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%,-50%) rotate(" + rot.toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")";
      pc.node.style.opacity = op.toFixed(3);
    }
    var g = easeOut(clamp((p + 0.9) / 0.9, 0, 1));
    var isc = 0.78 + 0.22 * g + 0.06 * clamp(p, 0, 1);
    var iy = (1 - g) * 70 - clamp(p, 0, 2) * 26;
    s.img.style.transform = "translate3d(0," + iy.toFixed(1) + "px,0) rotate(" + ((1 - g) * -6 + p * 2).toFixed(2) + "deg) scale(" + isc.toFixed(3) + ")";
    s.img.style.opacity = (clamp((p + 1) / 0.55, 0, 1) * (1 - clamp((p - 1.25) / 0.6, 0, 1))).toFixed(3);
    s.num.style.transform = "translate3d(0," + ((0.4 - p) * 90).toFixed(1) + "px,0)";
    var inNow = p > -0.32 && p < 1.45;
    if (inNow !== s.inState) { s.inState = inNow; s.el.classList.toggle("is-in", inNow); }
  }

  function frame() {
    ticking = false;
    var y = w.scrollY || w.pageYOffset || 0;
    /* hero parallax */
    if (!reduce && y < heroH * 1.2) {
      var hp = clamp(y / heroH, 0, 1.2);
      $("heroImg").style.transform = "translate3d(0," + (hp * heroH * 0.28).toFixed(1) + "px,0) scale(" + (1.04 + hp * 0.12).toFixed(3) + ")";
      for (var f = 0; f < floats.length; f++) {
        floats[f].node.style.transform = "translate3d(0," + (-hp * 220 * floats[f].depth).toFixed(1) + "px,0)";
      }
    }
    var active = -1;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      var span = Math.max(1, s.h - vh);
      var p = (y - s.top) / span;
      var lo = -vh / span - 0.02, hi = 1 + vh / span + 0.02;
      if (reduce) { if (y >= s.top - vh * 0.5) active = i; continue; }
      if (p > lo && p < hi) paintScene(s, p);
      else if (s.inState) { s.inState = false; s.el.classList.remove("is-in"); }
      if (p >= -0.45) active = i;
    }
    var inMenu = scenes.length && y > scenes[0].top - vh * 0.45 && y < visitTop - vh * 0.6;
    root.classList.toggle("in-menu", !!inMenu);
    root.classList.toggle("past-hero", y > heroH * 0.6);
    if (active !== activeIdx) {
      activeIdx = active;
      $("railNum").textContent = pad(Math.max(1, active + 1));
      scenes.forEach(function (s, k) { s.tab.classList.toggle("on", k === active); if (k === active) s.tab.setAttribute("aria-current", "true"); else s.tab.removeAttribute("aria-current"); });
    }
    if (scenes.length) {
      var start = scenes[0].top, end = scenes[scenes.length - 1].top + scenes[scenes.length - 1].h - vh;
      $("railFill").style.transform = "scaleX(" + clamp((y - start) / Math.max(1, end - start), 0, 1).toFixed(3) + ")";
    }
  }

  function staticLayout() {
    /* reduced motion: pieces already burst, nothing moves on scroll */
    scenes.forEach(function (s) { paintScene(s, 0.35); s.el.classList.add("is-in"); });
  }

  /* ---------------- autoplay (phone preview + reel) ---------------- */
  function runAutoplay() {
    var stopped = false;
    ["wheel", "touchstart", "keydown", "mousedown"].forEach(function (ev) {
      w.addEventListener(ev, function () { stopped = true; }, { passive: true, once: true });
    });
    var params = /[?&]speed=([0-9.]+)/.exec(w.location.search);
    var speed = params ? clamp(parseFloat(params[1]) || 1, 0.3, 4) : 1;
    function stops() {
      var list = [{ y: 0, hold: 1400 }];
      scenes.forEach(function (s) { list.push({ y: s.top + (s.h - vh) * 0.42, hold: 650 }); });
      /* ?products=1 (landing phone): loop through the dishes only, never stop on the address screen */
      if (!/[?&]products=1/.test(w.location.search)) list.push({ y: Math.max(0, d.documentElement.scrollHeight - vh), hold: 1600 });
      return list;
    }
    var pts = stops(), seg = 0, segStart = 0, phase = "hold", t0 = 0;
    function step(ts) {
      if (stopped) return;
      if (!t0) t0 = ts;
      var cur = pts[seg];
      if (phase === "hold") {
        if (ts - t0 >= cur.hold / speed) {
          if (seg === pts.length - 1) { pts = stops(); seg = 0; w.scrollTo(0, 0); t0 = ts; }
          else { phase = "move"; segStart = ts; }
        }
      } else {
        var nxt = pts[seg + 1];
        var dur = clamp(Math.abs(nxt.y - cur.y) / (vh * 1.05), 0.9, 3.2) * 1000 / speed;
        var x = clamp((ts - segStart) / dur, 0, 1);
        w.scrollTo(0, cur.y + (nxt.y - cur.y) * easeInOut(x));
        if (x >= 1) { seg += 1; phase = "hold"; t0 = ts; }
      }
      w.requestAnimationFrame(step);
    }
    w.setTimeout(function () { w.requestAnimationFrame(step); }, 500);
  }

  /* ---------------- start ---------------- */
  renderText();
  w.addEventListener("scroll", requestFrame, { passive: true });
  measure();
  if (reduce) staticLayout();
  frame();
  var rt = 0;
  w.addEventListener("resize", function () {
    if (Math.abs(w.innerWidth - vw) < 2 && Math.abs(w.innerHeight - vh) < 120) return; /* mobile URL bar */
    w.clearTimeout(rt);
    rt = w.setTimeout(function () { measure(); if (reduce) staticLayout(); }, 120);
  });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { measure(); if (reduce) staticLayout(); });
  w.addEventListener("load", function () { measure(); if (reduce) staticLayout(); });
  root.classList.add("ready");
  if (autoplay && !reduce) runAutoplay();
})(window, document);
