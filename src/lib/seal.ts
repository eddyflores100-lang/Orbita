// BÓVEDA — sello v2: metadatos dentro del cifrado
// -------------------------------------------------
// En v0.1–v0.3 el servidor veía kind/source/sourceRef/obtainedAt/contentHash
// en claro (metadatos del sobre). Con el sello v2 TODO lo privado viaja
// dentro del ciphertext y el servidor solo recibe marcadores opacos:
//   { ct, iv, kind: "seal", source: "seal", …null }
// Los sobres v1 antiguos siguen leyéndose (compatibilidad hacia atrás) y
// pueden migrarse a v2 con la acción «Blindar metadatos».

import { encryptJSON, sha256Hex } from "@/lib/crypto";
import type { Kind, MemoryEnvelope, MemoryItem, MemoryPlain, SealedMemory, Source } from "@/lib/types";
import { SOURCE_LABEL } from "@/lib/types";

/** Marcador opaco que el servidor guarda en las columnas kind/source. */
export const SEAL_MARKER = "seal";

/** Datos privados que quiero guardar de una memoria (para sellar). */
export interface SealInput {
  plain: MemoryPlain;
  kind: Kind;
  source: string;
  sourceRef: string | null;
  obtainedAt: string | null;
  imported: boolean;
  verified: boolean;
}

/** Resultado de abrir un sobre (v1 o v2) en el cliente. */
export interface ResolvedMemory {
  plain: MemoryPlain;
  kind: Kind;
  source: Source;
  sourceRef: string | null;
  obtainedAt: string | null;
  contentHash: string | null;
  imported: boolean;
  verified: boolean;
  /** true → sobre v2: el servidor no vio nunca estos metadatos. */
  sealed: boolean;
}

/** Sobre opaco listo para el servidor (resultado de sellar). */
export interface SealedEnvelope {
  ct: string;
  iv: string;
  kind: string;
  source: string;
  sourceRef: null;
  obtainedAt: null;
  contentHash: null;
  imported: boolean;
  verified: boolean;
}

/** Sella una memoria: cifrado v2 + sobre opaco listo para el servidor. */
export async function sealMemory(
  key: CryptoKey,
  input: SealInput,
): Promise<SealedEnvelope> {
  const sealed: SealedMemory = {
    v: 2,
    plain: input.plain,
    kind: input.kind,
    source: input.source,
    sourceRef: input.sourceRef,
    obtainedAt: input.obtainedAt,
    contentHash: await sha256Hex(input.plain.content),
    imported: input.imported,
    verified: input.verified,
  };
  const { ct, iv } = await encryptJSON(key, sealed);
  return {
    ct,
    iv,
    kind: SEAL_MARKER,
    source: SEAL_MARKER,
    sourceRef: null,
    obtainedAt: null,
    contentHash: null,
    imported: sealed.imported,
    verified: sealed.verified,
  };
}

function isSealedBlob(b: unknown): b is SealedMemory {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return (
    o.v === 2 &&
    !!o.plain &&
    typeof o.plain === "object" &&
    typeof (o.plain as MemoryPlain).content === "string"
  );
}

function isPlainBlob(b: unknown): b is MemoryPlain {
  if (!b || typeof b !== "object") return false;
  const o = b as MemoryPlain;
  return typeof o.content === "string" && typeof o.title === "string";
}

const KINDS: Kind[] = ["dato", "preferencia", "hecho", "proyecto"];

function coerceKind(k: string): Kind {
  return (KINDS as string[]).includes(k) ? (k as Kind) : "dato";
}

/**
 * Abre un sobre del servidor con su blob descifrado y devuelve la memoria
 * resuelta, sea sello v2 (metadatos dentro) o sobre v1 (metadatos en claro).
 * Devuelve null si el blob no tiene ninguna de las dos formas.
 */
export function resolveEnvelope(e: MemoryEnvelope, blob: unknown): ResolvedMemory | null {
  if (isSealedBlob(blob)) {
    return {
      plain: blob.plain,
      kind: coerceKind(blob.kind),
      source: (blob.source in SOURCE_LABEL ? blob.source : "generic") as Source,
      sourceRef: blob.sourceRef,
      obtainedAt: blob.obtainedAt,
      contentHash: blob.contentHash,
      imported: Boolean(blob.imported),
      verified: Boolean(blob.verified),
      sealed: true,
    };
  }
  if (isPlainBlob(blob)) {
    return {
      plain: blob,
      kind: coerceKind(e.kind),
      source: (e.source in SOURCE_LABEL ? e.source : "generic") as Source,
      sourceRef: e.sourceRef,
      obtainedAt: e.obtainedAt,
      contentHash: e.contentHash,
      imported: e.imported,
      verified: e.verified,
      sealed: false,
    };
  }
  return null;
}

/**
 * Re-sella una MemoryItem existente (v1 o v2) como v2 fresco,
 * conservando todos sus metadatos. Devuelve el sobre opaco para PATCH.
 */
export async function resealItem(key: CryptoKey, m: MemoryItem) {
  return sealMemory(key, {
    plain: m.plain,
    kind: m.kind,
    source: m.source,
    sourceRef: m.sourceRef,
    obtainedAt: m.obtainedAt,
    imported: m.imported,
    verified: m.verified,
  });
}
