/* ============================================================
   KIRANA SMART - DEMO PRODUCTS AND SAMPLE ORDERS
   ------------------------------------------------------------
   ALL PRODUCTS, PRICES AND STOCK BELOW ARE SAMPLE DATA.
   The shop owner MUST verify every item, price and pack size
   before real use. Names are generic (no brands) on purpose.

   Each product:
     id         unique text id (keep unique!)
     name       English name (used in WhatsApp message)
     nameHi     Hindi name (optional, shown when Hindi is selected)
     category   one of: atta, rice, dal, oil, dairy, snacks,
                beverages, personal, cleaning
     price      selling price in INR (must be above 0)
     mrp        optional original price (shows an offer badge
                when it is higher than price)
     unit       pack size, e.g. "1 kg"
     stock      units available (whole number, 0 or more)
     available  true/false - false hides the Add button
     featured   true = shown in "Featured products"
     popular    true = shown in "Popular products"
     image      optional https:// link or assets/images/ file.
                Leave "" for an automatic picture.

   NOTE: after the first visit, products are kept in the browser
   (LocalStorage). To see edits made to this file, open
   admin.html > Settings > Reset demo data (or clear site data).
   ============================================================ */
window.KS_DEFAULT_PRODUCTS = [
  /* Atta and flour */
  { id: "p001", name: "Whole Wheat Atta", nameHi: "गेहूं का आटा", category: "atta", price: 235, mrp: 260, unit: "5 kg", stock: 40, available: true, featured: true, popular: true, image: "" },
  { id: "p002", name: "Multigrain Atta", nameHi: "मल्टीग्रेन आटा", category: "atta", price: 310, mrp: null, unit: "5 kg", stock: 18, available: true, featured: false, popular: false, image: "" },
  { id: "p003", name: "Maida (Refined Flour)", nameHi: "मैदा", category: "atta", price: 48, mrp: null, unit: "1 kg", stock: 30, available: true, featured: false, popular: false, image: "" },
  { id: "p004", name: "Besan (Gram Flour)", nameHi: "बेसन", category: "atta", price: 62, mrp: null, unit: "500 g", stock: 25, available: true, featured: false, popular: true, image: "" },

  /* Rice and grains */
  { id: "p005", name: "Basmati Rice", nameHi: "बासमती चावल", category: "rice", price: 520, mrp: 575, unit: "5 kg", stock: 22, available: true, featured: true, popular: false, image: "" },
  { id: "p006", name: "Regular Rice", nameHi: "सादा चावल", category: "rice", price: 290, mrp: null, unit: "5 kg", stock: 35, available: true, featured: false, popular: true, image: "" },
  { id: "p007", name: "Poha (Flattened Rice)", nameHi: "पोहा", category: "rice", price: 44, mrp: null, unit: "500 g", stock: 28, available: true, featured: false, popular: false, image: "" },
  { id: "p008", name: "Sooji (Semolina)", nameHi: "सूजी", category: "rice", price: 38, mrp: null, unit: "500 g", stock: 4, available: true, featured: false, popular: false, image: "" },

  /* Pulses and dal */
  { id: "p009", name: "Toor Dal (Arhar)", nameHi: "अरहर दाल", category: "dal", price: 165, mrp: null, unit: "1 kg", stock: 30, available: true, featured: false, popular: true, image: "" },
  { id: "p010", name: "Moong Dal", nameHi: "मूंग दाल", category: "dal", price: 140, mrp: null, unit: "1 kg", stock: 26, available: true, featured: true, popular: false, image: "" },
  { id: "p011", name: "Chana Dal", nameHi: "चना दाल", category: "dal", price: 98, mrp: 110, unit: "1 kg", stock: 32, available: true, featured: false, popular: false, image: "" },
  { id: "p012", name: "Masoor Dal", nameHi: "मसूर दाल", category: "dal", price: 105, mrp: null, unit: "1 kg", stock: 0, available: true, featured: false, popular: false, image: "" },

  /* Cooking oil and ghee */
  { id: "p013", name: "Mustard Oil", nameHi: "सरसों का तेल", category: "oil", price: 155, mrp: null, unit: "1 L", stock: 24, available: true, featured: true, popular: false, image: "" },
  { id: "p014", name: "Refined Sunflower Oil", nameHi: "सनफ्लावर तेल", category: "oil", price: 140, mrp: 155, unit: "1 L", stock: 30, available: true, featured: false, popular: true, image: "" },
  { id: "p015", name: "Pure Desi Ghee", nameHi: "देसी घी", category: "oil", price: 340, mrp: null, unit: "500 ml", stock: 12, available: true, featured: false, popular: false, image: "" },

  /* Dairy and eggs */
  { id: "p016", name: "Toned Milk (Packet)", nameHi: "टोंड दूध", category: "dairy", price: 29, mrp: null, unit: "500 ml", stock: 50, available: true, featured: false, popular: true, image: "" },
  { id: "p017", name: "Fresh Paneer", nameHi: "ताज़ा पनीर", category: "dairy", price: 85, mrp: null, unit: "200 g", stock: 10, available: true, featured: true, popular: false, image: "" },
  { id: "p018", name: "Curd (Dahi)", nameHi: "दही", category: "dairy", price: 40, mrp: null, unit: "400 g", stock: 20, available: true, featured: false, popular: false, image: "" },
  { id: "p019", name: "Eggs", nameHi: "अंडे", category: "dairy", price: 84, mrp: null, unit: "12 pcs", stock: 15, available: true, featured: false, popular: false, image: "" },

  /* Biscuits and snacks */
  { id: "p020", name: "Glucose Biscuits", nameHi: "ग्लूकोज़ बिस्कुट", category: "snacks", price: 30, mrp: null, unit: "250 g", stock: 60, available: true, featured: false, popular: true, image: "" },
  { id: "p021", name: "Cream Biscuits", nameHi: "क्रीम बिस्कुट", category: "snacks", price: 25, mrp: null, unit: "120 g", stock: 45, available: true, featured: false, popular: false, image: "" },
  { id: "p022", name: "Namkeen Mixture", nameHi: "नमकीन मिक्सचर", category: "snacks", price: 95, mrp: 110, unit: "400 g", stock: 20, available: true, featured: false, popular: false, image: "" },
  { id: "p023", name: "Potato Chips", nameHi: "आलू चिप्स", category: "snacks", price: 20, mrp: null, unit: "90 g", stock: 50, available: true, featured: false, popular: true, image: "" },

  /* Beverages */
  { id: "p024", name: "Tea Leaves (Chai Patti)", nameHi: "चाय पत्ती", category: "beverages", price: 235, mrp: null, unit: "500 g", stock: 18, available: true, featured: true, popular: true, image: "" },
  { id: "p025", name: "Instant Coffee", nameHi: "इंस्टेंट कॉफ़ी", category: "beverages", price: 165, mrp: null, unit: "50 g", stock: 14, available: true, featured: false, popular: false, image: "" },
  { id: "p026", name: "Mango Fruit Drink", nameHi: "मैंगो ड्रिंक", category: "beverages", price: 85, mrp: 95, unit: "1 L", stock: 24, available: true, featured: false, popular: false, image: "" },
  { id: "p027", name: "Packaged Drinking Water", nameHi: "पैकेज्ड पीने का पानी", category: "beverages", price: 20, mrp: null, unit: "1 L", stock: 80, available: true, featured: false, popular: false, image: "" },

  /* Personal care */
  { id: "p028", name: "Bathing Soap", nameHi: "नहाने का साबुन", category: "personal", price: 38, mrp: null, unit: "100 g", stock: 40, available: true, featured: false, popular: true, image: "" },
  { id: "p029", name: "Herbal Shampoo", nameHi: "हर्बल शैम्पू", category: "personal", price: 130, mrp: 150, unit: "180 ml", stock: 15, available: true, featured: false, popular: false, image: "" },
  { id: "p030", name: "Toothpaste", nameHi: "टूथपेस्ट", category: "personal", price: 95, mrp: null, unit: "150 g", stock: 30, available: true, featured: false, popular: false, image: "" },

  /* Household cleaning */
  { id: "p031", name: "Detergent Powder", nameHi: "डिटर्जेंट पाउडर", category: "cleaning", price: 110, mrp: null, unit: "1 kg", stock: 28, available: true, featured: false, popular: true, image: "" },
  { id: "p032", name: "Dishwash Liquid", nameHi: "बर्तन धोने का लिक्विड", category: "cleaning", price: 99, mrp: null, unit: "500 ml", stock: 3, available: true, featured: false, popular: false, image: "" },
  { id: "p033", name: "Floor Cleaner", nameHi: "फ़र्श क्लीनर", category: "cleaning", price: 175, mrp: 199, unit: "1 L", stock: 12, available: true, featured: false, popular: false, image: "" }
];

