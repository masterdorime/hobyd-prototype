import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requireUser, isSeller } from "@/lib/auth";
import { env } from "@/lib/env";

export function grantFor(email: string, _allow: string[]) {
  return isSeller(email) ? "publisher" : "subscriber";
}
export async function GET(req: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const room = new URL(req.url).searchParams.get("roomId");
  if (!room) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const grant = grantFor(user.email, env.sellerAllowlist());
  const token = new AccessToken(env.livekitKey(), env.livekitSecret(), {
    identity: user.id, ttl: "1h",
  });
  token.addGrant(grant === "publisher"
    ? { room, roomJoin: true, canPublish: true, canSubscribe: true }
    : { room, roomJoin: true, canPublish: false, canSubscribe: true });
  return NextResponse.json({ token: await token.toJwt(), url: env.livekitUrl() });
}
