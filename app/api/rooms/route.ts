import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser, isSeller } from "@/lib/auth";
import { buildRoomRow } from "@/lib/rooms";

export async function GET() {
  const { data } = await adminDb().from("rooms")
    .select("*").in("status", ["lobby", "live"]).order("created_at");
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user || !isSeller(user.email))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim() || "HOBYD Live";
  const row = buildRoomRow({ title, seller_name: user.email });
  const { data, error } = await adminDb().from("rooms").insert(row).select().single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(data);
}
