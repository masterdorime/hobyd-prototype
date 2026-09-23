// app/api/rooms/[id]/thumbnail/route.ts — owner-only room cover.
// Multipart file → item-images bucket → rooms.thumbnail_url. Shown on
// lobby cards; unset rooms simply render no image.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/stream";
import { BUCKET, isUploadFile, itemImagePath, validateImageFile } from "@/lib/upload";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("owner_id").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((room as { owner_id: string | null }).owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!isUploadFile(file))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const check = validateImageFile({ name: file.name, type: file.type, size: file.size });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const path = itemImagePath(`thumbs/${id}`, file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  const {
    data: { publicUrl },
  } = db.storage.from(BUCKET).getPublicUrl(path);
  const { error: dbErr } = await db.from("rooms").update({ thumbnail_url: publicUrl }).eq("id", id);
  if (dbErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ thumbnail_url: publicUrl });
}
