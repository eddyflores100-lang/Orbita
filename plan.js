/* ══════ ÓRBITA · plano generado desde TUS fotos ══════
   Los ambientes del plano salen de lo que la IA detectó en cada foto
   (tipo de espacio + cantidad). Las áreas son estimadas y la
   disposición se regenera con semilla. Salida: SVG arquitectónico. */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE = { sala: 22, comedor: 14, cocina: 13, dormitorio: 14, baño: 6, hall: 8, entrada: 5, oficina: 10, vestidor: 5, lavanderia: 5, exterior: 18 };
const ORDER = ["entrada", "hall", "sala", "comedor", "cocina", "oficina", "dormitorio", "vestidor", "baño", "lavanderia"];
const SOCIAL = ["entrada", "hall", "sala", "comedor", "cocina", "oficina"];
const CAPS = { sala: 1, comedor: 1, cocina: 1, dormitorio: 3, baño: 2, hall: 1, entrada: 1, oficina: 1, vestidor: 1, lavanderia: 1, exterior: 1 };
const NAME = { sala: "Sala", comedor: "Comedor", cocina: "Cocina", dormitorio: "Dormitorio", baño: "Baño", hall: "Hall", entrada: "Entrada", oficina: "Estudio", vestidor: "Vestidor", lavanderia: "Lavandería", exterior: "Terraza" };
const SHORT = { sala: "Sala", comedor: "Comedor", cocina: "Cocina", dormitorio: "Dorm.", baño: "Baño", hall: "Hall", entrada: "Entr.", oficina: "Estudio", vestidor: "Vest.", lavanderia: "Lav.", exterior: "Terraza" };

export function buildPlan(photoRooms, seed = 1) {
  const rng = mulberry32(seed);
  const counts = {};
  photoRooms.forEach((p) => { if (p.room) counts[p.room] = (counts[p.room] || 0) + 1; });

  const spaces = [];
  ORDER.forEach((k) => {
    if (!counts[k]) return;
    const n = Math.min(counts[k], CAPS[k]);
    for (let i = 0; i < n; i++) spaces.push({ type: k, area: Math.round(BASE[k] * (0.88 + rng() * 0.28)) });
  });
  if (counts.exterior) spaces.push({ type: "exterior", area: Math.round(BASE.exterior * (0.88 + rng() * 0.3)), ext: true });
  if (!spaces.length) return null;

  const total = spaces.reduce((a, s) => a + s.area, 0);
  const social = spaces.filter((s) => !s.ext && SOCIAL.includes(s.type));
  const priv = spaces.filter((s) => !s.ext && !SOCIAL.includes(s.type));
  const ext = spaces.filter((s) => s.ext);

  const VW = 920, VH = 480, MX = 40, MY = 40;
  const usableW = 13.4;
  const extW = ext.length ? 3.4 : 0;
  const rowsW = usableW - extW;

  const norm = (arr) => {
    if (!arr.length) return { list: [], h: 0 };
    const sum = arr.reduce((a, s) => a + s.area, 0);
    const ws = arr.map((s) => Math.max(2.0, (s.area / sum) * rowsW));
    const wsSum = ws.reduce((a, b) => a + b, 0);
    const list = ws.map((w) => w / wsSum * rowsW);
    const h = Math.min(4.6, Math.max(2.5, sum / rowsW * 1.12));
    return { list, h };
  };
  const R1 = norm(social), R2 = norm(priv);

  let S = (VW - MX * 2 - 6) / usableW;
  const rowsPxH = (R1.h + R2.h) * S;
  if (rowsPxH > VH - MY * 2 - 30) S = (VH - MY * 2 - 30) / (R1.h + R2.h);

  const W = usableW * S;
  const top = MY + 16;
  let x = MX;
  let svg = `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plano estimado de la propiedad">
  <defs>
    <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#B98A67" stroke-width="1.4" opacity="0.5"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${VW}" height="${VH}" fill="#F6F3EC"/>`;

  const drawRow = (arr, ws, y, h, offsetIdx) => {
    let xx = MX;
    ws.forEach((w, i) => {
      const s = arr[i];
      const px = w * S, py = h * S;
      const lab = w < 2.9 ? SHORT[s.type] : NAME[s.type];
      const lab2 = (arr.length > 1 && s.type === "dormitorio") ? lab.replace(/Dorm\.?/, "Dorm. " + (i + 1)) : lab;
      svg += `<rect x="${xx.toFixed(1)}" y="${y.toFixed(1)}" width="${px.toFixed(1)}" height="${py.toFixed(1)}" fill="#FBF9F2" stroke="#232019" stroke-width="2"/>
      <text x="${(xx + px / 2).toFixed(1)}" y="${(y + py / 2 - 2).toFixed(1)}" text-anchor="middle" font-family="Fraunces,serif" font-size="${w < 2.9 ? 12 : 14.5}" fill="#232019">${lab2}</text>
      <text x="${(xx + px / 2).toFixed(1)}" y="${(y + py / 2 + 15).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#7C7668">${s.area} m²</text>`;
      xx += px;
    });
  };

  let idxCursor = 0;
  if (R1.list.length) { drawRow(social, R1.list, top, R1.h, 0); idxCursor += social.length; }
  if (R2.list.length) {
    const dormOffset = social.filter(s => s.type === "dormitorio").length;
    drawRow(priv, R2.list, top + R1.h * S, R2.h, 0);
    idxCursor += priv.length;
  }
  if (ext.length) {
    const ex = MX + rowsW * S + 6, ey = top, ew = extW * S - 6, eh = (R1.h + R2.h) * S;
    svg += `<rect x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" width="${ew.toFixed(1)}" height="${eh.toFixed(1)}" fill="url(#hatch)" stroke="#232019" stroke-width="2" stroke-dasharray="6 4"/>
    <text x="${(ex + ew / 2).toFixed(1)}" y="${(ey + eh / 2).toFixed(1)}" text-anchor="middle" font-family="Fraunces,serif" font-size="14" fill="#7E4527">Terraza</text>
    <text x="${(ex + ew / 2).toFixed(1)}" y="${(ey + eh / 2 + 16).toFixed(1)}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#7C7668">${ext[0].area} m²</text>`;
  }

  // envolvente
  const allH = (R1.h + R2.h) * S;
  svg += `<rect x="${MX - 5}" y="${top - 5}" width="${(rowsW * S + 10 + (ext.length ? extW * S + 6 : 0)).toFixed(1)}" height="${allH + 10}" fill="none" stroke="#232019" stroke-width="4"/>`;

  // norte
  svg += `<g transform="translate(${VW - 64},${MY + 4})">
    <circle r="14" fill="none" stroke="#232019" stroke-width="1.4"/>
    <path d="M0,-9 L4,6 L0,3 L-4,6 Z" fill="#A05C3B"/>
    <text y="27" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#232019">N</text>
  </g>`;

  // título
  const dorms = counts.dormitorio || 0;
  const amb = 1 + dorms + (counts.cocina ? 0 : 0);
  svg += `<text x="${MX}" y="${VH - 14}" font-family="Inter,sans-serif" font-size="11.5" fill="#7C7668">ÓRBITA · plano estimado por IA a partir de ${photoRooms.length} foto${photoRooms.length !== 1 ? "s" : ""} · ≈ ${total} m² · ${dorms ? dorms + " dormitorio" + (dorms > 1 ? "s" : "") + " · " : ""}${spaces.length} espacios</text>`;

  svg += `</svg>`;
  return { svg, spaces, total, roomsUsed: photoRooms.length };
}
