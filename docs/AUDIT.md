# Kirana Smart — audit before the "pro" upgrade

Audited: `main` at `b22f90a` (2 Nov 2026), live at https://anisgupta01.github.io/kirana-smart/

## Architecture (as found)

- **Pure static site** (HTML + CSS + vanilla JS, no build step, no backend, no external CDN). Strict CSP (`script-src 'self'`, no inline scripts). Works under the `/kirana-smart/` project path because every link is relative.
- **Landing** `index.html` + `assets/css/landing.css` + `assets/js/landing.js` (hero phone slideshow, desktop iframe of the cinematic demo, demo carousel, shop tabs with a mini cart, FAQ). Language + WhatsApp links come from `assets/js/site.js` + `site-i18n.js` (English/Hindi dictionaries) + `site-config.js` (owner number `917266042235`).
- **Multi-shop store** `store/index.html?shop=<slug>`: `shop-loader.js` fetches `store/shops/<slug>.json` (branding, colours, categories, products with `price`, `mrp`, `stock`, `available`, images). `common.js` (data, validation, money in paise, WhatsApp message), `cart.js`, `app.js` (catalog, search, category filter, sort, cart drawer, checkout). Cart is stored per shop in LocalStorage.
- **Premium demo** `demo/chai/` (cinematic scroll, own config `chai-config.js`).
- **Tools**: `udhaar.html` (Udhaar Khata, LocalStorage only), `qr-poster.html` (A4 poster, QR drawn client-side with vendored `qrcode-generator`, MIT), `store/admin.html` (LocalStorage "dashboard").
- **SEO/legal**: 3 city pages, privacy/terms/refund, `sitemap.xml`, `robots.txt`, OG tags on landing and city pages.
- **PWA**: `sw.js` (cache `ks-shell-v3`), `manifest.webmanifest`.
- **Tests**: `tests/static.test.js` (333), `tests/logic.test.js` (125), `tests/sellkit.test.js` (179), `tests/e2e.js` + `tests/e2e-sellkit.js` (Playwright). Local server serves from `/`, not from `/kirana-smart/`.

## What works (verified by running the suites on main)

- static 333/333, logic 125/125, sellkit 179/179 pass.
- e2e on main in this environment: **330 passed, 2 failed** — (1) "desktop demo carousel shows at least 3 cards side by side" (layout check fails at 1280px), (2) the run then crashed opening `shop-website-varanasi.html` (browser context closed — the single 2-minute run is too long/heavy for the sandbox). So e2e was *not* fully green on main here.
- All 4 niche demos load from JSON, search + category filter + sort, cart with qty controls and stock limits, checkout validation, wa.me link with an encoded order message, Hindi/English, QR poster renders and decodes (jsqr), PWA offline shell.

## Bugs and gaps found

1. **Checkout requires a phone number**; the brief wants phone *optional* (name + address required).
2. **Order message always says "Sent from the Kirana Smart demo store"**, even for a real shop (`demo: false`).
3. **No About / Contact / FAQ page / onboarding page**; the contact email appears nowhere. Support info is only "message us on WhatsApp".
4. **Pricing cards don't state limits, maintenance or renewal terms** (only in terms.html in part). Starter card has extra empty space on desktop (cards stretch to the taller Premium card). Plan CTAs open WhatsApp but Starter's message starts with "DEMO" instead of the plan.
5. **Final CTA background** = 3 photos side by side with visible seams at 1280px; desktop section spacing is very large (`--sec` up to 120px + sec-head 48px).
6. **Hero** headline/sub do not match the requested copy; hero is cluttered (halo glow, 3 floating photos, 3 spice images, 2 floating chips, gold glows) — the opposite of the "clean SaaS" brief. Dark theme with glow shadows everywhere.
7. **QR**: only an A4 poster; no PNG download, no small counter/table stand, no "pick a shop" (you must paste a link). Shop branding (colour) not used.
8. **Admin dashboard** shows sample orders/sales — honestly labelled "demo", but it has no way to get changes *out* (no export), so it can't be used to set up a real shop. Risk of looking like a fake dashboard.
9. **SEO**: `twitter:` tags incomplete (only `twitter:card`), no OG/Twitter on store, tools and legal pages, no canonical on store pages, sitemap missing new pages.
10. **Dead code/files**: `assets/images/f-*.svg` (6) and `assets/images/hero-*.svg` (4) unused (only pre-cached by `sw.js`); `bindPreview()` in `site.js` targets `#previewFrame` that no page has; unused `l.rev.*` (old sample reviews) and `l.preview.*` i18n keys.
11. **Tests**: no test serves the site under `/kirana-smart/` (the real GitHub Pages path), so a root-absolute link would not be caught; no test for 360 *and* 1280 on every page; no broken-link crawl.
12. Legal pages: no OG tags; "Their products, prices and reviews are samples" in terms mentions reviews that don't exist.

## Risks / honest limits (static hosting)

- No server = **no order database, no live stock sync, no owner login, no online payments**. Orders exist only as WhatsApp messages. Stock/price changes need a JSON edit + redeploy (or the local tool's export).
- The LocalStorage dashboard changes only that one browser — must never be sold as "your dashboard".
- `robots.txt` is ignored on a project sub-path (only domain roots count). The sitemap can still be submitted in Search Console.
- WhatsApp sending itself can't be automated/tested — tests check the exact `wa.me` URL only.
