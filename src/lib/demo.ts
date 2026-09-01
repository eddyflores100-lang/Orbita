"use client";

// BÓVEDA — demostración multi-agente
// Conversaciones simuladas de 4 agentes distintos (Claude, Gemini, Grok y
// ChatGPT) en el MISMO formato que sus exports reales. El botón de demo las
// pasa por el extractor local de verdad: nada está pre-cocinado.

import type { ParsedConversation } from "@/lib/importers";

/** Conversaciones estilo export de Claude (chat_messages, sender human/assistant). */
const claudeConversations: ParsedConversation[] = [
  {
    title: "Plan de carrera y mudanza",
    updatedAt: "2026-02-11T13:00:00Z",
    source: "claude",
    messages: [
      {
        role: "user",
        content:
          "Hola Claude, me llamo Daniel Cabrera y estoy harto de que mi memoria viva repartida entre apps ajenas. Vivo en Quito, Ecuador, y trabajo como analista de datos en una fintech mediana.",
        at: "2026-02-11T12:58:00Z",
      },
      {
        role: "assistant",
        content: "Entiendo, Daniel. ¿Qué te gustaría cambiar primero?",
        at: "2026-02-11T12:59:00Z",
      },
      {
        role: "user",
        content:
          "Estoy aprendiendo Rust por las noches porque quiero pasar a infraestructura. Mi objetivo es certificarme antes de que acabe el año.",
        at: "2026-02-11T13:01:00Z",
      },
    ],
  },
  {
    title: "Cómo quiero que me responds",
    updatedAt: "2026-02-20T09:30:00Z",
    source: "claude",
    messages: [
      {
        role: "user",
        content:
          "Prefiero reuniones de 25 minutos con agenda escrita por adelantado. Con clientes uso un tono cercano pero sin emojis.",
        at: "2026-02-20T09:28:00Z",
      },
      {
        role: "assistant",
        content: "Anotado. ¿Algo más sobre tu estilo de trabajo?",
        at: "2026-02-20T09:29:00Z",
      },
      {
        role: "user",
        content: "Uso TypeScript y React a diario, y trabajo con Postgres en casi todos mis proyectos.",
        at: "2026-02-20T09:31:00Z",
      },
    ],
  },
];

/** Prompts sueltos estilo Takeout de Gemini (MyActivity.json). */
const geminiActivity: ParsedConversation = {
  title: "Actividad de Gemini (Takeout)",
  updatedAt: null,
  source: "gemini",
  messages: [
    {
      role: "user",
      content:
        "Necesito ideas de cena saludable para toda la semana, tengo en cuenta que soy alérgico al marisco y detesto el cilantro.",
      at: "2026-03-02T19:12:00Z",
    },
    {
      role: "user",
      content:
        "Estoy construyendo una bóveda personal de memoria con cifrado de extremo a extremo y necesito nombres buenos para el producto.",
      at: "2026-03-09T21:40:00Z",
    },
    {
      role: "user",
      content:
        "Mi cumpleaños es el 14 de marzo y quiero ideas para celebrarlo sin que sea una fiesta enorme.",
      at: "2026-03-10T10:05:00Z",
    },
  ],
};

/** Conversación estilo export genérico (Grok: messages con role). */
const grokConversations: ParsedConversation = {
  title: "Newsletter y horarios",
  updatedAt: "2026-04-14T23:55:00Z",
  source: "grok",
  messages: [
    {
      role: "user",
      content:
        "Mi zona horaria es UTC-5 y suelo escribir de noche. Tengo 2 hijos pequeños, así que mi bloque profundo es de 21:00 a 23:00.",
      at: "2026-04-14T23:50:00Z",
    },
    {
      role: "user",
      content:
        "Quiero lanzar una newsletter mensual sobre soberanía digital antes de octubre. Prefiero escribir en español neutro sin anglicismos.",
      at: "2026-04-14T23:53:00Z",
    },
  ],
};

/** Conversación estilo export de ChatGPT (mapping de nodos ya aplanado). */
const chatgptConversations: ParsedConversation = {
  title: "Viaje de aniversario",
  updatedAt: "2026-05-03T16:20:00Z",
  source: "chatgpt",
  messages: [
    {
      role: "user",
      content:
        "Mi pareja odia los vuelos largos y prefiere destinos cerca. Yo amo la montaña, así que pensábamos en los Andes del norte.",
      at: "2026-05-03T16:15:00Z",
    },
    {
      role: "user",
      content:
        "Mi correo es daniel@ultimocuello.com por si necesitas enviarme el itinerario completo.",
      at: "2026-05-03T16:18:00Z",
    },
  ],
};

export const demoConversations: ParsedConversation[] = [
  ...claudeConversations,
  geminiActivity,
  grokConversations,
  chatgptConversations,
];
