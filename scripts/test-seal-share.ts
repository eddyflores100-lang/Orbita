// Test unitario BÓVEDA: sello v2 (metadatos cifrados) + share (frase propia)
// Ejecutar: bun scripts/test-seal-share.ts

import { newVaultMaterial, deriveKey, encryptJSON, decryptJSON } from "../src/lib/crypto";
import { sealMemory, resolveEnvelope, resealItem, SEAL_MARKER } from "../src/lib/seal";
import { buildShareFile, openShareFile, shareFilename } from "../src/lib/share";
import type { MemoryEnvelope, MemoryItem, MemoryPlain } from "../src/lib/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    console.error(`  FAIL ${name}`);
  }
}

async function fakeItem(): Promise<MemoryItem> {
  return {
    id: "test-1",
    plain: {
      title: "Alergia a las avellanas",
      content: "Soy alérgico a las avellanas: nada de cremas de cacao.",
      tags: ["salud", "alergia"],
      confidence: 95,
    },
    kind: "dato",
    source: "claude",
    sourceRef: "Conversación de Nutrición",
    obtainedAt: "2026-08-01T10:00:00.000Z",
    contentHash: null,
    imported: true,
    verified: false,
    sealed: false,
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
  };
}

async function main() {
  const phrase = "frase-principal-de-prueba-2026";
  const mat = await newVaultMaterial(phrase);
  const key = mat.key;
  const item = await fakeItem();

  console.log("\n— Sello v2 —");
  const sealed = await sealMemory(key, {
    plain: item.plain,
    kind: item.kind,
    source: item.source,
    sourceRef: item.sourceRef,
    obtainedAt: item.obtainedAt,
    imported: item.imported,
    verified: item.verified,
  });
  check("marcador kind = seal", sealed.kind === SEAL_MARKER);
  check("marcador source = seal", sealed.source === SEAL_MARKER);
  check("sourceRef oculto", sealed.sourceRef === null);
  check("obtainedAt oculto", sealed.obtainedAt === null);
  check("contentHash oculto (va dentro)", sealed.contentHash === null);
  check("ct sin título en claro", !sealed.ct.includes("avellanas"));
  check("ct sin origen en claro", !sealed.ct.includes("claude"));

  const blob = await decryptJSON<unknown>(key, sealed.ct, sealed.iv);
  const env: MemoryEnvelope = {
    id: "e1",
    ct: sealed.ct,
    iv: sealed.iv,
    kind: sealed.kind,
    source: sealed.source,
    sourceRef: null,
    obtainedAt: null,
    contentHash: null,
    imported: true,
    verified: false,
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
  };
  const r2 = resolveEnvelope(env, blob);
  check("v2 resuelto", r2 !== null && r2.sealed);
  check("v2: origen recuperado del interior", r2?.source === "claude");
  check("v2: tipo recuperado del interior", r2?.kind === "dato");
  check("v2: sourceRef recuperado", r2?.sourceRef === item.sourceRef);
  check("v2: hash recalculado dentro", r2?.contentHash !== null && r2?.contentHash?.length === 64);

  console.log("\n— Sobre v1 (compatibilidad) —");
  const { ct, iv } = await encryptJSON(key, item.plain);
  const env1: MemoryEnvelope = {
    id: "e2",
    ct,
    iv,
    kind: "preferencia",
    source: "gemini",
    sourceRef: "Takeout/MyActivity.json",
    obtainedAt: "2026-07-01T00:00:00.000Z",
    contentHash: "a".repeat(64),
    imported: true,
    verified: true,
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  };
  const blob1 = await decryptJSON<unknown>(key, ct, iv);
  const r1 = resolveEnvelope(env1, blob1);
  check("v1 resuelto (no sellado)", r1 !== null && !r1.sealed);
  check("v1: metadatos desde el sobre", r1?.source === "gemini" && r1?.kind === "preferencia");
  check("v1: hash del sobre", r1?.contentHash === "a".repeat(64));

  check("blob desconocido → null", resolveEnvelope(env, { nope: true }) === null);

  console.log("\n— Re-sellado (migración) —");
  const resealed = await resealItem(key, { ...item, ...r1!, id: "e2" });
  check("re-sellado usa marcadores", resealed.kind === SEAL_MARKER && resealed.source === SEAL_MARKER);
  const reblob = await decryptJSON<unknown>(key, resealed.ct, resealed.iv);
  const rr = resolveEnvelope({ ...env1, ct: resealed.ct, iv: resealed.iv }, reblob);
  check("re-sellado conserva origen gemini (del sobre v1)", rr?.source === "gemini");
  check("re-sellado conserva verificación (true)", rr?.verified === true);
  check("re-sellado ahora está sellado", rr?.sealed === true);

  console.log("\n— Compartir con frase propia —");
  const sharePass = "frase-de-partage-2026";
  const file = await buildShareFile(item, sharePass, "la frase de la alergia");
  check("formato share", file.format === "boveda.encrypted-share");
  check("pista incluida", file.hint === "la frase de la alergia");
  check("la frase de la bóveda NO está en el archivo", !JSON.stringify(file).includes(phrase));
  check("el contenido NO está en claro", !JSON.stringify(file).includes("avellanas"));

  const opened = await openShareFile(file, sharePass);
  check("abre con frase correcta", opened.ok);
  check("payload intacto", opened.ok && opened.payload.plain.content === item.plain.content);
  check("origen preservado", opened.ok && opened.payload.source === "claude");

  const wrong = await openShareFile(file, "frase-equivocada-99");
  check("frase incorrecta rechazada", !wrong.ok && wrong.error === "frase");

  const badFmt = await openShareFile({ format: "otro" }, sharePass);
  check("formato inválido rechazado", !badFmt.ok && badFmt.error === "formato");

  const fname = shareFilename(item);
  check("nombre de archivo saneado", fname.startsWith("boveda-comparte-alergia") && fname.endsWith(".json"));

  // clave distinta del share no debe abrir el sobre de la bóveda
  const shareKey = await deriveKey(sharePass, mat.salt);
  let crossFailed = false;
  try {
    await decryptJSON(shareKey, sealed.ct, sealed.iv);
  } catch {
    crossFailed = true;
  }
  check("clave de partage NO abre la bóveda", crossFailed);

  console.log(`\n${pass} PASS, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
