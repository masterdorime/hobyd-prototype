"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Room,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
  type LocalVideoTrack,
} from "livekit-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/ui";

type PreviewTracks = { video: LocalVideoTrack; audio: LocalAudioTrack };

export function LiveVideo({ roomId, canPublish = false }: { roomId: string; canPublish?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const [down, setDown] = useState(false);

  // Publisher-only state (preview-first: tracks are created and previewed
  // locally, published only when the owner taps publishCam).
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<PreviewTracks | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [live, setLive] = useState(false);
  const [blocked, setBlocked] = useState(false);

  // Viewer path — subscribe-only, byte-for-byte the original flow.
  useEffect(() => {
    if (canPublish) return;
    let room: Room | null = null;
    let cancelled = false;
    (async () => {
      try {
        const t = await fetch(`/api/livekit-token?roomId=${encodeURIComponent(roomId)}`).then((r) => r.json());
        if (cancelled) return;
        room = new Room();
        room.on("disconnected", () => { if (!cancelled) setDown(true); });
        room.on("trackSubscribed", (track) => {
          if (track.kind === Track.Kind.Video && ref.current)
            ref.current.appendChild(track.attach());
        });
        await room.connect(t.url, t.token);
        room.remoteParticipants.forEach((p) =>
          p.videoTrackPublications.forEach((pub) => pub.track && ref.current?.appendChild(pub.track.attach())));
      } catch { if (!cancelled) setDown(true); }
    })();
    return () => {
      cancelled = true;
      room?.disconnect();
    };
  }, [roomId, canPublish]);

  // Publisher path — build local tracks and attach a muted self-preview.
  useEffect(() => {
    if (!canPublish) return;
    let cancelled = false;
    setBlocked(false);
    setPreviewReady(false);
    (async () => {
      try {
        const [video, audio] = await Promise.all([
          createLocalVideoTrack(),
          createLocalAudioTrack(),
        ]);
        if (cancelled) {
          video.stop();
          audio.stop();
          return;
        }
        tracksRef.current = { video, audio };
        const el = video.attach();
        el.muted = true;
        ref.current?.appendChild(el);
        setPreviewReady(true);
      } catch {
        if (!cancelled) setBlocked(true);
      }
    })();
    return () => {
      cancelled = true;
      const room = roomRef.current;
      roomRef.current = null;
      const tr = tracksRef.current;
      tracksRef.current = null;
      room?.disconnect();
      tr?.video.stop();
      tr?.audio.stop();
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [canPublish, roomId, attempt]);

  if (!canPublish) {
    return (
      <div ref={ref} className="aspect-video w-full overflow-hidden rounded-lg bg-black [&_video]:h-full [&_video]:w-full">
        {down && <p className="p-4 text-sm text-white">{t("reconnecting")}</p>}
      </div>
    );
  }

  function toggleCam() {
    const tr = tracksRef.current;
    if (!tr) return;
    if (camOn) tr.video.mute();
    else tr.video.unmute();
    setCamOn(!camOn);
  }

  function toggleMic() {
    const tr = tracksRef.current;
    if (!tr) return;
    if (micOn) tr.audio.mute();
    else tr.audio.unmute();
    setMicOn(!micOn);
  }

  async function publish() {
    const tr = tracksRef.current;
    if (!tr || publishing || live) return;
    setPublishing(true);
    setDown(false);
    try {
      const tok = await fetch(`/api/livekit-token?roomId=${encodeURIComponent(roomId)}`).then((r) => {
        if (!r.ok) throw new Error("token");
        return r.json();
      });
      const room = new Room();
      roomRef.current = room;
      room.on("disconnected", () => {
        setLive(false);
        setDown(true);
      });
      await room.connect(tok.url, tok.token);
      await room.localParticipant.publishTrack(tr.video);
      await room.localParticipant.publishTrack(tr.audio);
      setLive(true);
    } catch {
      setDown(true);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="glass-panel flex flex-col gap-3 p-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <div ref={ref} className="aspect-video w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        <div className="pointer-events-none absolute left-3 top-3">
          <Badge tone={live ? "live" : "muted"}>
            {live ? (
              <><span className="live-dot" /> LIVE</>
            ) : (
              t("camPreview")
            )}
          </Badge>
        </div>
      </div>
      {blocked ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-red-400">{t("camBlocked")}</p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="pressable rounded-full border border-white/15 px-4 py-2 text-sm"
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleCam}
            disabled={!previewReady}
            aria-pressed={camOn}
            className={cn(
              "pressable rounded-full border px-4 py-2 text-sm disabled:opacity-50",
              camOn ? "border-white/15 bg-white/5" : "border-red-400/40 text-red-300",
            )}
          >
            {t("cam")}
          </button>
          <button
            type="button"
            onClick={toggleMic}
            disabled={!previewReady}
            aria-pressed={micOn}
            className={cn(
              "pressable rounded-full border px-4 py-2 text-sm disabled:opacity-50",
              micOn ? "border-white/15 bg-white/5" : "border-red-400/40 text-red-300",
            )}
          >
            {t("mic")}
          </button>
          {!live && (
            <button
              type="button"
              onClick={publish}
              disabled={!previewReady || publishing}
              className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
            >
              {publishing ? t("publishing") : t("publishCam")}
            </button>
          )}
        </div>
      )}
      {down && <p className="text-sm text-white">{t("reconnecting")}</p>}
    </div>
  );
}
