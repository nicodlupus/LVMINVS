import { USER } from "../data/mock";
import type { Chat } from "../hooks/useChat";
import { Bubble, Typing } from "../ui/chat";
import { IconChev, IconMap, IconMic, IconSpark, IconWave } from "../ui/icons";
import { Header } from "../ui/primitives";
import type { ScreenProps } from "./shared";

const FEATURES = [
  { id: "capture",  title: "Capture Now",     desc: "Record or write it before it fades", primary: true },
  { id: "map",      title: "MindMap",         desc: "See how things connect" },
  { id: "reflect",  title: "Reflection Time", desc: "Go back over something, slowly" },
  { id: "exercise", title: "Trigger Exercise", desc: "Sit with it without acting" },
] as const;

export function HomeScreen({ go, openMenu, chat }: ScreenProps & { chat: Chat }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Welcome back" : "Good evening";

  return (
    <>
      <Header title={`${greeting}, ${USER.name}.`} onMenu={openMenu} onAvatar={() => go("profile")} />

      <div className="scroll flex-1 px-5 pb-2">
        <div className="stagger space-y-3 pt-2">
          {/* the primary action gets more weight */}
          <button onClick={() => go("capture")}
            className="press w-full text-left rounded-[28px] p-5 bg-[var(--accent)] text-[var(--on-accent)]"
            style={{ boxShadow: "var(--shadow)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[21px] font-semibold tracking-tight">Capture Now</div>
                <div className="text-[13.5px] opacity-80 mt-1">Record or write it before it fades</div>
              </div>
              <div className="w-12 h-12 rounded-full grid place-items-center bg-white/18"><IconMic size={24} /></div>
            </div>
          </button>

          {FEATURES.slice(1).map(f => (
            <button key={f.id} onClick={() => go(f.id)}
              className="press w-full text-left rounded-[24px] p-4 bg-[var(--surface)] border border-[var(--border)] flex items-center gap-4"
              style={{ boxShadow: "var(--shadow)" }}>
              <div className="w-11 h-11 rounded-2xl grid place-items-center bg-[var(--soft)] text-[var(--accent)] shrink-0">
                {f.id === "map" ? <IconMap size={21} /> : f.id === "reflect" ? <IconSpark size={21} /> : <IconWave size={21} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-medium text-[var(--text)]">{f.title}</div>
                <div className="text-[12.5px] text-[var(--muted)] mt-0.5">{f.desc}</div>
              </div>
              <IconChev size={18} className="text-[var(--muted)]" />
            </button>
          ))}
        </div>

        {/* running conversation, if any */}
        <div className="mt-6 space-y-2.5">
          {chat.msgs.map(m => <Bubble key={m.id} m={m} onRate={(r, note) => chat.rate(m.id, r, note)} />)}
          {chat.typing && <Typing />}
          <div ref={chat.endRef} />
        </div>

        {chat.msgs.length === 0 && (
          <div className="mt-7 flex items-center gap-2.5 text-[var(--muted)]">
            <div className="w-7 h-7 rounded-full bg-[var(--soft)] grid place-items-center text-[var(--accent)]">
              <IconSpark size={15} />
            </div>
            <span className="text-[14.5px]">How is it going?</span>
          </div>
        )}
      </div>
    </>
  );
}
