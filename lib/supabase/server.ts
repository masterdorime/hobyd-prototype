import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "../env";
export async function serverDb() {
  const jar = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnon(), {
    cookies: { getAll: () => jar.getAll(), setAll: (all) => all.forEach((c) => jar.set(c)) },
  });
}
