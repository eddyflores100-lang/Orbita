#!/usr/bin/env python3
"""Fixtures de export multi-agente para QA de BÓVEDA."""
import json, zipfile, os

OUT = "/home/z/my-project/scripts/fixtures"
os.makedirs(OUT, exist_ok=True)

# ── 1. Export estilo Claude (zip con conversations.json + users.json) ──
claude_convs = [
    {
        "uuid": "c1",
        "name": "Preparación entrevista",
        "created_at": "2026-01-10T10:00:00Z",
        "updated_at": "2026-01-10T11:00:00Z",
        "chat_messages": [
            {"uuid": "m1", "sender": "human", "created_at": "2026-01-10T10:00:00Z",
             "text": "Hola, me llamo Sofía Marín y vivo en Bogotá. Trabajo en un banco como desarrolladora de productos.",
             "content": [{"type": "text", "text": "Hola, me llamo Sofía Marín y vivo en Bogotá. Trabajo en un banco como desarrolladora de productos."}]},
            {"uuid": "m2", "sender": "assistant", "created_at": "2026-01-10T10:01:00Z",
             "text": "Mucho gusto, Sofía. ¿En qué te ayudo con la entrevista?",
             "content": [{"type": "text", "text": "Mucho gusto, Sofía. ¿En qué te ayudo con la entrevista?"}]},
            {"uuid": "m3", "sender": "human", "created_at": "2026-01-10T10:02:00Z",
             "text": "Estoy aprendiendo Python para pasar a análisis de datos. Prefiero estudiar por la mañana temprano.",
             "content": [{"type": "text", "text": "Estoy aprendiendo Python para pasar a análisis de datos. Prefiero estudiar por la mañana temprano."}]},
        ],
    },
    {
        "uuid": "c2",
        "name": "Restricciones comida",
        "created_at": "2026-01-15T12:00:00Z",
        "updated_at": "2026-01-15T12:30:00Z",
        "chat_messages": [
            {"uuid": "m4", "sender": "human", "created_at": "2026-01-15T12:00:00Z",
             "text": "Dame ideas de almuerzo. Soy vegetariana y odio el cilantro.",
             "content": [{"type": "text", "text": "Dame ideas de almuerzo. Soy vegetariana y odio el cilantro."}]},
        ],
    },
]

claude_zip = os.path.join(OUT, "claude-export.zip")
with zipfile.ZipFile(claude_zip, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("users.json", json.dumps([{"email_address": "sofia@example.com"}]))
    z.writestr("conversations.json", json.dumps(claude_convs))
print("OK", claude_zip)

# ── 2. Gemini Takeout (MyActivity.json) ──
gemini_activity = [
    {"header": "Gemini Apps", "title": "Prompted Gemini: Voy a viajar con mi esposa a Perú en julio y quiero itinerary tranquilo",
     "time": "2026-02-01T15:00:00.000Z", "titleUrl": "https://g.co/gemini/x1"},
    {"header": "Gemini Apps", "title": "Prompted Gemini: Tengo 2 hijos pequeños, dame ideas de actividades en Cusco aptas para niños",
     "time": "2026-02-01T15:05:00.000Z", "titleUrl": "https://g.co/gemini/x2"},
    {"header": "Gemini Apps", "title": "Prompted Gemini: Mi objetivo es correr una maratón el próximo año, hazme un plan",
     "time": "2026-02-03T08:00:00.000Z", "titleUrl": "https://g.co/gemini/x3"},
]
gemini_json = os.path.join(OUT, "MyActivity.json")
with open(gemini_json, "w") as f:
    json.dump(gemini_activity, f, ensure_ascii=False, indent=1)
print("OK", gemini_json)

# ── 3. Export genérico estilo Grok/DeepSeek (conversations con messages/role) ──
grok_convs = [
    {
        "id": "g1",
        "title": "Ideas de negocio",
        "created_at": "2026-03-20T20:00:00Z",
        "messages": [
            {"role": "user", "content": "Trabajo en marketing pero estoy construyendo un micro-SaaS de facturación para freelancers.", "created_at": "2026-03-20T20:00:00Z"},
            {"role": "assistant", "content": "Interesante. ¿Qué problema principal quieres resolver?", "created_at": "2026-03-20T20:01:00Z"},
            {"role": "user", "content": "Mi zona horaria es UTC-5 y trabajo en las noches. Hablo español e inglés.", "created_at": "2026-03-20T20:02:00Z"},
        ],
    },
]
grok_json = os.path.join(OUT, "grok-conversations.json")
with open(grok_json, "w") as f:
    json.dump(grok_convs, f, ensure_ascii=False, indent=1)
print("OK", grok_json)
