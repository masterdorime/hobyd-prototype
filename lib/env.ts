// lib/env.ts — typed env accessors.
// NOTE: Next.js inlines NEXT_PUBLIC_* into the browser bundle ONLY for
// literal `process.env.NEXT_PUBLIC_X` references (Next docs: "dynamic
// lookups will NOT be inlined"). So every accessor below uses a literal
// member expression — never process.env[name] — or client components
// (login, live video) always throw "Missing env" in the browser.
function req(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}
export const env = {
  supabaseUrl: () =>
    req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnon: () =>
    req(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  serviceRole: () =>
    req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  livekitUrl: () =>
    req("NEXT_PUBLIC_LIVEKIT_URL", process.env.NEXT_PUBLIC_LIVEKIT_URL),
  livekitKey: () => req("LIVEKIT_API_KEY", process.env.LIVEKIT_API_KEY),
  livekitSecret: () =>
    req("LIVEKIT_API_SECRET", process.env.LIVEKIT_API_SECRET),
  sellerAllowlist: () =>
    req("SELLER_ALLOWLIST", process.env.SELLER_ALLOWLIST)
      .split(",")
      .map((s) => s.trim().toLowerCase()),
  maxExtensions: () =>
    parseInt(
      req("MAX_SNIPING_EXTENSIONS", process.env.MAX_SNIPING_EXTENSIONS),
      10
    ),
  auctionSecs: () =>
    parseInt(req("AUCTION_DURATION_SEC", process.env.AUCTION_DURATION_SEC), 10),
  paySecs: () =>
    parseInt(req("PAYMENT_WINDOW_SEC", process.env.PAYMENT_WINDOW_SEC), 10),
  extensionWindowSecs: () =>
    parseInt(process.env.EXTENSION_WINDOW_SEC ?? "10", 10),
  extensionAddSecs: () =>
    parseInt(process.env.EXTENSION_ADD_SEC ?? "10", 10),
};
