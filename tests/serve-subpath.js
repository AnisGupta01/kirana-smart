/* Static server that mimics GitHub Pages for this project site:
   everything is served under /kirana-smart/ (like
   https://anisgupta01.github.io/kirana-smart/), "/" -> index.html,
   unknown paths -> 404. Used by tests/pro.e2e.js and tools/screens.js.
   Run on its own:  node tests/serve-subpath.js [port] */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = "/kirana-smart";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".webp": "image/webp", ".woff2": "font/woff2", ".md": "text/plain; charset=utf-8" };

function serve(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p;
      try { p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); } catch (e) { res.writeHead(400); res.end(); return; }
      if (p === BASE) { res.writeHead(301, { Location: BASE + "/" }); res.end(); return; }
      if (p.indexOf(BASE + "/") !== 0) { res.writeHead(404); res.end("not found (outside " + BASE + "/)"); return; }
      p = p.slice(BASE.length);
      let file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || /[\\/]\.(git|hark)/.test(file) || /[\\/]node_modules[\\/]/.test(file)) { res.writeHead(404); res.end("not found"); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (!p.endsWith("/")) { res.writeHead(301, { Location: BASE + p + "/" }); res.end(); return; }
        file = path.join(file, "index.html");
      }
      if (!fs.existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(port || 0, "127.0.0.1", () => resolve(srv));
  });
}
module.exports = { serve, BASE, ROOT };
if (require.main === module) serve(Number(process.argv[2]) || 8080).then((s) => console.log("http://127.0.0.1:" + s.address().port + BASE + "/"));
