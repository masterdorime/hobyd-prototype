// lib/image.ts — upload image shaping (browser canvas).
// Every stored thumbnail/cover is center-cropped to 16:9 at accept time so
// previews are WYSIWYG. cropRect is pure (tested); cropTo16x9 needs DOM.
export function cropRect(
  srcW: number,
  srcH: number,
  targetW = 16,
  targetH = 9,
): { sx: number; sy: number; sw: number; sh: number } {
  const target = targetW / targetH;
  const current = srcW / srcH;
  if (Math.abs(current - target) < 0.01)
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  if (current > target) {
    // Too wide — trim the sides.
    const sw = Math.round(srcH * target);
    return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH };
  }
  // Too tall — trim top/bottom.
  const sh = Math.round(srcW / target);
  return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh };
}

export async function cropTo16x9(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  try {
    const { sx, sy, sw, sh } = cropRect(bmp.width, bmp.height);
    if (sx === 0 && sy === 0 && sw === bmp.width && sh === bmp.height)
      return file;
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}
