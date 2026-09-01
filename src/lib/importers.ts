"use client";

// BÓVEDA — analizadores de importación multi-agente (100% cliente)
// Soporta exports de: ChatGPT, Claude, Gemini (Takeout), Grok, DeepSeek,
// Copilot, Perplexity, Le Chat — además de JSON suelto, texto pegado y
// formato abierto BÓVEDA. Detección automática por huella estructural.
// Nada se envía al servidor: el parseo ocurre íntegramente en el navegador.

import { unzipSync, strFromU8 } from "fflate";
import { detectAgentFromName } from "@/lib/agents";
import type { BovedaExport, ImportCandidate, Kind, Source } from "@/lib/types";

const MAX_JSON_BYTES = 64 * 1024 * 1024; // 64 MB por archivo

/* ── tipos de pipeline ── */

export interface ParsedMessage {
  role: "user" | "assistant";
  content: string;
  at: string | null;
}

export interface ParsedConversation {
  title: string;
  updatedAt: string | null;
  source: Source;
  messages: ParsedMessage[];
}

export interface SourceScan {
  detected: boolean;
  source: Source;
  /** recordatorios explícitos (memories.json, listas de memoria) */
  explicitMemories: ImportCandidate[];
  /** conversaciones completas listas para extracción local */
  conversations: ParsedConversation[];
  userMessages: number;
  filesScanned: string[];
  notes: string[];
}

/* ── utilidades ── */

function isoToDate(input: unknown): string | null {
  if (typeof input === "number") {
    const d = new Date(input * (input > 1e12 ? 1 : 1000)); // epoch s o ms
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof input !== "string" || !input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function guessKind(text: string): Kind {
  const t = text.toLowerCase();
  if (/prefiere|prefiero|le gusta|siempre quiere|tono|estilo|idioma/.test(t)) return "preferencia";
  if (/proyecto|trabajo en|está construyendo|estoy construyendo/.test(t)) return "proyecto";
  if (/llama|llamo|vive|edad|nació|trabaja como|estudia/.test(t)) return "dato";
  return "hecho";
}

function titleFrom(content: string, max = 64): string {
  const clean = content.replace(/\s+/g, " ").trim();
  const first = clean.split(/[.!?;](:?\s|$)/)[0] || clean;
  return first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
}

function normalize(text: string): string {
  return text
    .replace(/^["'«]|["'»]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : typeof (c as { text?: unknown })?.text === "string" ? ((c as { text: string }).text) : ""))
      .join("\n")
      .trim();
  }
  if (content && typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (Array.isArray(o.parts)) return contentToText(o.parts);
  }
  return "";
}

/** Elimina candidatos duplicados por contenido normalizado. */
export function dedupe(items: ImportCandidate[]): ImportCandidate[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.content.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Ya presente en la bóveda (por hash de contenido normalizado). */
function filterExisting(items: ImportCandidate[], existing: Set<string>): ImportCandidate[] {
  return items.filter((i) => {
    const k = i.content.toLowerCase().replace(/\s+/g, " ").trim();
    return !existing.has(k);
  });
}

/* ── 1. texto pegado (lista de memoria de cualquier asistente) ── */

export function parsePastedText(raw: string, source: Source = "chatgpt"): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = normalize(line.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, ""));
    if (t.length < 3 || t.length > 2000) continue;
    out.push({
      title: titleFrom(t),
      content: t,
      tags: [],
      kind: guessKind(t),
      source,
      sourceRef: "texto pegado",
      obtainedAt: new Date().toISOString(),
      selected: true,
    });
  }
  return out;
}

/* ── 2. recuerdos explícitos (arrays de memoria) ── */

function fromMemoryArray(arr: unknown[], source: Source, sourceRef: string): ImportCandidate[] {
  const out: ImportCandidate[] = [];
  for (const el of arr) {
    if (el == null) continue;
    if (typeof el === "string") {
      const t = normalize(el);
      if (t.length >= 3)
        out.push({
          title: titleFrom(t),
          content: t,
          tags: [],
          kind: guessKind(t),
          source,
          sourceRef,
          obtainedAt: null,
          selected: true,
        });
      continue;
    }
    if (typeof el === "object") {
      const o = el as Record<string, unknown>;
      const text = normalize(
        (typeof o.content === "string" && o.content) ||
          (typeof o.text === "string" && o.text) ||
          (typeof o.memory === "string" && o.memory) ||
          "",
      );
      if (text.length < 3) continue;
      out.push({
        title: titleFrom(text),
        content: text,
        tags: Array.isArray(o.tags) ? (o.tags as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 8) : [],
        kind: guessKind(text),
        source,
        sourceRef,
        obtainedAt: isoToDate(o.created_at ?? o.createdAt ?? o.date ?? o.created_time),
        selected: true,
      });
    }
  }
  return out;
}

/* ── 3. formato abierto BÓVEDA ── */

export function parseBovedaExport(data: BovedaExport): ImportCandidate[] {
  if (!Array.isArray(data.items)) return [];
  return data.items.map((it) => ({
    title: normalize(it.title || titleFrom(it.content)),
    content: normalize(it.content),
    tags: Array.isArray(it.tags) ? it.tags.slice(0, 8) : [],
    kind: (["dato", "preferencia", "hecho", "proyecto"].includes(it.kind) ? it.kind : "hecho") as Kind,
    source: "boveda-format" as Source,
    sourceRef: `export ${data.exportedAt?.slice(0, 10) ?? ""}`.trim(),
    obtainedAt: isoToDate(it.obtainedAt),
    selected: true,
  }));
}

export function parseJsonObject(data: unknown, fileName: string): ImportCandidate[] {
  if (data && typeof data === "object" && (data as BovedaExport).format === "boveda.open-memory") {
    return parseBovedaExport(data as BovedaExport);
  }
  if (Array.isArray(data)) return fromMemoryArray(data, "generic", fileName);
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["memories", "memory", "items", "facts"]) {
      if (Array.isArray(o[key])) return fromMemoryArray(o[key] as unknown[], "generic", fileName);
    }
  }
  return [];
}

