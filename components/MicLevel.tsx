// components/MicLevel.tsx — live input-level meter for the publisher
// preview, so the seller SEES the mic working before going live.
"use client";
import { useEffect, useRef } from "react";
import type { LocalAudioTrack } from "livekit-client";

export function MicLevel({ track }: { track: LocalAudioTrack | null }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!track) return;
    let raf = 0;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack]),
      );
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        if (bar.current)
          bar.current.style.width = `${Math.min(100, Math.round(peak * 140))}%`;
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* meter unavailable — preview still works */
    }
    return () => {
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [track]);
  if (!track) return null;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
      aria-hidden
    >
      <div ref={bar} className="h-full w-0 rounded-full bg-accent" />
    </div>
  );
}
