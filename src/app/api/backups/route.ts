import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "boveda_vid";
const MAX_BACKUPS = 10;
const MAX_PAYLOAD = 24 * 1024 * 1024; // 24 MB por snapshot

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

// GET /api/backups → lista de respaldos (sin payload, solo metadatos)
export async function GET() {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const rows = await db.backup.findMany({
    where: { vaultId: vid },
    orderBy: { createdAt: "desc" },
    select: { id: true, count: true, note: true, createdAt: true },
  });
  return NextResponse.json({ items: rows });
}

// POST /api/backups → crear snapshot { count, note?, payload } (payload opaco cifrado por el cliente)
export async function POST(req: NextRequest) {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.payload !== "string" || !body.payload) {
    return bad("Falta el payload cifrado");
  }
  if (body.payload.length > MAX_PAYLOAD) return bad("El respaldo excede el tamaño máximo", 413);
  const count = typeof body.count === "number" && body.count >= 0 ? Math.floor(body.count) : 0;
  const note = typeof body.note === "string" ? body.note.slice(0, 120) : null;

  const created = await db.backup.create({ data: { vaultId: vid, count, note, payload: body.payload } });

  // poda: conserva solo los MAX_BACKUPS más recientes
  const all = await db.backup.findMany({
    where: { vaultId: vid },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const stale = all.slice(MAX_BACKUPS).map((b) => b.id);
  if (stale.length) await db.backup.deleteMany({ where: { id: { in: stale }, vaultId: vid } });

  return NextResponse.json({ id: created.id, createdAt: created.createdAt }, { status: 201 });
}

// DELETE /api/backups?id=... → borrar un respaldo
export async function DELETE(req: NextRequest) {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return bad("Falta id");
  const r = await db.backup.deleteMany({ where: { id, vaultId: vid } });
  if (r.count === 0) return bad("Respaldo no encontrado", 404);
  return NextResponse.json({ ok: true });
}

// PATCH /api/backups → restaurar: { backupId }
// El servidor vacía las memorias actuales y reinserta los sobres del snapshot.
// El payload sigue siendo opaco: el cliente lo descifra al recargar.
export async function PATCH(req: NextRequest) {
  const vid = await vaultId();
  if (!vid) return bad("No hay bóveda abierta", 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.backupId !== "string") return bad("Falta backupId");
  const backup = await db.backup.findFirst({ where: { id: body.backupId, vaultId: vid } });
  if (!backup) return bad("Respaldo no encontrado", 404);

  let envelopes: unknown;
  try {
    envelopes = JSON.parse(backup.payload);
  } catch {
    return bad("El respaldo está corrupto", 422);
  }
  if (!Array.isArray(envelopes)) return bad("El respaldo está corrupto", 422);
  if (envelopes.length > 5000) return bad("El respaldo excede el límite de memorias", 413);

  // transacción lógica: borrar todo y reinsertar el snapshot
  await db.memory.deleteMany({ where: { vaultId: vid } });
  for (const e of envelopes) {
    const it = (e ?? {}) as Record<string, unknown>;
    if (typeof it.ct !== "string" || typeof it.iv !== "string") continue;
    await db.memory.create({
      data: {
        vaultId: vid,
        ct: it.ct,
        iv: it.iv,
        kind: typeof it.kind === "string" ? it.kind.slice(0, 40) : "dato",
        source: typeof it.source === "string" ? it.source.slice(0, 40) : "manual",
        sourceRef: typeof it.sourceRef === "string" ? it.sourceRef.slice(0, 200) : null,
        obtainedAt: typeof it.obtainedAt === "string" ? it.obtainedAt.slice(0, 40) : null,
        contentHash: typeof it.contentHash === "string" ? it.contentHash.slice(0, 80) : null,
        imported: Boolean(it.imported),
        verified: Boolean(it.verified),
      },
    });
  }
  return NextResponse.json({ ok: true, restored: envelopes.length });
}
