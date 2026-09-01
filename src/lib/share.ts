// BÓVEDA — compartir una memoria con frase propia (solo cliente)
// ---------------------------------------------------------------
// Un recuerdo viaja como archivo boveda.encrypted-share: el RECEPTOR
// lo abre con la frase de partage (que le das por otro canal), no con
// tu frase de bóveda. La clave se deriva con PBKDF2 + AES-GCM igual
// que la bóveda, pero con sal propia del archivo.

import { deriveKey, encryptJSON, decryptJSON, randomBytes, toB64 } from "@/lib/crypto";
import type { EncryptedShareFile, SharePayload } from "@/lib/types";
import type { MemoryItem } from "@/lib/types";

export const SHARE_FORMAT = "boveda.encrypted-share";

/**
 * Empaqueta una memoria como archivo cifrado con la frase de partage.
 * No incluye contentHash: el receptor lo recalcula al importar.
 */
export async function buildShareFile(
  m: MemoryItem,
  passphrase: string,
  hint?: string,
): Promise<EncryptedShareFile> {
  const salt = toB64(randomBytes(32));
  const key = await deriveKey(passphrase, salt);
  const payload: SharePayload = {
    plain: m.plain,
    kind: m.kind,
    source: m.source,
    sourceRef: m.sourceRef,
    obtainedAt: m.obtainedAt,
  };
  const { ct, iv } = await encryptJSON(key, payload);
  const file: EncryptedShareFile = {
    format: SHARE_FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    salt,
    ct,
    iv,
  };
  if (hint && hint.trim()) file.hint = hint.trim().slice(0, 120);
  return file;
}

/** Resultado de intentar abrir un archivo compartido. */
export type OpenShareResult =
  | { ok: true; payload: SharePayload }
  | { ok: false; error: "formato" | "frase" | "payload" };

/**
 * Abre un archivo compartido con la frase de partage.
 * Los errores distinguen formato roto de frase incorrecta.
 */
export async function openShareFile(
  data: unknown,
  passphrase: string,
): Promise<OpenShareResult> {
  const f = data as EncryptedShareFile | null;
  if (!f || f.format !== SHARE_FORMAT || typeof f.salt !== "string" || typeof f.ct !== "string" || typeof f.iv !== "string") {
    return { ok: false, error: "formato" };
  }
  try {
    const key = await deriveKey(passphrase, f.salt);
    const payload = await decryptJSON<SharePayload>(key, f.ct, f.iv);
    if (!payload || typeof payload.plain?.content !== "string") {
      return { ok: false, error: "payload" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "frase" };
  }
}

/** Nombre de archivo sugerido para el share. */
export function shareFilename(m: MemoryItem): string {
  const slug =
    m.plain.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "recuerdo";
  const stamp = new Date().toISOString().slice(0, 10);
  return `boveda-comparte-${slug}-${stamp}.json`;
}
