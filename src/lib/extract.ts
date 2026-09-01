"use client";

// BÓVEDA — motor de extracción de recuerdos desde conversaciones (100% cliente)
// Escanea mensajes del usuario con patrones declarativos (ES/EN) y propone
// recuerdos candidatos. Nada sale del navegador: sin LLM, sin red, sin servidor.
// Este es el corazón de la promesa «servidor tonto»: la inteligencia es tuya.

import type { ImportCandidate, Kind, Source } from "@/lib/types";
import type { ParsedConversation } from "@/lib/importers";

/* ── límites anti-ruido ── */

const MAX_TOTAL = 240; // candidatos máximo por extracción
const MAX_PER_CONVERSATION = 12;
const MIN_SENTENCE = 15; // chars
const MAX_CONTENT = 260; // chars por recuerdo

/* ── patrones declarativos ──
   Cada patrón: id, regex (con un grupo capturador opcional), tipo, confianza y
   título base. Se evalúan en orden; la primera coincidencia por frase gana. */

interface Pattern {
  id: string;
  re: RegExp;
  kind: Kind;
  conf: number;
  title: string;
  /** confía en el grupo 1 para el contenido; si no, usa la frase completa */
  capture?: boolean;
  /** valida el valor capturado antes de aceptar */
  accept?: (v: string) => boolean;
  /** usa el título del patrón en vez de derivarlo del contenido */
  fixedTitle?: boolean;
}

const NO_CAPTURE: string[] = []; // (ayuda de tipos)

