import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Mode } from "../types";

export const ACCENTS = [
  { id: "violet",   label: "Violet",   swatch: "#7c6cf0" },
  { id: "green",    label: "Forest",   swatch: "#4f9d76" },
  { id: "blue",     label: "Tide",     swatch: "#4d8ed6" },
  { id: "amber",    label: "Amber",    swatch: "#c2873c" },
  { id: "rose",     label: "Rose",     swatch: "#d1738c" },
  { id: "graphite", label: "Graphite", swatch: "#6f7580" },
] as const;
export type Accent = (typeof ACCENTS)[number]["id"];

interface ThemeValue {
  mode: Mode; setMode: (m: Mode) => void;
  accent: Accent; setAccent: (a: Accent) => void;
}
const ThemeCtx = createContext<ThemeValue | null>(null);
export const useTheme = (): ThemeValue => {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem("loom.mode") as Mode) || "light");
  const [accent, setAccent] = useState<Accent>(() => (localStorage.getItem("loom.accent") as Accent) || "violet");
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem("loom.mode", mode);
    localStorage.setItem("loom.accent", accent);
  }, [mode, accent]);
  return <ThemeCtx.Provider value={{ mode, setMode, accent, setAccent }}>{children}</ThemeCtx.Provider>;
}
