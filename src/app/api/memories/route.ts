import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "boveda_vid";

async function vaultId(): Promise<string | null> {
  const jar = await cookies();
  const vid = jar.get(COOKIE)?.value;
  if (!vid) return null;
  const exists = await db.vault.findUnique({ where: { id: vid }, select: { id: true } });
  return exists ? vid : null;
}

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function clean(item: Record<string, unknown>) {
  return {
    ct: String(item.ct ?? ""),
    iv: String(item.iv ?? ""),
    kind: typeof item.kind === "string" ? item.kind.slice(0, 40) : "dato",
    source: typeof item.source === "string" ? item.source.slice(0, 40) : "manual",
    sourceRef: typeof item.sourceRef === "string" ? item.sourceRef.slice(0, 200) : null,
    obtainedAt: typeof item.obtainedAt === "string" ? item.obtainedAt.slice(0, 40) : null,
    contentHash: typeof item.contentHash === "string" ? item.contentHash.slice(0, 80) : null,
    imported: Boolean(item.imported),
    verified: Boolean(item.verified),
  };
}

// GET /api/memories → lista de sobres cifrados de esta bóveda
export async function GET() {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const rows = await db.memory.findMany({ where: { vaultId: vid }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items: rows });
}

// POST /api/memories → alta en lote: { items: [ { ct, iv, kind, source, ... } ] }
export async function POST(req: NextRequest) {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const body = await req.json().catch(() => null);
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) return bad("items[] vacío o ausente");
  if (items.length > 500) return bad("Máximo 500 memorias por lote");
  for (const it of items) {
    if (!it || typeof it.ct !== "string" || typeof it.iv !== "string") return bad("Cada item requiere ct e iv");
  }
  const data = items.map((it: Record<string, unknown>) => ({ ...clean(it), vaultId: vid }));
  const created = await db.memory.createMany({ data });
  return NextResponse.json({ created: created.count }, { status: 201 });
}

// PATCH /api/memories?id=... → actualizar un sobre (re-cifrado o verificación)
// Al re-sellar (v2), el cliente también opaca los metadatos: el servidor
// guarda los marcadores que le llegan sin interpretarlos.
export async function PATCH(req: NextRequest) {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("Falta id");
  const body = await req.json().catch(() => null);
  if (!body) return bad("Cuerpo inválido");
  const current = await db.memory.findFirst({ where: { id, vaultId: vid } });
  if (!current) return bad("Memoria no encontrada", 404);
  const patch: Record<string, unknown> = {};
  if (typeof body.ct === "string" && typeof body.iv === "string") {
    patch.ct = body.ct;
    patch.iv = body.iv;
  }
  if (typeof body.verified === "boolean") patch.verified = body.verified;
  if (typeof body.kind === "string") patch.kind = body.kind.slice(0, 40);
  if (typeof body.source === "string") patch.source = body.source.slice(0, 40);
  if (typeof body.sourceRef === "string") patch.sourceRef = body.sourceRef.slice(0, 200);
  else if (body.sourceRef === null) patch.sourceRef = null;
  if (typeof body.obtainedAt === "string") patch.obtainedAt = body.obtainedAt.slice(0, 40);
  else if (body.obtainedAt === null) patch.obtainedAt = null;
  if (typeof body.contentHash === "string") patch.contentHash = body.contentHash.slice(0, 80);
  else if (body.contentHash === null) patch.contentHash = null;
  if (Object.keys(patch).length === 0) return bad("Nada que actualizar");
  const updated = await db.memory.update({ where: { id }, data: patch });
  return NextResponse.json({ item: updated });
}

// DELETE /api/memories?id=... o ?ids=a,b,c
export async function DELETE(req: NextRequest) {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  const ids = sp.get("ids");
  if (id) {
    await db.memory.deleteMany({ where: { id, vaultId: vid } });
    return NextResponse.json({ ok: true, deleted: 1 });
  }
  if (ids) {
    const list = ids.split(",").filter(Boolean).slice(0, 500);
    const r = await db.memory.deleteMany({ where: { id: { in: list }, vaultId: vid } });
    return NextResponse.json({ ok: true, deleted: r.count });
  }
  return bad("Falta id o ids");
}
