// app/api/orders/webhook/route.ts — Midtrans HTTP notification, signature verify, pending→paid.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/supabase/admin";
export async function POST(req: Request) {
  const n = await req.json();
  const raw = `${n.order_id}${n.status_code}${n.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`;
  const sig = createHash("sha512").update(raw).digest("hex");
  if (sig !== n.signature_key) return NextResponse.json({ error: "bad_sig" }, { status: 403 });
  if (n.transaction_status !== "settlement" && n.transaction_status !== "capture")
    return NextResponse.json({ noop: true });
  // Conditional write: pending→paid only. A late settlement after the 5-min
  // expiry window (or a duplicate notification) matches 0 rows → noop, so a
  // terminal expired/paid order stays terminal and paid_at is never rewritten.
  const { data: updated } = await adminDb()
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", n.order_id)
    .eq("status", "pending")
    .select("id");
  if (!updated || updated.length === 0) return NextResponse.json({ noop: true });
  return NextResponse.json({ paid: true });
}
