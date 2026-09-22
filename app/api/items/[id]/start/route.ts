// app/api/items/[id]/start/route.ts — owner-only: lobby → live.
// Opens bidding with a fresh timer; idempotent when already live.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/stream";
import { buildStartUpdate } from "@/lib/auction";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: item } = await db.from("items").select("id,room_id,status,duration_sec").eq("id", id).single();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const it = item as { room_id: string; status: string; duration_sec: number };
  const { data: room } = await db.from("rooms").select("owner_id,category").eq("id", it.room_id).single();
  if (!room || (room as { owner_id: string | null }).owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Server-side category gate (UI pick alone is not enforcement): an
  // uncategorized room can never open bidding.
  if ((room as { category: string | null }).category == null)
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  if (it.status === "live" || it.status === "extended" || it.status === "ending")
    return NextResponse.json(item);
  if (it.status !== "lobby")
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  const { data, error } = await db.from("items")
    .update(buildStartUpdate(Date.now(), it.duration_sec)).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "start_failed" }, { status: 500 });
  return NextResponse.json(data);
}
