// NOXEL Spectra Vidéo — Décliner pour les réseaux : plusieurs formats en un clic,
// chacun avec son propre cadrage (aperçu en direct, cadre déplaçable).
import { useEffect, useRef, useState } from "react";
import { HudButton } from "@hud/HudButton";
import { ASPECTS, reframeVideo, targetDims } from "../lib/reframe";
import type { Aspect, ReframeMode } from "../lib/reframe";
import { formatSupport } from "../lib/compress";
import type { CompressFormat } from "../lib/compress";
import { fmtBytes, referenceBitrate } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";
import { AspectIcon, FramePreview } from "./FramePreview";

type Props = { file: File; info: VideoInfo; range: [number, number]; video: HTMLVideoElement | null };
type Variant = { aspect: Aspect; on: boolean; mode: ReframeMode; focus: { x: number; y: number } };
type Done = { aspect: Aspect; url: string; size: number; dims: string; name: string };

const DEFAULT_ON: Aspect[] = ["9:16", "1:1", "16:9"];

export function SocialPanel({ file, info, range, video }: Props) {
  const src = { width: info.video?.width || 0, height: info.video?.height || 0, fps: info.video?.fps || 30 };
  const [variants, setVariants] = useState<Variant[]>(() =>
    ASPECTS.map((a) => ({ aspect: a.id, on: DEFAULT_ON.includes(a.id), mode: "crop" as ReframeMode, focus: { x: 0.5, y: 0.5 } }))
  );
  const [shortSide, setShortSide] = useState(1080);
  const [fps30, setFps30] = useState(src.fps > 31);
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [format, setFormat] = useState<CompressFormat>("mp4");
  const [running, setRunning] = useState<{ index: number; total: number; aspect: Aspect; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done[]>([]);
  const cancel = useRef<(() => Promise<void>) | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    formatSupport().then((s) => {
      setSupport(s);
      if (!s.mp4 && s.webm) setFormat("webm");
    });
  }, []);
  // Libère les fichiers seulement en quittant l'outil (pas à chaque nouvelle version :
  // les versions déjà créées doivent rester téléchargeables)
  const doneRef = useRef<Done[]>([]);
  doneRef.current = done;
  useEffect(() => () => doneRef.current.forEach((d) => URL.revokeObjectURL(d.url)), []);

  const set = (aspect: Aspect, patch: Partial<Variant>) =>
    setVariants((list) => list.map((v) => (v.aspect === aspect ? { ...v, ...patch } : v)));
  const selected = variants.filter((v) => v.on);
  const side = Math.min(shortSide, Math.min(src.width, src.height) || shortSide);
  const fps = fps30 ? Math.min(30, src.fps) : src.fps;
  const dur = range[1] - range[0];
  const bitrateOf = (a: Aspect) => {
    const d = targetDims(a, side);
    return Math.round(referenceBitrate(d.width, d.height, fps) * 0.7);
  };
  const totalEstimate = selected.reduce((sum, v) => sum + ((bitrateOf(v.aspect) + 128000) * dur) / 8, 0);
  const base = file.name.replace(/\.[^.]+$/, "");

  async function runAll() {
    setError(null);
    setDone((prev) => { prev.forEach((d) => URL.revokeObjectURL(d.url)); return []; });
    stopped.current = false;
    const list = selected;
    for (let i = 0; i < list.length; i++) {
      if (stopped.current) break;
      const v = list[i];
      setRunning({ index: i + 1, total: list.length, aspect: v.aspect, progress: 0 });
      try {
        const r = await reframeVideo(
          file, src,
          { start: range[0], end: range[1], aspect: v.aspect, mode: v.mode, focusX: v.focus.x, focusY: v.focus.y, shortSide: side, format, videoBitrate: bitrateOf(v.aspect), fps30 },
          (p) => setRunning((cur) => (cur ? { ...cur, progress: p } : cur)),
          (c) => (cancel.current = c)
        );
        const name = `${base}-${v.aspect.replace(":", "x")}.${r.ext}`;
        setDone((prev) => [...prev, { aspect: v.aspect, url: URL.createObjectURL(r.blob), size: r.blob.size, dims: `${r.width} × ${r.height}`, name }]);
      } catch (e) {
        if (!(e instanceof Error && /cancel/i.test(e.message))) setError(`Version ${v.aspect} impossible : ${e instanceof Error ? e.message : "erreur"}`);
        break;
      }
    }
    setRunning(null);
    cancel.current = null;
  }

  // Télécharge toutes les versions (le navigateur peut demander d'autoriser plusieurs téléchargements)
  function downloadAll() {
    done.forEach((d, i) => setTimeout(() => {
      const a = document.createElement("a");
      a.href = d.url;
      a.download = d.name;
      a.click();
    }, i * 500));
  }

  return (
    <div className="vx-social">
      <p className="vx-muted">Coche les formats voulus et ajuste le cadrage de chacun : toutes les versions sont créées d'un seul clic, à partir de la sélection de la timeline.</p>
      <div className="vx-variants">
        {variants.map((v) => {
          const meta = ASPECTS.find((a) => a.id === v.aspect)!;
          const d = targetDims(v.aspect, side);
          return (
            <div key={v.aspect} className={`vx-variant${v.on ? " is-on" : ""}`}>
              <label className="vx-variant-head">
                <input type="checkbox" checked={v.on} onChange={(e) => set(v.aspect, { on: e.target.checked })} />
                <AspectIcon aspect={v.aspect} />
                <span><b>{v.aspect}</b> <small>{meta.use}</small></span>
              </label>
              {v.on && (
                <>
                  <FramePreview video={video} src={src} aspect={v.aspect} mode={v.mode} focus={v.focus} onFocus={(f) => set(v.aspect, { focus: f })} width={240} />
                  <select value={v.mode} onChange={(e) => set(v.aspect, { mode: e.target.value as ReframeMode })} aria-label={`Remplissage ${v.aspect}`}>
                    <option value="crop">Recadrer (glisse le cadre)</option>
                    <option value="blur">Fond flouté</option>
                    <option value="bars">Bandes noires</option>
                  </select>
                  <small className="vx-muted">{d.width} × {d.height}</small>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="vx-fields" style={{ marginTop: 14 }}>
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
      </div>
      <div className="vx-estimate">
        <span>{selected.length} version(s) · poids total estimé : <b>{fmtBytes(totalEstimate)}</b></span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="resize-social" label={`Créer ${selected.length} version(s)`} disabled={!selected.length || !support || (!support.mp4 && !support.webm)}
          busy={running !== null} busyLabel={running ? `Version ${running.index}/${running.total} (${running.aspect}) — ${Math.round(running.progress * 100)} %` : undefined}
          onClick={runAll} />
        {running && <button type="button" className="vx-btn" onClick={() => { stopped.current = true; cancel.current?.(); }}>Annuler</button>}
      </div>
      {error && <p className="vx-alert">{error}</p>}

      {done.length > 0 && (
        <div className="vx-result" style={{ flexDirection: "column", alignItems: "stretch" }}>
          {done.map((d) => (
            <div key={d.aspect} className="vx-done-row">
              <span>✓ {d.aspect} · {d.dims} · {fmtBytes(d.size)}</span>
              <a className="vx-btn" href={d.url} download={d.name}>Télécharger</a>
            </div>
          ))}
          {done.length > 1 && !running && (
            <HudButton action="download-result" compact label={`Tout télécharger (${done.length})`} onClick={downloadAll} />
          )}
        </div>
      )}
    </div>
  );
}
