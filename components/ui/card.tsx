import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export function GlassCard({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md",
        "shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]",
        className,
      )}
    />
  );
}

export function NeuCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-white/5 bg-raised",
        "shadow-[8px_8px_24px_#050506,-8px_-8px_24px_#1d1d22]",
        className,
      )}
    />
  );
}
