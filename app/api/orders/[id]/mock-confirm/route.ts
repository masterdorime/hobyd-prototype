// app/api/orders/[id]/mock-confirm/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
export const canConfirm = (o: { caller: string; winner: string }) => o.caller === o.winner;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // NOTE: brief sketched `params` as a plain object, but per this repo's
  // Next.js docs (route.js reference: "params: a promise ... v15.0.0-RC")
  // params is a Promise in Next 15+ — hence `await`. `await` also accepts a
  // plain object, so both shapes work.
  const { id } = await ctx.params;
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: order } = await db.from("orders").select("*").eq("id", id).single();
  if (!order || order.status !== "pending")
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!canConfirm({ caller: user.id, winner: order.winner }))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ paid: true });
}
