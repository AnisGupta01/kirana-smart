# Kirana Smart: Phase 0 re-audit (pro-upgrade)

Audited: branch `pro-upgrade` at `3435836` on 2 Nov 2026 (IST). Audit only, with no fixes in this commit.

**Branch state:** PR #5 is **already merged** into `main` (merge commit `c1b21c0`, 2 Nov 2026 12:30 IST). `git diff pro-upgrade origin/main` is empty, so `main` serves exactly what is audited here. The live GitHub Pages site should therefore already show this version. This was not checked against the live URL.

Method: read README, ARCHITECTURE, AUDIT. Ran every test suite. Took screenshots at 360 and 1280 px (home, `store/?shop=kirana`, udhaar, qr-poster). Ran axe-core 4 (WCAG 2.0/2.1 A+AA) on 6 pages and Lighthouse 13.6 (mobile) on home and store. Also ran targeted Playwright probes, listed below, plus greps. The screenshots and probe scripts were kept outside the repo and are not committed.

---

## 1. Findings by impact

### Critical
- **C1. Returning customers see stale prices and stock indefinitely.** `assets/js/common.js:159-176`: `KS.getProducts()` copies the shop JSON's products into LocalStorage (`ks_<id>_products_v1`) on the first visit. After that it reads only LocalStorage and never reads the JSON again. *Verified with a probe:* a visitor loaded `?shop=mithai`, then the JSON changed (Kaju Katli ₹560 → ₹671, `available:false`, `stock:0`). On reload the store still showed ₹560 and the item could still be ordered. A fresh visitor saw ₹671. Every "send us the change and we update it" promise is therefore false for repeat customers, and out-of-stock items stay orderable at old prices. No test covers this.

### High
- **H1. Live (`demo:false`) shops still show demo/admin material to customers.** `store/index.html:61` and `:226` link to "Shop setup tool (local demo)" (`admin.html`) with no `data-demo-only`. `store/index.html:158` says "Demo offers - sample discounts for demonstration only." with no `data-demo-only`. *Verified* with a `demo:false` probe: both are visible. The setup tool also lets any customer change prices in their own browser, and orders then go out with those prices (the order is unverified text either way, but this makes it one click).
- **H2. WhatsApp/Facebook link previews of every shop say "Demo shop … sample products and prices".** `store/index.html:8-20` has a static `og:title`/`og:description`/`og:image` and `canonical`/`og:url` = `?shop=kirana`. `app.js:686-690` rewrites canonical/og:url only in JS, and WhatsApp's crawler does not run JS. A paying shop that shares its link in WhatsApp groups (the main sales channel) gets a "Demo shop" preview with the Kirana Smart image. Google also sees the canonical pointing at `kirana` for every shop until it renders the JS.
- **H3. Three different go-live promises.** The OG image (`assets/images/og-image.png`) says "Apni dukaan ki website, **1 din mein**". The landing says "Usually within **1–2 working days**" (`assets/js/site-i18n.js:113`, `onboarding.html:60`). The refund policy says a refund if not live within **3 working days** (`refund.html:55`). These conflict in a public promise, and the refund policy is the binding one.
- **H4. Landing page mobile performance is poor on a cheap-Android profile.** Lighthouse mobile performance is 66, TBT 4,980 ms, TTI 9.0 s (see §5). This is the page shopkeepers land on from Instagram.

