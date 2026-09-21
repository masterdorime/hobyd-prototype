import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser, isSeller } from "@/lib/auth";
import { env } from "@/lib/env";

export function buildItemRow(
  input: { room_id: string; title: string; img_url: string; start_price: number },
  nowMs: number, durationSec: number,
) {
  return {
    room_id: input.room_id, title: input.title, img_url: input.img_url,
    start_price: input.start_price, current_price: input.start_price,
    ends_at: new Date(nowMs + durationSec * 1000).toISOString(),
    extensions_used: 0, status: "live",
  };
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user || !isSeller(user.email))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  if (!body.room_id || !body.title || !body.img_url || !(body.start_price > 0))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const row = buildItemRow(body, Date.now(), env.auctionSecs());
  const { data, error } = await adminDb().from("items").insert(row).select().single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get("room_id");
  let q = adminDb().from("items").select("*").order("created_at");
  if (room) q = q.eq("room_id", room);
  const { data } = await q;
  return NextResponse.json(data ?? []);
}
