/* Shared domain types — the shape a real backend will eventually serve. */

export type NodeKind = "trigger" | "emotion" | "compulsion";
export type Strength = "tentative" | "recurring" | "strong";
export type ConnStatus = "suggested" | "accepted" | "rejected";
export type Screen = "home" | "chat" | "capture" | "map" | "reflect" | "exercise" | "profile";
export type Mode = "light" | "dark";
export type CompanionMode = "home" | "reflect" | "capture";

export interface Category {
  id: string;
  label: string;
  hue: number;
  ai?: boolean;
}

export interface Thought {
  id: string;
  thought: string;
  cats: string[];          // category ids (multiple allowed)
  trig: string[];          // shared node ids
  emo: string[];
  comp: string[];
  /* flat display fields the other screens read */
  trigger: string;
  emotion: string;
  compulsion: string;
  category: string;
  intensity: number;
  date: string;            // ISO
  note: string;
  related: string[];
  ai?: boolean;
  _new?: boolean;
}

export interface Connection {
  id: string;
  a: string;               // thought ids
  b: string;
  basis: string;
  strength: Strength;
  source: "ai" | "user";
  status: ConnStatus;
}

export interface Memo {
  id: string;
  title: string;
  duration: number;        // seconds
  date: string;
  linked: string | null;
}

export interface Msg {
  id: string;
  from: "me" | "bot";
  text: string;
  chips?: string[] | null;
}

/* What /api/companion returns */
export interface CompanionData {
  reply?: string[];
  chips?: string[];
  thought?: {
    thought: string;
    category?: string;
    trigger?: string;
    emotion?: string;
    compulsion?: string;
    intensity?: number | string;
    note?: string;
  };
  pattern?: { basis: string; strength?: string };
  error?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  danger?: boolean;
}
