import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { removePhotoFiles } from "@/lib/orbita/storage";
import { ROOMS } from "@/lib/orbita/types";

type Ctx = { params: Promise<{ id: string; photoId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id, photoId } = await ctx.params;
  try {
    const body = (await req.json()) as { room?: string; caption?: string };
    const data: { room?: string; caption?: string; roomConf?: number } = {};
    if (typeof body.room === "string") {
      if (!(ROOMS as readonly string[]).includes(body.room)) {
        return NextResponse.json({ error: "Habitación desconocida" }, { status: 400 });
      }
      data.room = body.room;
      data.roomConf = 1; // override manual = certeza total
    }
    if (typeof body.caption === "string") data.caption = body.caption.slice(0, 160);
    const photo = await db.orbitPhoto.update({ where: { id: photoId }, data });
    void id;
    return NextResponse.json({ photo });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la foto" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, photoId } = await ctx.params;
  try {
    await db.orbitPhoto.delete({ where: { id: photoId } });
    await removePhotoFiles(id, photoId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la foto" }, { status: 500 });
  }
}
