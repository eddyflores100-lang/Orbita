#!/usr/bin/env bash
# Production startup: do not serve against a schema that failed to synchronize.
set -euo pipefail

if [ -n "${DATABASE_URL:-}" ]; then
  ./node_modules/prisma/build/index.js db push --skip-generate
fi

exec node server.js
