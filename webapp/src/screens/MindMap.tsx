import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  APP, CATEGORIES, COMPULSIONS, EMOTIONS_D, NODE_DICT, STRENGTH, TRIGGERS,
  catOf, fmtDate, hueOf, nodeIds,
} from "../data/mock";
import type { Category, ConnStatus, Connection, NodeKind, Strength, Thought } from "../types";
import {
  IconBack, IconCheck, IconClose, IconFilter, IconPen, IconPlus, IconSpark, IconTrash, IconWave,
} from "../ui/icons";
import { Button, Card, Chip, Header, Sheet, Tag } from "../ui/primitives";
import type { ScreenProps } from "./shared";

/* ═══════════════════════════════════════════════════════════════════════
   MINDMAP — central node → categories → shared trigger / emotion /
   compulsion nodes. Connections between thoughts are hypotheses the user
   accepts or rejects. The map only surfaces patterns; it never concludes.
   ═══════════════════════════════════════════════════════════════════════ */

const ring = (i: number, n: number, cx: number, cy: number, r: number, squash = .82) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(n, 1);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) * squash };
};
const KIND_HUE: Record<NodeKind, number | null> = { compulsion: null, trigger: 205, emotion: 25 };
const kindColor = (kind: NodeKind): string =>
  kind === "compulsion" ? "var(--accent)" : `hsl(${KIND_HUE[kind]} 55% 58%)`;

interface GraphNode {
  key: string; label: string; onClick: () => void;
  badge?: string | number; color?: string; size?: number; fs?: number; dashed?: boolean;
}

/* Reusable radial graph: a weighted centre with a ring of nodes.
   The SVG and the node buttons live in ONE fixed-size box that is centred,
   so the connecting lines and the bubbles share the same origin and stay
   aligned regardless of container width. */
function Graph({ centerLabel, centerSub, onCenter, nodes, hint }: {
  centerLabel: string; centerSub?: string; onCenter: () => void; nodes: GraphNode[]; hint?: string;
}) {
  /* keep the largest node fully inside the box so nothing is clipped */
  const maxNode = nodes.reduce((m, n) => Math.max(m, n.size || 80), 84);
  const pad = maxNode / 2 + 8;
  const W = 320, H = 320;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) / 2 - pad;      // radius that fits the ring
  const pts = nodes.map((nd, i) => ({ ...nd, ...ring(i, nodes.length, cx, cy, R) }));
  return (
    <div className="relative w-full h-full grid place-items-center anim-in">
      <div className="relative shrink-0" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0 overflow-visible">
          {pts.map(p => (
            <line key={p.key} x1={cx} y1={cy} x2={p.x} y2={p.y}
                  stroke="var(--border)" strokeWidth="1.4" strokeDasharray={p.dashed ? "2 5" : "0"} />
          ))}
          <circle cx={cx} cy={cy} r="54" fill="var(--soft)" opacity=".55" />
        </svg>
        <button onClick={onCenter}
          className="press absolute rounded-full grid place-items-center text-center z-10"
          style={{ left: cx - 50, top: cy - 50, width: 100, height: 100,
                   background: "var(--accent)", color: "var(--on-accent)",
                   boxShadow: "0 14px 34px -12px var(--accent)" }}>
          <div>
            <div className="wordmark text-[12px] leading-none">{centerLabel}</div>
            {centerSub && <div className="eyebrow text-[8px] opacity-80 mt-1.5">{centerSub}</div>}
          </div>
        </button>
        {pts.map(p => {
          const s = p.size || 80;
          return (
            <button key={p.key} onClick={p.onClick}
              className="press absolute rounded-full grid place-items-center text-center p-2 border anim-up"
              style={{ left: p.x - s / 2, top: p.y - s / 2, width: s, height: s,
                       background: "var(--surface)", borderColor: p.color || "var(--border)",
                       boxShadow: "var(--shadow)" }}>
              <span className="leading-tight text-[var(--text)] line-clamp-3" style={{ fontSize: p.fs || 11 }}>{p.label}</span>
              {p.badge != null && <span className="mono text-[8.5px] text-[var(--muted)] mt-0.5">{p.badge}</span>}
            </button>
          );
        })}
      </div>
      {hint && <div className="absolute bottom-2 inset-x-0 text-center eyebrow text-[9px] text-[var(--muted)] pointer-events-none">{hint}</div>}
    </div>
  );
}

