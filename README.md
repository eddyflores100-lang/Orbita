# ÓRBITA — Property Content Engine

Convierte fotos reales de una propiedad en **video 3D real** (la cámara se sumerge y orbita en la escena, con oclusión verdadera), música original multi-estilo, micrositio publicable con QR y analítica.

> Demo incluida: *Departamento 199 m² con Terraza · La Floresta, Quito* — 9 fotos generadas por IA, **100% limpias: sin marcas de agua ni marcas de terceros**.

## Cómo funciona el motor 3D

ÓRBITA convierte cada foto en una **escena 3D navegable con paralaje denso por profundidad** (warp inverso pixel-a-píxel, v4). Filosofía: **cero contenido inventado** — cada píxel del video sale de la foto original; el motor no rellena, no inpinta y no hallucina:

1. **Profundidad** — Depth Anything V2 Small (ONNX, CPU) estima el mapa de profundidad; mediana + gaussiana eliminan el "rayado" en franjas que se vería como líneas falsas.
2. **Warp inverso denso** — cada píxel de SALIDA se muestrea (bilineal) de la foto original según su profundidad real: sin nubes de puntos, sin splats, sin huecos de oclusión que rellenar.
3. **Cámara libre** — la cámara se sumerge, orbita, barre y asciende con trayectorias de amplitud contenida: la profundidad se siente, las líneas rectas permanecen rectas.
4. **Padding espejado** — la foto se extiende un 12% por lado con contenido espejado; el fov "cover" garantiza que nunca aparezcan bandas vacías.
5. **Render** — ffmpeg (h264, sin unsharp para evitar halos) + música procedural → MP4 16:9 / 9:16 / 1:1.

```
fotos → profundidad (limpia) → warp inverso denso → trayectorias de cámara → MP4 + música
```

## Stack

- **Next.js 16 + TypeScript + Tailwind + shadcn/ui** (app + micrositios + API)
- **Prisma + SQLite** (propiedades, planes de shots, jobs de render, analítica)
- **Python (numpy/scipy/Pillow/onnxruntime)** — motor 3D de paralaje denso (`scripts/orbita3d/`)
- **ffmpeg** — render y composición
- Música procedural multi-estilo (cinematic / elegante / lofi / épico) sintetizada con numpy

## Estructura

```
src/app/                 — app web (dashboard ÓRBITA, micrositios /p/[slug], APIs)
src/lib/orbita/          — ingest, director de shots, render worker, seed demo
scripts/orbita3d/        — MOTOR 3D: depth_anything.py, ldi.py, engine3d.py,
                           music_gen.py, render_worker.py, compose*.py
public/orbita/           — fotos de la propiedad demo (generadas por IA) + video demo
public/models3d/         — modelo ONNX (se auto-descarga, ver abajo)
```

## Arranque rápido

```bash
bun install            # o npm install
cp .env.example .env   # DATABASE_URL=file:./db/custom.db
bun run db:push
bun run dev            # http://localhost:3000
```

La propiedad demo (*La Floresta 199*) y su job de render completo se siembran
solas al abrir la app (lazy-seed idempotente).

### Modelo de profundidad (94 MB)

El binario ONNX **no vive en el repo**. Se descarga automáticamente la primera
vez que se renderiza (a `data/models/`), o manualmente:

```bash
bash scripts/fetch-model.sh
```

## Render en vivo

`POST /api/orbita/properties/:id/render` con un plan de shots → el backend
ejecuta `engine3d.py` (una corrida por job) y reporta progreso en
`GET /api/orbita/jobs/:id`. Requiere `ffmpeg` en el PATH.

## Deploy

Ver **[DEPLOY.md](./DEPLOY.md)** — Docker/Railway/Render/VPS. El demo público
corre en GitHub Pages: <https://eddyflores100-lang.github.io/orbita/>

## BÓVEDA (producto hermano)

BÓVEDA — memoria de IA cifrada en el navegador (PBKDF2 + AES-GCM, cero
conocimiento del servidor) — se desarrolla en este mismo monorepo en fases
posteriores.
