// components/GoLiveDialog.tsx — shared stream-naming dialog.
// Opened by the header Go Live button and the mobile BottomNav Go Live
// button. Captures title (1–80 chars, required) + category upfront so new
// rooms no longer open as untitled "HOBYD Live". Backdrop click and Escape
// close; empty title shows an inline error and never POSTs.
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";
import { FieldInput } from "@/components/ui/input";
import { CATEGORIES } from "@/lib/rooms";
import { cn } from "@/lib/ui";

export function GoLiveDialog({
  locale,
  onClose,
}: {
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit() {
    const name = title.trim();
    if (!name) {
      setError(t("titleRequired"));
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: name, category }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.id) {
        onClose();
        router.push(`/${locale}/live/${body.id}`);
      } else {
        setError(t("actionFailed"));
      }
    } catch {
      setError(t("actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("goLive")}
      onClick={() => { if (!busy) onClose(); }}
    >
      <NeuCard
        className="flex w-full max-w-sm flex-col gap-3 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">{t("goLive")}</h2>
        <label className="flex flex-col gap-1 text-sm">
          {t("streamTitle")}
          <FieldInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sneaker Sunday Drop"
            maxLength={80}
            autoFocus
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span>{t("pickCategory")}</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("pickCategory")}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  "pressable rounded-full border px-3 py-1 text-xs",
                  category === c
                    ? "border-accent/60 bg-accent/10 font-semibold"
                    : "border-white/15",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="pressable rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
        >
          {t("createAndGo")}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="pressable rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      </NeuCard>
    </div>
  );
}
