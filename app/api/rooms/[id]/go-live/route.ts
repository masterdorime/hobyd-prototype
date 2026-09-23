// Owner-only preview → live. Idempotent: already-live returns 200 with the room.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { canTransition, isUuid } from "@/lib/stream";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: room } = await db.from("rooms").select("*").eq("id", id).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (room.owner_id !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (room.status === "live") return NextResponse.json(room);
  if (!canTransition(room.status as string, "live"))
    return NextResponse.json({ error: "illegal_transition" }, { status: 409 });
  const { data, error } = await db.from("rooms").update({ status: "live" })
    .eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json(data);
}
