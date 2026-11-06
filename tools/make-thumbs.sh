#!/usr/bin/env bash
# Small copies of images for places that show them small (Lighthouse:
# "properly size images"). Needs ImageMagick 7 (`magick`). Run from the
# repo root after adding or changing product photos:
#   bash tools/make-thumbs.sh
# - assets/images/thumbs/<name>.webp      320 px  (landing product grid, hero phone, feature tiles)
# - assets/images/thumbs/<hero>-64.webp    64 px  (landing shop tabs, drawn at 32 px)
# - assets/images/thumbs/hero-burst-card.webp 480 px wide (premium demo card in the carousel)
# - assets/images/landing/shop-*.webp are kept at 480 px wide (carousel cards, ~250 px on screen)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/images/thumbs
for f in assets/images/products/*.webp; do
  n=$(basename "$f" .webp)
  magick "$f" -resize '320x320>' -strip -quality 78 -define webp:method=6 "assets/images/thumbs/$n.webp"
  case "$n" in hero-*) magick "$f" -resize 64x64 -strip -quality 80 "assets/images/thumbs/$n-64.webp" ;; esac
done
magick assets/images/chai/hero-burst.webp -resize '480x>' -strip -quality 76 -define webp:method=6 assets/images/thumbs/hero-burst-card.webp
for f in assets/images/landing/shop-*.webp; do
  w=$(magick identify -format %w "$f")
  if [ "$w" -gt 480 ]; then magick "$f" -resize 480x -strip -quality 78 -define webp:method=6 "$f"; fi
done
du -sh assets/images/thumbs
