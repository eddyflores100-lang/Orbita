// Test unitario del extractor multi-agente BÓVEDA (bun run)
import { extractFromConversations } from "../src/lib/extract";
import type { ParsedConversation } from "../src/lib/importers";

const convs: ParsedConversation[] = [
  {
    title: "Preparación entrevista",
    updatedAt: null,
    source: "claude",
    messages: [
      {
        role: "user",
        content:
          "Hola, me llamo Sofía Marín y vivo en Bogotá. Trabajo en un banco como desarrolladora de productos.",
        at: null,
      },
      {
        role: "user",
        content:
          "Estoy aprendiendo Python para pasar a análisis de datos. Prefiero estudiar por la mañana temprano.",
        at: null,
      },
      { role: "user", content: "Dame ideas de almuerzo. Soy vegetariana y odio el cilantro.", at: null },
    ],
  },
  {
    title: "Takeout Gemini",
    updatedAt: null,
    source: "gemini",
    messages: [
      {
        role: "user",
        content: "Voy a viajar con mi esposa a Perú en julio y quiero itinerario tranquilo",
        at: null,
      },
      {
        role: "user",
        content: "Tengo 2 hijos pequeños, dame ideas de actividades en Cusco aptas para niños",
        at: null,
      },
      { role: "user", content: "Mi objetivo es correr una maratón el próximo año, hazme un plan", at: null },
    ],
  },
  {
    title: "Grok ideas",
    updatedAt: null,
    source: "grok",
    messages: [
      {
        role: "user",
        content:
          "Trabajo en marketing pero estoy construyendo un micro-SaaS de facturación para freelancers.",
        at: null,
      },
      { role: "user", content: "Mi zona horaria es UTC-5 y suelo escribir de noche. Hablo español e inglés.", at: null },
    ],
  },
  {
    title: "ChatGPT viaje",
    updatedAt: null,
    source: "chatgpt",
    messages: [
      {
        role: "user",
        content: "Mi pareja odia los vuelos largos y prefiere destinos cerca. Mi correo es sofia@banco.co",
        at: null,
      },
    ],
  },
];

const out = extractFromConversations(convs);
console.log(`TOTAL: ${out.length}\n`);
for (const c of out) {
  console.log(
    `[${c.source.padEnd(7)}] ${c.kind.padEnd(11)} sel=${c.selected ? "Y" : "n"}  "${c.content.slice(0, 70)}"  ← ${c.sourceRef}`,
  );
}
