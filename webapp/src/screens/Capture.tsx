import { useEffect, useRef, useState } from "react";
import { fmtDur } from "../data/mock";
import type { Memo } from "../types";
import { MemoCard } from "../ui/MemoCard";
import { IconCheck, IconMic, IconTrash } from "../ui/icons";
import { Button, Header } from "../ui/primitives";
import type { ScreenProps } from "./shared";

const RECORD_HINTS = [
  "the moment it started — where you were, what you were doing",
  "the exact thought, in your own words",
  "what your body did — hands, breath, chest",
];

const WRITE_STARTERS = [
  "I just checked the lock again and…",
  "The thought came back while…",
  "I couldn't stop replaying…",
];

/* Recording is simulated — a real build stores audio, not a transcript. */
export function CaptureScreen({ go, onSaveMemo, onSaveThought, toast }: ScreenProps & {
  onSaveMemo: (m: Memo) => void; onSaveThought: (text: string) => void;
}) {
  const [tab, setTab] = useState<"record" | "write">("record");
  const [phase, setPhase] = useState<"idle" | "recording" | "review">("idle");
  const [secs, setSecs] = useState(0);
  const [text, setText] = useState("");
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  const start = () => { setPhase("recording"); setSecs(0); tick.current = setInterval(() => setSecs(s => s + 1), 1000); };
  const stop  = () => { if (tick.current) clearInterval(tick.current); setPhase("review"); };
  const discard = () => { if (tick.current) clearInterval(tick.current); setSecs(0); setPhase("idle"); };

  const saveMemo = () => {
    onSaveMemo({ id: "m" + Date.now(), title: "Voice memo", duration: secs || 12, date: new Date().toISOString(), linked: null });
    toast("Saved as audio · kept offline");
    setPhase("idle"); setSecs(0); go("home");
  };
  const saveText = () => {
    onSaveThought(text.trim());
    toast("Thought saved");
    setText(""); go("home");
  };

  return (
    <>
      <Header title="Capture Now" subtitle="Nothing is transcribed until you ask" onBack={() => go("home")} onAvatar={() => go("profile")} />

      {/* mode switch */}
      <div className="shrink-0 px-5 pt-1 pb-4">
        <div className="flex p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
          {([["record", "Record"], ["write", "Write"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); setPhase("idle"); }}
              className={`press flex-1 py-2.5 rounded-xl text-[14px] font-medium
                ${tab === id ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--muted)]"}`}
              style={tab === id ? { boxShadow: "var(--shadow)" } : {}}>{label}</button>
          ))}
        </div>
      </div>

      <div className="scroll flex-1 px-5 pb-6">
        {tab === "record" ? (
          <div className="flex flex-col items-center pt-6">
            {phase !== "review" ? (
              <>
                <button onClick={phase === "idle" ? start : stop}
                  className="press relative w-40 h-40 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--on-accent)]"
                  style={{ boxShadow: "0 18px 40px -18px var(--accent)" }}>
                  {phase === "recording" && <>
                    <span className="absolute inset-0 rounded-full bg-[var(--accent)]" style={{ animation: "pulseRing 2s infinite" }} />
                    <span className="absolute inset-0 rounded-full bg-[var(--accent)]" style={{ animation: "pulseRing 2s .6s infinite" }} />
                  </>}
                  {phase === "recording"
                    ? <div className="flex items-end gap-1.5 h-12 wave">
                        {[...Array(7)].map((_, i) =>
                          <span key={i} style={{ height: 44, animationDelay: `${i * .12}s`, animationDuration: `${.7 + (i % 3) * .2}s` }} />)}
                      </div>
                    : <IconMic size={54} sw={1.3} />}
                </button>

                <div className="mt-7 text-center">
                  {phase === "recording" ? (
                    <>
                      <div className="text-[34px] font-light tabular-nums tracking-tight text-[var(--text)]">{fmtDur(secs)}</div>
                      <div className="text-[13px] text-[var(--muted)] mt-1 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Recording · tap to stop
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-[17px] font-medium text-[var(--text)]">Tap to start recording</div>
                      <p className="text-[13.5px] text-[var(--muted)] mt-2 max-w-[260px] leading-relaxed">
                        Speak freely. It's saved as audio, not turned into text, so nothing interrupts you.
                      </p>

                      <div className="mt-6 w-full max-w-[320px] mx-auto text-left rounded-2xl p-4 bg-[var(--surface-2)] border border-[var(--border)]">
                        <div className="text-[11.5px] uppercase tracking-wider text-[var(--muted)] mb-2">Try describing</div>
                        <ul className="space-y-1.5">
                          {RECORD_HINTS.map(h => (
                            <li key={h} className="text-[13px] leading-snug text-[var(--text)] flex gap-2">
                              <span className="text-[var(--accent)] shrink-0">·</span><span>{h}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 text-[11.5px] text-[var(--muted)] leading-relaxed">
                          One thought at a time. No structure needed — you can label it later.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              /* memo review card */
              <div className="w-full anim-up">
                <div className="text-center mb-5">
                  <div className="text-[17px] font-medium text-[var(--text)]">Ready to keep?</div>
                  <div className="text-[13px] text-[var(--muted)] mt-1">Stored on your device</div>
                </div>
                <MemoCard memo={{ title: "New voice memo", duration: secs || 12, date: new Date().toISOString() }} />
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <Button variant="outline" onClick={discard}><IconTrash size={17} />Delete</Button>
                  <Button onClick={saveMemo}><IconCheck size={17} sw={2.2} />Save</Button>
                </div>
                <button onClick={saveMemo} className="press w-full mt-3 text-[13.5px] text-[var(--muted)] py-2">
                  Save and reflect on it later
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="anim-up">
            <textarea
              value={text} onChange={e => setText(e.target.value)} autoFocus
              placeholder="What just happened, and what went through your mind?"
              className="w-full h-56 rounded-3xl p-5 bg-[var(--surface)] border border-[var(--border)]
                         text-[15.5px] leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] resize-none"
              style={{ boxShadow: "var(--shadow)" }} />
            <div className="flex items-center justify-between mt-3 px-1">
              <span className="text-[12px] text-[var(--muted)]">{text.trim().split(/\s+/).filter(Boolean).length} words</span>
              <span className="text-[12px] text-[var(--muted)]">Categorise it later</span>
            </div>

            {!text.trim() && (
              <div className="mt-4 rounded-2xl p-4 bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[11.5px] uppercase tracking-wider text-[var(--muted)] mb-2">Not sure where to start?</div>
                <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mb-3">
                  Write the moment plainly — the trigger, the thought, what your body did. Full sentences aren't required.
                </p>
                <div className="flex flex-wrap gap-2">
                  {WRITE_STARTERS.map(s => (
                    <button key={s} onClick={() => setText(s + " ")}
                      className="press text-left text-[12.5px] px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-5">
              <Button variant="outline" onClick={() => go("home")}>Cancel</Button>
              <Button onClick={saveText} disabled={!text.trim()}><IconCheck size={17} sw={2.2} />Save</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