/* Sample orders for the dashboard demo. ALL FICTIONAL.
   Phone numbers are deliberately masked placeholders.
   minsAgo = how many minutes before "now" the order was created. */
window.KS_SAMPLE_ORDER_DEFS = [
  { n: 1, minsAgo: 18, status: "Pending", name: "Demo Customer A", phone: "98XXXXXX01", type: "delivery",
    address: "Flat 0, Sample Apartments, Demo Colony (fictional address)", notes: "Please call before arriving (sample note).",
    items: [["p001", 1], ["p009", 2], ["p016", 4]] },
  { n: 2, minsAgo: 55, status: "Accepted", name: "Demo Customer B", phone: "97XXXXXX02", type: "pickup",
    address: "", notes: "",
    items: [["p005", 1], ["p013", 1], ["p024", 1]] },
  { n: 3, minsAgo: 140, status: "Ready", name: "Demo Customer C", phone: "96XXXXXX03", type: "pickup",
    address: "", notes: "Will collect after 7 pm (sample note).",
    items: [["p020", 3], ["p023", 2], ["p026", 1]] },
  { n: 4, minsAgo: 260, status: "Completed", name: "Demo Customer D", phone: "99XXXXXX04", type: "delivery",
    address: "House 0, Sample Lane, Demo Colony (fictional address)", notes: "",
    items: [["p006", 1], ["p010", 1], ["p031", 1], ["p028", 4]] },
  { n: 5, minsAgo: 380, status: "Completed", name: "Demo Customer E", phone: "95XXXXXX05", type: "delivery",
    address: "Shop 0, Sample Market, Demo Colony (fictional address)", notes: "Leave at the gate (sample note).",
    items: [["p002", 1], ["p014", 2], ["p017", 2], ["p019", 1]] },
  { n: 6, minsAgo: 500, status: "Cancelled", name: "Demo Customer F", phone: "94XXXXXX06", type: "pickup",
    address: "", notes: "Customer cancelled (sample).",
    items: [["p029", 1], ["p030", 2]] }
];
