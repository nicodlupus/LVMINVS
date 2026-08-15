import { createContext, useContext } from "react";
import type { Session } from "../api/auth";

/* Everything the UI needs to render an identity. Derived from the session
   (username, never traceable) and the profile the user filled out during
   signup (kept inside the encrypted vault). No external image ever. */
export interface UserDisplay {
  username: string;
  name: string;      // short display, used in greetings
  fullName: string;  // longer display, used in Profile
  handle: string;    // "@username"
  since: string;     // pretty "Month Year"
  initials: string;
  hue: number;       // 0..360, deterministic from the username
}

/* deterministic hash → 0..360, so every username paints the same avatar
   on every device without an image ever leaving the browser */
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
  if (parts.length === 0) return "·";
  const a = parts[0][0] || "";
  const b = parts.length > 1 ? parts[1][0] : (parts[0][1] || "");
  return (a + b).toUpperCase().slice(0, 2);
}

/* a random-username like "amber-heron-42" reads fine as "Amber Heron" */
export function prettyFromUsername(u: string): string {
  return u.split(/[-_]/).filter(w => !/^\d+$/.test(w))
          .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
          .join(" ").trim() || u;
}

export function userFrom(session: Session, profile: Record<string, string>): UserDisplay {
  const username = session.username;
  const display  = (profile.displayName || "").trim() || prettyFromUsername(username);
  const since    = new Date(profile.createdAt || Date.now())
                     .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return {
    username,
    name: display.split(/\s+/)[0],
    fullName: display,
    handle: "@" + username,
    since,
    initials: initialsOf(display),
    hue: hashHue(username),
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
