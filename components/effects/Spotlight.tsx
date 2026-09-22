// components/effects/Spotlight.tsx — aceternity-style hero glow.
// Transform/opacity only, pointer-events-none, hidden under reduced motion.
"use client";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/ui";

export function Spotlight({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" />
      <div className="absolute top-10 left-[15%] h-40 w-72 rounded-full bg-sky-500/10 blur-[100px]" />
    </motion.div>
  );
}
