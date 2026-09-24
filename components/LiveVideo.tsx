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
import { MicLevel } from "@/components/MicLevel";
import { classifyMediaError, type MediaFailure } from "@/lib/media";
import { cn } from "@/lib/ui";

type PreviewTracks = { video: LocalVideoTrack | null; audio: LocalAudioTrack | null };

// Reports an attached <video> element's intrinsic size (follows rotation).
function watchVideoSize(
  el: HTMLMediaElement | null,
  cb?: (w: number, h: number) => void,
) {
  if (!(el instanceof HTMLVideoElement) || !cb) return;
  const fire = () => {
    if (el.videoWidth > 0 && el.videoHeight > 0) cb(el.videoWidth, el.videoHeight);
  };
  el.addEventListener("loadedmetadata", fire);
  el.addEventListener("resize", fire);
  fire();
}

export function LiveVideo({
  roomId,
  canPublish = false,
  contain = false,
  fill = false,
  previewPortrait = false,
  audioMuted = false,
  onVideoSize,
  onViewers,
}: {
  roomId: string;
  canPublish?: boolean;
  contain?: boolean;
  fill?: boolean;
  previewPortrait?: boolean;
  audioMuted?: boolean;
  onVideoSize?: (w: number, h: number) => void;
  onViewers?: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const [down, setDown] = useState(false);

  // Publisher-only state (preview-first: tracks are created and previewed
  // locally, published only when the owner taps publishCam).
  const roomRef = useRef<Room | null>(null);
  const tracksRef = useRef<PreviewTracks | null>(null);
  // onVideoSize changes identity every render — route through a ref so the
  // connect-once effects never capture a stale callback.
  const sizeRef = useRef(onVideoSize);
  sizeRef.current = onVideoSize;
  const reportSize = (w: number, h: number) => sizeRef.current?.(w, h);
  const viewRef = useRef(onViewers);
  viewRef.current = onViewers;
  // Viewer audio elements (attached remote tracks). The page mutes the
  // background instance while a second instance plays in the fullscreen
  // overlay — two audible copies must never overlap.
  const mutedRef = useRef(audioMuted);
  mutedRef.current = audioMuted;
  const audioEls = useRef<HTMLMediaElement[]>([]);
  useEffect(() => {
    audioEls.current.forEach((el) => {
      el.muted = audioMuted;
    });
  }, [audioMuted]);

  function attachViewable(el: HTMLMediaElement, video: boolean) {
    if (!ref.current) return;
    ref.current.appendChild(el);
    if (video) {
      watchVideoSize(el, reportSize);
    } else {
      el.muted = mutedRef.current;
      audioEls.current.push(el);
    }
  }
  const [attempt, setAttempt] = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [hasVideo, setHasVideo] = useState(true);
  const [hasAudio, setHasAudio] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [live, setLive] = useState(false);
  const [failure, setFailure] = useState<MediaFailure | null>(null);

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
        const report = () => viewRef.current?.(room ? room.remoteParticipants.size + 1 : 1);
        room.on("participantConnected", report);
        room.on("participantDisconnected", report);
        // NOTE: audio must be attached too — subscribing without attach
        // meant remote mic audio arrived but never played (silent viewers).
        room.on("trackSubscribed", (track) => {
          if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio)
            attachViewable(track.attach(), track.kind === Track.Kind.Video);
        });
        await room.connect(t.url, t.token);
        if (cancelled) return;
        report();
        room.remoteParticipants.forEach((p) =>
          p.trackPublications.forEach((pub) => {
            const tr = pub.track;
            if (!tr) return;
            if (tr.kind === Track.Kind.Video || tr.kind === Track.Kind.Audio)
              attachViewable(tr.attach(), tr.kind === Track.Kind.Video);
          }));
      } catch { if (!cancelled) setDown(true); }
    })();
    return () => {
      cancelled = true;
      audioEls.current = [];
      room?.disconnect();
    };
  }, [roomId, canPublish]);

  // Publisher path — video and audio are created independently so one
  // missing/busy device doesn't kill the other; at least one track is
  // required, otherwise the failure is classified for a precise hint.
  useEffect(() => {
    if (!canPublish) return;
    let cancelled = false;
    setFailure(null);
    setPreviewReady(false);
    (async () => {
      const [video, audio] = await Promise.all([
        createLocalVideoTrack().catch((e) => ({ error: e as unknown })),
        createLocalAudioTrack().catch((e) => ({ error: e as unknown })),
      ]);
      if (cancelled) {
        if (!("error" in video)) video.stop();
        if (!("error" in audio)) audio.stop();
        return;
      }
      const v = "error" in video ? null : video;
      const a = "error" in audio ? null : audio;
      if (!v && !a) {
        setFailure(classifyMediaError(
          "error" in video ? video.error : (audio as { error: unknown }).error,
        ));
        return;
      }
      tracksRef.current = { video: v, audio: a };
      setAudioTrack(a);
      setHasVideo(!!v);
      setHasAudio(!!a);
      if (!v) setCamOn(false);
      if (!a) setMicOn(false);
      if (v) {
        const el = v.attach();
        el.muted = true;
        watchVideoSize(el, reportSize);
        ref.current?.appendChild(el);
      }
      setPreviewReady(true);
    })();
    return () => {
      cancelled = true;
      const room = roomRef.current;
      roomRef.current = null;
      const tr = tracksRef.current;
      tracksRef.current = null;
      setAudioTrack(null);
      room?.disconnect();
      tr?.video?.stop();
      tr?.audio?.stop();
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [canPublish, roomId, attempt]);

  if (!canPublish) {
    return (
      <div ref={ref} className={cn(
        "w-full overflow-hidden bg-black [&_video]:h-full [&_video]:w-full",
        contain
          ? "mx-auto aspect-[9/16] h-full shrink-0 [&_video]:object-contain"
          : fill
            ? "h-full w-full min-w-0 flex-1"
            : "rounded-lg aspect-video",
      )}>
        {down && <p className="p-4 text-sm text-white">{t("reconnecting")}</p>}
      </div>
    );
  }

  function toggleCam() {
    const video = tracksRef.current?.video;
    if (!video) return;
    if (camOn) video.mute();
    else video.unmute();
    setCamOn(!camOn);
  }

  function toggleMic() {
    const audio = tracksRef.current?.audio;
    if (!audio) return;
    if (micOn) audio.mute();
    else audio.unmute();
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
      const report = () => viewRef.current?.(room.remoteParticipants.size + 1);
      room.on("participantConnected", report);
      room.on("participantDisconnected", report);
      await room.connect(tok.url, tok.token);
      report();
      if (tr.video) await room.localParticipant.publishTrack(tr.video);
      if (tr.audio) await room.localParticipant.publishTrack(tr.audio);
      setLive(true);
    } catch {
      setDown(true);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className={cn("glass-panel flex flex-col gap-3 p-3", fill && "h-full min-w-0 flex-1")}>
      <div className={cn(
        "relative overflow-hidden rounded-xl bg-black",
        (contain || fill) && "min-h-0 flex-1",
      )}>
        <div ref={ref} className={cn(
          "w-full [&_video]:h-full [&_video]:w-full",
          contain ? "h-full [&_video]:object-contain"
          : fill ? "min-h-0 flex-1 [&_video]:object-cover"
          : previewPortrait ? "mx-auto aspect-[9/16] max-h-[55dvh] w-auto [&_video]:object-cover"
          : "aspect-video [&_video]:object-cover",
        )} />
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
      {failure ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-red-400">
            {t(failure === "nodevice" ? "noDevice" : failure === "inuse" ? "camInUse" : "camBlocked")}
          </p>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="pressable rounded-full border border-white/15 px-4 py-2 text-sm"
          >
            {t("retry")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <MicLevel track={audioTrack} />
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleCam}
            disabled={!previewReady || !hasVideo}
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
            disabled={!previewReady || !hasAudio}
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
        </div>
      )}
      {down && <p className="text-sm text-white">{t("reconnecting")}</p>}
    </div>
  );
}
