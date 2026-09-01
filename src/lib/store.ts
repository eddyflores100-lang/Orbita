"use client";

// BÓVEDA — estado global (Zustand)
// La clave derivada vive SOLO en memoria del navegador. Al bloquear, se descarta.

import { create } from "zustand";
import {
  decryptJSON,
  newVaultMaterial,
  tryUnlock,
} from "@/lib/crypto";
import { sealMemory, resolveEnvelope, resealItem, type SealedEnvelope } from "@/lib/seal";
import { openShareFile } from "@/lib/share";
import { SOURCE_LABEL, type ImportCandidate, type Kind, type MemoryEnvelope, type MemoryItem, type MemoryPlain, type Source } from "@/lib/types";

export type Phase = "boot" | "fresh" | "locked" | "unlocked" | "busy";

/** Metadatos de un respaldo (el payload cifrado nunca viaja a la UI). */
export interface BackupMeta {
  id: string;
  count: number;
  note: string | null;
  createdAt: string;
}

/** Formato del respaldo cifrado descargable (portable entre dispositivos). */
export interface EncryptedBackupFile {
  format: "boveda.encrypted-backup";
  version: 1;
  createdAt: string;
  count: number;
  vault: { salt: string; verifier: string; verifierIv: string };
  payload: string; // JSON string: [{ct,iv,kind,source,...}] — cifrado con la clave maestra
}

interface BovedaState {
  phase: Phase;
  key: CryptoKey | null;
  error: string | null;
  busyMsg: string | null;
  memories: MemoryItem[];
  query: string;
  kindFilter: Kind | "todas";
  sourceFilter: Source | "todas";
  backups: BackupMeta[];

  boot: () => Promise<void>;
  createVault: (passphrase: string) => Promise<boolean>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  wipe: () => Promise<void>;

  refresh: () => Promise<void>;
  addCandidates: (items: ImportCandidate[]) => Promise<number>;
  saveNew: (plain: MemoryPlain, kind: Kind) => Promise<void>;
  updateMemory: (id: string, plain: MemoryPlain, kind: Kind) => Promise<void>;
  setVerified: (id: string, verified: boolean) => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  deleteMany: (ids: string[]) => Promise<void>;

  refreshBackups: () => Promise<void>;
  createBackup: (note?: string) => Promise<boolean>;
  restoreBackup: (id: string) => Promise<boolean>;
  deleteBackup: (id: string) => Promise<void>;
  importBackupFile: (data: EncryptedBackupFile) => Promise<{ ok: boolean; count: number; error?: string }>;

  /** Migra todos los sobres v1 (metadatos en claro) a sello v2. Devuelve cuántos. */
  sealAllMetadata: () => Promise<number>;
  /** Importa un archivo boveda.encrypted-share con su frase de partage. */
  importShareFile: (
    data: unknown,
    passphrase: string,
  ) => Promise<{ ok: boolean; title?: string; error?: string }>;

  setQuery: (q: string) => void;
  setKindFilter: (k: Kind | "todas") => void;
  setSourceFilter: (s: Source | "todas") => void;
}

