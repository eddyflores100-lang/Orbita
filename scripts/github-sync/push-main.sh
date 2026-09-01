#!/bin/bash
# ÓRBITA · push de la rama main al repo de GitHub
# Uso: GITHUB_TOKEN=ghp_xxx bash push-main.sh [directorio_repo]
set -e
TOKEN="${GITHUB_TOKEN:?Falta GITHUB_TOKEN (PAT con scope repo)}"
REPO_DIR="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
REMOTE="https://x-access-token:$TOKEN@github.com/eddyflores100-lang/orbita.git"
cd "$REPO_DIR"
BRANCH="$(git branch --show-current)"
echo "→ push $BRANCH → eddyflores100-lang/orbita:main"
if [ "$BRANCH" = "main" ]; then
  git push origin HEAD:main
else
  git push "$REMOTE" "$BRANCH:main"
fi
echo "✅ https://github.com/eddyflores100-lang/orbita"
