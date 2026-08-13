import { useEffect, useState } from "react";
import { buildContext } from "../api/companion";
import { catOf, fmtDate, fmtDur } from "../data/mock";
import { useChat } from "../hooks/useChat";
import type { Memo, Thought } from "../types";
import { MemoCard } from "../ui/MemoCard";
import { Bubble, Composer, Typing } from "../ui/chat";
import { IconChev, IconMap, IconPlay, IconSpark } from "../ui/icons";
import { Button, Card, Chip, Header } from "../ui/primitives";
import type { ScreenProps } from "./shared";

interface Subject { label?: string; thought?: Thought; memo?: Memo }

/* Reflection stays bounded — after a handful of turns the closing
   actions appear, so the conversation has a shape and an end. */
const REFLECT_TURNS = 4;

export function ReflectScreen({ go, openMenu, thoughts, memos, preset }: ScreenProps & { preset: Thought | null }) {
  const [stage, setStage] = useState<"choose" | "pickThought" | "talk">("choose");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [step, setStep] = useState(0);
  const chat = useChat();

  /* context the model reflects against: the focus item plus prior records */
  const ctx = (subjectObj: Subject | null = subject) => buildContext(thoughts,
    subjectObj?.thought ? `FOCUS THOUGHT: "${subjectObj.thought.thought}"` : "");

  const begin = (label: string, subjectObj: Subject) => {
    setSubject(subjectObj); setStage("talk"); setStep(0);
    chat.setMsgs([]);
    chat.send(label, { mode: "reflect", context: ctx(subjectObj) });
  };

  /* arrived here from a thought on the MindMap → open it straight away */
  useEffect(() => {
    if (preset) begin(`Let's look at: “${preset.thought}”`, { label: "From your MindMap", thought: preset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const answer = (text: string) => {
    setStep(s => s + 1);
    chat.send(text, { mode: "reflect", context: ctx() });
  };

  if (stage === "talk") {
    const done = step >= REFLECT_TURNS;
    const last = chat.msgs[chat.msgs.length - 1];
    const chips = (!chat.typing && last?.from === "bot" && last.chips) || [];
    return (
      <>
        <Header title="Reflection Time" subtitle={subject?.label} onBack={() => setStage("choose")} onAvatar={() => go("profile")} />
        <div className="scroll flex-1 px-5 pb-2 space-y-2.5">
          {subject?.memo && <div className="mb-4"><MemoCard memo={subject.memo} /></div>}
          {subject?.thought && (
            <Card className="p-4 mb-4">
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Reflecting on</div>
              <div className="text-[15px] text-[var(--text)] mt-1.5 leading-snug">“{subject.thought.thought}”</div>
            </Card>
          )}
          {chat.msgs.map(m => (
            <Bubble
              key={m.id}
              m={m}
              onRate={(r, note) => chat.rate(m.id, r, note)}
              onRateClass={(v, corr) => chat.rateClassification(m.id, v, corr)}
            />
          ))}
          {chat.typing && <Typing />}
          {!chat.typing && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1 anim-up">
              {chips.map(c => <Chip key={c} onClick={() => answer(c)}>{c}</Chip>)}
            </div>
          )}
          {done && !chat.typing && (
            <div className="pt-3 anim-up space-y-2.5">
              <Button variant="soft" onClick={() => go("map")}><IconMap size={17} />Open the map</Button>
              <Button variant="outline" onClick={() => { setStage("choose"); chat.setMsgs([]); }}>Reflect on something else</Button>
            </div>
          )}
          <div ref={chat.endRef} className="h-2" />
        </div>
        <Composer placeholder="Type or dictate" onSend={answer} />
      </>
    );
  }

  if (stage === "pickThought") {
    return (
      <>
        <Header title="Previous thoughts" subtitle="From your MindMap" onBack={() => setStage("choose")} onAvatar={() => go("profile")} />
        <div className="scroll flex-1 px-5 pb-6 space-y-3 stagger">
          {thoughts.map(t => (
            <Card key={t.id} className="p-4 press cursor-pointer"
                  onClick={() => begin(`Let's look at: “${t.thought}”`, { label: catOf(t.category).label, thought: t })}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${catOf(t.category).hue} 55% 55%)` }} />
                <span className="text-[11.5px] text-[var(--muted)]">{catOf(t.category).label}</span>
                <span className="text-[11.5px] text-[var(--muted)] ml-auto">{fmtDate(t.date)}</span>
              </div>
              <div className="text-[15px] text-[var(--text)] leading-snug">“{t.thought}”</div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  const latest = memos[0];
  return (
    <>
      <Header title="Reflection Time" onMenu={openMenu} onAvatar={() => go("profile")} />
      <div className="scroll flex-1 px-5 pb-2">
        <h2 className="text-[26px] leading-tight font-light tracking-tight text-[var(--text)] mt-3 mb-7">
          What would you like<br />to reflect on?
        </h2>

        <div className="stagger space-y-3">
          {latest && (
          <button onClick={() => begin("Let's go through my latest voice memo.", { label: "Latest voice memo", memo: latest })}
            className="press w-full text-left rounded-3xl p-4 bg-[var(--surface)] border border-[var(--border)]"
            style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--on-accent)] shrink-0">
                <IconPlay size={19} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15.5px] font-medium text-[var(--text)]">The latest voice memo</div>
                <div className="text-[12.5px] text-[var(--muted)] mt-0.5 truncate">
                  {latest.title} · {fmtDur(latest.duration)} · {fmtDate(latest.date)}
                </div>
              </div>
            </div>
          </button>
          )}

          <button onClick={() => setStage("pickThought")}
            className="press w-full text-left rounded-3xl p-4 bg-[var(--surface)] border border-[var(--border)] flex items-center gap-3.5"
            style={{ boxShadow: "var(--shadow)" }}>
            <div className="w-11 h-11 rounded-2xl grid place-items-center bg-[var(--soft)] text-[var(--accent)] shrink-0">
              <IconMap size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[15.5px] font-medium text-[var(--text)]">A previous thought</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-0.5">{thoughts.length} saved in your map</div>
            </div>
            <IconChev size={18} className="text-[var(--muted)]" />
          </button>

          <button onClick={() => begin("I'd like to start with something else.", { label: "Something else" })}
            className="press w-full text-left rounded-3xl p-4 bg-[var(--surface)] border border-[var(--border)] flex items-center gap-3.5"
            style={{ boxShadow: "var(--shadow)" }}>
            <div className="w-11 h-11 rounded-2xl grid place-items-center bg-[var(--soft)] text-[var(--accent)] shrink-0">
              <IconSpark size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[15.5px] font-medium text-[var(--text)]">Something else</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-0.5">Start from wherever you are</div>
            </div>
            <IconChev size={18} className="text-[var(--muted)]" />
          </button>
        </div>

        <p className="text-[13px] text-[var(--muted)] mt-7 text-center leading-relaxed">
          For something else, type or dictate to begin.
        </p>
      </div>
      <Composer placeholder="Type" onSend={(t) => begin(t, { label: "Something else" })} />
    </>
  );
}
