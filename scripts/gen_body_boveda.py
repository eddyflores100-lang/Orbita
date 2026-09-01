# -*- coding: utf-8 -*-
"""
Informe profundo de producto - BOVEDA ("La memoria que es tuya, no del proveedor")
Ruta Report (ReportLab) - paleta fija Template 07 Crystal Blue (cuerpo claro).
Sin TOC (documento ejecutivo) -> SimpleDocTemplate + build().
"""
import os
import sys

PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
_scripts = os.path.join(PDF_SKILL_DIR, "scripts")
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (CondPageBreak, HRFlowable, Image, KeepTogether,
                                Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)
from PIL import Image as PILImage

# ------------------------------------------------------------------
# Fuentes (solo las permitidas)
# ------------------------------------------------------------------
FONT_DIR = "/usr/share/fonts"
pdfmetrics.registerFont(TTFont("FreeSerif", f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans", f"{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
registerFontFamily("FreeSerif", normal="FreeSerif", bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")
registerFontFamily("DejaVuSans", normal="DejaVuSans", bold="DejaVuSans")

from pdf import install_font_fallback  # noqa: E402
install_font_fallback()

# ------------------------------------------------------------------
# Paleta Crystal Blue (fija, Template 07 - cuerpo)
# ------------------------------------------------------------------
PAGE_BG      = colors.HexColor("#f5f8fc")
SECTION_BG   = colors.HexColor("#edf2f9")
CARD_BG      = colors.HexColor("#e4ecf5")
TABLE_STRIPE = colors.HexColor("#eef3fa")
HEADER_FILL  = colors.HexColor("#1a4a7a")
BORDER       = colors.HexColor("#c0d0e2")
ACCENT       = colors.HexColor("#2d7ab3")
TEXT_PRIMARY = colors.HexColor("#142840")
TEXT_MUTED   = colors.HexColor("#5a7a96")

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = TABLE_STRIPE

# ------------------------------------------------------------------
# Documento
# ------------------------------------------------------------------
OUT = "/home/z/my-project/scripts/body_boveda.pdf"
MARGIN = 0.9 * inch
TOP_M, BOT_M = 0.95 * inch, 0.85 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - TOP_M - BOT_M
H1_ORPHAN = AVAIL_H * 0.25

DOC_TITLE = "BOVEDA en profundidad — La memoria que es tuya"

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 0.55 * inch, DOC_TITLE)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - MARGIN, PAGE_H - 0.62 * inch)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 0.62 * inch, PAGE_W - MARGIN, 0.62 * inch)
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 0.45 * inch, "Análisis interno para el fundador · Agosto 2026")
    canvas.drawRightString(PAGE_W - MARGIN, 0.45 * inch, str(doc.page))
    canvas.restoreState()

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=TOP_M, bottomMargin=BOT_M,
    title="BOVEDA en profundidad — La memoria que es tuya",
    author="Z.ai", creator="Z.ai",
    subject="Analisis profundo del proyecto BOVEDA: competencia, hueco, producto, roadmap y validacion",
)

# ------------------------------------------------------------------
# Estilos
# ------------------------------------------------------------------
S_H1 = ParagraphStyle("H1", fontName="FreeSerif", fontSize=17, leading=22,
                      textColor=HEADER_FILL, spaceBefore=0, spaceAfter=4)
S_H2 = ParagraphStyle("H2", fontName="FreeSerif", fontSize=13, leading=18,
                      textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6)
S_BODY = ParagraphStyle("Body", fontName="FreeSerif", fontSize=10.5, leading=16.5,
                        textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=10)
S_LEAD = ParagraphStyle("Lead", parent=S_BODY, fontSize=11, leading=17.5,
                        textColor=TEXT_PRIMARY)
S_BULLET = ParagraphStyle("Bullet", parent=S_BODY, alignment=TA_LEFT,
                          leftIndent=16, bulletIndent=4, spaceAfter=7)
S_QUOTE = ParagraphStyle("Quote", fontName="FreeSerif-Italic", fontSize=11,
                         leading=17, textColor=HEADER_FILL, leftIndent=24,
                         spaceBefore=6, spaceAfter=12)
S_TH = ParagraphStyle("TH", fontName="FreeSerif", fontSize=9.3, leading=12.5,
                      textColor=colors.white, alignment=TA_LEFT)
S_TD = ParagraphStyle("TD", fontName="FreeSerif", fontSize=9.2, leading=13,
                      textColor=TEXT_PRIMARY, alignment=TA_LEFT)
S_TD_C = ParagraphStyle("TDc", parent=S_TD, alignment=TA_CENTER)
S_CAP = ParagraphStyle("Cap", fontName="FreeSerif", fontSize=8.5, leading=12,
                       textColor=TEXT_MUTED, alignment=TA_CENTER,
                       spaceBefore=3, spaceAfter=6)
S_STAT = ParagraphStyle("Stat", fontName="FreeSerif", fontSize=19, leading=23,
                        textColor=ACCENT, alignment=TA_CENTER)
S_STAT_L = ParagraphStyle("StatL", fontName="FreeSerif", fontSize=8.3, leading=11.5,
                          textColor=TEXT_MUTED, alignment=TA_CENTER)

story = []

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def safe_keep_together(elements):
    max_h = PAGE_H * 0.4
    total = 0
    for el in elements:
        _, h = el.wrap(AVAIL_W, PAGE_H)
        total += h
    if total <= max_h:
        return [KeepTogether(elements)]
    if len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)

def h1(num, text):
    head = Paragraph(f"<b>{num}. {text}</b>", S_H1)
    rule = HRFlowable(width="100%", color=ACCENT, thickness=1.2,
                      spaceBefore=2, spaceAfter=12)
    return [CondPageBreak(H1_ORPHAN), KeepTogether([head, rule])]

def nb(text):
    """Liga el guion largo a la palabra previa para que nunca abra linea."""
    return text.replace(" \u2014", "\u00a0\u2014")

def body(text, style=S_BODY):
    return Paragraph(nb(text), style)

def th(text):
    return Paragraph(f"<b>{nb(text)}</b>", S_TH)

def td(text, center=False):
    return Paragraph(nb(text), S_TD_C if center else S_TD)

