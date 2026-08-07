import { useRef, useState, type FormEvent } from "react";
import type { Msg } from "../types";
import { IconMic, IconSend } from "./icons";

export const Bubble = ({ m }: { m: Msg }) => (
  <div className={`anim-up flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[80%] px-4 py-3 text-[14.5px] leading-relaxed
      ${m.from === "me"
        ? "bg-[var(--accent)] text-[var(--on-accent)] rounded-[20px] rounded-br-[6px]"
        : "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[20px] rounded-bl-[6px]"}`}>
      {m.text}
    </div>
  </div>
);

export const Typing = () => (
  <div className="flex justify-start anim-in">
    <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[20px] rounded-bl-[6px] px-4 py-3.5 flex gap-1.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]"
              style={{ animation: `blink 1.2s ${i * .18}s infinite` }} />
      ))}
    </div>
  </div>
);

/* Text + microphone composer. The mic simulates dictation for now;
   the real build will use the Web Speech API / stored audio. */
export function Composer({ placeholder = "Type", onSend, autoFocus }: {
  placeholder?: string; onSend: (text: string) => void; autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dictate = () => {
    if (listening) { if (timer.current) clearTimeout(timer.current); setListening(false); return; }
    setListening(true);
    timer.current = setTimeout(() => {
      setListening(false);
      setText(t => (t ? t + " " : "") + "I keep going back to check the door");
    }, 2200);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText(""); onSend(v);
  };

  return (
    <form onSubmit={submit} className="shrink-0 px-4 pb-4 pt-2">
      <div className="flex items-center gap-2 rounded-full bg-[var(--surface)] border border-[var(--border)] pl-5 pr-1.5 py-1.5"
           style={{ boxShadow: "var(--shadow)" }}>
        <input
          value={listening ? "" : text}
          autoFocus={autoFocus}
          onChange={e => setText(e.target.value)}
          placeholder={listening ? "Listening…" : placeholder}
          className="flex-1 bg-transparent py-2.5 text-[15px] text-[var(--text)] placeholder:text-[var(--muted)] min-w-0"
        />
        {text.trim()
          ? <button type="submit" className="press w-10 h-10 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--on-accent)]">
              <IconSend size={19} />
            </button>
          : <button type="button" onClick={dictate}
              className={`press relative w-10 h-10 rounded-full grid place-items-center
                ${listening ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)]"}`}>
              {listening && <span className="absolute inset-0 rounded-full bg-[var(--accent)]"
                                  style={{ animation: "pulseRing 1.4s infinite" }} />}
              <IconMic size={20} />
            </button>}
      </div>
    </form>
  );
}
