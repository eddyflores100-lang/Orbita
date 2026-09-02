# GitHub — ÓRBITA + BÓVEDA (memoria de trabajo)

## 🔗 Links (memorizados — trabajar DIRECTAMENTE aquí)

| Qué | URL |
|---|---|
| **Repo** | https://github.com/eddyflores100-lang/Orbita |
| **Demo (GitHub Pages)** | https://eddyflores100-lang.github.io/Orbita/ |
| **Video 1080p con locución IA** | https://github.com/eddyflores100-lang/Orbita/releases/download/demo-3d-real/ORBITA_3D_LaFloresta_1080p.mp4 |
| **Video 9:16 Reels con locución** | https://github.com/eddyflores100-lang/Orbita/releases/download/demo-3d-real/ORBITA_3D_LaFloresta_916_Reels.mp4 |

- Usuario GitHub: **eddyflores100-lang**
- Repo público: `eddyflores100-lang/Orbita`
- ⚠️ **Pages distingue MAYÚSCULAS/minúsculas**: la URL correcta lleva `Orbita` con O mayúscula (la variante en minúsculas da "Site not found" — fue la causa del "no sirve el link").

## Ramas

| Rama | Contenido |
|---|---|
| `main` | Código completo: app Next.js (ÓRBITA v3 motor 3D real LDI + BÓVEDA v0.4), motor Python `scripts/orbita3d/`, Dockerfile, deploy Railway |
| `gh-pages` | Demo pública estática: landing + video 3D real + visor interactivo (nube de puntos 3D con profundidad real en el navegador) |

## Reglas de trabajo (sesiones futuras)

1. **El repo de GitHub es la fuente de verdad.** Antes de trabajar, `git fetch origin && git pull` del clon local (si el sandbox se reinició: `git clone https://github.com/eddyflores100-lang/Orbita.git`).
2. El sandbox local (`/home/z/my-project`) es SOLO entorno de prueba — la plataforma sobrescribe su rama `main` con autocommits; NO confiar en su historial. El historial limpio vive en GitHub.
3. Empujar con: `GITHUB_TOKEN=ghp_xxx bash scripts/github-sync/push-main.sh` (o `push-ghpages.sh`).
4. El token es un PAT clásico con scope **repo** (y **workflow** si se tocan GitHub Actions). Rotarlo si se expuso en chat.
5. El modelo ONNX de 94MB NO vive en el repo: se auto-descarga en build/runtime (ver `Dockerfile` y `scripts/fetch-model.sh`).
6. El video 3D completo (41s) no vive en el repo: se publica como **Release assets** (16:9 con locución + 9:16 vertical) con `scripts/github-sync/release-video.sh` o API directa.

## ÓRBITA v3.2 (Quick Wins, sep 2026)

- **Formatos**: `16:9` web · `9:16` Reels/TikTok · `1:1` feed — el motor renderiza NATIVO en cada formato (`render_worker.py <foto> <move> <out> WxH`; `engine3d.py` acepta cualquier width/height en el spec).
- **Tour 3D interactivo** (Three.js) en el micrositio `/p/[slug]` y tab "Tour 3D" del estudio: nube de puntos con la MISMA profundidad del motor de video (endpoint `GET /api/orbita/properties/:id/photos/:photoId/depth` → `depth_png.py`, caché compartida), arrastrar para mirar, rueda/pinza para sumergirse, giroscopio móvil (iOS pide permiso), y **hotspots** anclados al espacio 3D (JSON en `OrbitProperty.hotspots`: `[{photoId,u,v,label}]`, editor con modo colocar).
- **Locución IA**: guion por LLM calibrado a la duración (`voiceover.ts`), TTS (`zai.audio.tts`, voces tongtong/xiaochen/luodo/kazi), mezcla ffmpeg con **ducking** (sidechaincompress). Toggle + voz en el AI Director; `OrbitProperty.voiceoverOn/voiceStyle`. Se aplica al render del producto.
- ⚠️ Lecciones: el sandbox exporta `DATABASE_URL` global que PISA el `.env` (lanzar dev con `env DATABASE_URL=file:...` explícito); ffmpeg `-filter_complex` NO debe llevar etiquetas de un solo carácter entre corchetes (`[m]`) en este shell — usar `[mus]`, `[vox]`; `execFile` de `child_process` SIEMPRE con `promisify` (await sobre ChildProcess no espera).

## Deploy del demo (gh-pages)

```bash
# 1. Editar / construir el demo en una carpeta (ej. /home/z/ghpages-work)
# 2. Publicar:
GITHUB_TOKEN=ghp_xxx bash scripts/github-sync/push-ghpages.sh /home/z/ghpages-work
# Pages sirve automáticamente la rama gh-pages (deploy from branch)
```

## Deploy de producción (app completa)

- **Railway**: conectar el repo → detecta `railway.json` + `Dockerfile` → volumen en `/app/data`. Ver `DEPLOY.md`.
- Cualquier VPS: `docker build -t orbita . && docker run -p 3000:3000 -v orbita-data:/app/data orbita`
