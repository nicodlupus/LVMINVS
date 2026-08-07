import type { Memo, Screen, Thought } from "../types";

export type Go = (s: Screen, opts?: { scenario?: Thought; thought?: Thought }) => void;

/* Props every screen receives from the App shell */
export interface ScreenProps {
  go: Go;
  openMenu: () => void;
  thoughts: Thought[];
  memos: Memo[];
  toast: (m: string) => void;
}
