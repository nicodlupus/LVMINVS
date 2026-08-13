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

export interface Classification {
  category?: string;
  emotion?: string;
  distortion?: string;
  compulsion_type?: string;
  confidence?: number;
}

export interface Msg {
  id: string;
  from: "me" | "bot";
  text: string;
  chips?: string[] | null;
  /* per-reply feedback the user leaves on assistant messages */
  rating?: number;            // 1-5
  recommendation?: string;    // optional free-form note
  feedbackSent?: boolean;     // true once posted successfully
  /* the encoder's read of the user's discomfort, attached to the reply
     that carried it — the user can then confirm or correct it */
  classification?: Classification;
  classVerdict?: "correct" | "off";
  classCorrection?: string;
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
  _plan?: Classification & { intent?: string; evidence_used?: number };
  error?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  danger?: boolean;
}
