# -*- coding: utf-8 -*-
"""Graficos para el informe profundo de BOVEDA - paleta Crystal Blue (familia azul unica)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')

import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Paleta Crystal Blue (familia hue ~210)
C_LIGHT = "#c0d0e2"
C_MID   = "#7ba7c9"
C_ACC   = "#2d7ab3"
C_DARK  = "#1a4a7a"
C_TEXT  = "#142840"
C_MUT   = "#5a7a96"

def style_ax(ax):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)
    ax.spines['bottom'].set_color(C_LIGHT)
    ax.tick_params(colors=C_MUT, labelsize=9)
    ax.grid(axis='x', linestyle='--', linewidth=0.5, alpha=0.25, color=C_DARK)
    ax.set_axisbelow(True)

# ------------------------------------------------------------------
# Grafico 1 - Financiacion anunciada por jugador (US$ millones)
# ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.4, 2.7), dpi=200, constrained_layout=True)

jugadores = [
    ("Mem0  (infra dev-first)",            24.0, C_DARK),
    ("Letta / MemGPT  (infra dev-first)",  10.0, C_ACC),
    ("Potpie  (infra dev-first)",           2.2, C_MID),
    ("Zep  (infra dev-first)",              0.5, C_MID),
    ("Capa consumer user-owned",            0.0, C_LIGHT),
]
labels = [j[0] for j in jugadores]
vals   = [j[1] for j in jugadores]
cols   = [j[2] for j in jugadores]

y = list(range(len(jugadores)))[::-1]
bars = ax.barh(y, [max(v, 0.6) for v in vals], height=0.52, color=cols,
               edgecolor='none', zorder=3)
# barra fantasma para la capa consumer (valor real 0)
bars[-1].set_hatch('///')
bars[-1].set_edgecolor(C_MUT)
bars[-1].set_linewidth(0.8)
bars[-1].set_facecolor('white')

for yi, v in zip(y, vals):
    txt = f"US${v:.1f}M".replace(".0M", "M") if v > 0 else "US$0 anunciado"
    ax.text(max(v, 0.6) + 0.35, yi, txt, va='center', ha='left',
            fontsize=8.6, color=C_TEXT, fontweight='bold', zorder=4)

ax.set_yticks(y)
ax.set_yticklabels(labels, fontsize=8.6, color=C_TEXT)
for lbl in ax.get_yticklabels():
    lbl.set_fontweight('bold')
ax.set_xlim(0, 29)
ax.set_xticks(range(0, 30, 5))
ax.set_xticklabels([f"{i}" for i in range(0, 30, 5)])
ax.set_xlabel("Financiación anunciada (US$ millones, ago 2026)", fontsize=8.5, color=C_MUT)
style_ax(ax)
ax.tick_params(axis='y', length=0)

fig.savefig('/home/z/my-project/scripts/chart_funding_boveda.png', facecolor='white')
plt.close(fig)

# ------------------------------------------------------------------
# Grafico 2 - Gantt roadmap BOVEDA 12 meses
# ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.4, 3.1), dpi=200, constrained_layout=True)

fases = [
    ("F1  Cimientos: vault cifrado + importador",  0.0, 3.5, C_MID),
    ("F2  MVP publico + momento asombroso",        3.0, 3.0, C_ACC),
    ("F3  Perfiles de revelacion + SDK MCP",       6.0, 3.5, C_DARK),
    ("F4  Protocolo abierto + red de terceros",    9.0, 3.0, C_LIGHT),
]
names = []
for i, (name, start, dur, color) in enumerate(fases):
    y = len(fases) - 1 - i
    ax.barh(y, dur, left=start, height=0.52, color=color, edgecolor='none', zorder=3)
    names.append(name)

ax.set_yticks([3, 2, 1, 0])
ax.set_yticklabels(names, fontsize=8.5, color=C_TEXT)
for lbl in ax.get_yticklabels():
    lbl.set_fontweight('bold')

hitos = [(4.0, 2, "H1"), (8.0, 1, "H2"), (12.0, 0, "H3")]
for x, y, tag in hitos:
    ax.scatter([x], [y], marker='D', s=55, color=C_DARK, zorder=5)
    ax.text(x + 0.18, y + 0.36, tag, fontsize=8.5, color=C_DARK,
            fontweight='bold', ha='left', zorder=5)

ax.set_xlim(0, 12.8)
ax.set_ylim(-0.55, 3.95)
ax.set_xticks(range(0, 13, 2))
ax.set_xticklabels([f"M{i}" if i > 0 else "" for i in range(0, 13, 2)])
style_ax(ax)
ax.tick_params(axis='y', length=0)

fig.savefig('/home/z/my-project/scripts/gantt_boveda.png', facecolor='white')
plt.close(fig)

print("OK: chart_funding_boveda.png y gantt_boveda.png generados")
