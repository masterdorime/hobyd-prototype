// components/ChatPanel.tsx — TikTok-style live chat overlay.
// Fixed-height, bottom-anchored, overflow-hidden: new messages slide in at
// the bottom, old ones drift up, and each fades out after EXPIRE_MS so the
// container NEVER grows or pushes layout. Rendered over the video box;
// the input row is the only interactive part (pointer-events-auto).
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fadeTransition, momentumSpring } from "@/lib/motion";
import { browserDb } from "@/lib/supabase/client";
import { CHAT_EXPIRE_MS, CHAT_VISIBLE_COUNT } from "@/lib/chat";

type Msg = { id: string; nickname: string; body: string; created_at: string };
const NICK_KEY = "hobyd_nick";
const EXPIRE_MS = CHAT_EXPIRE_MS;
const VISIBLE = CHAT_VISIBLE_COUNT;

export function ChatPanel({ roomId, roomStatus }: { roomId: string; roomStatus: string }) {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [nick, setNick] = useState("");
  const [needNick, setNeedNick] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setMsgs([]);
    const db = browserDb();
    db.from("chat_messages").select("id,nickname,body,created_at").eq("room_id", roomId)
      .order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setMsgs(((data ?? []) as Msg[]).reverse()));
    const ch = db.channel(`chat-${roomId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (p) => setMsgs((m) => [...m, p.new as Msg].slice(-30)))
      .subscribe();
    return () => {
      db.removeChannel(ch);
      timers.current.forEach((id) => clearTimeout(id));
      timers.current.clear();
    };
  }, [roomId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NICK_KEY) ?? "";
      setNick(saved);
      setNeedNick(saved.trim().length === 0);
    } catch {
      setNeedNick(true);
    }
  }, []);

  // Expire each message EXPIRE_MS after it appears (history load included:
  // old backlog clears itself seconds after mount, keeping overlay clean).
  useEffect(() => {
    for (const m of msgs) {
      if (timers.current.has(m.id)) continue;
      timers.current.set(
        m.id,
        setTimeout(() => {
          timers.current.delete(m.id);
          setMsgs((cur) => cur.filter((x) => x.id !== m.id));
        }, EXPIRE_MS),
      );
    }
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = nick.trim();
    if (!name) {
      setNeedNick(true);
      setHint(t("nicknamePrompt"));
      return;
    }
    if (!draft.trim()) return;
    setBusy(true);
    setHint(null);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ room_id: roomId, nickname: name, body: draft.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => null))?.error;
      setHint(err === "rate_limited" ? t("rateLimited") : t("nicknamePrompt"));
      if (err === "rate_limited") setTimeout(() => setHint(null), 2000);
      return;
    }
    try { localStorage.setItem(NICK_KEY, name); } catch { /* private mode */ }
    setDraft("");
  }

  const closed = roomStatus === "ended";
  const visible = msgs.slice(-VISIBLE);

  return (
    <div className="pointer-events-none flex h-56 flex-col justify-end gap-2">
      <ul aria-live="polite" className="flex min-h-0 flex-1 flex-col justify-end gap-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {visible.map((m) => (
            <motion.li
              key={m.id}
              layout
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={reduce ? fadeTransition : momentumSpring}
              className="w-fit max-w-full rounded-full bg-black/45 px-3 py-1 text-[13px] text-white backdrop-blur-md"
            >
              <span className="font-semibold text-accent">{m.nickname}</span>
              <span className="opacity-90"> {m.body}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {closed ? (
        <p className="text-sm text-white/70">{t("streamEnded")}</p>
      ) : (
        <form onSubmit={send} className="pointer-events-auto flex flex-col gap-1.5">
          {needNick && (
            <input
              value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24}
              placeholder={t("nicknamePrompt")} aria-label={t("nickname")}
              className="w-40 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[13px] text-white backdrop-blur-md placeholder:text-white/50"
            />
          )}
          <div className="flex gap-2">
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200}
              placeholder={t("chatHint")} aria-label={t("send")}
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-sm text-white backdrop-blur-md placeholder:text-white/50"
            />
            <button type="submit" disabled={busy}
              className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {t("send")}
            </button>
          </div>
          {hint && (
            <p role="alert" className="text-xs text-red-300">
              {hint}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
