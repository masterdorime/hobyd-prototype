// components/ui/button.tsx — shadcn-style variants on the Hobyd dark shell.
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type Variant = "primary" | "glass" | "neu" | "danger-ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:brightness-105 shadow-[0_8px_24px_-8px_rgba(251,191,36,0.6)]",
  glass: "bg-white/10 text-white backdrop-blur-md hover:bg-white/15",
  neu: "bg-raised text-white shadow-[5px_5px_14px_#050506,-5px_-5px_14px_#1d1d22] hover:brightness-110",
  "danger-ghost": "bg-transparent text-red-300 hover:bg-red-500/10",
};

export function Button({
  variant = "primary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={cn(
        "pressable inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
}
