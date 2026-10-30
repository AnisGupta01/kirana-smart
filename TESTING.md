# Testing

Automated test files are included. Run them from the project folder.

| Command | What it checks | Needs |
|---|---|---|
| `node tests/static.test.js` | Required files exist, every local link/script/style path resolves, no inline scripts, no `eval()`, no unsafe HTML insertion, no secrets, placeholder WhatsApp number, cinematic demo config + photos (exist, WebP, ≤150 KB, every demo product has a photo), self-hosted fonts | Node only |
| `node tests/logic.test.js` | Products, validation, totals (no rounding errors), cart limits and persistence, WhatsApp message and URL encoding, sample orders, reset, English/Hindi key parity | Node only |
| `node tests/sellkit.test.js` | Shop JSON files (4 niche demos), shop loader and per-shop storage keys, Udhaar Khata maths (paise, running balance, CSV escaping/injection, Hindi reminder URL), landing WhatsApp links and Hindi/English text parity, QR link checks (decodes the QR when `jsqr` is installed) | Node only (`npm i jsqr` optional) |
| `node tests/e2e.js` | Real Chromium: search, filters, sorting, cart, stock limit, checkout validation, WhatsApp URL, language switch and persistence, dashboard add/edit/delete, stock and price updates, order status changes, settings, reset, layout at 360/390/768/1280 px, blocked and corrupt storage. Also runs `tests/e2e-sellkit.js`: landing page (sections, demo carousel, shop tabs + mini cart, every demo card and product card has a WebP photo that loads, desktop hero loads the live cinematic demo, WhatsApp buttons with placeholder and real number, Hindi), every demo store product card has a loading WebP photo, premium cinematic demo (6 scenes, scroll-driven burst, add-to-cart, WhatsApp URL to the config number, delivery address check, Hindi, persistence, reduced motion, no overflow), 3 niche demos end-to-end incl. WhatsApp checkout and dashboard links, Udhaar Khata flows + CSV download, QR poster (scans the rendered QR, A4 print = 1 page), city and legal pages, PWA offline, no overflow, no console errors | `npm i playwright` and a Chromium browser |

Set `CHROMIUM_PATH=/path/to/chromium` if the browser is not found automatically.

## Results recorded when this package was built

All three suites passed in the build environment (Node 22, Chromium via Playwright). Exact counts are in the summary delivered with the ZIP.

## What was NOT tested (be honest with customers)

- **A real WhatsApp send.** Tests confirm the correct `https://wa.me/...?text=...` link is produced and opened. They cannot press Send inside WhatsApp or check delivery to a real phone.
- **A real Vercel / GitHub Pages deployment.** Tests use a local static server. `vercel.json` is valid JSON but was not run through Vercel.
- **robots.txt on a project site.** Search engines read robots.txt only at a domain root, so it takes effect once the site has its own domain.
- **Real Android devices and other browsers.** Layout was checked in Chromium at phone, tablet and desktop widths. Safari, Firefox, and physical phones were not tested.
- **Screen readers.** Labels, roles and keyboard handling are in place and keyboard behaviour is tested, but no screen reader was used.
- **Images from the internet.** Demo products use generated pictures; custom `https://` image links were only checked for format.

## Manual checklist before showing a shop

1. Set your number in `assets/js/site-config.js` and the shop's number in `store/shops/<id>.json`, then send yourself a test order.
2. Replace sample products and verify every price with the owner.
3. Open the site on the shop owner's own phone and place a test order.
4. Open `store/admin.html?shop=<id>`, change a price, refresh the store in the same browser and confirm it updated.
5. Tell the owner what is demo-only (see README).
