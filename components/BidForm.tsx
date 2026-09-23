// components/BidForm.tsx — neu bid panel with quick amounts.
// minBid contract untouched (tested); visual + quick-amounts only.
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { quickAmounts, formatIDR } from "@/lib/format";
import { FieldInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const minBid = (current: number) => current + 1;

export function BidForm({
  current,
  onBid,
}: {
  current: number;
  onBid: (n: number) => void;
}) {
  const t = useTranslations();
  const [val, setVal] = useState("");
  const min = minBid(current);
  return (
    <form
      className="flex w-full flex-col gap-2"
      action={(fd) => {
        onBid(Number(fd.get("amount")));
        setVal("");
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {quickAmounts(current).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setVal(String(q))}
            className="pressable tnum rounded-full bg-white/8 px-3 py-1 text-xs text-white/80 hover:bg-white/15"
          >
            +{formatIDR(q - current).slice(2)}
          </button>
        ))}
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <FieldInput
          name="amount"
          type="number"
          min={min}
          required
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={String(min)}
          inputMode="numeric"
        />
        <Button type="submit" className="sm:w-32">
          {t("bid")}
        </Button>
      </div>
    </form>
  );
}
