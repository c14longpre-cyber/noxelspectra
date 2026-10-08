// NOXEL Spectra Vidéo — timeline : tête de lecture, points de début et de fin.
// Raccourcis : Espace = lecture/pause, I = début, O = fin, ← → = ±1 s (Maj : ±0,1 s)
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { HudButton } from "@hud/HudButton";
import { fmtTime } from "../lib/probe";

type Props = {
  video: HTMLVideoElement | null;
  duration: number;
  inPoint: number;
  outPoint: number;
  onChange: (inPoint: number, outPoint: number) => void;
};

export function Timeline({ video, duration, inPoint, outPoint, onChange }: Props) {
  const bar = useRef<HTMLDivElement | null>(null);
  const drag = useRef<"head" | "in" | "out" | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Tête de lecture synchronisée à chaque image
  useEffect(() => {
    if (!video) return;
    let raf = 0;
    const tick = () => {
      setTime(video.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [video]);

  // La lecture s'arrête à la fin de la sélection. On lit le temps réel de la
  // vidéo, pas l'état React (qui peut être en retard d'une image après un saut).
  useEffect(() => {
    if (video && playing && !video.paused && video.currentTime >= outPoint) {
      video.pause();
      video.currentTime = outPoint;
    }
  }, [video, playing, time, outPoint]);

  const seek = (t: number) => {
    if (video) video.currentTime = Math.min(Math.max(t, 0), duration);
  };
  const toggle = () => {
    if (!video) return;
    if (video.paused) {
      if (video.currentTime >= outPoint - 0.05 || video.currentTime < inPoint) video.currentTime = inPoint;
      video.play().catch(() => undefined);
    } else video.pause();
  };
  const setIn = () => onChange(Math.min(time, outPoint - 0.1), outPoint);
  const setOut = () => onChange(inPoint, Math.max(time, inPoint + 0.1));

  // Clavier (ignoré pendant la saisie dans un champ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      // Espace sur un bouton ou un lien active ce bouton, pas la lecture
      if (e.code === "Space") { if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return; e.preventDefault(); toggle(); }
      else if (e.key === "i" || e.key === "I") setIn();
      else if (e.key === "o" || e.key === "O") setOut();
      else if (e.key === "ArrowLeft") { e.preventDefault(); seek(time - (e.shiftKey ? 0.1 : 1)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); seek(time + (e.shiftKey ? 0.1 : 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  const timeAt = (e: ReactPointerEvent) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * duration;
  };
  const onDown = (e: ReactPointerEvent, what: "head" | "in" | "out") => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = what;
    if (what === "head") seek(timeAt(e));
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const t = timeAt(e);
    if (drag.current === "head") seek(t);
    else if (drag.current === "in") onChange(Math.min(t, outPoint - 0.1), outPoint);
    else onChange(inPoint, Math.max(t, inPoint + 0.1));
  };
  const onUp = () => (drag.current = null);

  // Graduations : environ 10 repères lisibles
  const step = duration <= 15 ? 1 : duration <= 60 ? 5 : duration <= 300 ? 30 : 60;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);

  return (
    <div className="vx-timeline">
      <div className="vx-transport">
        <HudButton action={playing ? "pause" : "play"} iconOnly onClick={toggle} />
        <span className="vx-time">{fmtTime(time)} / {fmtTime(duration)}</span>
        <HudButton action="set-in" compact label="Début" title="Début de la sélection (raccourci : I)" onClick={setIn} />
        <HudButton action="set-out" compact label="Fin" title="Fin de la sélection (raccourci : O)" onClick={setOut} />
        <span className="vx-sel">Sélection : {fmtTime(inPoint)} → {fmtTime(outPoint)} · <b>{fmtTime(outPoint - inPoint)}</b></span>
      </div>
      <div
        ref={bar}
        className="vx-track"
        onPointerDown={(e) => onDown(e, "head")}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="slider"
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
      >
        {ticks.map((t) => (
          <span key={t} className="vx-tick" style={{ left: `${pct(t)}%` }}>{fmtTime(t).replace(/\.\d$/, "")}</span>
        ))}
        <div className="vx-out-left" style={{ width: `${pct(inPoint)}%` }} />
        <div className="vx-out-right" style={{ left: `${pct(outPoint)}%` }} />
        <div className="vx-range" style={{ left: `${pct(inPoint)}%`, width: `${pct(outPoint - inPoint)}%` }} />
        <div className="vx-mark vx-mark-in" style={{ left: `${pct(inPoint)}%` }} onPointerDown={(e) => onDown(e, "in")} onPointerMove={onMove} onPointerUp={onUp} title="Début de la sélection" />
        <div className="vx-mark vx-mark-out" style={{ left: `${pct(outPoint)}%` }} onPointerDown={(e) => onDown(e, "out")} onPointerMove={onMove} onPointerUp={onUp} title="Fin de la sélection" />
        <div className="vx-playhead" style={{ left: `${pct(time)}%` }} />
      </div>
      <p className="vx-hint">Espace : lecture · I / O : début / fin · ← → : ±1 s (Maj : ±0,1 s)</p>
    </div>
  );
}
