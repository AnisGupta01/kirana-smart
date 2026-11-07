#!/usr/bin/env node
/* ============================================================
   KIRANAYAP - CACHE-BUSTING VERSIONS FOR CSS / JS / FONTS
   Adds "?v=<8-hex content hash>" to every reference to a file in
   assets/css, assets/js, assets/fonts and assets/vendor:
   - <link href> / <script src> in every public HTML page
     (incl. the generated store/<id>/ pages),
   - font url()s inside the CSS files,
   - the Hindi strings file that site.js loads on demand
     (KS_SITE_I18N_HI_V in site-i18n.js),
   - the design tokens: tokens.css is copied into the top of
     landing.css and style.css (between the @tokens markers),
   - the service worker's pre-cache list, whose cache name gets the
     same kind of hash (ks-shell-v8-<hash>) so phones drop old copies.
   Because a changed file always gets a new URL, Cloudflare can cache
   these folders for a year ("immutable" in _headers).

   Run after editing any CSS/JS/font (no installs needed):
       node tools/version-assets.js
   It is idempotent. tests/static.test.js fails when a reference is
   missing its version or the version is out of date.
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const VERSIONED = /^assets\/(css|js|fonts|vendor)\//;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const write = (p, s) => { const f = path.join(ROOT, p); if (fs.readFileSync(f, "utf8") !== s) { fs.writeFileSync(f, s); return true; } return false; };
const hashOf = (p) => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, p))).digest("hex").slice(0, 8);

function walk(dir, out) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = dir ? dir + "/" + e.name : e.name;
    if (e.isDirectory()) { if (!/^(\.|node_modules$|tests$|tools$|docs$)/.test(e.name)) walk(p, out); }
    else out.push(p);
  }
  return out;
}

function publicHtml() {
  return walk("", []).filter((f) => f.endsWith(".html"));
}

/* resolve a reference written in `fromFile` to a repo path */
function resolveRef(fromFile, ref) {
  if (/^(https?:|data:|\/\/|#|mailto:)/.test(ref)) return null;
  const clean = ref.split("#")[0].split("?")[0];
  const abs = clean.startsWith("/") ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  return abs;
}

function versionRefs(file, text, attrRe) {
  return text.replace(attrRe, (all, pre, ref, post) => {
    const target = resolveRef(file, ref);
    if (!target || !VERSIONED.test(target) || !fs.existsSync(path.join(ROOT, target))) return all;
    const base = ref.split("?")[0];
    return pre + base + "?v=" + hashOf(target) + post;
  });
}

/* 0. design tokens: tokens.css is the one source; its block is copied
   between the @tokens markers at the top of landing.css and style.css,
   so every page gets the tokens without an extra CSS request. */
const TOKEN_TARGETS = ["assets/css/landing.css", "assets/css/style.css"];
const TOKEN_RE = /\/\* @tokens:start[^*]*\*\/[\s\S]*?\/\* @tokens:end \*\//;
function tokenBlock() {
  return "/* @tokens:start (copied from tokens.css by tools/version-assets.js - edit tokens.css, not here) */\n" + read("assets/css/tokens.css").trim() + "\n/* @tokens:end */";
}
function syncTokens(changed) {
  if (!fs.existsSync(path.join(ROOT, "assets/css/tokens.css"))) return;
  TOKEN_TARGETS.forEach((f) => {
    const s = read(f);
    if (!TOKEN_RE.test(s)) return;
    if (write(f, s.replace(TOKEN_RE, () => tokenBlock()))) changed.push(f);
  });
}

function main() {
  const changed = [];
  syncTokens(changed);
  /* 1. fonts inside CSS */
  const css = walk("assets/css", []).filter((f) => f.endsWith(".css"));
  css.forEach((f) => {
    const s = versionRefs(f, read(f), /(url\(["']?)([^"')]+\.woff2(?:\?[^"')]*)?)(["']?\))/g);
    if (write(f, s)) changed.push(f);
  });
  /* 2. Hindi strings file version inside site-i18n.js */
  if (fs.existsSync(path.join(ROOT, "assets/js/site-i18n-hi.js"))) {
    const s = read("assets/js/site-i18n.js").replace(/window\.KS_SITE_I18N_HI_V = "[^"]*";/, 'window.KS_SITE_I18N_HI_V = "' + hashOf("assets/js/site-i18n-hi.js") + '";');
    if (write("assets/js/site-i18n.js", s)) changed.push("assets/js/site-i18n.js");
  }
  /* 3. HTML pages: <link href>, <script src> (store/index.html first, then the generated shop pages copy it) */
  const pages = publicHtml();
  pages.forEach((f) => {
    const s = versionRefs(f, read(f), /(<(?:link|script)\b[^>]*?\s(?:href|src)=")([^"]+)(")/g);
    if (write(f, s)) changed.push(f);
  });
  /* 4. service worker pre-cache list + cache name */
  let sw = read("sw.js");
  sw = sw.replace(/"(\.\/assets\/(?:css|js|fonts|vendor)\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g, (all, p) => {
    const target = p.slice(2);
    return fs.existsSync(path.join(ROOT, target)) ? '"' + p + "?v=" + hashOf(target) + '"' : all;
  });
  const listHash = crypto.createHash("sha256").update((sw.match(/var SHELL = \[[\s\S]*?\];/) || [""])[0]).digest("hex").slice(0, 8);
  sw = sw.replace(/var CACHE = "ks-shell-v(\d+)(?:-[0-9a-f]+)?";/, (m, n) => 'var CACHE = "ks-shell-v' + n + "-" + listHash + '";');
  if (write("sw.js", sw)) changed.push("sw.js");
  return changed;
}

/* for tests: list every reference to a versioned folder that is missing or has a stale ?v= */
function check() {
  const bad = [];
  const look = (file, text, re) => text.replace(re, (all, pre, ref) => {
    const target = resolveRef(file, ref);
    if (!target || !VERSIONED.test(target)) return all;
    const m = /\?v=([0-9a-f]{8})$/.exec(ref.split("#")[0]);
    if (!fs.existsSync(path.join(ROOT, target))) bad.push(file + ": missing file " + ref);
    else if (!m || m[1] !== hashOf(target)) bad.push(file + ": " + ref + " (want ?v=" + hashOf(target) + ")");
    return all;
  });
  walk("assets/css", []).filter((f) => f.endsWith(".css")).forEach((f) => look(f, read(f), /(url\(["']?)([^"')]+\.woff2(?:\?[^"')]*)?)(["']?\))/g));
  publicHtml().forEach((f) => look(f, read(f), /(<(?:link|script)\b[^>]*?\s(?:href|src)=")([^"]+)(")/g));
  const v = /window\.KS_SITE_I18N_HI_V = "([^"]*)";/.exec(read("assets/js/site-i18n.js"));
  if (!v || v[1] !== hashOf("assets/js/site-i18n-hi.js")) bad.push("assets/js/site-i18n.js: KS_SITE_I18N_HI_V out of date");
  TOKEN_TARGETS.forEach((f) => {
    const m = TOKEN_RE.exec(read(f));
    const want = TOKEN_RE.exec(versionRefs("assets/css/tokens.css", tokenBlock(), /(url\(["']?)([^"')]+\.woff2(?:\?[^"')]*)?)(["']?\))/g));
    if (!m || !want || m[0] !== want[0]) bad.push(f + ": design tokens out of sync with tokens.css");
  });
  const sw = read("sw.js");
  (sw.match(/"\.\/assets\/(?:css|js|fonts|vendor)\/[^"]+"/g) || []).forEach((q) => {
    const ref = q.slice(3, -1); const target = ref.split("?")[0]; const m = /\?v=([0-9a-f]{8})$/.exec(ref);
    if (!m || m[1] !== hashOf(target)) bad.push("sw.js: " + ref);
  });
  return bad;
}

module.exports = { main, check, hashOf };
if (require.main === module) {
  const c = main();
  console.log(c.length ? "versioned: " + c.join(", ") : "all references already up to date");
}
