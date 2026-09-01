#!/bin/bash
# ÓRBITA · publica el video 3D completo (1080p) como asset de un GitHub Release
# Uso: GITHUB_TOKEN=ghp_xxx bash release-video.sh /ruta/ORBITA_3D_LaFloresta.mp4 [tag]
set -e
TOKEN="${GITHUB_TOKEN:?Falta GITHUB_TOKEN}"
FILE="${1:?Uso: release-video.sh /ruta/video.mp4 [tag]}"
TAG="${2:-demo-3d-real}"
API="https://api.github.com/repos/eddyflores100-lang/orbita"
AUTH="Authorization: token $TOKEN"
# crea el release si no existe
code=$(curl -s -o /tmp/rel.json -w "%{http_code}" -H "$AUTH" "$API/releases/tags/$TAG")
if [ "$code" != "200" ]; then
  curl -s -X POST -H "$AUTH" "$API/releases" \
    -d "{\"tag_name\":\"$TAG\",\"name\":\"Video 3D real — La Floresta 199\",\"body\":\"Render 41s 1080p del motor LDI (9 fotos reales, cámara que se sumerge y orbita con oclusión verdadera).\"}" > /tmp/rel.json
fi
ID=$(python3 -c "import json;print(json.load(open('/tmp/rel.json'))['id'])")
UP=$(python3 -c "import json;print(json.load(open('/tmp/rel.json'))['upload_url'].split('{')[0])")
NAME="ORBITA_3D_LaFloresta_1080p.mp4"
echo "→ subiendo $NAME ($(du -h "$FILE" | cut -f1))..."
curl -s -X POST -H "$AUTH" -H "Content-Type: application/octet-stream" \
  --data-binary @"$FILE" "$UP?name=$NAME" > /tmp/asset.json
URL=$(python3 -c "import json;print(json.load(open('/tmp/asset.json')).get('browser_download_url',''))")
echo "✅ $URL"
