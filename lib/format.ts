// lib/format.ts — pure UI formatters (no I/O, fully tested).
export function formatIDR(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function countdownParts(ms: number): { m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return { m, s };
}

const MESSAGES: Record<string, { id: string; en: string }> = {
  closed: { id: "Lelang sudah tutup/berakhir", en: "Auction is closed" },
  too_low: {
    id: "Tawaran harus lebih tinggi dari harga saat ini",
    en: "Bid must be higher than current price",
  },
  rate_limited: {
    id: "Terlalu cepat — tunggu 1 detik",
    en: "Too fast — wait 1 second",
  },
  unauthenticated: { id: "Masuk untuk menawar", en: "Sign in to bid" },
  bid_failed: { id: "Tawaran gagal", en: "Bid failed" },
};

export function bidErrorMessage(code: string, locale: string): string {
  const hit = MESSAGES[code];
  if (!hit) return code;
  return locale.startsWith("id") ? hit.id : hit.en;
}
