import { createContext, useContext } from "react";
import type { Session } from "../api/auth";

/* Everything the UI needs to render an identity. Derived from the session
   (username, never traceable) and the profile the user filled out during
   signup (kept inside the encrypted vault).

   A brand-new account has NO display name and NO avatar. Nothing is
   auto-generated from the username — the identity fields stay empty until
   the person chooses to fill them in themselves. */
export interface UserDisplay {
  username: string;
  name: string;      // short display; "" when the user hasn't set one
  fullName: string;  // long display; "" when the user hasn't set one
  handle: string;    // "@username"
  since: string;     // pretty "Month Year"
  initials: string;  // "" when there is no display name
  hue: number | null;// null when there is no display name
  hasName: boolean;
  hasAvatar: boolean;
}

/* deterministic hash → 0..360, only used once the user has actually set a
   display name they want. Never derived from the username alone. */
export function hashHue(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

/* first letter of each of the first two words, uppercased */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s\-_]+/).filter(Boolean);
  if (parts.length === 0) return "";
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? parts[1][0] : (parts[0][1] || "");
  return (a + b).toUpperCase().slice(0, 2);
}

/* Kept for the Auth screen's placeholder text only — never used as a fallback
   value for the actual profile. A blank display name stays blank. */
export function prettyFromUsername(u: string): string {
  return u.split(/[-_]/).filter(w => !/^\d+$/.test(w))
          .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
          .join(" ").trim() || u;
}

export function userFrom(session: Session, profile: Record<string, string>): UserDisplay {
  const username = session.username;
  const display  = (profile.displayName || "").trim();
  const since    = new Date(profile.createdAt || Date.now())
                     .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const hasName  = display.length > 0;
  return {
    username,
    name: hasName ? display.split(/\s+/)[0] : "",
    fullName: display,
    handle: "@" + username,
    since,
    initials: hasName ? initialsOf(display) : "",
    hue: hasName ? hashHue(display) : null,
    hasName,
    hasAvatar: hasName,
  };
}

/* Context so the shared header + avatar can read identity without
   every screen having to pass it explicitly */
export const UserContext = createContext<UserDisplay | null>(null);
export const useUser = (): UserDisplay => {
  const u = useContext(UserContext);
  if (!u) throw new Error("useUser called outside <UserContext.Provider>");
  return u;
};