interface MapProps extends ScreenProps {
  onUpdate: (t: Thought) => void;
  cats: Category[];
  setCats: Dispatch<SetStateAction<Category[]>>;
  connections: Connection[];
  setConnections: Dispatch<SetStateAction<Connection[]>>;
}

export function MapScreen({ go, openMenu, thoughts, onUpdate, toast, cats, setCats, connections, setConnections }: MapProps) {
  const [mode, setMode] = useState<"overview" | "category">("overview");
  const [lens, setLens] = useState<"categories" | "patterns" | "list">("categories");
  const [selCat, setSelCat] = useState<string | null>(null);
  const [detail, setDetail] = useState<Thought | null>(null);
  const [entity, setEntity] = useState<{ kind: NodeKind; id: string } | null>(null);
  const [wizard, setWizard] = useState<Partial<Thought> | null>(null);
  const [manage, setManage] = useState(false);
  const [opens, setOpens] = useState(0);             // rumination counter
  const [muted, setMuted] = useState(false);

  const countCat = (id: string) => thoughts.filter(t => t.cats.includes(id)).length;
  const openDetail = (t: Thought) => { setDetail(t); setOpens(o => o + 1); };
  const openEntity = (kind: NodeKind, id: string) => { setEntity({ kind, id }); setOpens(o => o + 1); };
  const ruminating = opens >= 7 && !muted;

  /* shared nodes appearing in ≥2 thoughts — the visible patterns */
  const patternNodes = useMemo(() => {
    const out: { kind: NodeKind; id: string; label: string; n: number }[] = [];
    (["compulsion", "trigger", "emotion"] as NodeKind[]).forEach(kind => {
      const dict = NODE_DICT[kind];
      Object.keys(dict).forEach(id => {
        const n = thoughts.filter(t => nodeIds(t, kind).includes(id)).length;
        if (n >= 2) out.push({ kind, id, label: dict[id], n });
      });
    });
    return out.sort((a, b) => b.n - a.n).slice(0, 7);
  }, [thoughts]);

  return (
    <>
      <Header title="MindMap" subtitle={`${thoughts.length} thoughts · ${cats.length} categories`}
              onMenu={openMenu} onAvatar={() => go("profile")} />

      {/* lens switch */}
      <div className="shrink-0 px-5 pb-3 flex items-center gap-2">
        <div className="flex p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex-1">
          {([["categories", "Categories"], ["patterns", "Patterns"], ["list", "List"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => { setLens(id); setMode("overview"); }}
              className={`press flex-1 py-2 rounded-xl text-[13px]
                ${lens === id && mode === "overview" ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--muted)]"}`}
              style={lens === id && mode === "overview" ? { boxShadow: "var(--shadow)" } : {}}>{l}</button>
          ))}
        </div>
        <button onClick={() => setManage(true)}
          className="press w-10 h-10 rounded-xl grid place-items-center bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]">
          <IconFilter size={18} />
        </button>
      </div>

      {ruminating && (
        <div className="shrink-0 mx-5 mb-2 p-3.5 rounded-2xl bg-[var(--soft)] border border-[var(--border)] anim-up">
          <p className="text-[13.5px] text-[var(--text)] leading-snug">
            You've opened a lot of connections just now. The map is for noticing, not for solving —
            more looking rarely brings more certainty.
          </p>
          <div className="flex gap-2 mt-2.5">
            <Button className="!py-2 !px-4 text-[13px]" onClick={() => go("home")}>Step away</Button>
            <Button variant="ghost" className="!py-2 !px-4 text-[13px]" onClick={() => { setMuted(true); setOpens(0); }}>Keep looking</Button>
          </div>
        </div>
      )}

      {/* body — the graph area reserves space top and bottom so nothing
          overlaps the info bar above it or the add button below it */}
      {mode === "overview" && lens === "categories" && (
        <div className="flex-1 relative overflow-hidden etch pb-16">
          <Graph centerLabel="MindMap" centerSub="your patterns"
            onCenter={() => setManage(true)}
            hint="Tap a category to open it"
            nodes={cats.map(c => ({
              key: c.id, label: c.label, badge: countCat(c.id),
              color: `hsl(${c.hue} 50% 60% / .6)`,
              size: 64 + Math.min(countCat(c.id), 4) * 7, fs: 10.5,
              onClick: () => { setSelCat(c.id); setMode("category"); },
            }))} />
        </div>
      )}

      {mode === "overview" && lens === "patterns" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-5 pb-1">
            <Card className="p-3">
              <p className="text-[12.5px] text-[var(--muted)] leading-snug">
                These threads recur across several thoughts. A shared thread is a pattern to notice — not a conclusion about you.
              </p>
            </Card>
          </div>
          <div className="flex-1 relative overflow-hidden etch pb-16">
            <Graph centerLabel="MindMap" centerSub="shared threads"
              onCenter={() => {}}
              hint="Blue trigger · orange emotion · accent compulsion"
              nodes={patternNodes.map(p => ({
                key: p.kind + p.id, label: p.label, badge: `×${p.n}`,
                color: kindColor(p.kind), size: 60 + p.n * 7, fs: 10,
                onClick: () => openEntity(p.kind, p.id),
              }))} />
          </div>
        </div>
      )}

      {mode === "overview" && lens === "list" && (
        <div className="scroll flex-1 px-5 pb-24 space-y-3 stagger">
          {thoughts.map(t => (
            <Card key={t.id} className="p-4 press cursor-pointer" onClick={() => openDetail(t)}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {t.cats.map(cid => (
                  <span key={cid} className="mono text-[9.5px] text-[var(--muted)] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${hueOf(cid, cats)} 55% 55%)` }} />
                    {catOf(cid, cats).label}
                  </span>
                ))}
                <span className="mono text-[9.5px] text-[var(--muted)] ml-auto">{fmtDate(t.date)}</span>
              </div>
              <div className="text-[16px] text-[var(--text)] leading-snug">“{t.thought}”</div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Tag>{t.emotion}</Tag><Tag>{t.compulsion}</Tag>
              </div>
            </Card>
          ))}
        </div>
      )}

      {mode === "category" && selCat && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-5 pb-1">
            <button onClick={() => setMode("overview")}
              className="press inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)]">
              <IconBack size={15} />All categories
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden etch pb-16">
            <Graph centerLabel={catOf(selCat, cats).label.split(" ")[0]}
              centerSub={`${countCat(selCat)} thoughts`} onCenter={() => {}}
              hint="Tap a thought to open it"
              nodes={thoughts.filter(t => t.cats.includes(selCat)).map(t => ({
                key: t.id, label: `“${t.thought}”`, size: 86, fs: 9.5,
                color: `hsl(${hueOf(selCat, cats)} 50% 60% / .6)`,
                onClick: () => openDetail(t),
              }))} />
          </div>
        </div>
      )}

      {/* add thought — sits in the bottom-right corner, clear of the ring */}
      <button onClick={() => setWizard({ thought: "", cats: [], trig: [], emo: [], comp: [] })}
        className="press absolute right-4 bottom-[84px] z-30 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--on-accent)]"
        style={{ width: 52, height: 52, boxShadow: "0 12px 28px -10px var(--accent)" }}>
        <IconPlus size={24} />
      </button>

      <ThoughtDetail thought={detail} thoughts={thoughts} cats={cats} connections={connections}
        onClose={() => setDetail(null)} onOpenThought={openDetail} onOpenEntity={openEntity}
        onEdit={t => { setDetail(null); setWizard(t); }}
        onReflect={t => { setDetail(null); go("reflect", { thought: t }); }}
        onExercise={t => { setDetail(null); go("exercise", { scenario: t }); }}
        onAddCat={(t, cid) => onUpdate({ ...t, cats: [...new Set([...t.cats, cid])] })}
        onRemoveCat={(t, cid) => onUpdate({ ...t, cats: t.cats.filter(x => x !== cid) })}
        onConn={(id, status) => { setConnections(prev => prev.map(k => k.id === id ? { ...k, status } : k));
                                  toast(status === "accepted" ? "Connection accepted" : "Suggestion dismissed"); }}
        onLink={(a, b) => { setConnections(prev => [...prev, { id: "k" + Date.now(), a, b,
          basis: "You linked these thoughts.", strength: "strong", source: "user", status: "accepted" }]);
          toast("Thoughts linked"); }} />

      <EntitySheet node={entity} thoughts={thoughts} cats={cats}
        onClose={() => setEntity(null)} onOpenThought={t => { setEntity(null); openDetail(t); }} />

      <CategoriseWizard base={wizard} cats={cats}
        onClose={() => setWizard(null)}
        onDone={(t) => { onUpdate(t); setWizard(null); toast(t._new ? "Thought added to your map" : "Categorisation updated"); }} />

      <CategoryManager open={manage} onClose={() => setManage(false)} cats={cats} setCats={setCats}
        thoughts={thoughts} onUpdate={onUpdate} toast={toast} />
    </>
  );
}

