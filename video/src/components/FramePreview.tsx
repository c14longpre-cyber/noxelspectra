// NOXEL Spectra Vidéo — aperçu en direct d'un cadrage (partagé : Recadrer, Décliner pour les réseaux)
import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cropRect, targetDims } from "../lib/reframe";
import type { Aspect, ReframeMode } from "../lib/reframe";

type Props = {
  video: HTMLVideoElement | null;
  src: { width: number; height: number };
  aspect: Aspect;
  mode: ReframeMode;
  focus: { x: number; y: number };
  onFocus: (f: { x: number; y: number }) => void;
  width?: number; // largeur d'affichage maximale
};

export function FramePreview({ video, src, aspect, mode, focus, onFocus, width = 360 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const small = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const rect = cropRect(src, aspect, focus.x, focus.y);
  const out = targetDims(aspect, 1080);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !video || !video.videoWidth || !src.width) return;
    const ctx = c.getContext("2d")!;
    if (mode === "crop") {
      const s = width / src.width;
      c.width = width;
      c.height = Math.round(src.height * s);
      ctx.drawImage(video, 0, 0, c.width, c.height);
      const x = rect.left * s, y = rect.top * s, w = rect.width * s, h = rect.height * s;
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      ctx.fillRect(0, 0, c.width, y);
      ctx.fillRect(0, y + h, c.width, c.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, c.width - x - w, h);
      ctx.strokeStyle = "#3ddc84";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x + (w * i) / 3, y); ctx.lineTo(x + (w * i) / 3, y + h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + (h * i) / 3); ctx.lineTo(x + w, y + (h * i) / 3); ctx.stroke();
      }
    } else {
      // Composition finale, à la proportion du format (les verticaux un peu plus étroits)
      const ratio = out.width / out.height;
      c.height = Math.round(ratio >= 1 ? width / ratio : width * 1.2);
      c.width = Math.round(c.height * ratio);
      if (mode === "blur") {
        const sm = small.current || (small.current = document.createElement("canvas"));
        sm.width = Math.max(8, Math.round(c.width / 24));
        sm.height = Math.max(8, Math.round(c.height / 24));
        const cover = Math.max(sm.width / src.width, sm.height / src.height);
        sm.getContext("2d")!.drawImage(video, (sm.width - src.width * cover) / 2, (sm.height - src.height * cover) / 2, src.width * cover, src.height * cover);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sm, 0, 0, c.width, c.height);
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.fillRect(0, 0, c.width, c.height);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      const fit = Math.min(c.width / src.width, c.height / src.height);
      ctx.drawImage(video, (c.width - src.width * fit) / 2, (c.height - src.height * fit) / 2, src.width * fit, src.height * fit);
    }
  }, [video, mode, rect.left, rect.top, rect.width, rect.height, src.width, src.height, out.width, out.height, width]);

  useEffect(() => {
    draw();
    if (!video) return;
    let raf = 0;
    const loop = () => { draw(); if (!video.paused) raf = requestAnimationFrame(loop); };
    const onPlay = () => { raf = requestAnimationFrame(loop); };
    video.addEventListener("seeked", draw);
    video.addEventListener("loadeddata", draw);
    video.addEventListener("play", onPlay);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("seeked", draw);
      video.removeEventListener("loadeddata", draw);
      video.removeEventListener("play", onPlay);
    };
  }, [draw, video]);

  function moveTo(e: ReactPointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * src.width;
    const py = ((e.clientY - r.top) / r.height) * src.height;
    const fx = src.width > rect.width ? (px - rect.width / 2) / (src.width - rect.width) : 0.5;
    const fy = src.height > rect.height ? (py - rect.height / 2) / (src.height - rect.height) : 0.5;
    onFocus({ x: Math.min(1, Math.max(0, fx)), y: Math.min(1, Math.max(0, fy)) });
  }

  const canMove = mode === "crop" && (rect.width < src.width - 2 || rect.height < src.height - 2);
  return (
    <canvas
      ref={canvasRef}
      className="vx-reframe-preview"
      style={{ cursor: canMove ? "move" : "default" }}
      aria-label={canMove ? `Cadrage ${aspect} : glisse pour déplacer la zone gardée` : `Aperçu ${aspect}`}
      onPointerDown={(e) => { if (!canMove) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; moveTo(e); }}
      onPointerMove={(e) => { if (dragging.current) moveTo(e); }}
      onPointerUp={() => (dragging.current = false)}
    />
  );
}

/** Petite icône de proportion (rectangle couché pour 16:9, debout pour 9:16). */
export function AspectIcon({ aspect }: { aspect: Aspect }) {
  const [a, b] = aspect.split(":").map(Number);
  const r = a / b;
  const size = 28;
  return <i className="vx-aspect-icon" style={r >= 1 ? { width: size, height: size / r } : { width: size * r, height: size }} />;
}
