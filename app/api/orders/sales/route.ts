// app/api/orders/sales/route.ts — seller "my sales" inbox.
// Ownership-scoped: rooms I own → their items that have orders. Any
// signed-in user can sell (open creation), so no allowlist — ownership IS
// the check. Powers the sales page where sellers find winner contacts.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const db = adminDb();
  const { data: rooms } = await db.from("rooms").select("id").eq("owner_id", user.id);
  const roomIds = ((rooms ?? []) as { id: string }[]).map((r) => r.id);
  if (roomIds.length === 0) return NextResponse.json([]);
  const { data: items } = await db.from("items")
    .select("id,room_id,title,img_url,current_price,status").in("room_id", roomIds);
  const list = (items ?? []) as {
    id: string; room_id: string; title: string; img_url: string;
    current_price: number; status: string;
  }[];
  if (list.length === 0) return NextResponse.json([]);
  const { data: orders } = await db.from("orders")
    .select("id,item_id,winner,winner_contact,status,paid_at,created_at")
    .in("item_id", list.map((i) => i.id));
  const byItem = new Map(
    ((orders ?? []) as Record<string, unknown>[]).map((o) => [o.item_id as string, o]),
  );
  return NextResponse.json(
    list
      .filter((i) => byItem.has(i.id))
      .map((i) => ({
        item_id: i.id,
        room_id: i.room_id,
        title: i.title,
        img_url: i.img_url,
        current_price: i.current_price,
        item_status: i.status,
        order: byItem.get(i.id),
      })),
  );
}
