# Despliegue de ÓRBITA en producción

## Requisitos
- Node 20+ o Bun 1.x
- FFmpeg (render de video)
- ~500MB de disco para datos (SQLite + fotos + renders)

## Opción A — Docker (cualquier VPS o Railway/Render/Fly)

```bash
docker build -t orbita .
docker run -p 3000:3000 -v orbita-data:/app/data orbita
```

La imagen arranca sola: aplica el schema de Prisma y levanta el servidor standalone.

### Railway (1-click)
1. Conecta el repo `orbita` en railway.app → New Project → Deploy from GitHub
2. Railway detecta `railway.json` y el Dockerfile automáticamente
3. Añade un volumen montado en `/app/data`
4. Lista. Custom domain en Settings → Networking

### Render
- New → Web Service → Docker → selecciona el repo
- Añade un Disk montado en `/app/data` (importante para persistir SQLite)

## Opción B — VPS directo

```bash
git clone https://github.com/eddyflores100-lang/orbita.git
cd orbita && bun install
cp .env.example .env   # ajusta DATABASE_URL y NEXT_PUBLIC_APP_URL
bun run db:push
bun run build
bun run start         # usa scripts/start-prod.sh o node .next/standalone/server.js
```

## Variables

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Ruta SQLite, ej. `file:./db/custom.db` |
| `NEXT_PUBLIC_APP_URL` | URL pública para micrositios/QR, ej. `https://orbita.tuagencia.com` |

## Persistencia (importante)

- `/app/data` — base de datos SQLite
- `/app/storage` — fotos originales y thumbnails
- `/app/renders` — videos MP4 renderizados

Monta volúmenes en esas tres rutas si quieres conservar datos entre deploys.

## Nota sobre el render de video

El Render Worker ejecuta **FFmpeg local**. En plataformas serverless (Vercel) no hay FFmpeg persistente ni filesystem duradero: para Vercel habría que migrar a render remoto (p. ej. workers en Fly.io + cola). Para agencias, la vía recomendada hoy es Railway/Render/VPS con volumen.
