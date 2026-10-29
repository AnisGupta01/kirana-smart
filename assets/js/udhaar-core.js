/* ============================================================
   KIRANA SMART - DIGITAL UDHAAR KHATA (DEMO) - LOGIC
   A simple credit record book for the shopkeeper. Data lives
   ONLY in this browser (LocalStorage). Kirana Smart does not
   lend money; this only records what the shop has given on
   credit and what it has received back.
   Amounts are stored as whole paise to avoid rounding errors.
   ============================================================ */
(function (global) {
  "use strict";

  var KS = global.KS;
  var KEY = "ks_udhaar_v1";
  var MAX_AMOUNT = 1000000; /* ₹10,00,000 per entry */
  var MAX_CUSTOMERS = 500;
  var MAX_ENTRIES = 1000;

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }
  function isoOr(v, d) {
    var t = Date.parse(v);
    return isFinite(t) ? new Date(t).toISOString() : d;
  }

  function sanitizeEntry(e) {
    if (!e || typeof e !== "object") return null;
    var type = e.type === "payment" ? "payment" : e.type === "credit" ? "credit" : null;
    var amount = Math.round(Number(e.amount));
    if (!type || !isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT * 100) return null;
    return {
      id: KS.cleanText(e.id, 40) || uid("e"),
      type: type,
      amount: amount,
      note: KS.cleanText(e.note, 80),
      date: isoOr(e.date, new Date().toISOString())
    };
  }
  function sanitizeCustomer(c) {
    if (!c || typeof c !== "object") return null;
    var name = KS.cleanText(c.name, 60);
    if (!name) return null;
    var phone = KS.cleanText(c.phone, 10);
    if (!/^[6-9]\d{9}$/.test(phone)) phone = "";
    var entries = Array.isArray(c.entries) ? c.entries.map(sanitizeEntry).filter(Boolean).slice(0, MAX_ENTRIES) : [];
    return {
      id: KS.cleanText(c.id, 40) || uid("c"),
      name: name,
      phone: phone,
      createdAt: isoOr(c.createdAt, new Date().toISOString()),
      entries: entries
    };
  }

  var U = {};
  U.KEY = KEY;

  U.load = function () {
    var raw = KS.readJSON(KEY, null);
    var data = { shopName: "", customers: [] };
    if (raw && typeof raw === "object") {
      data.shopName = KS.cleanText(raw.shopName, 60);
      if (Array.isArray(raw.customers)) {
        var seen = {};
        raw.customers.forEach(function (c) {
          var s = sanitizeCustomer(c);
          if (s && !seen[s.id]) { seen[s.id] = true; data.customers.push(s); }
        });
      }
    }
    return data;
  };
  U.save = function (data) { return KS.writeJSON(KEY, data); };

  U.find = function (data, id) {
    for (var i = 0; i < data.customers.length; i++) if (data.customers[i].id === id) return data.customers[i];
    return null;
  };

  /* Returns { ok, errors, customer } */
  U.addCustomer = function (data, input) {
    var errors = {};
    var n = KS.validateName(input && input.name);
    if (!n.ok) errors.name = "ud.err.name";
    var phone = "";
    if (input && KS.cleanText(input.phone, 20) !== "") {
      var p = KS.validatePhone(input.phone);
      if (!p.ok) errors.phone = "ud.err.phone";
      else phone = p.value;
    }
    if (!errors.phone && phone && data.customers.some(function (c) { return c.phone === phone; })) errors.phone = "ud.err.dupPhone";
    if (data.customers.length >= MAX_CUSTOMERS) errors.name = "ud.err.tooMany";
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    var c = { id: uid("c"), name: n.value, phone: phone, createdAt: new Date().toISOString(), entries: [] };
    data.customers.push(c);
    return { ok: true, customer: c };
  };

  U.deleteCustomer = function (data, id) {
    var before = data.customers.length;
    data.customers = data.customers.filter(function (c) { return c.id !== id; });
    return data.customers.length < before;
  };

  /* type: "credit" (udhaar diya) or "payment" (paisa mila). amount in rupees (text or number). */
  U.addEntry = function (data, customerId, input) {
    var c = U.find(data, customerId);
    if (!c) return { ok: false, errors: { amount: "ud.err.noCustomer" } };
    var type = input && (input.type === "payment" || input.type === "credit") ? input.type : null;
    var rupees = KS.parseMoney(input && input.amount);
    var errors = {};
    if (!type) errors.type = "ud.err.type";
    if (rupees === null || rupees <= 0 || rupees > MAX_AMOUNT) errors.amount = "ud.err.amount";
    var noteRaw = String((input && input.note) || "");
    if (noteRaw.trim().length > 80) errors.note = "ud.err.note";
    if (c.entries.length >= MAX_ENTRIES) errors.amount = "ud.err.tooMany";
    if (Object.keys(errors).length) return { ok: false, errors: errors };
    var e = { id: uid("e"), type: type, amount: KS.toPaise(rupees), note: KS.cleanText(noteRaw, 80), date: isoOr(input.date, new Date().toISOString()) };
    c.entries.push(e);
    return { ok: true, entry: e };
  };

  U.deleteEntry = function (data, customerId, entryId) {
    var c = U.find(data, customerId);
    if (!c) return false;
    var before = c.entries.length;
    c.entries = c.entries.filter(function (e) { return e.id !== entryId; });
    return c.entries.length < before;
  };

  /* Balance in paise. Positive = customer still has to pay the shop. */
  U.balance = function (c) {
    var b = 0;
    (c.entries || []).forEach(function (e) { b += e.type === "credit" ? e.amount : -e.amount; });
    return b;
  };

  /* Entries oldest first, each with the running balance after it (paise). */
  U.ledger = function (c) {
    var list = (c.entries || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var run = 0;
    return list.map(function (e) {
      run += e.type === "credit" ? e.amount : -e.amount;
      return { id: e.id, type: e.type, amount: e.amount, note: e.note, date: e.date, balance: run };
    });
  };

  U.summary = function (data) {
    var due = 0, dueCount = 0, advance = 0;
    data.customers.forEach(function (c) {
      var b = U.balance(c);
      if (b > 0) { due += b; dueCount += 1; } else if (b < 0) advance += -b;
    });
    return { customers: data.customers.length, due: due, dueCount: dueCount, advance: advance };
  };

  U.rupees = function (paise) {
    var r = paise / 100;
    return "₹" + (Number.isInteger(r) ? r.toLocaleString("en-IN") : r.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  /* Polite Hindi reminder. The shopkeeper reads it in WhatsApp and presses Send. */
  U.reminderMessage = function (c, shopName) {
    var shop = KS.cleanText(shopName, 60);
    var b = U.balance(c);
    var lines = ["नमस्ते " + c.name + " जी 🙏"];
    lines.push((shop ? shop + " की तरफ़ से " : "") + "एक छोटी-सी याद: आपके खाते में " + U.rupees(Math.max(b, 0)) + " बाकी हैं।");
    lines.push("सुविधा अनुसार भुगतान कर दीजिए। कोई सवाल हो तो इसी नंबर पर बताइए।");
    lines.push("धन्यवाद!");
    return lines.join("\n");
  };
  U.reminderUrl = function (c, shopName) {
    var text = encodeURIComponent(U.reminderMessage(c, shopName));
    return c.phone ? "https://wa.me/91" + c.phone + "?text=" + text : "https://wa.me/?text=" + text;
  };

  /* CSV with a BOM so Excel shows Hindi correctly. Cells that start with
     = + - @ are prefixed with ' so spreadsheets never run them as formulas. */
  function csvCell(v) {
    var s = String(v === null || v === undefined ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  U.toCSV = function (data) {
    var rows = [["Customer", "Phone", "Date", "Type", "Amount (INR)", "Note", "Balance after (INR)"]];
    data.customers.forEach(function (c) {
      U.ledger(c).forEach(function (e) {
        rows.push([c.name, c.phone, e.date.slice(0, 10), e.type === "credit" ? "Udhaar (credit given)" : "Payment received",
          (e.amount / 100).toFixed(2), e.note, (e.balance / 100).toFixed(2)]);
      });
      if (!c.entries.length) rows.push([c.name, c.phone, "", "", "", "", "0.00"]);
    });
    return "\uFEFF" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  };

  /* Fictional customers for the demo (masked-looking but invalid numbers are not used: phone left empty). */
  U.sampleData = function (now) {
    now = now || Date.now();
    var day = 86400000;
    function d(n) { return new Date(now - n * day).toISOString(); }
    return {
      shopName: "",
      customers: [
        { id: "cs1", name: "Ramesh Ji (sample)", phone: "", createdAt: d(30), entries: [
          { id: "s1", type: "credit", amount: 85000, note: "Monthly ration (sample)", date: d(20) },
          { id: "s2", type: "payment", amount: 50000, note: "UPI (sample)", date: d(10) },
          { id: "s3", type: "credit", amount: 12000, note: "Milk + bread (sample)", date: d(2) }] },
        { id: "cs2", name: "Sunita Didi (sample)", phone: "", createdAt: d(25), entries: [
          { id: "s4", type: "credit", amount: 42050, note: "Atta, dal, oil (sample)", date: d(6) }] },
        { id: "cs3", name: "Verma Uncle (sample)", phone: "", createdAt: d(40), entries: [
          { id: "s5", type: "credit", amount: 30000, note: "Sample", date: d(15) },
          { id: "s6", type: "payment", amount: 30000, note: "Cash (sample)", date: d(1) }] }
      ]
    };
  };

  KS.udhaar = U;
})(window);
