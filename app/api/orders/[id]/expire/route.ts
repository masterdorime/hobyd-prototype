// app/api/orders/[id]/expire/route.ts — pending→expired writer for the
// 5-minute payment timeout. Called once from the pay page timeout branch.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const isExpired = (o: { createdAtMs: number; nowMs: number; windowSec: number }) =>
  o.nowMs >= o.createdAtMs + o.windowSec * 1000;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // NOTE: params is a Promise in Next 15+ (see mock-confirm route); `await`
  // also accepts a plain object, so both shapes work.
  const { id } = await ctx.params;
  // Any authenticated caller may trigger expiry: it is a clock fact, not a
  // privilege (winner's pay page fires it; sellers may too). RLS posture
  // unchanged — the write itself goes through service_role after JWT check.
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: order } = await db.from("orders").select("*").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (order.status !== "pending") return NextResponse.json({ noop: true });
  if (!isExpired({ createdAtMs: new Date(order.created_at).getTime(), nowMs: Date.now(), windowSec: env.paySecs() }))
    return NextResponse.json({ error: "not_expired" }, { status: 400 });
  // Conditional write: only flips while still pending, so a concurrent
  // mock-confirm/webhook payment wins the race and we report a no-op.
  const { data: updated } = await db
    .from("orders")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (!updated || updated.length === 0) return NextResponse.json({ noop: true });
  return NextResponse.json({ expired: true });
}
