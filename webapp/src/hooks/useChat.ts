import { useCallback, useEffect, useRef, useState } from "react";
import { AI_SINK, askCompanion, OFFLINE } from "../api/companion";
import { rid } from "../data/mock";
import type { CompanionData, CompanionMode, Msg } from "../types";

export interface SendOpts {
  mode?: CompanionMode;
  context?: string;
  onData?: (d: CompanionData) => void;
}

export interface Chat {
  msgs: Msg[];
  typing: boolean;
  send: (text: string, opts?: SendOpts) => Promise<CompanionData | undefined>;
  rate: (id: string, rating: number, recommendation: string) => Promise<void>;
  setMsgs: (arr: Msg[]) => void;
  endRef: React.RefObject<HTMLDivElement>;
}

/* Live chat engine — every turn goes to the backend; replies land as a
   sequence of bot bubbles, the last one carrying the quick-reply chips. */
export function useChat(initial: Msg[] = []): Chat {
  const [msgs, setMsgsState] = useState<Msg[]>(initial);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing]);

  const msgsRef = useRef<Msg[]>(initial);
  const commit = (arr: Msg[]) => { msgsRef.current = arr; setMsgsState(arr); };
  const setMsgs = useCallback((arr: Msg[]) => commit(Array.isArray(arr) ? arr : []), []);

  const send = useCallback(async (text: string, { mode = "home", context = "", onData }: SendOpts = {}) => {
    const next: Msg[] = [...msgsRef.current, { id: rid(), from: "me", text }];
    commit(next);
    setTyping(true);
    try {
      const data = await askCompanion({
        mode, context,
        history: next.map(m => ({ role: m.from === "me" ? "user" as const : "assistant" as const, content: m.text })),
      });
      const lines = (data.reply || []).filter(Boolean);
      const bots: Msg[] = (lines.length ? lines : ["…"]).map((t, i, all) => ({
        id: rid(), from: "bot", text: t,
        chips: i === all.length - 1 ? (data.chips || []) : null,
      }));
      commit([...msgsRef.current, ...bots]);
      /* the map/ingest step must never be able to swallow a delivered reply */
      try { AI_SINK.ingest(data); onData?.(data); } catch (err) { console.error("ingest failed", err); }
      return data;
    } catch (e) {
      console.error("companion turn failed", e);
      commit([...msgsRef.current, { id: rid(), from: "bot", text: `${OFFLINE} (${(e as Error).message})` }]);
    } finally {
      setTyping(false);
    }
  }, []);

  /* Record the user's per-reply rating locally and ship it to /api/feedback
     for later analysis. Only the assistant reply + user's optional note
     leaves the device — never the user's prompt or any prior message. */
  const rate = useCallback(async (id: string, rating: number, recommendation: string) => {
    const reply = msgsRef.current.find(m => m.id === id)?.text ?? "";
    /* mark optimistically so the UI stays responsive; downgrade on failure */
    commit(msgsRef.current.map(m => m.id === id ? { ...m, rating, recommendation, feedbackSent: true } : m));
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, recommendation, reply, ts: new Date().toISOString() }),
      });
    } catch (e) {
      console.error("feedback post failed", e);
      commit(msgsRef.current.map(m => m.id === id ? { ...m, feedbackSent: false } : m));
    }
  }, []);

  return { msgs, typing, send, rate, setMsgs, endRef };
}
