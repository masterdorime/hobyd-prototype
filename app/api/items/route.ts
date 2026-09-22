import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { validateListing } from "@/lib/auction";
import { BUCKET, itemImagePath, validateImageFile } from "@/lib/upload";

export function buildItemRow(
  input: { room_id: string; title: string; img_url: string; start_price: number; mode: string; duration_sec: number },
  nowMs: number,
) {
  return {
    room_id: input.room_id, title: input.title, img_url: input.img_url,
    start_price: input.start_price, current_price: input.start_price,
    ends_at: new Date(nowMs + (input.duration_sec as number) * 1000).toISOString(),
    extensions_used: 0, status: "lobby",
    auction_mode: input.mode, duration_sec: input.duration_sec,
  };
}

function isUploadFile(v: unknown): v is File {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as File).arrayBuffer === "function" &&
    typeof (v as File).name === "string"
  );
}

export async function POST(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let input: { room_id: string; title: string; img_url: string; start_price: number; mode: string; duration_sec: number };
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const room_id = String(fd.get("room_id") ?? "");
    const title = String(fd.get("title") ?? "").trim();
    const start_price = Number(fd.get("start_price"));
    const file = fd.get("file");
    if (!room_id || !title || !(start_price > 0) || !isUploadFile(file))
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    const check = validateImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!check.ok)
      return NextResponse.json({ error: check.error }, { status: 400 });
    const path = itemImagePath(room_id, file.type);
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await adminDb()
      .storage.from(BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr)
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    const {
      data: { publicUrl },
    } = adminDb().storage.from(BUCKET).getPublicUrl(path);
    input = {
      room_id, title, img_url: publicUrl, start_price,
      mode: String(fd.get("mode") ?? "soft"),
      duration_sec: Number(fd.get("duration_sec") ?? 30),
    };
  } else {
    const body = await req.json();
    if (!body.room_id || !body.title || !body.img_url || !(body.start_price > 0))
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    input = {
      room_id: body.room_id, title: body.title, img_url: body.img_url, start_price: body.start_price,
      mode: body?.mode ?? "soft",
      duration_sec: Number(body?.duration_sec ?? 30),
    };
  }

  const check = validateListing({ mode: input.mode, durationSec: input.duration_sec });
  if (!check.ok)
    return NextResponse.json({ error: check.error }, { status: 400 });

  const row = buildItemRow(input, Date.now());
  const { data, error } = await adminDb().from("items").insert(row).select().single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get("room_id");
  let q = adminDb().from("items").select("*").order("created_at");
  if (room) q = q.eq("room_id", room);
  const { data } = await q;
  return NextResponse.json(data ?? []);
}