/* ── 4. parsers de conversaciones por agente ── */

function parseChatGptConversations(data: unknown): { convs: ParsedConversation[]; msgs: number } {
  const convs: ParsedConversation[] = [];
  let msgs = 0;
  if (!Array.isArray(data)) return { convs, msgs };
  for (const c of data) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const mapping = o.mapping as Record<string, unknown> | undefined;
    if (!mapping || typeof mapping !== "object") continue;
    const nodes: { role: string; text: string; at: number | null }[] = [];
    for (const node of Object.values(mapping)) {
      const n = node as { message?: { author?: { role?: string }; content?: unknown; create_time?: number } };
      const msg = n?.message;
      if (!msg?.author?.role) continue;
      const role = msg.author.role;
      if (role !== "user" && role !== "assistant") continue;
      const text = contentToText(msg.content);
      if (!text.trim()) continue;
      nodes.push({ role, text, at: typeof msg.create_time === "number" ? msg.create_time : null });
    }
    nodes.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    convs.push({
      title: typeof o.title === "string" ? o.title : "sin título",
      updatedAt: isoToDate(o.update_time ?? o.create_time),
      source: "chatgpt",
      messages: nodes.map((n) => ({
        role: n.role as "user" | "assistant",
        content: n.text,
        at: n.at === null ? null : isoToDate(n.at),
      })),
    });
    msgs += nodes.length;
  }
  return { convs, msgs };
}

function parseClaudeConversations(data: unknown): { convs: ParsedConversation[]; msgs: number } {
  const convs: ParsedConversation[] = [];
  let msgs = 0;
  if (!Array.isArray(data)) return { convs, msgs };
  for (const c of data) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const chat = o.chat_messages;
    if (!Array.isArray(chat)) continue;
    const messages: ParsedMessage[] = [];
    for (const m of chat) {
      if (!m || typeof m !== "object") continue;
      const mm = m as Record<string, unknown>;
      const sender = mm.sender === "assistant" ? "assistant" : mm.sender === "human" ? "user" : null;
      if (!sender) continue;
      const text =
        typeof mm.text === "string" && mm.text.trim()
          ? mm.text
          : contentToText(mm.content);
      if (!text.trim()) continue;
      messages.push({ role: sender, content: text, at: isoToDate(mm.created_at) });
    }
    convs.push({
      title: typeof o.name === "string" ? o.name : "sin título",
      updatedAt: isoToDate(o.updated_at ?? o.created_at),
      source: "claude",
      messages,
    });
    msgs += messages.length;
  }
  return { convs, msgs };
}

