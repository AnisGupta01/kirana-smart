# New shop in ~30 minutes / नई दुकान ~30 मिनट में

Every shop website is **one JSON file** in `store/shops/`. The website code is shared, so you never copy HTML.
हर दुकान की वेबसाइट `store/shops/` में **एक JSON फ़ाइल** है। कोड सबका एक ही है, HTML कॉपी नहीं करना पड़ता।

| Shop file | Live address (after deploy) |
|---|---|
| `store/shops/kirana.json` | `…/kirana-smart/store/` (default) or `…/store/?shop=kirana` |
| `store/shops/mithai.json` | `…/kirana-smart/store/?shop=mithai` |
| `store/shops/gupta-sweets.json` (your new one) | `…/kirana-smart/store/?shop=gupta-sweets` |

The shop's dashboard is the same address with `admin.html`: `…/store/admin.html?shop=gupta-sweets`.

---

## English: step by step

**Before you start (5 min, on WhatsApp):** get from the shopkeeper the shop name, area/city, WhatsApp number, opening hours, delivery fee and free-delivery limit, and a photo or list of items with price, MRP and pack size.

1. **Copy the closest demo** (1 min). In GitHub, open `store/shops/`, open the demo that matches (kirana, mithai, bakery or cloud-kitchen), click *Copy raw file*, then *Add file → Create new file* and name it like `gupta-sweets.json`. The name may use only lowercase letters, numbers and `-`.
2. **Edit the top part** (5 min):
   - `"id"`: exactly the file name without `.json` (`"gupta-sweets"`).
   - `"demo"`: `false` for a real paying shop (hides the DEMO banners), `true` for a pitch demo.
   - `"storeName"`, `"storeLocation"`, `"hours"` (`en` and `hi`).
   - `"whatsappNumber"`: the **shop's** number, digits only: `91` followed by the 10-digit number. Orders open WhatsApp to this number.
   - `"colors"`: `brand` (dark colour, e.g. `#7f1d1d`) and `accent` (e.g. `#f59e0b`).
   - `"logoText"`: 1–3 letters shown as the logo, e.g. `"GS"`.
   - `"deliveryFee"`, `"freeDeliveryAbove"` (rupees, `0` = never free), `"deliveryNote"`, `"pickupNote"`.
3. **Categories** (2 min): keep or rename. Each has an `id` (lowercase), English `en`, Hindi `hi`, and a picture style `art` (one of `sack, bottle, carton, packet, tub, sweet, box, cake, bread, bowl, cup`) with colours `bg` and `fg`.
4. **Products** (15 min): one line per item:
   `{"id":"g001","name":"Kaju Katli","nameHi":"काजू कतली","category":"sweets","price":560,"mrp":600,"unit":"500 g","stock":20,"available":true,"featured":true,"image":""}`
   - `id` must be unique. `price` is the selling price; `mrp` can be `null`. If `mrp` is higher, an offer badge appears. **Never above MRP.**
   - `stock`: whole number. `0` shows "Out of stock".
   - `featured` / `popular`: `true` puts the item in those rows on the home screen.
   - `image`: leave `""` for an automatic picture, or an `https://` link to a photo you have the right to use.
5. **Texts** (optional, 3 min): `"text"` overrides any label of the store in `en` and `hi` (hero title, search hint, footer). Keys are listed in `assets/js/i18n.js`.
6. **Remove sample orders**: for a real shop set `"sampleOrders": []`.
7. **Check it** (3 min): commit, wait ~1 minute for GitHub Pages, open `…/store/?shop=gupta-sweets` on your phone, add an item and press *Order on WhatsApp*. If something is wrong in the file the page shows the exact problem (for example "Shop file needs a storeName").
8. **QR poster**: open the shop's dashboard → *Make QR poster for the counter*, print on A4.

Tip: validate the JSON before saving (for example by pasting it into any "JSON validator"). A missing comma is the most common mistake.

---

## हिंदी: एक-एक कदम

**शुरू करने से पहले (5 मिनट, WhatsApp पर):** दुकानदार से दुकान का नाम, इलाका/शहर, WhatsApp नंबर, खुलने का समय, डिलीवरी चार्ज और किस रकम से ऊपर फ़्री डिलीवरी, और सामान की फ़ोटो या लिस्ट (दाम, MRP, पैक साइज़) ले लीजिए।

