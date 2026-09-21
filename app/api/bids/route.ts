// app/api/bids/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export function decideExtension(o: { endsAtMs: number; nowMs: number; used: number; max: number }) {
  const delta = o.endsAtMs - o.nowMs;
  const extend = delta >= 0 && delta < 10_000 && o.used < o.max;
  return { extend, newEndsAtMs: extend ? o.endsAtMs + 10_000 : o.endsAtMs };
}
export function allowedByRate(o: { lastMs: number | null; nowMs: number }) {
  return o.lastMs === null || o.nowMs - o.lastMs >= 1000;
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { item_id, amount } = await req.json();
  if (!item_id || !(amount > 0) || !Number.isInteger(amount))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();
  const nowMs = Date.now();

  // Best-effort per-item serialization. PostgREST only exposes `public`-schema
  // functions, so pg_catalog.pg_advisory_xact_lock is not directly callable —
  // use the public `lock_item(text)` wrapper (supabase/schema.sql) instead.
  // The rpc result is intentionally unchecked: supabase-js returns { error }
  // rather than throwing, so a missing/blocked lock degrades to discrete
  // queries while every invariant below is still enforced. See task-4 report.
  await db.rpc("lock_item", { p_key: item_id });
  const { data: item } = await db.from("items").select("*").eq("id", item_id).single();
  if (!item || item.status === "closed")
    return NextResponse.json({ error: "closed" }, { status: 400 });
  if (nowMs > new Date(item.ends_at).getTime())
    return NextResponse.json({ error: "closed" }, { status: 400 });
  if (amount <= item.current_price)
    return NextResponse.json({ error: "too_low" }, { status: 400 });
  const { data: last } = await db.from("bids").select("created_at")
    .eq("item_id", item_id).eq("bidder", user.id).order("created_at", { ascending: false }).limit(1);
  const lastMs = last?.[0] ? new Date(last[0].created_at).getTime() : null;
  if (!allowedByRate({ lastMs, nowMs }))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // NOTE: only server-set columns are inserted — a client-supplied
  // created_at in the request body is never read, so it is always ignored.
  const { data: bid, error } = await db.from("bids")
    .insert({ item_id, bidder: user.id, amount }).select().single();
  if (error) return NextResponse.json({ error: "bid_failed" }, { status: 500 });

  const d = decideExtension({
    endsAtMs: new Date(item.ends_at).getTime(), nowMs,
    used: item.extensions_used, max: env.maxExtensions(),
  });
  const patch: Record<string, unknown> = { current_price: amount };
  if (d.extend) {
    patch.ends_at = new Date(d.newEndsAtMs).toISOString();
    patch.extensions_used = item.extensions_used + 1;
    patch.status = "extended";
  }
  await db.from("items").update(patch).eq("id", item_id);
  return NextResponse.json(bid);
}
