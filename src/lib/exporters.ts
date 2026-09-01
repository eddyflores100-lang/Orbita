"use client";

// BÓVEDA — exportadores de portabilidad (todo se genera en el cliente)

import { zipSync, strToU8 } from "fflate";
import { SOURCE_LABEL, type BovedaExport, type MemoryItem } from "@/lib/types";

/** Construye el documento del formato abierto boveda.open-memory v0.1 */
export function buildExport(memories: MemoryItem[]): BovedaExport {
  return {
    format: "boveda.open-memory",
    version: "0.1",
    exportedAt: new Date().toISOString(),
    count: memories.length,
    items: memories.map((m) => ({
      title: m.plain.title,
      content: m.plain.content,
      tags: m.plain.tags,
      kind: m.kind,
      confidence: m.plain.confidence,
      source: m.source,
      obtainedAt: m.obtainedAt,
      contentHash: m.contentHash,
      importedAt: m.createdAt,
    })),
  };
}

export function buildMarkdown(memories: MemoryItem[]): string {
  const lines: string[] = [
    `# Memoria personal — BÓVEDA`,
    "",
    `> Exportado el ${new Date().toLocaleString("es")} · ${memories.length} recuerdos`,
    "> Formato abierto: boveda.open-memory v0.1",
    "",
  ];
  const groups = new Map<string, MemoryItem[]>();
  for (const m of memories) {
    const arr = groups.get(m.kind) ?? [];
    arr.push(m);
    groups.set(m.kind, arr);
  }
  const kindTitles: Record<string, string> = {
    preferencia: "## Preferencias",
    dato: "## Datos personales",
    hecho: "## Hechos y contexto",
    proyecto: "## Proyectos",
  };
  for (const kind of ["preferencia", "dato", "hecho", "proyecto"]) {
    const arr = groups.get(kind);
    if (!arr || arr.length === 0) continue;
    lines.push(kindTitles[kind], "");
    for (const m of arr) {
      lines.push(`### ${m.plain.title}`);
      lines.push("", m.plain.content, "");
      const meta: string[] = [];
      if (m.plain.tags.length) meta.push(`etiquetas: ${m.plain.tags.join(", ")}`);
      if (m.obtainedAt) meta.push(`origen: ${m.source} (${new Date(m.obtainedAt).toLocaleDateString("es")})`);
      if (m.contentHash) meta.push(`sha256: \`${m.contentHash.slice(0, 16)}…\``);
      if (meta.length) lines.push(`*${meta.join(" · ")}*`, "");
    }
  }
  return lines.join("\n");
}

/** Dispara la descarga de un archivo generado en cliente. */
export function download(filename: string, content: string, mime: string) {
  downloadBlob(filename, new Blob([content], { type: mime }));
}

/** Descarga de blobs binarios (p. ej. el .zip comprimido). */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── paquete de continuación: tu contexto, listo para pegar en una IA nueva ── */

const KIND_HEADER: Record<string, string> = {
  preferencia: "CÓMO QUIERO QUE ME RESPONDAS (preferencias)",
  dato: "DATOS SOBRE MÍ",
  hecho: "CONTEXTO QUE DEBERÍAS RECORDAR",
  proyecto: "EN QUÉ ESTOY TRABAJANDO",
};

/**
 * El caso de uso «se acabaron los tokens»: un único documento en Markdown que
 * resume quién eres y qué estabas haciendo, pensado para pegar como PRIMER
 * mensaje en una conversación nueva — en la misma IA o en otra distinta.
 */
