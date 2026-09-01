# GitHub — ÓRBITA + BÓVEDA (memoria de trabajo)

## 🔗 Links (memorizados — trabajar DIRECTAMENTE aquí)

| Qué | URL |
|---|---|
| **Repo** | https://github.com/eddyflores100-lang/Orbita |
| **Demo (GitHub Pages)** | https://eddyflores100-lang.github.io/Orbita/ |
| **Video completo 1080p** | https://github.com/eddyflores100-lang/Orbita/releases (asset `ORBITA_3D_LaFloresta_1080p.mp4`) |

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
6. El video 3D completo (41s, 1080p) no vive en el repo (80MB): se publica como **Release asset** con `scripts/github-sync/release-video.sh`.

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
