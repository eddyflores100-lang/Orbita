#!/bin/bash
# ÓRBITA — descarga el modelo Depth Anything V2 Small (ONNX, 94MB) si no existe.
# El binario no vive en el repo (GitHub no debe cargar blobs de 94MB):
# se descarga a data/models/ (persistente) la primera vez que se necesita.
set -e
DEST="${ORBITA_MODELS_DIR:-$(pwd)/data/models}"
OUT="$DEST/depth-anything-v2-small.onnx"
URL="https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx"
if [ -s "$OUT" ]; then echo "✓ modelo ya presente: $OUT"; exit 0; fi
mkdir -p "$DEST"
echo "→ descargando Depth Anything V2 Small (94MB)..."
curl -L --fail --progress-bar -o "$OUT.part" "$URL"
mv "$OUT.part" "$OUT"
echo "✓ modelo listo: $OUT"