function parseGenericConversations(data: unknown, fallbackSource: Source): { convs: ParsedConversation[]; msgs: number } {
  const convs: ParsedConversation[] = [];
  let msgs = 0;
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (
          (["conversations", "chats", "threads", "history"] as const)
            .map((k) => (data as Record<string, unknown>)[k])
            .find((v) => Array.isArray(v)) as unknown[] | undefined
        ) ?? []
      : [];
  for (const c of arr) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const rawMsgs =
      (["messages", "chat_messages", "history", "turns", "entries", "msgs"] as const)
        .map((k) => o[k])
        .find((v) => Array.isArray(v)) ?? null;
    if (!rawMsgs) continue;
    const messages: ParsedMessage[] = [];
    for (const m of rawMsgs) {
      if (!m || typeof m !== "object") continue;
      const mm = m as Record<string, unknown>;
      const rawRole = String(mm.role ?? mm.sender ?? mm.author ?? "").toLowerCase();
      const role = /assistant|bot|model|gpt|ai/.test(rawRole)
        ? "assistant"
        : /user|human|me|yo/.test(rawRole)
          ? "user"
          : null;
      if (!role) continue;
      const text = contentToText(mm.content ?? mm.text ?? mm.message);
      if (!text.trim()) continue;
      messages.push({
        role,
        content: text,
        at: isoToDate(mm.created_at ?? mm.createdAt ?? mm.timestamp ?? mm.create_time ?? mm.time),
      });
    }
    convs.push({
      title: typeof o.title === "string" ? o.title : typeof o.name === "string" ? o.name : "sin título",
      updatedAt: isoToDate(o.updated_at ?? o.update_time ?? o.created_at ?? o.create_time),
      source: fallbackSource,
      messages,
    });
    msgs += messages.length;
  }
  return { convs, msgs };
}

/** Gemini (Google Takeout, «Gemini Apps» MyActivity.json): cada entrada es un prompt. */
function parseGeminiActivity(data: unknown, source: Source): { convs: ParsedConversation[]; msgs: number } {
  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).items)
      ? ((data as Record<string, unknown>).items as unknown[])
      : [];
  const messages: ParsedMessage[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    let prompt = "";
    if (typeof o.title === "string") {
      prompt = o.title.replace(/^Prompted\s+[^:]*:?\s*/i, "").trim();
    }
    if (!prompt && Array.isArray(o.text)) {
      prompt = contentToText(o.text);
    }
    if (!prompt || prompt.length < 8) continue;
    messages.push({ role: "user", content: prompt, at: isoToDate(o.time) });
  }
  if (messages.length === 0) return { convs: [], msgs: 0 };
  return {
    convs: [
      {
        title: "Actividad de Gemini (Takeout)",
        updatedAt: null,
        source,
        messages,
      },
    ],
    msgs: messages.length,
  };
}

/** Export estilo pregunta/respuesta (Perplexity, búsquedas, QA pairs sueltos). */
function parseQaPairs(arr: unknown[], source: Source, sourceRef: string): { convs: ParsedConversation[]; msgs: number } {
  const messages: ParsedMessage[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const q =
      (typeof o.query_str === "string" && o.query_str) ||
      (typeof o.query === "string" && o.query) ||
      (typeof o.question === "string" && o.question) ||
      (typeof o.prompt === "string" && o.prompt) ||
      (typeof o.title === "string" && !o.messages ? o.title : "") ||
      "";
    const a =
      (typeof o.answer_str === "string" && o.answer_str) ||
      (typeof o.answer === "string" && o.answer) ||
      (typeof o.response === "string" && o.response) ||
      "";
    const at = isoToDate(o.created ?? o.created_at ?? o.timestamp ?? o.time);
    if (q && q.trim().length >= 4) messages.push({ role: "user", content: q.trim(), at });
    if (a && a.trim().length >= 4) messages.push({ role: "assistant", content: a.trim(), at });
  }
  if (messages.length === 0) return { convs: [], msgs: 0 };
  return {
    convs: [{ title: "Export Q&A", updatedAt: null, source, messages }],
    msgs: messages.length,
  };
}

