#!/usr/bin/env bash
# Makes the WhatsApp/Facebook link-preview image for each shop:
# assets/images/og/<id>.jpg (1200x630, shop colour, shop photo, shop name).
# Needs ImageMagick 7 (`magick`) and python3. Run from the repo root:
#   bash tools/make-shop-og.sh            # every shop in store/shops/shops.json
#   bash tools/make-shop-og.sh mithai     # one shop
# Then run: node tools/build-shop-pages.js
set -euo pipefail
cd "$(dirname "$0")/.."
FONT_B=${FONT_B:-DejaVu-Sans-Bold}
FONT=${FONT:-DejaVu-Sans}
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then
  mapfile -t ids < <(python3 -c 'import json;[print(s["id"]) for s in json.load(open("store/shops/shops.json"))["shops"]]')
fi
mkdir -p assets/images/og
for id in "${ids[@]}"; do
  eval "$(python3 - "$id" <<'PY'
import json,sys,shlex
d=json.load(open("store/shops/%s.json"%sys.argv[1]))
c=d.get("colors",{})
print("NAME=%s"%shlex.quote(d["storeName"].replace(" (Demo)","")))
print("BRAND=%s"%shlex.quote(c.get("brand","#14532d")))
print("ACCENT=%s"%shlex.quote(c.get("accent","#f59e0b") or "#f59e0b"))
print("HERO=%s"%shlex.quote(d.get("heroImage","")))
print("DEMO=%s"%("1" if d.get("demo",True) is not False else "0"))
PY
)"
  label="Order on WhatsApp"
  [ "$DEMO" = "1" ] && sub="Demo shop · sample products and prices" || sub="Pay the shop directly"
  magick -size 1200x630 "xc:$BRAND" \
    \( "$HERO" -resize 520x520^ -gravity center -extent 520x520 \) -gravity east -geometry +55+0 -composite \
    \( -size 500x260 -background none -fill white -font "$FONT_B" -pointsize 64 -gravity southwest caption:"$NAME" \) -gravity northwest -geometry +60+70 -composite \
    \( -size 560x60 -background none -fill "$ACCENT" -font "$FONT_B" -pointsize 40 -gravity west label:"$label" \) -gravity northwest -geometry +60+370 -composite \
    \( -size 560x40 -background none -fill "#ffffffcc" -font "$FONT" -pointsize 26 -gravity west label:"$sub" \) -gravity northwest -geometry +60+445 -composite \
    \( -size 560x40 -background none -fill "#ffffff99" -font "$FONT" -pointsize 22 -gravity west label:"kiranayap.pages.dev" \) -gravity northwest -geometry +60+540 -composite \
    -strip -quality 82 "assets/images/og/$id.jpg"
  echo "wrote assets/images/og/$id.jpg ($(stat -c %s "assets/images/og/$id.jpg") bytes)"
done
