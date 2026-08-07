import { useEffect, useState } from "react";
import { fmtDate, fmtDur } from "../data/mock";
import { Card } from "./primitives";
import { IconPause, IconPlay } from "./icons";

interface MemoLike { title: string; duration: number; date: string }

/* A saved voice memo, with a fake transport */
export function MemoCard({ memo, onSelect, selected }: {
  memo: MemoLike; onSelect?: () => void; selected?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos(p => {
      if (p >= memo.duration) { setPlaying(false); return 0; }
      return p + 1;
    }), 320);
    return () => clearInterval(t);
  }, [playing, memo.duration]);

  return (
    <Card onClick={onSelect}
      className={`p-4 ${onSelect ? "press cursor-pointer" : ""} ${selected ? "!border-[var(--accent)]" : ""}`}>
      <div className="flex items-center gap-3.5">
        <button onClick={e => { e.stopPropagation(); setPlaying(p => !p); }}
          className="press w-12 h-12 rounded-full grid place-items-center bg-[var(--accent)] text-[var(--on-accent)] shrink-0">
          {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--text)] truncate">{memo.title}</div>
          <div className="flex items-end gap-[3px] h-6 mt-2">
            {[...Array(28)].map((_, i) => {
              const h = 6 + ((i * 37) % 17);
              const on = (i / 28) * memo.duration <= pos && playing;
              return <div key={i} className="w-[3px] rounded-full transition-colors"
                style={{ height: h, background: on ? "var(--accent)" : "var(--border)" }} />;
            })}
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11.5px] text-[var(--muted)]">
            <span className="tabular-nums">{fmtDur(playing ? pos : memo.duration)}</span>
            <span>·</span><span>{fmtDate(memo.date)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
