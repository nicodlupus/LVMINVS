import type { Category, Connection, Memo, NodeKind, Strength, Thought } from "../types";

/* ═══════════════════════════════════════════════════════════════════════
   MOCK DATA  — everything a backend would eventually serve
   ═══════════════════════════════════════════════════════════════════════ */

export const USER = {
  name: "Nico",
  fullName: "Nico Di Legardia",
  handle: "@nico",
  since: "March 2026",
  avatar: "https://i.pravatar.cc/160?img=68",
};
export const APP = "LVMINVS";

/* ── Shared nodes ──────────────────────────────────────────────────────
   Triggers, emotions and compulsions are their OWN nodes and are reused
   across thoughts. That reuse is what lets the map surface a pattern —
   e.g. many unrelated thoughts sharing one "mental reviewing" compulsion. */
export const TRIGGERS: Record<string, string> = {
  tr_drive:  "Driving",
  tr_night:  "Walking alone at night",
  tr_leave:  "Leaving the house",
  tr_body:   "A physical sensation",
  tr_taboo:  "A frightening or taboo thought",
  tr_wake:   "Waking up",
  tr_code:   "An uncertain coding task",
  tr_shift:  "Before a work shift",
  tr_person: "Someone behaves badly",
};
export const EMOTIONS_D: Record<string, string> = {
  e_fear: "Fear", e_dread: "Dread", e_guilt: "Guilt", e_shame: "Shame",
  e_anx: "Anxiety", e_anger: "Anger", e_unease: "Unease",
};
export const COMPULSIONS: Record<string, string> = {
  c_phrase:  "Repeating a protective phrase",
  c_scan:    "Scanning and looking behind",
  c_check:   "Checking again",
  c_count:   "Counting 1·2·3",
  c_reassure:"Seeking reassurance",
  c_review:  "Mental reviewing",
  c_bodytest:"Testing the body",
  c_reask:   "Re-asking the same question",
  c_reconstruct:"Reconstructing lost time",
  c_ritual:  "A religious act to cancel a thought",
};

/* Categories are the user's own organisational grouping — not diagnoses.
   Editable, renameable, multiple per thought. `ai` marks a suggested one. */
export const CATEGORIES: Category[] = [
  { id: "cat_safety",   label: "Personal safety",        hue: 210 },
  { id: "cat_certainty",label: "Certainty & checking",   hue: 275 },
  { id: "cat_health",   label: "Health",                 hue: 160 },
  { id: "cat_morality", label: "Meaning & morality",     hue: 35  },
  { id: "cat_worth",    label: "Self-worth & doing",     hue: 300 },
  { id: "cat_people",   label: "Relationships",          hue: 340 },
];

/* Thoughts carry the greatest weight. Each references shared node ids,
   and keeps flat display fields the other screens read. */
