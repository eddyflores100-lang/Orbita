import { SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Minus, Plus, X, Film } from "lucide-react";
import type { MoveId, Photo, Scene } from "../lib/data";
import { MOVES, fmtTime } from "../lib/data";
import { audio } from "../lib/audio";

interface Props {
  scenes: Scene[];
  photoSrc: (id: string) => string;
  roomOf: (photoId: string) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDuration: (id: string, delta: number) => void;
  onCycleMove: (id: string) => void;
  onRemove: (id: string) => void;
  highlightDrop: boolean;
}

function SceneCard({
  scene,
  index,
  src,
  room,
  selected,
  onSelect,
  onDuration,
  onCycleMove,
  onRemove,
}: {
  scene: Scene;
  index: number;
  src: string;
  room: string;
  selected: boolean;
  onSelect: () => void;
  onDuration: (d: number) => void;
  onCycleMove: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const move = MOVES.find((m) => m.id === scene.move);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={`group relative w-44 shrink-0 cursor-pointer select-none rounded-lg border transition-all ${
        isDragging ? "z-20 opacity-40" : "opacity-100"
      } ${selected ? "border-amber shadow-[0_0_24px_rgba(242,169,59,0.22)]" : "border-line hover:border-line2 hover:-translate-y-0.5"}`}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        <img src={src} alt={room} draggable={false} className="aspect-video w-full object-cover" />
        <span className="absolute left-1.5 top-1.5 rounded bg-ink/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper backdrop-blur-sm">
          {index + 1} · {room}
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/75 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber backdrop-blur-sm">
          {scene.duration}s
        </span>
        {/* drag handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 cursor-grab rounded bg-ink/70 p-0.5 text-mut opacity-0 backdrop-blur-sm transition hover:text-paper group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Arrastrar escena"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            audio.tick();
            onDuration(-1);
          }}
          className="rounded p-1 text-dim transition hover:bg-panel2 hover:text-paper active:scale-90"
          aria-label="Menos duración"
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            audio.tick();
            onDuration(1);
          }}
          className="rounded p-1 text-dim transition hover:bg-panel2 hover:text-paper active:scale-90"
          aria-label="Más duración"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            audio.tick();
            onCycleMove();
          }}
          title={`Movimiento: ${move?.label} (clic para cambiar)`}
          className="ml-1 min-w-0 flex-1 truncate rounded border border-line px-1.5 py-1 text-left font-mono text-[9px] uppercase tracking-wider text-mut transition hover:border-amber/50 hover:text-amber active:scale-95"
        >
          {move?.label}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            audio.tick();
            onRemove();
          }}
          className="rounded p-1 text-dim transition hover:bg-coral/20 hover:text-coral active:scale-90"
          aria-label="Eliminar escena"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function Timeline({ scenes, photoSrc, roomOf, selectedId, onSelect, onDuration, onCycleMove, onRemove, highlightDrop }: Props) {
  const total = scenes.reduce((a, s) => a + s.duration, 0);

  return (
    <div className={`rounded-xl border bg-panel transition-colors ${highlightDrop ? "border-mint bg-mint/5" : "border-line"}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mut">
          <Film className="h-3.5 w-3.5 text-amber" />
          Secuencia del recorrido
          <span className="rounded bg-mint/15 px-1.5 py-0.5 text-[9px] text-mint">ordenada por ia</span>
        </p>
        <p className="font-mono text-[11px] tabular-nums text-dim">
          {scenes.length} escenas · <span className="text-paper">{fmtTime(total)}</span>
        </p>
      </div>
      <div className="scrollbar-slim flex gap-3 overflow-x-auto px-4 py-3.5">
        <SortableContext items={scenes.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          {scenes.map((s, i) => (
            <SceneCard
              key={s.id}
              scene={s}
              index={i}
              src={photoSrc(s.photoId)}
              room={roomOf(s.photoId)}
              selected={s.id === selectedId}
              onSelect={() => onSelect(s.id)}
              onDuration={(d) => onDuration(s.id, d)}
              onCycleMove={() => onCycleMove(s.id)}
              onRemove={() => onRemove(s.id)}
            />
          ))}
        </SortableContext>
        {highlightDrop && (
          <div className="flex w-44 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-mint bg-mint/10 font-mono text-[10px] uppercase tracking-widest text-mint">
            soltar aquí
          </div>
        )}
      </div>
    </div>
  );
}
