function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}
export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnon: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRole: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  livekitUrl: () => req("NEXT_PUBLIC_LIVEKIT_URL"),
  livekitKey: () => req("LIVEKIT_API_KEY"),
  livekitSecret: () => req("LIVEKIT_API_SECRET"),
  sellerAllowlist: () =>
    req("SELLER_ALLOWLIST").split(",").map((s) => s.trim().toLowerCase()),
  maxExtensions: () => parseInt(req("MAX_SNIPING_EXTENSIONS"), 10),
  auctionSecs: () => parseInt(req("AUCTION_DURATION_SEC"), 10),
  paySecs: () => parseInt(req("PAYMENT_WINDOW_SEC"), 10),
};
