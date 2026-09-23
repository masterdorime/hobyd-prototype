// app/[locale]/sell/page.tsx — ultra-fast seller listing.
// Photo comes from the OS file picker (input[type=file]), previewed locally,
// then uploaded as multipart/form-data; the API stores it in the
// service_role-only `item-images` bucket. No pasted URLs needed.
"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";
import { CameraCapture } from "@/components/CameraCapture";
import { ThumbFitPreview } from "@/components/ThumbFitPreview";
import { FieldInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui";
import { validateSellInput } from "@/lib/sell";
import { clampDuration } from "@/lib/auction";
import { MAX_IMAGE_BYTES, validateImageFile } from "@/lib/upload";
import { cropTo16x9 } from "@/lib/image";

export default function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<"soft" | "hard">("soft");
  const [duration, setDuration] = useState(30);
  const [custom, setCustom] = useState("");

  const effDuration = clampDuration(custom === "" ? duration : custom);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);

  function acceptCapture(f: File) {
    acceptFile(f);
  }

  // All stored photos are center-cropped to 16:9 before preview/upload.
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
    const f = e.target.files?.[0] ?? null;
    acceptFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      setStage("room");
      // NOTE: the preview room is created before the image upload, so an
      // upload failure leaves an orphan preview room ("Starting soon" in
      // the lobby). Delete it manually in Supabase (Table Editor → rooms).
      // Auto-expiry/cleanup is explicitly out of scope for the pilot (YAGNI)
      // — no DELETE route is added for this.
      const rr = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!rr.ok) {
        const body = await rr.json().catch(() => null);
        setError(body?.error ?? "room_failed");
        return;
      }
      const room = await rr.json();
      if (!room?.id) {
        setError("room_failed");
        return;
      }
      const rid: string = room.id;
      setRoomId(rid);
      setStage("upload");
      const fd = new FormData();
      fd.set("room_id", rid);
      fd.set("title", title.trim());
      fd.set("start_price", String(start_price));
      fd.set("file", file);
      fd.set("mode", mode);
      fd.set("duration_sec", String(effDuration));
      const res = await fetch("/api/items", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "create_failed");
      } else {
        const item = await res.json();
        setDone(item.id);
        setRoomTitle(title.trim());
        setTitle("");
        setFile(null);
        setPrice("");
        setMode("soft");
        setDuration(30);
        setCustom("");
        if (picker.current) picker.current.value = "";
      }
    } catch {
      setError("create_failed");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6">
      <h1 className="display text-2xl font-bold sm:text-3xl">Sell</h1>
      <p className="mt-1 text-sm opacity-70">
        <Link href={`/${locale}/sales`} className="underline">
          {t("sales")}
        </Link>
      </p>
      <NeuCard className="mt-4 p-4 sm:p-5">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <FieldInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Charizard Holo PSA 9"
              required
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span>Photo</span>
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pick}
              className="tnum w-full rounded-xl border border-dashed border-white/20 bg-black/40 px-3 py-2.5 text-white file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1 file:text-sm file:font-semibold file:text-accent-ink"
            />
            <button
              type="button"
              onClick={() => setShowCam(true)}
              className="pressable self-start rounded-full border border-white/15 px-4 py-2 text-sm"
            >
              {t("useCamera")}
            </button>
            {showCam && (
              <CameraCapture
                onCapture={(f) => {
                  setShowCam(false);
                  acceptCapture(f);
                }}
                onClose={() => setShowCam(false)}
              />
            )}
            {preview && (
              <div className="mt-1">
                <ThumbFitPreview src={preview} alt="Listing preview" />
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Start price (IDR)
            <FieldInput
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="100000"
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
          {done && roomId && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-emerald-300">
                Listed.{" "}
                <Link href={`/${locale}/live/${roomId}`} className="underline">
                  {t("goLive")}
                </Link>
              </p>
              <div className="flex gap-2">
                <FieldInput
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  maxLength={80}
                  aria-label={t("streamTitle")}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  disabled={renaming || !roomTitle.trim()}
                  onClick={async () => {
                    setRenaming(true);
                    setError(null);
                    try {
                      const r = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/settings`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ title: roomTitle.trim() }),
                      });
                      if (!r.ok) setError("create_failed");
                    } catch {
                      setError("create_failed");
                    } finally {
                      setRenaming(false);
                    }
                  }}
                  className="pressable shrink-0 rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-50"
                >
                  {t("save")}
                </button>
              </div>
            </div>
          )}
          {!roomId && !done && (
            <p className="text-xs opacity-60">
              No live room yet — one opens automatically when you list.
            </p>
          )}
          <Button type="submit" disabled={busy || !file}>
            {busy
              ? stage === "room"
                ? "Opening live room…"
                : "Uploading…"
              : t("payNow") === "Bayar sekarang"
                ? "Tayangkan"
                : "List item"}
          </Button>
        </form>
      </NeuCard>
    </main>
  );
}
