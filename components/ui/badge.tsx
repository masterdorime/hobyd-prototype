import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui";

type Tone = "live" | "ending" | "extended" | "closed" | "muted";

const TONES: Record<Tone, string> = {
  live: "bg-red-500/15 text-red-200 border-red-400/20",
  ending: "bg-accent/15 text-accent border-accent/20",
  extended: "bg-sky-500/15 text-sky-200 border-sky-400/20",
  closed: "bg-white/10 text-white/70 border-white/10",
  muted: "bg-white/10 text-white/70 border-white/10",
};

export function Badge({
  tone = "muted",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      {...rest}
      className={cn(
        "tnum inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        TONES[tone],
        className,
      )}
    />
  );
}
