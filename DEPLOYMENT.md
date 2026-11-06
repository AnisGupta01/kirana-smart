# Deployment guide (Android friendly)

KiranaYap is live on Cloudflare Pages at https://kiranayap.pages.dev/. You only need a free GitHub account and a free Cloudflare account (Vercel also works). No coding tools are required to deploy.

## Part 1: Get the files ready

1. Download the project ZIP to your phone.
2. Extract it with a file manager (Files by Google: tap the ZIP, then **Extract**).
3. Open `assets/js/site-config.js` and put your own WhatsApp number in `ownerWhatsApp` (format `91` + 10 digits). For a shop, edit its file in `store/shops/` (see `docs/NEW-SHOP.md`). Save.

## Part 2: Upload to GitHub

Option A - GitHub website (no Git knowledge needed):

1. Open github.com in Chrome and sign in (create a free account if needed).
2. Tap **+** then **New repository**. Name it `kirana-smart` (the existing repository name; the brand on the site is KiranaYap). Keep it **Public** or **Private**. Tap **Create repository**.
3. On the empty repository page tap **uploading an existing file**.
4. Upload the project files. The folder structure must stay the same: `index.html`, `sw.js`, `manifest.webmanifest`, `vercel.json` in the root, plus the `store`, `assets` and `docs` folders with their sub-folders.
   - If your phone cannot upload folders, open Chrome menu and choose **Desktop site**. GitHub's uploader then accepts folders, or upload files folder by folder using **Add file > Upload files** after creating the folders with **Add file > Create new file** (type `assets/css/x` in the name box to create a folder).
5. Tap **Commit changes**.

Option B - Skip GitHub: on a computer, install the Vercel CLI and run `vercel` inside the folder.

## Part 3: Cloudflare Pages (free, what the live site uses)

1. dash.cloudflare.com > **Workers & Pages > Create > Pages**.
2. Either **Connect to Git** and pick the `kirana-smart` repository (Framework preset: **None**, Build command: empty, Build output directory: `/`), or **Upload assets** and drop the public files (index.html, the HTML pages, `_headers`, `404.html`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, and the `assets`, `store`, `demo` folders).
3. Project name `kiranayap` gives `https://kiranayap.pages.dev/`. The site is served from the domain root.
4. `_headers` sets caching (assets 1 day, pages/`sw.js`/manifest no-cache) and security headers. `404.html` is shown for unknown addresses.
5. Note: Cloudflare Pages serves `about.html` also as `/about` (it redirects `.html` addresses to the short form). Links keep working either way.

## Part 3a: GitHub Pages (alternative)

Repository > **Settings > Pages** > Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)`. The site appears at `https://<username>.github.io/<repository>/` about a minute after each push. (If you use this, change the absolute URLs in canonical/OG tags, `sitemap.xml`, `robots.txt` and `assets/js/site-config.js`.)

## Part 3b: Deploy on Vercel (alternative)

1. Open vercel.com and tap **Sign Up**, choose **Continue with GitHub**.
2. Tap **Add New... > Project**.
3. Pick the `kirana-smart` repository and tap **Import**.
4. Framework Preset: **Other**. Leave Build Command and Output Directory **empty**. Root Directory: `./`.
5. Tap **Deploy**. After about a minute you get a link like `https://<project>-xxxx.vercel.app`.
6. Open the link on your phone. Test: add items, open the cart, checkout, and confirm WhatsApp opens with the order text.

## Part 4: Updating later

Change a file on GitHub (open the file, tap the pencil, edit, **Commit changes**). Cloudflare Pages (Git-connected) or Vercel redeploys automatically in about a minute.

## After editing a shop file (store/shops/*.json)

Browsers keep the first copy of the product list. After you deploy a changed shop file, new visitors see it automatically. On your own phone open `store/admin.html?shop=<id>` > **Settings** > **Reset demo data** to see the new list. Also bump `CACHE` in `sw.js` so installed phones refresh.

## Custom domain (optional)

In Cloudflare Pages: Project > **Custom domains** (Vercel: Project > **Settings > Domains**). Then update the absolute URLs listed above. Buying a domain is a separate paid step.

## Before showing a real shop

- Put your own number in `assets/js/site-config.js` (landing page buttons) and the shop's real number in its `store/shops/<id>.json`, then send yourself a test order.
- Replace sample products, prices and stock. Ask the owner to verify every price.
- Tell the owner clearly: no online payment, no automatic sync to the dashboard, the dashboard has no login.
