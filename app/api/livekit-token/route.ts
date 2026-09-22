import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requireUser } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/stream";

export function grantFor(userId: string, ownerId: string | null) {
  return ownerId !== null && userId === ownerId ? "publisher" : "subscriber";
}

export async function GET(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const room = new URL(req.url).searchParams.get("roomId");
  if (!room || !isUuid(room)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { data } = await adminDb().from("rooms").select("owner_id").eq("id", room).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const grant = grantFor(user.id, data.owner_id as string | null);
  const token = new AccessToken(env.livekitKey(), env.livekitSecret(), {
    identity: user.id, ttl: "1h",
  });
  token.addGrant(grant === "publisher"
    ? { room, roomJoin: true, canPublish: true, canSubscribe: true }
    : { room, roomJoin: true, canPublish: false, canSubscribe: true });
  return NextResponse.json({ token: await token.toJwt(), url: env.livekitUrl() });
}
