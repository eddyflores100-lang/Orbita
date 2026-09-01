#!/bin/bash
# Arranque de producción ÓRBITA: migra el schema y arranca el servidor standalone
set -e
# Sincroniza el schema de Prisma con la base de datos (idempotente)
if [ -n "$DATABASE_URL" ]; then
  ./node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || true
fi
exec node server.js
