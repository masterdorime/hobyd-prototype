// lib/sell.ts — ultra-fast listing validation (photo + title + price).
export function validateSellInput(o: {
  title: string;
  img_url: string;
  start_price: number;
}): { ok: boolean; error?: string } {
  if (!o.title || o.title.trim().length === 0)
    return { ok: false, error: "invalid_title" };
  if (!o.img_url || o.img_url.trim().length === 0)
    return { ok: false, error: "invalid_image" };
  if (!Number.isInteger(o.start_price) || o.start_price <= 0)
    return { ok: false, error: "invalid_price" };
  return { ok: true };
}
