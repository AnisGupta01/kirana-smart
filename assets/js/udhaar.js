/* ============================================================
   KIRANA SMART - DIGITAL UDHAAR KHATA (DEMO) - PAGE
   UI for udhaar.html. Logic lives in udhaar-core.js.
   All text is inserted with textContent.
   ============================================================ */
(function (global) {
  "use strict";

  var KS = global.KS;
  var U = KS.udhaar;
  var doc = global.document;
  var h = KS.h;
  var t = KS.t;
  function $(id) { return doc.getElementById(id); }

  var data = null;
  var current = null; /* open customer id */
  var query = "";

  function persist() {
    if (!U.save(data)) KS.toast(t("ud.notSaved"), "error");
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(KS.getLang() === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function balanceText(b) {
    if (b > 0) return t("ud.owes", { amount: U.rupees(b) });
    if (b < 0) return t("ud.advance", { amount: U.rupees(-b) });
    return t("ud.clear");
  }

  function renderSummary() {
    var s = U.summary(data);
    $("udTotalDue").textContent = U.rupees(s.due);
    $("udDueCount").textContent = String(s.dueCount);
    $("udCustCount").textContent = String(s.customers);
  }

  function renderList() {
    var list = $("udList");
    KS.clear(list);
    var q = query.toLowerCase();
    var rows = data.customers
      .filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0 || c.phone.indexOf(q) >= 0; })
      .sort(function (a, b) { return U.balance(b) - U.balance(a); });
    rows.forEach(function (c) {
      var b = U.balance(c);
      list.appendChild(h("li", { class: "ud-row", "data-customer": c.id }, [
        h("button", { class: "ud-row-btn", type: "button", "data-open": c.id }, [
          h("span", { class: "ud-row-main" }, [
            h("strong", { class: "ud-row-name", text: c.name }),
            h("span", { class: "muted small", text: c.phone ? "+91 " + c.phone : t("ud.noPhone") })
          ]),
          h("span", { class: "ud-pill " + (b > 0 ? "due" : b < 0 ? "adv" : "clear"), text: balanceText(b) })
        ])
      ]));
    });
    $("udEmpty").hidden = data.customers.length > 0;
    if (data.customers.length && !rows.length) {
      list.appendChild(h("li", { class: "muted ud-nomatch", text: t("ud.noMatch") }));
    }
  }

  function setErr(id, key) {
    var el = $(id);
    el.hidden = !key;
    el.textContent = key ? t(key) : "";
    var input = el.parentNode.querySelector("input");
    if (input) { if (key) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid"); }
  }

  function renderCustomer() {
    var c = U.find(data, current);
    if (!c) { showList(); return; }
    var b = U.balance(c);
    $("udCustName").textContent = c.name;
    $("udCustPhone").textContent = c.phone ? "+91 " + c.phone : t("ud.noPhone");
    var bal = $("udBalance");
    bal.textContent = U.rupees(Math.abs(b));
    bal.className = "ud-bal-value " + (b > 0 ? "due" : b < 0 ? "adv" : "clear");
    $("udBalLabel").textContent = balanceText(b);
    var remind = $("udRemind");
    remind.setAttribute("href", U.reminderUrl(c, data.shopName));
    remind.hidden = b <= 0;
    var body = $("udLedger");
    KS.clear(body);
    var rows = U.ledger(c).reverse();
    rows.forEach(function (e) {
      body.appendChild(h("tr", { "data-entry": e.id }, [
        h("td", { text: fmtDate(e.date) }),
        h("td", { text: e.note || (e.type === "credit" ? t("ud.creditShort") : t("ud.paymentShort")) }),
        h("td", { class: "num " + (e.type === "credit" ? "due" : "adv"), text: (e.type === "credit" ? "+ " : "− ") + U.rupees(e.amount) }),
        h("td", { class: "num", text: U.rupees(e.balance) }),
        h("td", null, h("button", { class: "icon-btn ud-del", type: "button", "data-del-entry": e.id, "aria-label": t("ud.deleteEntry"), text: "✕" }))
      ]));
    });
    $("udNoEntries").hidden = rows.length > 0;
  }

  function showList() {
    current = null;
    $("udCustView").hidden = true;
    $("udListView").hidden = false;
    renderSummary();
    renderList();
  }
  function openCustomer(id) {
    current = id;
    $("udListView").hidden = true;
    $("udCustView").hidden = false;
    setErr("udErrAmount", null);
    setErr("udErrNote", null);
    $("udAmount").value = "";
    $("udNote").value = "";
    renderCustomer();
    renderSummary();
    try { global.scrollTo(0, 0); } catch (e) { /* ignore */ }
    $("udAmount").focus();
  }

  function downloadCSV() {
    if (!data.customers.length) { KS.toast(t("ud.nothingToExport"), "info"); return; }
    var csv = U.toCSV(data);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: "udhaar-khata-" + new Date().toISOString().slice(0, 10) + ".csv" });
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    KS.toast(t("ud.exported"), "success");
  }

  function updateLangBtn() {
    var btn = $("langBtn");
    btn.textContent = KS.getLang() === "en" ? "हिंदी" : "English";
    btn.setAttribute("aria-label", t("lang.switch"));
    btn.setAttribute("lang", KS.getLang() === "en" ? "hi" : "en");
  }

  function bind() {
    $("langBtn").addEventListener("click", function () {
      KS.setLang(KS.getLang() === "en" ? "hi" : "en");
      updateLangBtn();
      if (current) renderCustomer(); else renderList();
    });

    $("udShopName").addEventListener("input", function () {
      data.shopName = KS.cleanText(this.value, 60);
      persist();
    });

    $("udAddForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var r = U.addCustomer(data, { name: $("udName").value, phone: $("udPhone").value });
      setErr("udErrName", r.ok ? null : r.errors.name);
      setErr("udErrPhone", r.ok ? null : r.errors.phone);
      if (!r.ok) { (r.errors.name ? $("udName") : $("udPhone")).focus(); return; }
      persist();
      $("udName").value = "";
      $("udPhone").value = "";
      KS.toast(t("ud.added", { name: r.customer.name }), "success");
      openCustomer(r.customer.id);
    });

    $("udSearch").addEventListener("input", function () { query = this.value.trim(); renderList(); });
    $("udExport").addEventListener("click", downloadCSV);
    $("udSample").addEventListener("click", function () {
      var s = U.sampleData();
      s.shopName = data.shopName;
      data = s;
      persist();
      data = U.load();
      showList();
      KS.toast(t("ud.sampleLoaded"), "success");
    });

    $("udList").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-open]") : null;
      if (btn) openCustomer(btn.getAttribute("data-open"));
    });
    $("udBack").addEventListener("click", showList);

    var entryType = "credit";
    $("udGave").addEventListener("click", function () { entryType = "credit"; });
    $("udGot").addEventListener("click", function () { entryType = "payment"; });
    $("udEntryForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var type = e.submitter && e.submitter.value ? e.submitter.value : entryType;
      var r = U.addEntry(data, current, { type: type, amount: $("udAmount").value, note: $("udNote").value });
      setErr("udErrAmount", r.ok ? null : r.errors.amount || r.errors.type);
      setErr("udErrNote", r.ok ? null : r.errors.note);
      if (!r.ok) { $("udAmount").focus(); return; }
      persist();
      $("udAmount").value = "";
      $("udNote").value = "";
      KS.toast(t(type === "credit" ? "ud.creditAdded" : "ud.paymentAdded", { amount: U.rupees(r.entry.amount) }), "success");
      renderCustomer();
      renderSummary();
      $("udAmount").focus();
    });

    $("udLedger").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-del-entry]") : null;
      if (!btn) return;
      var id = btn.getAttribute("data-del-entry");
      KS.confirm({ title: t("ud.deleteEntry"), message: t("ud.deleteEntryConfirm"), okText: t("common.delete"), danger: true }).then(function (ok) {
        if (!ok) return;
        U.deleteEntry(data, current, id);
        persist();
        renderCustomer();
        renderSummary();
      });
    });

    $("udDelete").addEventListener("click", function () {
      var c = U.find(data, current);
      if (!c) return;
      KS.confirm({ title: t("ud.deleteCustomer"), message: t("ud.deleteCustomerConfirm", { name: c.name }), okText: t("common.delete"), danger: true }).then(function (ok) {
        if (!ok) return;
        U.deleteCustomer(data, c.id);
        persist();
        showList();
        KS.toast(t("ud.deleted"), "info");
      });
    });

    /* Another tab changed the khata */
    global.addEventListener("storage", function (e) {
      if (e.key !== U.KEY) return;
      data = U.load();
      if (current) renderCustomer(); else renderList();
      renderSummary();
    });
  }

  function init() {
    KS.initLang();
    KS.applyI18n(doc);
    updateLangBtn();
    data = U.load();
    var m = /[?&]name=([^&#]*)/.exec(global.location.search || "");
    if (m && !data.shopName) {
      try { data.shopName = KS.cleanText(decodeURIComponent(m[1].replace(/\+/g, " ")), 60); } catch (e) { /* ignore */ }
    }
    $("udShopName").value = data.shopName;
    bind();
    showList();
    if (!KS.storageWorks) KS.toast(t("ud.notSaved"), "error");
  }

  KS.udhaarPage = { init: init };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