/** NDJSON/JSONL (Claude Code, Gemini CLI, logs de sesión): un objeto JSON por línea. */
function parseNdjson(raw: string): unknown[] {
  const out: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("//")) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      /* línea corrupta: se salta */
    }
  }
  return out;
}

/** Convierte objetos NDJSON en mensajes si tienen forma user/assistant. */
function messagesFromLooseObjects(objs: unknown[]): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    const m = o as Record<string, unknown>;
    const inner = (m.message && typeof m.message === "object" ? m.message : m) as Record<string, unknown>;
    const rawRole = String(inner.role ?? inner.sender ?? inner.author ?? m.type ?? "").toLowerCase();
    if (!rawRole) continue;
    const role = /assistant|bot|model|ai|gpt/.test(rawRole)
      ? "assistant"
      : /user|human|me\b/.test(rawRole)
        ? "user"
        : null;
    if (!role) continue;
    const text = contentToText(inner.content ?? inner.text ?? inner.message ?? inner.parts);
    if (!text.trim()) continue;
    messages.push({ role, content: text, at: isoToDate(m.timestamp ?? m.created_at ?? m.createdAt ?? m.ts ?? m.time) });
  }
  return messages;
}

/* ── 4b. transcripciones pegadas (el caso «se me acabaron los tokens») ── */

const USER_TURN_RE =
  /^\s*(?:>\s*)?(?:\*\*)?\s*(tú|tu|yo|user|human|me|prompt|pregunta|question|q)\s*(?:\*\*)?\s*[:：»\-—]\s*/i;
const ASSISTANT_TURN_RE =
  /^\s*(?:>\s*)?(?:\*\*)?\s*(ia|agente|asistente|assistant|bot|modelo|model|answer|respuesta|a|claude|chatgpt|openai|gemini|google|grok|xai|copilot|deepseek|perplexity|poe|pi|kimi|qwen|glm|meta ai|llama|mistral|le chat|assistant s|ai)\s*(?:\*\*)?\s*[:：»\-—]\s*/i;

/**
 * Parsea una conversación pegada a mano desde CUALQUIER IA (ChatGPT, Claude,
 * Gemini, WhatsApp…) detectando los turnos «Tú: / Assistant:». Si el texto no
 * tiene marcadores de turno, devuelve null: entonces se trata como lista de
 * recuerdos línea a línea.
 */
export function parsePastedTranscript(
  raw: string,
  source: Source = "generic",
  title?: string,
): ParsedConversation | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const messages: ParsedMessage[] = [];
  let current: { role: "user" | "assistant"; parts: string[] } | null = null;
  let sawMarker = false;

  const flush = () => {
    if (current) {
      const content = current.parts.join("\n").trim();
      if (content) messages.push({ role: current.role, content, at: null });
    }
    current = null;
  };

  for (const line of lines) {
    const u = line.match(USER_TURN_RE);
    const a = line.match(ASSISTANT_TURN_RE);
    if (u) {
      flush();
      sawMarker = true;
      current = { role: "user", parts: [line.slice(u[0].length)] };
      continue;
    }
    if (a) {
      flush();
      sawMarker = true;
      current = { role: "assistant", parts: [line.slice(a[0].length)] };
      continue;
    }
    if (current) current.parts.push(line);
    // líneas sueltas antes del primer turno se descartan (saludos, cabeceras)
  }
  flush();

  if (!sawMarker || messages.length === 0) return null;
  const userCount = messages.filter((m) => m.role === "user").length;
  if (userCount === 0) return null; // solo hay texto del asistente: no es una conversación
  const firstUser = messages.find((m) => m.role === "user")!.content;
  const autoTitle =
    title ||
    (firstUser.split(/\n/)[0] ?? "").replace(/\s+/g, " ").slice(0, 70) ||
    "Conversación pegada";
  return {
    title: autoTitle,
    updatedAt: new Date().toISOString(),
    source,
    messages,
  };
}

