import type { CompanionData, CompanionMode, Thought } from "../types";

/* ═══════════════════════════════════════════════════════════════════════
   LIVE COMPANION — talks to api_guide_test.py, proxied under /api.
   ═══════════════════════════════════════════════════════════════════════ */

/* App wires the MindMap into this so any screen's chat can grow the map */
export const AI_SINK: { ingest: (d: CompanionData) => void } = { ingest: () => {} };

export interface AskArgs {
  history: { role: "user" | "assistant"; content: string }[];
  context?: string;
  mode?: CompanionMode;
}

const TIMEOUT_MS = 45_000;

export async function askCompanion({ history, context = "", mode = "home" }: AskArgs): Promise<CompanionData> {
  /* a turn must never hang the UI silently — bound it and surface failures */
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, context, mode }),
      signal: ctl.signal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} ${detail.slice(0, 200)}`);
    }
    const data: CompanionData = await r.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("the companion took too long to answer");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* The model sees what the user already holds, so it can compare mechanisms
   across thoughts instead of treating each capture as isolated. */
export const buildContext = (thoughts: Thought[] = [], extra = ""): string => [
  extra,
  "EXISTING RECORDS:",
  ...thoughts.slice(0, 12).map(t =>
    `- "${t.thought}" | trigger: ${t.trigger} | emotion: ${t.emotion} | compulsion: ${t.compulsion}`),
].filter(Boolean).join("\n");

export const OFFLINE = "The companion is offline. Start the backend: ./.venv/bin/python api_guide_test.py";
