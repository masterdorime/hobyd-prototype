// components/StreamControls.tsx — owner-only Start/End + end-mode dialog.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";

export function StreamControls({ roomId, roomStatus, activeItemId, onChange }:
  { roomId: string; roomStatus: string; activeItemId: string | null; onChange: (status: string) => void }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);

  async function goLive() {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/rooms/${roomId}/go-live`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && body?.status) onChange(body.status);
  }

  async function end(mode: "settle" | "video_only") {
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/rooms/${roomId}/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, item_id: activeItemId }),
    });
    const body = await res.json().catch(() => null);
    setBusy(false);
    setDialog(false);
    if (res.ok && body?.ended) onChange("ended");
  }

  if (roomStatus === "preview")
    return (
      <button onClick={goLive} disabled={busy}
        className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
        {t("goLive")}
      </button>
    );
  if (roomStatus !== "live") return null;
  return (
    <>
      <button onClick={() => setDialog(true)}
        className="pressable rounded-full border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-300">
        {t("endStream")}
      </button>
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("endTitle")}>
          <NeuCard className="flex w-full max-w-sm flex-col gap-3 p-5">
            <h2 className="text-lg font-bold">{t("endTitle")}</h2>
            <button onClick={() => end("settle")} disabled={busy}
              className="pressable rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {t("settleAndClose")}
            </button>
            <p className="-mt-2 text-xs opacity-70">{t("settleNote")}</p>
            <button onClick={() => end("video_only")} disabled={busy}
              className="pressable rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-50">
              {t("videoOnly")}
            </button>
            <p className="-mt-2 text-xs opacity-70">{t("videoOnlyNote")}</p>
          </NeuCard>
        </div>
      )}
    </>
  );
}
