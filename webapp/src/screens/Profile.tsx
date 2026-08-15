import { useState } from "react";
import { useUser } from "../data/user";
import { ACCENTS, useTheme } from "../theme/ThemeProvider";
import type { MenuItem } from "../types";
import { IconCheck, IconChev, IconClose, IconPen } from "../ui/icons";
import { Button, Card, Header, SectionLabel, Sheet } from "../ui/primitives";
import type { Go, ScreenProps } from "./shared";

export const MENU_ITEMS: MenuItem[] = [
  { id: "account",    label: "Account settings" },
  { id: "profile",    label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "privacy",    label: "Privacy settings" },
  { id: "terms",      label: "Terms and conditions" },
  { id: "delete",     label: "Delete account", danger: true },
  { id: "logout",     label: "Log out", danger: true },
];

export function ProfileScreen({ openMenu, thoughts, memos, openSetting }: ScreenProps & {
  openSetting: (m: MenuItem) => void;
}) {
  const user = useUser();
  const stats: [string, number][] = [
    ["Thoughts", thoughts.length],
    ["Memos", memos.length],
    ["Exercises", 0],
  ];
  return (
    <>
      <Header title="Profile" onMenu={openMenu} onAvatar={() => {}} />
      <div className="scroll flex-1 px-5 pb-6">
        <div className="flex flex-col items-center pt-4 pb-7">
          <div className="w-24 h-24 rounded-full border-2 border-[var(--border)] grid place-items-center"
               style={{ background: `hsl(${user.hue} 55% 55%)`, color: "white",
                        fontSize: 34, fontWeight: 600 }}>
            {user.initials}
          </div>
          <div className="text-[20px] font-medium text-[var(--text)] mt-3.5">{user.fullName}</div>
          <div className="text-[13px] text-[var(--muted)] mt-0.5">Here since {user.since}</div>
        </div>

        <Card className="p-4 flex">
          {stats.map(([l, v], i) => (
            <div key={l} className={`flex-1 text-center ${i ? "border-l border-[var(--border)]" : ""}`}>
              <div className="text-[22px] font-medium text-[var(--text)] tabular-nums">{v}</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">{l}</div>
            </div>
          ))}
        </Card>

        <div className="mt-6">
          <SectionLabel>Appearance</SectionLabel>
          <Card className="p-5"><AppearanceControls /></Card>
        </div>

        <div className="mt-6">
          <SectionLabel>Account</SectionLabel>
          <Card className="overflow-hidden">
            {MENU_ITEMS.filter(m => m.id !== "appearance").map((m, i) => (
              <button key={m.id} onClick={() => openSetting(m)}
                className={`press w-full px-4 py-3.5 flex items-center gap-3 text-left
                            ${i ? "border-t border-[var(--border)]" : ""}`}>
                <span className={`text-[14.5px] flex-1 ${m.danger ? "text-red-500" : "text-[var(--text)]"}`}>{m.label}</span>
                <IconChev size={16} className="text-[var(--muted)]" />
              </button>
            ))}
          </Card>
        </div>
        <p className="text-[11.5px] text-[var(--muted)] text-center mt-6">Prototype · no data leaves this device</p>
      </div>
    </>
  );
}

