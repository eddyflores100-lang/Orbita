"use client";

import { useMemo } from "react";
import { ROOM_LABEL, ROOM_NARRATIVE, roomNarrativeLabel } from "@/lib/orbita/types";
import type { OrbitPhotoDTO } from "@/lib/orbita/api";

/**
 * Property Graph — mapa lógico aproximado derivado de la secuencia de fotos.
 * No requiere planos: es un grafo semántico de navegación (entrada → estancias).
 */
export default function PropertyGraph({ photos }: { photos: OrbitPhotoDTO[] }) {
  const { nodes, edges, counts } = useMemo(() => {
    const classified = photos.filter((p) => p.room);
    const seq = [...classified].sort((a, b) => {
      const na = ROOM_NARRATIVE[a.room ?? ""] ?? 5;
      const nb = ROOM_NARRATIVE[b.room ?? ""] ?? 5;
      return na - nb;
    });
    const uniq: string[] = [];
    for (const p of seq) {
      if (!uniq.includes(p.room as string)) uniq.push(p.room as string);
    }
    const cnt: Record<string, number> = {};
    for (const p of classified) {
      const r = p.room as string;
      cnt[r] = (cnt[r] ?? 0) + 1;
    }
    const nodeObjs = uniq.map((r) => ({ room: r, count: cnt[r] ?? 0 }));
    const edgeObjs: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < uniq.length - 1; i++) {
      edgeObjs.push({ from: uniq[i], to: uniq[i + 1] });
    }
    return { nodes: nodeObjs, edges: edgeObjs, counts: cnt };
  }, [photos]);

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-[#8f8b9f] py-4">
        Analiza las fotos para que ÓRBITA construya el mapa lógico de la propiedad.
      </p>
    );
  }

  // Layout: columna central en serpentina, 2 por fila
  const perRow = 2;
  const rows = Math.ceil(nodes.length / perRow);
  const colW = 190;
  const rowH = 64;
  const width = perRow * colW + 40;
  const height = rows * rowH + 30;

  const pos = nodes.map((n, i) => {
    const row = Math.floor(i / perRow);
    const idxInRow = i % perRow;
    const flip = row % 2 === 1;
    const col = flip ? perRow - 1 - idxInRow : idxInRow;
    return { ...n, x: 30 + col * colW + colW / 2, y: 26 + row * rowH, row, idx: i };
  });

  const posByRoom = new Map(pos.map((p) => [p.room, p]));

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Property Graph de la propiedad" className="min-w-full">
        <defs>
          <marker id="og-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="rgba(167,139,250,0.6)" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = posByRoom.get(e.from);
          const b = posByRoom.get(e.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const sameRow = a.row === b.row;
          const d = sameRow
            ? `M ${a.x + 62} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 62} ${b.y}`
            : `M ${a.x} ${a.y + 14} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y - 14}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(167,139,250,0.4)"
              strokeWidth="1.4"
              markerEnd="url(#og-arrow)"
              strokeDasharray="3 3"
            />
          );
        })}
        {pos.map((n) => (
          <g key={n.room}>
            <rect
              x={n.x - 62}
              y={n.y - 14}
              width={124}
              height={28}
              rx={14}
              fill="rgba(167,139,250,0.08)"
              stroke="rgba(167,139,250,0.35)"
              strokeWidth="1"
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="10.5" fill="#d8d4e8" fontWeight="600">
              {shortLabel(n.room)}
            </text>
            {n.count > 1 && (
              <text x={n.x + 50} y={n.y - 18} textAnchor="middle" fontSize="9" fill="#8f8b9f">
                ×{n.count}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-[#8f8b9f] mt-2">
        {nodes.length} estancias conectadas · {Object.values(counts).reduce((a, b) => a + b, 0)} fotos clasificadas ·
        recorrido: {pos.map((p) => roomNarrativeLabel(p.room).split(" /")[0]).join(" → ")}
      </p>
    </div>
  );
}

function shortLabel(room: string): string {
  const l = ROOM_LABEL[room] ?? room;
  return l.length > 16 ? l.slice(0, 15) + "…" : l;
}
