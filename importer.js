/* ══════ ÓRBITA · importador real de fotos de la propiedad (v4) ══════
   Pega el link del aviso → ÓRBITA lee la página a través de proxies
   CORS públicos, extrae TODAS las imágenes candidatas (img, srcset,
   data-src, og:image, JSON-LD, regex), descarta logos/iconos/UI y
   verifica cada imagen (tamaño + hash visual) antes de aceptarla.
   Solo pasan fotos reales de la propiedad. */

const PROXIES = [
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u),
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://r.jina.ai/" + u, // markdown fallback (solo URLs)
];

const IMG_RE = /\.(jpg|jpeg|png|webp)(\?|#|$)/i;
const BAD_NAME = /logo|icon|favicon|sprite|avatar|badge|banner|placeholder|pixel|analytics|loader|spinner|watermark|button|arrow|chevron|social|facebook|twitter|whatsa?p?p?|instagram|youtube|linkedin|tiktok|pay|qr[-_]?code|bandera|flag|emoji|font|css|js\b/i;

function fetchWithTimeout(url, ms = 16000) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(to));
}

async function fetchPageHtml(pageUrl) {
  for (const make of PROXIES) {
    try {
      const res = await fetchWithTimeout(make(pageUrl));
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.length > 500) return { text, jina: make === PROXIES[3] };
    } catch (e) { /* siguiente proxy */ }
  }
  throw new Error("todos los proxies fallaron");
}

function parseSrcset(ss) {
  const best = ss.split(",").map((p) => p.trim().split(/\s+/))
    .filter((p) => p[0])
    .sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0));
  return best.length ? best[0][0] : null;
}

