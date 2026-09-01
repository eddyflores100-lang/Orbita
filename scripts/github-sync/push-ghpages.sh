#!/bin/bash
# ÓRBITA · publica la demo estática en la rama gh-pages (GitHub Pages)
# Uso: GITHUB_TOKEN=ghp_xxx bash push-ghpages.sh /ruta/carpeta-demo
# La carpeta debe contener index.html (todo lo que haya ahí se publica).
set -e
TOKEN="${GITHUB_TOKEN:?Falta GITHUB_TOKEN (PAT con scope repo)}"
SRC="${1:?Uso: push-ghpages.sh /ruta/carpeta-demo}"
[ -f "$SRC/index.html" ] || { echo "✗ $SRC/index.html no existe"; exit 1; }
WORK="$(mktemp -d)"
git clone --depth 1 --branch gh-pages \
  "https://x-access-token:$TOKEN@github.com/eddyflores100-lang/orbita.git" "$WORK/site" 2>/dev/null \
  || git clone --depth 1 "https://x-access-token:$TOKEN@github.com/eddyflores100-lang/orbita.git" "$WORK/site"
cd "$WORK/site"
git checkout -q gh-pages 2>/dev/null || git checkout -q -b gh-pages origin/main
# reemplaza contenido
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$SRC"/. .
git add -A
if git diff --cached --quiet; then echo "sin cambios"; exit 0; fi
git -c user.name="ÓRBITA deploy" -c user.email="deploy@orbita.local" \
  commit -q -m "demo: $(date -u +'%Y-%m-%d %H:%M UTC')"
git push -q origin gh-pages
echo "✅ https://eddyflores100-lang.github.io/orbita/"
rm -rf "$WORK"
