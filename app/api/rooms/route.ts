import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { buildRoomRow, isCategory, validateRoomTitle } from "@/lib/rooms";

export async function GET() {
  const { data } = await adminDb().from("rooms")
    .select("*").in("status", ["lobby", "preview", "live"]).order("created_at");
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const title = validateRoomTitle(body?.title) ? String(body.title).trim() : "HOBYD Live";
  const row = buildRoomRow({
    title,
    seller_name: user.email,
    owner_id: user.id,
    category: isCategory(body?.category) ? body.category : null,
  });
  const { data, error } = await adminDb().from("rooms").insert(row).select().single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(data);
}
