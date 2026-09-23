// Owner-only room settings (title + category). Replaces the old
// category-only route: same auth shape, partial validated update.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/stream";
import { isCategory, validateRoomTitle } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const patch: { title?: string; category?: string } = {};
  if (body?.title !== undefined) {
    if (!validateRoomTitle(body.title))
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    patch.title = String(body.title).trim();
  }
  if (body?.category !== undefined) {
    if (!isCategory(body.category))
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    patch.category = body.category;
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("owner_id").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((room as { owner_id: string | null }).owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await db.from("rooms").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json(data);
}
