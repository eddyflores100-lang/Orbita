// Fixture de migración: respaldo cifrado BÓVEDA con sobres v1 (metadatos en claro)
// Sirve para probar el flujo "¿Vienes de otro dispositivo?" y el blindaje v1→v2.
// Ejecutar: bun scripts/gen_migration_fixture.ts
// Salida: /home/z/my-project/qa/migration-backup-v1.json (frase: migro-otro-equipo-2026)

import { newVaultMaterial, encryptJSON, sha256Hex } from "../src/lib/crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const PHRASE = "migro-otro-equipo-2026";

const V1_MEMORIES = [
  {
    plain: {
      title: "Idiomas que hablo",
      content: "Hablo español nativo e inglés fluido; me defiendo en portugués.",
      tags: ["idioma", "perfil"],
      confidence: 100,
    },
    kind: "dato",
    source: "chatgpt",
    sourceRef: "Conversación de presentaciones",
    obtainedAt: "2026-06-10T15:30:00.000Z",
  },
  {
    plain: {
      title: "Prefiero respuestas directas",
      content: "Cuando me expliques algo, ve al grano y usa listas cortas.",
      tags: ["tono", "preferencia"],
      confidence: 90,
    },
    kind: "preferencia",
    source: "claude",
    sourceRef: "Sesión de trabajo semanal",
    obtainedAt: "2026-07-15T09:00:00.000Z",
  },
  {
    plain: {
      title: "Proyecto BÓVEDA",
      content: "Estoy construyendo una bóveda de memoria de IA con dueño, cifrada de extremo a extremo.",
      tags: ["proyecto"],
      confidence: 100,
    },
    kind: "proyecto",
    source: "manual",
    sourceRef: null,
    obtainedAt: "2026-08-20T12:00:00.000Z",
  },
];

async function main() {
  const mat = await newVaultMaterial(PHRASE);
  const envelopes: Array<Record<string, unknown>> = [];
  for (const m of V1_MEMORIES) {
    const sealed = await encryptJSON(mat.key, m.plain); // v1: solo el plain
    envelopes.push({
      ...sealed,
      kind: m.kind,
      source: m.source,
      sourceRef: m.sourceRef,
      obtainedAt: m.obtainedAt,
      contentHash: await sha256Hex(m.plain.content),
      imported: true,
      verified: false,
    });
  }
  const file = {
    format: "boveda.encrypted-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    count: envelopes.length,
    vault: { salt: mat.salt, verifier: mat.verifier, verifierIv: mat.verifierIv },
    payload: JSON.stringify(envelopes),
  };
  mkdirSync("/home/z/my-project/qa", { recursive: true });
  const out = "/home/z/my-project/qa/migration-backup-v1.json";
  writeFileSync(out, JSON.stringify(file, null, 2));
  console.log(`OK ${out} · frase: ${PHRASE} · ${envelopes.length} sobres v1`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
