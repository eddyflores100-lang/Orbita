import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "boveda_vid";
const YEAR = 60 * 60 * 24 * 365;

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

// GET /api/vault → estado de la bóveda asociada a la cookie
// Devuelve salt + verifier para derivar la clave EN EL NAVEGADOR.
export async function GET() {
  const jar = await cookies();
  const vid = jar.get(COOKIE)?.value;
  if (!vid) return NextResponse.json({ exists: false });
  const vault = await db.vault.findUnique({ where: { id: vid } });
  if (!vault) return NextResponse.json({ exists: false });
  return NextResponse.json({
    exists: true,
    salt: vault.salt,
    verifier: vault.verifier,
    verifierIv: vault.verifierIv,
    createdAt: vault.createdAt,
  });
}

// POST /api/vault → crear bóveda nueva { salt, verifier, verifierIv }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.salt !== "string" || typeof body.verifier !== "string" || typeof body.verifierIv !== "string") {
    return bad("Faltan salt/verifier/verifierIv");
  }
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) {
    const old = await db.vault.findUnique({ where: { id: existing } });
    if (old) return bad("Ya existe una bóveda en este dispositivo. Desbloquea o bórrala primero.", 409);
  }
  const vault = await db.vault.create({
    data: { salt: body.salt, verifier: body.verifier, verifierIv: body.verifierIv },
  });
  const res = NextResponse.json({ id: vault.id, createdAt: vault.createdAt }, { status: 201 });
  res.cookies.set(COOKIE, vault.id, { httpOnly: true, sameSite: "lax", maxAge: YEAR, path: "/" });
  return res;
}

// DELETE /api/vault → destruir bóveda y todo su contenido (borrado en cascada)
export async function DELETE() {
  const jar = await cookies();
  const vid = jar.get(COOKIE)?.value;
  if (vid) {
    await db.vault.deleteMany({ where: { id: vid } });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", maxAge: 0, path: "/" });
  return res;
}
