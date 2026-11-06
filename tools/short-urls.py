#!/usr/bin/env python3
"""One-off: switch internal links, canonicals, og:url and sitemap to the short
Cloudflare Pages form (about.html -> about, index.html -> ./, store/index.html?shop=x
-> store/x/). Cloudflare Pages answers /about.html with a 308 to /about; GitHub
Pages also serves /about from about.html, so both hosts work. Safe to re-run."""
import re, pathlib, json
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = "about|contact|faq|onboarding|privacy|terms|refund|udhaar|qr-poster|resellers|shop-website-lucknow|shop-website-kanpur|shop-website-varanasi|404"
SHOPS = [s["id"] for s in json.loads((ROOT / "store/shops/shops.json").read_text())["shops"]]
files = sorted(ROOT.glob("*.html")) + [ROOT / "store/index.html", ROOT / "store/admin.html", ROOT / "demo/chai/index.html", ROOT / "sitemap.xml", ROOT / "robots.txt"]
SITE = "https://kiranayap.pages.dev/"
def fix(s):
    o = s
    # absolute site URLs
    s = re.sub(re.escape(SITE) + r"(" + PAGES + r")\.html", SITE + r"\1", s)
    s = s.replace(SITE + "index.html", SITE)
    s = re.sub(re.escape(SITE) + r"store/index\.html\?shop=([a-z0-9-]+)", lambda m: SITE + "store/" + m.group(1) + "/" if m.group(1) in SHOPS else m.group(0), s)
    s = s.replace(SITE + "demo/chai/index.html", SITE + "demo/chai/")
    # relative links in href attributes
    def rel(m):
        pre, path, rest = m.group(1), m.group(2), m.group(3) or ""
        return 'href="' + pre + path + rest + '"'
    s = re.sub(r'href="((?:\.\./)*|/)(' + PAGES + r')\.html((?:[?#][^"]*)?)"', rel, s)
    s = re.sub(r'href="((?:\.\./)*)index\.html((?:[?#][^"]*)?)"', lambda m: 'href="' + (m.group(1) or "./") + (m.group(2) or "") + '"', s)
    s = re.sub(r'href="/index\.html((?:[?#][^"]*)?)"', lambda m: 'href="/' + (m.group(1) or "") + '"', s)
    s = re.sub(r'href="((?:\.\./)*)store/index\.html\?shop=([a-z0-9-]+)((?:#[^"]*)?)"', lambda m: 'href="' + m.group(1) + "store/" + m.group(2) + "/" + (m.group(3) or "") + '"' if m.group(2) in SHOPS else m.group(0), s)
    s = re.sub(r'href="((?:\.\./)*)store/index\.html"', r'href="\1store/"', s)
    s = re.sub(r'href="((?:\.\./)*)demo/chai/index\.html"', r'href="\1demo/chai/"', s)
    return s
for f in files:
    if not f.exists(): continue
    t = f.read_text(encoding="utf-8"); n = fix(t)
    if n != t: f.write_text(n, encoding="utf-8"); print("updated", f.relative_to(ROOT))
