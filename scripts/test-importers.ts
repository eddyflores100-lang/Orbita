// Test unitario BÓVEDA v0.3 — parsers universales (bun run scripts/test-importers.ts)
import {
  parsePastedTranscript,
  conversationsToCandidates,
  conversationToTranscript,
  scanAgentExport,
} from "../src/lib/importers";
import { AGENTS } from "../src/lib/agents";
import { SOURCES, SOURCE_LABEL } from "../src/lib/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    console.error(`  FAIL ${name} ${extra}`);
  }
}

/* 1. registro consistente */
console.log("→ Registro universal de agentes");
check("31+ agentes", AGENTS.length >= 30, `got ${AGENTS.length}`);
check("labels completos", AGENTS.every((a) => typeof SOURCE_LABEL[a.id as keyof typeof SOURCE_LABEL] === "string"));
check("sin ids duplicados", new Set(AGENTS.map((a) => a.id)).size === AGENTS.length);
check("SOURCES incluye todos", AGENTS.every((a) => (SOURCES as readonly string[]).includes(a.id)));
check("destacados tienen url", AGENTS.filter((a) => a.category === "destacado").every((a) => !!a.url));

/* 2. transcript pegado */
console.log("→ Transcript pegado (caso tokens agotados)");
const tx = [
  "Tú: Necesito cerrar el informe del Q3 y me quedé sin tokens.",
  "Agente: Resumamos: el informe lleva 3 secciones y falta el anexo financiero.",
  "Tú: Mi correo es daniel@ejemplo.com y vivo en Quito.",
  "Agente: Anotado, continuaré con el anexo cuando vuelvas.",
].join("\n");
const conv = parsePastedTranscript(tx, "chatgpt");
check("detecta 4 turnos", conv?.messages.length === 4, `got ${conv?.messages.length}`);
check("2 del usuario", conv?.messages.filter((m) => m.role === "user").length === 2);
check("título del primer turno", !!conv && conv.title.includes("informe"));

const mdBold = "**User**: Hola, mi cumpleaños es el 14 de marzo.\n**Claude**: ¡Anotado!";
const conv2 = parsePastedTranscript(mdBold, "claude");
check("soporta **bold** y nombre de agente", conv2?.messages.length === 2);

const noTurns = "Hola\nEsto no tiene turnos\nSolo tres líneas";
check("sin turnos → null", parsePastedTranscript(noTurns) === null);

/* 3. conversación completa como recuerdo */
console.log("→ Guardar conversación completa");
const cands = conversationsToCandidates([conv!]);
check("1 candidato", cands.length === 1);
check("tag conversación", cands[0].tags.includes("conversación"));
check("transcript contiene turnos", cands[0].content.includes("Tú:") && cands[0].content.includes("Agente:"));
check("título con contador", cands[0].title.includes("4 mensajes"));
const txLong = Array.from({ length: 12000 }, (_, i) => (i % 2 ? `Agente: respuesta ${i}` : `Tú: pregunta ${i}`)).join("\n");
const big = parsePastedTranscript(txLong)!;
const bigTx = conversationToTranscript(big);
check("trunca a 120k", bigTx.length <= 120_000 && bigTx.includes("truncada"));

/* 4. escáner: fixtures reales escritos a disco temporal */
console.log("→ Escáner con fixtures (jsonl / qa / md)");
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "boveda-test-"));

// Claude Code NDJSON
const ndjson = [
  JSON.stringify({ type: "user", timestamp: 1767200000000, message: { role: "user", content: [{ type: "text", text: "Refactoriza el módulo de pagos, mi zona horaria es UTC-5" }] } }),
  JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Voy a revisar el módulo." }] } }),
  JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: "Uso TypeScript y Postgres." }] } }),
].join("\n");
const f1 = join(dir, "session-abc.jsonl");
writeFileSync(f1, ndjson);

// Q&A estilo Perplexity
const qa = [
  { query_str: "¿Qué incluir en un pitch de 3 minutos?", answer_str: "Problema, solución, mercado y equipo.", created: 1767200000000 },
  { question: "Nombre de mi startup", response: "Acme, según tus conversaciones previas." },
];
const f2 = join(dir, "perplexity-library.json");
writeFileSync(f2, JSON.stringify(qa));

// Markdown aide
const f3 = join(dir, "aider.chat.history.md");
writeFileSync(f3, "> Tú: arregla el test de login\n\n> Assistant: corregido, era un mock obsoleto.\n\n> Tú: gracias");

async function main() {
  const r1 = await scanAgentExport(new File([ndjson], "session-abc.jsonl"), new Set());
  check("jsonl detecta conversación", r1.detected && r1.conversations.length === 1, JSON.stringify(r1.notes));
  check("jsonl 3 mensajes", r1.conversations[0]?.messages.length === 3);

  const r2 = await scanAgentExport(new File([JSON.stringify(qa)], "perplexity-library.json"), new Set());
  check("qa detectado", r2.detected && r2.conversations.length === 1, JSON.stringify(r2.notes));
  check("qa 4 mensajes", r2.conversations[0]?.messages.length === 4);
  check("qa origen por nombre (perplexity)", r2.source === "perplexity" && r2.needsSourceHint === false, `got ${r2.source} hint=${r2.needsSourceHint}`);

  const r3 = await scanAgentExport(new File(["> Tú: arregla el test de login\n\n> Assistant: corregido.\n\n> Tú: gracias"], "aider.chat.history.md"), new Set());
  check("md detecta transcripción", r3.detected && r3.conversations.length === 1, JSON.stringify(r3.notes));
  check("md origen aider por nombre", r3.source === "aider", `got ${r3.source}`);

  rmSync(dir, { recursive: true, force: true });
  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
