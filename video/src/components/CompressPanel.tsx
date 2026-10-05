// NOXEL Spectra Vidéo — panneau Compresser / Moins de 25 Mo
import { useEffect, useMemo, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { RESOLUTIONS, bitrateForQuality, compressVideo, estimateBytes, formatSupport, outputSize, planForTarget } from "../lib/compress";
import type { CompressFormat, CompressOptions, SourceInfo } from "../lib/compress";
import { fmtBitrate, fmtBytes, fmtTime } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  initialTargetMb: number | null; // 25 pour « Moins de 25 Mo »
  onContinue: (blob: Blob, ext: string) => void;
};

const MB = 1000 * 1000; // Mo des plateformes (Discord, courriel…) : 1 Mo = 1 000 000 octets

export function CompressPanel({ file, info, range, initialTargetMb, onContinue }: Props) {
  const src: SourceInfo = useMemo(
    () => ({
      width: info.video?.width || 0,
      height: info.video?.height || 0,
      fps: info.video?.fps || 30,
      duration: info.duration,
      videoBitrate: info.video?.bitrate || 1,
      hasAudio: !!info.audio,
    }),
    [info]
  );
  const [mode, setMode] = useState<"quality" | "target">(initialTargetMb ? "target" : "quality");
  const [level, setLevel] = useState<"high" | "balanced" | "light">("balanced");
  const [targetMb, setTargetMb] = useState(initialTargetMb || 25);
  const [shortSide, setShortSide] = useState<number | null>(null);
  const [fps30, setFps30] = useState(src.fps > 31);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [format, setFormat] = useState<CompressFormat>("mp4");
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; size: number } | null>(null);
  const cancel = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    formatSupport().then((s) => {
      setSupport(s);
      if (!s.mp4 && s.webm) setFormat("webm");
    });
  }, []);
  useEffect(() => {
    if (initialTargetMb) {
      setMode("target");
      setTargetMb(initialTargetMb);
    }
  }, [initialTargetMb]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const duration = range[1] - range[0];
  const plan = mode === "target" ? planForTarget(src, targetMb * MB, duration, fps30, removeAudio) : null;
  const options: CompressOptions = {
    start: range[0],
    end: range[1],
    format,
    shortSide: plan ? plan.shortSide : shortSide,
    fps30,
    removeAudio,
    videoBitrate: plan ? plan.videoBitrate : bitrateForQuality(src, shortSide, fps30, level),
    audioBitrate: plan ? plan.audioBitrate : removeAudio || !src.hasAudio ? 0 : 128000,
  };
  const estimate = estimateBytes(options);
  const outDims = outputSize(src, options.shortSide);
  const sourceBytes = file.size * (duration / Math.max(info.duration, 0.001));

  async function run() {
    setError(null);
    setStatus(null);
    setProgress(0);
    try {
      let opts = options;
      let r = await compressVideo(file, src, opts, setProgress, (c) => (cancel.current = c));
      // Taille cible dépassée (encodage en une passe) : un seul réencodage, au débit corrigé
      if (mode === "target" && r.blob.size > targetMb * MB) {
        setStatus("Légèrement au-dessus de la cible : second passage plus serré…");
        const ratio = (targetMb * MB) / r.blob.size;
        opts = { ...opts, videoBitrate: Math.round(opts.videoBitrate * ratio * 0.93) };
        setProgress(0);
        r = await compressVideo(file, src, opts, setProgress, (c) => (cancel.current = c));
      }
      setResult({ url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.ext, size: r.blob.size });
      setStatus(null);
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Compression impossible : ${e.message}` : "Compression impossible.");
      setStatus(null);
    } finally {
      setProgress(null);
      cancel.current = null;
    }
  }

  const resOptions = RESOLUTIONS.filter((r) => r < Math.min(src.width, src.height));
  const base = file.name.replace(/\.[^.]+$/, "");
  const underTarget = result && mode === "target" ? result.size <= targetMb * MB : null;

  return (
    <div className="vx-compress">
      <div className="vx-modes" role="radiogroup" aria-label="Mode de compression">
        <label><input type="radio" name="cmode" checked={mode === "quality"} onChange={() => setMode("quality")} /><b>Qualité</b> — tu choisis le niveau, le poids suit</label>
        <label><input type="radio" name="cmode" checked={mode === "target"} onChange={() => setMode("target")} /><b>Taille cible</b> — tu choisis le poids, Spectra ajuste le reste</label>
      </div>

      <div className="vx-fields">
        {mode === "quality" ? (
          <>
            <label>Niveau
              <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
                <option value="high">Haute — quasi identique</option>
                <option value="balanced">Équilibrée — recommandé pour le web</option>
                <option value="light">Légère — le plus petit possible</option>
              </select>
            </label>
            <label>Résolution
              <select value={shortSide ?? 0} onChange={(e) => setShortSide(Number(e.target.value) || null)}>
                <option value={0}>Originale ({src.width} × {src.height})</option>
                {resOptions.map((r) => <option key={r} value={r}>{r}p</option>)}
              </select>
            </label>
          </>
        ) : (
          <label>Taille cible (Mo)
            <input type="number" min={1} max={4000} value={targetMb} onChange={(e) => setTargetMb(Math.max(1, Number(e.target.value) || 1))} />
            <span className="vx-chips">
              {[8, 10, 16, 25, 50, 100].map((m) => (
                <button key={m} type="button" className={`vx-chip${m === targetMb ? " is-on" : ""}`} onClick={() => setTargetMb(m)}>{m} Mo</button>
              ))}
            </span>
          </label>
        )}
        <label>Format
          <select value={format} onChange={(e) => setFormat(e.target.value as CompressFormat)}>
            <option value="mp4" disabled={support ? !support.mp4 : false}>MP4 (H.264) — compatible partout{support && !support.mp4 ? " — non disponible ici" : ""}</option>
            <option value="webm" disabled={support ? !support.webm : false}>WebM (VP9) — plus léger, pour le web</option>
          </select>
        </label>
        {src.fps > 31 && (
          <label className="vx-check"><input type="checkbox" checked={fps30} onChange={(e) => setFps30(e.target.checked)} /> Limiter à 30 images/s (source : {src.fps}) — gros gain de poids</label>
        )}
        {src.hasAudio && (
          <label className="vx-check"><input type="checkbox" checked={removeAudio} onChange={(e) => setRemoveAudio(e.target.checked)} /> Retirer le son</label>
        )}
      </div>

      <div className="vx-estimate">
        <span>Sortie : <b>{outDims.width} × {outDims.height}</b>{fps30 && src.fps > 31 ? " · 30 i/s" : ""} · vidéo {fmtBitrate(options.videoBitrate)}{options.audioBitrate ? ` · audio ${fmtBitrate(options.audioBitrate)}` : ""}</span>
        <span>Poids estimé : <b>{fmtBytes(estimate)}</b> (source : {fmtBytes(sourceBytes)}{range[1] - range[0] < info.duration - 0.05 ? `, extrait de ${fmtTime(duration)}` : ""})</span>
        {plan && !plan.feasible && <span className="vx-alert">Cible très basse pour cette durée : la qualité sera fortement dégradée. Coupe un extrait plus court ou augmente la taille.</span>}
        {plan && plan.feasible && plan.shortSide && <span className="vx-muted">Pour tenir dans {targetMb} Mo, la résolution est ajustée à {plan.shortSide}p.</span>}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="compress-video" label={mode === "target" ? `Compresser sous ${targetMb} Mo` : "Compresser"}
          busy={progress !== null} busyLabel={progress !== null ? `Compression… ${Math.round(progress * 100)} %` : undefined}
          disabled={!support || (!support.mp4 && !support.webm)} onClick={run} />
        {progress !== null && <button type="button" className="vx-btn" onClick={() => cancel.current?.()}>Annuler</button>}
      </div>
      {status && <p className="vx-muted">{status}</p>}
      {error && <p className="vx-alert">{error}</p>}

      {result && (
        <div className="vx-result">
          <span>
            ✓ {fmtBytes(result.size)} · −{Math.max(0, Math.round((1 - result.size / sourceBytes) * 100))} %
            {underTarget !== null && (underTarget ? ` · sous les ${targetMb} Mo` : ` · au-dessus des ${targetMb} Mo`)}
          </span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-compresse.${result.ext}`} />
          <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext)} />
        </div>
      )}
    </div>
  );
}
