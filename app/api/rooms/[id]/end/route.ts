// Owner-only end: { mode: "settle" } force-closes item_id then ends the
// room; { mode: "video_only" } ends the room, item timer untouched.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { canTransition, isUuid } from "@/lib/stream";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const mode = body?.mode;
  if (mode !== "settle" && mode !== "video_only")
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("*").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (room.owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let closed: unknown = null;
  if (mode === "settle" && typeof body?.item_id === "string" && isUuid(body.item_id)) {
    const { data: item } = await db.from("items")
      .select("id,room_id,status,ends_at").eq("id", body.item_id).single();
    if (!item || (item as { room_id: string }).room_id !== id)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    const it = item as { status: string; ends_at: string };
    if (it.status !== "closed" && new Date(it.ends_at).getTime() > Date.now()) {
      const { error: clampErr } = await db.from("items")
        .update({ ends_at: new Date().toISOString() }).eq("id", body.item_id);
      if (clampErr) return NextResponse.json({ error: "settle_failed" }, { status: 500 });
    }
    const { data, error } = await db.rpc("close_item", { p_item_id: body.item_id });
    if (error) return NextResponse.json({ error: "settle_failed" }, { status: 500 });
    closed = data;
  }

  const target = room.status === "live" || room.status === "preview" ? "ended" : room.status;
  if (target !== "ended" || !canTransition(room.status as string, "ended"))
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  const { error: roomErr } = await db.from("rooms").update({ status: "ended" }).eq("id", id);
  if (roomErr) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ended: true, closed });
}
