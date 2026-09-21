import { env } from "./env";
import { serverDb } from "./supabase/server";
export function isSeller(email: string): boolean {
  return env.sellerAllowlist().includes(email.trim().toLowerCase());
}
export async function requireUser() {
  const db = await serverDb();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user?.email) throw Object.assign(new Error("unauthenticated"), { status: 401 });
  return { id: data.user.id, email: data.user.email };
}
