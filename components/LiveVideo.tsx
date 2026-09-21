"use client";
import { useEffect, useRef, useState } from "react";
import { Room } from "livekit-client";
export function LiveVideo({ roomId }: { roomId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    let room: Room | null = null;
    (async () => {
      try {
        const t = await fetch(`/api/livekit-token?roomId=${roomId}`).then((r) => r.json());
        room = new Room();
        room.on("disconnected", () => setDown(true));
        await room.connect(t.url, t.token);
        room.remoteParticipants.forEach((p) =>
          p.videoTrackPublications.forEach((pub) => pub.track && ref.current?.appendChild(pub.track.attach())));
      } catch { setDown(true); }
    })();
    return () => { room?.disconnect(); };
  }, [roomId]);
  return <div ref={ref}>{down && <p>Bidding stays available — reconnecting video…</p>}</div>;
}
