// app/api/rooms/[id]/route.ts — public single-room read (owner controls need it).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/stream";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data } = await adminDb().from("rooms").select("*").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}
