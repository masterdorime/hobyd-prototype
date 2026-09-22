// lib/upload.ts — seller image validation + storage path (pure, tested).
// Server uploads with service_role; clients never touch Storage directly.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const BUCKET = "item-images";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateImageFile(o: {
  name: string;
  type: string;
  size: number;
}): { ok: boolean; error?: string } {
  if (!o.name || o.name.trim().length === 0)
    return { ok: false, error: "invalid_image" };
  if (!EXT[o.type]) return { ok: false, error: "invalid_type" };
  if (!(o.size > 0) || o.size > MAX_IMAGE_BYTES)
    return { ok: false, error: "too_large" };
  return { ok: true };
}

export function itemImagePath(roomId: string, type: string): string {
  const ext = EXT[type] ?? "jpg";
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now());
  return `${roomId}/${Date.now()}-${rand}.${ext}`;
}
