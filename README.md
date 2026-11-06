# KiranaYap: shop websites that sell themselves

**Apni Dukaan Ko Digital Banao. Orders WhatsApp Par Pao.**

This repository is a complete, static "sell kit" for selling simple websites to local shops (kirana, mithai, bakery, cloud kitchen) in Uttar Pradesh. Shopkeepers find the landing page (for example from an Instagram reel), try a live demo, and tap **Get a free demo on WhatsApp** (or a plan button), which opens WhatsApp to the owner with a prefilled message. No visits needed.

Architecture, and exactly what works statically vs. what needs a backend: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Audit of the previous version: [`docs/AUDIT.md`](docs/AUDIT.md).

Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no API keys. Free hosting on Cloudflare Pages (GitHub Pages or Vercel also work). Hindi + English everywhere. Fast on cheap Android phones and installable as an app (PWA).

Live: https://kiranayap.pages.dev/

## Fill these in before sharing the link

| What | Where | Notes |
|---|---|---|
| **Your WhatsApp number** (every WhatsApp button) | `assets/js/site-config.js` → `ownerWhatsApp` | Digits only: `91` + 10-digit number. Until set, buttons show a "number not set" notice. |
| Support email | `assets/js/site-config.js` → `contactEmail` (+ `contact.html`, footers) | Currently anishgupt43@gmail.com |
| Instagram link (optional) | `assets/js/site-config.js` → `instagram` | Shows an Instagram link in the footer. |
| Demo shops' WhatsApp numbers (optional) | `store/shops/*.json` → `whatsappNumber` | Put **your** number here so prospects' test orders reach you; otherwise checkout explains the number is not set. |
| Custom domain (optional) | Cloudflare Pages > Custom domains, then update URLs in `sitemap.xml`, `robots.txt`, canonical/OG tags | `robots.txt` only takes effect at a domain root. |

## What's inside

| Page | What it is |
|---|---|
| `demo/chai/index.html` | **Premium cinematic demo** "Sharma Chai & Mithai": dark editorial design, one product per full screen (01–06), real product photos, ingredients burst around the photo as you scroll, mini cart, Hindi/English, WhatsApp order. All text, prices, photos and the shop number live in `assets/js/chai-config.js`. `?autoplay=1` plays it by itself (used in the landing-page phone). |
| `index.html` | Landing page for shopkeepers: clean light design, hero (Live Demo / Get Started / WhatsApp) with the premium demo in a phone, demo carousel (all labelled DEMO), try-it product grid, how it works, features, pricing with limits + renewal terms, comparison, FAQ, final CTA. No testimonials or stats (none are real yet). SEO meta, Open Graph, Twitter, JSON-LD. |
| `about.html`, `contact.html`, `faq.html`, `onboarding.html` | Trust pages: who runs it, WhatsApp + email support and hours, honest FAQ (incl. static vs backend), step-by-step onboarding. |
| `shop-website-lucknow.html`, `-kanpur.html`, `-varanasi.html` | City SEO pages with their own Hindi/English copy. |
| `store/<id>/` and `store/index.html?shop=<id>` | The shop website (storefront + WhatsApp checkout). One app, driven by `store/shops/<id>.json`. `store/<id>/index.html` is generated (see below) so link previews show the shop. No `?shop=` = kirana demo. |
| `store/admin.html?shop=<id>` | **Shop setup tool (local demo)**: edit products, stock and settings in this browser, then **Download shop file (JSON)** to publish. Sample orders only. |
| `udhaar.html` | Digital Udhaar Khata demo: per-customer ledger, udhaar/payment entries, running balance, Hindi WhatsApp reminder, CSV export. LocalStorage only, no lending. |
| `qr-poster.html?shop=<id>` | Shop QR: pick a shop (from `store/shops/shops.json`) or paste a link → **Download QR (PNG)**, **A4 poster** or **A6 counter card**, in the shop's brand colour. QR made on the device (vendored MIT `qrcode-generator`), works offline. |
| `privacy.html`, `terms.html`, `refund.html` | Simple, DPDP-aware policies with Hindi summaries. Shops handle their own GST/FSSAI. |
| `manifest.webmanifest`, `sw.js`, `assets/js/pwa.js` | Installable app + offline shell. |
| `sitemap.xml`, `robots.txt` | SEO basics. |

### Niche demos (all fictional, sample prices)

| Demo | File | Link |
|---|---|---|
| Sharma Kirana Store | `store/shops/kirana.json` | `store/?shop=kirana` |
| Shree Mithai Ghar | `store/shops/mithai.json` | `store/?shop=mithai` |
| Fresh Oven Bakery | `store/shops/bakery.json` | `store/?shop=bakery` |
| Ghar Ka Swaad Kitchen | `store/shops/cloud-kitchen.json` | `store/?shop=cloud-kitchen` |

All demo products now use real-looking studio photos (`assets/images/products/<product id>.webp`, generated, no logos), set in each JSON's `"image"` field; each shop's hero is a photo too.

### Premium cinematic shop

- Make one: copy `assets/js/chai-config.js` (new `id`, shop name, products, `whatsappNumber`) and `demo/chai/index.html` (point it at the new config). Photos: square product shot on a black background (`assets/images/chai/<name>.webp`, ≤150 KB) plus small transparent ingredient cut-outs (`ing-<name>.webp`).
- Motion uses only `transform` and `opacity`, respects "reduce motion", and the pages have no horizontal scroll at 360–1280 px.
- **Instagram reel:** `node tools/record-reel.js demo/chai/index.html reel.mp4` records a ~18 s 1080×1920 MP4 of the page scrolling itself (needs Playwright + ffmpeg).

