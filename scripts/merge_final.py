# -*- coding: utf-8 -*-
"""Fusiona portada (normalizada a A4) + cuerpo en el PDF final."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
cover = PdfReader("/home/z/my-project/scripts/cover.pdf").pages[0]
writer.add_page(normalize(cover))
for p in PdfReader("/home/z/my-project/scripts/body.pdf").pages:
    writer.add_page(normalize(p))

writer.add_metadata({
    "/Title": "Revisión estratégica - Cuello de Botella 2030",
    "/Author": "Z.ai",
    "/Creator": "Z.ai",
    "/Subject": "Pros y contras, competencia idea por idea, fases y calendario de implementacion",
})
out = "/home/z/my-project/download/Revision_Cuello_de_Botella_2030.pdf"
with open(out, "wb") as f:
    writer.write(f)
print("OK:", out, "| paginas:", len(writer.pages))
