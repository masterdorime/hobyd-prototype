// components/BidForm.tsx
// Task 11 restyle (visual-only): dark input, amber pressable submit.
// minBid contract and the form action are untouched.
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
        className="tnum w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white placeholder:text-white/40 sm:flex-1"
      />
      <button
        type="submit"
        className="pressable rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink"
      >
        {t("bid")}
      </button>
    </form>
  );
}
