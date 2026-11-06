#!/usr/bin/env node
/* ============================================================
   KIRANAYAP - STATIC PER-SHOP PAGES
   Writes store/<id>/index.html for every shop in
   store/shops/shops.json, from the template store/index.html.

   Why: WhatsApp / Facebook / Google read the page's HTML without
   running JavaScript. A link like store/index.html?shop=mithai
   always showed the generic "Demo shop" preview. Each generated
   page has the shop's own <title>, description, canonical URL and
   og:/twitter: tags written into the HTML, and it loads the same
   app (the shop is preset with <html data-shop="<id>">).
   ?shop=<id> links keep working; they now say canonical = the
   static page.

   Run after adding or editing a shop (no installs needed):
       node tools/build-shop-pages.js
   It also rewrites the shop entries in sitemap.xml.
   tests/static.test.js fails when the pages are out of date.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://kiranayap.pages.dev/";
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clean(s, max) {
  s = String(s === null || s === undefined ? "" : s).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return max && s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}
function setAttr(html, re, value, label) {
  if (!re.test(html)) throw new Error("template is missing " + label);
  return html.replace(re, (m, a, b) => a + esc(value) + b);
}

/* The text a shop's link preview shows */
function meta(shop) {
  const id = shop.id;
  const live = shop.demo === false;
  const name = clean(shop.storeName, 60);
  const t = (shop.text && shop.text.en) || {};
  let title = clean(t["page.title.store"], 70) || name + " - order on WhatsApp";
  if (live && /\b(demo|sample)\b/i.test(title)) title = name + " - order on WhatsApp";
  const where = clean(shop.storeLocation, 80);
  const desc = live
    ? clean("Order from " + name + (where ? ", " + where : "") + " on WhatsApp. Pick your items, send the order, and pay the shop directly.", 200)
    : clean("Demo shop website by KiranaYap: " + (t["hero.sub"] || "browse products and send your order on WhatsApp.") + " Sample products and prices.", 200);
  const url = SITE + "store/" + id + "/";
  const ogFile = "assets/images/og/" + id + ".jpg";
  let image = SITE + "assets/images/og-image.png";
  if (typeof shop.ogImage === "string" && /^https:\/\//.test(shop.ogImage)) image = shop.ogImage;
  else if (fs.existsSync(path.join(ROOT, ogFile))) image = SITE + ogFile;
  return { id, live, name, title, desc, url, image, imageAlt: name };
}

function buildPage(template, shop) {
  const m = meta(shop);
  let h = template;
  /* one folder deeper: ../ -> ../../ for site files, shop JSON stays in ../shops/ */
  h = h.replace('<html lang="en" data-base="../">',
    '<html lang="en" data-base="../../" data-shop="' + esc(m.id) + '" data-shops-base="../shops/"' + (m.live ? ' class="is-live-shop"' : "") + ">");
  if (h.indexOf('data-shop="') < 0) throw new Error("template <html> tag changed; update tools/build-shop-pages.js");
  h = h.replace(/(src|href)="\.\.\/(assets|manifest|index\.html)/g, '$1="../../$2');
  h = h.replace(/href="admin\.html"/g, 'href="../admin.html"');
  h = h.replace(/href="index\.html" data-keep-shop/g, 'href="./" data-keep-shop');

  h = setAttr(h, /(<title[^>]*>)[^<]*(<\/title>)/, m.title, "<title>");
  h = setAttr(h, /(<meta name="description" content=")[^"]*(")/, m.desc, "meta description");
  h = setAttr(h, /(<link rel="canonical" href=")[^"]*(")/, m.url, "canonical");
  h = setAttr(h, /(<meta property="og:title" content=")[^"]*(")/, m.title, "og:title");
  h = setAttr(h, /(<meta property="og:description" content=")[^"]*(")/, m.desc, "og:description");
  h = setAttr(h, /(<meta property="og:url" content=")[^"]*(")/, m.url, "og:url");
  h = setAttr(h, /(<meta property="og:image" content=")[^"]*(")/, m.image, "og:image");
  h = setAttr(h, /(<meta name="twitter:title" content=")[^"]*(")/, m.title, "twitter:title");
  h = setAttr(h, /(<meta name="twitter:description" content=")[^"]*(")/, m.desc, "twitter:description");
  h = setAttr(h, /(<meta name="twitter:image" content=")[^"]*(")/, m.image, "twitter:image");
  h = h.replace(/(<meta property="og:image" content="[^"]*">)/, '$1\n  <meta property="og:image:alt" content="' + esc(m.imageAlt) + '">');
  const color = shop.colors && /^#[0-9a-fA-F]{6}$/.test(shop.colors.brand) ? shop.colors.brand : null;
  if (color) h = h.replace(/(<meta name="theme-color" content=")[^"]*(")/, "$1" + color + "$2");

  /* visible text for crawlers and for the first paint (the app re-renders it) */
  const t = (shop.text && shop.text.en) || {};
  const swap = (key, value) => {
    if (!value) return;
    const re = new RegExp('(data-i18n="' + key.replace(/\./g, "\\.") + '"[^>]*>)[^<]*(<)');
    h = h.replace(re, (all, a, b) => a + esc(clean(value, 160)) + b);
  };
  ["hero.eyebrow", "hero.title", "hero.sub", "hero.cta", "footer.about"].forEach((k) => swap(k, t[k]));
  if (shop.hours && shop.hours.en) swap("footer.hours", shop.hours.en);
  if (m.id !== "kirana") h = h.replace('<strong data-brand-name>KiranaYap</strong>\n          <small id="storeLine" class="store-line"></small>',
    "<strong data-brand-name>" + esc(m.name) + '</strong>\n          <small id="storeLine" class="store-line"></small>');
  if (typeof shop.heroImage === "string" && /^assets\/images\/[A-Za-z0-9_\-./]+$/.test(shop.heroImage)) {
    h = h.replace('src="../../assets/images/products/hero-kirana.webp"', 'src="../../' + shop.heroImage + '"');
  }
  return h.replace("<!DOCTYPE html>\n", "<!DOCTYPE html>\n<!-- GENERATED by tools/build-shop-pages.js from store/index.html + store/shops/" + m.id + ".json. Do not edit by hand. -->\n");
}

function sitemap(xml, ids) {
  const lines = xml.split("\n").filter((l) => !/\/store\/(index\.html\?shop=|[a-z0-9-]+\/<\/loc>)/.test(l));
  const today = new Date().toISOString().slice(0, 10);
  const add = ids.map((id) => "  <url><loc>" + SITE + "store/" + id + "/</loc><lastmod>" + today + "</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>");
  const at = lines.findIndex((l) => /shop-website-varanasi/.test(l));
  lines.splice(at >= 0 ? at + 1 : lines.length - 1, 0, ...add);
  return lines.join("\n");
}

function main(check) {
  const template = read("store/index.html");
  const reg = JSON.parse(read("store/shops/shops.json")).shops;
  const out = {};
  reg.forEach((r) => {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(r.id) || r.id === "shops" || r.id === "admin") throw new Error("bad shop id in shops.json: " + r.id);
    const shop = JSON.parse(read("store/shops/" + r.id + ".json"));
    shop.id = r.id;
    out["store/" + r.id + "/index.html"] = buildPage(template, shop);
  });
  let xml = read("sitemap.xml");
  const ids = reg.map((r) => r.id);
  const keep = xml.split("\n").filter((l) => /\/store\/[a-z0-9-]+\/<\/loc>/.test(l)).map((l) => /\/store\/([a-z0-9-]+)\//.exec(l)[1]);
  if (check) return { pages: out, sitemapOk: JSON.stringify(keep) === JSON.stringify(ids) };
  Object.keys(out).forEach((f) => {
    fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, f), out[f]);
    console.log("wrote " + f);
  });
  if (JSON.stringify(keep) !== JSON.stringify(ids)) {
    fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap(xml, ids));
    console.log("updated sitemap.xml");
  }
  return { pages: out };
}

module.exports = { main, meta, buildPage, SITE };
if (require.main === module) main(false);
