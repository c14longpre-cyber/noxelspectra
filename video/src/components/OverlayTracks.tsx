// NOXEL Spectra Vidéo — Texte & logo : une piste par élément sous la timeline.
// La barre se glisse pour déplacer l'élément dans le temps ; ses bords règlent le début et la fin.
import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { OverlayItem } from "../lib/overlay";
import { fmtTime } from "../lib/probe";
import "../textlogo.css";

type Props = {
  items: OverlayItem[];
  duration: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<OverlayItem>) => void;
};

const MIN = 0.2; // durée minimale d'un élément (s)
export const itemLabel = (it: OverlayItem) => (it.kind === "text" ? it.text.split("\n")[0] || it.name : it.fileName);

export function OverlayTracks({ items, duration, selectedId, onSelect, onChange }: Props) {
  const drag = useRef<null | { id: string; mode: "move" | "start" | "end"; t0: number; start: number; end: number; width: number }>(null);
  // Quand les pistes défilent dans leur zone (aperçu épinglé), celle de l'élément choisi est amenée à l'écran
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const c = box.current;
    const row = c && selectedId ? c.querySelector<HTMLElement>(`[data-oid="${selectedId}"]`) : null;
    if (!c || !row) return;
    if (row.offsetTop < c.scrollTop) c.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > c.scrollTop + c.clientHeight) c.scrollTop = row.offsetTop + row.offsetHeight - c.clientHeight;
  }, [selectedId, items.length]);
  if (!items.length || duration <= 0) return null;
  const pct = (t: number) => (t / duration) * 100;

  const down = (e: ReactPointerEvent<HTMLElement>, it: OverlayItem, mode: "move" | "start" | "end") => {
    e.stopPropagation();
    onSelect(it.id);
    const row = (e.currentTarget.closest(".vx-otrack") as HTMLElement).getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: it.id, mode, t0: e.clientX, start: it.start, end: it.end, width: row.width };
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = ((e.clientX - d.t0) / d.width) * duration;
    if (d.mode === "move") {
      const len = d.end - d.start;
      const start = Math.min(Math.max(0, d.start + dt), duration - len);
      onChange(d.id, { start, end: start + len });
    } else if (d.mode === "start") onChange(d.id, { start: Math.min(Math.max(0, d.start + dt), d.end - MIN) });
    else onChange(d.id, { end: Math.max(Math.min(duration, d.end + dt), d.start + MIN) });
  };
  const up = () => (drag.current = null);
  // Clavier : ← → déplacent l'élément de 0,1 s (Maj : 1 s), sans bouger la tête de lecture
  const key = (e: ReactKeyboardEvent<HTMLElement>, it: OverlayItem) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    e.stopPropagation();
    const len = it.end - it.start;
    const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : 1);
    const start = Math.min(Math.max(0, it.start + step), duration - len);
    onChange(it.id, { start, end: start + len });
  };

  return (
    <div ref={box} className="vx-otracks" aria-label="Pistes des textes et logos">
      {items.map((it) => (
        <div key={it.id} className="vx-otrack" data-oid={it.id}>
          <button
            type="button"
            className={`vx-obar${it.id === selectedId ? " is-on" : ""}`}
            style={{ left: `${pct(it.start)}%`, width: `${pct(it.end - it.start)}%` }}
            aria-pressed={it.id === selectedId}
            aria-label={`${it.kind === "text" ? "Texte" : "Logo"} « ${itemLabel(it)} », de ${fmtTime(it.start)} à ${fmtTime(it.end)}. Flèches gauche et droite pour le déplacer dans le temps.`}
            onClick={() => onSelect(it.id)}
            onKeyDown={(e) => key(e, it)}
            onPointerDown={(e) => down(e, it, "move")}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <span className="vx-ohandle is-start" onPointerDown={(e) => down(e, it, "start")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            {itemLabel(it)}
            <span className="vx-ohandle is-end" onPointerDown={(e) => down(e, it, "end")} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </button>
        </div>
      ))}
    </div>
  );
}
