// components/BidForm.tsx
"use client";
import { useTranslations } from "next-intl";
export const minBid = (current: number) => current + 1;
export function BidForm({ current, onBid }: { current: number; onBid: (n: number) => void }) {
  const t = useTranslations();
  return (
    <form className="flex w-full flex-col gap-2 sm:flex-row" action={(fd) => onBid(Number(fd.get("amount")))}>
      <input
        name="amount"
        type="number"
        min={minBid(current)}
        required
        className="w-full rounded border px-3 py-2 sm:flex-1"
      />
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        {t("bid")}
      </button>
    </form>
  );
}
