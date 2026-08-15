import { useEffect, useState } from "react";
import { login, proposeUsername, signup, type Session, type Vault } from "../api/auth";
import { APP } from "../data/mock";
import { prettyFromUsername } from "../data/user";
import { Button, Card } from "../ui/primitives";

/* Onboarding — seeds the personalization profile inside the encrypted vault */
const QUESTIONS: [string, string][] = [
  ["focus",    "When your mind loops, what does it loop on most?"],
  ["response", "What do you usually do to make the discomfort stop?"],
  ["moment",   "When does it visit you most?"],
  ["goal",     "What would you like to understand about yourself here?"],
];

export function AuthScreen({ onAuthed }: {
  onAuthed: (session: Session, vault: Vault) => void;
}) {
  const [tab, setTab] = useState<"create" | "login">("create");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);          // 0 = credentials, 1..n = questions
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* a random identity is proposed — the user owns nothing traceable */
  useEffect(() => {
    if (tab === "create") proposeUsername().then(setUsername).catch(() => {});
    else setUsername("");
    setStep(0); setError("");
  }, [tab]);

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const profile = tab === "create"
        ? {
            ...answers,
            displayName: displayName.trim() || prettyFromUsername(username),
            createdAt: new Date().toISOString(),
          }
        : {};
      const r = tab === "create"
        ? await signup(username, password, profile)
        : await login(username, password);
      onAuthed(r.session, r.vault);
    } catch (e) {
      setError(tab === "login" ? "Wrong username or password." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-2xl p-4 bg-[var(--surface-2)] border border-[var(--border)] " +
                "text-[15px] text-[var(--text)] placeholder:text-[var(--muted)]";

  return (
    <div className="scroll flex-1 px-6 pb-8 flex flex-col justify-center">
      <div className="text-center mb-8">
        <div className="wordmark text-[22px] text-[var(--text)]">{APP}</div>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">
          Everything you write is encrypted on this device.<br />We can't read it. Nobody can.
        </p>
      </div>

      <div className="flex p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] mb-6">
        {([["create", "Create account"], ["login", "Log in"]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`press flex-1 py-2.5 rounded-xl text-[14px] font-medium
              ${tab === id ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--muted)]"}`}
            style={tab === id ? { boxShadow: "var(--shadow)" } : {}}>{l}</button>
        ))}
      </div>

      {step === 0 && (
        <Card className="p-5 space-y-4 anim-up">
          {tab === "create" ? (
            <>
              <div>
                <div className="text-[12px] text-[var(--muted)] mb-1.5">Your username (random on purpose — change it later if you want)</div>
                <div className="mono text-[16px] text-[var(--accent)] p-3 rounded-xl bg-[var(--soft)] border border-[var(--border)]">
                  {username || "…"}
                </div>
              </div>
              <div>
                <div className="text-[12px] text-[var(--muted)] mb-1.5">What should the app call you? (optional)</div>
                <input className={input} placeholder={username ? prettyFromUsername(username) : "your name"}
                       value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} />
              </div>
            </>
          ) : (
            <input className={input} placeholder="Username" value={username}
                   onChange={e => setUsername(e.target.value.trim())} autoFocus />
          )}
          <input className={input} type="password" placeholder="Password" value={password}
                 onChange={e => setPassword(e.target.value)} />
          {tab === "create" && (
            <input className={input} type="password" placeholder="Repeat password" value={confirm}
                   onChange={e => setConfirm(e.target.value)} />
          )}
          {tab === "create" && (
            <p className="text-[12px] text-[var(--muted)] leading-relaxed">
              Your password is the only key to your data. If it's lost, your data is
              unrecoverable — by design.
            </p>
          )}
          {error && <p className="text-[13px] text-red-500">{error}</p>}
          {tab === "create" ? (
            <Button className="w-full" disabled={password.length < 8 || password !== confirm || !username}
                    onClick={() => setStep(1)}>Continue</Button>
          ) : (
            <Button className="w-full" disabled={busy || !username || !password} onClick={submit}>
              {busy ? "Decrypting…" : "Log in"}
            </Button>
          )}
          {tab === "create" && password.length > 0 && password.length < 8 && (
            <p className="text-[12px] text-[var(--muted)]">At least 8 characters.</p>
          )}
        </Card>
      )}

      {step > 0 && step <= QUESTIONS.length && (
        <Card className="p-5 anim-up" key={step}>
          <div className="flex gap-1.5 mb-5">
            {QUESTIONS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full"
                   style={{ background: i < step ? "var(--accent)" : "var(--border)" }} />
            ))}
          </div>
          <p className="text-[17px] leading-snug text-[var(--text)] mb-4">{QUESTIONS[step - 1][1]}</p>
          <textarea
            className={input + " h-28 resize-none"} autoFocus
            placeholder="In your own words — this stays encrypted"
            value={answers[QUESTIONS[step - 1][0]] || ""}
            onChange={e => setAnswers(a => ({ ...a, [QUESTIONS[step - 1][0]]: e.target.value }))} />
          {error && <p className="text-[13px] text-red-500 mt-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
            {step < QUESTIONS.length
              ? <Button onClick={() => setStep(step + 1)}>Continue</Button>
              : <Button disabled={busy} onClick={submit}>{busy ? "Encrypting…" : "Create account"}</Button>}
          </div>
        </Card>
      )}
    </div>
  );
}
