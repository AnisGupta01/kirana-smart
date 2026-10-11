# Deployment guide (Android friendly)

You only need an Android phone, a free GitHub account and a free Vercel account. No coding tools are required to deploy.

## Part 1: Get the files ready

1. Download `kirana-smart.zip` to your phone.
2. Extract it with a file manager (Files by Google: tap the ZIP, then **Extract**).
3. Open `assets/js/config.js` in a text editor app and set the shop name and WhatsApp number (see README). Save.

## Part 2: Upload to GitHub

Option A - GitHub website (no Git knowledge needed):

1. Open github.com in Chrome and sign in (create a free account if needed).
2. Tap **+** then **New repository**. Name it `kirana-smart`. Keep it **Public** or **Private**. Tap **Create repository**.
3. On the empty repository page tap **uploading an existing file**.
4. Upload the project files. The folder structure must stay the same: `index.html`, `admin.html`, `vercel.json` in the root and the `assets` folder with its sub-folders.
   - If your phone cannot upload folders, open Chrome menu and choose **Desktop site**. GitHub's uploader then accepts folders, or upload files folder by folder using **Add file > Upload files** after creating the folders with **Add file > Create new file** (type `assets/css/x` in the name box to create a folder).
5. Tap **Commit changes**.

Option B - Skip GitHub: on a computer, install the Vercel CLI and run `vercel` inside the folder.

## Part 3: Deploy on Vercel

1. Open vercel.com and tap **Sign Up**, choose **Continue with GitHub**.
2. Tap **Add New... > Project**.
3. Pick the `kirana-smart` repository and tap **Import**.
4. Framework Preset: **Other**. Leave Build Command and Output Directory **empty**. Root Directory: `./`.
5. Tap **Deploy**. After about a minute you get a link like `https://kirana-smart-xxxx.vercel.app`.
6. Open the link on your phone. Test: add items, open the cart, checkout, and confirm WhatsApp opens with the order text.

## Part 4: Updating later

Change a file on GitHub (open the file, tap the pencil, edit, **Commit changes**). Vercel redeploys automatically in about a minute.

## After editing products.js

Browsers keep the first copy of the product list. After you deploy a new `products.js`, new visitors see it automatically. On your own phone open `admin.html` > **Settings** > **Reset demo data** to see the new list.

## Custom domain (optional)

In Vercel: Project > **Settings > Domains**. Buying a domain is a separate paid step.

## Before showing a real shop

- Replace the placeholder WhatsApp number with the shop's real number and send yourself a test order.
- Replace sample products, prices and stock. Ask the owner to verify every price.
- Tell the owner clearly: no online payment, no automatic sync to the dashboard, the dashboard has no login.
