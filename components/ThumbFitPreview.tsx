// components/ThumbFitPreview.tsx — WYSIWYG fit check before posting.
// Every display surface (lobby card, item card, rail, mobile card, sales)
// renders thumbnails as `aspect-video object-cover`, so this single labeled
// frame is exactly what buyers will see. Used by the sell page, the
// mid-stream listing form, and the staged room-cover upload.
"use client";
import { useTranslations } from "next-intl";

export function ThumbFitPreview({ src, alt }: { src: string; alt: string }) {
  const t = useTranslations();
  return (
    <figure className="flex flex-col gap-1">
      <img
        src={src}
        alt={alt}
        className="aspect-video w-full max-w-64 rounded-xl object-cover"
      />
      <figcaption className="text-xs opacity-60">{t("thumbPreview")}</figcaption>
    </figure>
  );
}