/* The control that makes the app take on the person's own colour */
export function AppearanceControls() {
  const { mode, setMode, accent, setAccent } = useTheme();
  return (
    <>
      <div className="text-[13px] text-[var(--muted)] mb-2.5">Mode</div>
      <div className="flex p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] mb-6">
        {([["light", "Light"], ["dark", "Dark"]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setMode(id)}
            className={`press flex-1 py-2.5 rounded-xl text-[14px] font-medium
              ${mode === id ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--muted)]"}`}
            style={mode === id ? { boxShadow: "var(--shadow)" } : {}}>{l}</button>
        ))}
      </div>

      <div className="text-[13px] text-[var(--muted)] mb-3">Colour</div>
      <div className="grid grid-cols-3 gap-3">
        {ACCENTS.map(a => (
          <button key={a.id} onClick={() => setAccent(a.id)}
            className={`press rounded-2xl py-3 flex flex-col items-center gap-2 border
              ${accent === a.id ? "border-[var(--accent)] bg-[var(--soft)]" : "border-[var(--border)] bg-[var(--surface-2)]"}`}>
            <span className="w-7 h-7 rounded-full grid place-items-center" style={{ background: a.swatch }}>
              {accent === a.id && <IconCheck size={15} sw={2.6} className="text-white" />}
            </span>
            <span className="text-[11.5px] text-[var(--muted)]">{a.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] text-[var(--muted)] mt-4 leading-relaxed">
        The whole app follows this — surfaces, text and highlights are derived from your colour.
      </p>
    </>
  );
}

export function SideMenu({ open, onClose, go, openSetting }: {
  open: boolean; onClose: () => void; go: Go; openSetting: (m: MenuItem) => void;
}) {
  const user = useUser();
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 anim-in">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="anim-drawer absolute inset-y-0 left-0 w-[78%] max-w-[340px] bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
        <div className="p-5 pt-8 flex items-center gap-3.5 border-b border-[var(--border)]">
          <div className="w-12 h-12 rounded-full grid place-items-center shrink-0"
               style={{ background: `hsl(${user.hue} 55% 55%)`, color: "white",
                        fontSize: 17, fontWeight: 600 }}>
            {user.initials}
          </div>
          <div className="min-w-0">
            <div className="text-[15.5px] font-medium text-[var(--text)] truncate">{user.fullName}</div>
            <div className="text-[12.5px] text-[var(--muted)]">{user.handle}</div>
          </div>
          <button onClick={onClose} className="press ml-auto text-[var(--muted)] p-1"><IconClose size={20} /></button>
        </div>

        <div className="scroll flex-1 py-3">
          {MENU_ITEMS.map(m => (
            <button key={m.id} onClick={() => { onClose(); m.id === "profile" ? go("profile") : openSetting(m); }}
              className="press w-full px-5 py-3.5 text-left flex items-center">
              <span className={`text-[15px] ${m.danger ? "text-red-500" : "text-[var(--text)]"}`}>{m.label}</span>
              <IconChev size={16} className="ml-auto text-[var(--muted)]" />
            </button>
          ))}
        </div>
        <div className="p-5 text-[11.5px] text-[var(--muted)] border-t border-[var(--border)]">
          LVMINVS · prototype build
        </div>
      </div>
    </div>
  );
}

/* Placeholder settings sheets — enough to show what each will hold */
export function SettingSheet({ item, onClose, toast, onLogout }: {
  item: MenuItem | null; onClose: () => void; toast: (m: string) => void;
  onLogout?: () => void;
}) {
  const user = useUser();
  if (!item) return null;

  const bodies: Record<string, JSX.Element> = {
    account: (
      <div className="space-y-3">
        {[["Display name", user.fullName], ["Username", user.username], ["Password", "••••••••"], ["Language", "English (UK)"]]
          .map(([k, v]) => (
          <div key={k} className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div>
              <div className="text-[11.5px] text-[var(--muted)]">{k}</div>
              <div className="text-[14.5px] text-[var(--text)] mt-0.5">{v}</div>
            </div>
            <IconPen size={17} className="text-[var(--muted)]" />
          </div>
        ))}
      </div>
    ),
    appearance: <AppearanceControls />,
    privacy: (
      <div className="space-y-3">
        {([["Keep recordings on device only", true], ["Allow pattern suggestions", true],
          ["Anonymous usage statistics", false], ["Require Face ID to open", false]] as [string, boolean][]).map(([l, on]) => (
          <ToggleRow key={l} label={l} defaultOn={on} />
        ))}
        <p className="text-[12.5px] text-[var(--muted)] leading-relaxed pt-2">
          In the prototype these are illustrative. They mark the decisions a real build will need to make about
          where audio lives and what may leave the device.
        </p>
      </div>
    ),
    terms: (
      <div className="text-[13.5px] text-[var(--muted)] leading-relaxed space-y-3">
        <p>This is a prototype. It is not a medical device and does not provide diagnosis or treatment.</p>
        <p>Everything shown is sample content held in your browser. Nothing is transmitted or stored elsewhere.</p>
        <p>The full terms, privacy notice and data-processing basis will be written before any real release.</p>
      </div>
    ),
    delete: (
      <div>
        <p className="text-[14.5px] text-[var(--text)] leading-relaxed">
          Deleting your account removes your thoughts, recordings and reflections. This cannot be undone.
        </p>
        <div className="space-y-2.5 mt-6">
          <Button className="!bg-red-500" onClick={() => { onClose(); toast("Nothing was deleted — prototype"); }}>
            Delete everything
          </Button>
          <Button variant="outline" onClick={onClose}>Keep my account</Button>
        </div>
      </div>
    ),
    logout: (
      <div>
        <p className="text-[14.5px] text-[var(--text)]">
          Log out of this device? Your data stays encrypted on the server —
          logging back in with your username and password restores it.
        </p>
        <div className="space-y-2.5 mt-6">
          <Button onClick={() => { onClose(); (onLogout ?? (() => toast("Logged out")))(); }}>Log out</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    ),
  };
  const body = bodies[item.id] || <p className="text-[14px] text-[var(--muted)]">Placeholder screen.</p>;

  return <Sheet open onClose={onClose} title={item.label}>{body}</Sheet>;
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(o => !o)}
      className="press w-full flex items-center gap-3 p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
      <span className="text-[14px] text-[var(--text)] text-left flex-1">{label}</span>
      <span className="w-11 rounded-full p-0.5 transition-colors shrink-0"
            style={{ height: 26, background: on ? "var(--accent)" : "var(--border)" }}>
        <span className="block w-[22px] h-[22px] rounded-full bg-white transition-transform"
              style={{ transform: on ? "translateX(18px)" : "none" }} />
      </span>
    </button>
  );
}
