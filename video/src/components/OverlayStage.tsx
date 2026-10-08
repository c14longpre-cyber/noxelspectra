// NOXEL Spectra Vidéo — Texte & logo : scène posée sur l'aperçu.
// Dessine les éléments avec le même code que l'export, et permet de les déplacer
// et de les redimensionner directement sur la vidéo.
import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { drawOverlays, hitTest, itemSize } from "../lib/overlay";
import type { OverlayItem } from "../lib/overlay";
import "../textlogo.css";

type Props = {
  video: HTMLVideoElement;
  items: OverlayItem[];
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (id: string, patch: Partial<OverlayItem>) => void;
  readOnly?: boolean; // aperçu seul (filigrane de la section Copyright) : rien à choisir ni à déplacer
};

const HANDLE = 9; // demi-côté de la poignée, en pixels d'écran
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function OverlayStage({ video, items, selectedId, onSelect = () => {}, onChange = () => {}, readOnly = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Dernières valeurs lues par la boucle de dessin, sans la relancer à chaque modification
  const live = useRef({ items, selectedId });
  live.current = { items, selectedId };
  const drag = useRef<null | { id: string; mode: "move" | "resize"; ox: number; oy: number; base: number; dist: number }>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const frame = () => {
      // Le canevas épouse la zone réellement occupée par la vidéo, à la densité de l'écran
      const w = video.clientWidth, h = video.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.style.width !== `${w}px`) canvas.style.width = `${w}px`;
      if (canvas.style.height !== `${h}px`) canvas.style.height = `${h}px`;
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      ctx.clearRect(0, 0, W, H);
      if (W && H) {
        const { items, selectedId } = live.current;
        const t = video.currentTime;
        drawOverlays(ctx, items, t, W, H);
        const sel = items.find((i) => i.id === selectedId);
        if (sel && t >= sel.start && t < sel.end) {
          // Cadre de sélection et poignée de taille (coin bas-droit)
          const { w: iw, h: ih } = itemSize(ctx, sel, W, H);
          ctx.save();
          ctx.translate(sel.x * W, sel.y * H);
          ctx.rotate((sel.rotation * Math.PI) / 180);
          ctx.strokeStyle = "#3ddc84";
          ctx.lineWidth = 1.5 * dpr;
          ctx.setLineDash([6 * dpr, 4 * dpr]);
          ctx.strokeRect(-iw / 2, -ih / 2, iw, ih);
          ctx.setLineDash([]);
          ctx.fillStyle = "#a855f7";
          ctx.strokeStyle = "#fff";
          ctx.fillRect(iw / 2 - HANDLE * dpr, ih / 2 - HANDLE * dpr, HANDLE * 2 * dpr, HANDLE * 2 * dpr);
          ctx.strokeRect(iw / 2 - HANDLE * dpr, ih / 2 - HANDLE * dpr, HANDLE * 2 * dpr, HANDLE * 2 * dpr);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [video]);

  // Position du pointeur en pixels du canevas
  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { px: ((e.clientX - r.left) / r.width) * c.width, py: ((e.clientY - r.top) / r.height) * c.height, W: c.width, H: c.height };
  };
  // Le pointeur est-il sur la poignée de taille de l'élément sélectionné ?
  const onHandle = (ctx: CanvasRenderingContext2D, it: OverlayItem, px: number, py: number, W: number, H: number) => {
    const { w, h } = itemSize(ctx, it, W, H);
    const r = (it.rotation * Math.PI) / 180;
    const hx = it.x * W + (w / 2) * Math.cos(r) - (h / 2) * Math.sin(r);
    const hy = it.y * H + (w / 2) * Math.sin(r) + (h / 2) * Math.cos(r);
    const reach = HANDLE * 2 * (window.devicePixelRatio || 1);
    return Math.abs(px - hx) <= reach && Math.abs(py - hy) <= reach;
  };
  const visibleAt = (t: number) => live.current.items.filter((i) => t >= i.start && t < i.end);

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    const { px, py, W, H } = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    const visible = visibleAt(video.currentTime);
    const sel = visible.find((i) => i.id === live.current.selectedId);
    const base = (it: OverlayItem) => (it.kind === "text" ? it.size : it.width);
    if (sel && onHandle(ctx, sel, px, py, W, H)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: sel.id, mode: "resize", ox: 0, oy: 0, base: base(sel), dist: Math.hypot(px - sel.x * W, py - sel.y * H) || 1 };
      return;
    }
    // L'élément le plus haut dans la pile est dessiné en dernier
    const hit = [...visible].reverse().find((i) => hitTest(ctx, i, px, py, W, H, 6));
    onSelect(hit ? hit.id : null);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: hit.id, mode: "move", ox: px / W - hit.x, oy: py / H - hit.y, base: base(hit), dist: 1 };
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    const { px, py, W, H } = point(e);
    const d = drag.current;
    if (!d) {
      // Curseur : indique ce qu'un clic ferait
      const ctx = e.currentTarget.getContext("2d")!;
      const visible = visibleAt(video.currentTime);
      const sel = visible.find((i) => i.id === live.current.selectedId);
      const cls = sel && onHandle(ctx, sel, px, py, W, H) ? "is-resize" : visible.some((i) => hitTest(ctx, i, px, py, W, H, 6)) ? "is-move" : "";
      e.currentTarget.className = `vx-stage ${cls}`;
      return;
    }
    const it = live.current.items.find((i) => i.id === d.id);
    if (!it) return;
    if (d.mode === "move") onChange(d.id, { x: clamp(px / W - d.ox, 0, 1), y: clamp(py / H - d.oy, 0, 1) });
    else {
      const k = Math.hypot(px - it.x * W, py - it.y * H) / d.dist;
      if (it.kind === "text") onChange(d.id, { size: clamp(d.base * k, 0.02, 0.5) });
      else onChange(d.id, { width: clamp(d.base * k, 0.03, 1.5) });
    }
  }

  if (readOnly) return <canvas ref={canvasRef} className="vx-stage" style={{ pointerEvents: "none" }} aria-hidden="true" />;
  return (
    <canvas
      ref={canvasRef}
      className="vx-stage"
      aria-label="Aperçu des textes et logos : clique un élément pour le choisir, glisse-le pour le déplacer, tire le coin mauve pour changer sa taille. Les mêmes réglages sont disponibles au clavier dans le panneau."
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    />
  );
}
