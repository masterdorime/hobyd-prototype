// app/api/chat/route.ts — guest-capable chat post. Length + rate-limit
// enforced here; service_role insert. Rejects on ended rooms.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { CHAT_RATE_MS, isRateLimited, validateChat } from "@/lib/chat";
import { isUuid } from "@/lib/stream";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const roomId = typeof body?.room_id === "string" ? body.room_id : "";
  if (!isUuid(roomId)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const check = validateChat({ nickname: body?.nickname, body: body?.body });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const db = adminDb();
  const { data: room } = await db.from("rooms").select("status").eq("id", roomId).single();
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((room as { status: string }).status === "ended")
    return NextResponse.json({ error: "closed" }, { status: 403 });

  const user = await requireUser().catch(() => null);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const senderKey = user ? `u:${user.id}` : `ip:${ip || "unknown"}`;
  const { data: last } = await db.from("chat_messages").select("created_at")
    .eq("room_id", roomId).eq("sender_key", senderKey)
    .order("created_at", { ascending: false }).limit(1).single();
  if (last && isRateLimited(new Date((last as { created_at: string }).created_at).getTime(), Date.now()))
    return NextResponse.json({ error: "rate_limited", retry_ms: CHAT_RATE_MS }, { status: 429 });

  const nickname = String(body.nickname).trim();
  const text = String(body.body).trim();
  const { data, error } = await db.from("chat_messages").insert({
    room_id: roomId,
    user_id: user?.id ?? null,
    sender_key: senderKey,
    nickname,
    body: text,
  }).select().single();
  if (error) return NextResponse.json({ error: "send_failed" }, { status: 500 });
  return NextResponse.json(data);
}
