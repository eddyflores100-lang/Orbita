// Test exportadores v0.3 (bun run scripts/test-exporters.ts)
import { buildExport, buildMarkdown, buildContinuationPack, buildZip } from "../src/lib/exporters";
import { unzipSync, strFromU8, strToU8 } from "fflate";
import type { MemoryItem } from "../src/lib/types";

const mk = (over: Partial<MemoryItem>): MemoryItem => ({
  id: "x",
  plain: { title: "t", content: "c", tags: [], confidence: 100 },
  kind: "hecho",
  source: "chatgpt",
  sourceRef: null,
  obtainedAt: null,
  contentHash: null,
  imported: false,
  verified: false,
  sealed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

const conv = mk({
  plain: {
    title: "Proyecto newsletter — conversación completa (6 mensajes)",
    content: "# Proyecto newsletter\n\nTú:\nse acabaron los tokens…\n\nAgente:\nresumen del avance…",
    tags: ["conversación", "claude"],
    confidence: 100,
  },
  kind: "hecho",
  source: "claude",
});

const prefs = mk({
  plain: { title: "Tono", content: "Prefiero español neutro sin emojis", tags: [], confidence: 100 },
  kind: "preferencia",
});

const mems = [conv, prefs];

let fail = 0;
const check = (n: string, c: boolean, extra?: string) => {
  console.log(c ? `  PASS ${n}` : `  FAIL ${n}${extra ? ` — ${extra}` : ""}`);
  if (!c) fail++;
};

console.log("→ ZIP comprimido");
const zip = buildZip(mems);
const buf = new Uint8Array(await zip.arrayBuffer());
const entries = unzipSync(buf);
const names = Object.keys(entries).sort();
const jsonTxt = JSON.stringify(buildExport(mems), null, 2);
const md = buildMarkdown(mems);
const pack = strFromU8(entries["paquete-continuacion.md"]);
const leeme = strFromU8(entries["LEEME.txt"]);

check("4 archivos", names.length === 4, names.join(","));
check("json presente", names.includes("boveda-open-memory.json"));
check("continuación presente", names.includes("paquete-continuacion.md"));
check("LEEME presente", names.includes("LEEME.txt"));
const raw = strToU8(jsonTxt).length + strToU8(md).length + strToU8(pack).length + strToU8(leeme).length;
check("comprime de verdad", buf.length < raw * 0.8, `zip=${buf.length} raw=${raw}`);

check("pack lista conversación", pack.includes("CONVERSACIONES COMPLETAS") && pack.includes("Proyecto newsletter"));
check("pack agrupa preferencias", pack.includes("CÓMO QUIERO QUE ME RESPONDAS") && pack.includes("español neutro"));
check("pack con instrucciones para la IA nueva", pack.includes("Instrucciones para ti"));
check("markdown legible", md.includes("Memoria personal") && md.includes("Proyecto newsletter"));

console.log(fail === 0 ? "\nRESULTADO: TODO PASS" : `\nRESULTADO: ${fail} FAIL`);
process.exit(fail ? 1 : 0);
