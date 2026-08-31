import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Clapperboard, Image as ImagesIcon, Wand2 } from "lucide-react";
import type { EnvId, FormatId, MoveId, Photo, Project, Scene, Track, TransitionId } from "../lib/data";
import { ROOM_SEQUENCE, SUNO_IDEAS, TRACKS, fmtTime } from "../lib/data";
import { audio } from "../lib/audio";
import { useToast } from "./Toast";
import { PreviewPlayer } from "./Preview";
import Timeline from "./Timeline";
import RightPanel from "./RightPanel";
import GenerateFlow from "./GenerateFlow";

/* ------------------------------------------------------------------ */
function PhotoCard({ photo, inUse, onAdd }: { photo: Photo; inUse: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: `photo:${photo.id}` });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={onAdd}
      style={{ transform: CSS.Translate.toString(transform) ?? undefined }}
      title="Arrastra a la línea de tiempo · doble clic para añadir"
      className={`group cursor-grab select-none rounded-lg border transition active:cursor-grabbing ${
        isDragging ? "z-30 border-mint opacity-70 shadow-lift" : inUse ? "border-line bg-panel2/70" : "border-line bg-panel hover:border-amber/50 hover:-translate-y-0.5"
      }`}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        <img src={photo.src} alt={photo.room} draggable={false} className="aspect-[4/3] w-full object-cover" />
        <span className="absolute left-1 top-1 rounded bg-ink/75 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-widest text-paper backdrop-blur-sm">
          {String(photo.order + 1).padStart(2, "0")}
        </span>
        {inUse && (
          <span className="absolute right-1 top-1 rounded bg-mint/90 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-ink">
            en tour
          </span>
        )}
      </div>
      <p className="truncate px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest text-mut group-hover:text-paper">{photo.room}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
interface Props {
  project: Project;
  initialScenes: Scene[];
  onExit: () => void;
}

