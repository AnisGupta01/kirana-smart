/* ============================================================
   KIRANA SMART - CUSTOMER STOREFRONT
   Search, filters, cart drawer, checkout and WhatsApp order.
   DEMO: nothing here is sent to a server. Orders only leave the
   phone when the customer presses Send inside WhatsApp.
   ============================================================ */
(function (global) {
  "use strict";

  var KS = global.KS;
  var h = KS.h;
  var t = KS.t;
  var doc = global.document;

  function $(id) { return doc.getElementById(id); }

  var CAT_ICONS = {
    atta: "🌾", rice: "🍚", dal: "🥜", oil: "🥫", dairy: "🥛",
    snacks: "🍪", beverages: "🥤", personal: "🧼", cleaning: "🧹"
  };

  var state = {
    query: "",
    category: "all",
    sort: "default",
    view: "cart", /* cart | checkout | sent */
    type: "delivery",
    form: { name: "", phone: "", address: "", notes: "" },
    sent: null,
    drawerOpen: false
  };
  var focusKey = null;
  var lastFocus = null;
  var bound = false;

  /* ---------------------------------------------------------
     Product helpers
     --------------------------------------------------------- */
  function listable(p) { return p.available && p.stock > 0; }

  function filteredProducts() {
    var q = state.query.trim().toLowerCase();
    var list = KS.getProducts().filter(function (p) {
      if (state.category !== "all" && p.category !== state.category) return false;
      if (!q) return true;
      var hay = (p.name + " " + p.nameHi + " " + (global.KS_I18N.en["cat." + p.category] || "") + " " + (global.KS_I18N.hi["cat." + p.category] || "")).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (state.sort === "priceAsc") list.sort(function (a, b) { return a.price - b.price; });
    else if (state.sort === "priceDesc") list.sort(function (a, b) { return b.price - a.price; });
    else if (state.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return list;
  }
  function filtersActive() { return state.query.trim() !== "" || state.category !== "all"; }

  function stepper(p, qty, ctx) {
    var max = KS.cart.maxFor(p.id);
    var name = KS.displayName(p);
    return h("div", { class: "stepper", role: "group", "aria-label": name }, [
      h("button", {
        class: "step-btn", type: "button", "data-fk": ctx + ":dec:" + p.id, "aria-label": t("product.decrease", { name: name }), text: "−",
        onclick: function () { focusKey = ctx + ":dec:" + p.id; KS.cart.setQty(p.id, qty - 1); }
      }),
      h("span", { class: "step-qty", text: String(qty) }),
      h("button", {
        class: "step-btn", type: "button", "data-fk": ctx + ":inc:" + p.id, "aria-label": t("product.increase", { name: name }), text: "+",
        disabled: qty >= max,
        onclick: function () { focusKey = ctx + ":inc:" + p.id; cartResult(KS.cart.setQty(p.id, qty + 1)); }
      })
    ]);
  }

  function cartResult(r) {
    if (r && !r.ok) {
      if (r.reason === "max") KS.toast(t("cart.notEnough", { n: r.max }), "error");
      else KS.toast(t("product.unavailable"), "error");
    }
  }

  function productCard(p, settings, ctx) {
    var status = KS.productStatus(p, settings);
    var canBuy = status === "in" || status === "low";
    var qty = KS.cart.qty(p.id);
    var name = KS.displayName(p);
    var badges = [];
    if (p.mrp && p.mrp > p.price) {
      badges.push(h("span", { class: "badge badge-offer", text: t("product.offer", { n: Math.round((1 - p.price / p.mrp) * 100) }) }));
    }
    if (status === "low") badges.push(h("span", { class: "badge badge-low", text: t("product.lowStock", { n: p.stock }) }));
    var action;
    if (!canBuy) {
      action = h("p", { class: "stock-msg stock-out", text: t(status === "out" ? "product.outOfStock" : "product.unavailable") });
    } else if (qty > 0) {
      action = h("div", null, [
        stepper(p, qty, ctx),
        qty >= p.stock ? h("p", { class: "stock-msg", text: t("product.qtyMax", { n: p.stock }) }) : null
      ]);
    } else {
      action = h("button", {
        class: "btn btn-primary btn-block", type: "button", "data-fk": ctx + ":add:" + p.id,
        "aria-label": t("product.addAria", { name: name }), text: t("product.add"),
        onclick: function () { focusKey = ctx + ":inc:" + p.id; cartResult(KS.cart.add(p.id)); }
      });
    }
    return h("article", { class: "product-card" + (canBuy ? "" : " is-off"), "data-product": p.id }, [
      h("div", { class: "card-media" }, [KS.productImg(p, "card-img"), badges.length ? h("div", { class: "card-badges" }, badges) : null]),
      h("div", { class: "card-body" }, [
        h("h3", { class: "card-name", text: name }),
        h("p", { class: "card-unit muted", text: p.unit }),
        h("p", { class: "card-price" }, [
          h("strong", { text: KS.money(p.price) }),
          p.mrp && p.mrp > p.price ? h("s", { class: "card-mrp", text: KS.money(p.mrp) }) : null
        ]),
        h("div", { class: "card-action" }, action)
      ])
    ]);
  }

  function fillGrid(grid, list, ctx) {
    var settings = KS.getSettings();
    KS.clear(grid);
    list.forEach(function (p) { grid.appendChild(productCard(p, settings, ctx)); });
  }

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */
  function renderStoreLine() {
    var s = KS.getSettings();
    $("storeLine").textContent = s.storeName + (s.storeLocation ? " · " + s.storeLocation : "");
    $("footStore").textContent = s.storeName;
    $("footLoc").textContent = s.storeLocation;
    $("footLoc").hidden = !s.storeLocation;
  }

  function updateLangBtn() {
    var btn = $("langBtn");
    btn.textContent = KS.getLang() === "en" ? "हिंदी" : "English";
    btn.setAttribute("aria-label", t("lang.switch"));
    btn.setAttribute("lang", KS.getLang() === "en" ? "hi" : "en");
  }

  function renderBadge() {
    var n = KS.cart.count();
    $("cartCount").textContent = String(n);
    $("cartBtn").setAttribute("aria-label", t("cart.open", { n: n }));
    /* Sticky bottom cart bar (mobile) */
    var bar = $("cartBar");
    var total = KS.cart.totals("pickup", KS.getSettings()).subtotal;
    bar.hidden = n === 0;
    bar.setAttribute("aria-label", t("cart.open", { n: n }));
    $("cartBarCount").textContent = t(n === 1 ? "cartbar.item" : "cartbar.items", { n: n });
    $("cartBarTotal").textContent = KS.money(total);
    doc.body.classList.toggle("has-cartbar", n > 0);
  }

  function markActiveCategory() {
    var tiles = doc.querySelectorAll("#catGrid .cat-tile");
    for (var i = 0; i < tiles.length; i++) {
      tiles[i].setAttribute("aria-pressed", tiles[i].getAttribute("data-cat") === state.category ? "true" : "false");
    }
  }

  function buildCategoryFilter() {
    var sel = $("catFilter");
    KS.clear(sel);
    sel.appendChild(h("option", { value: "all", text: t("filter.all") }));
    KS.CATEGORIES.forEach(function (c) { sel.appendChild(h("option", { value: c, text: KS.categoryLabel(c) })); });
    sel.value = state.category;
  }

  function renderCategoryTiles() {
    var grid = $("catGrid");
    KS.clear(grid);
    var products = KS.getProducts();
    KS.CATEGORIES.forEach(function (c) {
      var n = products.filter(function (p) { return p.category === c; }).length;
      grid.appendChild(h("button", {
        class: "cat-tile", type: "button", "data-cat": c,
        onclick: function () { setCategory(c); goTo("shop"); }
      }, [
        h("span", { class: "cat-icon cat-icon-" + c, "aria-hidden": "true", text: CAT_ICONS[c] }),
        h("span", { class: "cat-name", text: KS.categoryLabel(c) }),
        h("span", { class: "cat-count muted", text: t("results.count", { n: n }) })
      ]));
    });
  }

  function renderHome() {
    var products = KS.getProducts().filter(listable);
    function section(secId, gridId, list, ctx) {
      var sec = $(secId);
      sec.hidden = list.length === 0;
      fillGrid($(gridId), list.slice(0, 8), ctx);
    }
    section("featuredSec", "featuredGrid", products.filter(function (p) { return p.featured; }), "feat");
    section("popularSec", "popularGrid", products.filter(function (p) { return p.popular; }), "pop");
    section("offers", "offersGrid", products.filter(function (p) { return p.mrp && p.mrp > p.price; }), "off");
  }

  function renderCatalog() {
    var grid = $("productGrid");
    var list = filteredProducts();
    grid.setAttribute("aria-busy", "false");
    fillGrid(grid, list, "cat");
    grid.hidden = list.length === 0;
    $("noResults").hidden = list.length > 0;
    $("resultCount").textContent = list.length ? t("results.count", { n: list.length }) : "";
    $("homeSections").hidden = filtersActive();
    markActiveCategory();
  }

  function renderAll() {
    renderBadge();
    renderHome();
    renderCatalog();
    if (state.drawerOpen) renderDrawer();
    applyFocus();
  }

  function applyFocus() {
    if (!focusKey) return;
    var parts = focusKey.split(":");
    focusKey = null;
    var ctx = parts[0];
    var id = parts[2];
    var candidates = [parts.join(":"), ctx + ":inc:" + id, ctx + ":dec:" + id, ctx + ":add:" + id];
    for (var i = 0; i < candidates.length; i++) {
      var el = doc.querySelector('[data-fk="' + candidates[i] + '"]');
      if (el && !el.disabled && el.focus) { el.focus(); return; }
    }
    if (ctx === "drawer" && state.drawerOpen) $("drawerClose").focus();
  }

  function syncControls() {
    $("searchInput").value = state.query;
    $("searchClear").hidden = state.query === "";
    $("catFilter").value = state.category;
    $("sortSelect").value = state.sort;
  }

  function setCategory(c) {
    state.category = c;
    syncControls();
    renderCatalog();
  }

  function clearFilters() {
    state.query = "";
    state.category = "all";
    state.sort = "default";
    syncControls();
    renderCatalog();
  }

  function goTo(id) {
    if (id !== "shop" && filtersActive()) clearFilters();
    global.setTimeout(function () {
      if (id === "top") { global.scrollTo(0, 0); return; }
      var el = $(id);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
    }, 0);
  }

  /* ---------------------------------------------------------
     Cart drawer
     --------------------------------------------------------- */
  function openDrawer() {
    if (state.view !== "sent") state.view = "cart";
    lastFocus = doc.activeElement;
    state.drawerOpen = true;
    $("drawerOverlay").hidden = false;
    $("cartDrawer").hidden = false;
    doc.body.classList.add("drawer-open");
    $("cartBtn").setAttribute("aria-expanded", "true");
    renderDrawer();
    $("drawerClose").focus();
  }

  function closeDrawer() {
    state.drawerOpen = false;
    $("drawerOverlay").hidden = true;
    $("cartDrawer").hidden = true;
    doc.body.classList.remove("drawer-open");
    $("cartBtn").setAttribute("aria-expanded", "false");
    if (lastFocus && lastFocus.focus && doc.body.contains(lastFocus)) lastFocus.focus();
  }

  function renderDrawer() {
    var body = $("drawerBody");
    if (state.view === "checkout" && KS.cart.lines().length === 0) state.view = "cart";
    $("drawerTitle").textContent = t(state.view === "checkout" ? "checkout.title" : state.view === "sent" ? "sent.title" : "cart.title");
    KS.clear(body);
    if (state.view === "checkout") renderCheckoutView(body);
    else if (state.view === "sent" && state.sent) renderSentView(body);
    else renderCartView(body);
  }

  function renderCartView(body) {
    var lines = KS.cart.lines();
    if (!lines.length) {
      body.appendChild(h("div", { class: "state-panel" }, [
        h("div", { class: "state-icon", "aria-hidden": "true", text: "🛒" }),
        h("h3", { text: t("cart.empty.title") }),
        h("p", { class: "muted", text: t("cart.empty.text") }),
        h("button", { class: "btn btn-primary", type: "button", text: t("cart.empty.cta"), onclick: function () { closeDrawer(); goTo("shop"); } })
      ]));
      return;
    }
    var settings = KS.getSettings();
    var list = h("ul", { class: "cart-list" });
    lines.forEach(function (l) {
      var p = l.product;
      var name = KS.displayName(p);
      list.appendChild(h("li", { class: "cart-line", "data-cart-line": p.id }, [
        KS.productImg(p, "cart-thumb"),
        h("div", { class: "cart-info" }, [
          h("p", { class: "cart-name", text: name }),
          h("p", { class: "muted small", text: p.unit + " · " + KS.money(p.price) }),
          stepper(p, l.qty, "drawer"),
          l.qty >= p.stock ? h("p", { class: "stock-msg", text: t("product.qtyMax", { n: p.stock }) }) : null
        ]),
        h("div", { class: "cart-side" }, [
          h("strong", { text: KS.money(l.line) }),
          h("button", {
            class: "link-btn", type: "button", "aria-label": t("cart.removeAria", { name: name }), text: t("cart.remove"),
            onclick: function () { KS.cart.remove(p.id); }
          })
        ])
      ]));
    });
    body.appendChild(list);
    var totals = KS.cart.totals("pickup", settings);
    var freeAbove = Number(settings.freeDeliveryAbove) || 0;
    if (freeAbove > 0 && Number(settings.deliveryFee) > 0) {
      var left = Math.max(0, KS.toPaise(freeAbove) - KS.toPaise(totals.subtotal)) / 100;
      body.appendChild(h("div", { class: "free-progress" + (left === 0 ? " is-done" : "") }, [
        h("p", { class: "free-progress-text", text: left > 0 ? t("cart.freeProgress", { amount: KS.money(left) }) : t("cart.freeReached") }),
        h("progress", { class: "free-progress-bar", max: String(freeAbove), value: String(Math.min(freeAbove, totals.subtotal)), "aria-hidden": "true" })
      ]));
    }
    body.appendChild(h("div", { class: "cart-foot" }, [
      h("div", { class: "total-row" }, [h("span", { text: t("cart.subtotal") }), h("strong", { id: "cartSubtotal", text: KS.money(totals.subtotal) })]),
      h("p", { class: "muted small", text: t("cart.feeNote") }),
      h("button", { class: "btn btn-primary btn-block", type: "button", id: "checkoutBtn", text: t("cart.checkout"), onclick: function () { state.view = "checkout"; renderDrawer(); } }),
      h("button", {
        class: "btn btn-ghost btn-block", type: "button", id: "clearCartBtn", text: t("cart.clear"),
        onclick: function () {
          KS.confirm({ title: t("cart.clear"), message: t("cart.clearConfirm"), okText: t("cart.clear"), danger: true }).then(function (ok) { if (ok) KS.cart.clear(); });
        }
      })
    ]));
  }

  /* ---- Checkout ---- */
  function field(key, label, input, hint) {
    return h("div", { class: "field", id: "field-" + key }, [
      h("label", { for: "f-" + key, text: label }),
      input,
      hint ? h("p", { class: "hint", id: "hint-" + key, text: hint }) : null,
      h("p", { class: "field-error", id: "err-" + key, role: "alert", hidden: true })
    ]);
  }

  function radioOption(value, label, note) {
    return h("label", { class: "radio-card" }, [
      h("input", {
        type: "radio", name: "ordertype", value: value, checked: state.type === value,
        onchange: function () {
          state.type = value;
          var af = $("field-address");
          if (af) af.hidden = state.type !== "delivery";
          fillSummary();
        }
      }),
      h("span", null, [h("strong", { text: label }), h("small", { class: "muted", text: note })])
    ]);
  }

  function fillSummary() {
    var box = $("summaryBox");
    if (!box) return;
    var settings = KS.getSettings();
    var lines = KS.cart.lines();
    var totals = KS.cart.totals(state.type, settings);
    KS.clear(box);
    box.appendChild(h("h3", { text: t("checkout.summary") }));
    var ul = h("ul", { class: "summary-list" });
    lines.forEach(function (l) {
      ul.appendChild(h("li", null, [
        h("span", { text: l.qty + " × " + KS.displayName(l.product) + " (" + l.product.unit + ")" }),
        h("span", { text: KS.money(l.line) })
      ]));
    });
    box.appendChild(ul);
    var feeText;
    if (state.type !== "delivery") feeText = t("checkout.feeNA");
    else if (totals.delivery > 0) feeText = KS.money(totals.delivery);
    else feeText = t("cart.free");
    box.appendChild(h("div", { class: "total-row" }, [h("span", { text: t("cart.subtotal") }), h("span", { id: "sumSubtotal", text: KS.money(totals.subtotal) })]));
    box.appendChild(h("div", { class: "total-row" }, [h("span", { text: t("cart.delivery") }), h("span", { id: "sumDelivery", text: feeText })]));
    if (state.type === "delivery" && totals.delivery > 0 && settings.freeDeliveryAbove > 0) {
      box.appendChild(h("p", { class: "muted small", text: t("checkout.freeAbove", { amount: KS.money(settings.freeDeliveryAbove) }) }));
    }
    box.appendChild(h("div", { class: "total-row total-final" }, [h("strong", { text: t("cart.total") }), h("strong", { id: "sumTotal", text: KS.money(totals.total) })]));
  }

  function renderCheckoutView(body) {
    var settings = KS.getSettings();
    var form = h("form", { id: "checkoutForm", novalidate: true, onsubmit: onSubmit });
    form.appendChild(h("button", { class: "link-btn back-link", type: "button", id: "backToCart", text: "← " + t("checkout.back"), onclick: function () { state.view = "cart"; renderDrawer(); } }));
    form.appendChild(h("div", { id: "formAlert", class: "alert alert-error", role: "alert", hidden: true }));

    form.appendChild(field("name", t("checkout.name"), h("input", {
      id: "f-name", name: "name", type: "text", autocomplete: "name", maxlength: "60", "aria-required": "true",
      "aria-describedby": "err-name", value: state.form.name, oninput: function (e) { state.form.name = e.target.value; }
    })));
    form.appendChild(field("phone", t("checkout.phone"), h("input", {
      id: "f-phone", name: "phone", type: "tel", inputmode: "tel", autocomplete: "tel", maxlength: "18", "aria-required": "true",
      "aria-describedby": "hint-phone err-phone", value: state.form.phone, oninput: function (e) { state.form.phone = e.target.value; }
    }), t("checkout.phone.hint")));

    form.appendChild(h("fieldset", { class: "field type-field" }, [
      h("legend", { text: t("checkout.type") }),
      h("div", { class: "radio-row" }, [
        radioOption("delivery", t("checkout.delivery"), settings.deliveryNote),
        radioOption("pickup", t("checkout.pickup"), settings.pickupNote)
      ])
    ]));

    var addr = field("address", t("checkout.address"), h("textarea", {
      id: "f-address", name: "address", rows: "3", maxlength: "250", autocomplete: "street-address", "aria-required": "true",
      "aria-describedby": "err-address", oninput: function (e) { state.form.address = e.target.value; }, text: state.form.address
    }));
    addr.hidden = state.type !== "delivery";
    form.appendChild(addr);

    form.appendChild(field("notes", t("checkout.notes"), h("textarea", {
      id: "f-notes", name: "notes", rows: "2", maxlength: "200", "aria-describedby": "err-notes",
      oninput: function (e) { state.form.notes = e.target.value; }, text: state.form.notes
    })));

    form.appendChild(h("div", { id: "summaryBox", class: "summary" }));
    form.appendChild(h("p", { class: "alert alert-info", text: t("checkout.payment") }));
    form.appendChild(h("button", { class: "btn btn-whatsapp btn-block", type: "submit", id: "sendOrderBtn", text: t("checkout.send") }));
    form.appendChild(h("p", { class: "muted small", text: t("checkout.sendNote") }));
    body.appendChild(form);
    fillSummary();
  }

  function showErrors(errs) {
    ["name", "phone", "address", "notes"].forEach(function (k) {
      var e = $("err-" + k);
      var i = $("f-" + k);
      if (!e || !i) return;
      if (errs[k]) {
        e.textContent = t(errs[k]);
        e.hidden = false;
        i.setAttribute("aria-invalid", "true");
      } else {
        e.textContent = "";
        e.hidden = true;
        i.removeAttribute("aria-invalid");
      }
    });
  }

  function showFormAlert(key) {
    var a = $("formAlert");
    if (!a) return;
    a.textContent = t(key);
    a.hidden = false;
    a.scrollIntoView && a.scrollIntoView({ block: "nearest" });
  }

  function onSubmit(e) {
    e.preventDefault();
    var changed = KS.cart.reconcile();
    var lines = KS.cart.lines();
    if (!lines.length) {
      state.view = "cart";
      renderDrawer();
      KS.toast(t("err.cartEmpty"), "error");
      return;
    }
    if (changed) {
      KS.toast(t("cart.stockAdjusted"), "error");
      return;
    }
    var alertBox = $("formAlert");
    if (alertBox) alertBox.hidden = true;

    var vName = KS.validateName(state.form.name);
    var vPhone = KS.validatePhone(state.form.phone);
    var vNotes = KS.validateNotes(state.form.notes);
    var vAddr = state.type === "delivery" ? KS.validateAddress(state.form.address) : { ok: true, value: "" };
    var errs = {};
    if (!vName.ok) errs.name = vName.key;
    if (!vPhone.ok) errs.phone = vPhone.key;
    if (!vAddr.ok) errs.address = vAddr.key;
    if (!vNotes.ok) errs.notes = vNotes.key;
    showErrors(errs);
    var keys = Object.keys(errs);
    if (keys.length) {
      showFormAlert("err.fixForm");
      var order = ["name", "phone", "address", "notes"];
      for (var i = 0; i < order.length; i++) {
        if (errs[order[i]]) { var el = $("f-" + order[i]); if (el) el.focus(); break; }
      }
      return;
    }

    var settings = KS.getSettings();
    var number = KS.normalizeStoreNumber(settings.whatsappNumber);
    if (!number) {
      showFormAlert("err.storeNumber");
      return;
    }

    var totals = KS.cart.totals(state.type, settings);
    var orderObj = {
      id: KS.newOrderRef(),
      createdAt: new Date().toISOString(),
      customerName: vName.value,
      phone: vPhone.value,
      type: state.type,
      address: vAddr.value,
      notes: vNotes.value,
      items: lines.map(function (l) { return { id: l.product.id, name: l.product.name, unit: l.product.unit, price: l.product.price, qty: l.qty }; }),
      subtotal: totals.subtotal,
      deliveryFee: totals.delivery,
      total: totals.total
    };
    var message = KS.buildOrderMessage(orderObj, settings);
    var url = KS.buildWhatsAppUrl(number, message);
    state.sent = { id: orderObj.id, message: message, url: url };
    state.view = "sent";
    renderDrawer();
    KS.openExternal(url);
  }

  function renderSentView(body) {
    var s = state.sent;
    body.appendChild(h("div", { class: "alert alert-warn", role: "status", id: "sentNotice" }, [
      h("strong", { text: t("sent.heading") }),
      h("p", { text: t("sent.text") })
    ]));
    body.appendChild(h("p", { class: "ref-line" }, [h("span", { class: "muted", text: t("sent.ref") + ": " }), h("strong", { id: "sentRef", text: s.id })]));
    body.appendChild(h("a", { class: "btn btn-whatsapp btn-block", id: "reopenWa", href: s.url, target: "_blank", rel: "noopener noreferrer", text: t("sent.open") }));
    body.appendChild(h("button", {
      class: "btn btn-ghost btn-block", type: "button", id: "copyMsgBtn", text: t("sent.copy"),
      onclick: function () {
        KS.copyText(s.message).then(function (ok) { KS.toast(t(ok ? "sent.copied" : "sent.copyFail"), ok ? "success" : "error"); });
      }
    }));
    body.appendChild(h("details", { class: "preview" }, [
      h("summary", { text: t("sent.preview") }),
      h("pre", { id: "msgPreview", class: "msg-preview", text: s.message })
    ]));
    body.appendChild(h("button", {
      class: "btn btn-primary btn-block", type: "button", id: "clearAfterSend", text: t("sent.clearCart"),
      onclick: function () {
        state.sent = null;
        state.view = "cart";
        state.form = { name: "", phone: "", address: "", notes: "" };
        KS.cart.clear();
        closeDrawer();
        KS.toast(t("sent.cleared"), "success");
      }
    }));
    body.appendChild(h("button", {
      class: "btn btn-ghost btn-block", type: "button", id: "keepCart", text: t("sent.keepCart"),
      onclick: function () { state.sent = null; state.view = "cart"; renderDrawer(); }
    }));
  }

  /* ---------------------------------------------------------
     Errors
     --------------------------------------------------------- */
  function showFatal(err) {
    try { KS.applyI18n(doc); } catch (e) { /* ignore */ }
    $("appError").hidden = false;
    $("appErrorDetail").textContent = String(err && err.message ? err.message : err);
    $("homeSections").hidden = true;
    $("shop").hidden = true;
  }

  /* ---------------------------------------------------------
     Events
     --------------------------------------------------------- */
  function bindEvents() {
    if (bound) return;
    bound = true;

    $("searchInput").addEventListener("input", function (e) {
      state.query = e.target.value;
      $("searchClear").hidden = state.query === "";
      renderCatalog();
    });
    $("searchClear").addEventListener("click", function () {
      state.query = "";
      syncControls();
      renderCatalog();
      $("searchInput").focus();
    });
    $("catFilter").addEventListener("change", function (e) { setCategory(e.target.value); });
    $("sortSelect").addEventListener("change", function (e) { state.sort = e.target.value; renderCatalog(); });
    $("clearFilters").addEventListener("click", clearFilters);
    $("noResultsClear").addEventListener("click", clearFilters);

    $("langBtn").addEventListener("click", function () { KS.setLang(KS.getLang() === "en" ? "hi" : "en"); });
    $("cartBtn").addEventListener("click", openDrawer);
    $("cartBar").addEventListener("click", openDrawer);
    $("drawerClose").addEventListener("click", closeDrawer);
    $("drawerOverlay").addEventListener("click", closeDrawer);

    $("menuBtn").addEventListener("click", function () {
      var nav = $("siteNav");
      var open = nav.hidden;
      nav.hidden = !open;
      $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
    });

    doc.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("[data-goto]") : null;
      if (!a) return;
      e.preventDefault();
      goTo(a.getAttribute("data-goto"));
      if (global.matchMedia && !global.matchMedia("(min-width: 900px)").matches) {
        $("siteNav").hidden = true;
        $("menuBtn").setAttribute("aria-expanded", "false");
      }
    });

    doc.addEventListener("keydown", function (e) {
      if (!state.drawerOpen) return;
      if (doc.querySelector(".modal-overlay")) return;
      if (e.key === "Escape") { closeDrawer(); return; }
      if (e.key === "Tab") {
        var f = $("cartDrawer").querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,summary');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    $("errReload").addEventListener("click", function () { global.location.reload(); });
    $("errReset").addEventListener("click", function () {
      KS.confirm({ title: t("err.reset"), message: t("set.resetConfirm"), okText: t("err.reset"), danger: true }).then(function (ok) {
        if (!ok) return;
        KS.resetDemoData();
        global.location.reload();
      });
    });

    KS.cart.onChange(function () { renderAll(); });

    KS.onLangChange(function () {
      updateLangBtn();
      renderStoreLine();
      buildCategoryFilter();
      renderCategoryTiles();
      renderAll();
    });

    /* Another tab of the SAME browser changed the demo data */
    global.addEventListener("storage", function (e) {
      if (e.key && e.key.indexOf("ks_") !== 0) return;
      KS.invalidateCaches();
      KS.cart.load();
      KS.cart.reconcile();
      renderStoreLine();
      renderCategoryTiles();
      renderAll();
    });
  }

  function init() {
    try {
      KS.initLang();
      KS.applyBranding();
      KS.applyI18n(doc);
      KS.getProducts();
      bindEvents();
      var adjusted = KS.cart.reconcile();
      buildCategoryFilter();
      renderCategoryTiles();
      syncControls();
      renderStoreLine();
      updateLangBtn();
      renderAll();
      if (adjusted) KS.toast(t("cart.stockAdjusted"), "info");
    } catch (err) {
      showFatal(err);
    }
  }

  KS.app = { state: state, renderAll: renderAll, openDrawer: openDrawer, closeDrawer: closeDrawer, goTo: goTo, filteredProducts: filteredProducts, init: init };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
