// app/api/orders/webhook/route.ts — Midtrans HTTP notification, signature verify, pending→paid.
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/supabase/admin";
export async function POST(req: Request) {
  const n = await req.json();
  const raw = `${n.order_id}${n.status_code}${n.gross_amount}${process.env.MIDTRANS_SERVER_KEY}`;
  const sig = createHash("sha512").update(raw).digest("hex");
  if (sig !== n.signature_key) return NextResponse.json({ error: "bad_sig" }, { status: 403 });
  if (n.transaction_status === "settlement" || n.transaction_status === "capture")
    await adminDb().from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", n.order_id);
  return NextResponse.json({ ok: true });
}