/* Shared-node sheet: which thoughts run through this trigger/emotion/compulsion */
function EntitySheet({ node, thoughts, cats, onClose, onOpenThought }: {
  node: { kind: NodeKind; id: string } | null; thoughts: Thought[]; cats: Category[];
  onClose: () => void; onOpenThought: (t: Thought) => void;
}) {
  if (!node) return null;
  const label = NODE_DICT[node.kind][node.id];
  const list = thoughts.filter(t => nodeIds(t, node.kind).includes(node.id));
  const kindLabel = { trigger: "Trigger", emotion: "Emotion", compulsion: "Compulsion" }[node.kind];
  return (
    <Sheet open onClose={onClose} title={label}>
      <div className="eyebrow text-[10px] text-[var(--muted)] -mt-2 mb-4">
        {kindLabel} · appears in {list.length} {list.length === 1 ? "record" : "records"}
      </div>
      <div className="space-y-2.5">
        {list.map(t => (
          <button key={t.id} onClick={() => onOpenThought(t)}
            className="press w-full text-left p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              {t.cats.map(cid => (
                <span key={cid} className="w-2 h-2 rounded-full" style={{ background: `hsl(${hueOf(cid, cats)} 55% 55%)` }} />
              ))}
              <span className="mono text-[9.5px] text-[var(--muted)] ml-auto">{fmtDate(t.date)}</span>
            </div>
            <div className="text-[14.5px] text-[var(--text)] leading-snug">“{t.thought}”</div>
          </button>
        ))}
      </div>
      <p className="text-[12.5px] text-[var(--muted)] leading-relaxed mt-5">
        A shared thread like this is a pattern worth noticing. It is not a diagnosis, and it doesn't mean these
        situations are the same.
      </p>
    </Sheet>
  );
}

