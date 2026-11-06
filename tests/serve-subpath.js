/* Static server that mimics the static host for this site.
   Default: everything is served from the domain ROOT "/", exactly like
   https://kiranayap.pages.dev/ (Cloudflare Pages).
   Set SERVE_BASE=/kirana-smart (or any sub-path) to serve the site under a
   project sub-path instead, which proves every link is relative and the
   site still works anywhere.
   "/" -> index.html, directories -> index.html, unknown paths -> 404
   (with 404.html as the body when it exists, like Cloudflare Pages).
   Used by tests/pro.e2e.js and tools/screens.js.
   Run on its own:  node tests/serve-subpath.js [port] */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
/* "" = domain root; otherwise "/something" without a trailing slash */
const BASE = String(process.env.SERVE_BASE || "").replace(/\/+$/, "");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8" };

function notFound(res) {
  const page = path.join(ROOT, "404.html");
  if (fs.existsSync(page)) { res.writeHead(404, { "Content-Type": MIME[".html"] }); fs.createReadStream(page).pipe(res); return; }
  res.writeHead(404); res.end("not found");
}

function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p;
      try { p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); } catch (e) { res.writeHead(400); res.end(); return; }
      if (BASE && p === BASE) { res.writeHead(301, { Location: BASE + "/" }); res.end(); return; }
      if (p.indexOf(BASE + "/") !== 0) { res.writeHead(404); res.end("not found (outside " + BASE + "/)"); return; }
      p = p.slice(BASE.length);
      let file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || /[\\/]\.(git|hark)/.test(file) || /[\\/]node_modules[\\/]/.test(file)) { notFound(res); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (!p.endsWith("/")) { res.writeHead(301, { Location: BASE + p + "/" }); res.end(); return; }
        file = path.join(file, "index.html");
      }
      if (!fs.existsSync(file)) { notFound(res); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(port || 0, "127.0.0.1", () => resolve(srv));
  });
}
module.exports = { serve, BASE, ROOT };
if (require.main === module) serve(Number(process.argv[2]) || 8080).then((s) => console.log("http://127.0.0.1:" + s.address().port + BASE + "/"));
