# ÓRBITA — Property Content Engine

Convierte fotos reales de una propiedad en **video 3D real** (la cámara se sumerge y orbita en la escena, con oclusión verdadera), música original multi-estilo, micrositio publicable con QR y analítica.

> Demo real incluida: *Departamento 199 m² con Terraza · La Floresta, Quito* (aviso RE/MAX Ecuador, 9 fotos reales).

## Cómo funciona el motor 3D

ÓRBITA **no** aplica efectos parallax ni warps 2.5D. Cada foto se convierte en una **escena 3D real** (Layered Depth Images, técnica de [3d-photo-inpainting, CVPR 2020](https://github.com/vt-vl-lab/3d-photo-inpainting)):

1. **Profundidad métrica** — Depth Anything V2 Small (ONNX, CPU) estima el mapa de profundidad de cada foto.
2. **Segmentación por protusión** — los objetos que sobresalen de su superficie se separan en capas (los planos como techos/paredes no).
3. **Inpainting de oclusiones** — lo que queda detrás de un objeto se rellena (EDT + relajación de Laplace) en color y profundidad.
4. **Nube de puntos 3D** — cada píxel se convierte en un punto con posición métrica (Z real).
5. **Cámara libre** — la cámara viaja DENTRO de la escena (sumergirse, orbitar, barrer, grúa) con painter's algorithm: lo cercano tapa lo lejano de verdad.
6. **Render** — ffmpeg (h264 + música procedural) → MP4 1080p.

```
fotos → profundidad → capas LDI + inpainting → nube 3D → trayectorias de cámara → MP4 + música
```

## Stack

- **Next.js 16 + TypeScript + Tailwind + shadcn/ui** (app + micrositios + API)
- **Prisma + SQLite** (propiedades, planes de shots, jobs de render, analítica)
- **Python (numpy/scipy/Pillow/onnxruntime)** — motor 3D LDI (`scripts/orbita3d/`)
- **ffmpeg** — render y composición
- Música procedural multi-estilo (cinematic / elegante / lofi / épico) sintetizada con numpy

## Estructura

```
src/app/                 — app web (dashboard ÓRBITA, micrositios /p/[slug], APIs)
src/lib/orbita/          — ingest, director de shots, render worker, seed demo
scripts/orbita3d/        — MOTOR 3D: depth_anything.py, ldi.py, engine3d.py,
                           music_gen.py, render_worker.py, compose*.py
public/orbita/           — fotos reales de la propiedad demo + video demo
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
