// lib/contact.ts — winner handover contact (pure, tested).
// Stored raw (trimmed); wa.me links use the digit-only form.
export function normalizeContact(v: unknown): string {
  return typeof v === "string" ? v.replace(/[^\d]/g, "") : "";
}

export function validateContact(v: unknown): boolean {
  const digits = normalizeContact(v);
  return digits.length >= 8 && digits.length <= 15;
}

export function waLink(v: string): string {
  return `https://wa.me/${normalizeContact(v)}`;
}
