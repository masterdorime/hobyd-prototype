import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
export async function GET() {
  const { data } = await adminDb().from("rooms")
    .select("*").in("status", ["lobby", "live"]).order("created_at");
  return NextResponse.json(data ?? []);
}