export function buildContinuationPack(memories: MemoryItem[]): string {
  const now = new Date().toLocaleString("es");
  const lines: string[] = [
    "# Mi contexto — continuación desde BÓVEDA",
    "",
    `> Paquete generado el ${now} con BÓVEDA (memoria personal verificada).`,
    "> Instrucciones para ti: este es mi contexto real, aprendido de conversaciones anteriores.",
    "> Tómalo como memoria previa de nuestra relación y respétalo en tus respuestas.",
    "> No lo repitas entero: solo confirma en una línea que lo has leído y continúa ayudándome.",
    "",
  ];
  for (const kind of ["dato", "preferencia", "hecho", "proyecto"] as const) {
    const arr = memories.filter((m) => m.kind === kind);
    if (arr.length === 0) continue;
    lines.push(`## ${KIND_HEADER[kind]}`, "");
    for (const m of arr) {
      const content = m.plain.content.replace(/\s+/g, " ").trim();
      lines.push(`- ${content}`);
      if (m.plain.tags.length) lines.push(`  *(etiquetas: ${m.plain.tags.join(", ")})*`);
    }
    lines.push("");
  }
  const convs = memories.filter((m) => m.plain.tags.includes("conversación"));
  if (convs.length) {
    lines.push("## CONVERSACIONES COMPLETAS QUE QUIERO CONTINUAR", "");
    for (const c of convs) {
      lines.push(`### ${c.plain.title}`, "", c.plain.content, "");
    }
  }
  lines.push(
    "---",
    "",
    `Memoria verificada: ${memories.filter((m) => m.verified).length}/${memories.length} recuerdos con procedencia registrada (BÓVEDA · boveda.open-memory).`,
    "",
  );
  return lines.join("\n");
}

/* ── export ZIP comprimido: todo, en un archivo pequeño ── */

/**
 * Genera el paquete portátil comprimido:
 *  - boveda-open-memory.json  (formato abierto con hashes y procedencia)
 *  - memoria-completa.md      (legible por humanos)
 *  - paquete-continuacion.md  (pegar en una IA nueva para restaurar contexto)
 *  - LEEME.txt                (instrucciones por agente)
 */
export function buildZip(memories: MemoryItem[]): Blob {
  const stamp = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(buildExport(memories), null, 2);
  const md = buildMarkdown(memories);
  const pack = buildContinuationPack(memories);
  const readme = [
    "BÓVEDA — paquete portátil de memoria personal",
    "===============================================",
    "",
    `Fecha: ${new Date().toLocaleString("es")}`,
    `Recuerdos incluidos: ${memories.length}`,
    "",
    "QUÉ HAY DENTRO",
    "--------------",
    "1. boveda-open-memory.json — formato abierto con procedencia y hash SHA-256",
    "   de cada recuerdo. Súbelo en otra instancia de BÓVEDA (pestaña Portabilidad)",
    "   y se reimporta con verificación de integridad.",
    "",
    "2. memoria-completa.md — tu memoria legible por humanos. Guárdalo, imprímelo,",
    "   ábrelo donde quieras.",
    "",
    "3. paquete-continuacion.md — EL ARCHIVO PARA CUANDO SE ACABAN LOS TOKENS:",
    "   pega su contenido como primer mensaje en una conversación nueva (en la",
    "   misma IA o en otra: ChatGPT, Claude, Gemini, Grok, DeepSeek, Qwen…)",
    "   y el nuevo agente retomará tu contexto al instante.",
    "",
    "4. Este LEEME.",
    "",
    "PRIVACIDAD",
    "----------",
    "Este paquete salió de TU navegador: se generó localmente y nadie más tiene",
    "una copia. Guárdalo con el mismo cuidado que tus llaves.",
    "",
    `Generado por BÓVEDA · boveda.open-memory v0.1 · ${stamp}`,
    "",
  ].join("\n");

  const zipped = zipSync(
    {
      "boveda-open-memory.json": strToU8(json),
      "memoria-completa.md": strToU8(md),
      "paquete-continuacion.md": strToU8(pack),
      "LEEME.txt": strToU8(readme),
    },
    { level: 6 }, // compresión balanceada: pequeño y rápido
  );
  return new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
}

/** Etiqueta legible para el nombre de archivo del pack por origen. */
export function sourceTagOf(m: MemoryItem): string {
  return SOURCE_LABEL[m.source] ?? m.source;
}
