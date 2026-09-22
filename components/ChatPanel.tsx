// components/ChatPanel.tsx — guest-capable live chat (last 30, Realtime INSERT).
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { browserDb } from "@/lib/supabase/client";

type Msg = { id: string; nickname: string; body: string; created_at: string };
const NICK_KEY = "hobyd_nick";

export function ChatPanel({ roomId, roomStatus }: { roomId: string; roomStatus: string }) {
  const t = useTranslations();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [nick, setNick] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

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
    return () => { db.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => {
    try { setNick(localStorage.getItem(NICK_KEY) ?? ""); } catch { /* private mode */ }
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    const name = nick.trim();
    if (!name) { setHint(t("nicknamePrompt")); return; }
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
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-sm" aria-live="polite">
        {msgs.map((m) => (
          <li key={m.id} className="rounded-lg bg-white/5 px-3 py-1.5">
            <span className="font-semibold">{m.nickname}</span>
            <span className="opacity-80"> — {m.body}</span>
          </li>
        ))}
      </ul>
      {closed ? (
        <p className="text-sm opacity-70">{t("streamEnded")}</p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          <input
            value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24}
            placeholder={t("nicknamePrompt")} aria-label={t("nickname")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200}
              placeholder={t("chatHint")} aria-label={t("send")}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            />
            <button type="submit" disabled={busy}
              className="pressable rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {t("send")}
            </button>
          </div>
          {hint && <p role="alert" className="text-sm text-red-400">{hint}</p>}
        </form>
      )}
    </div>
  );
}
