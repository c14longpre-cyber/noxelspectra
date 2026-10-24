// Réglage des couleurs d'un dégradé de texte : comme dans Spectra image, chaque couleur a un
// emplacement (0–100 %) qu'on peut glisser sur la barre, taper ou régler au curseur.
import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { HudButton } from "@hud/HudButton";
import { MAX_STOPS, MIN_STOPS } from "../../../frontend/src/components/spectra-gradient/gradient-engine";
import type { Stop } from "../lib/overlay";

const pct = (v: number) => Math.round(v * 100);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function GradientStops({ stops, onChange }: { stops: Stop[]; onChange: (stops: Stop[]) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const sorted = stops.map((s, i) => ({ ...s, i })).sort((a, b) => a.at - b.at);
  const css = `linear-gradient(90deg, ${sorted.map((s) => `${s.color} ${pct(s.at)}%`).join(", ")})`;
  const set = (i: number, patch: Partial<Stop>) => onChange(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const drag = (i: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setActive(i);
    const el = bar.current;
    if (!el) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      set(i, { at: clamp01((ev.clientX - r.left) / r.width) });
    };
    const up = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", up); };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };
  const nudge = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(i, { at: clamp01(stops[i].at - step) }); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(i, { at: clamp01(stops[i].at + step) }); }
  };
  const add = () => {
    // Nouvelle couleur au milieu du plus grand écart, reprise de la couleur à sa gauche
    let gi = 0;
    for (let k = 0; k < sorted.length - 1; k++) if (sorted[k + 1].at - sorted[k].at > sorted[gi + 1].at - sorted[gi].at) gi = k;
    const at = sorted.length > 1 ? (sorted[gi].at + sorted[gi + 1].at) / 2 : 0.5;
    onChange([...stops, { at, color: sorted[gi]?.color ?? "#ffffff" }]);
    setActive(stops.length);
  };
  const remove = (i: number) => { onChange(stops.filter((_, j) => j !== i)); setActive(0); };
  const reverse = () => onChange(stops.map((s) => ({ ...s, at: 1 - s.at })));
  const spread = () => {
    const order = sorted.map((s) => s.i);
    onChange(stops.map((s, j) => ({ ...s, at: order.indexOf(j) / (stops.length - 1) })));
  };

  return (
    <div className="vx-stops">
      <div className="vx-stops-bar" ref={bar} style={{ background: css }}>
        {stops.map((s, i) => (
          <button key={i} type="button" className={`vx-stop-handle${i === active ? " is-on" : ""}`} style={{ left: `${s.at * 100}%`, background: s.color }}
            aria-label={`Couleur ${i + 1}, emplacement ${pct(s.at)} %. Flèches pour déplacer (Maj : 10 %).`}
            onPointerDown={drag(i)} onKeyDown={nudge(i)} onFocus={() => setActive(i)} />
        ))}
      </div>
      <div className="vx-stops-rows">
        {stops.map((s, i) => (
          <div key={i} className={`vx-stop-row${i === active ? " is-on" : ""}`} onFocus={() => setActive(i)}>
            <input type="color" value={s.color} aria-label={`Couleur ${i + 1}`} onChange={(e) => set(i, { color: e.target.value })} />
            <input type="range" min={0} max={100} step={1} value={pct(s.at)} aria-label={`Emplacement de la couleur ${i + 1}`} onChange={(e) => set(i, { at: Number(e.target.value) / 100 })} />
            <span className="vx-stop-num"><input type="number" min={0} max={100} step={1} value={pct(s.at)} aria-label={`Emplacement de la couleur ${i + 1} en %`}
              onChange={(e) => set(i, { at: clamp01((Number(e.target.value) || 0) / 100) })} /> %</span>
            <HudButton action="remove-image" compact iconOnly label={`Retirer la couleur ${i + 1}`} disabled={stops.length <= MIN_STOPS} onClick={() => remove(i)} />
          </div>
        ))}
      </div>
      <div className="vx-row">
        <HudButton action="add-color" compact label="+ Couleur" disabled={stops.length >= MAX_STOPS} onClick={add} />
        <HudButton action="reverse-stops" compact iconOnly label="Inverser les couleurs" onClick={reverse} />
        <HudButton action="spread-stops" compact iconOnly label="Répartir les couleurs" onClick={spread} />
      </div>
    </div>
  );
}
