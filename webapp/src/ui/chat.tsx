import { useRef, useState, type FormEvent } from "react";
import type { Msg } from "../types";
import { IconMic, IconSend, IconStar } from "./icons";

export const Bubble = ({ m, onRate }: {
  m: Msg;
  onRate?: (rating: number, recommendation: string) => void;
}) => (
  <div className={`anim-up flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`}>
    <div className={`max-w-[80%] px-4 py-3 text-[14.5px] leading-relaxed
      ${m.from === "me"
        ? "bg-[var(--accent)] text-[var(--on-accent)] rounded-[20px] rounded-br-[6px]"
        : "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[20px] rounded-bl-[6px]"}`}>
      {m.text}
    </div>
    {m.from === "bot" && onRate && m.text !== "…" && !m.text.startsWith("The companion is offline.") && (
      <Rating msg={m} onRate={onRate} />
    )}
  </div>
);

/* Per-reply feedback: 1-5 stars + optional free-form recommendation.
   Once the user picks a star we surface a small note field; a Send button
   posts everything to /api/feedback so the ratings can inform the policy
   and eventually the fine-tuned model that replaces it. */
function Rating({ msg, onRate }: {
  msg: Msg;
  onRate: (rating: number, recommendation: string) => void;
}) {
  const [rating, setRating] = useState<number>(msg.rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [note, setNote] = useState<string>(msg.recommendation ?? "");
  const [expanded, setExpanded] = useState<boolean>(false);
  const done = !!msg.feedbackSent;

  const pick = (n: number) => {
    if (done) return;
    setRating(n);
    setExpanded(true);
  };

  const submit = () => {
    if (done || !rating) return;
    onRate(rating, note.trim());
  };

  const active = hover || rating;

  if (done) {
    return (
      <div className="mt-1.5 ml-1 flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
        <span>Thanks — logged as</span>
        <span className="text-[var(--accent)]">{"★".repeat(msg.rating ?? 0)}</span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 ml-1 max-w-[80%] w-full">
      <div className="flex items-center gap-2">
        <span className="text-[11.5px] text-[var(--muted)]">How was this?</span>
        <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} out of 5`}
              onMouseEnter={() => setHover(n)}
              onClick={() => pick(n)}
              className="press p-0.5"
              style={{ color: n <= active ? "var(--accent)" : "var(--border)" }}>
              <IconStar size={16} sw={1.4} fill={n <= active ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 rounded-2xl p-3 bg-[var(--surface-2)] border border-[var(--border)] anim-up">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What would have helped? (optional)"
            className="w-full h-16 bg-transparent text-[12.5px] leading-relaxed
                       text-[var(--text)] placeholder:text-[var(--muted)] resize-none outline-none"
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-[var(--muted)]">
              Sent as: rating · this reply · your note. Not your prompt.
            </span>
            <button
              type="button"
              onClick={submit}
              className="press text-[12px] font-medium px-3 py-1.5 rounded-full
                         bg-[var(--accent)] text-[var(--on-accent)]">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
