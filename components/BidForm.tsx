// components/BidForm.tsx
"use client";
export const minBid = (current: number) => current + 1;
export function BidForm({ current, onBid }: { current: number; onBid: (n: number) => void }) {
  return (
    <form action={(fd) => onBid(Number(fd.get("amount")))}>
      <input name="amount" type="number" min={minBid(current)} required />
      <button type="submit">Bid</button>
    </form>
  );
}