const StrengthMeter = ({ strength }: { strength: Strength }) => {
  const s = STRENGTH[strength] || STRENGTH.tentative;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-14 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${s.w * 100}%` }} />
      </span>
      <span className="mono text-[9.5px] text-[var(--muted)]">{s.label}</span>
    </span>
  );
};

function ThoughtDetail({ thought, thoughts, cats, connections, onClose, onOpenThought, onOpenEntity,
                        onEdit, onReflect, onExercise, onAddCat, onRemoveCat, onConn, onLink }: {
  thought: Thought | null; thoughts: Thought[]; cats: Category[]; connections: Connection[];
  onClose: () => void; onOpenThought: (t: Thought) => void; onOpenEntity: (k: NodeKind, id: string) => void;
  onEdit: (t: Thought) => void; onReflect: (t: Thought) => void; onExercise: (t: Thought) => void;
  onAddCat: (t: Thought, cid: string) => void; onRemoveCat: (t: Thought, cid: string) => void;
  onConn: (id: string, status: ConnStatus) => void; onLink: (a: string, b: string) => void;
}) {
  const [addingCat, setAddingCat] = useState(false);
  const [linking, setLinking] = useState(false);
  useEffect(() => { setAddingCat(false); setLinking(false); }, [thought]);
  if (!thought) return null;

  const t = thoughts.find(x => x.id === thought.id) || thought;
  const byId = (id: string) => thoughts.find(x => x.id === id);
  const conns = connections.filter(k => (k.a === t.id || k.b === t.id) && k.status !== "rejected");
  const other = (k: Connection) => byId(k.a === t.id ? k.b : k.a);
  const suggested = conns.filter(k => k.status === "suggested");
  const accepted = conns.filter(k => k.status === "accepted");
  const shareCat = (o?: Thought) => !!o && o.cats.some(c => t.cats.includes(c));
  const availCats = cats.filter(c => !t.cats.includes(c.id));
  const linkable = thoughts.filter(x => x.id !== t.id &&
    !conns.some(k => other(k)?.id === x.id));

  const NodeRow = ({ kind, label }: { kind: NodeKind; label: string }) => (
    <div className="py-3 border-t border-[var(--border)] first:border-0">
      <div className="eyebrow text-[9.5px] text-[var(--muted)] mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {nodeIds(t, kind).map(id => (
          <button key={id} onClick={() => onOpenEntity(kind, id)}
            className="press text-[13px] px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]"
            style={{ borderColor: kindColor(kind) }}>
            {NODE_DICT[kind][id]}
          </button>
        ))}
        {nodeIds(t, kind).length === 0 && <span className="text-[13px] text-[var(--muted)]">Not recorded</span>}
      </div>
    </div>
  );

  return (
    <Sheet open onClose={onClose} title="Thought" full>
      <div className="eyebrow text-[10px] text-[var(--muted)] -mt-2 mb-3">{fmtDate(t.date)}</div>

      {/* weighted thought */}
      <div className="rounded-3xl bg-[var(--soft)] border border-[var(--border)] p-5">
        <div className="text-[22px] leading-snug text-[var(--text)]">“{t.thought}”</div>
        {t.note && <div className="text-[13px] text-[var(--muted)] mt-3 leading-relaxed">{t.note}</div>}
      </div>

      {/* categories — user's own grouping, multiple allowed */}
      <div className="mt-5">
        <div className="eyebrow text-[9.5px] text-[var(--muted)] mb-2">Categories</div>
        <div className="flex flex-wrap gap-2 items-center">
          {t.cats.map(cid => (
            <span key={cid} className="inline-flex items-center gap-1.5 text-[13px] pl-3 pr-2 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
              <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${hueOf(cid, cats)} 55% 55%)` }} />
              {catOf(cid, cats).label}
              <button onClick={() => onRemoveCat(t, cid)} className="press text-[var(--muted)] ml-0.5"><IconClose size={13} /></button>
            </span>
          ))}
          <button onClick={() => setAddingCat(v => !v)}
            className="press text-[13px] px-3 py-1.5 rounded-full border border-dashed border-[var(--border)] text-[var(--muted)] flex items-center gap-1">
            <IconPlus size={13} />Add
          </button>
        </div>
        {addingCat && (
          <div className="flex flex-wrap gap-2 mt-2.5 anim-up">
            {availCats.length ? availCats.map(c => (
              <Chip key={c.id} onClick={() => { onAddCat(t, c.id); setAddingCat(false); }}>{c.label}</Chip>
            )) : <span className="text-[12.5px] text-[var(--muted)]">On every category already.</span>}
          </div>
        )}
      </div>

      {/* shared nodes */}
      <div className="mt-5 rounded-3xl border border-[var(--border)] px-4">
        <NodeRow kind="trigger" label="Trigger" />
        <NodeRow kind="emotion" label="Emotion" />
        <NodeRow kind="compulsion" label="Compulsion / response" />
      </div>
      <p className="mono text-[9.5px] text-[var(--muted)] mt-2 px-1">Tap a node to see every thought that shares it.</p>

      {/* accepted connections */}
      {accepted.length > 0 && (
        <div className="mt-6">
          <div className="eyebrow text-[9.5px] text-[var(--muted)] mb-2.5">Connected thoughts</div>
          <div className="space-y-2">
            {accepted.map(k => { const o = other(k); if (!o) return null; return (
              <button key={k.id} onClick={() => onOpenThought(o)}
                className="press w-full text-left p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[13.5px] text-[var(--text)]">“{o.thought}”</div>
                <div className="mono text-[9.5px] text-[var(--muted)] mt-1.5">
                  {k.source === "user" ? "You linked these" : "Accepted suggestion"}
                </div>
              </button>
            ); })}
          </div>
        </div>
      )}

      {/* suggested connections — hypotheses to accept or reject */}
      {suggested.length > 0 && (
        <div className="mt-6">
          <div className="eyebrow text-[9.5px] text-[var(--muted)] mb-2.5">Suggested by {APP}</div>
          <div className="space-y-2.5">
            {suggested.map(k => { const o = other(k); if (!o) return null; const unrelated = !shareCat(o); return (
              <div key={k.id} className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                {unrelated && <div className="mono text-[9px] text-[var(--accent)] mb-1.5">APPARENTLY UNRELATED</div>}
                <button onClick={() => onOpenThought(o)} className="press text-left text-[14px] text-[var(--text)] leading-snug">“{o.thought}”</button>
                <p className="text-[12.5px] text-[var(--muted)] mt-2 leading-relaxed">{k.basis}</p>
                <div className="flex items-center justify-between mt-3">
                  <StrengthMeter strength={k.strength} />
                  <div className="flex gap-2">
                    <button onClick={() => onConn(k.id, "rejected")}
                      className="press text-[12.5px] px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--muted)]">Not this</button>
                    <button onClick={() => onConn(k.id, "accepted")}
                      className="press text-[12.5px] px-3.5 py-1.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)]">Accept</button>
                  </div>
                </div>
              </div>
            ); })}
          </div>
          <p className="text-[12px] text-[var(--muted)] mt-2.5 leading-relaxed">
            Suggestions are hypotheses from your own records. Nothing is treated as true until you accept it.
          </p>
        </div>
      )}

      {/* manual link */}
      <div className="mt-4">
        <button onClick={() => setLinking(v => !v)}
          className="press text-[13px] text-[var(--accent)] flex items-center gap-1.5">
          <IconPlus size={14} />Link to another thought
        </button>
        {linking && (
          <div className="mt-2 space-y-2 anim-up">
            {linkable.slice(0, 6).map(o => (
              <button key={o.id} onClick={() => { onLink(t.id, o.id); setLinking(false); }}
                className="press w-full text-left p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[13.5px] text-[var(--text)]">
                “{o.thought}”
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2.5 mt-7">
        <Button variant="soft" onClick={() => onEdit(t)}><IconPen size={17} />Edit categorisation</Button>
        <Button variant="outline" onClick={() => onReflect(t)}><IconSpark size={17} />Reflect on this</Button>
        <Button variant="outline" onClick={() => onExercise(t)}><IconWave size={17} />Trigger exercise</Button>
      </div>
    </Sheet>
  );
}

/* Rename / add / remove / merge the user's categories */
function CategoryManager({ open, onClose, cats, setCats, thoughts, onUpdate, toast }: {
  open: boolean; onClose: () => void; cats: Category[]; setCats: Dispatch<SetStateAction<Category[]>>;
  thoughts: Thought[]; onUpdate: (t: Thought) => void; toast: (m: string) => void;
}) {
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  if (!open) return null;
  const count = (id: string) => thoughts.filter(t => t.cats.includes(id)).length;

  const rename = (id: string, label: string) => setCats(prev => prev.map(c => c.id === id ? { ...c, label } : c));
  const remove = (id: string) => {
    thoughts.filter(t => t.cats.includes(id)).forEach(t => onUpdate({ ...t, cats: t.cats.filter(x => x !== id) }));
    setCats(prev => prev.filter(c => c.id !== id));
    toast("Category removed");
  };
  const merge = (from: string, to: string) => {
    thoughts.filter(t => t.cats.includes(from)).forEach(t =>
      onUpdate({ ...t, cats: [...new Set(t.cats.map(x => x === from ? to : x))] }));
    setCats(prev => prev.filter(c => c.id !== from));
    setMergeFrom(null); toast("Categories merged");
  };
  const add = () => {
    const id = "cat_" + Date.now();
    setCats(prev => [...prev, { id, label: "New category", hue: 250, ai: false }]);
  };

  return (
    <Sheet open onClose={onClose} title="Categories" full>
      <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-4">
        Categories are your own way of grouping thoughts — not diagnoses. Rename, merge or remove them freely.
      </p>
      <div className="space-y-2.5">
        {cats.map(c => (
          <div key={c.id} className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: `hsl(${c.hue} 55% 55%)` }} />
              <input value={c.label} onChange={e => rename(c.id, e.target.value)}
                className="flex-1 bg-transparent text-[15px] text-[var(--text)] min-w-0" />
              <span className="mono text-[9.5px] text-[var(--muted)]">{count(c.id)}</span>
              {c.ai && <span className="mono text-[8.5px] text-[var(--accent)]">AI</span>}
            </div>
            <div className="flex gap-2 mt-2.5">
              <button onClick={() => setMergeFrom(mergeFrom === c.id ? null : c.id)}
                className="press text-[12px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted)]">Merge…</button>
              <button onClick={() => remove(c.id)}
                className="press text-[12px] px-2.5 py-1 rounded-full border border-[var(--border)] text-red-500 flex items-center gap-1">
                <IconTrash size={12} />Remove</button>
            </div>
            {mergeFrom === c.id && (
              <div className="flex flex-wrap gap-2 mt-2.5 anim-up">
                <span className="text-[12px] text-[var(--muted)] w-full">Merge into:</span>
                {cats.filter(x => x.id !== c.id).map(x => (
                  <Chip key={x.id} onClick={() => merge(c.id, x.id)}>{x.label}</Chip>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" className="w-full mt-4" onClick={add}><IconPlus size={17} />Add category</Button>
    </Sheet>
  );
}

/* build a rich thought (with flat display fields) from wizard draft */
type Draft = { thought: string; trig: string[]; emo: string[]; comp: string[]; cats: string[] };
const mk2 = (o: Draft & Pick<Thought, "id" | "date" | "intensity" | "note" | "_new">): Thought => ({
  ...o,
  trigger:    o.trig[0] ? TRIGGERS[o.trig[0]] : "Not yet recorded",
  emotion:    o.emo[0] ? EMOTIONS_D[o.emo[0]] : "Unease",
  compulsion: o.comp[0] ? COMPULSIONS[o.comp[0]] : "Not yet recorded",
  category:   o.cats[0],
  related: [],
});

/* Guided categorisation — the step-by-step stand-in for the chatbot flow. */
function CategoriseWizard({ base, cats, onClose, onDone }: {
  base: Partial<Thought> | null; cats: Category[];
  onClose: () => void; onDone: (t: Thought) => void;
}) {
  const blank: Draft = { thought: "", trig: [], emo: [], comp: [], cats: [] };
  const [d, setD] = useState<Draft>(blank);
  const [step, setStep] = useState(0);
  useEffect(() => { if (base) { setD({ ...blank, ...base } as Draft); setStep(0); } }, [base]);
  if (!base) return null;

  const toggle = (key: keyof Omit<Draft, "thought">, id: string) => setD(s => ({
    ...s, [key]: s[key].includes(id) ? s[key].filter(x => x !== id) : [...s[key], id],
  }));
  const single = (key: keyof Omit<Draft, "thought">, id: string) => setD(s => ({ ...s, [key]: [id] }));

  /* naive suggestion: a category whose typical emotion matches */
  const suggestCat = (): string => {
    if (d.emo.includes("e_fear")) return "cat_safety";
    if (d.comp.includes("c_reask") || d.comp.includes("c_check")) return "cat_certainty";
    if (d.emo.includes("e_shame") || d.emo.includes("e_guilt")) return "cat_morality";
    return cats[0]?.id ?? CATEGORIES[0].id;
  };

  const steps = ["thought", "trig", "emo", "comp", "cats"] as const;
  const s = steps[step];

  const finish = () => {
    const suggested = d.cats.length ? d.cats : [suggestCat()];
    onDone(mk2({ ...d, cats: suggested, id: base.id || "t" + Date.now(),
      date: base.date || new Date().toISOString(), intensity: base.intensity || 6,
      note: base.note || "", _new: !base.id }));
  };

  return (
    <Sheet open onClose={onClose} title={base.id ? "Edit categorisation" : "Add a thought"} full>
      <div className="flex gap-1.5 mb-6">
        {steps.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= step ? "var(--accent)" : "var(--border)" }} />
        ))}
      </div>

      <div key={step} className="anim-up">
        <div className="flex gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-full bg-[var(--soft)] grid place-items-center text-[var(--accent)] shrink-0 mt-0.5"><IconSpark size={15} /></div>
          <p className="text-[17px] leading-snug text-[var(--text)]">
            {s === "thought" && "What was the thought, in your words?"}
            {s === "trig" && "What set it off?"}
            {s === "emo" && "What emotion was present? (Pick any that fit.)"}
            {s === "comp" && "Did you do something to relieve it?"}
            {s === "cats" && "Where does this belong? You can choose more than one."}
          </p>
        </div>

        {s === "thought" && (
          <textarea value={d.thought} onChange={e => setD(x => ({ ...x, thought: e.target.value }))} autoFocus
            placeholder="The intrusive thought, doubt or image"
            className="w-full h-28 rounded-2xl p-4 bg-[var(--surface-2)] border border-[var(--border)] text-[15px] text-[var(--text)] placeholder:text-[var(--muted)] resize-none" />
        )}
        {s === "trig" && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(TRIGGERS).map(([id, l]) => <Chip key={id} active={d.trig.includes(id)} onClick={() => single("trig", id)}>{l}</Chip>)}
          </div>
        )}
        {s === "emo" && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(EMOTIONS_D).map(([id, l]) => <Chip key={id} active={d.emo.includes(id)} onClick={() => toggle("emo", id)}>{l}</Chip>)}
          </div>
        )}
        {s === "comp" && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(COMPULSIONS).map(([id, l]) => <Chip key={id} active={d.comp.includes(id)} onClick={() => toggle("comp", id)}>{l}</Chip>)}
          </div>
        )}
        {s === "cats" && (
          <>
            <p className="text-[13px] text-[var(--muted)] mb-3">
              {APP} suggests <span className="text-[var(--accent)]">{catOf(suggestCat(), cats).label}</span>. Confirm or change it.
            </p>
            <div className="flex flex-wrap gap-2">
              {cats.map(c => <Chip key={c.id} active={(d.cats.length ? d.cats : [suggestCat()]).includes(c.id)} onClick={() => toggle("cats", c.id)}>{c.label}</Chip>)}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-7">
        <Button variant="outline" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{step === 0 ? "Cancel" : "Back"}</Button>
        {step < steps.length - 1
          ? <Button onClick={() => setStep(step + 1)} disabled={s === "thought" && !d.thought.trim()}>Continue</Button>
          : <Button onClick={finish}><IconCheck size={17} sw={2.2} />Confirm</Button>}
      </div>
    </Sheet>
  );
}
