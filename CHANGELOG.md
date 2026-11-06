# Changelog

## 2026-11-02: Phase 1 (trust, speed, correctness), branch `phase1`

### 1. C1: returning customers always see current prices and stock
- `store/shops/<id>.json` is fetched network-first (`cache: "no-cache"`, revalidated on every load) and falls back to the browser/offline copy only when the network fails. The service worker never answers a shop JSON with an HTML page.
- LocalStorage copies now carry a fingerprint of the shop JSON they were made from. When the published JSON changes, the fresh JSON wins. Old plain-array copies (from before this fix) are ignored.
- Live shops (`demo:false`) never use local product/settings edits on the storefront; only the setup tool does.
- The cart remembers the price each item was added at. Before checkout (on load, on "Checkout", and when the customer comes back to an open tab after 60 s) the cart is reconciled with fresh data: out-of-stock items are removed, quantities trimmed to stock, and price changes shown ("Kaju Katli: price changed from ₹560 to ₹671"), in English and Hindi.
- Tests: `tests/logic.test.js` (C1 section) and `tests/phase1.e2e.js` part `fresh` reproduce the ₹560 → ₹671 → out-of-stock case.

### 2. H1: live shops (`demo:false`) show no demo material
- `store/index.html`: the "Shop setup tool (local demo)" links (menu + footer), the "Demo offers - sample discounts" note, "Reset demo data" and "See all demo shops" are `data-demo-only`, so they are hidden on live shops.
- A live shop's page title falls back to "<shop name> - order on WhatsApp" when its JSON (copied from a demo) still says "(Demo)". A live shop without `hours` shows "Ask the shop on WhatsApp for opening hours" instead of "(sample hours)". The "number not set" error no longer mentions config.js or the demo dashboard.
- Test: `tests/phase1.e2e.js` part `live` scans every visible text node (EN + HI, menu, cart, checkout, sent screen) and the WhatsApp message for demo/sample/setup wording.

### 3. H2: static per-shop preview pages
- New `tools/build-shop-pages.js` (plain Node, no installs) writes `store/<id>/index.html` for every shop in `shops.json` from the `store/index.html` template, with the shop's own `<title>`, meta description, canonical, `og:title/description/url/image/image:alt` and `twitter:` tags in the HTML. Live shops get no demo wording and start with the demo blocks hidden. It also rewrites the shop entries in `sitemap.xml` (now `store/<id>/` instead of `?shop=` duplicates).
- New `tools/make-shop-og.sh` (ImageMagick) made the link-preview images `assets/images/og/<id>.jpg` (1200×630: shop colour, shop photo, shop name, "Demo shop · sample products and prices" on demo shops).
- `?shop=<id>` keeps working; its canonical/og:url now point at `store/<id>/`. Both addresses share the same cart. The QR tool now encodes `…/store/<id>/`.
- Documented in README and `docs/NEW-SHOP.md`. `tests/static.test.js` fails when a generated page is out of date; `tests/phase1.e2e.js` part `preview` checks the raw (no-JS) HTML and the running page for every shop.

### 4. H3/M2: one promise set everywhere
- Go-live: "within 1–2 working days after we receive your details" (HI: "डिटेल मिलने के बाद 1–2 कामकाजी दिन") on the landing (how-it-works), FAQ page (new first question + Hindi summary), terms (new line + Hindi summary), onboarding, city pages (Lucknow/Varanasi headlines and og:title, Kanpur FAQ + JSON-LD) and `site-i18n.js`. "Live in 1 day" / "Website in 1 day" / "1 दिन में" are gone.
- Refund policy now pays a full setup refund if the site is not live **within 2 working days** of receiving the details (was 3), so the binding refund trigger matches the 1–2 day promise. (Business decision: please confirm you are happy with 2 days.)
- Stock/price updates: one phrase, "Stock/price changes WhatsApp par bhejiye — 24 ghante ke andar update (Mon–Sat)", and its Devanagari form "स्टॉक/दाम के बदलाव WhatsApp पर भेजिए — 24 घंटे के अंदर अपडेट (सोम–शनि)", on the landing FAQ (EN + HI), FAQ page, terms, refund, onboarding. Plan change limits (10 Starter / 25 Premium a month) stay alongside it.
- Share image: `assets/images/og-image.png` said "1 din mein". It was a raster with no source, so it now has one: `tools/og/og-image.html` (+ `tools/og/render-og.js`, art cut from the old image into `tools/og/og-art.webp`). New text: "Apni dukaan ki website, 1–2 din mein live. Details milne ke baad 1–2 working din."
- Tests: static checks for forbidden/conflicting wording and the exact phrases; `tests/phase1.e2e.js` part `promises` checks the rendered landing (EN + HI), FAQ, terms, refund and a city page.

## 2026-11-02: Phase 0 audit

- Added `docs/AUDIT-PHASE0.md`, a re-audit of the `pro-upgrade` branch (identical to `main` after PR #5). It covers findings ranked by impact, Phase 1 checklist status, exact test results (1,221 passed, 0 failed when split), licence risks, Lighthouse mobile numbers and recommendations.
- No code changes.
