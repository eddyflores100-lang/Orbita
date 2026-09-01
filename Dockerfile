# ÓRBITA — imagen de producción
# Incluye FFmpeg + Python (motor 3D LDI) para el render worker, y Prisma para SQLite.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate && bun run build

FROM debian:bookworm-slim AS runner
WORKDIR /app
# FFmpeg + certificados + node + python3 (motor 3D LDI: engine3d.py)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates nodejs python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/custom.db"
ENV ORBITA_MODELS_DIR="/app/models3d"
RUN mkdir -p /app/data /app/storage /app/renders
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
# Motor 3D (scripts/orbita3d) + dependencias python + herramienta de modelo
COPY --from=builder /app/requirements.txt ./requirements.txt
COPY --from=builder /app/scripts/orbita3d/*.py ./scripts/orbita3d/
COPY --from=builder /app/scripts/fetch-model.sh ./scripts/fetch-model.sh
RUN chmod +x scripts/fetch-model.sh \
  && pip3 install --no-cache-dir --break-system-packages -r requirements.txt || true
# Descarga el modelo de profundidad (94MB) en build → /app/models3d (fuera del
# volumen /app/data para que el volumen montado no lo tape)
RUN ORBITA_MODELS_DIR=/app/models3d bash scripts/fetch-model.sh
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY scripts/start-prod.sh ./start-prod.sh
RUN chmod +x start-prod.sh
EXPOSE 3000
VOLUME ["/app/data", "/app/storage", "/app/renders"]
CMD ["./start-prod.sh"]
