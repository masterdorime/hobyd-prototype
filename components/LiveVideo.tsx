"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Room, Track } from "livekit-client";
export function LiveVideo({ roomId }: { roomId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const [down, setDown] = useState(false);
  useEffect(() => {
    let room: Room | null = null;
    (async () => {
      try {
        const t = await fetch(`/api/livekit-token?roomId=${encodeURIComponent(roomId)}`).then((r) => r.json());
        room = new Room();
        room.on("disconnected", () => setDown(true));
        room.on("trackSubscribed", (track) => {
          if (track.kind === Track.Kind.Video && ref.current)
            ref.current.appendChild(track.attach());
        });
        await room.connect(t.url, t.token);
        room.remoteParticipants.forEach((p) =>
          p.videoTrackPublications.forEach((pub) => pub.track && ref.current?.appendChild(pub.track.attach())));
      } catch { setDown(true); }
    })();
    return () => { room?.disconnect(); };
  }, [roomId]);
  return (
    <div ref={ref} className="aspect-video w-full overflow-hidden rounded-lg bg-black [&_video]:h-full [&_video]:w-full">
      {down && <p className="p-4 text-sm text-white">{t("reconnecting")}</p>}
    </div>
  );
}
