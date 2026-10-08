// NOXEL Spectra Vidéo — panneau Recadrer & redimensionner (aperçu en direct, cadre déplaçable)
import { useEffect, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { ASPECTS, cropRect, reframeVideo, targetDims } from "../lib/reframe";
import { AspectIcon, FramePreview } from "./FramePreview";
import type { Aspect, ReframeMode } from "../lib/reframe";
import { formatSupport } from "../lib/compress";
import type { CompressFormat } from "../lib/compress";
import { useCancel } from "../lib/useCancel";
import { fmtBytes, referenceBitrate } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  video: HTMLVideoElement | null;
  onContinue: (blob: Blob, ext: string, suffix: string) => void;
};

export function ReframePanel({ file, info, range, video, onContinue }: Props) {
  const src = { width: info.video?.width || 0, height: info.video?.height || 0, fps: info.video?.fps || 30, audioBitrate: info.audio?.bitrate || 0 };
  const audioEstimate = info.audio ? Math.min(128000, info.audio.bitrate || 128000) : 0;
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
  const job = useCancel();
  const urls = useRef<string[]>([]);

  useEffect(() => {
    formatSupport().then((s) => {
      setSupport(s);
      if (!s.mp4 && s.webm) setFormat("webm");
    });
  }, []);
  // Les fichiers produits ne sont libérés qu'en quittant l'outil
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const out = targetDims(aspect, Math.min(shortSide, Math.min(src.width, src.height) || shortSide));
  const rect = cropRect(src, aspect, focus.x, focus.y);
  // L'image entière tient déjà dans le format ? Le cadrage n'a alors rien à couper.
  const nothingToCrop = rect.width >= src.width - 2 && rect.height >= src.height - 2;

  const fps = fps30 ? Math.min(30, src.fps) : src.fps;
  // Sous le débit de la source, avec 10 % de marge : l'encodeur dépasse de quelques pour cent
  const videoBitrate = Math.round(Math.min(referenceBitrate(out.width, out.height, fps) * 0.7, (info.video?.bitrate || Infinity) * 0.9));
  const estimate = ((videoBitrate + audioEstimate) * (range[1] - range[0])) / 8;

  async function run() {
    job.begin();
    setError(null);
    setResult(null); // pas d'ancien résultat affiché à côté d'une erreur ou d'une annulation
    setProgress(0);
    try {
      const r = await reframeVideo(
        file, src,
        { start: range[0], end: range[1], aspect, mode, focusX: focus.x, focusY: focus.y, shortSide: Math.min(shortSide, Math.min(src.width, src.height)), format, videoBitrate, fps30 },
        setProgress, job.register
      );
      if (job.stopped.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      setResult({ url, blob: r.blob, ext: r.ext, size: r.blob.size, dims: `${r.width} × ${r.height}` });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Recadrage impossible : ${e.message}` : "Recadrage impossible.");
    } finally {
      setProgress(null);
      job.end();
    }
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const suffix = aspect.replace(":", "x");

  return (
    <div className="vx-reframe">
      <div className="vx-aspects">
        {ASPECTS.map((a) => (
          <button key={a.id} type="button" className={`vx-aspect${a.id === aspect ? " is-on" : ""}`} onClick={() => setAspect(a.id)} aria-pressed={a.id === aspect}>
            <AspectIcon aspect={a.id} />
            <b>{a.label}</b>
            <span>{a.use}</span>
          </button>
        ))}
      </div>

      <div className="vx-reframe-body">
        <div>
          <FramePreview video={video} src={src} aspect={aspect} mode={mode} focus={focus} onFocus={setFocus} />
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
        {progress !== null && <HudButton action="cancel" compact onClick={job.stop} />}
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
