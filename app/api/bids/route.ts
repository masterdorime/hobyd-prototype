// app/api/bids/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export function decideExtension(o: { endsAtMs: number; nowMs: number; used: number; max: number; mode?: string }) {
  if (o.mode === "hard") return { extend: false, newEndsAtMs: o.endsAtMs };
  const delta = o.endsAtMs - o.nowMs;
  const extend = delta >= 0 && delta < 10_000 && o.used < o.max;
  return { extend, newEndsAtMs: extend ? o.endsAtMs + 10_000 : o.endsAtMs };
}
export function allowedByRate(o: { lastMs: number | null; nowMs: number }) {
  return o.lastMs === null || o.nowMs - o.lastMs >= 1000;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

type PlaceBidResult =
  | { ok: true; bid: unknown; extended: boolean }
  | { ok: false; error: string };

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { item_id, amount } = await req.json();
  if (!item_id || !(amount > 0) || !Number.isInteger(amount))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!isUuid(item_id) || !isUuid(user.id))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();

  const { data: itemRow } = await db.from("items").select("auction_mode").eq("id", item_id).single();
  const mode = (itemRow as { auction_mode?: string } | null)?.auction_mode === "hard" ? "hard" : "soft";
  // C1: ONE atomic transaction — advisory lock → row lock → validate →
  // rate-limit → insert → price/extension patch all inside place_bid().
  // nowMs is recomputed inside the txn (M1); the JS clock is not trusted.
  // NOTE: only server-set columns are inserted — a client-supplied
  // created_at in the request body is never read, so it is always ignored.
  const { data, error } = await db.rpc("place_bid", {
    p_item_id: item_id,
    p_bidder: user.id,
    p_amount: amount,
    p_max_extensions: env.maxExtensions(),
    p_mode: mode,
    p_window_secs: env.extensionWindowSecs(),
    p_add_secs: env.extensionAddSecs(),
  });
  // I3: fail-closed — any rpc-level failure never confirms an unknown bid.
  if (error || !data || typeof data !== "object")
    return NextResponse.json({ error: "bid_failed" }, { status: 500 });
  const result = data as PlaceBidResult;
  if (!result.ok) {
    switch (result.error) {
      case "rate_limited":
        return NextResponse.json({ error: "rate_limited" }, { status: 429 });
      case "closed":
      case "too_low":
      case "invalid":
        return NextResponse.json({ error: result.error }, { status: 400 });
      default:
        return NextResponse.json({ error: "bid_failed" }, { status: 500 });
    }
  }
  return NextResponse.json(result.bid);
}
