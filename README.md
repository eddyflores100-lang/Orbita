# ÓRBITA — Property Content Engine

Convierte fotos reales de una propiedad en **video cinematográfico generado por IA** (movimiento de cámara fotorrealista por difusión, image-to-video), música original multi-estilo, locución IA con ducking, tour 3D interactivo, micrositio publicable con QR y analítica.

> Demo incluida: *Departamento 199 m² con Terraza · La Floresta, Quito* — 9 fotos generadas por IA, **100% limpias: sin marcas de agua ni marcas de terceros**.

## Cómo funciona el motor (v5 — AI Director)

ÓRBITA usa **generación de video por IA (cogvideox-3)** con tu foto real como primer frame. El movimiento de cámara no se simula con warping geométrico: lo genera un modelo de difusión entrenado a escala, por eso no hay líneas fantasma, ni sombras inventadas, ni deformación — las líneas rectas permanecen rectas.

1. **Ingesta** — normalización EXIF, dedupe por contenido, miniaturas; por URL extrae solo fotos reales (descarta logos/iconos/banners por nombre y dimensiones).
2. **AI Property Understanding** — visión IA clasifica la habitación y describe la escena.
3. **AI Director** — plan de shots (foto + movimiento de cámara + duración) según el tono de la propiedad.
4. **Video IA por shot** — la foto + un prompt cinematográfico (movimiento sutil, estable, fotorrealista — regla de oro CogVideoX) se envían al generador; `watermark_enabled=false` siempre. Cache de clips: re-renderizar es instantáneo. Fallback local por shot (motor geométrico contenido) si el servicio falla.
5. **Montaje** — normalización (resolución/fps/duración exactos, slow-motion cinematográfico si el shot pide más de 5s), transiciones xfade, banda sonora procedural con estilo/tempo/volumen editables y locución IA opcional con ducking.

```
fotos reales → prompt cinematográfico → video IA (difusión) → montaje xfade → música + locución → MP4
```

Formatos: **16:9 · 9:16 (Reels) · 1:1 (feed)**. Calidad: **borrador (speed)** para validar en minutos o **final (quality)** para el master.

## Stack

- **Next.js 16 + TypeScript + Tailwind + shadcn/ui** (app + micrositios + API)
- **Prisma + SQLite** (propiedades, planes de shots, jobs de render, analítica)
- **z-ai-web-dev-sdk** — generación image-to-video (cogvideox-3), visión, LLM y TTS
- **ffmpeg** — normalización, xfade y master
- **Python (numpy/scipy/Pillow/onnxruntime)** — motor geométrico local de respaldo (`scripts/orbita3d/`) y visor 3D del navegador

## Estructura

```
src/app/                 — app web (dashboard ÓRBITA, micrositios /p/[slug], APIs)
src/lib/orbita/          — ingest, ai-director, motor IA (ai-video.ts), render worker
scripts/orbita3d/        — fallback 3D: depth_anything.py, engine3d.py, render_worker.py
public/orbita/           — fotos de la propiedad demo (generadas por IA) + video demo
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
