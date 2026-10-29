# Kirana Smart: shop websites that sell themselves

**Apni dukaan ki website, 1 din mein. WhatsApp pe order. Koi commission nahi.**

This repository is a complete, static "sell kit" for selling simple websites to local shops (kirana, mithai, bakery, cloud kitchen) in Uttar Pradesh. Shopkeepers find the landing page (for example from an Instagram reel), try a live demo, and tap **Free demo maango**, which opens WhatsApp to the owner with a prefilled `DEMO` message. No visits needed.

Plain HTML, CSS and JavaScript. No build step, no framework, no backend, no API keys. Free hosting on GitHub Pages (or Vercel). Hindi + English everywhere. Fast on cheap Android phones and installable as an app (PWA).

Live: https://anisgupta01.github.io/kirana-smart/

## Fill these in before sharing the link

| What | Where | Notes |
|---|---|---|
| **Your WhatsApp number** (every "Free demo maango" button) | `assets/js/site-config.js` → `ownerWhatsApp` | Digits only: `91` + 10-digit number. Until set, buttons show a "number not set" notice. |
| Instagram link (optional) | `assets/js/site-config.js` → `instagram` | Shows an Instagram link in the footer. |
| Demo shops' WhatsApp numbers (optional) | `store/shops/*.json` → `whatsappNumber` | Put **your** number here so prospects' test orders reach you; otherwise checkout explains the number is not set. |
| Real reviews | `index.html` `#reviews` + `assets/js/site-i18n.js` (`l.rev.*`) | The three current reviews are clearly marked SAMPLE. Replace them once real shops agree. |
| Custom domain (optional) | GitHub Pages settings, then update URLs in `sitemap.xml`, `robots.txt`, canonical/OG tags | `robots.txt` only takes effect at a domain root. |

## What's inside

| Page | What it is |
|---|---|
| `demo/chai/index.html` | **Premium cinematic demo** "Sharma Chai & Mithai": dark editorial design, one product per full screen (01–06), real product photos, ingredients burst around the photo as you scroll, mini cart, Hindi/English, WhatsApp order. All text, prices, photos and the shop number live in `assets/js/chai-config.js`. `?autoplay=1` plays it by itself (used in the landing-page phone). |
| `index.html` | Landing page for shopkeepers: cinematic dark hero with the premium demo playing in a phone, niche demos, why-us vs quick-commerce/marketplaces, features, how it works, pricing, freelancer/agency offer, sample reviews, FAQ (Hindi + English), sticky WhatsApp CTA. SEO meta, Open Graph, JSON-LD. |
| `shop-website-lucknow.html`, `-kanpur.html`, `-varanasi.html` | City SEO pages with their own Hindi/English copy. |
| `store/index.html?shop=<id>` | The shop website (storefront + WhatsApp checkout). One app, driven by `store/shops/<id>.json`. No `?shop=` = kirana demo. |
| `store/admin.html?shop=<id>` | Shopkeeper demo dashboard (products, stock, sample orders, settings) with links to Udhaar Khata and the QR poster. |
| `udhaar.html` | Digital Udhaar Khata demo: per-customer ledger, udhaar/payment entries, running balance, Hindi WhatsApp reminder, CSV export. LocalStorage only, no lending. |
| `qr-poster.html` | A4 counter poster "Scan karo, WhatsApp pe order karo" with a QR made on the device (vendored MIT `qrcode-generator`, no CDN). Print / Save as PDF. |
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

**New shop in ~30 minutes:** copy one JSON file and edit it. Step-by-step in Hindi and English: [`docs/NEW-SHOP.md`](docs/NEW-SHOP.md).

## Pricing shown on the site

Starter ₹999 one-time setup + ₹149/month (first month free) · Premium cinematic ₹2,999 setup + ₹199/month · Udhaar Khata Pro +₹99/month · Festival posters ₹199/set · Template licence ₹1,499–₹2,999 · Reseller ₹499/month. Change them in `index.html` and `assets/js/site-i18n.js` (both languages), and in `terms.html`.

## Project structure

```
index.html                      landing page (shopkeepers)
shop-website-<city>.html        Lucknow / Kanpur / Varanasi SEO pages
udhaar.html  qr-poster.html     shop tools
privacy.html terms.html refund.html
store/
  index.html  admin.html        shop website + demo dashboard
  shops/*.json                  ONE file per shop (name, number, hours, colours, categories, products)
assets/
  css/style.css                 design system (greens + turmeric on cream) + store
  css/site.css  css/tools.css   landing/city/legal pages, udhaar + QR poster (+ A4 print)
  js/site-config.js             <- YOUR WhatsApp number (TODO)
  js/site-i18n.js  js/site.js   landing texts (en/hi) + WhatsApp links + preview
  js/shop-loader.js             picks ?shop= and fetches its JSON
  js/i18n.js common.js cart.js app.js admin.js   store (shared helpers, cart, storefront, dashboard)
  js/udhaar-core.js udhaar.js   Udhaar Khata logic + page
  js/qr-poster.js               poster + QR (uses assets/vendor/qrcode-generator)
  js/pwa.js                     registers sw.js
  images/                       original SVG art, icons, OG image
docs/NEW-SHOP.md                how to add a shop
tests/                          static, logic, sell-kit and browser tests
manifest.webmanifest sw.js sitemap.xml robots.txt vercel.json
```

## Demo-only (be honest with shop owners)

- **No online payment.** Customers pay the shop directly (cash/UPI). The site never takes payment.
- **WhatsApp is the order channel.** An order exists only when the customer presses **Send** in WhatsApp.
- **Dashboard and Udhaar Khata data are local** to one browser on one device. No login, no cloud sync. To change prices for every customer, edit the shop's JSON file and deploy.
- **Udhaar Khata is a record book only**, not lending or payments.
- **Demo shops, products, prices, sample orders and reviews are fictional.**

## Preview / deploy

- GitHub Pages: push to `main`; the site is served from the repository root.
- Vercel: see `DEPLOYMENT.md`.
- Locally: any static server from the repo root (for example `npx serve .`), then open `http://localhost:3000/`. The store needs a server (it fetches its JSON); opening the HTML file directly will show "shop not found".
- After changing files, bump `CACHE` in `sw.js` (`ks-shell-v2`, …) so installed phones refresh.

## Tests

See `TESTING.md`. Quick run:

```
node tests/static.test.js && node tests/logic.test.js && node tests/sellkit.test.js
node tests/e2e.js        # needs playwright + chromium
```

## Security notes

- No secrets, passwords or API keys. No external scripts, fonts or CDNs.
- All user text is inserted with `textContent`; no `eval()`, no `innerHTML`.
- Content-Security-Policy meta on every page (`script-src 'self'`).
- Shop JSON values are validated (ids, colours, image URLs, prices) before use.
