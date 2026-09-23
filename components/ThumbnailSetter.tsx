// components/ThumbnailSetter.tsx — owner-only room cover upload.
// File picker + camera capture → POST thumbnail → lobby card image.
"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { validateImageFile } from "@/lib/upload";
import { cropTo16x9 } from "@/lib/image";

export function ThumbnailSetter({ roomId }: { roomId: string }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  async function upload(f: File | null) {
    if (!f || busy) return;
    setError(null);
    const check = validateImageFile({ name: f.name, type: f.type, size: f.size });
    if (!check.ok) {
      setError(check.error ?? "invalid");
      return;
    }
    let shaped = f;
    try {
      shaped = await cropTo16x9(f);
    } catch {
      setError(t("photoFailed"));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", shaped);
      const res = await fetch(`/api/rooms/${roomId}/thumbnail`, { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.thumbnail_url) {
        setError(body?.error ?? "upload_failed");
        return;
      }
      setDone(body.thumbnail_url as string);
    } catch {
      setError("upload_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm opacity-70">{t("setThumbnail")}</span>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => upload(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => upload(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={busy}
          className="pressable rounded-full border border-white/15 px-3 py-1 text-xs disabled:opacity-50"
        >
          {t("itemPhoto")}
        </button>
        <button
          type="button"
          onClick={() => camera.current?.click()}
          disabled={busy}
          className="pressable rounded-full border border-white/15 px-3 py-1 text-xs disabled:opacity-50"
        >
          {t("useCamera")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {done && (
        <img
          src={done}
          alt={t("setThumbnail")}
          loading="lazy"
          className="h-20 w-full rounded-xl object-cover"
        />
      )}
    </div>
  );
}
