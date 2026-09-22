// components/effects/CountUp.tsx — reactbits-style price ticker.
// rAF-driven, transform/opacity-free (text only), reduced-motion snaps.
"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { formatIDR } from "@/lib/format";

export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      from.current = value;
      return;
    }
    const start = from.current;
    if (start === value) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 450;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return <span className="tnum">{formatIDR(reduce ? value : shown)}</span>;
}
