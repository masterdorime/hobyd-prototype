import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { buildRoomRow, isCategory, validateRoomTitle } from "@/lib/rooms";
import { STALE_MS, isStale } from "@/lib/sweep";
import { env } from "@/lib/env";

async function sweepAbandoned() {
  const db = adminDb();
  const now = Date.now();
  const cutoff = new Date(now - STALE_MS).toISOString();
  // Previews can never hold orders (settle/close reject lobby items), so
  // stale ones are safe to erase outright. Items cascade.
  await db.from("rooms").delete().eq("status", "preview").lt("created_at", cutoff);
  // Stale live rooms die only when truly empty — and are ended, never
  // deleted, so items/bids/orders survive for records and disputes.
  const { data: staleLive } = await db.from("rooms")
    .select("id,created_at").eq("status", "live").lt("created_at", cutoff);
  if (!staleLive || staleLive.length === 0) return;
  const svc = new RoomServiceClient(env.livekitUrl(), env.livekitKey(), env.livekitSecret());
  for (const r of staleLive as { id: string; created_at: string }[]) {
    if (!isStale(r.created_at, now)) continue;
    let empty = false;
    try {
      const parts = await svc.listParticipants(r.id);
      empty = parts.length === 0;
    } catch (e) {
      // LiveKit unknown room = nobody ever joined = abandoned.
      // Any other error (network, auth) → fail open, skip the room.
      if ((e as { code?: string })?.code === "not_found") empty = true;
      else continue;
    }
    if (empty) await db.from("rooms").update({ status: "ended" }).eq("id", r.id);
  }
}

export async function GET() {
  // Lazy janitor: no cron in the pilot, so every lobby visit sweeps rooms
  // abandoned >10 min. Fail-open — the lobby always loads.
  try {
    await sweepAbandoned();
  } catch {
    /* abandoned-room cleanup is best-effort */
  }
  const { data } = await adminDb().from("rooms")
    .select("*").in("status", ["lobby", "preview", "live"]).order("created_at");
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const title = validateRoomTitle(body?.title) ? String(body.title).trim() : "HOBYD Live";
  const row = buildRoomRow({
    title,
    seller_name: user.email,
    owner_id: user.id,
    category: isCategory(body?.category) ? body.category : null,
  });
  const { data, error } = await adminDb().from("rooms").insert(row).select().single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(data);
}