/** Transcripción legible de una conversación (para guardarla completa). */
export function conversationToTranscript(conv: ParsedConversation, maxChars = 120_000): string {
  const head = `# ${conv.title}\n`;
  let body = "";
  for (const m of conv.messages) {
    const who = m.role === "user" ? "Tú" : "Agente";
    const at = m.at ? ` (${m.at.slice(0, 16).replace("T", " ")})` : "";
    const chunk = `\n${who}${at}:\n${m.content.trim()}\n`;
    if (body.length + chunk.length > maxChars - head.length - 80) {
      body += `\n[… conversación truncada por límite de tamaño — ${conv.messages.length} mensajes en total]\n`;
      break;
    }
    body += chunk;
  }
  return (head + body).slice(0, maxChars);
}

/**
 * Convierte conversaciones completas en candidatos: cada conversación se
 * conserva ÍNTEGRA como un recuerdo grande, lista para ser restaurada en una
 * IA nueva cuando se acaban los tokens (el caso de uso central de BÓVEDA).
 */
export function conversationsToCandidates(convs: ParsedConversation[]): ImportCandidate[] {
  return convs.map((c) => {
    const transcript = conversationToTranscript(c);
    return {
      title: `${c.title} — conversación completa (${c.messages.length} mensajes)`,
      content: transcript,
      tags: ["conversación", c.source],
      kind: "hecho" as Kind,
      source: c.source,
      sourceRef: c.title || "conversación",
      obtainedAt: c.updatedAt,
      selected: true,
    };
  });
}

/* ── 5. detección de huella ── */

function detectConversationShape(data: unknown): "chatgpt" | "claude" | "generic" | "gemini" | "qa" | null {
  if (!Array.isArray(data)) {
    if (data && typeof data === "object") {
      const o = data as Record<string, unknown>;
      if (Array.isArray(o.items) && o.items.some((x) => x && typeof x === "object" && "title" in (x as object))) {
        return "gemini";
      }
      for (const key of ["conversations", "chats", "threads"]) {
        if (Array.isArray(o[key])) return "generic";
      }
    }
    return null;
  }
  const first = data.find((x) => x && typeof x === "object");
  if (!first) return null;
  const o = first as Record<string, unknown>;
  if (o.mapping && typeof o.mapping === "object") return "chatgpt";
  if (Array.isArray(o.chat_messages)) return "claude";
  if (Array.isArray(o.messages) || Array.isArray(o.history)) return "generic";
  // pares pregunta/respuesta sin contenedor de mensajes (Perplexity, QA suelto)
  const hasQ = ["query_str", "query", "question", "prompt"].some((k) => typeof o[k] === "string");
  const hasA = ["answer_str", "answer", "response"].some((k) => typeof o[k] === "string");
  if (hasQ || hasA) return "qa";
  // array de entradas de actividad (title/time/titleUrl) → gemini
  if (typeof o.title === "string" && (o.time || o.titleUrl)) return "gemini";
  return null;
}

/* ── 6. escáner multi-agente ── */

export interface ScanResult extends SourceScan {
  /** true si el formato del export requiere que el usuario confirme el agente */
  needsSourceHint: boolean;
}

function emptyScan(): ScanResult {
  return {
    detected: false,
    source: "generic",
    explicitMemories: [],
    conversations: [],
    userMessages: 0,
    filesScanned: [],
    notes: [],
    needsSourceHint: false,
  };
}

