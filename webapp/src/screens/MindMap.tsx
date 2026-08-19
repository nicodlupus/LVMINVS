import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  APP, CATEGORIES, COMPULSIONS, EMOTIONS_D, NODE_DICT, STRENGTH, TRIGGERS,
  catOf, fmtDate, hueOf, nodeIds,
} from "../data/mock";
import type { Category, ConnStatus, Connection, NodeKind, Strength, Thought } from "../types";
import {
  IconCheck, IconClose, IconFilter, IconPen, IconPlus, IconSpark, IconTrash, IconWave,
} from "../ui/icons";
import { Button, Card, Chip, Header, Sheet, Tag } from "../ui/primitives";
import type { ScreenProps } from "./shared";

/* ═══════════════════════════════════════════════════════════════════════
   MINDMAP — a network of thoughts and the shared threads (trigger,
   emotion, compulsion) that connect them. No central hub; the shape
   emerges from what the user has actually captured. Filters let the
   user narrow to a category or hide a class of thread.
   ═══════════════════════════════════════════════════════════════════════ */

const KIND_HUE: Record<NodeKind, number | null> = { compulsion: null, trigger: 205, emotion: 25 };
const kindColor = (kind: NodeKind): string =>
  kind === "compulsion" ? "var(--accent)" : `hsl(${KIND_HUE[kind]} 55% 58%)`;
const kindLabel = { trigger: "Triggers", emotion: "Emotions", compulsion: "Compulsions" } as const;

/* ── force-directed layout ─────────────────────────────────────────────
   A small physics loop: repulsion between every pair of nodes, springs
   on edges, a gentle pull toward the centre. Deterministic seeds so the
   same graph always settles into the same shape. */
function runForceLayout(
  nodes: { id: string; size: number }[],
  edges: [string, string][],
  W: number, H: number,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const vel = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const a = (i * 137.508 * Math.PI) / 180;             // golden-angle spread
    const r = 40 + i * 3;
    pos.set(n.id, { x: W / 2 + Math.cos(a) * r * 0.35, y: H / 2 + Math.sin(a) * r * 0.35 });
    vel.set(n.id, { x: 0, y: 0 });
  });
  const K_REP = 2400, K_SPR = 0.045, REST = 66, DAMP = 0.80, CTR = 0.0018;
  const ITER = 280;
  for (let it = 0; it < ITER; it++) {
    const f = new Map<string, { x: number; y: number }>();
    nodes.forEach(n => f.set(n.id, { x: 0, y: 0 }));
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = pos.get(nodes[i].id)!, b = pos.get(nodes[j].id)!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 36);
        const d = Math.sqrt(d2);
        const mag = K_REP / d2;
        const fx = (mag * dx) / d, fy = (mag * dy) / d;
        const fi = f.get(nodes[i].id)!, fj = f.get(nodes[j].id)!;
        fi.x -= fx; fi.y -= fy; fj.x += fx; fj.y += fy;
      }
    }
    edges.forEach(([a, b]) => {
      const pa = pos.get(a), pb = pos.get(b);
      if (!pa || !pb) return;
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const mag = K_SPR * (d - REST);
      const fx = (mag * dx) / d, fy = (mag * dy) / d;
      const fa = f.get(a)!, fb = f.get(b)!;
      fa.x += fx; fa.y += fy; fb.x -= fx; fb.y -= fy;
    });
    nodes.forEach(n => {
      const p = pos.get(n.id)!, fo = f.get(n.id)!, v = vel.get(n.id)!;
      fo.x += (W / 2 - p.x) * CTR;
      fo.y += (H / 2 - p.y) * CTR;
      v.x = (v.x + fo.x) * DAMP;
      v.y = (v.y + fo.y) * DAMP;
      const pad = n.size / 2 + 4;
      p.x = Math.max(pad, Math.min(W - pad, p.x + v.x));
      p.y = Math.max(pad, Math.min(H - pad, p.y + v.y));
    });
  }
  return pos;
}

/* ── the network graph ──────────────────────────────────────────────── */

interface NetProps {
  thoughts: Thought[];
  connections: Connection[];
  cats: Category[];
  kinds: Set<NodeKind>;
  onOpenThought: (t: Thought) => void;
  onOpenEntity: (k: NodeKind, id: string) => void;
}