const PATTERNS: Pattern[] = [
  /* identidad básica */
  {
    id: "nombre",
    re: /\b(?:mi nombre es|me llamo|my name is|i'?m called)\s+([A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'’\-]+(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü'’\-]+){0,2})/,
    kind: "dato",
    conf: 0.95,
    title: "Nombre propio",
    capture: true,
    accept: (v) => v.trim().split(/\s+/).length <= 3,
  },
  {
    id: "edad",
    re: /\btengo\s+(\d{1,2})\s+a[ñn]os\b|\bi'?m\s+(\d{1,2})\s+years old\b/i,
    kind: "dato",
    conf: 0.9,
    title: "Edad",
  },
  {
    id: "cumple",
    re: /(?:mi cumplea[ñn]os es|my birthday is)\s+(?:el\s+)?([^.,;!?]{3,40})/i,
    kind: "dato",
    conf: 0.9,
    title: "Cumpleaños",
    capture: true,
  },
  {
    id: "correo",
    re: /(?:mi correo(?: electr[óo]nico)? es|mi email es|my email is)\s+([^\s,;!?"'«»]{5,80})/i,
    kind: "dato",
    conf: 0.95,
    title: "Correo de contacto",
    capture: true,
    fixedTitle: true,
  },
  {
    id: "telefono",
    re: /(?:mi tel[ée]fono es|my phone(?: number)? is)\s+([+\d][\d\s().\-]{5,25})/i,
    kind: "dato",
    conf: 0.95,
    title: "Teléfono de contacto",
    capture: true,
    fixedTitle: true,
  },

  /* localización e idioma */
  {
    id: "vivo",
    re: /(?:vivo en|estoy viviendo en|i live in|i'?m based in)\s+([^.,;!?]{3,60})/i,
    kind: "dato",
    conf: 0.9,
    title: "Dónde vive",
    capture: true,
    accept: (v) => !/un (piso|apartamento|lugar)|una casa/i.test(v),
  },
  {
    id: "idioma",
    re: /\b(?:hablo|i speak)\s+(?:en\s+)?(espa[ñn]ol|ingl[ée]s|franc[ée]s|alem[áa]n|portugu[ée]s|italiano|neerland[ée]s|chino(?: mandar[íi]n)?|japon[ée]s|coreano|ruso|[aá]rabe|gallego|catal[áa]n|euskera|quechua)\b/i,
    kind: "dato",
    conf: 0.8,
    title: "Idioma que habla",
  },
  {
    id: "zona",
    re: /\b(?:mi zona horaria (?:es\s+)?|estoy en )?(UTC[+\-]\d{1,2}|GMT[+\-]\d{1,2})\b/i,
    kind: "dato",
    conf: 0.8,
    title: "Zona horaria",
  },

  /* trabajo y proyectos */
  {
    id: "empresa",
    re: /\b(?:trabajo en|estoy trabajando en|i work at)\s+([^.,;!?]{2,60})/i,
    kind: "dato",
    conf: 0.8,
    title: "Dónde trabaja",
    capture: true,
    accept: (v) => !/^(un|una|el|la|los|las|mi|esto|este)\s/i.test(v.trim()) && !CLAUSAL_RE.test(v),
  },
  {
    id: "puesto",
    re: /(?:trabajo como|i work as)\s+([^.,;!?]{3,60})/i,
    kind: "dato",
    conf: 0.85,
    title: "A qué se dedica",
    capture: true,
    accept: (v) => !CLAUSAL_RE.test(v),
  },
  {
    id: "profesion",
    re: /\b(?:soy|i'?m|i am)\s+(?:un[as]?\s+)?(desarrollador[a]?[a-z]*|programador[a]?|ingenier[oa] de software|ingenier[oa]|dise[ñn]ador[a]?|ux\/ui|abogad[oa]|m[ée]dic[oa]|doctor[a]?|profesor[a]?|maestr[oa]|enfermer[oa]|periodista|consultor[a]?|emprendedor[a]?|fundador[a]?|cofundador[a]?|estudiante|freelancer|aut[óo]nom[oa]|psic[óo]log[oa]|arquitect[oa]|contador[a]?|economista|analista|data scientist|cient[íi]fic[oa] de datos|product manager|project manager|f[íi]sic[oa]|matem[áa]tic[oa]|bi[óo]log[oa]|m[úu]sic[oa]|escritor[a]?|fot[óo]graf[oa]|chef|enfermera)\b[^.,;!?]{0,50}/i,
    kind: "dato",
    conf: 0.8,
    title: "Profesión",
  },
  {
    id: "proyecto",
    re: /(?:estoy construyendo|estoy desarrollando|estoy creando|estoy haciendo|i'?m building|i'?m working on)\s+([^.,;!?]{4,90})/i,
    kind: "proyecto",
    conf: 0.9,
    title: "Proyecto en curso",
    capture: true,
    accept: (v) => v.trim().length > 4 && !CLAUSAL_RE.test(v),
  },
  {
    id: "startup",
    re: /(?:tengo|fund[ée]|dirijo|cre[ée])\s+(?:una\s+|un\s+)?(startup|empresa|agencia|estudio|ong|cooperativa)\s+(?:llamad[oa]\s+)?([^.,;!?]{2,50})/i,
    kind: "proyecto",
    conf: 0.85,
    title: "Empresa propia",
  },
  {
    id: "aprendiendo",
    re: /(?:estoy aprendiendo|i'?m learning|quiero aprender|me quiero aprender)\s+([^.,;!?]{3,60})/i,
    kind: "hecho",
    conf: 0.8,
    title: "Está aprendiendo",
    capture: true,
    accept: (v) => !CLAUSAL_RE.test(v),
  },
  {
    id: "herramienta",
    re: /\b(?:uso|utilizo|trabajo con|i use)\s+((?:typescript|javascript|python|rust|go|java|kotlin|swift|react|next\.?js|vue|svelte|angular|tailwind(?: ?css)?|prisma|postgres(?:ql)?|mysql|mongodb|docker|kubernetes|aws|gcp|azure|figma|notion|obsidian|vim|neovim|vs ?code|emacs|linux|ubuntu|macos)[^.,;!?]{0,60})/i,
    kind: "hecho",
    conf: 0.7,
    title: "Herramienta que usa",
    capture: true,
  },

  /* preferencias y estilo */
  {
    id: "prefiero",
    re: /(?:prefiero|i prefer)\s+([^.,;!?]{4,90})/i,
    kind: "preferencia",
    conf: 0.65,
    title: "Preferencia",
    capture: true,
  },
  {
    id: "gusta",
    re: /(?:me gusta[n]?|amo|encanta(?:n)?|i (?:really )?(?:like|love))\s+([^.,;!?]{4,80})/i,
    kind: "preferencia",
    conf: 0.6,
    title: "Le gusta",
    capture: true,
    accept: (v) => !/^(que|saber|pensar|como|cuando|si)\s/i.test(v.trim()),
  },
  {
    id: "nogusta",
    re: /(?:no me gusta[n]?|odio|detesto|no soporto|i (?:hate|dislike|can'?t stand))\s+([^.,;!?]{4,80})/i,
    kind: "preferencia",
    conf: 0.65,
    title: "No le gusta",
    capture: true,
  },
  {
    id: "tono",
    re: /(?:responde[m]?|contesta[m]?|escribe[m]?|habla[m]?)\s+(?:en|con)\s+(espa[ñn]ol neutro|tono (?:cercano|formal|informal|directo|t[ée]cnico)|sin emojis|sin anglicismos|may[úu]sculas|frases cortas)[^.,;!?]{0,40}/i,
    kind: "preferencia",
    conf: 0.75,
    title: "Estilo de comunicación",
  },

  /* salud y restricciones */
  {
    id: "alergia",
    re: /(?:soy al[ée]rgic[oa] (?:al|a los|a la|a las|a)\s+|i'?m allergic to\s+)([^.,;!?]{2,60})/i,
    kind: "dato",
    conf: 0.95,
    title: "Alergia",
    capture: true,
    fixedTitle: true,
  },
  {
    id: "dieta",
    re: /\b(?:soy|me volv[íi]|i'?m)\s+(vegetarian[oa]|vegano|vegana|celiac[oa]|intolerante a la lactosa|intolerante al gluten)\b/i,
    kind: "dato",
    conf: 0.9,
    title: "Dieta",
  },

  /* familia y metas */
  {
    id: "hijos",
    re: /\btengo\s+(\d{1,2})\s+(?:hijos|hijas|hijo|hija)\b|\bi have\s+(\d{1,2})\s+(?:kids|children)\b/i,
    kind: "hecho",
    conf: 0.9,
    title: "Familia",
  },
  {
    id: "pareja",
    re: /\bmi (esposa|marido|esposo|pareja|novia|novio)|\bmy (wife|husband|partner|girlfriend|boyfriend)\b/i,
    kind: "hecho",
    conf: 0.7,
    title: "Pareja",
  },
  {
    id: "objetivo",
    re: /(?:mi objetivo es|mi meta es|quiero lanzar|quiero lograr|my goal is)\s+([^.,;!?]{4,90})/i,
    kind: "hecho",
    conf: 0.7,
    title: "Objetivo personal",
    capture: true,
    accept: (v) => !CLAUSAL_RE.test(v),
  },
];

/* si el valor capturado se desborda hacia otra oración, no es un dato limpio */
const CLAUSAL_RE = /\s(?:pero|aunque|porque|además|también|ya que|así que)\s/i;

/* frases que casi nunca son datos personales (preguntas y comandos al asistente) */
const SKIP_RE =
  /^(?:c[óo]mo|qu[ée]|cu[áa]l|qu[ée] tal|por qu[ée]|d[óo]nde|cu[áa]ndo|qui[ée]n|puedes|podr[íi]as|dame|haz|hazme|escribe|genera|traduce|resume|expl[íi]came|cu[ée]ntame|ponme|busca|lista|dibuja|crea|mu[ée]strame|d[ée]jame|necesito que|ay[úu]dame|how|what|why|when|where|who|can you|could you|please|give me|write|generate|translate|summarize|explain|tell me|show me|help me|make me|create|draw|find)\b/i;

/* ── división de frases ── */

function splitSentences(text: string): string[] {
  return text
    .split(
      /(?:[\r\n]+|(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑÜ¿¡"'«(0-9])|;\s+|,\s+y\s+|,\s+pero\s+|\s+pero\s+|\s+y\s+(?=(?:vivo|viviendo|trabajo|trabajando|estudio|estudiando|soy|tengo|estoy|hablo|uso|utilizo|prefiero|odio|detesto|amo|quiero|aprendo|mi\b|mis\b)))/i,
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function cleanPhrase(s: string): string {
  return s
    .replace(/^[¿¡"'«(]+/, "")
    .replace(/["'»)]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capFirst(s: string): string {
  return s.length ? s[0].toLocaleUpperCase() + s.slice(1) : s;
}

function titleFrom(content: string, base: string, max = 60): string {
  const first = cleanPhrase(content).split(/[.!?;]/)[0] ?? base;
  const t = first.length > max ? first.slice(0, max - 1).trimEnd() + "…" : first;
  return capFirst(t.replace(/^[a-z]/, (c) => c.toLocaleUpperCase()));
}

/* ── extracción ── */

export interface ExtractOptions {
  maxTotal?: number;
  maxPerConversation?: number;
}

/** Extrae candidatos de recuerdo de una lista de conversaciones parseadas. */
export function extractFromConversations(
  conversations: ParsedConversation[],
  opts: ExtractOptions = {},
): ImportCandidate[] {
  const maxTotal = opts.maxTotal ?? MAX_TOTAL;
  const maxPerConv = opts.maxPerConversation ?? MAX_PER_CONVERSATION;
  const out: ImportCandidate[] = [];
  const seen = new Set<string>();

  for (const conv of conversations) {
    let perConv = 0;
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      if (perConv >= maxPerConv) break;

      for (const rawSentence of splitSentences(msg.content)) {
        if (perConv >= maxPerConv || out.length >= maxTotal) break;
        const sentence = cleanPhrase(rawSentence);
        if (sentence.length < MIN_SENTENCE || sentence.length > 320) continue;
        if (sentence.endsWith("?")) continue;
        if (SKIP_RE.test(sentence)) continue;

        for (const p of PATTERNS) {
          const m = sentence.match(p.re);
          if (!m) continue;

          let content = sentence;
          let fromCapture = false;
          if (p.capture && m[1]) {
            const v = cleanPhrase(m[1]);
            if (v.length < 3) continue;
            if (p.accept && !p.accept(v)) continue; // prueba el siguiente patrón
            content = capFirst(v);
            fromCapture = true;
          }
          // para patrones sin captura el contenido es la frase completa
          content = content.slice(0, MAX_CONTENT).trim();
          if (content.length < (fromCapture ? 3 : MIN_SENTENCE)) continue;

          const key = content.toLowerCase().replace(/\s+/g, " ").trim();
          if (seen.has(key)) break;
          seen.add(key);
          out.push({
            title: p.fixedTitle ? p.title : titleFrom(content, p.title),
            content,
            tags: [],
            kind: p.kind,
            source: conv.source,
            sourceRef: conv.title || "conversación sin título",
            obtainedAt: msg.at,
            selected: p.conf >= 0.7, // confianza media-alta preseleccionada
          });
          perConv++;
          break; // una sola regla por frase
        }
      }
    }
  }
  return out;
}

/** Estadísticas de una extracción para la UI. */
export function extractionStats(candidates: ImportCandidate[]) {
  const high = candidates.filter((c) => c.selected).length;
  const bySource = new Map<Source, number>();
  for (const c of candidates) bySource.set(c.source, (bySource.get(c.source) ?? 0) + 1);
  return { total: candidates.length, preselected: high, bySource };
}

// (NO_CAPTURE se mantiene para futuros patrones que ignoren captura)
void NO_CAPTURE;