### Per-shop pages and WhatsApp link previews

WhatsApp, Facebook and Google read a page's HTML without running JavaScript, so `store/index.html?shop=<id>` always showed one generic preview. Each shop in `store/shops/shops.json` therefore also has a small generated page, `store/<id>/index.html`, with the shop's own `<title>`, description, canonical URL and `og:`/`twitter:` tags written into the HTML. It runs the same store app (`<html data-shop="<id>">` presets the shop). `?shop=` links keep working and point their canonical at `store/<id>/`.

```
bash tools/make-shop-og.sh [id]     # optional: link-preview image assets/images/og/<id>.jpg (ImageMagick)
node tools/build-shop-pages.js      # writes store/<id>/index.html for every shop + updates sitemap.xml
```

Run the generator after adding a shop or changing its name, texts, colours or photo, and after editing `store/index.html` (it is the template). `node tests/static.test.js` fails when a generated page is out of date. Share `…/store/<id>/` links (the QR tool uses them).

**New shop in ~30 minutes:** copy one JSON file and edit it. Step-by-step in Hindi and English: [`docs/NEW-SHOP.md`](docs/NEW-SHOP.md).

## Pricing shown on the site

Starter ₹999 one-time setup + ₹149/month (first month free; up to 60 products, 10 changes/month) · Premium ₹2,999 setup + ₹199/month (up to 150 products, 25 changes/month) · Udhaar Khata Pro +₹99/month · Festival posters ₹199/set · Template licence ₹1,499–₹2,999 · Reseller ₹499/month. Change them in `index.html` and `assets/js/site-i18n.js` (both languages), and in `terms.html`.

## Project structure

```
index.html                      landing page (shopkeepers)
shop-website-<city>.html        Lucknow / Kanpur / Varanasi SEO pages
udhaar.html  qr-poster.html     shop tools
privacy.html terms.html refund.html
store/
  index.html  admin.html        shop website + demo dashboard
  shops/*.json                  ONE file per shop (name, number, hours, colours, categories, products)
  shops/shops.json              registry of all shops (QR tool + tests)
assets/
  css/style.css                 design system (greens + turmeric on cream) + store
  css/site.css  css/tools.css   landing/city/legal pages, udhaar + QR poster (+ A4 print)
  js/site-config.js             <- YOUR WhatsApp number (TODO)
  js/site-i18n.js  js/site.js   landing texts (en/hi) + WhatsApp links + contact details
  js/shop-loader.js             picks ?shop= and fetches its JSON
  js/i18n.js common.js cart.js app.js admin.js   store (shared helpers, cart, storefront, dashboard)
  js/udhaar-core.js udhaar.js   Udhaar Khata logic + page
  js/qr-poster.js               poster + QR (uses assets/vendor/qrcode-generator)
  js/pwa.js                     registers sw.js
  images/                       original SVG art, icons, OG image
docs/NEW-SHOP.md                how to add a shop
docs/ARCHITECTURE.md            architecture, static vs backend, suggested backend
docs/AUDIT.md                   audit of the previous version
tests/                          static, logic, sell-kit and browser tests
manifest.webmanifest sw.js sitemap.xml robots.txt _headers 404.html vercel.json
```

## Demo-only (be honest with shop owners)

- **No online payment.** Customers pay the shop directly (cash/UPI). The site never takes payment.
- **WhatsApp is the order channel.** An order exists only when the customer presses **Send** in WhatsApp.
- **Dashboard and Udhaar Khata data are local** to one browser on one device. No login, no cloud sync. To change prices for every customer, edit the shop's JSON file and deploy.
- **Udhaar Khata is a record book only**, not lending or payments.
- **Demo shops, products, prices and sample orders are fictional** and labelled DEMO. There are no testimonials on the site.

## Preview / deploy

- Cloudflare Pages (live, https://kiranayap.pages.dev/): no build command, output directory = repository root (or upload the public files only). `_headers` sets caching + security headers; `404.html` is served for unknown paths.
- GitHub Pages: push to `main`; the site is served from the repository root.
- Vercel: see `DEPLOYMENT.md`.
- Locally: any static server from the repo root (for example `npx serve .`), then open `http://localhost:3000/`. The store needs a server (it fetches its JSON); opening the HTML file directly will show "shop not found".
- After changing files, bump `CACHE` in `sw.js` (now `ks-shell-v4`) so installed phones refresh.

## Tests

See `TESTING.md`. Quick run:

```
node tests/static.test.js && node tests/logic.test.js && node tests/sellkit.test.js
node tests/e2e.js        # needs playwright + chromium
node tests/pro.e2e.js    # serves the site at / like Cloudflare Pages (SERVE_BASE=/kirana-smart for a sub-path); 360 + 1280 px
```

## Security notes

- No secrets, passwords or API keys. No external scripts, fonts or CDNs.
- All user text is inserted with `textContent`; no `eval()`, no `innerHTML`.
- Content-Security-Policy meta on every page (`script-src 'self'`).
- Shop JSON values are validated (ids, colours, image URLs, prices) before use.
