// Winner-only handover contact save. The seller reads it from the same
// win page (order viewable by winner or allowlisted seller).
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/stream";
import { validateContact } from "@/lib/contact";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!validateContact(body?.contact))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = adminDb();
  const { data: order } = await db.from("orders").select("winner").eq("id", id).single();
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((order as { winner: string }).winner !== user.id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const contact = String(body.contact).trim();
  const { data, error } = await db.from("orders").update({ winner_contact: contact }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json(data);
}
