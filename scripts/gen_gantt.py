# -*- coding: utf-8 -*-
"""Gantt charts para el informe de revision - paleta Crystal Blue (familia azul unica)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')

import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Paleta Crystal Blue (familia hue ~210, solo saturacion/luz varian)
C_LIGHT = "#c0d0e2"   # S tier border-light
C_MID   = "#7ba7c9"   # variante media
C_ACC   = "#2d7ab3"   # accent
C_DARK  = "#1a4a7a"   # header fill
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
# PLAN A - 6 semanas (unidades: semanas)
# ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.4, 2.5), dpi=200, constrained_layout=True)

fases_a = [
    ("Fase 0  Limpieza tecnica",        0.0, 1.5, C_MID),
    ("Fase 1  Publicacion y medicion",  1.0, 2.0, C_ACC),
    ("Fase 2  Distribucion y contenido", 3.0, 3.0, C_DARK),
]
for i, (name, start, dur, color) in enumerate(fases_a):
    y = len(fases_a) - 1 - i
    ax.barh(y, dur, left=start, height=0.52, color=color, edgecolor='none', zorder=3)
    ax.text(start + 0.08, y, name, va='center', ha='left',
            fontsize=8.5, color='white', fontweight='bold', zorder=4)

ax.scatter([6.0], [1.5], marker='D', s=55, color=C_DARK, zorder=5)
ax.annotate("Hito: decidir Plan B", xy=(6.0, 1.5), xytext=(4.55, 2.42),
            fontsize=8.2, color=C_DARK, fontweight='bold',
            arrowprops=dict(arrowstyle='-', color=C_DARK, lw=0.7))

ax.set_yticks([])
ax.set_xlim(0, 6.6)
ax.set_ylim(-0.55, 2.85)
ax.set_xticks(range(0, 7))
ax.set_xticklabels([f"S{i}" if i > 0 else "" for i in range(0, 7)])
style_ax(ax)
fig.savefig('/home/z/my-project/scripts/gantt_plan_a.png', facecolor='white')
plt.close(fig)

# ------------------------------------------------------------------
# PLAN B - 12 meses (unidades: meses)
# ------------------------------------------------------------------
fig, ax = plt.subplots(figsize=(7.4, 3.1), dpi=200, constrained_layout=True)

fases_b = [
    ("F1  Pitch tecnico abierto + comunidad", 0, 2, C_MID),
    ("F2  MVP AUDITOR en un dominio",         1.5, 3.5, C_ACC),
    ("F3  Pilotos + SDK SELLO",               5.5, 3.5, C_DARK),
    ("F4  Estandar abierto + red verificadora", 9.0, 3.0, C_LIGHT),
]
names = []
for i, (name, start, dur, color) in enumerate(fases_b):
    y = len(fases_b) - 1 - i
    ax.barh(y, dur, left=start, height=0.52, color=color, edgecolor='none', zorder=3)
    names.append(name)

ax.set_yticks([3, 2, 1, 0])
ax.set_yticklabels(names, fontsize=8.5, color=C_TEXT)
for lbl in ax.get_yticklabels():
    lbl.set_fontweight('bold')

hitos = [(5.0, 2, "H1"), (9.0, 1, "H2"), (12.0, 0, "H3")]
for x, y, tag in hitos:
    ax.scatter([x], [y], marker='D', s=55, color=C_DARK, zorder=5)
    ax.text(x + 0.18, y + 0.34, tag, fontsize=8.5, color=C_DARK,
            fontweight='bold', ha='left', zorder=5)

ax.set_xlim(0, 12.8)
ax.set_ylim(-0.55, 3.85)
ax.set_xticks(range(0, 13, 2))
ax.set_xticklabels([f"M{i}" if i > 0 else "" for i in range(0, 13, 2)])
style_ax(ax)
ax.tick_params(axis='y', length=0)

fig.savefig('/home/z/my-project/scripts/gantt_plan_b.png', facecolor='white')
plt.close(fig)

print("OK: gantt_plan_a.png y gantt_plan_b.png generados")
