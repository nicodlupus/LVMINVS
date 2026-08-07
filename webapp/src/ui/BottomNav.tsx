import type { Screen } from "../types";
import type { Go } from "../screens/shared";
import { IconHome, IconMap, IconMic, IconSpark, IconUser, type IconProps } from "./icons";

const NAV: { id: Screen; label: string; Icon: (p: IconProps) => JSX.Element }[] = [
  { id: "home",     label: "Home",    Icon: IconHome },
  { id: "capture",  label: "Capture", Icon: IconMic },
  { id: "map",      label: "Map",     Icon: IconMap },
  { id: "reflect",  label: "Reflect", Icon: IconSpark },
  { id: "profile",  label: "Profile", Icon: IconUser },
];

export function BottomNav({ screen, go }: { screen: Screen; go: Go }) {
  const active = screen === "chat" ? "home" : screen === "exercise" ? "map" : screen;
  return (
    <div className="shrink-0 px-3 pb-5 pt-1.5 border-t border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl"
         style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
      <div className="flex">
        {NAV.map(({ id, label, Icon }) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => go(id)}
              className="press flex-1 flex flex-col items-center gap-1 py-1.5"
              style={{ color: on ? "var(--accent)" : "var(--muted)" }}>
              <Icon size={22} sw={on ? 1.9 : 1.5} />
              <span className="text-[10px]" style={{ fontWeight: on ? 600 : 400 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
