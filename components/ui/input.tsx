import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui";

export function FieldInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "tnum min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white",
        "placeholder:text-white/40 focus:border-accent/60 focus:outline-none",
        className,
      )}
    />
  );
}
