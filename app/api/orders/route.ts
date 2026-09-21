// app/api/orders/route.ts — GET ?winner= lists own orders (service_role + JWT check inside).
// RULING R2: GET ?item_id= returns the order only if the caller is the winner (or seller).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser, isSeller } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const sp = new URL(req.url).searchParams;

  const itemId = sp.get("item_id");
  if (itemId) {
    const { data: order } = await db.from("orders").select("*").eq("item_id", itemId).single();
    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (order.winner !== user.id && !isSeller(user.email))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json(order);
  }

  const winner = sp.get("winner");
  const who = winner ?? user.id;
  if (who !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data } = await db.from("orders").select("*").eq("winner", who).order("created_at", { ascending: false });
  return NextResponse.json(data ?? []);
}
