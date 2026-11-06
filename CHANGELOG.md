# Changelog

## 2026-11-02: Phase 1 (trust, speed, correctness), branch `phase1`

### 1. C1: returning customers always see current prices and stock
- `store/shops/<id>.json` is fetched network-first (`cache: "no-cache"`, revalidated on every load) and falls back to the browser/offline copy only when the network fails. The service worker never answers a shop JSON with an HTML page.
- LocalStorage copies now carry a fingerprint of the shop JSON they were made from. When the published JSON changes, the fresh JSON wins. Old plain-array copies (from before this fix) are ignored.
- Live shops (`demo:false`) never use local product/settings edits on the storefront; only the setup tool does.
- The cart remembers the price each item was added at. Before checkout (on load, on "Checkout", and when the customer comes back to an open tab after 60 s) the cart is reconciled with fresh data: out-of-stock items are removed, quantities trimmed to stock, and price changes shown ("Kaju Katli: price changed from ₹560 to ₹671"), in English and Hindi.
- Tests: `tests/logic.test.js` (C1 section) and `tests/phase1.e2e.js` part `fresh` reproduce the ₹560 → ₹671 → out-of-stock case.

## 2026-11-02: Phase 0 audit

- Added `docs/AUDIT-PHASE0.md`, a re-audit of the `pro-upgrade` branch (identical to `main` after PR #5). It covers findings ranked by impact, Phase 1 checklist status, exact test results (1,221 passed, 0 failed when split), licence risks, Lighthouse mobile numbers and recommendations.
- No code changes.
