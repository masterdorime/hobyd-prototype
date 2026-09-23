// components/ThumbnailSetter.tsx — owner-only room cover upload.
// File picker + camera capture → staged 16:9 crop + fit preview → confirm.
// Nothing posts until the owner taps Upload, so the thumbnail is checked
// before it ever reaches the lobby.
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { validateImageFile } from "@/lib/upload";
import { cropTo16x9 } from "@/lib/image";
import { ThumbFitPreview } from "@/components/ThumbFitPreview";

export function ThumbnailSetter({ roomId }: { roomId: string }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [stagedUrl, setStagedUrl] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!staged) {
      setStagedUrl(null);
      return;
    }
    const url = URL.createObjectURL(staged);
    setStagedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [staged]);

  function clearInputs() {
    if (picker.current) picker.current.value = "";
    if (camera.current) camera.current.value = "";
  }

  // Pick = validate + crop + stage. Upload happens only on confirm.
  async function stage(f: File | null) {
    if (!f || busy) return;
    setError(null);
    setDone(null);
    const check = validateImageFile({ name: f.name, type: f.type, size: f.size });
    if (!check.ok) {
      setError(check.error ?? "invalid");
      return;
    }
    try {
      setStaged(await cropTo16x9(f));
    } catch {
      setStaged(null);
      setError(t("photoFailed"));
    } finally {
      clearInputs();
    }
  }

  async function upload() {
    if (!staged || busy) return;
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", staged);
      const res = await fetch(`/api/rooms/${roomId}/thumbnail`, { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.thumbnail_url) {
        setError(body?.error ?? "upload_failed");
        return;
      }
      setDone(body.thumbnail_url as string);
      setStaged(null);
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
          onChange={(e) => stage(e.target.files?.[0] ?? null)}
          className="hidden"
        />
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => stage(e.target.files?.[0] ?? null)}
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
      {stagedUrl && (
        <div className="flex flex-col gap-2">
          <ThumbFitPreview src={stagedUrl} alt={t("setThumbnail")} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={upload}
              disabled={busy}
              className="pressable rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={() => { setStaged(null); setError(null); }}
              disabled={busy}
              className="pressable rounded-full border border-white/15 px-4 py-1.5 text-xs disabled:opacity-50"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {done && (
        <img
          src={done}
          alt={t("setThumbnail")}
          loading="lazy"
          className="aspect-video w-full rounded-xl object-cover"
        />
      )}
    </div>
  );
}