### Medium
- **M1. Hero has 3 equal-weight CTAs plus a sticky 4th** (`index.html:104-106` Live Demo / Get Started / WhatsApp karein, plus the sticky "Get a free demo on WhatsApp"). The primary styled button is "Live Demo", not the WhatsApp lead. "Get Started" goes to `onboarding.html`, an extra hop before WhatsApp.
- **M2. Stock/price-update wording differs page to page, and no turnaround time is stated anywhere** (see Phase 1 item 4).
- **M3. Trust pages are English-only in Hindi mode** (`about/contact/faq/onboarding/privacy/terms/refund.html` have 0 `data-i18n` attributes, only a short Hindi summary box). The Hindi toggle on `faq.html` left 47 English text nodes and on `about.html` 43.
- **M4. Premium demo shown in 4 places on the landing, plus jargon** (see Phase 1 item 6). The hero phone shows the dark "cinematic" chai shop. That is the ₹2,999 product, while most visitors are kirana owners buying the ₹999 plan, so it sets an expectation Starter doesn't meet.
- **M5. Landing FAQ lacks GST/licences, delivery and outside-UP questions.** `l.faq.q6`/`q7` (Udhaar, GST) exist in `site-i18n.js` but are not rendered in `index.html` (FAQ at `:403-407` renders q1–q5, q8).
- **M6. Service worker pre-caches 109 files / ~2.0 MB on first visit** (`sw.js:11-38`, including about 40 product photos). Silent background data use on prepaid mobile data. It also lacks `assets/css/print-a6.css` and `tiro-deva-italic.woff2`, so A6 printing offline may miss styles (not tested offline).
- **M7. The shopkeeper landing sells a template licence and reseller plan** (`index.html:366-372`). It dilutes the single message and signals that competitors can resell the same site for ₹499/mo.
- **M8. No `404.html`.** GitHub Pages will show its generic 404 with no way back to the site. *(The test server's 404 check passes because it only checks the status code.)*

### Low
- **L1.** About 56 unused i18n keys in `assets/js/site-i18n.js` (e.g. `l.why.r3*`, `l.b2.*`, `l.ag.lead`, `l.price.popular`, `l.niche.*.d`). Found by literal-reference grep; `l.wa.*` excluded because they are built dynamically.
- **L2.** `.btn-whatsapp` contrast 4.3:1 (white on `#128c4a`, `assets/css/style.css:37`) on `faq.html`, below AA 4.5:1 for 16 px text. This is the only axe violation on the 6 pages scanned.
- **L3.** `index.html:117` `aria-label` doesn't match visible text (Lighthouse `label-content-name-mismatch`).
- **L4.** Images are much larger than displayed: landing tab icons are drawn at 28 px from 480–720 px sources (`index.html:215-218`, about 136 KB); `chai/hero-burst.webp` is 128 KB. Lighthouse estimates 385 KiB of image savings on home.
- **L5.** `tiro-deva.woff2` (99 KB) downloads on the English landing just to draw the "हिंदी" button label (`assets/css/landing.css:10`, unicode-range triggers on that one word).
- **L6.** The kirana demo header truncates both the brand and the shop name at 360 px ("Kirana …" / "Sharma Kir…"). Other shops show the shop name.
- **L7.** The order message is always English, even when the customer used Hindi (`common.js:543-570`). This is acceptable for shopkeepers, but it's a choice to make deliberately.
- **L8.** `qr-poster.html?url=&name=` pre-fills any http(s) URL into a poster that says "Website by Kirana Smart" (`assets/js/qr-poster.js:243-255`). This is a minor brand-abuse vector; URLs are validated as http(s) only.
- **L9.** `img-src https:` in every CSP lets a shop JSON load any external image (tracking pixels possible). Shop JSON is owner-controlled, so this is low risk. A meta CSP cannot set `frame-ancestors`, and GitHub Pages can't send headers, so the `vercel.json` headers apply only on Vercel.
- **L10.** The fonts folder has `LICENSE.md` with a URL but not the full OFL 1.1 text (OFL requires the licence to accompany the fonts). Copyright lines also differ slightly from the font metadata (Inter "2016", Tiro "2020 The Indigo Project Authors").
- **L11.** Store/udhaar/QR pages use the system font stack. On a device without a Devanagari system font, the "हिंदी" toggle shows tofu boxes (seen in the sandbox screenshot). Android ships Noto Devanagari, so the real-device risk is low (not verified on a device).
- **L12.** The full unsplit `node tests/e2e.js` / `node tests/pro.e2e.js` runs take more than 2 minutes. In this sandbox they only complete when split (see §3).

### Verified OK (no action)
- Security: no `innerHTML`/`eval`/`document.write` in first-party JS. Every page has a CSP meta with `script-src 'self'` and no `unsafe-inline` (Playwright `addScriptTag` was blocked by it). No secrets or third-party scripts/CDNs. Shop id, colours and image URLs are validated (`common.js:102-108, 912-1003`). wa.me text goes through `encodeURIComponent` (`common.js:573`). Udhaar CSV escaping and injection are tested.
- Accessibility: axe found 0 violations on home, store, udhaar, qr-poster and chai demo, and 1 on faq (L2). Lighthouse a11y is 100 on home and store. `lang` switches to `hi` (`site.js:41`, `common.js:632`). Skip links are present, focus-visible styles exist, and touch targets are ≥44 px (tested).
- SEO: every public page has title, description, canonical, OG and Twitter tags. `robots.txt` disallows admin, `sitemap.xml` lists 17 URLs, and the chai demo is `noindex` and not in the sitemap. Lighthouse SEO is 100.
- Mobile: no horizontal scroll at 320/360/375/412/1280 px (tested). 1280 px demo carousel shows 4 cards side by side (verified screenshot plus test).
- Checkout: name and address are required (address only for delivery), phone is optional but validated if typed (`common.js:381-408`, `app.js:500-503`). The footer says "Sent from the <shop> website." when `demo:false` (`common.js:569`).
- Dead files: the `f-*.svg`/`hero-*.svg` files are gone, `bindPreview` is gone, and every image in `assets/images` is referenced (ingredient images via `cinema.js:105`).

---

## 2. Phase 1 checklist status (on pro-upgrade)

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | 404.html + .nojekyll | **Not done** | Neither file exists in the repo root |
| 2 | Phone optional, name+address required, no "Sent from demo store" when `demo:false` | **Done** (but see H1) | `common.js:398-408, 569`; `app.js:500-503`; demo/admin text still visible on live shops (`store/index.html:61,158,226`) |
| 3 | One main CTA "Free demo WhatsApp par maango", other two small links; setup tool not on landing | **Not done** | `index.html:104-106` three full buttons, label "WhatsApp karein"; `index.html:201` "Shop setup tool (local demo)" on landing |
| 4 | Stock claim identical everywhere: "stock is updated by us within 1 working day" | **Not done** | Phrase appears nowhere. Variants: landing FAQ `site-i18n.js:330` ("we update it (within your plan's monthly changes)", no time); `faq.html:60/163` ("up to 10 changes a month on Starter, 25 on Premium", no time); Hindi `faq.html:154` ("हम बदल देंगे", no limit/time); `terms.html:70` (limits, no time); pricing `index.html:323,345` (limits only). The claim is also untrue for returning customers until C1 is fixed |
| 5 | Hindi mode: full Devanagari headline, sections, FAQ | **Partly done** | Landing is fully Devanagari in Hindi mode (only brand, city names, phone, email remain Latin). City pages are OK. Trust/legal pages stay English (faq 47, about 43 English nodes). The QR poster keeps Hinglish lines ("Scan karo, WhatsApp pe order karo", "Saamaan chuno") and the store keeps unit "12 pcs" |
| 6 | Chai premium demo in one place only; no "sell on looks"/"cinematic" jargon | **Not done** | Chai is linked at `index.html:117` (hero phone), `:131` (hero iframe), `:187` (carousel), `:349` (pricing), `:445` (footer). Jargon: `index.html:331` "sell on looks", `:338` "Cinematic one-product-per-screen design"; `site-i18n.js:26` "Cinematic website", `:33`, `:320` (+ Hindi `:361,:368,:655`); `demo/chai/index.html:9,15,20` meta "A cinematic demo shop" |
| 7 | FAQ covers delivery, GST/licences, orders outside UP | **Partly done** | GST/FSSAI is on `faq.html` only (not on the landing FAQ). Delivery: no FAQ entry (only "not included: delivery staff" on `onboarding.html:73` and city pages). Outside UP: not covered |
| 8 | Unused f-*/hero-* SVGs and dead code removed; sw.js cache bumped | **Mostly done** | SVGs removed, `bindPreview` removed, `CACHE = "ks-shell-v4"`. About 56 unused i18n keys remain (L1). The sw list lacks `print-a6.css` and `tiro-deva-italic.woff2` |
| 9 | 1280 carousel OK, e2e fully green, subpath test, broken-link crawl | **Done (with caveat)** | Carousel test passes (4 cards) and was visually confirmed. All suites are green when split. The subpath server is `tests/serve-subpath.js`. The crawl is in `pro.e2e.js:130-160` (all seed pages + one level of links, 170 URLs → 200). Caveat: full unsplit runs exceed 2 min here, and one 4-way parallel run crashed once (browser closed) |
| 10 | Per-shop canonical + OG on store pages; sitemap updated | **Partly done** | canonical/og:url are rewritten by JS only (`app.js:686-690`). The static HTML points every shop at `?shop=kirana` and og:title/description/image are generic "Demo shop" (H2). The sitemap lists the 4 demo shops and the new pages |

---

## 3. Test results (exact, this audit, Node 22, Playwright chromium-headless-shell 1248)

| Suite | Command | Result |
|---|---|---|
| static | `node tests/static.test.js` | **363 passed, 0 failed** |
| logic | `node tests/logic.test.js` | **146 passed, 0 failed** |
| sellkit | `node tests/sellkit.test.js` | **182 passed, 0 failed** (jsqr decode ran) |
| e2e storefront | `E2E_SKIP_SELLKIT=1 node tests/e2e.js` | **151 passed, 0 failed** |
| e2e-sellkit | `KS_SECTIONS=<s> node tests/e2e-sellkit.js` | landing 49/49, cine 36/36, niche 52/52, photos 5/5, pages 18/18, pwa 6/6, qr 14/14, udhaar 25/25 = **205 passed, 0 failed** |
| pro e2e (subpath, 360+1280) | `PRO_PART=<p> node tests/pro.e2e.js` | pages 14/14, demos 94/94, qr 31/31, misc 35/35 = **174 passed, 0 failed** |
| **Total** | | **1,221 passed, 0 failed** |

Caveats: `PRO_PART=pages` crashed once ("Target page, context or browser has been closed", 12 passed / 1 failed) when run in parallel with the other 3 parts. Run alone it passed 14/14. A full unsplit `node tests/pro.e2e.js` was stopped by the sandbox's 117 s limit after 44 passes. Neither is a product bug, but CI should run the parts separately.

**Test gaps:** (1) no test that a JSON price/stock change reaches a returning visitor (C1); (2) no `demo:false` test that hides every demo/admin string (H1); (3) no check of static (non-JS) OG tags per shop (H2); (4) no consistency test for promises (go-live days, update turnaround) across pages and the OG image; (5) the 404 check doesn't cover a real `404.html`; (6) no performance budget test; (7) no offline A6 print test.

---

## 4. Image / font / third-party licence risk

| Asset | Count / size | Apparent origin | Risk |
|---|---|---|---|
| `assets/images/products/*.webp` | 86 files, 1.1 MB | AI-generated earlier in this project (commit `45b275c`; README says "generated, no logos"). No metadata in the files (stripped) | Low. Record the generator/tool and its terms in a `CREDITS.md`; spot-check for brand-like packaging |
| `assets/images/chai/*.webp` | 26 files, 390 KB | AI-generated in this project (commit `45b275c`) | Low, same note |
| `assets/images/landing/shop-*.webp` | 4 files, 193 KB | AI-generated in this project (commit `929d4a0`) | Low, same note |
| `assets/images/og-image.png` | 1 | Made in this project (commit `f2b4351`); illustration style matches the repo's own SVG art (inferred) | Low; content is wrong ("1 din mein", H3) |
| `assets/images/icon-*.png` (4) | 4 | Made in this project (commit `5bbde13`), likely rendered from `logo.svg` (inferred) | Low |
| `logo.svg`, `placeholder.svg` | 2 | Uploaded by Anish (commit `94965a9` "Add files via upload"), later reworked in `d409754`. **Original source unknown** | **Unclear: confirm Anish drew/owns the original logo** |
| `cart/check/chevron/search/tick.svg` | 5 | Hand-written simple paths (`d409754`, `0016f92`) | Low |
| `chat.svg` | 1 | WhatsApp-style phone-in-bubble glyph | Low: WhatsApp is a Meta trademark. Its use as a "chat on WhatsApp" button is common but subject to Meta's brand guidelines |
| Fonts: Inter, Cormorant Garamond (+italic), Tiro Devanagari Hindi (+italic) | 5 woff2, 325 KB | Google Fonts subsets. Font metadata says SIL OFL 1.1 | Low; add the full OFL text (L10) |
| `assets/vendor/qrcode-generator` 2.0.4 | 1 | Kazuhiko Arase, MIT, LICENSE included | None |

No third-party scripts, CDNs, analytics or remote fonts.

---

## 5. Performance

Lighthouse 13.6.0, mobile form factor, default simulated throttling. Run with Playwright's chrome-headless-shell (arm64) against a local server under `/kirana-smart/` (no CDN, no cache headers). These are lab numbers from a sandbox CPU, so treat TBT as relative, not absolute.

| Page | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | TTI | Weight |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` (landing) | **66** | 100 | 100 | 100 | 1.9 s | 1.9 s | **4,980 ms** | 0 | 4.1 s | 9.0 s | 1,036 KiB |
| `store/index.html?shop=kirana` | **67** | 100 | 100 | 100 | 1.3 s | 2.6 s | **2,150 ms** | 0.001 | 3.4 s | 4.9 s | 548 KiB |

Not measured: udhaar, qr-poster, demo/chai. Based on weight alone (no animation loop), udhaar and qr-poster are probably lighter than the store, but that is an estimate. The chai demo is likely the heaviest (scroll-driven animation, 128 KB hero image).

Landing main-thread time is 11.7 s ("Other" 5.4 s, style/layout 2.5 s, script 1.8 s). Suspected causes, not profiled further: the 2.8 s hero slideshow interval (`landing.js:57`), scroll handlers, and a forced reflow at `site.js:165`. The largest assets are `chai/hero-burst.webp` 129 KB, `tiro-deva.woff2` 99 KB, `site-i18n.js` 66 KB (both languages always loaded), `hero-cloud-kitchen.webp` 61 KB (shown at 28 px), and the landing shop photos at 43–54 KB each. `landing.css` (31 KB) is render-blocking. JS/CSS are unminified (about 13 KB and 5 KB savings on home, 27 KB and 10 KB on the store). Total first-party JS is 313 KB and CSS 140 KB on disk across all pages.

---

## 6. My recommendations

### (a) Where the planned phases are wrong, low-value or badly ordered
Context: solo founder, zero customers, wants revenue fast, inbound only (Instagram → landing → WhatsApp).

1. **Fix C1 before promising anything about stock.** Making item 4 "identical everywhere" without fixing the cache bug just publishes a consistent false claim. C1 should be Phase 1 item #1.
2. **A single main CTA is right, but choose it carefully.** Make the WhatsApp demo request the only big button ("Free demo WhatsApp par maango"), and keep "Live demo dekho" as a clearly visible text link right under it. Skeptical owners need to see before they message. Drop "Get Started" (onboarding page) entirely; it is a dead-end hop. The sticky bottom WhatsApp bar on mobile is good; keep it.
3. **Full Devanagari everywhere is lower value than it looks.** UP shop owners read Hinglish in Roman script all day on WhatsApp. Landing and FAQ in Hindi are worth it and the landing is already done. Translating privacy/terms/refund into full Hindi is low value now; keep the Hindi summaries.
4. **"Chai demo in one place only" is the right instinct, but the place matters more than the count.** Take it out of the **hero**: the hero should show a plain kirana store on a phone (the ₹999 product most visitors will buy). Keep the chai demo in the carousel and on the Premium card. Showing the ₹2,999 cinematic site in the hero risks "that's not what I got" refund requests.
5. **Per-shop OG must be static HTML, not JS** (H2). It matters more than the canonical tag, because WhatsApp previews are how a shop's customers see the link.
6. **Defer:** build-time leak-tracing (there is no build step and no secrets, and the static test already greps for secrets), trademark filing (do a free search on the IP India public search to make sure "Kirana Smart" doesn't clash; file only after paying customers), more e2e polish, reseller/template-licence work, and the backend phases. None of these bring the first rupee.
7. **404.html/.nojekyll** is worth 15 minutes but is not a Phase 1 priority; nothing in the repo starts with `_`, so `.nojekyll` changes nothing today.

### (b) Top improvements not on the list (trust and conversion on cheap Android)
1. **One real shop, live.** A free pilot for a real neighbourhood shop, with a photo of the QR at their counter and a 20–30 s screen recording of a real order arriving on the owner's WhatsApp. One real proof beats five fictional demos.
2. **Hide every demo/admin string on live shops** (H1) and remove the customer-facing setup-tool link.
3. **Static per-shop page** (`store/<id>/index.html`, or a small copy per shop) with the shop's own name, photo and description in `og:*`, so WhatsApp previews look like the shop.
4. **One set of promises**: go-live time, update turnaround and change limits, identical in the landing, FAQ, terms, refund and OG image (regenerate the OG image).
5. **Show the shop's UPI ID** (from the shop JSON) on the order confirmation and in the WhatsApp message ("Pay to UPI: …"). It is static, needs no gateway, and is a real reason for owners to want the site.
6. **Mobile speed**: stop the hero slideshow/animations on mobile or until interaction, cut the SW pre-cache to the page shell (<300 KB, no product photos), serve 2× thumbnails for tab icons, and replace the Devanagari webfont on the toggle with system text. Target Lighthouse mobile ≥85 on the landing.
7. **Remove the reseller/template-licence block** from the shopkeeper landing; put it on its own page if needed.
8. **Landing FAQ**: add "Delivery kaun karega?", "GST/FSSAI chahiye?" (the string already exists, q7) and "UP ke bahar?" in a few words each.

### (c) Revised Phase 1 (ranked, ship in this order)
1. **Fix stale product cache (C1).** The store always uses the shop JSON's price/stock/availability. LocalStorage edits apply only inside the setup tool's preview. Add a regression test.
2. **Live-shop cleanup (H1).** Mark `store/index.html:61,158,226` `data-demo-only`. Add a `demo:false` test that asserts no "demo/sample/setup tool" text is visible.
3. **Static per-shop OG + canonical (H2)** via one HTML entry per shop; update the sitemap.
4. **One promise set (H3/M2):** go-live, update turnaround ("within 1 working day, up to 10/25 changes a month"), refund days. Same copy everywhere, OG image regenerated.
5. **Hero/CTA:** one WhatsApp CTA + "Live demo" link; remove "Get Started", the setup-tool card and the reseller block from the landing; hero phone shows a kirana store; chai only in the carousel + Premium card; replace the "sell on looks"/"cinematic" copy with plain words.
6. **Mobile performance pass (H4/M6/L4/L5)** to Lighthouse mobile ≥85 on the landing.
7. **UPI ID in the order flow** (new, static).
8. **Landing FAQ:** delivery, GST/licences, outside UP (Hindi + English).
9. **404.html + .nojekyll**, full OFL text, delete unused i18n keys, fix the WhatsApp button contrast (L1, L2, L10, M8).
10. **Real pilot shop + real order video** (non-code, but the highest-leverage trust item); put it on the landing once it exists.
