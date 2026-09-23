// lib/chat.ts — chat validation + rate window (pure, tested).
export const CHAT_RATE_MS = 2000;
export const MAX_NICK = 24;
export const MAX_CHAT = 200;
// Overlay budget: visible rows + per-message lifetime (4–6s fade window).
export const CHAT_VISIBLE_COUNT = 8;
export const CHAT_EXPIRE_MS = 5000;

export type ChatCheck = { ok: true } | { ok: false; error: "invalid" | "too_long" };

export function validateChat(o: { nickname: unknown; body: unknown }): ChatCheck {
  const nick = typeof o.nickname === "string" ? o.nickname.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";
  if (!nick || !body) return { ok: false, error: "invalid" };
  if (nick.length > MAX_NICK || body.length > MAX_CHAT)
    return { ok: false, error: "too_long" };
  return { ok: true };
}

export function isRateLimited(lastSentAtMs: number | null, nowMs: number): boolean {
  return lastSentAtMs !== null && nowMs - lastSentAtMs < CHAT_RATE_MS;
}