function extractCandidates(html, pageUrl, jinaMode) {
  const found = [];
  const push = (u) => {
    if (!u) return;
    try {
      const abs = new URL(u, pageUrl).href;
      if (/^https?:/.test(abs) && !found.includes(abs)) found.push(abs);
    } catch (e) { /* url inválida */ }
  };

  if (jinaMode) {
    (html.match(/https?:\/\/[^\s"'()<>\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'()<>\\]*)?/gi) || []).forEach(push);
    // jina también referencia imágenes en markdown ![](url)
    (html.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g) || [])
      .forEach((m) => push((m.match(/\((https?:\/\/[^)\s]+)\)/) || [])[1]));
    return found;
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("img").forEach((im) => {
      push(im.getAttribute("src"));
      push(im.getAttribute("data-src"));
      push(im.getAttribute("data-original"));
      push(im.getAttribute("data-lazy-src"));
      push(im.getAttribute("data-lazy"));
      push(im.getAttribute("data-image"));
      const ss = im.getAttribute("srcset") || im.getAttribute("data-srcset");
      if (ss) push(parseSrcset(ss));
    });
    doc.querySelectorAll("source[srcset]").forEach((s) => push(parseSrcset(s.getAttribute("srcset"))));
    doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]').forEach((m) =>
      push(m.getAttribute("content") || m.getAttribute("href")));
    doc.querySelectorAll('[style*="background-image"]').forEach((el) => {
      const m = (el.getAttribute("style") || "").match(/url\((['"]?)(.*?)\1\)/);
      if (m) push(m[2]);
    });
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent);
        const walk = (o) => {
          if (!o) return;
          if (typeof o === "string" && IMG_RE.test(o)) push(o);
          else if (Array.isArray(o)) o.forEach(walk);
          else if (typeof o === "object") Object.values(o).forEach(walk);
        };
        walk(j.image || j);
      } catch (e) { /* json roto */ }
    });
  } catch (e) { /* DOMParser falla → regex */ }

  // red de seguridad: regex sobre el HTML crudo
  (html.match(/https?:\/\/[^"'\s\\<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s\\<>]*)?/gi) || []).forEach(push);
  return found;
}

/* carga una imagen a través del mirror CORS y la devuelve como
   dataURL normalizado (≤1280px) — lista para textura 3D y análisis */
export function loadPhotoViaProxy(srcUrl, maxW = 1280) {
  const enc = encodeURIComponent(srcUrl);
  const mirrors = [
    "https://wsrv.nl/?w=" + maxW + "&q=82&output=jpg&url=" + enc,
    "https://images.weserv.nl/?w=" + maxW + "&q=82&output=jpg&url=" + enc,
    srcUrl, // último recurso: directa con CORS
  ];
  return new Promise((res, rej) => {
    let i = 0;
    const tryNext = () => {
      if (i >= mirrors.length) return rej(new Error("sin acceso a la imagen"));
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => {
        if (im.naturalWidth < 360 || im.naturalHeight < 240) return rej(new Error("muy pequeña"));
        const ar = im.naturalWidth / im.naturalHeight;
        if (ar < 0.42 || ar > 3.8) return rej(new Error("proporción no fotográfica"));
        const s = Math.min(1, maxW / Math.max(im.naturalWidth, im.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * s);
        c.height = Math.round(im.naturalHeight * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        try { res(c.toDataURL("image/jpeg", 0.85)); } catch (e) { rej(e); }
      };
      im.onerror = () => { i++; tryNext(); };
      im.src = mirrors[i];
    };
    tryNext();
  });
}

/* hash visual 8×8 para descartar duplicados (thumbs de la misma foto) */
function aHash(canvas) {
  const c = document.createElement("canvas");
  c.width = 8; c.height = 8;
  const g = c.getContext("2d");
  g.drawImage(canvas, 0, 0, 8, 8);
  const d = g.getImageData(0, 0, 8, 8).data;
  const vals = [];
  for (let i = 0; i < 64; i++) vals.push(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  const mean = vals.reduce((a, b) => a + b, 0) / 64;
  return vals.map((v) => (v > mean ? 1 : 0));
}
const hamming = (a, b) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0);

/* ══════ API principal ══════
   onPhoto(dataUrl) se llama por cada foto VERIFICADA de la propiedad.
   Devuelve { encontradas, aceptadas }. */
export async function importFromUrl(pageUrl, { onStatus = () => {}, onProgress = () => {}, onPhoto = () => {}, maxPhotos = 24 } = {}) {
  onStatus("Leyendo el aviso a través del proxy…");
  const { text, jina } = await fetchPageHtml(pageUrl);
  onStatus("Página descargada — extrayendo todas las fotos…");

  let candidates = extractCandidates(text, pageUrl, jina);
  // filtro por nombre de archivo
  candidates = candidates.filter((u) => {
    const path = u.split("?")[0];
    if (/\.(svg|gif)(\?|#|$)/i.test(path)) return false;
    return !BAD_NAME.test(path);
  });
  // dedupe por ruta sin query (portales repiten la misma foto en tamaños)
  const seen = new Set();
  candidates = candidates.filter((u) => {
    const key = u.split("?")[0].replace(/\/(?:\d+x\d+|small|medium|large|thumb[a-z]*|w\d+|[\d{2}]+)\/(?=[^/]*$)/, "/");
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  // las más "grandes" primero (heuristic: URLs que lucen a origen completo)
  candidates.sort((a, b) => (IMG_RE.test(a.split("?")[0]) ? -1 : 1));

  if (!candidates.length) throw new Error("no se encontraron fotos en la página");

  const hashes = [];
  let aceptadas = 0, revisadas = 0;
  const toReview = candidates.slice(0, maxPhotos * 3);

  for (const u of toReview) {
    if (aceptadas >= maxPhotos) break;
    revisadas++;
    onProgress(revisadas / toReview.length);
    onStatus(`Verificando fotos de la propiedad… ${revisadas}/${toReview.length} (aceptadas ${aceptadas})`);
    try {
      const dataUrl = await loadPhotoViaProxy(u);
      // dedupe visual: canvas temporal para hash
      const im = await loadImageTmp(dataUrl);
      const h = aHash(im);
      if (hashes.some((prev) => hamming(prev, h) <= 4)) continue;
      hashes.push(h);
      aceptadas++;
      onPhoto(dataUrl, u);
    } catch (e) { /* candidato inválido → siguiente */ }
  }

  if (!aceptadas) throw new Error("las fotos encontradas no pudieron descargarse (protegidas por el portal)");
  return { encontradas: candidates.length, aceptadas };
}

function loadImageTmp(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}
