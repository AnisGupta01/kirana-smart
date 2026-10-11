# Kirana Smart (MVP demo)

A mobile-first grocery website demo for Indian neighbourhood kirana stores. Customers browse products, fill a cart and send the order to the shop on **WhatsApp**. The shopkeeper gets a **demo dashboard** to manage products, stock and sample orders.

Plain HTML, CSS and JavaScript. No build step, no framework, no API keys, no database. It works straight after extracting the ZIP and deploys as a static site on Vercel.

> **This is an MVP demo, not a production multi-store system.** Read "Demo-only" below before showing it to a shop owner.

## What works

- Storefront: header with store name, search, cart count, Hindi/English toggle, mobile menu.
- Home: welcome banner, category shortcuts, featured, popular and demo-offer sections.
- Catalog: 33 sample products in 9 categories, live search, category filter, price/name sort, clear filters, friendly no-results and empty-cart screens.
- Cart: add, increase, decrease, remove, correct subtotal, stock limit enforced, saved in the browser (survives refresh).
- Checkout: name, mobile number, delivery/pickup, address, notes, validation, order summary.
- WhatsApp order: builds a formatted message (store, order ref, customer, items, prices, subtotal, delivery, address, notes, total) and opens `wa.me` with the encoded text.
- Dashboard (`admin.html`): overview, add/edit/delete product (with confirmation), update price and stock, mark available/unavailable, search and filter inventory, low-stock flags, sample orders with status control (Pending, Accepted, Ready, Completed, Cancelled), order detail, settings, reset demo data.

## Demo-only (be honest with shop owners)

- **No online payment.** The site never takes or claims payment.
- **WhatsApp is the order channel.** An order exists only when the customer presses **Send** inside WhatsApp. The site never shows an order as confirmed.
- **Dashboard data is local.** Products, stock, settings and orders live in LocalStorage of one browser on one device. Changes do **not** reach customers' phones. Real orders arrive on WhatsApp, not in the dashboard.
- **Dashboard orders are fictional samples.** The customer site does not write orders into the dashboard.
- **No login.** The dashboard link is public and not secure. Do not store private customer data in it.
- **All products, prices and stock are sample data.** The shop owner must verify every item before real use.
- No delivery tracking, no cloud sync, no multi-store support.

To make changes permanent for every customer, edit `assets/js/config.js` and `assets/js/products.js`, then deploy again. A real backend (database plus login) is the natural next paid upgrade.

## Project structure

```
kirana-smart/
  index.html          customer storefront
  admin.html          shopkeeper demo dashboard
  vercel.json         static hosting settings
  assets/
    css/style.css
    js/config.js      <- shop name, WhatsApp number, delivery fee
    js/products.js    <- demo products and sample orders
    js/i18n.js        <- English and Hindi text
    js/common.js      shared helpers (storage, validation, WhatsApp)
    js/cart.js        cart logic
    js/app.js         storefront
    js/admin.js       dashboard
    images/           logo and placeholder
  tests/              automated checks (run with Node)
  README.md  DEPLOYMENT.md  TESTING.md
```

## Customise for a shop

1. Open `assets/js/config.js`.
2. Change `storeName`, `storeLocation`.
3. Set `whatsappNumber` to the shop's number: country code plus 10 digits, digits only, e.g. `919876543210`. Until you replace the placeholder `91XXXXXXXXXX`, checkout shows an error instead of opening WhatsApp. This is on purpose.
4. Set `deliveryFee` and `freeDeliveryAbove` (in rupees). `0` fee means free delivery.
5. Optional: `brandColor` (hex like `#14532d`) and `defaultLanguage` (`"en"` or `"hi"`).
6. Save and refresh.

## Replace demo products and prices

1. Open `assets/js/products.js`. Each product is one line with `name`, `nameHi`, `category`, `price`, `unit`, `stock`, and so on. The field list is at the top of the file.
2. Edit, add or remove lines. Keep every `id` unique. Categories allowed: `atta, rice, dal, oil, dairy, snacks, beverages, personal, cleaning`.
3. Optional `mrp` (original price) shows a discount badge. Optional `image`: an `https://` link or a file in `assets/images/`. Leave `""` for an automatic picture.
4. **Important:** browsers keep the first copy of the product list. After editing `products.js`, open `admin.html`, go to **Settings**, press **Reset demo data**. (Or clear the site data in your browser.) Customers visiting for the first time will see your new list automatically.

You can also add or edit single products in the dashboard, but those edits stay on that device only.

## Preview on an Android phone

- **Easiest:** deploy to Vercel (see `DEPLOYMENT.md`) and open the link on the phone.
- **Local file:** extract the ZIP with a file manager, then open `index.html` in Chrome. It works from a file too. If the phone refuses, use the Vercel route.

## Upload to GitHub and deploy to Vercel

Step-by-step, Android-friendly instructions are in **DEPLOYMENT.md**.

## Troubleshooting

| Problem | Fix |
|---|---|
| Checkout says the WhatsApp number is not set up | Put a real number in `config.js` (format `91XXXXXXXXXX`) and redeploy. |
| WhatsApp does not open | Install WhatsApp, or tap "Open WhatsApp again" / "Copy order message" on the screen after checkout. |
| My product edits do not show | Dashboard > Settings > Reset demo data (restores `products.js`). |
| Page looks unstyled or blank | Check that the `assets` folder was uploaded with the same folder names. File names are case-sensitive on Vercel. |
| Something broke after many edits | Dashboard > Settings > Reset demo data. |
| Images missing | An automatic picture is used when an image link fails. Check the link starts with `https://`. |
| Browser blocks storage (private mode) | The site still works, but cart and edits are lost on refresh. |

## Security notes

- No secrets, passwords or API keys anywhere.
- All user text is added to the page with `textContent` (no unsafe HTML), and there is no `eval()`.
- A Content-Security-Policy meta tag limits scripts to this site.
- Prices must be above zero and quantities whole numbers within stock.