function NetworkGraph({ thoughts, connections, cats, kinds, onOpenThought, onOpenEntity }: NetProps) {
  const W = 340, H = 400;

  const { nodes, edges, thoughtById, entityByKey } = useMemo(() => {
    type Ent = { kind: NodeKind; id: string; label: string; n: number };
    const nodesRaw: { id: string; size: number }[] = [];
    const thoughtById = new Map<string, Thought>();
    const entityByKey = new Map<string, Ent>();

    thoughts.forEach(t => {
      nodesRaw.push({ id: `t:${t.id}`, size: 60 });
      thoughtById.set(`t:${t.id}`, t);
    });

    /* entities that show up in ≥ 2 filtered thoughts — these are the
       shared threads that make a pattern visible in the first place */
    (["trigger", "emotion", "compulsion"] as NodeKind[]).forEach(kind => {
      if (!kinds.has(kind)) return;
      const dict = NODE_DICT[kind];
      Object.keys(dict).forEach(id => {
        const n = thoughts.filter(t => nodeIds(t, kind).includes(id)).length;
        if (n >= 2) {
          const key = `${kind}:${id}`;
          nodesRaw.push({ id: key, size: Math.min(52, 34 + n * 3) });
          entityByKey.set(key, { kind, id, label: dict[id], n });
        }
      });
    });

    const nodeSet = new Set(nodesRaw.map(n => n.id));
    const edges: [string, string][] = [];
    thoughts.forEach(t => {
      (["trigger", "emotion", "compulsion"] as NodeKind[]).forEach(kind => {
        if (!kinds.has(kind)) return;
        nodeIds(t, kind).forEach(id => {
          const k = `${kind}:${id}`;
          if (nodeSet.has(k)) edges.push([`t:${t.id}`, k]);
        });
      });
    });
    connections.filter(c => c.status === "accepted").forEach(c => {
      const a = `t:${c.a}`, b = `t:${c.b}`;
      if (nodeSet.has(a) && nodeSet.has(b)) edges.push([a, b]);
    });

    return { nodes: nodesRaw, edges, thoughtById, entityByKey };
  }, [thoughts, connections, kinds]);

  const positions = useMemo(() => runForceLayout(nodes, edges, W, H), [nodes, edges]);

  const entityEdges = edges.filter(([a, b]) => !(a.startsWith("t:") && b.startsWith("t:")));
  const thoughtEdges = edges.filter(([a, b]) => a.startsWith("t:") && b.startsWith("t:"));

  return (
    <div className="relative w-full h-full grid place-items-center anim-in">
      <div className="relative shrink-0" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0 overflow-visible">
          {entityEdges.map(([a, b], i) => {
            const pa = positions.get(a)!, pb = positions.get(b)!;
            return <line key={"e" + i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                         stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" opacity={0.85} />;
          })}
          {thoughtEdges.map(([a, b], i) => {
            const pa = positions.get(a)!, pb = positions.get(b)!;
            return <line key={"t" + i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                         stroke="var(--accent)" strokeWidth={1.6} opacity={0.55} />;
          })}
        </svg>

        {nodes.map(n => {
          const p = positions.get(n.id)!;
          const t = thoughtById.get(n.id);
          if (t) {
            const cat = catOf(t.cats[0], cats);
            const s = n.size;
            const preview = t.thought.length > 32 ? t.thought.slice(0, 30).trim() + "…" : t.thought;
            return (
              <button key={n.id} onClick={() => onOpenThought(t)}
                className="press absolute rounded-full grid place-items-center text-center border-2 p-1.5 anim-up"
                style={{ left: p.x - s / 2, top: p.y - s / 2, width: s, height: s,
                         background: "var(--surface)", borderColor: `hsl(${cat.hue} 55% 55%)`,
                         boxShadow: "var(--shadow)" }}>
                <span className="leading-tight text-[8.5px] text-[var(--text)] line-clamp-3">{preview}</span>
              </button>
            );
          }
          const e = entityByKey.get(n.id)!;
          const s = n.size;
          return (
            <button key={n.id} onClick={() => onOpenEntity(e.kind, e.id)}
              className="press absolute rounded-full grid place-items-center text-center border p-1 anim-up"
              style={{ left: p.x - s / 2, top: p.y - s / 2, width: s, height: s,
                       background: "var(--surface-2)", borderColor: kindColor(e.kind),
                       boxShadow: "var(--shadow)" }}>
              <span className="leading-tight text-[8.5px] text-[var(--muted)] line-clamp-2">{e.label}</span>
              <span className="mono text-[8px] text-[var(--muted)] mt-0.5">×{e.n}</span>
            </button>
          );
        })}
      </div>
      <div className="absolute bottom-2 inset-x-0 text-center eyebrow text-[9px] text-[var(--muted)] pointer-events-none">
        Category ring · dashed = shared thread · accent = connected thoughts
      </div>
    </div>
  );
}

/* ── empty state ────────────────────────────────────────────────────── */

function EmptyState({ message, onPrimary, primary }: {
  message: string; onPrimary: () => void; primary: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] grid place-items-center text-[var(--muted)] mb-4">
        <IconSpark size={22} />
      </div>
      <p className="text-[14px] text-[var(--muted)] leading-relaxed max-w-[260px]">{message}</p>
      <Button className="mt-5" onClick={onPrimary}>{primary}</Button>
    </div>
  );
}

/* ── screen ─────────────────────────────────────────────────────────── */

interface MapProps extends ScreenProps {
  onUpdate: (t: Thought) => void;
  cats: Category[];
  setCats: Dispatch<SetStateAction<Category[]>>;
  connections: Connection[];
  setConnections: Dispatch<SetStateAction<Connection[]>>;
}

export function MapScreen({ go, openMenu, thoughts, onUpdate, toast, cats, setCats, connections, setConnections }: MapProps) {
  const [lens, setLens] = useState<"network" | "list">("network");
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Set<NodeKind>>(new Set(["trigger", "emotion", "compulsion"]));
  const [detail, setDetail] = useState<Thought | null>(null);
  const [entity, setEntity] = useState<{ kind: NodeKind; id: string } | null>(null);
  const [wizard, setWizard] = useState<Partial<Thought> | null>(null);
  const [manage, setManage] = useState(false);
  const [opens, setOpens] = useState(0);
  const [muted, setMuted] = useState(false);

  const toggleCat = (id: string) => setActiveCats(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleKind = (k: NodeKind) => setKinds(prev => {
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  const filtered = useMemo(() =>
    activeCats.size === 0 ? thoughts : thoughts.filter(t => t.cats.some(c => activeCats.has(c))),
    [thoughts, activeCats]);

  const openDetail = (t: Thought) => { setDetail(t); setOpens(o => o + 1); };
  const openEntity = (kind: NodeKind, id: string) => { setEntity({ kind, id }); setOpens(o => o + 1); };
  const ruminating = opens >= 7 && !muted;

  return (
    <>
      <Header title="MindMap"
              subtitle={`${filtered.length}${activeCats.size ? ` of ${thoughts.length}` : ""} thoughts · ${cats.length} categories`}
              onMenu={openMenu} onAvatar={() => go("profile")} />

      {/* lens switch + manage */}
      <div className="shrink-0 px-5 pb-2 flex items-center gap-2">
        <div className="flex p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex-1">
          {([["network", "Network"], ["list", "List"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setLens(id)}
              className={`press flex-1 py-2 rounded-xl text-[13px]
                ${lens === id ? "bg-[var(--surface)] text-[var(--text)]" : "text-[var(--muted)]"}`}
              style={lens === id ? { boxShadow: "var(--shadow)" } : {}}>{l}</button>
          ))}
        </div>
        <button onClick={() => setManage(true)}
          className="press w-10 h-10 rounded-xl grid place-items-center bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)]"
          aria-label="Manage categories">
          <IconFilter size={18} />
        </button>
      </div>

      {/* category filter */}
      {cats.length > 0 && (
        <div className="shrink-0 px-5 pb-1.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="eyebrow text-[9.5px] text-[var(--muted)] mr-1">Categories</span>
            {cats.map(c => (
              <Chip key={c.id} active={activeCats.has(c.id)} onClick={() => toggleCat(c.id)}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: `hsl(${c.hue} 55% 55%)` }} />
                {c.label}
              </Chip>
            ))}
            {activeCats.size > 0 && (
              <button onClick={() => setActiveCats(new Set())}
                className="press text-[12px] text-[var(--muted)] px-2">Clear</button>
            )}
          </div>
        </div>
      )}

      {/* thread-kind filter (only relevant in the network view) */}
      {lens === "network" && (
        <div className="shrink-0 px-5 pb-3">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="eyebrow text-[9.5px] text-[var(--muted)] mr-1">Threads</span>
            {(["trigger", "emotion", "compulsion"] as NodeKind[]).map(k => (
              <Chip key={k} active={kinds.has(k)} onClick={() => toggleKind(k)}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: kindColor(k) }} />
                {kindLabel[k]}
              </Chip>
            ))}
          </div>
        </div>
      )}

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

      {/* body */}
      {lens === "network" && (
        <div className="flex-1 relative overflow-hidden etch pb-16">
          {thoughts.length === 0 ? (
            <EmptyState message="Your map is empty. Capture a thought and it will appear here — the network grows from what you actually write."
              onPrimary={() => setWizard({ thought: "", cats: [], trig: [], emo: [], comp: [] })}
              primary="Add your first thought" />
          ) : filtered.length === 0 ? (
            <EmptyState message="No thoughts match these filters."
              onPrimary={() => setActiveCats(new Set())}
              primary="Clear category filter" />
          ) : (
            <NetworkGraph thoughts={filtered} connections={connections} cats={cats}
              kinds={kinds} onOpenThought={openDetail} onOpenEntity={openEntity} />
          )}
        </div>
      )}

      {lens === "list" && (
        <div className="scroll flex-1 px-5 pb-24 space-y-3 stagger">
          {filtered.length === 0 ? (
            <p className="text-center text-[13.5px] text-[var(--muted)] mt-10 max-w-[260px] mx-auto leading-relaxed">
              {thoughts.length === 0
                ? "Your list is empty. Capture a thought to start it."
                : "No thoughts match these filters."}
            </p>
          ) : filtered.map(t => (
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

      {/* add thought — sits in the bottom-right corner, clear of the graph */}
      <button onClick={() => setWizard({ thought: "", cats: [], trig: [], emo: [], comp: [] })}
        className="press absolute right-4 bottom-[84px] z-30 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--on-accent)]"
        style={{ width: 52, height: 52, boxShadow: "0 12px 28px -10px var(--accent)" }}
        aria-label="Add a thought">
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
    setCats(prev => [...prev, { id, label: "New category", hue: (prev.length * 53 + 195) % 360, ai: false }]);
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