async function loadAll(key: CryptoKey): Promise<{ items: MemoryItem[]; broken: number }> {
  const res = await fetch("/api/memories", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer la bóveda del servidor");
  const { items } = (await res.json()) as { items: MemoryEnvelope[] };
  const out: MemoryItem[] = [];
  let broken = 0;
  for (const e of items) {
    try {
      const blob = await decryptJSON<unknown>(key, e.ct, e.iv);
      const r = resolveEnvelope(e, blob);
      if (!r) throw new Error("forma desconocida");
      out.push({
        id: e.id,
        plain: r.plain,
        kind: r.kind,
        source: r.source,
        sourceRef: r.sourceRef,
        obtainedAt: r.obtainedAt,
        contentHash: r.contentHash,
        imported: r.imported,
        verified: r.verified,
        sealed: r.sealed,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
    } catch {
      broken++;
    }
  }
  return { items: out, broken };
}

export const useBoveda = create<BovedaState>((set, get) => ({
  phase: "boot",
  key: null,
  error: null,
  busyMsg: null,
  memories: [],
  query: "",
  kindFilter: "todas",
  sourceFilter: "todas",
  backups: [],

  boot: async () => {
    set({ phase: "boot", error: null });
    try {
      const res = await fetch("/api/vault", { cache: "no-store" });
      const state = (await res.json()) as { exists: boolean };
      set({ phase: state.exists ? "locked" : "fresh" });
    } catch {
      set({ phase: "fresh", error: "No hay conexión con el servidor de la bóveda." });
    }
  },

  createVault: async (passphrase) => {
    set({ phase: "busy", busyMsg: "Derivando tu clave con PBKDF2…", error: null });
    try {
      const mat = await newVaultMaterial(passphrase);
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salt: mat.salt, verifier: mat.verifier, verifierIv: mat.verifierIv }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "No se pudo crear la bóveda");
      }
      set({ key: mat.key, phase: "unlocked", memories: [], busyMsg: null });
      return true;
    } catch (e) {
      set({ phase: "fresh", error: e instanceof Error ? e.message : "Error", busyMsg: null });
      return false;
    }
  },

  unlock: async (passphrase) => {
    set({ phase: "busy", busyMsg: "Derivando tu clave y descifrando…", error: null });
    try {
      const res = await fetch("/api/vault", { cache: "no-store" });
      const v = (await res.json()) as { exists: boolean; salt?: string; verifier?: string; verifierIv?: string };
      if (!v.exists || !v.salt || !v.verifier || !v.verifierIv) throw new Error("Bóveda no encontrada");
      const key = await tryUnlock(passphrase, v.salt, v.verifier, v.verifierIv);
      if (!key) {
        set({ phase: "locked", error: "Frase incorrecta. Inténtalo de nuevo.", busyMsg: null });
        return false;
      }
      const { items, broken } = await loadAll(key);
      set({ key, phase: "unlocked", memories: items, busyMsg: null, error: broken > 0 ? `${broken} memorias no pudieron descifrarse.` : null });
      return true;
    } catch (e) {
      set({ phase: "locked", error: e instanceof Error ? e.message : "Error al abrir", busyMsg: null });
      return false;
    }
  },

  lock: () => {
    set({ key: null, memories: [], phase: "locked", query: "", kindFilter: "todas", sourceFilter: "todas", error: null });
  },

  wipe: async () => {
    set({ phase: "busy", busyMsg: "Destruyendo la bóveda…", error: null });
    try {
      await fetch("/api/vault", { method: "DELETE" });
    } finally {
      set({ key: null, memories: [], phase: "fresh", busyMsg: null, error: null, query: "" });
    }
  },

  refresh: async () => {
    const key = get().key;
    if (!key) return;
    const { items, broken } = await loadAll(key);
    set({ memories: items, error: broken > 0 ? `${broken} memorias no pudieron descifrarse.` : null });
  },

  addCandidates: async (list) => {
    const key = get().key;
    if (!key || list.length === 0) return 0;
    set({ busyMsg: `Cifrando e importando ${list.length} memorias…` });
    try {
      // respaldo preventivo automático antes de importaciones grandes
      if (list.length >= 5 && get().memories.length >= 5) {
        try {
          await get().createBackup(`Auto previo a importar ${list.length} recuerdos`);
        } catch {
          /* el auto-respaldo nunca bloquea la importación */
        }
      }
      const payload: SealedEnvelope[] = [];
      const now = new Date().toISOString();
      for (const c of list) {
        const plain: MemoryPlain = {
          title: c.title,
          content: c.content,
          tags: c.tags,
          confidence: 100,
        };
        const sealed = await sealMemory(key, {
          plain,
          kind: c.kind,
          source: c.source,
          sourceRef: c.sourceRef,
          obtainedAt: c.obtainedAt,
          imported: true,
          verified: false,
        });
        payload.push(sealed);
      }
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload, importedAt: now }),
      });
      if (!res.ok) throw new Error("El servidor rechazó la importación");
      const j = (await res.json()) as { created: number };
      await get().refresh();
      return j.created;
    } finally {
      set({ busyMsg: null });
    }
  },

  saveNew: async (plain, kind) => {
    const key = get().key;
    if (!key) return;
    set({ busyMsg: "Cifrando y guardando…" });
    try {
      const sealed = await sealMemory(key, {
        plain,
        kind,
        source: "manual",
        sourceRef: null,
        obtainedAt: new Date().toISOString(),
        imported: false,
        verified: true,
      });
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [sealed] }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      await get().refresh();
    } finally {
      set({ busyMsg: null });
    }
  },

  updateMemory: async (id, plain, kind) => {
    const key = get().key;
    if (!key) return;
    set({ busyMsg: "Re-cifrando y actualizando…" });
    try {
      const current = get().memories.find((m) => m.id === id);
      const sealed = await sealMemory(key, {
        plain,
        kind,
        source: current?.source ?? "manual",
        sourceRef: current?.sourceRef ?? null,
        obtainedAt: current?.obtainedAt ?? new Date().toISOString(),
        imported: current?.imported ?? false,
        verified: true,
      });
      const res = await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sealed),
      });
      if (!res.ok) throw new Error("No se pudo actualizar");
      await get().refresh();
    } finally {
      set({ busyMsg: null });
    }
  },

  setVerified: async (id, verified) => {
    const item = get().memories.find((m) => m.id === id);
    if (!item) return;
    const key = get().key;
    if (item.sealed && key) {
      // el flag verificado vive dentro del sello: re-sellar con el nuevo valor
      const sealed = await resealItem(key, { ...item, verified });
      await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sealed),
      });
    } else {
      await fetch(`/api/memories?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified }),
      });
    }
    set((s) => ({
      memories: s.memories.map((m) => (m.id === id ? { ...m, verified } : m)),
    }));
  },

  deleteOne: async (id) => {
    await fetch(`/api/memories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }));
  },

  deleteMany: async (ids) => {
    if (ids.length === 0) return;
    await fetch(`/api/memories?ids=${ids.join(",")}`, { method: "DELETE" });
    set((s) => ({ memories: s.memories.filter((m) => !ids.includes(m.id)) }));
  },

  /* ── respaldos cifrados ── */

  refreshBackups: async () => {
    try {
      const res = await fetch("/api/backups", { cache: "no-store" });
      if (!res.ok) return;
      const j = (await res.json()) as { items: BackupMeta[] };
      set({ backups: j.items });
    } catch {
      /* silencioso: la lista de respaldos es secundaria */
    }
  },

  createBackup: async (note) => {
    const key = get().key;
    const memories = get().memories;
    if (!key) return false;
    // snapshot: sella cada memoria como v2 (todo lo privado dentro del cifrado).
    // El servidor solo ve blobs opacos; solo tu clave puede abrirlos de nuevo.
    const envelopes: SealedEnvelope[] = [];
    for (const m of memories) {
      const sealed = await sealMemory(key, {
        plain: m.plain,
        kind: m.kind,
        source: m.source,
        sourceRef: m.sourceRef,
        obtainedAt: m.obtainedAt,
        imported: m.imported,
        verified: m.verified,
      });
      envelopes.push(sealed);
    }
    const res = await fetch("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: memories.length, note: note ?? null, payload: JSON.stringify(envelopes) }),
    });
    if (!res.ok) throw new Error("El servidor rechazó el respaldo");
    await get().refreshBackups();
    return true;
  },

  restoreBackup: async (id) => {
    set({ busyMsg: "Restaurando respaldo…" });
    try {
      const res = await fetch("/api/backups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "No se pudo restaurar");
      }
      await get().refresh();
      await get().refreshBackups();
      return true;
    } finally {
      set({ busyMsg: null });
    }
  },

  deleteBackup: async (id) => {
    await fetch(`/api/backups?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await get().refreshBackups();
  },

  importBackupFile: async (data) => {
    if (data?.format !== "boveda.encrypted-backup" || !data.vault?.salt || typeof data.payload !== "string") {
      return { ok: false, count: 0, error: "El archivo no es un respaldo BÓVEDA válido." };
    }
    let envelopes: unknown;
    try {
      envelopes = JSON.parse(data.payload);
    } catch {
      return { ok: false, count: 0, error: "El payload del respaldo está corrupto." };
    }
    if (!Array.isArray(envelopes)) {
      return { ok: false, count: 0, error: "El payload del respaldo está corrupto." };
    }
    set({ busyMsg: "Adoptando respaldo cifrado…" });
    try {
      // 1) elimina la bóveda local (solo si está vacía; la UI lo exige)
      await fetch("/api/vault", { method: "DELETE" });
      // 2) recrea la bóveda con el material criptográfico ORIGINAL del respaldo
      const created = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salt: data.vault.salt, verifier: data.vault.verifier, verifierIv: data.vault.verifierIv }),
      });
      if (!created.ok) {
        const j = (await created.json().catch(() => ({}))) as { error?: string };
        return { ok: false, count: 0, error: j.error || "No se pudo recrear la bóveda del respaldo." };
      }
      // 3) reinserta los sobres cifrados (siguen siendo opacos: sin clave no se tocan)
      const items = (envelopes as Record<string, unknown>[]).filter((e) => typeof e.ct === "string" && typeof e.iv === "string");
      for (let i = 0; i < items.length; i += 400) {
        const batch = items.slice(i, i + 400);
        const res = await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch }),
        });
        if (!res.ok) return { ok: false, count: 0, error: "El servidor rechazó los sobres del respaldo." };
      }
      // 4) la bóveda queda bloqueada: se abre con la frase ORIGINAL del respaldo
      set({ key: null, memories: [], phase: "locked", backups: [], query: "", error: null });
      return { ok: true, count: items.length };
    } finally {
      set({ busyMsg: null });
    }
  },

  sealAllMetadata: async () => {
    const key = get().key;
    if (!key) return 0;
    const pending = get().memories.filter((m) => !m.sealed);
    if (pending.length === 0) return 0;
    set({ busyMsg: `Blindando metadatos de ${pending.length} recuerdos…` });
    try {
      let done = 0;
      for (const m of pending) {
        try {
          const sealed = await resealItem(key, m);
          const res = await fetch(`/api/memories?id=${encodeURIComponent(m.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sealed),
          });
          if (res.ok) done++;
        } catch {
          /* un fallo individual no aborta la migración */
        }
      }
      await get().refresh();
      return done;
    } finally {
      set({ busyMsg: null });
    }
  },

  importShareFile: async (data, passphrase) => {
    const key = get().key;
    if (!key) return { ok: false, error: "La bóveda está bloqueada." };
    const r = await openShareFile(data, passphrase);
    if (!r.ok) {
      const msg =
        r.error === "formato"
          ? "El archivo no es una memoria compartida BÓVEDA válida."
          : r.error === "frase"
            ? "Frase de partage incorrecta para este archivo."
            : "El contenido del archivo compartido es inválido.";
      return { ok: false, error: msg };
    }
    const p = r.payload;
    set({ busyMsg: "Cifrando el recuerdo compartido…" });
    try {
      const sealed = await sealMemory(key, {
        plain: {
          title: p.plain.title || "Recuerdo compartido",
          content: p.plain.content,
          tags: p.plain.tags?.length ? p.plain.tags : ["compartido"],
          confidence: typeof p.plain.confidence === "number" ? p.plain.confidence : 80,
        },
        kind: p.kind,
        source: p.source in SOURCE_LABEL ? p.source : "generic",
        sourceRef: p.sourceRef,
        obtainedAt: p.obtainedAt,
        imported: true,
        verified: false,
      });
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [sealed] }),
      });
      if (!res.ok) return { ok: false, error: "El servidor rechazó el recuerdo compartido." };
      await get().refresh();
      return { ok: true, title: p.plain.title };
    } finally {
      set({ busyMsg: null });
    }
  },

  setQuery: (q) => set({ query: q }),
  setKindFilter: (k) => set({ kindFilter: k }),
  setSourceFilter: (s) => set({ sourceFilter: s }),
}));
