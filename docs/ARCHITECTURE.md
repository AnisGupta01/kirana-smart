# KiranaYap — architecture

A **static website** (HTML, CSS, vanilla JavaScript). No build step, no server, no database, no external CDN. Hosted on Cloudflare Pages at the root of `https://kiranayap.pages.dev/` (previously GitHub Pages under `/kirana-smart/`). Every link is relative, so the site works at the domain root and under any sub-path (tests serve it at `/` by default and under `/kirana-smart/` with `SERVE_BASE=/kirana-smart`).

## Map

| Part | Files | Notes |
|---|---|---|
| Landing | `index.html`, `assets/css/landing.css`, `assets/js/landing.js` | Hero, phone preview, demo carousel, mini shop, how it works, features, pricing, FAQ |
| Marketing scripts | `assets/js/site-config.js` (owner WhatsApp + email: **edit here only**), `site-i18n.js` (English/Hindi), `site.js` (language, WhatsApp links, contact details) | Used by landing, city, trust, legal and QR pages |
| Trust pages | `about.html`, `contact.html`, `faq.html`, `onboarding.html`, `privacy.html`, `terms.html`, `refund.html` | `assets/css/style.css` + `site.css` |
| Store (multi-shop) | `store/index.html`, `assets/js/shop-loader.js`, `common.js`, `cart.js`, `app.js`, `i18n.js` | One page serves every shop |
| Shop data | `store/shops/<id>.json`, registry `store/shops/shops.json` | One JSON file per shop |
| Premium demo | `demo/chai/`, `assets/js/cinema*.js`, `chai-config.js`, `assets/css/cinema.css` | Cinematic one-product-per-screen design |
| QR tool | `qr-poster.html`, `assets/js/qr-poster.js`, `assets/vendor/qrcode-generator/` (MIT), `assets/css/tools.css`, `assets/css/print-a6.css` | QR drawn on the device |
| Setup tool | `store/admin.html`, `assets/js/admin.js` | Local demo + shop-JSON export |
| Udhaar Khata demo | `udhaar.html`, `assets/js/udhaar*.js` | LocalStorage only |
| PWA | `sw.js` (cache `ks-shell-v4`), `manifest.webmanifest`, `assets/js/pwa.js` | Offline after first visit |
| SEO | `sitemap.xml`, `robots.txt`, canonical + Open Graph + Twitter tags on every public page | |

## Multi-shop: one URL per shop

```
https://kiranayap.pages.dev/store/index.html?shop=<id>
```

1. `shop-loader.js` reads `?shop=<id>` (lowercase letters, digits, dashes; `shops` is reserved) and fetches `store/shops/<id>.json`.
2. `KS.applyShop()` validates it and installs branding (`storeName`, `colors.brand/accent`, `logoText`, `heroImage`, `hours`), categories (English + Hindi), delivery settings, the shop's WhatsApp number and its products.
3. Each product has `price`, optional `mrp`, `unit`, `stock` (whole number) and `available` (true/false). A product is orderable only when `available` is true **and** `stock > 0`; otherwise the card shows "Out of stock"/"Not available" and has no Add button. The cart never lets quantity exceed `stock`.
4. Cart, language and setup-tool edits are stored per shop in the visitor's LocalStorage (`ks_*_v1:<id>` keys).
5. `canonical` and `og:url` are rewritten to the shop's own URL.
6. `store/shops/shops.json` lists every shop. The QR tool builds its shop picker from it, and the tests check it matches the files.

Set `"demo": false` in a real shop's JSON: the "Demo" banner wording and the "demo store" line in the order message go away.

## Ordering flow (fully static)

Customer picks items → cart (qty +/−, line totals, subtotal, delivery fee / free-delivery threshold, total, all in integer paise) → checkout (name and delivery address required and validated; phone optional but validated if typed; delivery or pickup; notes) → `https://wa.me/<shop number>?text=<URL-encoded order>` opens WhatsApp. The order exists only as that WhatsApp message. Payment is between customer and shop (cash/UPI).

## What works statically vs. what needs a backend

| Feature | Static (works now) | Needs a backend |
|---|---|---|
| Product catalogue with photos, prices, MRP, categories | ✅ | |
| Search, category filter, sort | ✅ | |
| Cart, quantity controls, totals, delivery fee | ✅ | |
| Checkout validation + formatted WhatsApp order | ✅ | |
| Per-shop URL, branding, stock/availability flag in JSON | ✅ | |
| Hindi / English | ✅ | |
| QR PNG, A4 poster, A6 counter card (offline) | ✅ | |
| Offline loading after first visit (PWA) | ✅ | |
| Changing prices/stock | ⚠️ edit JSON (or export it from the local setup tool) and redeploy | Live editing from a phone |
| **Order management** (order list, status, history) | ❌ orders live in WhatsApp | **Needs a backend** |
| **Live stock sync** (stock goes down when someone orders) | ❌ | **Needs a backend** |
| **Owner login** / secure dashboard | ❌ the setup tool is local-only, no security | **Needs a backend** (auth) |
| **Online payments** (UPI intent/gateway, refunds) | ❌ none on the site | **Needs a backend** + payment gateway (Razorpay/Cashfree) and KYC |
| Delivery tracking, notifications | ❌ | **Needs a backend** |

The local "Shop setup tool" (`store/admin.html`) is labelled as a local demo. Its useful, real function is **Export shop file (JSON)**: edit products/prices/stock in the browser, download `<id>.json`, commit it to `store/shops/`, and the live shop updates on the next deploy.

## Suggested cheap backend (when it is worth paying for)

Order of work (each step is useful on its own):

1. **Supabase free tier** (Postgres + Auth + Row Level Security + storage): `shops`, `products`, `orders` tables. Keep the static front end on Cloudflare Pages; read products from Supabase with the anon key (RLS: public read, owner write).
2. **Owner login** with Supabase Auth (phone OTP or magic link) → a real dashboard to edit products/stock from a phone. Removes the JSON-redeploy step.
3. **Order capture**: on checkout, insert the order (status `sent`) *before* opening WhatsApp, so the owner sees an order list and can mark confirmed/delivered. WhatsApp remains the notification channel.
4. **Live stock**: decrement stock in a Postgres function when the owner confirms an order (not on customer click, to avoid abuse).
5. **Payments** (optional): Razorpay/Cashfree payment links or UPI intent, verified by a Supabase Edge Function webhook. Needs the shop's KYC.

Firebase (Firestore + Auth, Spark plan) is an equivalent alternative. Either stays ₹0 at small scale; cost appears only with many shops or heavy traffic.

## Adding a new shop

See `docs/NEW-SHOP.md`. In short: copy `store/shops/kirana.json` to `store/shops/<new-id>.json`, set `id`, `storeName`, `whatsappNumber`, `colors`, categories and products, set `"demo": false`, add `{ "id": "<new-id>", "demo": false }` to `store/shops/shops.json`, add the shop JSON to `sw.js` and bump `CACHE`, commit. Then open `qr-poster.html?shop=<new-id>` to download its QR PNG and print the A4 poster / A6 counter card.
