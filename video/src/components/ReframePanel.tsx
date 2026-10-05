// NOXEL Spectra Vidéo — panneau Recadrer & redimensionner (aperçu en direct, cadre déplaçable)
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { ASPECTS, cropRect, reframeVideo, targetDims } from "../lib/reframe";
import type { Aspect, ReframeMode } from "../lib/reframe";
import { formatSupport } from "../lib/compress";
import type { CompressFormat } from "../lib/compress";
import { fmtBytes, referenceBitrate } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  video: HTMLVideoElement | null;
  onContinue: (blob: Blob, ext: string, suffix: string) => void;
};

const PREVIEW_W = 360;

export function ReframePanel({ file, info, range, video, onContinue }: Props) {
  const src = { width: info.video?.width || 0, height: info.video?.height || 0, fps: info.video?.fps || 30 };
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [mode, setMode] = useState<ReframeMode>("crop");
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [shortSide, setShortSide] = useState(1080);
  const [fps30, setFps30] = useState(src.fps > 31);
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [format, setFormat] = useState<CompressFormat>("mp4");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; size: number; dims: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const small = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const cancel = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    formatSupport().then((s) => {
      setSupport(s);
      if (!s.mp4 && s.webm) setFormat("webm");
    });
  }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const out = targetDims(aspect, Math.min(shortSide, Math.min(src.width, src.height) || shortSide));
  const rect = cropRect(src, aspect, focus.x, focus.y);
  // L'image entière tient déjà dans le format ? Le cadrage n'a alors rien à couper.
  const nothingToCrop = rect.width >= src.width - 2 && rect.height >= src.height - 2;

  // ── Aperçu : image courante de la vidéo, cadre ou composition finale ──
  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !video || !video.videoWidth) return;
    const ctx = c.getContext("2d")!;
    if (mode === "crop") {
      const s = PREVIEW_W / src.width;
      c.width = PREVIEW_W;
      c.height = Math.round(src.height * s);
      ctx.drawImage(video, 0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      const x = rect.left * s, y = rect.top * s, w = rect.width * s, h = rect.height * s;
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
      const ratio = out.width / out.height;
      c.width = ratio >= 1 ? PREVIEW_W : Math.round(PREVIEW_W * 0.75 * ratio * 1.6);
      c.height = Math.round(c.width / ratio);
      if (mode === "blur") {
        const sm = small.current || (small.current = document.createElement("canvas"));
        sm.width = Math.max(8, Math.round(c.width / 24));
        sm.height = Math.max(8, Math.round(c.height / 24));
        const sc = sm.getContext("2d")!;
        const cover = Math.max(sm.width / src.width, sm.height / src.height);
        sc.drawImage(video, (sm.width - src.width * cover) / 2, (sm.height - src.height * cover) / 2, src.width * cover, src.height * cover);
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
  }, [video, mode, rect.left, rect.top, rect.width, rect.height, src.width, src.height, out.width, out.height]);

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

  // Glisser le cadre dans l'aperçu
  function moveTo(e: ReactPointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * src.width;
    const py = ((e.clientY - r.top) / r.height) * src.height;
    const fx = src.width > rect.width ? (px - rect.width / 2) / (src.width - rect.width) : 0.5;
    const fy = src.height > rect.height ? (py - rect.height / 2) / (src.height - rect.height) : 0.5;
    setFocus({ x: Math.min(1, Math.max(0, fx)), y: Math.min(1, Math.max(0, fy)) });
  }

  const fps = fps30 ? Math.min(30, src.fps) : src.fps;
  const videoBitrate = Math.round(referenceBitrate(out.width, out.height, fps) * 0.7);
  const estimate = ((videoBitrate + 128000) * (range[1] - range[0])) / 8;

  async function run() {
    setError(null);
    setProgress(0);
    try {
      const r = await reframeVideo(
        file, src,
        { start: range[0], end: range[1], aspect, mode, focusX: focus.x, focusY: focus.y, shortSide: Math.min(shortSide, Math.min(src.width, src.height)), format, videoBitrate, fps30 },
        setProgress, (c) => (cancel.current = c)
      );
      setResult({ url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.ext, size: r.blob.size, dims: `${r.width} × ${r.height}` });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Recadrage impossible : ${e.message}` : "Recadrage impossible.");
    } finally {
      setProgress(null);
      cancel.current = null;
    }
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const suffix = aspect.replace(":", "x");

  return (
    <div className="vx-reframe">
      <div className="vx-aspects">
        {ASPECTS.map((a) => (
          <button key={a.id} type="button" className={`vx-aspect${a.id === aspect ? " is-on" : ""}`} onClick={() => setAspect(a.id)} aria-pressed={a.id === aspect}>
            <i style={{ aspectRatio: a.id.replace(":", " / ") }} />
            <b>{a.label}</b>
            <span>{a.use}</span>
          </button>
        ))}
      </div>

      <div className="vx-reframe-body">
        <div>
          <canvas
            ref={canvasRef}
            className="vx-reframe-preview"
            style={{ cursor: mode === "crop" && !nothingToCrop ? "move" : "default" }}
            onPointerDown={(e) => { if (mode !== "crop") return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; moveTo(e); }}
            onPointerMove={(e) => { if (dragging.current) moveTo(e); }}
            onPointerUp={() => (dragging.current = false)}
          />
          <p className="vx-hint">{mode === "crop" ? (nothingToCrop ? "L'image entière tient déjà dans ce format." : "Glisse le cadre vert pour choisir la zone gardée.") : "Aperçu du résultat final."} Image affichée : position actuelle de la vidéo.</p>
        </div>
        <div className="vx-fields" style={{ alignContent: "start" }}>
          <div className="vx-modes" role="radiogroup" aria-label="Remplissage">
            <label><input type="radio" name="rmode" checked={mode === "crop"} onChange={() => setMode("crop")} /><b>Recadrer</b> — remplit le format, coupe les bords</label>
            <label><input type="radio" name="rmode" checked={mode === "blur"} onChange={() => setMode("blur")} /><b>Fond flouté</b> — toute l'image, sur un flou de la vidéo</label>
            <label><input type="radio" name="rmode" checked={mode === "bars"} onChange={() => setMode("bars")} /><b>Bandes noires</b> — toute l'image</label>
          </div>
          <label>Résolution
            <select value={shortSide} onChange={(e) => setShortSide(Number(e.target.value))}>
              <option value={1080}>1080 (recommandé pour les réseaux)</option>
              <option value={720}>720 (plus léger)</option>
            </select>
          </label>
          <label>Format
            <select value={format} onChange={(e) => setFormat(e.target.value as CompressFormat)}>
              <option value="mp4" disabled={support ? !support.mp4 : false}>MP4 (H.264) — accepté par tous les réseaux</option>
              <option value="webm" disabled={support ? !support.webm : false}>WebM (VP9) — pour le web</option>
            </select>
          </label>
          {src.fps > 31 && (
            <label className="vx-check"><input type="checkbox" checked={fps30} onChange={(e) => setFps30(e.target.checked)} /> Limiter à 30 images/s</label>
          )}
          <div className="vx-estimate">
            <span>Sortie : <b>{out.width} × {out.height}</b> · {fps} i/s</span>
            <span>Poids estimé : <b>{fmtBytes(estimate)}</b></span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="crop" label={`Créer la version ${aspect}`} busy={progress !== null}
          busyLabel={progress !== null ? `Recadrage… ${Math.round(progress * 100)} %` : undefined}
          disabled={!support || (!support.mp4 && !support.webm)} onClick={run} />
        {progress !== null && <button type="button" className="vx-btn" onClick={() => cancel.current?.()}>Annuler</button>}
      </div>
      {error && <p className="vx-alert">{error}</p>}
      {result && (
        <div className="vx-result">
          <span>✓ {result.dims} · {fmtBytes(result.size)} · {result.ext.toUpperCase()}</span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-${suffix}.${result.ext}`} />
          <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext, suffix)} />
        </div>
      )}
    </div>
  );
}