function analyzeJson(name: string, data: unknown, scan: ScanResult): void {
  const base = name.split("/").pop() ?? name;

  // formato abierto BÓVEDA
  if (data && typeof data === "object" && (data as BovedaExport).format === "boveda.open-memory") {
    scan.explicitMemories.push(...parseBovedaExport(data as BovedaExport));
    scan.detected = true;
    scan.notes.push("Formato abierto BÓVEDA (roundtrip de portabilidad).");
    return;
  }

  // recuerdos explícitos por nombre de archivo
  if (/memor/i.test(base) && base.endsWith(".json")) {
    const arr = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).memories)
        ? ((data as Record<string, unknown>).memories as unknown[])
        : null;
    if (arr) {
      const src: Source = scan.source === "generic" ? "chatgpt" : scan.source;
      const parsed = fromMemoryArray(arr, src, base);
      if (parsed.length) {
        scan.explicitMemories.push(...parsed);
        scan.detected = true;
      }
      return;
    }
  }

  // perfil de usuario del export de ChatGPT
  if (base === "user.json" && data && typeof data === "object" && typeof (data as Record<string, unknown>).about === "string") {
    const about = normalize((data as Record<string, unknown>).about as string);
    if (about.length >= 3) {
      scan.explicitMemories.push({
        title: "Sobre mí (perfil del export)",
        content: about,
        tags: ["perfil"],
        kind: "dato",
        source: "chatgpt",
        sourceRef: "user.json",
        obtainedAt: null,
        selected: true,
      });
      scan.detected = true;
    }
    return;
  }

  // conversaciones por huella
  const shape = detectConversationShape(data);
  if (!shape) return;

  if (shape === "chatgpt") {
    const { convs, msgs } = parseChatGptConversations(data);
    if (convs.length) {
      scan.conversations.push(...convs);
      scan.userMessages += msgs;
      scan.source = scan.source === "generic" ? "chatgpt" : scan.source;
      scan.detected = true;
    }
  } else if (shape === "claude") {
    const { convs, msgs } = parseClaudeConversations(data);
    if (convs.length) {
      scan.conversations.push(...convs);
      scan.userMessages += msgs;
      scan.source = scan.source === "generic" ? "claude" : scan.source;
      scan.detected = true;
    }
  } else if (shape === "gemini") {
    const src = /gemini|bard/i.test(name) ? "gemini" : scan.source === "generic" ? "gemini" : scan.source;
    const { convs, msgs } = parseGeminiActivity(data, src);
    if (convs.length) {
      scan.conversations.push(...convs);
      scan.userMessages += msgs;
      scan.source = src;
      scan.detected = true;
      scan.notes.push("Takeout de Gemini: solo contiene tus prompts (la respuesta de Google no viene en el export).");
    }
  } else if (shape === "qa") {
    const arr = Array.isArray(data) ? data : [];
    const { convs, msgs } = parseQaPairs(arr, scan.source, base);
    if (convs.length) {
      scan.conversations.push(...convs);
      scan.userMessages += msgs;
      scan.detected = true;
      scan.notes.push("Export estilo pregunta/respuesta: cada entrada se guarda con su respuesta.");
      if (scan.source === "generic") scan.needsSourceHint = true;
    }
  } else {
    const { convs, msgs } = parseGenericConversations(data, scan.source);
    if (convs.length) {
      scan.conversations.push(...convs);
      scan.userMessages += msgs;
      scan.detected = true;
      if (scan.source === "generic") scan.needsSourceHint = true;
    }
  }
}

/** Extensiones de archivo que el escáner entiende. */
export const ACCEPTED_EXTENSIONS = ".zip,.json,.jsonl,.ndjson,.md,.markdown,.txt";

function scanTranscriptText(name: string, text: string, scan: ScanResult): void {
  const conv = parsePastedTranscript(text, scan.source, undefined);
  if (conv && conv.messages.length >= 2) {
    conv.title = conv.title === "Conversación pegada" ? (name.split("/").pop() ?? conv.title) : conv.title;
    scan.conversations.push(conv);
    scan.userMessages += conv.messages.filter((m) => m.role === "user").length;
    scan.detected = true;
    scan.notes.push("Transcripción con turnos detectados (Tú / Agente).");
    if (scan.source === "generic") scan.needsSourceHint = true;
  } else {
    scan.notes.push(
      "El texto no tiene turnos reconocibles (p. ej. «Tú: …» / «Assistant: …»). Usa «Pega una conversación completa» para indicar el agente.",
    );
  }
}