1. **सबसे मिलता-जुलता डेमो कॉपी करें** (1 मिनट)। GitHub में `store/shops/` खोलिए, मिलता हुआ डेमो (kirana, mithai, bakery या cloud-kitchen) खोलिए, *Copy raw file* दबाइए, फिर *Add file → Create new file* से नई फ़ाइल बनाइए, जैसे `gupta-sweets.json`। नाम में सिर्फ़ छोटे अंग्रेज़ी अक्षर, अंक और `-`।
2. **ऊपर का हिस्सा बदलें** (5 मिनट):
   - `"id"`: फ़ाइल का नाम, `.json` के बिना (`"gupta-sweets"`)।
   - `"demo"`: असली (पैसे देने वाली) दुकान के लिए `false` (DEMO बैनर छिप जाते हैं), दिखाने वाले डेमो के लिए `true`।
   - `"storeName"`, `"storeLocation"`, `"hours"` (`en` और `hi` दोनों)।
   - `"whatsappNumber"`: **दुकान का** नंबर, सिर्फ़ अंक: `91` और फिर 10 अंकों का नंबर। ऑर्डर इसी नंबर पर WhatsApp में खुलते हैं।
   - `"colors"`: `brand` (गहरा रंग, जैसे `#7f1d1d`) और `accent` (जैसे `#f59e0b`)।
   - `"logoText"`: लोगो की जगह 1–3 अक्षर, जैसे `"GS"`।
   - `"deliveryFee"`, `"freeDeliveryAbove"` (रुपये, `0` = कभी फ़्री नहीं), `"deliveryNote"`, `"pickupNote"`।
3. **कैटेगरी** (2 मिनट): रखिए या नाम बदलिए। हर एक में `id` (छोटे अक्षर), अंग्रेज़ी `en`, हिंदी `hi`, और तस्वीर का स्टाइल `art` (`sack, bottle, carton, packet, tub, sweet, box, cake, bread, bowl, cup` में से एक) और रंग `bg`, `fg`।
4. **सामान** (15 मिनट): हर सामान की एक लाइन (ऊपर अंग्रेज़ी वाले हिस्से में उदाहरण देखें)।
   - हर `id` अलग हो। `price` बिक्री का दाम; `mrp` `null` हो सकता है। `mrp` ज़्यादा हो तो ऑफ़र बैज दिखता है। **दाम कभी MRP से ऊपर नहीं।**
   - `stock`: पूरा अंक। `0` पर "स्टॉक में नहीं" दिखता है।
   - `featured` / `popular`: `true` करने पर सामान होम स्क्रीन की उन लाइनों में आता है।
   - `image`: ख़ुद-ब-ख़ुद तस्वीर के लिए `""` छोड़िए, या ऐसी फ़ोटो का `https://` लिंक जिसके इस्तेमाल का आपको हक़ है।
5. **टेक्स्ट** (ज़रूरी नहीं, 3 मिनट): `"text"` से स्टोर का कोई भी लेबल `en` और `hi` में बदल सकते हैं (हीरो टाइटल, सर्च हिंट, फ़ुटर)। सारी keys `assets/js/i18n.js` में हैं।
6. **नमूना ऑर्डर हटाएँ**: असली दुकान के लिए `"sampleOrders": []` कर दीजिए।
7. **जाँच लें** (3 मिनट): commit कीजिए, GitHub Pages के लिए ~1 मिनट रुकिए, फ़ोन पर `…/store/?shop=gupta-sweets` खोलिए, एक सामान डालकर *WhatsApp पर ऑर्डर* दबाइए। फ़ाइल में ग़लती हो तो पेज पर साफ़ लिखा आता है कि क्या कमी है।
8. **QR पोस्टर**: दुकान का डैशबोर्ड → *काउंटर के लिए QR पोस्टर बनाएँ*, A4 पर प्रिंट कीजिए।

सलाह: सेव करने से पहले JSON किसी "JSON validator" में जाँच लीजिए। सबसे आम ग़लती: छूटा हुआ कॉमा।

---

## Notes / ध्यान दें

- Dashboard changes (admin.html) are saved only in that phone's browser. To change prices for every customer, edit the JSON file. / डैशबोर्ड के बदलाव सिर्फ़ उसी फ़ोन में सेव होते हैं। सबके लिए दाम बदलने हों तो JSON फ़ाइल बदलिए।
- The shop is responsible for its own GST, FSSAI and correct prices (see `terms.html`). / GST, FSSAI और सही दाम की ज़िम्मेदारी दुकान की है।
- After changing files, bump `CACHE` in `sw.js` (e.g. `ks-shell-v2`) so installed phones get the update quickly. / फ़ाइलें बदलने के बाद `sw.js` में `CACHE` का नंबर बढ़ा दीजिए।
