import { useEffect, useState } from "react";
import { clearSession, loadSession, saveSession, uploadVault,
         type Session, type Vault } from "./api/auth";
import { AI_SINK, askCompanion, buildContext } from "./api/companion";
import { STRENGTH } from "./data/mock";
import { UserContext, userFrom } from "./data/user";
import { useChat } from "./hooks/useChat";
import { BottomNav } from "./ui/BottomNav";
import { Composer } from "./ui/chat";
import { Toast } from "./ui/primitives";
import type { Category, CompanionData, Connection, Memo, MenuItem, Screen, Thought } from "./types";
import type { Go } from "./screens/shared";
import { HomeScreen } from "./screens/Home";
import { ChatScreen } from "./screens/Chat";
import { CaptureScreen } from "./screens/Capture";
import { MapScreen } from "./screens/MindMap";
import { ReflectScreen } from "./screens/Reflect";
import { ExerciseScreen } from "./screens/Exercise";
import { ProfileScreen, SettingSheet, SideMenu } from "./screens/Profile";
import { AuthScreen } from "./screens/Auth";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [menu, setMenu] = useState(false);
  const [setting, setSetting] = useState<MenuItem | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [exercisePreset, setExercisePreset] = useState<Thought | null>(null);
  const [reflectPreset, setReflectPreset] = useState<Thought | null>(null);

  /* ── zero-knowledge account: gate, hydrate, sync ─────────────────── */
  const [session, setSession] = useState<Session | null>(loadSession);
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Record<string, string>>({});

  const hydrate = (s: Session, v: Vault) => {
    setProfile(v.profile || {});
    setThoughts(v.thoughts || []);
    setMemos(v.memos || []);
    setCats(v.cats || []);
    setConnections(v.connections || []);
    setSession(s); saveSession(s); setHydrated(true);
  };

  /* returning device: pull + decrypt the vault with the cached keys */
  useEffect(() => {
    if (!session || hydrated) return;
    fetch("/api/auth/vault/download", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: session.username, auth_key_hex: session.authKeyHex }),
    }).then(r => r.ok ? r.json() : Promise.reject())
      .then(async d => {
        const { decryptVault } = await import("./api/auth");
        hydrate(session, await decryptVault(session.encKeyHex, d.vault_b64));
      })
      .catch(() => setHydrated(true));   // offline: work locally, sync later
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* every change re-encrypts on-device and ships only ciphertext */
  useEffect(() => {
    if (!session || !hydrated) return;
    const t = setTimeout(() => {
      uploadVault(session, { version: 1, profile,
        thoughts, memos, cats, connections }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [thoughts, memos, cats, connections, profile, session, hydrated]);

  const logout = () => { clearSession(); location.reload(); };

  const homeChat = useChat();

  const toast = (m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(""), 2400); };

  const go: Go = (s, opts) => {
    if (opts?.scenario) setExercisePreset(opts.scenario);
    if (s === "reflect") setReflectPreset(opts?.thought || null);
    setScreen(s);
  };

  const sendToCompanion = (text: string) => {
    homeChat.send(text, { mode: "home", context: buildContext(thoughts) });
    if (screen === "home") setScreen("chat");
  };

  const saveMemo = (m: Memo) => setMemos(prev => [m, ...prev]);

  /* Find or create the category the model named, and return its id. */
  const resolveCat = (label?: string): string => {
    const clean = (label || "").trim();
    if (!clean) return "cat_safety";
    const hit = cats.find(c => c.label.toLowerCase() === clean.toLowerCase());
    if (hit) return hit.id;
    const id = "cat_" + clean.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setCats(prev => prev.some(c => c.id === id) ? prev
      : [...prev, { id, label: clean, hue: (prev.length * 53 + 195) % 360 }]);
    return id;
  };

  /* Everything the companion extracts lands here: the MindMap grows with the
     conversation, and a suggested pattern arrives as a hypothesis to accept. */
  const ingestAI = (data: CompanionData) => {
    const t = data?.thought;
    if (!t?.thought) return;
    const catId = resolveCat(t.category);
    const id = "t" + Date.now();
    setThoughts(prev => [{
      id, thought: t.thought, cats: [catId], category: catId,
      trig: [], emo: [], comp: [],
      trigger: t.trigger || "Not yet recorded",
      emotion: t.emotion || "Unease",
      compulsion: t.compulsion || "Not yet recorded",
      intensity: Math.max(1, Math.min(10, +(t.intensity ?? 5) || 5)),
      note: t.note || "Captured with the companion.",
      date: new Date().toISOString(), related: [], ai: true,
    }, ...prev]);
    if (data.pattern?.basis && thoughts[0]) {
      const strength = data.pattern.strength;
      setConnections(prev => [{
        id: "k" + Date.now(), a: id, b: thoughts[0].id,
        basis: data.pattern!.basis,
        strength: strength && strength in STRENGTH ? strength as Connection["strength"] : "tentative",
        source: "ai", status: "suggested",
      }, ...prev]);
    }
    toast("Added to your MindMap");
  };
  useEffect(() => { AI_SINK.ingest = ingestAI; });

  const upsertThought = (t: Partial<Thought> & { id: string }) => setThoughts(prev => {
    const i = prev.findIndex(p => p.id === t.id);
    if (i === -1) return [t as Thought, ...prev];
    const copy = [...prev]; copy[i] = { ...copy[i], ...t }; return copy;
  });

  const saveThought = (text: string) => {
    const id = "t" + Date.now();
    setThoughts(prev => [{
      id, cats: ["cat_safety"], category: "cat_safety",
      trig: [], emo: [], comp: [], trigger: "Not yet categorised",
      thought: text, emotion: "Unease", compulsion: "Not yet recorded",
      note: "Captured from the companion — categorise it when ready.",
      date: new Date().toISOString(), intensity: 5, related: [],
    }, ...prev]);
    /* ask the companion to structure the capture, then fill the card in place */
    askCompanion({ mode: "capture", context: buildContext(thoughts), history: [{ role: "user", content: text }] })
      .then(d => {
        const t = d?.thought;
        if (!t) return;
        const catId = resolveCat(t.category);
        upsertThought({
          id, cats: [catId], category: catId,
          trigger: t.trigger || "Not yet categorised",
          emotion: t.emotion || "Unease",
          compulsion: t.compulsion || "Not yet recorded",
          intensity: Math.max(1, Math.min(10, +(t.intensity ?? 5) || 5)),
          note: t.note || "Captured — categorised by the companion.",
        });
        toast("Categorised");
      })
      .catch(() => {});
  };

  const shared = { go, openMenu: () => setMenu(true), thoughts, memos, toast };

  if (!session) {
    return (
      <div className="shell">
        <div className="frame">
          <AuthScreen onAuthed={hydrate} />
        </div>
      </div>
    );
  }

  const user = userFrom(session, profile);

  return (
    <UserContext.Provider value={user}>
      <div className="shell">
        <div className="frame">
          <div className="flex flex-col flex-1 min-h-0 relative"
               style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
            {screen === "home"     && <HomeScreen {...shared} chat={homeChat} />}
            {screen === "chat"     && <ChatScreen go={go} chat={homeChat} onSend={sendToCompanion} />}
            {screen === "capture"  && <CaptureScreen {...shared} onSaveMemo={saveMemo} onSaveThought={saveThought} />}
            {screen === "map"      && <MapScreen {...shared} onUpdate={upsertThought}
                                         cats={cats} setCats={setCats} connections={connections} setConnections={setConnections} />}
            {screen === "reflect"  && <ReflectScreen {...shared} preset={reflectPreset} />}
            {screen === "exercise" && <ExerciseScreen {...shared} preset={exercisePreset} />}
            {screen === "profile"  && <ProfileScreen {...shared} openSetting={setSetting} />}

            {/* the home composer lives outside the scroll area */}
            {screen === "home" && <Composer placeholder="Type" onSend={sendToCompanion} />}

            <SideMenu open={menu} onClose={() => setMenu(false)} go={go} openSetting={setSetting} />
            <SettingSheet item={setting} onClose={() => setSetting(null)} toast={toast} onLogout={logout} />
            <Toast msg={toastMsg} />
          </div>

          <BottomNav screen={screen} go={go} />
        </div>
      </div>
    </UserContext.Provider>
  );
}
