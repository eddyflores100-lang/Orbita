// Fixture: memoria compartida boveda.encrypted-share para pruebas E2E.
// Ejecutar: bun scripts/gen_share_fixture.ts
// Frase de partage: regalo-secreto-2026

import { buildShareFile, shareFilename } from "../src/lib/share";
import { writeFileSync, mkdirSync } from "node:fs";
import type { MemoryItem } from "../src/lib/types";

const SHARE_PASS = "regalo-secreto-2026";

async function main() {
  const item: MemoryItem = {
    id: "shared-1",
    plain: {
      title: "Talla y preferencias de regalo",
      content: "Talla M en camisas, color favorito verde oliva; nada de rayas.",
      tags: ["preferencia", "regalo"],
      confidence: 90,
    },
    kind: "preferencia",
    source: "chatgpt",
    sourceRef: "Conversación de cumpleaños",
    obtainedAt: "2026-05-05T18:00:00.000Z",
    contentHash: null,
    imported: true,
    verified: false,
    sealed: false,
    createdAt: "2026-05-06T18:00:00.000Z",
    updatedAt: "2026-05-06T18:00:00.000Z",
  };
  const file = await buildShareFile(item, SHARE_PASS, "la frase del café de los viernes");
  mkdirSync("/home/z/my-project/qa", { recursive: true });
  const out = `/home/z/my-project/qa/${shareFilename(item)}`;
  writeFileSync(out, JSON.stringify(file, null, 2));
  console.log(`OK ${out} · frase de partage: ${SHARE_PASS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
