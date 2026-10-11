/* ============================================================
   KIRANA SMART - SHOPKEEPER DASHBOARD (DEMO)
   LocalStorage only: changes stay in this browser on this device.
   There is NO login and NO cloud sync. Not a secure admin system.
   ============================================================ */
(function (global) {
  "use strict";

  var KS = global.KS;
  var h = KS.h;
  var t = KS.t;
  var doc = global.document;

  function $(id) { return doc.getElementById(id); }

  var TABS = ["overview", "products", "orders", "settings"];
  var state = { tab: "overview", invQuery: "", invCat: "all", invStatus: "all", ordFilter: "all" };
  var bound = false;

  /* ---------------------------------------------------------
     Tabs
     --------------------------------------------------------- */
  function showTab(name) {
    if (TABS.indexOf(name) < 0) name = "overview";
    state.tab = name;
    TABS.forEach(function (n) {
      var on = n === name;
      var tab = $("tab-" + n);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.setAttribute("tabindex", on ? "0" : "-1");
      $("panel-" + n).hidden = !on;
    });
    if (name === "overview") renderOverview();
    if (name === "products") renderInventory();
    if (name === "orders") renderOrders();
    if (name === "settings") loadSettingsForm();
  }

  /* ---------------------------------------------------------
     Overview
     --------------------------------------------------------- */
  function isToday(iso) {
    var d = new Date(iso);
    var n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  function statCard(id, label, value) {
    return h("div", { class: "stat", id: id }, [h("span", { class: "stat-label", text: label }), h("strong", { class: "stat-value", text: value })]);
  }

  function renderOverview() {
    var orders = KS.getOrders();
    var products = KS.getProducts();
    var settings = KS.getSettings();
    var today = orders.filter(function (o) { return isToday(o.createdAt); });
    var pending = orders.filter(function (o) { return o.status === "Pending"; }).length;
    var sales = 0;
    today.forEach(function (o) { if (o.status === "Completed") sales += KS.toPaise(o.total); });
    var low = products.filter(function (p) { return KS.productStatus(p, settings) === "low"; });
    var out = products.filter(function (p) { return KS.productStatus(p, settings) === "out"; });

    var stats = $("overviewStats");
    KS.clear(stats);
    stats.appendChild(statCard("stat-orders", t("ov.ordersToday"), String(today.length)));
    stats.appendChild(statCard("stat-pending", t("ov.pending"), String(pending)));
    stats.appendChild(statCard("stat-sales", t("ov.salesToday"), KS.money(sales / 100)));
    stats.appendChild(statCard("stat-low", t("ov.lowStock"), String(low.length)));
    stats.appendChild(statCard("stat-out", t("ov.outOfStock"), String(out.length)));
    stats.appendChild(statCard("stat-total", t("ov.totalProducts"), String(products.length)));

    var chips = $("overviewStatus");
    KS.clear(chips);
    KS.ORDER_STATUSES.forEach(function (s) {
      var n = today.filter(function (o) { return o.status === s; }).length;
      chips.appendChild(h("li", { class: "chip status-" + s.toLowerCase() }, [h("span", { text: t("status." + s) }), h("strong", { text: String(n) })]));
    });

    var list = $("overviewLow");
    KS.clear(list);
    var need = low.concat(out).sort(function (a, b) { return a.stock - b.stock; }).slice(0, 8);
    if (!need.length) list.appendChild(h("li", { class: "muted", text: t("ov.noLow") }));
    need.forEach(function (p) {
      var st = KS.productStatus(p, settings);
      list.appendChild(h("li", null, [
        h("span", { text: p.name + " (" + p.unit + ")" }),
        h("span", { class: "badge badge-" + st, text: st === "out" ? t("inv.status.out") : t("inv.leftN", { n: p.stock }) })
      ]));
    });
  }

  /* ---------------------------------------------------------
     Inventory
     --------------------------------------------------------- */
  function buildCategoryFilter() {
    var sel = $("invCat");
    KS.clear(sel);
    sel.appendChild(h("option", { value: "all", text: t("filter.all") }));
    KS.CATEGORIES.forEach(function (c) { sel.appendChild(h("option", { value: c, text: KS.categoryLabel(c) })); });
    sel.value = state.invCat;
  }

  function updateProduct(id, patch) {
    var list = KS.getProducts().map(function (p) { return p.id === id ? Object.assign({}, p, patch) : p; });
    var saved = KS.saveProducts(list);
    for (var i = 0; i < saved.length; i++) if (saved[i].id === id) return saved[i];
    return null;
  }

  function filteredInventory() {
    var q = state.invQuery.trim().toLowerCase();
    var settings = KS.getSettings();
    return KS.getProducts().filter(function (p) {
      if (state.invCat !== "all" && p.category !== state.invCat) return false;
      if (state.invStatus !== "all" && KS.productStatus(p, settings) !== state.invStatus) return false;
      if (!q) return true;
      return (p.name + " " + p.nameHi + " " + p.id).toLowerCase().indexOf(q) >= 0;
    });
  }

  function invField(label, input) {
    return h("label", { class: "inv-field" }, [h("span", { text: label }), input]);
  }

  function buildRow(p0) {
    var p = p0;
    var statusEl = h("span", { class: "badge" });
    var nameEl = h("strong", { class: "inv-name", text: p.name });
    var priceInput, stockInput, availInput;
    var row = h("li", { class: "inv-row", "data-product": p.id });

    function paint() {
      var st = KS.productStatus(p, KS.getSettings());
      statusEl.className = "badge badge-" + st;
      statusEl.textContent = t("inv.status." + st);
      row.classList.toggle("is-off", st === "unavailable" || st === "out");
    }

    priceInput = h("input", {
      type: "text", inputmode: "decimal", class: "inv-input", "data-field": "price", maxlength: "9", value: String(p.price),
      onchange: function () {
        var v = KS.parseMoney(priceInput.value);
        if (v === null || v <= 0 || v > 100000) {
          priceInput.setAttribute("aria-invalid", "true");
          KS.toast(t("ferr.price"), "error");
          priceInput.value = String(p.price);
          return;
        }
        priceInput.removeAttribute("aria-invalid");
        p = updateProduct(p.id, { price: v }) || p;
        priceInput.value = String(p.price);
        KS.toast(t("inv.priceUpdated"), "success");
      }
    });
    stockInput = h("input", {
      type: "text", inputmode: "numeric", class: "inv-input", "data-field": "stock", maxlength: "4", value: String(p.stock),
      onchange: function () {
        var s = stockInput.value.trim();
        if (!/^\d{1,4}$/.test(s)) {
          stockInput.setAttribute("aria-invalid", "true");
          KS.toast(t("ferr.stock"), "error");
          stockInput.value = String(p.stock);
          return;
        }
        stockInput.removeAttribute("aria-invalid");
        p = updateProduct(p.id, { stock: parseInt(s, 10) }) || p;
        stockInput.value = String(p.stock);
        paint();
        KS.toast(t("inv.stockUpdated"), "success");
      }
    });
    availInput = h("input", {
      type: "checkbox", class: "switch-input", "data-field": "available",
      onchange: function () {
        p = updateProduct(p.id, { available: availInput.checked }) || p;
        paint();
        KS.toast(t("inv.availUpdated"), "success");
      }
    });
    availInput.checked = !!p.available;

    row.appendChild(KS.productImg(p, "inv-thumb"));
    row.appendChild(h("div", { class: "inv-main" }, [
      nameEl,
      h("span", { class: "muted small", text: KS.categoryLabel(p.category) + " · " + p.unit + " · " + p.id }),
      statusEl
    ]));
    row.appendChild(h("div", { class: "inv-controls" }, [
      invField(t("inv.price"), priceInput),
      invField(t("inv.stock"), stockInput),
      h("label", { class: "switch" }, [availInput, h("span", { class: "switch-text", text: t("inv.available") })]),
      h("div", { class: "inv-actions" }, [
        h("button", { class: "btn btn-ghost btn-sm", type: "button", "data-action": "edit", text: t("inv.edit"), "aria-label": t("inv.editAria", { name: p.name }), onclick: function () { openProductForm(p); } }),
        h("button", {
          class: "btn btn-danger-ghost btn-sm", type: "button", "data-action": "delete", text: t("inv.delete"), "aria-label": t("inv.deleteAria", { name: p.name }),
          onclick: function () {
            KS.confirm({ title: t("inv.delete"), message: t("inv.deleteConfirm", { name: p.name }), okText: t("inv.delete"), danger: true }).then(function (ok) {
              if (!ok) return;
              KS.saveProducts(KS.getProducts().filter(function (x) { return x.id !== p.id; }));
              KS.toast(t("inv.deleted"), "success");
              renderInventory();
            });
          }
        })
      ])
    ]));
    paint();
    return row;
  }

  function renderInventory() {
    var list = filteredInventory();
    var ul = $("invList");
    KS.clear(ul);
    list.forEach(function (p) { ul.appendChild(buildRow(p)); });
    ul.hidden = list.length === 0;
    $("invEmpty").hidden = list.length > 0;
    $("invCount").textContent = t("results.count", { n: list.length });
  }

  /* ---- Add / edit product form ---- */
  function pfield(key, label, input, hint) {
    return h("div", { class: "field", id: "pfield-" + key }, [
      h("label", { for: "pf-" + key, text: label }),
      input,
      hint ? h("p", { class: "hint", text: hint }) : null,
      h("p", { class: "field-error", id: "pferr-" + key, role: "alert", hidden: true })
    ]);
  }

  function openProductForm(existing) {
    var isEdit = !!existing;
    var p = existing || { name: "", nameHi: "", category: "atta", price: "", mrp: "", unit: "", stock: "", available: true, featured: false, popular: false, image: "" };
    var catSel = h("select", { id: "pf-category" }, KS.CATEGORIES.map(function (c) { return h("option", { value: c, text: KS.categoryLabel(c) }); }));
    catSel.value = p.category;
    var cbAvail = h("input", { type: "checkbox", id: "pf-available" });
    var cbFeat = h("input", { type: "checkbox", id: "pf-featured" });
    var cbPop = h("input", { type: "checkbox", id: "pf-popular" });
    cbAvail.checked = !!p.available;
    cbFeat.checked = !!p.featured;
    cbPop.checked = !!p.popular;

    var form = h("form", { id: "productForm", novalidate: true }, [
      pfield("name", t("form.name"), h("input", { id: "pf-name", type: "text", maxlength: "80", autocomplete: "off", value: p.name })),
      pfield("nameHi", t("form.nameHi"), h("input", { id: "pf-nameHi", type: "text", maxlength: "80", autocomplete: "off", value: p.nameHi || "" })),
      pfield("category", t("form.category"), catSel),
      h("div", { class: "field-row" }, [
        pfield("price", t("form.price"), h("input", { id: "pf-price", type: "text", inputmode: "decimal", maxlength: "9", autocomplete: "off", value: p.price === "" ? "" : String(p.price) })),
        pfield("mrp", t("form.mrp"), h("input", { id: "pf-mrp", type: "text", inputmode: "decimal", maxlength: "9", autocomplete: "off", value: p.mrp ? String(p.mrp) : "" }))
      ]),
      h("div", { class: "field-row" }, [
        pfield("unit", t("form.unit"), h("input", { id: "pf-unit", type: "text", maxlength: "30", autocomplete: "off", value: p.unit })),
        pfield("stock", t("form.stock"), h("input", { id: "pf-stock", type: "text", inputmode: "numeric", maxlength: "4", autocomplete: "off", value: p.stock === "" ? "" : String(p.stock) }))
      ]),
      pfield("image", t("form.image"), h("input", { id: "pf-image", type: "text", maxlength: "300", autocomplete: "off", value: p.image || "" }), t("form.imageHint")),
      h("div", { class: "check-row" }, [
        h("label", { class: "check" }, [cbAvail, h("span", { text: t("form.available") })]),
        h("label", { class: "check" }, [cbFeat, h("span", { text: t("form.featured") })]),
        h("label", { class: "check" }, [cbPop, h("span", { text: t("form.popular") })])
      ]),
      h("div", { class: "modal-actions" }, [
        h("button", { class: "btn btn-ghost", type: "button", id: "pf-cancel", text: t("common.cancel") }),
        h("button", { class: "btn btn-primary", type: "submit", id: "pf-save", text: t("common.save") })
      ])
    ]);

    var modal = KS.modal({ title: t(isEdit ? "form.editTitle" : "form.addTitle"), body: form, focus: "#pf-name" });
    $("pf-cancel").addEventListener("click", function () { modal.close(false); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = KS.validateProductInput({
        name: $("pf-name").value, nameHi: $("pf-nameHi").value, category: $("pf-category").value,
        price: $("pf-price").value, mrp: $("pf-mrp").value, unit: $("pf-unit").value, stock: $("pf-stock").value,
        image: $("pf-image").value, available: cbAvail.checked, featured: cbFeat.checked, popular: cbPop.checked
      });
      ["name", "nameHi", "category", "price", "mrp", "unit", "stock", "image"].forEach(function (k) {
        var er = $("pferr-" + k);
        var inp = $("pf-" + k);
        if (res.errors[k]) { er.textContent = t(res.errors[k]); er.hidden = false; inp.setAttribute("aria-invalid", "true"); }
        else { er.textContent = ""; er.hidden = true; inp.removeAttribute("aria-invalid"); }
      });
      if (!res.ok) {
        var first = ["name", "nameHi", "category", "price", "mrp", "unit", "stock", "image"].filter(function (k) { return res.errors[k]; })[0];
        $("pf-" + first).focus();
        return;
      }
      var v = res.value;
      if (isEdit) {
        updateProduct(existing.id, v);
        KS.toast(t("inv.updated"), "success");
      } else {
        var np = Object.assign({ id: KS.nextProductId() }, v);
        KS.saveProducts(KS.getProducts().concat([np]));
        KS.toast(t("inv.added"), "success");
      }
      modal.close(true);
      renderInventory();
    });
  }

  /* ---------------------------------------------------------
     Orders
     --------------------------------------------------------- */
  function buildOrderFilter() {
    var sel = $("ordFilter");
    KS.clear(sel);
    sel.appendChild(h("option", { value: "all", text: t("inv.all") }));
    KS.ORDER_STATUSES.forEach(function (s) { sel.appendChild(h("option", { value: s, text: t("status." + s) })); });
    sel.value = state.ordFilter;
  }

  function setOrderStatus(id, status) {
    if (KS.ORDER_STATUSES.indexOf(status) < 0) return false;
    var changed = false;
    var list = KS.getOrders().map(function (o) {
      if (o.id === id) { changed = true; return Object.assign({}, o, { status: status }); }
      return o;
    });
    if (changed) KS.saveOrders(list);
    return changed;
  }

  function typeLabel(o) { return t(o.type === "delivery" ? "checkout.delivery" : "checkout.pickup"); }

  function renderOrders() {
    var all = KS.getOrders().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var list = all.filter(function (o) { return state.ordFilter === "all" || o.status === state.ordFilter; });
    var ul = $("orderList");
    KS.clear(ul);
    list.forEach(function (o) {
      var badge = h("span", { class: "badge status-" + o.status.toLowerCase(), text: t("status." + o.status) });
      var select = h("select", {
        class: "status-select", "aria-label": t("ord.changeStatus", { id: o.id }), "data-order": o.id,
        onchange: function () {
          if (setOrderStatus(o.id, select.value)) {
            o.status = select.value;
            badge.className = "badge status-" + o.status.toLowerCase();
            badge.textContent = t("status." + o.status);
            KS.toast(t("ord.statusUpdated"), "success");
          }
        }
      }, KS.ORDER_STATUSES.map(function (s) { return h("option", { value: s, text: t("status." + s) }); }));
      select.value = o.status;
      ul.appendChild(h("li", { class: "order-card", "data-order-card": o.id }, [
        h("div", { class: "order-head" }, [
          h("strong", { text: o.id }),
          o.sample ? h("span", { class: "badge badge-sample", text: t("ord.sample") }) : null,
          badge
        ]),
        h("p", { class: "muted small", text: KS.formatDateTime(o.createdAt) }),
        h("p", null, [
          h("span", { text: o.customerName + " · " + typeLabel(o) }),
          h("br"),
          h("span", { class: "muted", text: t("ord.itemsCount", { n: o.items.reduce(function (n, i) { return n + i.qty; }, 0) }) + " · " }),
          h("strong", { text: KS.money(o.total) })
        ]),
        h("div", { class: "order-actions" }, [
          select,
          h("button", { class: "btn btn-ghost btn-sm", type: "button", "data-action": "details", text: t("ord.view"), onclick: function () { openOrderDetail(o.id); } })
        ])
      ]));
    });
    ul.hidden = list.length === 0;
    $("orderEmpty").hidden = list.length > 0;
  }

  function openOrderDetail(id) {
    var o = KS.getOrders().filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var statusRow = h("div", { class: "seg", role: "group", "aria-label": t("ord.status") });
    function paintSeg() {
      KS.clear(statusRow);
      KS.ORDER_STATUSES.forEach(function (s) {
        statusRow.appendChild(h("button", {
          class: "seg-btn" + (o.status === s ? " is-on" : ""), type: "button", "data-status": s, "aria-pressed": o.status === s ? "true" : "false",
          text: t("status." + s),
          onclick: function () {
            if (setOrderStatus(o.id, s)) {
              o.status = s;
              paintSeg();
              var on = statusRow.querySelector('[data-status="' + s + '"]');
              if (on) on.focus();
              renderOrders();
              KS.toast(t("ord.statusUpdated"), "success");
            }
          }
        }));
      });
    }
    paintSeg();

    var items = h("ul", { class: "summary-list" });
    o.items.forEach(function (it) {
      items.appendChild(h("li", null, [
        h("span", { text: it.qty + " × " + it.name + " (" + it.unit + ")" }),
        h("span", { text: KS.money(KS.toPaise(it.price) * it.qty / 100) })
      ]));
    });

    function row(label, value) { return h("div", { class: "kv" }, [h("dt", { text: label }), h("dd", { text: value })]); }
    var dl = h("dl", { class: "kv-list" }, [
      row(t("ord.placed"), KS.formatDateTime(o.createdAt)),
      row(t("ord.customer"), o.customerName),
      row(t("ord.phone"), KS.maskPhone(o.phone)),
      row(t("ord.type"), typeLabel(o)),
      o.type === "delivery" ? row(t("ord.address"), o.address) : null,
      row(t("ord.notes"), o.notes || "-")
    ]);

    var body = h("div", null, [
      o.sample ? h("p", { class: "alert alert-info", text: t("ord.sampleNote") }) : null,
      statusRow, dl,
      h("h3", { text: t("ord.items") }), items,
      h("div", { class: "summary" }, [
        h("div", { class: "total-row" }, [h("span", { text: t("cart.subtotal") }), h("span", { text: KS.money(o.subtotal) })]),
        h("div", { class: "total-row" }, [h("span", { text: t("cart.delivery") }), h("span", { text: o.type === "delivery" ? (o.deliveryFee > 0 ? KS.money(o.deliveryFee) : t("cart.free")) : t("checkout.feeNA") })]),
        h("div", { class: "total-row total-final" }, [h("strong", { text: t("cart.total") }), h("strong", { text: KS.money(o.total) })])
      ])
    ]);
    KS.modal({ title: t("ord.detail") + " - " + o.id, body: body });
  }

  /* ---------------------------------------------------------
     Settings
     --------------------------------------------------------- */
  var SETTING_FIELDS = ["storeName", "storeLocation", "whatsappNumber", "deliveryFee", "freeDeliveryAbove", "lowStockThreshold", "deliveryNote"];

  function loadSettingsForm() {
    var s = KS.getSettings();
    SETTING_FIELDS.forEach(function (k) {
      $("s-" + k).value = s[k] === undefined || s[k] === null ? "" : String(s[k]);
      $("serr-" + k).hidden = true;
      $("s-" + k).removeAttribute("aria-invalid");
    });
    $("settingsMsg").hidden = true;
  }

  function onSaveSettings(e) {
    e.preventDefault();
    var input = {};
    SETTING_FIELDS.forEach(function (k) { input[k] = $("s-" + k).value; });
    var res = KS.validateSettingsInput(input);
    SETTING_FIELDS.forEach(function (k) {
      var er = $("serr-" + k);
      var inp = $("s-" + k);
      if (res.errors[k]) { er.textContent = t(res.errors[k]); er.hidden = false; inp.setAttribute("aria-invalid", "true"); }
      else { er.textContent = ""; er.hidden = true; inp.removeAttribute("aria-invalid"); }
    });
    var msg = $("settingsMsg");
    if (!res.ok) {
      msg.hidden = true;
      var first = SETTING_FIELDS.filter(function (k) { return res.errors[k]; })[0];
      $("s-" + first).focus();
      KS.toast(t("err.fixForm"), "error");
      return;
    }
    KS.saveSettings(res.value);
    msg.textContent = t("set.saved");
    msg.hidden = false;
    KS.toast(t("set.saved"), "success");
  }

  function onResetDemo() {
    KS.confirm({ title: t("set.reset"), message: t("set.resetConfirm"), okText: t("set.reset"), danger: true }).then(function (ok) {
      if (!ok) return;
      KS.resetDemoData();
      KS.invalidateCaches();
      loadSettingsForm();
      KS.toast(t("set.resetDone"), "success");
    });
  }

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */
  function updateLangBtn() {
    var btn = $("langBtn");
    btn.textContent = KS.getLang() === "en" ? "हिंदी" : "English";
    btn.setAttribute("aria-label", t("lang.switch"));
    btn.setAttribute("lang", KS.getLang() === "en" ? "hi" : "en");
  }

  function rerenderAll() {
    updateLangBtn();
    buildCategoryFilter();
    buildOrderFilter();
    showTab(state.tab);
  }

  function bindEvents() {
    if (bound) return;
    bound = true;
    TABS.forEach(function (n) {
      $("tab-" + n).addEventListener("click", function () { showTab(n); if (global.history && global.history.replaceState) global.history.replaceState(null, "", "#" + n); });
      $("tab-" + n).addEventListener("keydown", function (e) {
        var i = TABS.indexOf(n);
        var next = null;
        if (e.key === "ArrowRight") next = TABS[(i + 1) % TABS.length];
        else if (e.key === "ArrowLeft") next = TABS[(i + TABS.length - 1) % TABS.length];
        if (next) { e.preventDefault(); showTab(next); $("tab-" + next).focus(); }
      });
    });
    $("langBtn").addEventListener("click", function () { KS.setLang(KS.getLang() === "en" ? "hi" : "en"); });
    KS.onLangChange(rerenderAll);

    $("invSearch").addEventListener("input", function (e) { state.invQuery = e.target.value; renderInventory(); });
    $("invCat").addEventListener("change", function (e) { state.invCat = e.target.value; renderInventory(); });
    $("invStatus").addEventListener("change", function (e) { state.invStatus = e.target.value; renderInventory(); });
    $("addProductBtn").addEventListener("click", function () { openProductForm(null); });
    $("ordFilter").addEventListener("change", function (e) { state.ordFilter = e.target.value; renderOrders(); });
    $("settingsForm").addEventListener("submit", onSaveSettings);
    $("resetDemoBtn").addEventListener("click", onResetDemo);
    $("errReset").addEventListener("click", function () {
      KS.confirm({ title: t("err.reset"), message: t("set.resetConfirm"), okText: t("err.reset"), danger: true }).then(function (ok) {
        if (!ok) return;
        KS.resetDemoData();
        global.location.reload();
      });
    });
  }

  function init() {
    try {
      KS.initLang();
      KS.applyBranding();
      KS.applyI18n(doc);
      KS.getProducts();
      KS.getOrders();
      bindEvents();
      buildCategoryFilter();
      buildOrderFilter();
      updateLangBtn();
      var hash = (global.location && global.location.hash || "").replace("#", "");
      showTab(TABS.indexOf(hash) >= 0 ? hash : "overview");
    } catch (err) {
      try { KS.applyI18n(doc); } catch (e2) { /* ignore */ }
      $("appError").hidden = false;
      $("appErrorDetail").textContent = String(err && err.message ? err.message : err);
      $("adminApp").hidden = true;
    }
  }

  KS.admin = { state: state, showTab: showTab, init: init };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
