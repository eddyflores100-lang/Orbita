#!/bin/bash
# ÓRBITA · deploy completo a GitHub en un paso (tras dar el token)
# Uso: GITHUB_TOKEN=ghp_xxx bash deploy-all.sh
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN="${GITHUB_TOKEN:?Falta GITHUB_TOKEN (PAT con scope repo)}"

echo "══ 1/3 · push de la app (rama main) ══"
bash "$DIR/push-main.sh" /tmp/orbita-repo

echo "══ 2/3 · publicar demo (gh-pages) ══"
bash "$DIR/push-ghpages.sh" /home/z/ghpages-work

echo "══ 3/3 · video completo 1080p como Release ══"
bash "$DIR/release-video.sh" /home/z/my-project/download/ORBITA_3D_LaFloresta.mp4 demo-3d-real || echo "(release falló — no bloquea)"

echo ""
echo "✅ Deploy completo:"
echo "   Repo:  https://github.com/eddyflores100-lang/orbita"
echo "   Demo:  https://eddyflores100-lang.github.io/orbita/"
