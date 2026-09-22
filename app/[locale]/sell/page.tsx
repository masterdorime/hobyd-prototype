// app/[locale]/sell/page.tsx — ultra-fast seller listing (photo + title + price).
// Picks the first lobby/live room, validates with lib/sell, POSTs /api/items.
"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { NeuCard } from "@/components/ui/card";
import { FieldInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateSellInput } from "@/lib/sell";

export default function SellPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const t = useTranslations();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [img, setImg] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setRoomId(rows?.[0]?.id ?? null))
      .catch(() => setRoomId(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const start_price = Number(price);
    const check = validateSellInput({ title, img_url: img, start_price });
    if (!check.ok || !roomId) {
      setError(check.error ?? "invalid");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          title: title.trim(),
          img_url: img.trim(),
          start_price,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "create_failed");
      } else {
        const item = await res.json();
        setDone(item.id);
        setTitle("");
        setImg("");
        setPrice("");
      }
    } catch {
      setError("create_failed");
    } finally {
      setBusy(false);
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
          <label className="flex flex-col gap-1 text-sm">
            Photo URL
            <FieldInput
              value={img}
              onChange={(e) => setImg(e.target.value)}
              placeholder="https://…"
              inputMode="url"
              required
            />
          </label>
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
          {done && (
            <p className="text-sm text-emerald-300">
              Listed.{" "}
              <Link
                href={`/${locale}/live/${roomId}`}
                className="underline"
              >
                Back to live
              </Link>
            </p>
          )}
          <Button type="submit" disabled={busy || !roomId}>
            {busy ? "…" : t("payNow") === "Bayar sekarang" ? "Tayangkan" : "List item"}
          </Button>
        </form>
      </NeuCard>
    </main>
  );
}