export default function Editor({ project, initialScenes, onExit }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(project.title);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [selectedId, setSelectedId] = useState<string | null>(initialScenes[0]?.id ?? null);
  const [env, setEnv] = useState<EnvId>("sunset");
  const [format, setFormat] = useState<FormatId>("16:9");
  const [transition, setTransition] = useState<TransitionId>("fade");
  const [tracks, setTracks] = useState<Track[]>(TRACKS);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [sunoBusy, setSunoBusy] = useState(false);
  const [musicVol, setMusicVol] = useState(0.6);
  const [sfxVol, setSfxVol] = useState(0.7);
  const [sfx, setSfx] = useState({ whoosh: true, shutter: true, tick: true });
  const [showGenerate, setShowGenerate] = useState(false);
  const [dragPhoto, setDragPhoto] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const t1 = window.setTimeout(
      () => toast(`La IA ordenó ${initialScenes.length} espacios en secuencia lógica: exterior → sala → cocina → dormitorios.`, "magic"),
      600
    );
    const t2 = window.setTimeout(
      () => toast("Arrastra fotos de la biblioteca a la línea de tiempo, o doble clic para añadirlas.", "info"),
      2400
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    audio.setMusicVolume(musicVol);
  }, [musicVol]);
  useEffect(() => {
    audio.setSfxVolume(sfxVol);
  }, [sfxVol]);
  useEffect(() => {
    audio.tickEnabled = sfx.tick;
  }, [sfx.tick]);

  const photoSrc = useMemo(() => {
    const m: Record<string, string> = {};
    project.photos.forEach((p) => (m[p.id] = p.src));
    return (id: string) => m[id] ?? "";
  }, [project.photos]);

  const roomOf = (photoId: string) => project.photos.find((p) => p.id === photoId)?.room ?? "Espacio";

  const selectedScene = scenes.find((s) => s.id === selectedId) ?? null;
  const selectedIdx = selectedScene ? scenes.indexOf(selectedScene) : -1;
  const currentTrack = tracks.find((t) => t.id === currentTrackId) ?? null;
  const total = scenes.reduce((a, s) => a + s.duration, 0);

  /* ---------------- dnd ---------------- */
  const onDragStart = (e: DragStartEvent) => {
    if (String(e.active.id).startsWith("photo:")) setDragPhoto(true);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragPhoto(false);
    const { active, over, delta } = e;
    if (!over) return;
    const aid = String(active.id);
    const oid = String(over.id);

    if (aid.startsWith("photo:")) {
      const photoId = aid.slice(6);
      const photo = project.photos.find((p) => p.id === photoId);
      if (!photo) return;
      const caption = ROOM_SEQUENCE.find((r) => r.room === photo.room)?.caption ?? photo.room;
      const newScene: Scene = {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        photoId,
        duration: 4,
        move: "zoom-in",
        caption,
      };
      setScenes((prev) => {
        const idx = prev.findIndex((s) => s.id === oid);
        const at = idx === -1 ? prev.length : delta.x > 0 ? idx + 1 : idx;
        const copy = [...prev];
        copy.splice(at, 0, newScene);
        return copy;
      });
      setSelectedId(newScene.id);
      audio.tick();
      toast(`«${photo.room}» añadida a la secuencia.`, "ok");
      return;
    }

    setScenes((prev) => {
      const from = prev.findIndex((s) => s.id === aid);
      const to = prev.findIndex((s) => s.id === oid);
      if (from === -1 || to === -1) return prev;
      audio.tick();
      return arrayMove(prev, from, to);
    });
  };

  /* ---------------- scene ops ---------------- */
  const patchScene = (id: string, fn: (s: Scene) => Scene) => setScenes((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));

  const onDuration = (id: string, d: number) =>
    patchScene(id, (s) => ({ ...s, duration: Math.max(2, Math.min(10, s.duration + d)) }));

  const onCycleMove = (id: string) =>
    patchScene(id, (s) => {
      const order: MoveId[] = ["zoom-in", "zoom-out", "pan-l", "pan-r", "orbit", "static"];
      return { ...s, move: order[(order.indexOf(s.move) + 1) % order.length] };
    });

  const onRemove = (id: string) => {
    if (scenes.length <= 1) {
      toast("El tour necesita al menos una escena.", "info");
      return;
    }
    setScenes((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast("Escena eliminada.", "info");
  };

  const aiReorder = () => {
    setScenes((prev) =>
      prev.slice().sort((a, b) => {
        const pa = project.photos.find((p) => p.id === a.photoId)?.order ?? 99;
        const pb = project.photos.find((p) => p.id === b.photoId)?.order ?? 99;
        return pa - pb;
      })
    );
    audio.whoosh();
    toast("La IA reordenó el recorrido: exterior → interior → exteriores.", "magic");
  };

  /* ---------------- audio ---------------- */
  const onPlayTrack = (id: string) => {
    if (currentTrackId === id) {
      audio.stopTrack();
      setCurrentTrackId(null);
      return;
    }
    const t = tracks.find((x) => x.id === id);
    if (!t) return;
    audio.playTrack(t);
    setCurrentTrackId(id);
    toast(`Reproduciendo «${t.title}» — ${t.mood}.`, "info");
  };

  const onSuno = () => {
    if (sunoBusy) return;
    setSunoBusy(true);
    const idea = SUNO_IDEAS[tracks.filter((t) => t.suno).length % SUNO_IDEAS.length];
    window.setTimeout(() => {
      const base = TRACKS[tracks.length % TRACKS.length];
      const nt: Track = {
        id: `suno-${Date.now()}`,
        title: idea.title,
        author: "Suno AI",
        mood: idea.mood,
        bpm: idea.bpm,
        prog: base.prog,
        hats: true,
        suno: true,
      };
      setTracks((ts) => [...ts, nt]);
      setSunoBusy(false);
      audio.playTrack(nt);
      setCurrentTrackId(nt.id);
      toast(`«${idea.title}» compuesta con Suno AI y añadida a tu tour.`, "magic");
    }, 2800);
  };

  /* ---------------- render ---------------- */
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex h-screen flex-col overflow-hidden">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-line bg-panel/60 px-4 py-2.5">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-mut transition hover:border-line2 hover:text-paper active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Inicio
        </button>
        <span className="h-6 w-px bg-line" />
        <div className="min-w-0 flex-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full max-w-xs truncate rounded border border-transparent bg-transparent px-1 -mx-1 font-display text-[15px] font-semibold text-paper outline-none transition focus:border-line2 focus:bg-ink2"
            aria-label="Nombre del proyecto"
          />
          <p className="truncate font-mono text-[9px] uppercase tracking-widest text-dim">
            {project.platform} · {project.address} · {scenes.length} escenas · {fmtTime(total)}
          </p>
        </div>
        {currentTrack && (
          <span className="hidden items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 md:flex">
            <span className="flex h-3 items-end gap-[2px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="eq-bar w-[2.5px] rounded-full bg-amber" style={{ height: 11, animationDelay: `${i * 0.14}s` }} />
              ))}
            </span>
            <span className="max-w-32 truncate font-mono text-[10px] text-amber">{currentTrack.title}</span>
          </span>
        )}
        <button
          onClick={() => {
            if (sfx.shutter) audio.shutter();
            setShowGenerate(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-amber px-4 py-2.5 font-display text-[13px] font-bold text-ink transition hover:bg-amber2 hover:shadow-[0_0_30px_rgba(242,169,59,0.35)] active:scale-95"
        >
          <Clapperboard className="h-4 w-4" /> Aprobar y generar
        </button>
      </header>

      {/* body */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex min-h-0 flex-1 gap-3 px-3 pt-3">
          {/* library */}
          <aside className="hidden w-48 shrink-0 flex-col rounded-xl border border-line bg-panel md:flex xl:w-56">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">
                <ImagesIcon className="h-3.5 w-3.5 text-amber" /> Fotos · {project.photos.length}
              </p>
              <button
                onClick={aiReorder}
                title="Reordenar secuencia con IA"
                className="rounded-md border border-mint/40 bg-mint/10 p-1.5 text-mint transition hover:bg-mint/20 active:scale-90"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="scrollbar-slim grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-2.5">
              {project.photos.map((p) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  inUse={scenes.some((s) => s.photoId === p.id)}
                  onAdd={() => {
                    const caption = ROOM_SEQUENCE.find((r) => r.room === p.room)?.caption ?? p.room;
                    const ns: Scene = {
                      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      photoId: p.id,
                      duration: 4,
                      move: "zoom-in",
                      caption,
                    };
                    setScenes((prev) => [...prev, ns]);
                    setSelectedId(ns.id);
                    audio.tick();
                    toast(`«${p.room}» añadida al final.`, "ok");
                  }}
                />
              ))}
            </div>
            <p className="border-t border-line px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-dim">
              arrastra a la línea de tiempo
            </p>
          </aside>

          {/* preview */}
          <section className="min-w-0 flex-1">
            <PreviewPlayer
              scenes={scenes}
              photos={project.photos}
              env={env}
              format={format}
              transition={transition}
              whooshOnScene={sfx.whoosh}
              focusSceneId={selectedId}
              onPlayingChange={(p) => {
                if (p && sfx.shutter) audio.shutter();
              }}
            />
          </section>

          {/* settings */}
          <aside className="hidden w-72 shrink-0 lg:block xl:w-80">
            <RightPanel
              env={env}
              onEnv={setEnv}
              format={format}
              onFormat={setFormat}
              transition={transition}
              onTransition={setTransition}
              selectedMove={selectedScene?.move ?? null}
              sceneLabel={selectedScene ? `Escena ${selectedIdx + 1} · ${roomOf(selectedScene.photoId)}` : "Selecciona una escena"}
              onMove={(m: MoveId) => selectedScene && patchScene(selectedScene.id, (s) => ({ ...s, move: m }))}
              tracks={tracks}
              currentTrackId={currentTrackId}
              onPlayTrack={onPlayTrack}
              sunoBusy={sunoBusy}
              onSuno={onSuno}
              musicVol={musicVol}
              onMusicVol={setMusicVol}
              sfxVol={sfxVol}
              onSfxVol={setSfxVol}
              sfx={sfx}
              onSfx={(k, v) => setSfx((s) => ({ ...s, [k]: v }))}
            />
          </aside>
        </div>

        {/* timeline */}
        <div className="p-3">
          <Timeline
            scenes={scenes}
            photoSrc={photoSrc}
            roomOf={roomOf}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            onDuration={onDuration}
            onCycleMove={onCycleMove}
            onRemove={onRemove}
            highlightDrop={dragPhoto}
          />
        </div>
      </DndContext>

      {/* generate overlay */}
      <AnimatePresence>
        {showGenerate && (
          <GenerateFlow
            project={{ ...project, title: title.trim() || project.title }}
            scenes={scenes}
            photos={project.photos}
            env={env}
            format={format}
            transition={transition}
            track={currentTrack}
            onClose={() => setShowGenerate(false)}
            onRestart={onExit}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
}
