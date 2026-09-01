# -*- coding: utf-8 -*-
"""
Informe de revision estrategica - "Cuello de Botella 2030"
Ruta Report (ReportLab) - paleta fija Template 07 Crystal Blue (cuerpo claro).
Sin TOC (documento ejecutivo corto) -> SimpleDocTemplate + build().
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
PAGE_BG      = colors.HexColor("#f5f8fc")  # XL
SECTION_BG   = colors.HexColor("#edf2f9")  # XL
CARD_BG      = colors.HexColor("#e4ecf5")  # L
TABLE_STRIPE = colors.HexColor("#eef3fa")  # L
HEADER_FILL  = colors.HexColor("#1a4a7a")  # M
BORDER       = colors.HexColor("#c0d0e2")  # S
ACCENT       = colors.HexColor("#2d7ab3")  # XS
TEXT_PRIMARY = colors.HexColor("#142840")
TEXT_MUTED   = colors.HexColor("#5a7a96")

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = TABLE_STRIPE

# ------------------------------------------------------------------
# Documento
# ------------------------------------------------------------------
OUT = "/home/z/my-project/scripts/body.pdf"
MARGIN = 0.9 * inch
TOP_M, BOT_M = 0.95 * inch, 0.85 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - TOP_M - BOT_M
H1_ORPHAN = AVAIL_H * 0.25

DOC_TITLE = "Revisión estratégica — Cuello de Botella 2030"

def on_page(canvas, doc):
    canvas.saveState()
    # fondo de página (XL tier)
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # cabecera: título + regla accent
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 0.55 * inch, DOC_TITLE)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.5)
    canvas.line(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - MARGIN, PAGE_H - 0.62 * inch)
    # pie: autor + número de página
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
    title="Revisión estratégica - Cuello de Botella 2030",
    author="Z.ai", creator="Z.ai",
    subject="Pros y contras, competencia, fases y calendario de implementacion",
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
    "El proyecto revisado es <b>«Cuello de botella 2030»</b>, un memorándum de anticipación interactivo "
    "construido como una landing editorial (Vite + React 18 + TypeScript + Tailwind 4, 2.561 líneas de código) "
    "que argumenta una tesis: cuando los agentes de IA desembarquen en el trabajo real, el cuello de botella "
    "no será su inteligencia sino la <b>verificación</b> de lo que producen. El documento mapea 15 dolores en 5 "
    "capas, identifica 7 piezas de software que «aún no existen» (SELLO, ESPEJO, FRONTERA, AUDITOR, PUENTE, "
    "BÓVEDA y TRIBUNAL) y profundiza en TESTIGO, un protocolo de atestiguación con roadmap v0.2→v2.0. "
    "Este informe evalúa el proyecto como base de un producto real: sus fortalezas y debilidades, el estado "
    "real del mercado para cada idea, y dos calendarios separados —publicar el sitio (Plan A, 6 semanas) y "
    "construir TESTIGO (Plan B, 12 meses)—.", S_LEAD))
story += kpi_strip([
    ("9/13", "dependencias de producción declaradas sin usar en el código"),
    ("8/8", "espacios de idea con competencia activa en la red (agosto 2026)"),
    ("US$2.500M+", "invertidos en startups de agentes de IA solo en 2025"),
])
story += make_table(
    ["Dimensión", "Semáforo", "Lectura"],
    [
        [td("Tesis de fondo: los dolores son reales"),
         td("<b>Verde</b>", True),
         td("Los 15 dolores coinciden con la agenda real de seguridad y gobernanza de agentes 2025-2026 (CSA, AWS, Okta). El diagnóstico envejeció bien.")],
        [td("Timing de la ventana"),
         td("<b>Ámbar</b>", True),
         td("La ventana existe pero se cierra rápido: C2PA, AP2, MCP y A2A se estandarizaron entre 2025 y 2026. El memo se escribió antes de esa ola y hay que reposicionarse.")],
        [td("Supuesto de «vacío» del memo"),
         td("<b>Ámbar</b>", True),
         td("5 de 8 espacios ya tienen jugadores serios. La narrativa «software que no existe» necesita actualizarse a «software que nadie hace de forma neutral».")],
        [td("Ejecución técnica del sitio"),
         td("<b>Verde</b>", True),
         td("Código limpio, accesible y tipado; deuda técnica menor y barata de pagar (detallada en la sección 2).")],
        [td("Estrategia de salida a mercado"),
         td("<b>Rojo</b>", True),
         td("No hay canal, comunidad ni producto: el memo es un punto de partida intelectual excelente, no un plan de go-to-market. Los planes A y B de este informe lo corrigen.")],
    ],
    [0.30, 0.12, 0.58],
    caption="Tabla 1. Evaluación por dimensiones del proyecto.")
story.append(body(
    "<b>Hallazgo central.</b> La tesis del memorándum está siendo validada por el mercado —capital, "
    "estándares y marcos de gobernanza aparecieron en los últimos 18 meses—, pero eso también significa que "
    "el supuesto «aún no existe» ya no es cierto en la mayoría de los espacios que describe. Google lanzó AP2 "
    "para pagos de agentes (septiembre 2025), Anthropic y Google pelean la interoperabilidad con MCP y A2A, y "
    "Okta, Auth0 y AWS ya venden identidad para agentes. El valor remanente para un fundador independiente no "
    "está en competir en esas carreteras, sino en los huecos que los gigantes no pueden ocupar por conflicto "
    "de interés: la <b>auditoría certificada con tasa de error pública</b> (AUDITOR), la <b>procedencia de outputs "
    "de trabajo</b> más allá de medios (SELLO), la <b>memoria propiedad del usuario</b> (BÓVEDA) y la "
    "<b>simulación de consecuencias</b> (ESPEJO). El plan recomendado usa el sitio ya construido como detector de "
    "demanda durante 6 semanas y, solo con esa señal, compromete los 12 meses de construcción."))

# ==================================================================
# 2. FORTALEZAS Y DEBILIDADES
# ==================================================================
story += h1(2, "Fortalezas y debilidades del proyecto")
story.append(body(
    "El proyecto es inusualmente sólido para estar en fase de idea: el contenido está estructurado con "
    "rigor editorial, los datos viven en una única fuente tipada (data.ts) y la capa visual tiene un carácter "
    "propietario —grillas de papel, scramble tipográfico, marquee de términos— que lo distingue de un blog "
    "genérico. La revisión de código confirma buenas prácticas de accesibilidad y rendimiento percibido, con "
    "una deuda técnica concreta, barata y bien delimitada. La matriz siguiente resume el balance en cinco "
    "pares, y la tabla de auditoría detalla cada hallazgo técnico con su severidad."))
story += make_table(
    ["Pros", "Contras"],
    [
        [td("Tesis afilada con identidad propia: «nada se cree, todo se atestigua» y el protocolo TESTIGO dan una marca memorable."),
         td("9 de 13 dependencias de producción sin usar (dnd-kit, Supabase, framer-motion, recharts, router, uuid…): instalación lenta y superficie de ataque innecesaria.")],
        [td("Dolor bien documentado: 5 capas × 15 dolores con severidad y horizonte temporal, más 8 señales observables."),
         td("Sin OG tags ni favicon: al compartir el memo en redes se ve roto — letal para un contenido pensado para circular.")],
        [td("Las 7 ideas ya traen modelo de negocio, riesgo y MVP definidos: material de pitch casi listo."),
         td("SPA pura para contenido editorial: el texto no se indexa bien; un memo vive de buscadores y menciones.")],
        [td("Código limpio: hooks propios de animación sin librerías, prefers-reduced-motion respetado, SVG accesibles con aria-label."),
         td("Sin linting, tests ni CI; git con 3 commits genéricos «task snapshot», sin README ni licencia.")],
        [td("Stack moderno y ligero: build de producción ya generado (211 KB JS + 44 KB CSS) y deploy trivial en cualquier hosting estático."),
         td("El roadmap TESTIGO v0.2→v2.0 ignora a los jugadores existentes: no hay análisis competitivo en el documento.")],
    ],
    [0.5, 0.5],
    caption="Tabla 2. Matriz pros/contras del proyecto.")
story.append(Paragraph("Auditoría técnica del código", S_H2))
story += make_table(
    ["Hallazgo", "Severidad", "Acción recomendada"],
    [
        [td("Dependencias sin usar (9 de 13 en package.json)"),
         td("<b>Media</b>", True),
         td("Eliminarlas y regenerar lockfile: 1 hora de trabajo, instala en segundos y reduce CVEs.")],
        [td("Sin OG/Twitter meta, sin favicon, sin public/"),
         td("<b>Alta</b>", True),
         td("Añadir meta tags + imagen OG 1200×630 con el titular del memo: 10 líneas en index.html.")],
        [td("SPA sin prerender (contenido solo en JS)"),
         td("<b>Media</b>", True),
         td("Migrar a prerender (vite-ssg) o Astro en Fase 1 del Plan A; el contenido ya está desacoplado en data.ts.")],
        [td("Fuentes de Google (3 familias) sin subsetting ni self-host"),
         td("Baja", True),
         td("Self-host con subsetting latino y font-display: swap; elimina bloqueo de render y dependencia externa.")],
        [td("Sin ESLint/Prettier/Vitest/CI"),
         td("<b>Media</b>", True),
         td("Config mínima + workflow de build en GitHub Actions antes de aceptar contribuciones.")],
        [td("dist/ versionado y commits «task snapshot»"),
         td("Baja", True),
         td("Quitar dist/ del control de versiones; reiniciar historial con commits semánticos y tag v0.1.")],
        [td("Bundle 211 KB JS para contenido mayormente estático"),
         td("Baja", True),
         td("Con prerender el JS crítico baja de ~200 KB a <60 KB; medir con Lighthouse tras Fase 1.")],
        [td("Accesibilidad y reduced-motion bien resueltos"),
         td("Fortaleza", True),
         td("Mantener como estándar del proyecto y mencionarlo en el README: es señal de calidad.")],
    ],
    [0.40, 0.13, 0.47],
    caption="Tabla 3. Auditoría de código: hallazgos, severidad y acción.")

# ==================================================================
# 3. PANORAMA COMPETITIVO
# ==================================================================
story += h1(3, "Panorama competitivo idea por idea")
story.append(body(
    "Se verificó en la red (agosto de 2026) qué productos, protocolos y financiación reales ocupan cada uno "
    "de los espacios que el memo declara vacíos. El resultado matiza el título del proyecto: <b>ningún espacio "
    "está literalmente vacío</b>, pero el grado de ocupación varía mucho —dos espacios están en manos de "
    "gigantes, tres tienen infraestructura de desarrollador sin capa neutral, y tres conservan huecos claros "
    "para un jugador independiente. La tabla resume el estado por idea y el espacio diferencial que sigue "
    "abierto."))
story += make_table(
    ["Idea", "Qué existe hoy (ago 2026)", "Ocupación", "Espacio diferencial abierto"],
    [
        [td("<b>SELLO</b> procedencia"),
         td("C2PA / Content Credentials (coalición Adobe) estandarizados para medios; OpenAI publicó su Content Provenance API (jul 2026)."),
         td("Alto<br/>(solo medios)", True),
         td("Procedencia de outputs de trabajo de agentes (PRs, informes, transacciones), no de fotos: el recibo firmado de decisiones.")],
        [td("<b>ESPEJO</b> simulación"),
         td("E2B, Daytona y Modal dominan el sandbox-runtime donde los agentes ejecutan código aislado."),
         td("Alto<br/>(runtime)", True),
         td("Simulación de consecuencias de negocio (diff de qué pasaría y con qué probabilidad), no solo ejecución aislada de código.")],
        [td("<b>FRONTERA</b> autoridad delegada"),
         td("Okta, Auth0, AWS, CyberArk ya venden IAM para agentes; Token Security levantó US$18M (2025)."),
         td("Muy alto", True),
         td("Ninguno viable para un solo fundador: integrarse con estos sistemas, no competir con ellos.")],
        [td("<b>AUDITOR</b> verificación adversarial"),
         td("LLM-as-a-Judge consolidado como técnica interna de evals (Monte Carlo, Evidently, Comet); Agent-as-a-Judge en literatura académica."),
         td("Medio", True),
         td("Auditoría <b>independiente y certificada</b> con tasa de error pública y evidencia adjunta: nadie la vende como servicio neutro.")],
        [td("<b>PUENTE</b> interoperabilidad"),
         td("Guerra de protocolos ya en marcha: MCP (Anthropic), A2A (Google, abr 2025), ACP; cada SaaS construye su adaptador."),
         td("Muy alto", True),
         td("Evitar la capa de protocolo; construir herramientas sobre MCP/A2A cuando haga falta.")],
        [td("<b>BÓVEDA</b> memoria portable"),
         td("Mem0, Zep, Letta (MemGPT) y Cognee compiten en infraestructura de memoria para desarrolladores."),
         td("Alto<br/>(dev-first)", True),
         td("Memoria <b>propiedad del usuario final</b>, portable entre proveedores con revelación granular: ángulo consumer que nadie ocupa y que la regulación empuja.")],
        [td("<b>TRIBUNAL</b> disputas y escrow"),
         td("Pagos estandarizándose: AP2 (Google, sep 2025), x402 (Coinbase), ACP, Visa Trusted Agent Protocol. El arbitraje con evidencia sigue abierto."),
         td("Medio", True),
         td("Escrow + arbitraje criptográfico sobre AP2/x402; todavía no hay volumen de comercio agente-a-agente para liderarlo solo.")],
        [td("<b>TESTIGO</b> protocolo de confianza"),
         td("Vouched levantó US$17M (Serie A) para identidad de agentes; CSA publicó su Agentic Trust Framework (feb 2026); DIDs + credenciales verificables avanzan en academia."),
         td("Medio", True),
         td("El estándar <b>neutro</b> con staking, verificadores verificados y observatorio público: el capital valida la tesis pero nadie ocupa la silla neutral.")],
    ],
    [0.16, 0.33, 0.135, 0.375],
    caption="Tabla 4. Estado de ocupación de cada espacio declarado vacío por el memo (verificación web, agosto 2026).")
story.append(body(
    "<b>Dónde jugar.</b> El espacio más diferenciado es AUDITOR: la técnica LLM-as-a-Judge está madura y "
    "abarata la construcción, pero todos la usan como herramienta interna de evaluación y nadie la vende como "
    "auditoría independiente con tasa de falsos positivos publicada —exactamente la garantía que una "
    "aseguradora o un regulador necesitaría. SELLO complementa de forma natural: la firma de outputs (el "
    "«recibo») es el insumo de la auditoría, y su MVP de PRs firmados conecta con el mismo comprador temprano. "
    "BÓVEDA es la apuesta consumer de mayor techo y mayor riesgo, porque el valor se nota tarde y la "
    "distribución exige marca; conviene mantenerla como segunda ola."))
story.append(body(
    "<b>Dónde no pelear.</b> FRONTERA y PUENTE están colonizados por actores con distribuciones imposibles de "
    "replicar: identidad (Okta, Auth0, AWS) y protocolos (Anthropic, Google) avanzan por estándares y "
    "contratos empresariales. TRIBUNAL, por su parte, depende de que exista primero un volumen de comercio "
    "entre agentes que hoy no existe; el memo mismo lo sitúa en 2029. La lectura estratégica del informe es "
    "que TESTIGO debe reposicionarse de «protocolo que reemplaza la confianza» a «capa neutra de evidencia y "
    "auditoría que se integra con AP2, MCP y los IAM existentes»: de contrincante a árbitro."))

# ==================================================================
# 4. PLAN A
# ==================================================================
story += h1(4, "Plan A — Publicar el sitio web (6 semanas)")
story.append(body(
    "El Plan A convierte el memo en un <b>detector de demanda</b> antes de comprometer un año de "
    "construcción. El alcance es deliberadamente mínimo: pagar la deuda técnica que estorba la distribución "
    "(OG tags, prerender, dependencias), publicar en un dominio propio con analítica respetuosa, y generar dos "
    "piezas de contenido derivadas del propio memo para provocar conversación medida. El éxito no se mide en "
    "visitas totales sino en <b>señales de intención</b>: correos capturados, menciones de calidad y conversaciones "
    "entrantes de equipos que ya despliegan agentes. El coste total es de 30-40 horas de trabajo más unos "
    "US$30 mensuales de infraestructura."))
story += make_table(
    ["Fase", "Semanas", "Entregables", "Criterio de salida"],
    [
        [td("<b>F0 · Limpieza técnica</b>"),
         td("S1", True),
         td("Dependencias sin usar eliminadas; OG/Twitter meta + favicon + imagen OG; README y licencia; analítica (Plausible/Umami) instalada."),
         td("Build <150 KB, Lighthouse ≥90 en rendimiento y SEO.")],
        [td("<b>F1 · Publicación</b>"),
         td("S2-S3", True),
         td("Dominio y deploy (Vercel/Netlify); prerender o migración a SSG; sitemap + robots; captura de correo de 1 campo al pie."),
         td("Sitio indexado; ≥100 visitas orgánicas/semana sostenidas 2 semanas.")],
        [td("<b>F2 · Distribución y contenido</b>"),
         td("S4-S6", True),
         td("2 posts técnicos derivados (procedencia de outputs vs. C2PA; auditoría de agentes con tasa de error pública); publicación en Hacker News, Lobsters y comunidades técnicas en español."),
         td("≥1.000 lectores acumulados, ≥50 correos, ≥1 conversación entrante de equipo real con agentes en producción.")],
    ],
    [0.18, 0.12, 0.40, 0.30],
    caption="Tabla 5. Fases, entregables y criterios del Plan A.")
story += chart_block("/home/z/my-project/scripts/gantt_plan_a.png",
                     "Figura 1. Calendario del Plan A (semanas S1-S6) con hito de decisión al cierre de S6.",
                     max_height=230)
story.append(body(
    "Al cierre de la semana 6 se toma la primera decisión con datos: si el memo genera señales de intención "
    "(correos, conversaciones, peticiones de «¿esto existe?»), se avanza al Plan B con audiencia inicial ya "
    "construida. Si no las genera, el coste del experimento fue de seis semanas y el memo queda publicado como "
    "activo intelectual personal, que ya es un retorno razonable."))

# ==================================================================
# 5. PLAN B
# ==================================================================
story += h1(5, "Plan B — Construir TESTIGO (12 meses)")
story.append(body(
    "El Plan B materializa TESTIGO con un orden corregido por la evidencia competitiva: en lugar de empezar "
    "por el protocolo general (la vía más lenta hacia ingresos), empieza por <b>AUDITOR como producto-cuña</b> "
    "—auditoría independiente de outputs de agentes con tasa de error pública— y por un MVP acotado a un solo "
    "dominio: revisión de pull requests generados por agentes. SELLO se construye como SDK de firma de "
    "outputs que alimenta al auditor con evidencia verificable; la especificación abierta y la red de "
    "verificadores llegan al final, cuando la tracción justifica estandarizar. FRONTERA y PUENTE no se "
    "construyen: se integra con Okta/AWS y MCP/A2A cuando toque. El roadmap v0.2→v2.0 del memo se conserva "
    "como norte, con los ejes de staking y verificadores verificados como principios de diseño desde el día 1."))
story += make_table(
    ["Fase", "Meses", "Objetivo", "Entregable clave", "Criterio go/no-go"],
    [
        [td("<b>F1 · Pitch abierto</b>"),
         td("M1-M2", True),
         td("Publicar la tesis técnica y reclutar a los primeros curiosos: especificación v0.1, SDK alpha, demo en vivo del flujo de atestiguación."),
         td("Spec pública + demo + lista de 200 desarrolladores."),
         td("Salida temprana si en 60 días no hay adopción orgánica (estrellas, forks, correos).")],
        [td("<b>F2 · MVP AUDITOR</b>"),
         td("M2-M5", True),
         td("Auditor adversarial de PRs generados por agentes en un único dominio, con rúbrica pública y tasa de falsos positivos medida y publicada."),
         td("3-5 equipos piloto usando el auditor en CI."),
         td("<b>H1 (M5):</b> ≥2 pilotos activos y tasa de hallazgos útil; si no, pivote de dominio.")],
        [td("<b>F3 · Pilotos + SELLO SDK</b>"),
         td("M6-M9", True),
         td("Firma verificable de outputs (recibos) y panel de confianza; convertir pilotos gratuitos en uso retenido y primer contrato."),
         td("SDK SELLO en producción con 2 integraciones reales."),
         td("<b>H2 (M9):</b> retención ≥60% y ≥1 cliente pagando; si no, revisar pricing y wedge.")],
        [td("<b>F4 · Estándar y red</b>"),
         td("M10-12", True),
         td("Abrir la especificación a multivendedor, primeros nodos verificadores independientes y observatorio público de atestiguaciones."),
         td("Propuesta de estándar (vía informal IETF/W3C) + red de 5 nodos."),
         td("<b>H3 (M12):</b> revisión anual; si H2 y H3 pasan, es el momento de levantar capital.")],
    ],
    [0.15, 0.09, 0.30, 0.22, 0.24],
    caption="Tabla 6. Fases del Plan B con criterios go/no-go explícitos.")
story += chart_block("/home/z/my-project/scripts/gantt_plan_b.png",
                     "Figura 2. Calendario del Plan B (meses M1-M12) con tres hitos de decisión.",
                     max_height=260)

# ==================================================================
# 6. RIESGOS, RECURSOS Y COSTOS
# ==================================================================
story += h1(6, "Riesgos, recursos y costos")
story.append(body(
    "Los riesgos dominantes no son técnicos sino de posicionamiento y capacidad: el proyecto compite por "
    "definición contra la velocidad de los gigantes y depende de una sola persona. Las mitigaciones están ya "
    "diseñadas en los planes anteriores —empezar por el hueco que los gigantes no pueden ocupar por conflicto "
    "de interés, publicar calibración como garantía, y poner hitos de aborto cada pocos meses—, pero conviene "
    "nombrarlos explícitamente y revisarlos en cada hito."))
story += make_table(
    ["Riesgo", "Prob.", "Impacto", "Mitigación"],
    [
        [td("Los gigantes colonizan el espacio elegido (Okta/AWS en identidad; Google en pagos y protocolos)."),
         td("Alta", True), td("Alto", True),
         td("Jugar donde el actor neutro es estructuralmente necesario: auditoría certificada y estándares abiertos; integrar, no competir.")],
        [td("Un estándar abierto vuelve commodity la capa de firma (SELLO)."),
         td("Media", True), td("Alto", True),
         td("El negocio es la red de confianza y el observatorio, no el sello: acumular reputación y datos de calibración propios.")],
        [td("El verificador también se equivoca y daña la marca."),
         td("Media", True), td("Alto", True),
         td("Tasa de error publicada como garantía, rúbricas por dominio, humano en el circuito de excepciones desde F2.")],
        [td("La regulación no reconoce fallos sintéticos (bloquea TRIBUNAL)."),
         td("Alta", True), td("Medio", True),
         td("Posponer TRIBUNAL; anclarse en evidencia firmada (SELLO), que sí es reconocible hoy como prueba documental.")],
        [td("Capacidad de fundador único: aislamiento y cuellos de botella."),
         td("Alta", True), td("Alto", True),
         td("Alcance de 12 meses dimensionado para 1 persona + 0.5; comunidad como multiplicador; hitos de aborto en M5, M9 y M12.")],
        [td("La demanda temprana es débil: «duele pero se tolera»."),
         td("Media", True), td("Alto", True),
         td("Validar con dinero real (pilotos pagados) antes de M9; el Plan A actúa como filtro previo de demanda.")],
    ],
    [0.34, 0.08, 0.10, 0.48],
    caption="Tabla 7. Riesgos principales con probabilidad, impacto y mitigación.")
story.append(Paragraph("Equipo mínimo y costos estimados", S_H2))
story += make_table(
    ["Etapa", "Equipo", "Costo mensual (USD)", "Notas"],
    [
        [td("Plan A (S1-S6)"),
         td("Fundador a tiempo parcial", True),
         td("~30 (infra)", True),
         td("Dominio, hosting y analítica; 30-40 horas de trabajo en total.")],
        [td("Plan B F1-F2 (M1-M5)"),
         td("Fundador full-time + 0.5 ingeniero", True),
         td("3.000-5.000 con contractor; ~50 si es solo", True),
         td("APIs de modelos y evals: 100-300/mes adicionales.")],
        [td("Plan B F3 (M6-M9)"),
         td("Fundador + 1 ingeniero", True),
         td("6.000-9.000", True),
         td("Pilotos gratuitos a cambio de datos de calibración.")],
        [td("Plan B F4 (M10-M12)"),
         td("Fundador + 1-1,5 ingenieros", True),
         td("8.000-12.000", True),
         td("Momento de decidir ronda si H2 y H3 pasan.")],
    ],
    [0.20, 0.26, 0.24, 0.30],
    caption="Tabla 8. Recursos y costos por etapa (escenario contractor vs. modo solo-founder).")
story.append(body(
    "En modo <b>solo-founder</b> con ingresos paralelos, el coste de 12 meses se mantiene entre US$2.000 y "
    "US$5.000 (infraestructura y APIs); en modo <b>equipo contratado</b> el presupuesto total de 12 meses ronda "
    "US$50.000-80.000. La diferencia importa porque define el umbral del hito H2: con presupuesto ligero, el "
    "proyecto puede sobrevivir sin ronda hasta M12; con equipo contratado, M9 es la fecha límite real para "
    "validar disposición de pago."))

# ==================================================================
# 7. VALIDACIÓN EN 60 DÍAS
# ==================================================================
story += h1(7, "Validación en 60 días: cinco acciones baratas")
story.append(body(
    "Antes de escribir la primera línea del producto, cinco acciones de coste casi nulo permiten validar las "
    "hipótesis más caras del memo: que alguien revisa (o quiere revisar) el output de sus agentes, y que esa "
    "persona paga por hacerlo de forma independiente. Cada acción produce una señal medible en menos de dos "
    "semanas de trabajo parcial, y todas pueden ejecutarse en paralelo con el Plan A."))
for i, (title, detail) in enumerate([
    ("Diez entrevistas con equipos que ya despliegan agentes",
     "Veinte minutos cada una, reclutadas entre los contactos que genere el Plan A. La pregunta clave: ¿quién revisa hoy el output de tus agentes y con qué criterio? Si la respuesta es «nadie con método», el dolor aún no duele y hay que reajustar el wedge."),
    ("Landing del wedge con lista de espera",
     "Una página simple: «Auditoría independiente para pull requests creados por agentes». Si la conversión a correo supera el 25% de tráfico cualificado, el mensaje conecta; por debajo del 10%, se reescribe."),
    ("MVP de humo: auditar 20 pull requests a mano",
     "Tomar PRs reales generados por Claude Code, Codex o similares, auditarlos con una rúbrica fija y publicar la tasa de hallazgos con la metodología. Es el pitch del producto demostrado a mano y el primer dato de calibración público."),
    ("Dos posts técnicos medidos",
     "Uno sobre procedencia de outputs frente a C2PA y otro sobre auditoría con tasa de error pública. Publicarlos en Hacker News, Lobsters y comunidades en español, y comparar cuál de las dos ideas genera más debate y correos: eso orienta el orden de construcción."),
    ("Cinco candidatos a piloto identificados",
     "Equipos con agentes en CI o en CRM a los que se les ofrece una auditoría gratuita de dos semanas a cambio de usar el resultado y dar feedback. Son los mismos nombres a los que se venderá el piloto de F2."),
]):
    story.append(Paragraph(nb(f"<b>{i+1}. {title}.</b> {detail}"), S_BULLET))
story.append(Spacer(1, 8))
story += make_table(
    ["Días", "Acción", "Resultado esperado"],
    [
        [td("D1-D2", True),
         td("Rama de limpieza: eliminar las 9 dependencias sin usar y regenerar el lockfile."),
         td("Instalación en segundos; build intacto y verificado.")],
        [td("D3", True),
         td("Meta tags OG + favicon + imagen OG 1200×630 con el titular del memo."),
         td("Enlaces compartidos con vista previa correcta en redes.")],
        [td("D4-D5", True),
         td("Merge, tag v0.1, deploy de preview y activación de analítica."),
         td("El Plan A arranca la semana siguiente con base limpia y medible.")],
    ],
    [0.11, 0.51, 0.38],
    caption="Tabla 9. La semana cero: la primera decisión, ejecutada en cinco días.")
story.append(body(
    "<b>Recomendación final.</b> El proyecto vale la pena: su tesis fue validada por el mercado en los últimos "
    "18 meses, su ejecución editorial es de alta calidad y su deuda técnica es pequeña. Su riesgo real es "
    "estratégico, no técnico: competir donde ya hay gigantes. La ruta recomendada es ejecutar el Plan A de "
    "inmediato, dejar que el mercado confirme el hueco AUDITOR/SELLO durante seis semanas, y solo entonces "
    "comprometer los 12 meses del Plan B con los tres puntos de aborto definidos. La primera decisión concreta "
    "de esta semana: abrir una rama de limpieza, eliminar las nueve dependencias muertas y añadir los meta "
    "tags OG —una hora de trabajo que multiplica la capacidad de distribución de todo lo que ya está construido."))

# ------------------------------------------------------------------
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print("OK body.pdf:", OUT)
