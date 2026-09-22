// app/[locale]/sell/page.tsx — ultra-fast seller listing.
// Photo comes from the OS file picker (input[type=file]), previewed locally,
// then uploaded as multipart/form-data; the API stores it in the
// service_role-only `item-images` bucket. No pasted URLs needed.
"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";
import { FieldInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateSellInput } from "@/lib/sell";
import { MAX_IMAGE_BYTES, validateImageFile } from "@/lib/upload";

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
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

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
    setFile(f);
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
      const res = await fetch("/api/items", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "create_failed");
      } else {
        const item = await res.json();
        setDone(item.id);
        setTitle("");
        setFile(null);
        setPrice("");
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
            {preview && (
              <img
                src={preview}
                alt="Listing preview"
                className="mt-1 h-auto w-full max-w-64 rounded-xl object-cover"
              />
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
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {done && roomId && (
            <p className="text-sm text-emerald-300">
              Listed.{" "}
              <Link href={`/${locale}/live/${roomId}`} className="underline">
                {t("goLive")}
              </Link>
            </p>
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
