// app/api/items/[id]/close/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
export function shouldClose(o: { status: string; endsAtMs: number; nowMs: number }) {
  return o.status !== "closed" && o.nowMs > o.endsAtMs;
}
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // NOTE: brief sketched `params` as a plain object, but per this repo's
  // Next.js docs (route.js reference: "params: a promise ... v15.0.0-RC")
  // params is a Promise in Next 15+ — hence `await`. `await` also accepts a
  // plain object, so both shapes work.
  const { id } = await ctx.params;
  const db = adminDb();
  const { data: item } = await db.from("items").select("*").eq("id", id).single();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!shouldClose({ status: item.status, endsAtMs: new Date(item.ends_at).getTime(), nowMs: Date.now() }))
    return NextResponse.json({ noop: true });
  const { data: top } = await db.from("bids").select("bidder,amount")
    .eq("item_id", id).order("amount", { ascending: false }).order("created_at").limit(1);
  if (!top?.[0]) {
    await db.from("items").update({ status: "closed" }).eq("id", id);
    return NextResponse.json({ closed: true, winner: null });
  }
  await db.from("items").update({ status: "closed", winner: top[0].bidder, current_price: top[0].amount }).eq("id", id);
  await db.from("orders").upsert(
    { item_id: id, winner: top[0].bidder, status: "pending" },
    { onConflict: "item_id", ignoreDuplicates: true },
  );
  return NextResponse.json({ closed: true, winner: top[0].bidder });
}
