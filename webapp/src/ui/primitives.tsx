import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useUser } from "../data/user";
import { IconBack, IconCheck, IconClose, IconMenu } from "./icons";

export const Card = ({ className = "", children, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div {...p} className={`rounded-3xl bg-[var(--surface)] border border-[var(--border)] ${className}`}
       style={{ boxShadow: "var(--shadow)", ...(p.style || {}) }}>{children}</div>
);

type Variant = "solid" | "soft" | "ghost" | "outline";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant }
export const Button = ({ variant = "solid", className = "", children, ...p }: ButtonProps) => {
  const base = "press rounded-2xl px-5 py-3.5 text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-40";
  const v: Record<Variant, string> = {
    solid:  "bg-[var(--accent)] text-[var(--on-accent)]",
    soft:   "bg-[var(--soft)] text-[var(--accent)] border border-[var(--border)]",
    ghost:  "text-[var(--muted)]",
    outline:"border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
  };
  return <button {...p} className={`${base} ${v[variant]} ${className}`}>{children}</button>;
};

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> { active?: boolean }
export const Chip = ({ active, className = "", children, ...p }: ChipProps) => (
  <button {...p} className={`press shrink-0 rounded-full px-3.5 py-2 text-[13px] border whitespace-nowrap
    ${active ? "bg-[var(--accent)] text-[var(--on-accent)] border-transparent"
             : "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]"} ${className}`}>{children}</button>
);

/* Avatar. A brand-new account has NO picture — a neutral placeholder disk
   is rendered until the person actually sets a display name themselves.
   Once they do, initials-on-color painted from that name they chose. */
export const Avatar = ({ size = 36, onClick }: { size?: number; onClick?: () => void }) => {
  const u = useUser();
  const fontPx = Math.round(size * 0.42);
  const style = u.hasAvatar
    ? { width: size, height: size, background: `hsl(${u.hue} 55% 55%)`,
        color: "white", fontWeight: 600, fontSize: fontPx, lineHeight: 1 }
    : { width: size, height: size, background: "var(--surface-2)",
        color: "var(--muted)", fontWeight: 500, fontSize: fontPx, lineHeight: 1 };
  return (
    <button onClick={onClick}
            aria-label={u.fullName || u.username}
            className="press rounded-full overflow-hidden border border-[var(--border)] shrink-0 grid place-items-center"
            style={style}>
      {u.initials}
    </button>
  );
};

/* Bottom sheet + full-screen modal */
export function Sheet({ open, onClose, children, title, full }: {
  open: boolean; onClose: () => void; children: ReactNode; title?: string; full?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end anim-in">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative anim-sheet bg-[var(--surface)] rounded-t-[28px] border-t border-[var(--border)]
                       flex flex-col ${full ? "h-[92%]" : "max-h-[85%]"}`}>
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>
        {title && (
          <div className="px-5 pb-3 pt-1 flex items-center justify-between shrink-0">
            <h3 className="text-[17px] font-semibold text-[var(--text)]">{title}</h3>
            <button onClick={onClose} className="press text-[var(--muted)] p-1"><IconClose size={20} /></button>
          </div>
        )}
        <div className="scroll px-5 pb-8 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-28 z-[70] anim-up">
      <div className="rounded-full px-4 py-2.5 text-[13px] font-medium bg-[var(--text)] text-[var(--bg)] flex items-center gap-2"
           style={{ boxShadow: "var(--shadow)" }}>
        <IconCheck size={15} sw={2.2} />{msg}
      </div>
    </div>
  );
}

/* Screen chrome: menu · title · avatar */
export function Header({ title, subtitle, onMenu, onAvatar, onBack }: {
  title: string; subtitle?: string; onMenu?: () => void; onAvatar?: () => void; onBack?: () => void;
}) {
  return (
    <div className="shrink-0 px-5 pt-3 pb-3 flex items-start gap-3">
      <button onClick={onBack || onMenu} className="press p-1.5 -ml-1.5 mt-0.5 text-[var(--text)]">
        {onBack ? <IconBack /> : <IconMenu />}
      </button>
      <div className="flex-1 min-w-0 text-center">
        <div className="text-[17px] font-semibold leading-tight text-[var(--text)] truncate">{title}</div>
        {subtitle && <div className="text-[12.5px] text-[var(--muted)] mt-0.5 truncate">{subtitle}</div>}
      </div>
      <Avatar onClick={onAvatar} />
    </div>
  );
}

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="text-[11.5px] uppercase tracking-wider text-[var(--muted)] mb-2 px-1">{children}</div>
);

export const Tag = ({ children, dot }: { children: ReactNode; dot?: string }) => (
  <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]">
    {dot != null && <span className="w-2 h-2 rounded-full" style={{ background: dot }} />}{children}
  </span>
);
