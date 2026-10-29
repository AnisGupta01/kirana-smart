/* ============================================================
   CINEMATIC SHOP - SETTINGS (demo: Sharma Chai & Mithai)
   ------------------------------------------------------------
   One file per cinematic shop. To make a new one, copy this
   file, change the text, prices, photos and WhatsApp number,
   and point demo/<shop>/index.html at the copy.
   All products, prices and the address are SAMPLE data.
   ============================================================ */
window.KS_CINEMA = {
  id: "chai",
  demo: true,
  /* Shop WhatsApp: country code + 10 digits, digits only */
  whatsappNumber: "917266042235",
  currency: "₹",
  defaultLanguage: "en",
  /* folder with the photos, relative to the page */
  img: "../../assets/images/chai/",

  shop: {
    en: { name: "Sharma", line: "Chai & Mithai", city: "Aminabad, Lucknow", full: "Sharma Chai & Mithai (Demo)" },
    hi: { name: "शर्मा", line: "चाय और मिठाई", city: "अमीनाबाद, लखनऊ", full: "शर्मा चाय और मिठाई (डेमो)" }
  },

  text: {
    en: {
      "nav.menu": "Menu", "nav.visit": "Visit", "nav.order": "Order",
      "lang": "हिंदी", "lang.aria": "हिंदी में देखें",
      "hero.eyebrow": "Since 1987 · Aminabad, Lucknow",
      "hero.l1": "Subah ki pehli chai.",
      "hero.l2": "Shaam ki meethi yaadein.",
      "hero.sub": "Kulhad chai on a slow flame, mithai made every morning, samosas straight from the kadhai. Pick what you love and order on WhatsApp.",
      "hero.hours": "6:00 AM — 11:00 PM",
      "hero.hoursNote": "Open every day",
      "hero.cta": "See the menu",
      "hero.scroll": "Scroll",
      "add": "Add", "added": "Added", "inc": "Add one more {name}", "dec": "Remove one {name}",
      "cart.items": "{n} items", "cart.item": "1 item",
      "cart.view": "View order", "cart.title": "Your order", "cart.empty": "Your order is empty. Add something tasty.",
      "cart.total": "Total", "cart.close": "Close",
      "f.name": "Your name (optional)", "f.mode": "How do you want it?", "f.pickup": "Pickup from shop", "f.delivery": "Home delivery",
      "f.address": "Delivery address", "f.addressErr": "Please write your delivery address.", "f.note": "Note for the shop (optional)",
      "send": "Order on WhatsApp", "send.note": "Opens WhatsApp with your order. Pay the shop directly: cash or UPI.",
      "toast.added": "{name} added",
      "visit.kicker": "Visit us",
      "visit.l1": "Aminabad,", "visit.l2": "Lucknow.",
      "visit.addr": "Shop 12, Sample Lane, Aminabad, Lucknow (demo address)",
      "visit.hours": "Every day · 6:00 AM — 11:00 PM",
      "visit.cta": "Say hello on WhatsApp",
      "made.text": "This is a demo website by Kirana Smart. Products, prices and address are samples.",
      "made.cta": "Get a website like this for your shop",
      "wa.hello": "Namaste! I saw your website and want to order.",
      "wa.head": "Namaste {shop}! New order from the website:",
      "wa.total": "Total", "wa.name": "Name", "wa.mode": "Mode", "wa.address": "Address", "wa.note": "Note",
      "wa.foot": "Please confirm the order. (Sent from the demo website)",
      "rail.label": "Menu"
    },
    hi: {
      "nav.menu": "मेन्यू", "nav.visit": "पता", "nav.order": "ऑर्डर",
      "lang": "English", "lang.aria": "View in English",
      "hero.eyebrow": "1987 से · अमीनाबाद, लखनऊ",
      "hero.l1": "सुबह की पहली चाय।",
      "hero.l2": "शाम की मीठी यादें।",
      "hero.sub": "धीमी आँच पर कुल्हड़ चाय, हर सुबह बनी ताज़ा मिठाई, कड़ाही से सीधे गरम समोसे। पसंद चुनिए और WhatsApp पर ऑर्डर कीजिए।",
      "hero.hours": "सुबह 6 — रात 11",
      "hero.hoursNote": "रोज़ खुला",
      "hero.cta": "मेन्यू देखें",
      "hero.scroll": "स्क्रॉल करें",
      "add": "जोड़ें", "added": "जुड़ गया", "inc": "एक और {name} जोड़ें", "dec": "एक {name} हटाएँ",
      "cart.items": "{n} आइटम", "cart.item": "1 आइटम",
      "cart.view": "ऑर्डर देखें", "cart.title": "आपका ऑर्डर", "cart.empty": "ऑर्डर खाली है। कुछ स्वादिष्ट जोड़िए।",
      "cart.total": "कुल", "cart.close": "बंद करें",
      "f.name": "आपका नाम (ज़रूरी नहीं)", "f.mode": "कैसे चाहिए?", "f.pickup": "दुकान से ले जाएँगे", "f.delivery": "घर पर डिलीवरी",
      "f.address": "डिलीवरी का पता", "f.addressErr": "कृपया डिलीवरी का पता लिखें।", "f.note": "दुकान के लिए नोट (ज़रूरी नहीं)",
      "send": "WhatsApp पर ऑर्डर करें", "send.note": "WhatsApp में आपका ऑर्डर खुलेगा। भुगतान सीधे दुकान को: नकद या UPI।",
      "toast.added": "{name} जुड़ गया",
      "visit.kicker": "हमसे मिलिए",
      "visit.l1": "अमीनाबाद,", "visit.l2": "लखनऊ।",
      "visit.addr": "दुकान 12, सैंपल लेन, अमीनाबाद, लखनऊ (डेमो पता)",
      "visit.hours": "रोज़ · सुबह 6 — रात 11",
      "visit.cta": "WhatsApp पर नमस्ते कहें",
      "made.text": "यह Kirana Smart की डेमो वेबसाइट है। सामान, दाम और पता नमूना हैं।",
      "made.cta": "अपनी दुकान के लिए ऐसी वेबसाइट बनवाएँ",
      "wa.hello": "नमस्ते! मैंने आपकी वेबसाइट देखी, ऑर्डर करना है।",
      "wa.head": "नमस्ते {shop}! वेबसाइट से नया ऑर्डर:",
      "wa.total": "कुल", "wa.name": "नाम", "wa.mode": "तरीका", "wa.address": "पता", "wa.note": "नोट",
      "wa.foot": "कृपया ऑर्डर कन्फ़र्म करें। (डेमो वेबसाइट से भेजा गया)",
      "rail.label": "मेन्यू"
    }
  },

  /* name: [first line, italic second line]. glow = colour of the light behind the photo */
  products: [
    { id: "kulhad-chai", price: 20, image: "chai.webp", glow: "#c7782e",
      pieces: ["cinnamon", "cardamom", "staranise", "ginger", "clove", "tealeaves", "sugar", "cardamom-open", "cinnamon"],
      en: { name: ["Kulhad", "Chai"], kicker: "The original", unit: "per kulhad", desc: "Strong Assam tea, fresh milk, crushed adrak and elaichi, slow-boiled and poured into a clay kulhad." },
      hi: { name: ["कुल्हड़", "चाय"], kicker: "असली स्वाद", unit: "एक कुल्हड़", desc: "कड़क असम चाय, ताज़ा दूध, कुटी अदरक और इलायची, धीमी आँच पर उबली, मिट्टी के कुल्हड़ में।" } },
    { id: "kesar-rasmalai", price: 60, image: "rasmalai.webp", glow: "#d9a21b",
      pieces: ["saffron", "pistachio", "rose", "almond", "cardamom", "saffron", "pistachio", "rose"],
      en: { name: ["Kesar", "Rasmalai"], kicker: "Made this morning", unit: "2 pieces", desc: "Soft chhena discs soaked in thick saffron milk, finished with pistachio and rose." },
      hi: { name: ["केसर", "रसमलाई"], kicker: "आज सुबह बनी", unit: "2 पीस", desc: "नरम छेने की टिकिया, गाढ़े केसरिया दूध में, ऊपर पिस्ता और गुलाब।" } },
    { id: "kaju-katli", price: 280, image: "kajukatli.webp", glow: "#9aa3ad",
      pieces: ["cashew", "katli", "cashew", "almond", "cardamom-open", "cashew", "katli", "pistachio"],
      en: { name: ["Kaju", "Katli"], kicker: "Festival favourite", unit: "250 g box", desc: "Pure cashew, a little sugar, and real silver varq. Thin, smooth, melts on the tongue." },
      hi: { name: ["काजू", "कतली"], kicker: "त्योहार की पसंद", unit: "250 ग्राम डिब्बा", desc: "शुद्ध काजू, थोड़ी चीनी और असली चाँदी का वर्क। पतली, मुलायम, मुँह में घुल जाए।" } },
    { id: "samosa", price: 30, image: "samosa.webp", glow: "#e0671f",
      pieces: ["peas", "potato", "chilli", "mint", "ginger", "peas", "clove", "chilli"],
      en: { name: ["Garam", "Samosa"], kicker: "Straight from the kadhai", unit: "2 pieces + chutney", desc: "Crisp ajwain crust, spiced aloo-matar inside, served with green and meethi chutney." },
      hi: { name: ["गरम", "समोसा"], kicker: "सीधे कड़ाही से", unit: "2 पीस + चटनी", desc: "अजवाइन वाली करारी परत, अंदर मसालेदार आलू-मटर, हरी और मीठी चटनी के साथ।" } },
    { id: "bun-maska", price: 40, image: "bunmaska.webp", glow: "#d39a3a",
      pieces: ["sugar", "almond", "cardamom", "potato", "cinnamon", "sugar", "almond"],
      en: { name: ["Bun", "Maska"], kicker: "Best with chai", unit: "1 bun", desc: "Soft sweet bun split open and loaded with fresh white butter. Dip it in your chai." },
      hi: { name: ["बन", "मस्का"], kicker: "चाय के साथ बेस्ट", unit: "1 बन", desc: "नरम मीठा बन, बीच में ताज़ा सफ़ेद मक्खन। चाय में डुबोकर खाइए।" } },
    { id: "lassi", price: 50, image: "lassi.webp", glow: "#c25a6a",
      pieces: ["rose", "pistachio", "saffron", "mint", "cardamom", "almond", "rose", "pistachio"],
      en: { name: ["Malai", "Lassi"], kicker: "Thick. Cold. Lucknowi.", unit: "per kulhad", desc: "Churned curd with a thick layer of malai, pistachio and a rose petal on top." },
      hi: { name: ["मलाई", "लस्सी"], kicker: "गाढ़ी, ठंडी, लखनवी", unit: "एक कुल्हड़", desc: "मथा हुआ दही, ऊपर मलाई की मोटी परत, पिस्ता और गुलाब की पंखुड़ी।" } }
  ]
};
