// components/CameraCapture.tsx — in-app quick capture for item photos.
// A `capture=` file input opens the folder picker on desktop, so this uses
// getUserMedia directly: portrait-framed preview, front/rear toggle,
// shutter center-crops a 3:4 portrait JPEG into the caller's file flow.
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";

type Facing = "environment" | "user";

export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            aspectRatio: { ideal: 3 / 4 },
          },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
    };
  }, [facing]);

  function shutter() {
    const v = video.current;
    if (!v || busy || v.videoWidth === 0) return;
    setBusy(true);
    try {
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const target = 3 / 4;
      let sw = vw;
      let sh = vh;
      let sx = 0;
      let sy = 0;
      if (vw / vh > target) {
        sw = Math.round(vh * target);
        sx = Math.round((vw - sw) / 2);
      }
      const scale = Math.min(1, 900 / sw);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          setBusy(false);
          if (!blob) return;
          onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("useCamera")}
      onClick={onClose}
    >
      <NeuCard
        className="flex w-full max-w-sm flex-col gap-3 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {failed ? (
          <>
            <p role="alert" className="text-sm text-red-400">{t("camBlocked")}</p>
            <button
              type="button"
              onClick={onClose}
              className="pressable rounded-full border border-white/15 px-4 py-2 text-sm"
            >
              {t("cancel")}
            </button>
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl bg-black">
              <video
                ref={video}
                muted
                playsInline
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
                className="pressable flex-1 rounded-full border border-white/15 px-4 py-2 text-sm"
              >
                {t("switchCamera")}
              </button>
              <button
                type="button"
                onClick={shutter}
                disabled={busy}
                className="pressable flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
              >
                {t("takePhoto")}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="pressable rounded-full border border-white/15 px-4 py-2 text-sm"
            >
              {t("cancel")}
            </button>
          </>
        )}
      </NeuCard>
    </div>
  );
}