def make_table(header, rows, ratios, caption=None, small_padding=False):
    assert abs(sum(ratios) - 1.0) < 0.01, "ratios deben sumar 1"
    widths = [r * AVAIL_W for r in ratios]
    assert sum(widths) <= AVAIL_W + 0.5
    data = [[th(h) for h in header]] + rows
    t = Table(data, colWidths=widths, hAlign="CENTER", repeatRows=1)
    pad = 4 if small_padding else 6
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 1 else TABLE_ROW_EVEN
        style.append(("BACKGROUND", (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style))
    out = [Spacer(1, 14), t]
    if caption:
        out += [Spacer(1, 4), Paragraph(nb(caption), S_CAP), Spacer(1, 10)]
    else:
        out += [Spacer(1, 14)]
    return out

def kpi_strip(items):
    cells, labels = [], []
    for big, small in items:
        cells.append(Paragraph(f"<b>{big}</b>", S_STAT))
        labels.append(Paragraph(small, S_STAT_L))
    w = AVAIL_W / len(items)
    t = Table([cells, labels], colWidths=[w] * len(items), hAlign="CENTER")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
        ("BOX", (0, 0), (-1, -1), 1, ACCENT),
        ("LINEBEFORE", (1, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return [Spacer(1, 8), t, Spacer(1, 14)]

def embed_image(path, max_width=None, max_height=270):
    if max_width is None:
        max_width = AVAIL_W
    img = PILImage.open(path)
    ow, oh = img.size
    ratio = min(max_width / ow, max_height / oh, 1.0)
    return Image(path, width=ow * ratio, height=oh * ratio)

def chart_block(path, caption, max_height=270):
    img = embed_image(path, max_height=max_height)
    return [Spacer(1, 18), KeepTogether([img, Spacer(1, 6), Paragraph(nb(caption), S_CAP)]),
            Spacer(1, 14)]

# ==================================================================
# 1. VEREDICTO EJECUTIVO
# ==================================================================
story += h1(1, "Veredicto ejecutivo")
story.append(body(
    "Este informe profundiza en <b>BÓVEDA</b>, la sexta idea del memorándum «Cuello de botella 2030»: "
    "<i>«La memoria que es tuya, no del proveedor»</i> —un almacén de memoria a largo plazo propiedad del "
    "usuario, portable entre agentes, con revelación granular y derecho al olvido de verdad. La conclusión "
    "anticipada es clara: de las siete ideas del memo, BÓVEDA es la que combina el <b>hueco competitivo más "
    "verificable</b> con la <b>validación externa más reciente</b>. Mientras la infraestructura de memoria para "
    "desarrolladores ya levantó más de 35 millones de dólares y la memoria nativa de ChatGPT, Claude y Gemini "
    "despegó en 2026, la capa que el memo describe —memoria de consumo propiedad del usuario, con control de "
    "revelación y portabilidad real— <b>no tiene un líder establecido</b>: solo tres o cuatro incipientes "
    "proyectos semilla y un corpus académico que le acaba de dar marco teórico.", S_LEAD))
story += kpi_strip([
    ("US$24M", "levantó Mem0, el líder de memoria dev-first (oct. 2025) — la capa rival más financiada"),
    ("52%", "de consumidores pagaría una prima media del 7% por transparencia de IA (Usercentrics, 2026)"),
    ("US$0", "financiación anunciada por los incumbentes en memoria consumer propiedad del usuario"),
])
story.append(body(
    "<b>Por qué BÓVEDA y no otra idea del memo.</b> Tres razones convergen. Primera, el conflicto de interés "
    "hace el espacio: las plataformas que hoy dominan la memoria de agentes tienen en esa memoria su foso "
    "competitivo y estructuralmente no pueden hacerla portable; un tercero neutral sí. Segunda, el viento "
    "regulatorio sopla a favor: la literatura jurídica de 2026 confirma que el GDPR no garantiza hoy la "
    "portabilidad de la memoria inferida de un agente, y los reguladores empiezan a exigir borrado efectivo "
    "sobre ella —exactamente el problema que BÓVEDA resuelve de raíz. Tercera, la demanda existe y es visible: "
    "usuarios avanzados piden públicamente memoria compartida entre asistentes, y los estudios de confianza "
    "digital muestran disposición a pagar por control. El memo lo formuló antes que Stanford, que arXiv y que "
    "los VCs lo escribieran; eso es una ventaja narrativa que conviene explotar ahora."))
story += make_table(
    ["Condición de éxito", "Semáforo", "Lectura (agosto 2026)"],
    [
        [td("Hueco competitivo real en la capa de consumo"),
         td("<b>Verde</b>", True),
         td("La infra dev-first está capitalizada (Mem0, Letta, Zep) y las plataformas recuerdan solo dentro de su jardín. La capa user-owned de consumo tiene incipientes semilla sin tracción visible: ventana abierta, no eterna.")],
        [td("Demanda del consumidor demostrada"),
         td("<b>Verde</b>", True),
         td("52% pagaría prima media del 7% por transparencia de IA; 86% declara importarle la privacidad de sus datos y 79% invertiría tiempo o dinero en protegerlos. Peticiones públicas de memoria compartida entre ChatGPT, Claude y Gemini en foros de usuarios.")],
        [td("Viento regulatorio a favor"),
         td("<b>Verde</b>", True),
         td("ICO (Reino Unido) exige desde inicios de 2026 que el borrado alcance la memoria de agentes; la doctrina confirma el vacío de portabilidad sobre memoria inferida. Un expediente user-owned anticipa la exigencia legal en lugar de perseguirla.")],
        [td("Riesgo de plataforma (existencial)"),
         td("<b>Rojo</b>", True),
         td("OpenAI, Anthropic o Google podrían lanzar su propia «memoria portable» o cerrar los exports de datos. Es el mayor riesgo del proyecto y dictamina la velocidad: la ventana estimada es de 12 a 18 meses.")],
    ],
    [0.30, 0.12, 0.58],
    caption="Tabla 1. Las cuatro condiciones de éxito de BÓVEDA, evaluadas con datos de agosto de 2026.")
story.append(body(
    "La recomendación operativa de este informe es construir BÓVEDA con una disciplina concreta: entrar por el "
    "<b>importador de memorias</b> («saca tus recuerdos de ChatGPT»), entregar un <b>momento de memoria "
    "asombrosa en la primera semana</b> —el propio memo marca este riesgo como el que mata al producto—, y "
    "someter el proyecto a tres revisiones go/no-go en los meses 4, 8 y 12. Las secciones siguientes "
    "sustentan esa recomendación con el panorama competitivo completo, la especificación de producto, la "
    "arquitectura del MVP, el modelo de negocio, el calendario y un plan de validación de 90 días que puede "
    "arrancar con menos de 150 dólares al mes."))

# ==================================================================
# 2. EL PROBLEMA EN PROFUNDIDAD
# ==================================================================
story += h1(2, "El problema en profundidad: amnesia y cautiverio")
story.append(body(
    "El memo lo resume en una frase: «la amnesia degrada cada relación con un agente». Cada vez que un "
    "usuario abre un asistente nuevo debe reexplicarse: quién es, a quién cuida, qué medicamentos toma, en qué "
    "gasta, qué teme, qué prefiere. Esa reinstalación ritual es fricción pura, y durante años fue también el "
    "precio de usar IA. Pero 2026 cambió el tablero: <b>el problema ya no es que la IA olvida, sino quién "
    "recuerda</b>. ChatGPT acumuló más de 10.000 hechos por usuario en su memoria persistente; Anthropic activó "
    "el 2 de marzo de 2026 memoria automática para todos los planes, sintetizando conversaciones cada 24 "
    "horas; y Gemini incorporó en ese mismo mes la importación de memoria y una capa de «inteligencia "
    "personal». La amnesia está en vías de cura —pero la cura tiene dueño."))
story.append(body(
    "El problema estructural es que la memoria se está convirtiendo en el <b>nuevo foso competitivo</b> de "
    "las plataformas. Cada asistente recuerda dentro de su propio jardín: la memoria que ChatGPT construyó "
    "sobre ti no viaja a Claude, ni la de Claude a Gemini, y cambiar de proveedor implica empezar de cero. "
    "Para el proveedor esto es racional: cuantos más recuerdos acumula, más caro es irse. El think tank New "
    "America lo formuló con precisión en noviembre de 2025: los protocolos de interoperabilidad pueden hacer "
    "a los agentes técnicamente portables, pero <i>«sin portabilidad del contexto, la interoperabilidad por "
    "sí sola no desmonta el foso»</i>. En otras palabras: MCP y A2A conectan herramientas, no identidades; "
    "nadie ha resuelto todavía que lo que un agente sabe de ti lo sepas tú —ni que lo decidas tú."))
story.append(body(
    "A la asimetría de poder se suma un vacío legal que la doctrina jurídica de 2026 ya describió: el "
    "derecho de portabilidad del artículo 20 del GDPR no alcanza con claridad a la <b>memoria inferida</b> de "
    "un agente —una revisión académica publicada en 2026 concluye que la portabilidad «no se extendería a la "
    "base de conocimiento del agente, incluso si sus inferencias y datos derivados constituyen datos "
    "personales»—. Paralelamente, el regulador británico (ICO) comenzó a exigir que los controles de borrado "
    "alcancen la memoria de los agentes, y el AI Act europeo añade capas de exposición para los sistemas "
    "agénticos. El desenlace es una paradoja conveniente para BÓVEDA: <b>la ley aún no obliga a las "
    "plataformas a dejarte ir con tus recuerdos, pero cada día exige más que sepan menos y borren mejor</b>. "
    "Un expediente que el usuario posee, cifra y administra resuelve de raíz lo que la regulación está "
    "empezando a pedir por partes: portabilidad, borrado y minimización en un mismo diseño."))
story.append(Paragraph(
    "«Tu expediente, tus reglas, tu candado.» — BÓVEDA, definición original del memorándum "
    "«Cuello de botella 2030»", S_QUOTE))

# ==================================================================
# 3. PANORAMA COMPETITIVO 2026
# ==================================================================
story += h1(3, "Panorama competitivo 2026: tres frentes y un vacío")
story.append(body(
    "La verificación en la red (agosto de 2026) muestra que el espacio de «memoria para agentes» se ha "
    "dividido en tres frentes con lógicas distintas. El primero es la <b>infraestructura dev-first</b>: "
    "empresas que venden memoria como servicio al desarrollador. El segundo es la <b>memoria nativa de "
    "plataformas</b>: ChatGPT, Claude y Gemini recordando dentro de sus ecosistemas. El tercero —el de "
    "BÓVEDA— es la <b>capa de consumo propiedad del usuario</b>: casi vacío, con solo incipientes semilla y "
    "sin financiación anunciada. Entender las fronteras entre los tres frentes es crítico, porque cada uno "
    "define contra qué NO competir y qué cliente no es el nuestro."))
story += make_table(
    ["Frente", "Jugadores y financiación", "Qué venden", "Por qué no es BÓVEDA"],
    [
        [td("<b>Infra dev-first</b> (B2B)"),
         td("Mem0: US$24M (seed+Serie A, oct. 2025; YC, Peak XV, Basis Set), 21 integraciones de frameworks, hasta 90% de ahorro en tokens. Letta/MemGPT: US$10M (2024), open source, 74% en LoCoMo con memoria de filesystem. Zep/Graphiti: US$0,5M seed, grafos de contexto sub-200 ms, SOC 2, Apache 2.0. Más Cognee, Supermemory y Potpie (US$2,2M pre-seed)."),
         td("Memoria como API para desarrolladores: extracción, consolidación y recuperación de hechos dentro de la app del cliente."),
         td("El cliente es la empresa, no el usuario. La memoria pertenece al sistema que la compra —el mismo lock-in con otro dueño. Competir aquí es pelear una guerra de benchmarks ya financiada.")],
        [td("<b>Memoria nativa</b> (plataformas)"),
         td("ChatGPT Memory (10.000+ hechos por usuario), Claude Chat Memory automático para todos los planes (mar. 2026), Gemini con importación de memoria (mar. 2026)."),
         td("Personalización dentro del propio ecosistema; retención como ventaja de permanencia."),
         td("Solo recuerdan en su jardín; exportar memoria no es su negocio sino su pesadilla. Son la amenaza existencial y, a la vez, el argumento de venta de BÓVEDA: nadie quiere un expediente que un solo proveedor puede leer y retener.")],
        [td("<b>Capa user-owned</b> (consumo)"),
         td("Egoist Machines (YC): «capa de contexto propiedad del usuario». Plurality.network: «una memoria, agentes infinitos» para 30+ modelos (jul. 2026). Personal.ai: modelo personal entrenado por el usuario (ángulo distinto: clon conversacional, no expediente). Sin financiación significativa anunciada en ninguno."),
         td("Memoria que pertenece a la persona y viaja entre asistentes."),
         td("Es el espacio de BÓVEDA. Los incipientes son pre-tracción y sin marca; el hueco sigue abierto pero ya está señalizado —la existencia de estos proyectos confirma la demanda y apura la ejecución.")],
    ],
    [0.15, 0.36, 0.21, 0.28],
    caption="Tabla 2. Los tres frentes del espacio de memoria para agentes (verificación propia, ago. 2026).")
story += chart_block("/home/z/my-project/scripts/chart_funding_boveda.png",
    "Figura 1. Financiación anunciada por jugador en memoria de agentes (US$ millones). La capa consumer "
    "propiedad del usuario —el espacio de BÓVEDA— registra cero capital de los incumbentes.", 200)
story.append(Paragraph("Lección de la década anterior: Solid y los pods", S_H2))
story.append(body(
    "No es la primera vez que alguien intenta darle al usuario la propiedad de sus datos. <b>Solid</b>, el "
    "protocolo de Tim Berners-Lee basado en pods personales (Inrupt y su Data Wallet incluidos), lleva casi "
    "una década proponiendo exactamente esa arquitectura —datos financieros, médicos y sociales en un "
    "almacén controlado por la persona— y nunca despegó en consumo masivo: la prensa técnica lo describió "
    "como «confuso» y la comunidad de desarrollo sigue pequeña. La lección para BÓVEDA es doble y dura. "
    "Primera: <b>la propiedad de datos no se vende sola</b>; es una causa ideológica, no un dolor cotidiano, "
    "y quien la venda así competirá contra el nicho más estrecho. Segunda: el producto debe ganar por "
    "<b>utilidad asombrosa inmediata</b> —que el expediente recuerde algo que cambia tu día en la primera "
    "semana— y dejar que la propiedad sea la consecuencia, no el eslogan. El propio memo registró este "
    "riesgo en su ficha: «hace falta un momento de memoria asombrosa en la primera semana o nadie se "
    "queda». Esa frase define el estándar de diseño de todo lo que sigue."))

# ==================================================================
# 4. EL HUECO LIBRE Y EL POSICIONAMIENTO
# ==================================================================
story += h1(4, "El hueco libre y el posicionamiento de BÓVEDA")
story.append(body(
    "Del panorama anterior se derivan dos prohibiciones estratégicas y una afirmación. La primera "
    "prohibición: <b>no competir en infra dev-first</b>. Mem0 y compañía levantaron más de US$35M, la guerra "
    "de benchmarks (LoCoMo y derivados) está politizada —Mem0 publicó comparativas que Letta y Zep desmintieron "
    "públicamente— y el comprador B2B ya tiene lista corta. La segunda: <b>no lanzar «otro estándar de "
    "papel»</b>. El espacio de especificaciones está fragmentado —el Universal Memory Protocol (UMP) es un "
    "repositorio individual en GitHub, el Agent Memory Protocol (AMP) nació como propuesta comunitaria en "
    "Reddit, y en 2026 aparecieron dos propuestas académicas formales: el «Unified Human Context Protocol» "
    "del Stanford Digital Economy Lab (marzo) y el protocolo de «Portable Agent Memory» con procedencia en "
    "arXiv (mayo)—. Ninguna de las cuatro tiene implementación de referencia dominante; en protocolos, el "
    "papel no gana: ganan las implementaciones que la gente usa."))
story += make_table(
    ["Especificación existente", "Origen", "Qué define", "Qué le falta"],
    [
        [td("<b>UMP</b> (Universal Memory Protocol)"),
         td("Desarrollador individual, GitHub (jul. 2026)"),
         td("Esquema de memoria portable entre sesiones, agentes y proveedores."),
         td("Adopción, gobernanza, modelo de seguridad y una app que lo haga tangible.")],
        [td("<b>AMP</b> (Agent Memory Protocol)"),
         td("Propuesta comunitaria sobre MCP (r/mcp)"),
         td("Interfaz estandarizada de memoria persistente para agentes MCP."),
         td("Capa de identidad, permisos de usuario y control de revelación granular.")],
        [td("<b>UHCP</b> (Unified Human Context Protocol)"),
         td("Stanford Digital Economy Lab (mar. 2026)"),
         td("Marco teórico de memoria personal portable y persistente gobernada por el usuario."),
         td("Implementación productiva; es un paper, no software.")],
        [td("<b>Portable Agent Memory</b>"),
         td("arXiv (may. 2026)"),
         td("Protocolo de procedencia: completa la capa MCP (herramientas) + A2A (coordinación) con memoria."),
         td("Referencia runnable y un negocio que lo sostenga; define provenance, no consumo.")],
    ],
    [0.24, 0.20, 0.28, 0.28],
    caption="Tabla 3. Las cuatro especificaciones de memoria portable en juego y sus carencias. "
            "Ninguna combina implementación, consumo y control de usuario.")
story.append(body(
    "<b>El posicionamiento correcto</b> ocupa el vacío que ninguna especificación ni jugador cubre: un "
    "<b>producto de consumo</b> que combine las tres cosas que nadie junta todavía —(1) propiedad y cifrado "
    "del usuario extremo a extremo, (2) revelación granular por agente, y (3) portabilidad real entre "
    "asistentes— y que además sea la <b>implementación de referencia</b> de la especificación abierta. Esa "
    "fórmula es la que convirtió a MCP en estándar de facto: Anthropic no hizo lobby por un paper, lo "
    "embarcó en Claude Desktop y publicó el SDK. BÓVEDA debe jugar la misma partida: la app es la bandera, "
    "el protocolo es el ejército. El cliente inicial no es la empresa (eso es Mem0) ni el desarrollador "
    "primero (eso sería otra infra), sino el <b>usuario avanzado multi-modelo</b> que hoy paga tres "
    "suscripciones a tres asistentes que no se hablan: siente el dolor semanalmente, es early adopter por "
    "definición y vocaliza su frustración en público —los hilos pidiendo «memoria compartida entre ChatGPT, "
    "Claude y Gemini» son la propaganda del problema. El relato de marca se deriva solo: BÓVEDA no compite "
    "por tu atención como otro asistente; es la capa que vive debajo de todos ellos. El antídoto al "
    "cautiverio no es otro jardín: es el expediente que viaja contigo."))
# ==================================================================
# 5. PRODUCTO: BOVEDA EN DETALLE
# ==================================================================
story += h1(5, "Producto: BÓVEDA en detalle")
story.append(body(
    "La ficha original del memo define BÓVEDA con tres formas concretas: un expediente personal cifrado que "
    "viaja contigo, perfiles de revelación donde cada agente ve solo lo que tú decides, y caducidad "
    "automática de los recuerdos. Son una buena columna vertebral, pero por sí solas describen controles de "
    "privacidad —la lección Solid demuestra que los controles no venden. Esta sección las convierte en "
    "especificación de producto añadiendo un cuarto pilar que les da utilidad percibida: la <b>procedencia</b>. "
    "El objetivo de diseño es que BÓVEDA no se sienta como «un gestor de permisos» sino como <b>una memoria "
    "que se nota</b>: el MVP original del memo —«un asistente que recuerda lo que tu médico, tu banco y tu "
    "abogado ya saben de ti, con tu permiso»— sigue siendo la mejor promesa de demo que nadie ha construido "
    "aún para el consumidor."))
story += make_table(
    ["Pilar", "Qué es exactamente", "Qué lo hace distinto hoy"],
    [
        [td("<b>1. Expediente cifrado</b><br/>que viaja contigo"),
         td("Memoria descompuesta en hechos atómicos (sujeto, atributo, valor, fecha) cifrados extremo a extremo en el dispositivo del usuario; el servidor solo almacena blobs ilegibles. Exportable e importable sin permiso de nadie."),
         td("Ningún producto consumer ofrece memoria E2E; la de las plataformas vive en texto plano en su infraestructura y no se exporta. Mem0/Zep cifran en reposo, pero con llave del operador.")],
        [td("<b>2. Perfiles de revelación</b><br/>por agente"),
         td("Cada aplicación o agente recibe un perfil con alcances (tema, categoría, frescura) que el usuario edita en lenguaje natural: «mi agente médico ve salud y medicación, nunca finanzas; el agente de viajes ve calendario y preferencias»."),
         td("Hoy el control existe solo en todo-o-nada (borrar memoria completa). El modelo de OAuth de permisos por app trasladado a memoria personal no lo ofrece ningún jugador, ni siquiera los incipientes.")],
        [td("<b>3. Caducidad automática</b><br/>por categoría"),
         td("Cada hecho lleva tiempo de vida por defecto según su categoría (una preferencia efímera caduca en meses; un antecedente médico persiste hasta que tú lo borres), con avisos y papelera de revisión."),
         td("El «derecho al olvido» actual es un formulario legal con semanas de espera. Aquí el olvido es el estado por defecto del sistema, no una petición que el usuario deba reclamar.")],
        [td("<b>4. Procedencia</b><br/>de cada recuerdo"),
         td("Cada hecho registra su fuente (qué conversación, qué documento, qué agente lo afirmó) y su fecha, permitiendo al humano auditar, corregir o desmentir la memoria —y evitando que un agente «confirme» un recuerdo falso."),
         td("Ninguna memoria nativa muestra de dónde salió cada recuerdo; es la causa de los fallos de personalización que los usuarios reportan. El paper de arXiv (may. 2026) lo formaliza; nadie lo ha embarcado en consumo.")],
    ],
    [0.20, 0.42, 0.38],
    caption="Tabla 4. Los tres pilares del memo, convertidos en especificación, más el cuarto pilar añadido: procedencia.")
story.append(body(
    "El cuarto pilar no es un adorno técnico: es el que conecta BÓVEDA con el resto del universo del memo. "
    "La procedencia convierte el expediente en algo verificable —cada recuerdo lleva su recibo—, lo que "
    "anticipa el lenguaje de SELLO (procedencia firmada) y TESTIGO (atestiguación), y prepara la respuesta a "
    "la pregunta regulatoria de quién responde cuando un agente actúa sobre un recuerdo erróneo. Además "
    "resuelve el riesgo de calidad que plaga las memorias actuales: los foros están llenos de usuarios que "
    "no logran que ChatGPT «olvide» hechos incorrectos ni corrige recuerdos mal inferidos. En BÓVEDA, "
    "<b>la memoria es editable por diseño</b>: el humano es el editor jefe de su expediente, no un objeto "
    "del que la plataforma guarda notas."))

# ==================================================================
# 6. ARQUITECTURA DEL MVP
# ==================================================================
story += h1(6, "Arquitectura del MVP")
story.append(body(
    "La arquitectura sigue un principio simple que abarata operación y refuerza la promesa de privacidad: "
    "<b>cliente pesado, servidor tonto</b>. Todo lo sensible —cifrado, decisión de permisos, cumplimiento de "
    "caducidad— ocurre en el dispositivo del usuario; el backend solo hace de buzón cifrado y relé de "
    "sincronización. Esto permite arrancar sin equipo de seguridad dedicado, reduce el coste marginal por "
    "usuario casi a cero (el almacenamiento lo aporta el propio usuario: iCloud, Google Drive o un pod "
    "Solid si existe) y convierte el argumento comercial en verificable: el código cliente puede ser open "
    "source y auditado. La tabla descompone los cinco componentes del MVP, su tecnología sugerida y la fase "
    "del roadmap en que se construyen."))
story += make_table(
    ["Componente", "Qué hace", "Tecnología sugerida", "Fase"],
    [
        [td("<b>Vault local cifrado</b>"),
         td("Base de datos de hechos atómicos en el dispositivo; cifrado XChaCha20-Poly1305 con clave protegida por passkey/biometría; export/import de archivo único."),
         td("SQLite + SQLCipher o libsodium; cliente React Native (iOS/Android) con core en Rust/WASM reutilizable."),
         td("F1")],
        [td("<b>Conectores de importación</b>"),
         td("Ingesta del export de datos de ChatGPT (descarga GDPR), historiales de Claude y Gemini, y archivos sueltos (PDF, notas); extracción de hechos atómicos con deduplicación."),
         td("Parsers locales + LLM por API para extraer hechos; cola de revisión humana antes de confirmar cada hecho."),
         td("F1")],
        [td("<b>Motor de revelación</b>"),
         td("Perfiles por agente con alcances por tema/categoría/frescura; cada consulta de un agente se evalúa localmente contra los permisos; registro de auditoría de qué se reveló y cuándo."),
         td("Policy engine embebido (OPA/cedar-like o reglas propias); UI de perfiles en lenguaje natural con confirmación explícita."),
         td("F3")],
        [td("<b>Sincronización multi-dispositivo</b>"),
         td("Réplica cifrada entre dispositivos del usuario vía almacenamiento BYO (iCloud/S3/pod); resolución de conflictos sin servidor que lea contenido."),
         td("CRDTs (Automerge/Yjs) sobre blob store cifrado; el servidor solo ve bloques y metadatos mínimos."),
         td("F3")],
        [td("<b>SDK / protocolo abierto</b>"),
         td("Servidor MCP local que expone la memoria a cualquier agente compatible con alcances del perfil activo; esquema de hechos documentado y versionado público."),
         td("MCP server (TypeScript) + spec open source; contribución de vuelta a UMP/AMP para consolidar estándar."),
         td("F3-F4")],
    ],
    [0.19, 0.34, 0.33, 0.14],
    caption="Tabla 5. Componentes del MVP, tecnología sugerida y fase del roadmap en que se construyen.")
story.append(body(
    "Dos decisiones de diseño merecen subrayarse. La primera: <b>el importador es parte de la arquitectura, "
    "no un accesorio</b> —resolver la ingesta de los exports GDPR de las plataformas es lo que convierte la "
    "instalación en un expediente lleno desde el día uno, y por tanto es la pieza que mata el cold start "
    "(sección 7). La segunda: el SDK habla <b>MCP nativo</b> en lugar de inventar otra capa: los agentes que "
    "ya entienden MCP pueden conectarse a BÓVEDA casi sin trabajo, y la diferencia competitiva no está en el "
    "cable sino en la política de revelación que BÓVEDA aplica localmente antes de responder. Eso posiciona "
    "al proyecto como «la capa que le faltaba a MCP», coherente con la lectura de New America y con los "
    "papers de 2026 que sitúan la memoria como el tercer protocolo después de herramientas y coordinación."))

# ==================================================================
# 7. GO-TO-MARKET Y MODELO DE NEGOCIO
# ==================================================================
story += h1(7, "Go-to-market y modelo de negocio")
story.append(body(
    "El gancho de entrada recomendado es el <b>importador como producto</b>: «Saca tus recuerdos de "
    "ChatGPT». Es una promesa que se entiende en una línea, se ejecuta en minutos, produce un artefacto "
    "visible (tu expediente, navegable, tuyo) y lleva implícita una declaración de independencia que la "
    "gente comparte por sí sola. Resuelve tres problemas a la vez: el cold start (el expediente nace "
    "lleno), la adquisición (cada exportación es una historia publicable) y el posicionamiento (nadie más "
    "está diciendo esto al consumidor). El canal orgánico más barato son los <b>power users multi-modelo</b>: "
    "los que ya pagan tres suscripciones y debaten memoria compartida en Reddit y foros de ChatGPT Pro. Son "
    "fáciles de encontrar, doloridos y vocales; 25 de ellos entrevistados en profundidad valen más que "
    "cualquier campaña. El sitio del memo —publicable en seis semanas según el Plan A del informe "
    "anterior— es el top-of-funnel natural: el contenido ya argumenta el problema; BÓVEDA es la respuesta "
    "que ese contenido debe terminar señalando."))
story.append(Paragraph("Estructura de precios", S_H2))
story.append(body(
    "El modelo debe honrar la promesa central del memo: <b>aquí el usuario es el cliente, no el producto</b>. "
    "Eso excluye publicidad y monetización de datos —y conviene declararlo en el propio producto, porque es "
    "diferenciador medible: el 52% de los consumidores pagaría prima por transparencia, y un modelo sin "
    "conflicto de interés es la forma más sólida de transparencia. La estructura recomendada: <b>Gratis</b> "
    "(expediente en un dispositivo, importador, revelación básica todo-o-nada) como motor de adquisición; "
    "<b>Pro a US$8/mes</b> (sincronización multi-dispositivo, perfiles de revelación granulares, caducidad "
    "por categoría, export completo, historial de auditoría) como núcleo de ingresos; y <b>API para "
    "desarrolladores</b> con capa gratuita y reparto de ingresos cuando una app de terceros consume memoria "
    "con consentimiento explícito del usuario —la vía que convierte la red de terceros en canal de "
    "distribución en vez de competidor. El benchmark de disposición a pagar es realista: la prima media "
    "declarada por transparencia ronda el 7%, así que el argumento de venta debe ser utilidad primero "
    "(«tu memoria te sigue a todas partes») y control después («y solo tú decides quién entra»)."))
story.append(Paragraph("Métrica fundacional", S_H2))
story.append(body(
    "El memo fijó el criterio de mortalidad: «hace falta un momento de memoria asombrosa en la primera "
    "semana o nadie se queda». Esa frase se convierte en la métrica reina del proyecto: <b>porcentaje de "
    "usuarios nuevos que experimentan un momento de memoria asombrosa en sus primeros 7 días</b> —definido "
    "operativamente como un recuerdo devuelto en contexto que el usuario califica de útil o sorprendente, "
    "medido con un micro-survey de un toque—. La meta de la beta cerrada es 40% o más; por debajo de 25% el "
    "producto necesita rediseño antes que crecimiento. Las métricas satélite son las habituales de "
    "retención (D30 ≥ 30%), conversión a pago (≥ 5% del activo mensual) y churn (menos del 5% mensual), con "
    "un indicador propio de la tesis: <b>recuerdos importados por usuario</b> —si la gente trae su historia "
    "completa, la portabilidad importa de verdad; si trae tres recuerdos, el gancho es débil y hay que "
    "trabajar la demo."))

# ==================================================================
# 8. ROADMAP 12 MESES Y HITOS GO/NO-GO
# ==================================================================
story += h1(8, "Roadmap a 12 meses y hitos go/no-go")
story.append(body(
    "El calendario organiza los 12 meses en cuatro fases solapadas, cada una con una entrega visible, y "
    "fija tres revisiones go/no-go con criterios numéricos previamente declarados. La disciplina de los "
    "hitos importa más que la velocidad: en un espacio donde las plataformas pueden moverse en cualquier "
    "trimestre, la decisión informada de continuar o pivotear es la única ventaja defensiva de un "
    "fundador independiente. El gráfico resume las fases y los diamantes marcan los hitos."))
story += chart_block("/home/z/my-project/scripts/gantt_boveda.png",
    "Figura 2. Roadmap de BÓVEDA a 12 meses: cuatro fases y tres hitos go/no-go (H1, H2, H3).", 210)
story += make_table(
    ["Hito", "Cuándo", "Criterio go (numérico, declarado antes)", "Si es no-go"],
    [
        [td("<b>H1</b><br/>Producto"),
         td("Mes 4<br/>(fin de F2)"),
         td("En beta cerrada de 50-100 usuarios: ≥40% experimenta el momento asombroso en ≤7 días; retención D30 ≥30%; ≥20 recuerdos importados por usuario activo."),
         td("Rediseñar la demo y repetir 6 semanas; si persiste, archivar con honor: la tesis estaba bien pero el producto no la materializa.")],
        [td("<b>H2</b><br/>Negocio"),
         td("Mes 8<br/>(F3 avanzada)"),
         td("1.000 usuarios activos mensuales; conversión a Pro ≥5%; churn mensual <5%; NPS ≥40 en la cohorte fundadora."),
         td("Pivotar de consumidor a prosumer/equipo pequeños (el mismo vault vendido como memoria de trabajo) antes de invertir en F4.")],
        [td("<b>H3</b><br/>Red"),
         td("Mes 12<br/>(fin de F4)"),
         td("Protocolo abierto v1 publicado; ≥3 apps de terceros leyendo BÓVEDA vía SDK; ronda seed levantada o camino de rentabilidad aislado definido."),
         td("Consolidar como producto rentable de nicho y protocolo comunitario; la red puede llegar tarde sin matar el negocio de suscripción.")],
    ],
    [0.11, 0.12, 0.45, 0.32],
    caption="Tabla 6. Hitos go/no-go con criterios numéricos. La fecha de cada criterio se declara antes de empezar la fase.")
story.append(body(
    "Sobre el orden de las fases conviene una nota: la revelación granular (F3) se construye después del "
    "importador y del MVP (F1-F2) a propósito. La tentación de ingeniero es empezar por los permisos "
    "—es lo novedoso—, pero la evidencia de Solid demuestra que los controles sin utilidad previa no "
    "retienen a nadie: primero debe existir la memoria que se nota, y solo entonces el control sobre ella "
    "se vuelve valioso para el usuario. La secuencia correcta es <b>recuerda → asombra → controla → "
    "conecta</b>: importar y asombrar en F1-F2, dar control fino en F3, y abrir la red y el protocolo en "
    "F4 cuando hay algo que valga la pena conectar."))
# ==================================================================
# 9. RIESGOS Y MITIGACIONES
# ==================================================================
story += h1(9, "Riesgos y mitigaciones")
story.append(body(
    "Ninguna de las secciones anteriores valdría sin un mapa honesto de cómo puede fallar el proyecto. "
    "Los seis riesgos siguientes están ordenados por severidad real —no por probabilidad— y cada uno "
    "incorpora una mitigación concreta ya incorporada al diseño del producto o al calendario. El primero "
    "es existencial y por eso encabeza la lista: decide la velocidad con la que conviene moverse."))
story += make_table(
    ["Riesgo", "Severidad", "Mitigación incorporada"],
    [
        [td("<b>Las plataformas cierran la puerta</b>: OpenAI, Anthropic o Google eliminan o degradan el export de datos, o lanzan su propia «memoria portable» de marca."),
         td("<b>Alta</b>", True),
         td("El export GDPR es un derecho legal que les cuesta retirar; el parser de historiales es la vía alternativa; y si lanzan memoria portable, el conflicto de interés es público y BÓVEDA puede posicionarse como el árbitro neutral. La ventana de 12-18 meses dicta el ritmo del roadmap.")],
        [td("<b>Cold start de la utilidad</b>: el expediente vacío no asombra; el usuario instala, prueba y abandona en la primera sesión."),
         td("<b>Alta</b>", True),
         td("El importador es la primera pantalla, no una función secundaria: el expediente nace lleno de la historia del usuario. El micro-survey mide el momento asombroso desde la primera beta, y el H1 (mes 4) tiene el umbral 40% como condición de continuar.")],
        [td("<b>Un incumbente dev-first baja a consumo</b>: Mem0 o Letta lanzan capa consumer con su capital ya levantado."),
         td("<b>Media</b>", True),
         td("Su modelo de negocio es vender a empresas —hacerlo portable para el usuario contrario es quemar a sus clientes. Si aun así bajan, la marca de privacidad verificable (cliente open source, E2E, sin publicidad) es defendible con velocidad y foco; el nicho consumer exige diseño, no solo API.")],
        [td("<b>La regulación tarda más que la startup</b>: la portabilidad de memoria inferida no llega a tiempo y el argumento legal queda como viento de cola débil."),
         td("<b>Media</b>", True),
         td("El plan no depende de la ley: la venta es utilidad («tu memoria te sigue»), no compliance. La regulación se trata como acelerador potencial y material de contenido, nunca como suposición de demanda.")],
        [td("<b>Confianza en el cifrado</b>: «E2E» lo declara cualquiera; sin verificación la promesa vale poco y un solo incidente destruye la marca."),
         td("<b>Media</b>", True),
         td("Cliente open source desde la beta, auditoría externa de seguridad antes del lanzamiento público (presupuestada en F3), y política explícita de no-recogida publicada en el producto: el compromiso es demostrable, no decorativo.")],
        [td("<b>Coste de operación en bootstrapping</b>: sync, LLMs para extracción y soporte devoran caja antes del product-market fit."),
         td("<b>Baja</b>", True),
         td("Arquitectura cliente pesado/servidor tonto: almacenamiento BYO y coste marginal casi nulo por usuario. La extracción con LLM se limita al importador (pago puntual, no recurrente). Presupuesto de validación total: menos de US$150/mes.")],
    ],
    [0.38, 0.11, 0.51],
    caption="Tabla 7. Mapa de riesgos por severidad, con la mitigación ya incorporada al diseño.")
story.append(body(
    "Una observación transversal: cuatro de los seis riesgos se mitigan con la misma decisión —no tener "
    "acceso a los datos del usuario. El servidor que no puede leer es más barato de operar, más difícil de "
    "violar, más simple de explicar y legalmente menos expuesto. En BÓVEDA la privacidad no es un coste de "
    "cumplimiento sino la elección arquitectónica que abarata todo lo demás; conviene protegerla como "
    "principio de diseño en cada revisión de producto, porque la presión comercial para «solo mirar un "
    "poquito» llegará en cuanto el producto empiece a crecer."))

# ==================================================================
# 10. PLAN DE VALIDACION 90 DIAS
# ==================================================================
story += h1(10, "Plan de validación: 90 días")
story.append(body(
    "Antes de comprometer los 12 meses conviene comprar información barata. Este plan de 90 días —que "
    "puede solaparse con el Plan A de publicación del sitio del informe anterior— usa menos de US$150 al "
    "mes y termina con una decisión binaria: comprometerse al roadmap de BÓVEDA o archivarlo con la "
    "satisfacción de haberlo verificado. La hipótesis central a validar no es técnica sino emocional: "
    "<b>¿existe suficiente malestar por la memoria cautiva para que la gente importe su historia</b> a un "
    "expediente de un tercero desconocido? Si la respuesta es sí en cantidad, todo lo demás de este informe "
    "aplica; si es no, ninguna arquitectura lo arregla."))
story += make_table(
    ["Semanas", "Qué se construye o ejecuta", "Señal que se busca"],
    [
        [td("<b>S1-S2</b>"),
         td("Landing con el copy «Saca tus recuerdos de ChatGPT» + lista de espera. Publicar el memo (Plan A del informe anterior) con la señal final apuntando a BÓVEDA. Dominio, hosting y analítica: infra ya prevista (≈US$30/mes)."),
         td("Tasa de conversión de visita a waitlist (umbral de interés: ≥25% del tráfico cualificado); primeros 200 inscritos por canales orgánicos.")],
        [td("<b>S3-S6</b>"),
         td("Prototipo del importador: export de ChatGPT → expediente navegable 100% local (sin servidor). En paralelo, 25 entrevistas en profundidad con power users multi-modelo reclutados de la waitlist."),
         td("¿La gente exporta de verdad? ¿El expediente generado produce asombro sin construir nada más? Citar el dolor en las propias palabras de los entrevistados.")],
        [td("<b>S7-S10</b>"),
         td("Beta cerrada con 50-100 usuarios de la waitlist: importador + consulta de memoria vía un asistente local. Instrumentar el momento asombroso (micro-survey de un toque) y retención semanal."),
         td("≥40% con momento asombroso en ≤7 días; ≥20 recuerdos importados de mediana por usuario; comentarios espontáneos de tipo «cómo vivía sin esto».")],
        [td("<b>S11-S13</b>"),
         td("Análisis de cohortes, decisión go/no-go documentada contra los umbrales de H1. Si go: arrancar F1 del roadmap (vault E2E + hardening del importador). Si no-go: informe post-mortem y decisión sobre pivotar (prosumer) o archivar."),
         td("La decisión misma: continuar, pivotar o archivar —tomada con datos, no con entusiasmo— es el entregable final de los 90 días.")],
    ],
    [0.11, 0.52, 0.37],
    caption="Tabla 8. Plan de validación de 90 días, fase por fase, con la señal buscada en cada bloque.")
story += make_table(
    ["Partida", "Coste mensual", "Nota"],
    [
        [td("Dominio + hosting (landing, memo, API piloto)"),
         td("≈US$30", True),
         td("Ya previsto en el Plan A del informe de revisión estratégica; reutilizable tal cual.")],
        [td("APIs de LLM para la extracción del importador"),
         td("≈US$50", True),
         td("Solo procesamiento puntual del export en la beta; con modelos pequeños locales tras el piloto.")],
        [td("Herramientas (analítica, email, encuestas)"),
         td("≈US$50", True),
         td("Planes gratuitos o de entrada; se dispara solo tras H2 si el negocio arranca.")],
        [td("<b>Total de la validación</b>"),
         td("<b>US$150 max.</b>", True),
         td("Sin contar tiempo del fundador: tres meses de evidencia por el precio de una cena mensual.")],
    ],
    [0.42, 0.16, 0.42],
    caption="Tabla 9. Presupuesto de la validación: menos de US$150/mes durante los 90 días.")
story.append(body(
    "La conexión con el trabajo ya hecho es directa. El memorándum «Cuello de botella 2030» ya argumentó "
    "el problema con rigor editorial y consiguió una identidad verbal propia; el informe de revisión "
    "estratégica estableció el plan para publicarlo en seis semanas; este informe añade la pieza que "
    "faltaba: <b>a qué apunta todo aquello</b>. Publicar el sitio deja de ser una tarea de marketing y se "
    "convierte en el primer acto de la go-to-market de BÓVEDA; el memo entero funciona como manifiesto del "
    "producto; y las otras seis ideas del memo quedan como módulos futuros del mismo universo —empezando "
    "por SELLO y TESTIGO, cuya procedencia firmada encaja de forma natural con el cuarto pilar del "
    "expediente. El orden de ejecución recomendado para las próximas dos semanas es uno: registrar el "
    "dominio, montar la landing del importador y abrir la lista de espera."))

doc.build(story)
print("OK:", OUT)
