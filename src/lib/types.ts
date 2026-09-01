// BÓVEDA — tipos compartidos del cliente

import { AGENTS, type AgentDef } from "@/lib/agents";

/** Tipos de memoria (categoría funcional). */
export const KINDS = ["dato", "preferencia", "hecho", "proyecto"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  dato: "Dato personal",
  preferencia: "Preferencia",
  hecho: "Hecho / contexto",
  proyecto: "Proyecto",
};

/* Orígenes de procedencia: se generan del registro universal de agentes
   (src/lib/agents.ts) + los orígenes no-agente. Así añadir una IA nueva es
   una sola línea en el registro. */
const NON_AGENT_SOURCES = ["manual", "generic", "boveda-format", "demo"] as const;

export const SOURCES = [
  "manual",
  ...AGENTS.map((a) => a.id),
  "generic",
  "boveda-format",
  "demo",
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<Source, string> = {
  manual: "Escrito a mano",
  ...(Object.fromEntries(AGENTS.map((a) => [a.id, a.name])) as Record<string, string>),
  generic: "Otro agente",
  "boveda-format": "Formato BÓVEDA",
  demo: "Demostración",
} as Record<Source, string>;

/** Agentes ordenados por categoría para la UI de importación. */
export const AGENT_IDS: Source[] = AGENTS.map((a) => a.id);

/** True si el origen es un agente del registro. */
export function isAgentSource(s: string): s is Source {
  return AGENT_BY_ID_SAFE.has(s);
}

const AGENT_BY_ID_SAFE = new Set<string>(AGENTS.map((a) => a.id));

/** Definición de agente por origen (para badges con deep-link, etc.). */
export function agentDefOf(s: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === s);
}

export { NON_AGENT_SOURCES };

/** Contenido en claro de una memoria — solo existe en tu navegador. */
export interface MemoryPlain {
  title: string;
  content: string;
  tags: string[];
  confidence: number; // 0-100: confianza en que el dato sigue siendo válido
}

/** Memoria completa en el cliente: sobre (servidor) + contenido (solo local). */
export interface MemoryItem {
  id: string;
  plain: MemoryPlain;
  kind: Kind;
  source: Source;
  sourceRef: string | null;
  obtainedAt: string | null;
  contentHash: string | null;
  imported: boolean;
  verified: boolean;
  /** true = metadatos (tipo/origen/fechas/hash) DENTRO del ciphertext (sello v2). */
  sealed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Sello v2: TODO lo privado viaja dentro del cifrado.
 *  El servidor solo ve {ct, iv} + marcadores kind/source = "seal". */
export interface SealedMemory {
  v: 2;
  plain: MemoryPlain;
  kind: Kind;
  source: string;
  sourceRef: string | null;
  obtainedAt: string | null;
  contentHash: string | null;
  imported: boolean;
  verified: boolean;
}

/** Payload descifrado de una memoria compartida (boveda.encrypted-share). */
export interface SharePayload {
  plain: MemoryPlain;
  kind: Kind;
  source: string;
  sourceRef: string | null;
  obtainedAt: string | null;
}

/** Archivo de memoria compartida: cifrado con UNA FRASE PROPIA, distinta
 *  de la frase de la bóveda, para enviar un solo recuerdo a otra persona
 *  o a tu propia bóveda en otro dispositivo. */
export interface EncryptedShareFile {
  format: "boveda.encrypted-share";
  version: 1;
  createdAt: string;
  /** Cifrado AES-GCM del SharePayload con clave derivada de la frase de partage. */
  salt: string;
  ct: string;
  iv: string;
  /** Pista opcional para el receptor (nunca la frase). */
  hint?: string;
}

/** Sobre tal como lo guarda el servidor (sin contenido en claro). */
export interface MemoryEnvelope {
  id: string;
  ct: string;
  iv: string;
  kind: string;
  source: string;
  sourceRef: string | null;
  obtainedAt: string | null;
  contentHash: string | null;
  imported: boolean;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Ítem candidato tras parsear una importación (aún sin cifrar). */
export interface ImportCandidate {
  title: string;
  content: string;
  tags: string[];
  kind: Kind;
  source: Source;
  sourceRef: string | null;
  obtainedAt: string | null;
  selected: boolean;
}

/** Formato abierto de portabilidad BÓVEDA v0.1 */
export interface BovedaExport {
  format: "boveda.open-memory";
  version: "0.1";
  exportedAt: string;
  count: number;
  items: Array<{
    title: string;
    content: string;
    tags: string[];
    kind: Kind;
    confidence: number;
    source: string;
    obtainedAt: string | null;
    contentHash: string | null;
    importedAt: string;
  }>;
}