function scanNdjsonText(name: string, text: string, scan: ScanResult): void {
  const objs = parseNdjson(text);
  if (objs.length === 0) {
    scan.notes.push("El archivo .jsonl no contiene líneas JSON válidas.");
    return;
  }
  const messages = messagesFromLooseObjects(objs);
  if (messages.length >= 2) {
    scan.conversations.push({
      title: (name.split("/").pop() ?? "Sesión local").replace(/\.(jsonl|ndjson)$/i, ""),
      updatedAt: null,
      source: scan.source,
      messages,
    });
    scan.userMessages += messages.filter((m) => m.role === "user").length;
    scan.detected = true;
    scan.notes.push("Sesión local en NDJSON (estilo Claude Code / Gemini CLI).");
    if (scan.source === "generic") scan.needsSourceHint = true;
    return;
  }
  // ¿memoria explícita línea a línea?
  const mems = fromMemoryArray(objs, scan.source, name);
  if (mems.length) {
    scan.explicitMemories.push(...mems);
    scan.detected = true;
    return;
  }
  // ¿un único JSON multilínea pegado? (algunos exports .jsonl son un array)
  scan.notes.push("El .jsonl no contiene mensajes user/assistant reconocibles.");
}

/** Escanea un export (.zip, .json, .jsonl, .md, .txt) de cualquier agente y detecta su origen. */
export async function scanAgentExport(file: File, existingKeys: Set<string>): Promise<ScanResult> {
  const scan = emptyScan();
  const lowerName = file.name.toLowerCase();

  // pista de agente por nombre de archivo (antes de mirar el contenido)
  const hint = detectAgentFromName(file.name);
  if (hint) scan.source = hint.id as Source;

  if (lowerName.endsWith(".zip")) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
    } catch {
      throw new Error("No parece un .zip válido. Sube el archivo de export sin descomprimir.");
    }

    // pista de carpeta raíz (algunos exports agrupan por agente)
    const root = Object.keys(entries)[0]?.split("/")[0] ?? "";
    const rootHint = detectAgentFromName(root);
    if (rootHint) scan.source = rootHint.id as Source;

    for (const [name, bytes] of Object.entries(entries)) {
      const lower = name.toLowerCase();
      if (bytes.length > MAX_JSON_BYTES) continue;
      if (lower.endsWith(".json")) {
        scan.filesScanned.push(name);
        let data: unknown;
        try {
          data = JSON.parse(strFromU8(bytes));
        } catch {
          continue;
        }
        analyzeJson(name, data, scan);
      } else if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
        scan.filesScanned.push(name);
        scanNdjsonText(name, strFromU8(bytes), scan);
      } else if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
        // solo si el zip no trae nada mejor: los .md de aide/historiales cuentan
        scan.filesScanned.push(name);
        scanTranscriptText(name, strFromU8(bytes), scan);
      }
    }

    if (!scan.detected && scan.filesScanned.length > 0) {
      scan.notes.push("El .zip no contiene conversaciones ni memoria reconocible. ¿Es el export completo?");
    }
  } else if (lowerName.endsWith(".json")) {
    scan.filesScanned.push(file.name);
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error("El JSON no es válido.");
    }
    analyzeJson(file.name, data, scan);
  } else if (lowerName.endsWith(".jsonl") || lowerName.endsWith(".ndjson")) {
    scan.filesScanned.push(file.name);
    scanNdjsonText(file.name, await file.text(), scan);
  } else if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown") || lowerName.endsWith(".txt")) {
    scan.filesScanned.push(file.name);
    scanTranscriptText(file.name, await file.text(), scan);
  } else {
    throw new Error("Formato no soportado. Sube el .zip/.json del export, un .jsonl de sesión o un .md/.txt.");
  }

  scan.explicitMemories = filterExisting(dedupe(scan.explicitMemories), existingKeys);
  return scan;
}

/* ── claves de contenido ya presente en la bóveda ── */

export function existingContentKeys(memories: { plain: { content: string } }[]): Set<string> {
  return new Set(
    memories.map((m) => m.plain.content.toLowerCase().replace(/\s+/g, " ").trim()),
  );
}
