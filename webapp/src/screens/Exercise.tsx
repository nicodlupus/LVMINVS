import { useEffect, useRef, useState, type CSSProperties } from "react";
import { fmtDur } from "../data/mock";
import type { Thought } from "../types";
import { IconCheck, IconPause, IconPlay, IconSpark, IconStop } from "../ui/icons";
import { Button, Card, Chip, Header, Sheet } from "../ui/primitives";
import type { ScreenProps } from "./shared";

/* ═══════════════════════════════════════════════════════════════════════
   COMPULSION TRIGGER EXERCISE
   ═══════════════════════════════════════════════════════════════════════ */
const EXERCISE_STEPS = ["scenario", "thought", "compulsion", "before", "sit", "after", "summary"] as const;

export function ExerciseScreen({ go, thoughts, preset, toast }: ScreenProps & { preset: Thought | null }) {
  const [scenario, setScenario] = useState<Thought>(preset || thoughts[0]);
  const [picking, setPicking] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ thought: "", compulsion: "" });
  const [before, setBefore] = useState(7);
  const [after, setAfter] = useState(4);

  /* the sit-with-it timer */
  const TOTAL = 120;
  const [left, setLeft] = useState(TOTAL);
  const [running, setRunning] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => setLeft(l => {
      if (l <= 1) { if (tick.current) clearInterval(tick.current); setRunning(false); return 0; }
      return l - 1;
    }), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  useEffect(() => { if (preset) { setScenario(preset); setStep(0); } }, [preset]);

  /* a brand-new account has no thoughts yet — nothing to rehearse */
  if (!scenario) {
    return (
      <>
        <Header title="Trigger Exercise" onBack={() => go("home")} onAvatar={() => go("profile")} />
        <div className="flex-1 grid place-items-center px-8 text-center">
          <p className="text-[14.5px] text-[var(--muted)] leading-relaxed">
            The exercise works on a situation from your map. Capture a thought
            first, then come back here.
          </p>
        </div>
      </>
    );
  }

  const name = EXERCISE_STEPS[step];
  const next = () => setStep(s => Math.min(s + 1, EXERCISE_STEPS.length - 1));
  const back = () => step === 0 ? go("home") : setStep(s => s - 1);

  const stopAll = () => { setRunning(false); if (tick.current) clearInterval(tick.current); toast("Exercise stopped — that's fine"); go("home"); };

  return (
    <>
      <Header title="Trigger Exercise" subtitle={`Step ${step + 1} of ${EXERCISE_STEPS.length}`}
              onBack={back} onAvatar={() => go("profile")} />

      <div className="shrink-0 px-5 pb-4 flex gap-1.5">
        {EXERCISE_STEPS.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
               style={{ background: i <= step ? "var(--accent)" : "var(--border)" }} />
        ))}
      </div>

      <div className="scroll flex-1 px-5 pb-6">
        <div key={name} className="anim-up">

          {name === "scenario" && (
            <>
              <p className="text-[13px] text-[var(--muted)] mb-3">A situation from your map</p>
              <Card className="p-5 bg-[var(--soft)]">
                <div className="text-[11px] uppercase tracking-wide text-[var(--accent)]">Scenario</div>
                <p className="text-[19px] leading-snug text-[var(--text)] mt-2">
                  You are {scenario.trigger.toLowerCase()} and the thought arrives: “{scenario.thought}”
                </p>
              </Card>
              <button onClick={() => setPicking(true)} className="press w-full mt-3 text-[13.5px] text-[var(--muted)] py-2">
                Choose a different scenario
              </button>
              <p className="text-[13.5px] text-[var(--muted)] leading-relaxed mt-6">
                You'll be asked to bring this to mind, notice the urge, and let it pass without acting on it.
                You can stop at any point.
              </p>
              <Button className="w-full mt-6" onClick={next}>Start exercise</Button>
            </>
          )}

          {name === "thought" && (
            <StepPrompt q="Bringing that to mind — what thought appears now?"
              value={answers.thought} onChange={v => setAnswers(a => ({ ...a, thought: v }))}
              chips={[scenario.thought, "Something worse than usual", "It feels quieter today"]}
              onNext={next} />
          )}

          {name === "compulsion" && (
            <StepPrompt q="What would you normally do to make it stop?"
              value={answers.compulsion} onChange={v => setAnswers(a => ({ ...a, compulsion: v }))}
              chips={[scenario.compulsion, "Ask someone for reassurance", "Check again"]}
              onNext={next} />
          )}

          {name === "before" && (
            <RatingStep title="How strong is the discomfort right now?" value={before} onChange={setBefore}
                        onNext={next} cta="Begin the pause" />
          )}

          {name === "sit" && (
            <div className="flex flex-col items-center pt-4">
              <p className="text-[15.5px] text-center text-[var(--text)] leading-relaxed max-w-[280px]">
                Stay with the discomfort. Don't {answers.compulsion ? answers.compulsion.toLowerCase() : "act on the urge"} — just let it be there.
              </p>

              <div className="relative mt-8 mb-7">
                <svg width="200" height="200" className="-rotate-90">
                  <circle cx="100" cy="100" r="88" stroke="var(--border)" strokeWidth="10" fill="none" />
                  <circle cx="100" cy="100" r="88" stroke="var(--accent)" strokeWidth="10" fill="none"
                    strokeLinecap="round" strokeDasharray={2 * Math.PI * 88}
                    strokeDashoffset={2 * Math.PI * 88 * (1 - left / TOTAL)}
                    style={{ transition: "stroke-dashoffset 1s linear" }} />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-[40px] font-light tabular-nums tracking-tight text-[var(--text)]">{fmtDur(left)}</div>
                    <div className="text-[12.5px] text-[var(--muted)] mt-1">
                      {running ? "Breathe. It will pass." : left === 0 ? "Done" : "Paused"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-2.5">
                {left > 0 && (
                  <Button onClick={() => setRunning(r => !r)}>
                    {running ? <><IconPause size={17} />Pause</> : <><IconPlay size={17} />{left === TOTAL ? "Start" : "Continue"}</>}
                  </Button>
                )}
                <Button variant="soft" onClick={() => { setRunning(false); next(); }}>
                  {left === 0 ? "Continue" : "Finish early"}
                </Button>
                <Button variant="ghost" onClick={stopAll}><IconStop size={16} />Stop exercise</Button>
              </div>
            </div>
          )}

          {name === "after" && (
            <RatingStep title="How is the discomfort now?" value={after} onChange={setAfter}
                        hint={`You started at ${before}/10`} onNext={next} cta="See summary" />
          )}

          {name === "summary" && (
            <div className="pt-2">
              <div className="text-center mb-7">
                <div className="w-16 h-16 rounded-full mx-auto grid place-items-center bg-[var(--soft)] text-[var(--accent)]">
                  <IconCheck size={30} sw={2} />
                </div>
                <h2 className="text-[22px] font-medium text-[var(--text)] mt-4">Exercise complete</h2>
                <p className="text-[13.5px] text-[var(--muted)] mt-1.5">You stayed with it without acting.</p>
              </div>

              <Card className="p-5">
                <div className="flex items-end justify-between gap-6">
                  {([["Before", before], ["After", after]] as const).map(([l, v]) => (
                    <div key={l} className="flex-1 text-center">
                      <div className="h-28 flex items-end justify-center">
                        <div className="w-12 rounded-t-xl transition-all"
                             style={{ height: `${v * 10}%`, background: l === "Before" ? "var(--border)" : "var(--accent)" }} />
                      </div>
                      <div className="text-[20px] font-medium text-[var(--text)] mt-2 tabular-nums">{v}</div>
                      <div className="text-[12px] text-[var(--muted)]">{l}</div>
                    </div>
                  ))}
                  <div className="flex-1 text-center">
                    <div className="text-[30px] font-light tabular-nums"
                         style={{ color: after <= before ? "var(--accent)" : "var(--muted)" }}>
                      {after - before > 0 ? "+" : ""}{after - before}
                    </div>
                    <div className="text-[12px] text-[var(--muted)] mt-1">change</div>
                  </div>
                </div>
              </Card>

              <div className="mt-4 rounded-3xl border border-[var(--border)] overflow-hidden">
                {[["Scenario", scenario.trigger], ["Thought", answers.thought || scenario.thought],
                  ["Urge resisted", answers.compulsion || scenario.compulsion], ["Time sat with it", fmtDur(TOTAL - left)]]
                  .map(([k, v], i) => (
                  <div key={k} className={`px-4 py-3 bg-[var(--surface)] ${i ? "border-t border-[var(--border)]" : ""}`}>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{k}</div>
                    <div className="text-[14px] text-[var(--text)] mt-0.5">{v}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 mt-6">
                <Button onClick={() => { toast("Saved to your map"); go("map"); }}>Save to my map</Button>
                <Button variant="outline" onClick={() => go("home")}>Back to home</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Choose a scenario">
        <div className="space-y-2.5">
          {thoughts.map(t => (
            <button key={t.id} onClick={() => { setScenario(t); setPicking(false); }}
              className="press w-full text-left p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="text-[11.5px] text-[var(--muted)]">{t.trigger}</div>
              <div className="text-[14.5px] text-[var(--text)] mt-1">“{t.thought}”</div>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

function StepPrompt({ q, value, onChange, chips, onNext }: {
  q: string; value: string; onChange: (v: string) => void; chips: string[]; onNext: () => void;
}) {
  return (
    <>
      <div className="flex gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-full bg-[var(--soft)] grid place-items-center text-[var(--accent)] shrink-0 mt-0.5">
          <IconSpark size={15} />
        </div>
        <p className="text-[18px] leading-snug text-[var(--text)]">{q}</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.filter(Boolean).map(c => <Chip key={c} active={value === c} onClick={() => onChange(c)}>{c}</Chip>)}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Or write your own"
        className="w-full h-28 rounded-2xl p-4 bg-[var(--surface-2)] border border-[var(--border)]
                   text-[15px] text-[var(--text)] placeholder:text-[var(--muted)] resize-none" />
      <Button className="w-full mt-5" onClick={onNext} disabled={!value.trim()}>Continue</Button>
    </>
  );
}

function RatingStep({ title, value, onChange, onNext, cta, hint }: {
  title: string; value: number; onChange: (v: number) => void; onNext: () => void; cta: string; hint?: string;
}) {
  const labels = ["None", "Mild", "Noticeable", "Strong", "Overwhelming"];
  return (
    <div className="pt-2">
      <p className="text-[18px] leading-snug text-[var(--text)]">{title}</p>
      {hint && <p className="text-[13px] text-[var(--muted)] mt-1.5">{hint}</p>}

      <div className="text-center my-10">
        <div className="text-[64px] font-extralight tabular-nums leading-none text-[var(--accent)]">{value}</div>
        <div className="text-[13.5px] text-[var(--muted)] mt-2">{labels[Math.min(Math.floor(value / 2.5), 4)]}</div>
      </div>

      <input type="range" min="0" max="10" value={value}
        style={{ "--pct": `${value * 10}%` } as CSSProperties}
        onChange={e => onChange(+e.target.value)} />
      <div className="flex justify-between text-[11.5px] text-[var(--muted)] mt-2 px-0.5">
        <span>0</span><span>10</span>
      </div>

      <Button className="w-full mt-9" onClick={onNext}>{cta}</Button>
    </div>
  );
}
