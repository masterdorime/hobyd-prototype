// app/api/rooms/[id]/route.ts — public single-room read (owner controls need it).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/stream";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Explicit columns only: callers (watch page) need owner_id + status;
  // never leak wider rows through the public read.
  const { data } = await adminDb().from("rooms")
    .select("id,title,seller_name,owner_id,status,category,thumbnail_url,created_at").eq("id", id).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}
