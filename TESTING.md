# Testing

Three automated test files are included. Run them from the project folder.

| Command | What it checks | Needs |
|---|---|---|
| `node tests/static.test.js` | Required files exist, every local link/script/style path resolves, no inline scripts, no `eval()`, no unsafe HTML insertion, no secrets, placeholder WhatsApp number | Node only |
| `node tests/logic.test.js` | Products, validation, totals (no rounding errors), cart limits and persistence, WhatsApp message and URL encoding, sample orders, reset, English/Hindi key parity | Node only |
| `node tests/e2e.js` | Real Chromium: search, filters, sorting, cart, stock limit, checkout validation, WhatsApp URL, language switch and persistence, dashboard add/edit/delete, stock and price updates, order status changes, settings, reset, layout at 360/390/768/1280 px, blocked and corrupt storage | `npm i playwright` and a Chromium browser |

Set `CHROMIUM_PATH=/path/to/chromium` if the browser is not found automatically.

## Results recorded when this package was built

All three suites passed in the build environment (Node 22, Chromium via Playwright). Exact counts are in the summary delivered with the ZIP.

## What was NOT tested (be honest with customers)

- **A real WhatsApp send.** Tests confirm the correct `https://wa.me/...?text=...` link is produced and opened. They cannot press Send inside WhatsApp or check delivery to a real phone.
- **A real Vercel deployment.** The site is plain static files and was served from a local static server only. `vercel.json` is valid JSON but was not run through Vercel.
- **Real Android devices and other browsers.** Layout was checked in Chromium at phone, tablet and desktop widths. Safari, Firefox, and physical phones were not tested.
- **Screen readers.** Labels, roles and keyboard handling are in place and keyboard behaviour is tested, but no screen reader was used.
- **Images from the internet.** Demo products use generated pictures; custom `https://` image links were only checked for format.

## Manual checklist before showing a shop

1. Set a real WhatsApp number in `assets/js/config.js` and send yourself a test order.
2. Replace sample products and verify every price with the owner.
3. Open the site on the shop owner's own phone and place a test order.
4. Open `admin.html`, change a price, refresh the store in the same browser and confirm it updated.
5. Tell the owner what is demo-only (see README).
