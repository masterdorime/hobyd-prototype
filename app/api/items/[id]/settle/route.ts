// app/api/items/[id]/settle/route.ts — owner-only early close.
// Clamps ends_at to now, then close_item() performs the winner lock +
// order upsert (idempotent: concurrent settles collapse to one order).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/stream";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: item } = await db.from("items")
    .select("id,room_id,status,ends_at").eq("id", id).single();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const it = item as { room_id: string; status: string; ends_at: string };
  const { data: room } = await db.from("rooms").select("owner_id").eq("id", it.room_id).single();
  if (!room || (room as { owner_id: string | null }).owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (it.status === "closed") return NextResponse.json({ noop: true });
  if (it.status === "lobby")
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  if (new Date(it.ends_at).getTime() > Date.now()) {
    const { error: clampErr } = await db.from("items")
      .update({ ends_at: new Date().toISOString() }).eq("id", id);
    if (clampErr) return NextResponse.json({ error: "settle_failed" }, { status: 500 });
  }
  const { data, error } = await db.rpc("close_item", { p_item_id: id });
  if (error || !data || typeof data !== "object")
    return NextResponse.json({ error: "settle_failed" }, { status: 500 });
  const result = data as { ok: boolean };
  if (!result.ok) return NextResponse.json({ error: "settle_failed" }, { status: 500 });
  if ("closed" in result && (result as { closed?: boolean }).closed)
    return NextResponse.json({ closed: true, winner: (result as { winner?: string | null }).winner ?? null });
  return NextResponse.json({ noop: true });
}
