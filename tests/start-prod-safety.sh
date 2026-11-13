#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

APP="$TMP/app"
BIN="$TMP/bin"
mkdir -p "$APP/node_modules/prisma/build" "$BIN"
cp "$ROOT/scripts/start-prod.sh" "$APP/start-prod.sh"

cat >"$APP/node_modules/prisma/build/index.js" <<'SH'
#!/bin/sh
printf '%s\n' "$*" >"$PRISMA_ARGS_FILE"
exit 42
SH
chmod +x "$APP/node_modules/prisma/build/index.js"

cat >"$BIN/node" <<'SH'
#!/bin/sh
printf 'server started\n' >"$SERVER_MARKER"
exit 0
SH
chmod +x "$BIN/node"

set +e
(
  cd "$APP"
  PATH="$BIN:$PATH" \
    DATABASE_URL="file:$TMP/data/custom.db" \
    PRISMA_ARGS_FILE="$TMP/prisma-args" \
    SERVER_MARKER="$TMP/server-started" \
    bash ./start-prod.sh
)
status=$?
set -e

if [ "$status" -eq 0 ]; then
  echo "FAIL: startup succeeded after Prisma schema synchronization failed" >&2
  exit 1
fi

if [ -e "$TMP/server-started" ]; then
  echo "FAIL: application server started after schema synchronization failed" >&2
  exit 1
fi

if grep -q -- '--accept-data-loss' "$TMP/prisma-args"; then
  echo "FAIL: production startup allows destructive schema changes" >&2
  exit 1
fi

echo "production startup fails closed when Prisma schema synchronization fails"
