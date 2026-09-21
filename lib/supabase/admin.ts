import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
export const adminDb = () => createClient(env.supabaseUrl(), env.serviceRole());
