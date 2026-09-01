"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  Tag,
  LockKeyhole,
  FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { useBoveda } from "@/lib/store";
import { KINDS, KIND_LABEL, SOURCES, SOURCE_LABEL, type Kind, type MemoryItem } from "@/lib/types";

/* ── Diálogo alta/edición ── */
function MemoryDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MemoryItem | null;
}) {
  const saveNew = useBoveda((s) => s.saveNew);
  const updateMemory = useBoveda((s) => s.updateMemory);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [kind, setKind] = useState<Kind>("dato");
  const [touched, setTouched] = useState(false);

  // sincroniza al abrir
  const key = editing ? `edit-${editing.id}` : "new";
  const [lastKey, setLastKey] = useState("");
  if (open && key !== lastKey) {
    setLastKey(key);
    setTouched(false);
    setTitle(editing?.plain.title ?? "");
    setContent(editing?.plain.content ?? "");
    setTagsRaw(editing ? editing.plain.tags.join(", ") : "");
    setKind(editing?.kind ?? "dato");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!title.trim() || !content.trim()) return;
    const plain = {
      title: title.trim(),
      content: content.trim(),
      tags: tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8),
      confidence: 100,
    };
    if (editing) {
      await updateMemory(editing.id, plain, kind);
      toast.success("Memoria re-cifrada y actualizada");
    } else {
      await saveNew(plain, kind);
      toast.success("Memoria cifrada y guardada en tu bóveda");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar memoria" : "Nueva memoria"}</DialogTitle>
          <DialogDescription>
            Se cifrará con AES-GCM en tu navegador antes de enviarse. El servidor jamás ve este texto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-title">Título</Label>
            <Input
              id="m-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="p. ej. Idioma preferido"
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-content">Contenido</Label>
            <Textarea
              id="m-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Lo que quieres que tu IA siempre sepa de ti…"
              rows={4}
              maxLength={4000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m-kind">Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger id="m-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-tags">Etiquetas (separadas por coma)</Label>
              <Input id="m-tags" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="idioma, tono" />
            </div>
          </div>
          {(touched && (!title.trim() || !content.trim())) && (
            <p className="text-sm text-destructive">Título y contenido son obligatorios.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{editing ? "Guardar cambios" : "Cifrar y guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Tarjeta de memoria ── */
function MemoryCard({ item, onEdit }: { item: MemoryItem; onEdit: () => void }) {
  const deleteOne = useBoveda((s) => s.deleteOne);
  const setVerified = useBoveda((s) => s.setVerified);
  const [askDelete, setAskDelete] = useState(false);

  const date = item.obtainedAt ? new Date(item.obtainedAt) : null;
  const dateTxt =
    date && !isNaN(date.getTime())
      ? date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
      : null;

  return (
    <Card className="group hover:border-primary/40 transition-colors">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug break-words">{item.plain.title}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-1 leading-relaxed">
              {item.plain.content}
            </p>
          </div>
          <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" aria-label="Editar" onClick={onEdit} className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Eliminar"
              onClick={() => setAskDelete(true)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {item.plain.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.plain.tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 font-normal">
                <Tag className="h-3 w-3" aria-hidden />
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          <Badge variant="outline" className="font-normal">
            {KIND_LABEL[item.kind]}
          </Badge>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {SOURCE_LABEL[item.source]}
            {dateTxt ? ` · ${dateTxt}` : ""}
          </Badge>
          {item.verified ? (
            <Badge variant="outline" className="gap-1 border-emerald-600/40 text-emerald-500 font-normal">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Verificada
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground font-normal">
              Sin verificar
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor={`v-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
              Verificada
            </Label>
            <Switch
              id={`v-${item.id}`}
              checked={item.verified}
              onCheckedChange={(v) => {
                void setVerified(item.id, v);
                toast[v ? "success" : "info"](v ? "Marcada como verificada" : "Verificación retirada");
              }}
            />
          </div>
        </div>
      </CardContent>

      <AlertDialog open={askDelete} onOpenChange={setAskDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{item.plain.title}»?</AlertDialogTitle>
            <AlertDialogDescription>
              El blob cifrado se elimina del servidor para siempre. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                void deleteOne(item.id);
                toast.success("Memoria borrada");
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ── Pestaña principal ── */
export default function MemoriesTab() {
  const memories = useBoveda((s) => s.memories);
  const query = useBoveda((s) => s.query);
  const setQuery = useBoveda((s) => s.setQuery);
  const kindFilter = useBoveda((s) => s.kindFilter);
  const setKindFilter = useBoveda((s) => s.setKindFilter);
  const sourceFilter = useBoveda((s) => s.sourceFilter);
  const setSourceFilter = useBoveda((s) => s.setSourceFilter);
  const deleteMany = useBoveda((s) => s.deleteMany);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MemoryItem | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (kindFilter !== "todas" && m.kind !== kindFilter) return false;
      if (sourceFilter !== "todas" && m.source !== sourceFilter) return false;
      if (!q) return true;
      const hay = `${m.plain.title} ${m.plain.content} ${m.plain.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [memories, query, kindFilter, sourceFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca en tu memoria… (título, contenido, etiquetas)"
            className="pl-9"
            aria-label="Buscar memorias"
          />
        </div>
        <div className="flex gap-2">
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as Kind | "todas")}>
            <SelectTrigger className="w-[150px]" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los tipos</SelectItem>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as import("@/lib/types").Source | "todas")}>
            <SelectTrigger className="w-[160px]" aria-label="Filtrar por origen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los orígenes</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        </div>
      </div>

      {memories.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {memories.length} recuerdos · descifrados localmente en tu navegador
        </p>
      )}

      {memories.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <LockKeyhole className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold">Tu bóveda está vacía</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Añade tu primera memoria a mano o importa los recuerdos que tus IA ya guardan sobre ti — de ChatGPT, Claude, Gemini o cualquier agente.
              Todo se cifra en tu navegador antes de salir.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Escribir una memoria
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center space-y-3">
          <FileSearch className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Ningún recuerdo coincide con la búsqueda o los filtros.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuery("");
              setKindFilter("todas");
              setSourceFilter("todas");
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((m) => (
            <MemoryCard
              key={m.id}
              item={m}
              onEdit={() => {
                setEditing(m);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <MemoryDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}
