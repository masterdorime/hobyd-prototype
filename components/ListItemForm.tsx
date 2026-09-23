// components/ListItemForm.tsx — owner-only mid-stream listing.
// Posts to the CURRENT room (multipart, same contract as the sell page)
// so one live session can auction many items in sequence.
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";
import { FieldInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";
import { CameraCapture } from "@/components/CameraCapture";
import { ThumbFitPreview } from "@/components/ThumbFitPreview";
import { validateSellInput } from "@/lib/sell";
import { clampDuration } from "@/lib/auction";
import { MAX_IMAGE_BYTES, validateImageFile } from "@/lib/upload";
import { cropTo16x9 } from "@/lib/image";

export type ListedItem = {
  id: string;
  title: string;
  img_url: string;
  current_price: number;
  ends_at: string;
  status: string;
  auction_mode: string;
};

export function ListItemForm({
  roomId,
  onListed,
}: {
  roomId: string;
  onListed: (item: ListedItem) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<"soft" | "hard">("soft");
  const [duration, setDuration] = useState(30);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const effDuration = clampDuration(custom === "" ? duration : custom);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0] ?? null);
  }

  async function acceptFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const check = validateImageFile({ name: f.name, type: f.type, size: f.size });
    if (!check.ok) {
      setFile(null);
      setError(
        check.error === "too_large"
          ? `Max ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)}MB`
          : "JPG / PNG / WebP only",
      );
      return;
    }
    try {
      setFile(await cropTo16x9(f));
    } catch {
      setFile(null);
      setError(t("photoFailed"));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const start_price = Number(price);
    const check = validateSellInput({
      title,
      img_url: file?.name ?? "",
      start_price,
    });
    if (!check.ok || !file) {
      setError(check.error ?? "invalid");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("room_id", roomId);
      fd.set("title", title.trim());
      fd.set("start_price", String(start_price));
      fd.set("file", file);
      fd.set("mode", mode);
      fd.set("duration_sec", String(effDuration));
      const res = await fetch("/api/items", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "create_failed");
        return;
      }
      const item = (await res.json()) as ListedItem;
      onListed(item);
      setTitle("");
      setFile(null);
      setPrice("");
      setMode("soft");
      setDuration(30);
      setCustom("");
      if (picker.current) picker.current.value = "";
      setOpen(false);
    } catch {
      setError("create_failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable w-full rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-sm"
      >
        + {t("addItem")}
      </button>
    );
  }

  return (
    <NeuCard className="flex flex-col gap-2 p-4">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("itemTitle")}
          <FieldInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pick}
          aria-label={t("itemPhoto")}
          className="tnum w-full rounded-xl border border-dashed border-white/20 bg-black/40 px-3 py-2 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1 file:text-sm file:font-semibold file:text-accent-ink"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCam(true)}
            className="pressable rounded-full border border-white/15 px-4 py-2 text-sm"
          >
            {t("useCamera")}
          </button>
          {file && <span className="self-center truncate text-xs opacity-70">{file.name}</span>}
        </div>
        {showCam && (
          <CameraCapture
            onCapture={(f) => {
              setShowCam(false);
              acceptFile(f);
            }}
            onClose={() => setShowCam(false)}
          />
        )}
        {preview && (
          <ThumbFitPreview src={preview} alt={t("itemPhoto")} />
        )}
        <label className="flex flex-col gap-1 text-sm">
          {t("itemPrice")}
          <FieldInput
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="numeric"
            type="number"
            min={1}
            required
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span>{t("auctionMode")}</span>
          <div className="flex gap-2" role="group" aria-label={t("auctionMode")}>
            {(["soft", "hard"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "pressable flex-1 rounded-full border px-3 py-1 text-xs",
                  mode === m
                    ? "border-accent/60 bg-accent/10 font-semibold"
                    : "border-white/15",
                )}
              >
                {m === "soft" ? t("softClose") : t("hardClose")}
              </button>
            ))}
          </div>
          <p className="text-xs opacity-60">
            {mode === "soft" ? t("softNote") : t("hardNote")}
          </p>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span>{t("duration")}</span>
          <div className="flex flex-wrap gap-2">
            {[15, 30, 60].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setDuration(s); setCustom(""); }}
                aria-pressed={custom === "" && duration === s}
                className={cn(
                  "pressable rounded-full border px-3 py-1 text-xs",
                  custom === "" && duration === s
                    ? "border-accent/60 bg-accent/10 font-semibold"
                    : "border-white/15",
                )}
              >
                {s}s
              </button>
            ))}
          </div>
          <FieldInput
            value={custom}
            inputMode="numeric"
            type="number"
            min={10}
            max={300}
            placeholder={t("customSeconds")}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => {
              if (!custom) return;
              const clamped = clampDuration(custom);
              setCustom(String(clamped));
              setDuration(clamped);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !file}>
            {t("addItem")}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="pressable rounded-full border border-white/15 px-4 py-2 text-sm"
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    </NeuCard>
  );
}