type Seed = Pick<Thought, "id" | "thought" | "cats" | "trig" | "emo" | "comp" | "intensity" | "date" | "note">;
const mk = (o: Seed): Thought => ({
  ...o,
  trigger:    TRIGGERS[o.trig[0]],
  emotion:    EMOTIONS_D[o.emo[0]],
  compulsion: COMPULSIONS[o.comp[0]],
  category:   o.cats[0],
  related: [],
});
export const THOUGHTS: Thought[] = [
  mk({ id:"t1",  thought:"Please don't let me die while I drive.", cats:["cat_safety"],
       trig:["tr_drive"], emo:["e_fear"], comp:["c_phrase"], intensity:8, date:"2026-07-22T08:10:00",
       note:"Repeated twice on entering the car, then again every few minutes." }),
  mk({ id:"t2",  thought:"I hope nobody is following me.", cats:["cat_safety"],
       trig:["tr_night"], emo:["e_fear","e_dread"], comp:["c_scan"], intensity:7, date:"2026-07-21T23:05:00",
       note:"Scanned cars and kept looking behind on the walk home." }),
  mk({ id:"t3",  thought:"Don't die. Don't lose it.", cats:["cat_safety"],
       trig:["tr_taboo"], emo:["e_unease"], comp:["c_phrase","c_review"], intensity:5, date:"2026-07-20T19:40:00",
       note:"Arrived while reading; broke the immersion, then I checked for the next one." }),
  mk({ id:"t4",  thought:"What if I didn't lock the door?", cats:["cat_certainty"],
       trig:["tr_leave"], emo:["e_dread"], comp:["c_check","c_count"], intensity:7, date:"2026-07-20T08:30:00",
       note:"Went back, counted 1·2·3; restarted when it didn't feel complete." }),
  mk({ id:"t5",  thought:"Smoking has already damaged my lungs.", cats:["cat_health"],
       trig:["tr_body"], emo:["e_fear"], comp:["c_bodytest","c_reassure"], intensity:8, date:"2026-07-19T22:15:00",
       note:"Touched chest, tested breathing, kept re-asking about symptoms." }),
  mk({ id:"t6",  thought:"I must pray correctly or something bad will happen.", cats:["cat_morality","cat_certainty"],
       trig:["tr_taboo"], emo:["e_guilt"], comp:["c_ritual"], intensity:7, date:"2026-07-18T21:00:00",
       note:"A taboo thought created pressure to repeat the act until it felt right." }),
  mk({ id:"t7",  thought:"Maybe I only hug my brother out of obligation.", cats:["cat_morality","cat_people"],
       trig:["tr_taboo"], emo:["e_shame"], comp:["c_review"], intensity:6, date:"2026-07-17T18:20:00",
       note:"Demanded a verdict on whether I really care." }),
  mk({ id:"t8",  thought:"Without AI, could I build anything myself?", cats:["cat_worth"],
       trig:["tr_code"], emo:["e_shame"], comp:["c_reask","c_reassure"], intensity:6, date:"2026-07-16T15:10:00",
       note:"Asked for the whole solution, then felt dependent." }),
  mk({ id:"t9",  thought:"Analyse this again until I know what it means.", cats:["cat_certainty","cat_worth"],
       trig:["tr_taboo"], emo:["e_anx"], comp:["c_reask"], intensity:6, date:"2026-07-15T13:35:00",
       note:"Reformulated the same question to get more analysis." }),
  mk({ id:"t10", thought:"I already wasted the whole morning.", cats:["cat_worth"],
       trig:["tr_wake"], emo:["e_guilt"], comp:["c_reconstruct","c_review"], intensity:5, date:"2026-07-14T10:05:00",
       note:"Stayed in bed reconstructing what I could have done." }),
  mk({ id:"t11", thought:"What problem will management create today?", cats:["cat_people"],
       trig:["tr_shift"], emo:["e_anger","e_anx"], comp:["c_review"], intensity:5, date:"2026-07-13T12:00:00",
       note:"Rehearsed conflicts before the shift began." }),
  mk({ id:"t12", thought:"Is this person manipulative, or is it just me?", cats:["cat_people","cat_certainty"],
       trig:["tr_person"], emo:["e_anger"], comp:["c_review","c_reassure"], intensity:6, date:"2026-07-12T17:45:00",
       note:"Analysed motives to reach a universal verdict about them." }),
];

/* Connections between thoughts. Every one is a HYPOTHESIS with a basis,
   a strength and a status the user controls — never a stated cause. */
export const CONNECTIONS: Connection[] = [
  { id:"k1", a:"t7",  b:"t12", basis:"Both end in mental reviewing to reach a verdict about a person.",
    strength:"tentative", source:"ai", status:"suggested" },
  { id:"k2", a:"t3",  b:"t10", basis:"The situations look unrelated — a walk and a morning — but both run on mental reviewing.",
    strength:"recurring", source:"ai", status:"suggested" },
  { id:"k3", a:"t8",  b:"t9",  basis:"Both return to re-ask the same question until it feels certain.",
    strength:"strong", source:"ai", status:"suggested" },
  { id:"k4", a:"t1",  b:"t6",  basis:"Both repeat a fixed phrase or act to prevent a feared outcome.",
    strength:"recurring", source:"ai", status:"accepted" },
  { id:"k5", a:"t4",  b:"t5",  basis:"A checking-for-certainty pattern (door vs. body).",
    strength:"tentative", source:"ai", status:"rejected" },
];

export const MEMOS: Memo[] = [
  { id: "m1", title: "In the car", duration: 47,  date: "2026-07-22T08:14:00", linked: "t1" },
  { id: "m2", title: "Walking home", duration: 92, date: "2026-07-21T23:10:00", linked: "t2" },
  { id: "m3", title: "Before the shift", duration: 24, date: "2026-07-13T11:40:00", linked: null },
];

/* ── helpers ─────────────────────────────────────────────────────────── */

export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " · " +
         d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};
export const fmtDur = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* Category lookup. Screens that don't manage categories fall back to the
   seed list; the map passes its live, editable list in explicitly. */
export const catOf = (id: string, list: Category[] = CATEGORIES): Category =>
  list.find(c => c.id === id) || { id, label: "Uncategorised", hue: 250 };
export const hueOf = (id: string, list?: Category[]): number => catOf(id, list).hue;

/* Node dictionaries by kind — used to render shared trigger/emotion/compulsion nodes */
export const NODE_DICT: Record<NodeKind, Record<string, string>> = {
  trigger: TRIGGERS, emotion: EMOTIONS_D, compulsion: COMPULSIONS,
};
const KIND_KEY = { trigger: "trig", emotion: "emo", compulsion: "comp" } as const;
export const nodeIds = (t: Thought, kind: NodeKind): string[] => t[KIND_KEY[kind]] || [];

export const STRENGTH: Record<Strength, { label: string; w: number }> = {
  tentative: { label: "Tentative", w: .55 },
  recurring: { label: "Recurring", w: .78 },
  strong:    { label: "Strong",    w: 1   },
};

export const rid = (): string => Math.random().toString(36).slice(2);
