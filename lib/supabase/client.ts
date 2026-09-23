import { createBrowserClient } from "@supabase/ssr";
import { env } from "../env";
export const browserDb = () =>
  createBrowserClient(env.supabaseUrl(), env.supabaseAnon());
