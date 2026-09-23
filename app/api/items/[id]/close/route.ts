// app/api/items/[id]/close/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
export function shouldClose(o: { status: string; endsAtMs: number; nowMs: number }) {
  return o.status !== "closed" && o.nowMs > o.endsAtMs;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

type CloseItemResult =
  | { ok: true; noop: true }
  | { ok: true; closed: true; winner: string | null }
  | { ok: false; error: string };

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // NOTE: brief sketched `params` as a plain object, but per this repo's
  // Next.js docs (route.js reference: "params: a promise ... v15.0.0-RC")
  // params is a Promise in Next 15+ — hence `await`. `await` also accepts a
  // plain object, so both shapes work.
  const { id } = await ctx.params;
  // Preserve contract: malformed ids read as "not found", not a 500.
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const db = adminDb();
  // C3: ONE atomic transaction — row lock → re-check shouldClose →
  // winner select → close + order upsert all inside close_item().
  const { data, error } = await db.rpc("close_item", { p_item_id: id });
  if (error || !data || typeof data !== "object")
    return NextResponse.json({ error: "close_failed" }, { status: 500 });
  const result = data as CloseItemResult;
  if (!result.ok) {
    if (result.error === "not_found")
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "close_failed" }, { status: 500 });
  }
  if ("closed" in result && result.closed)
    return NextResponse.json({ closed: true, winner: result.winner ?? null });
  return NextResponse.json({ noop: true });
}
