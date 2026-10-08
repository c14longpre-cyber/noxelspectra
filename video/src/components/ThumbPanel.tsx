// NOXEL Spectra Vidéo — Miniature : meilleure image, titre, export
import { useCallback, useEffect, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { THUMB_SIZES, canvasToBlob, renderThumbnail, suggestFrames } from "../lib/frames";
import type { FrameCandidate, ThumbAspect, TitleStyle } from "../lib/frames";
import { fmtBytes, fmtTime } from "../lib/probe";

type Props = { file: File; url: string; range: [number, number]; video: HTMLVideoElement | null };
const COLORS = ["#ffffff", "#3ddc84", "#a855f7", "#ffd23f"];

export function ThumbPanel({ file, url, range, video }: Props) {
  const [aspect, setAspect] = useState<ThumbAspect>("16:9");
  const [title, setTitle] = useState<TitleStyle>({ text: "", position: "bottom", size: 9, color: "#ffffff", band: true });
  const [type, setType] = useState<"image/jpeg" | "image/webp" | "image/png">("image/jpeg");
  const [suggestions, setSuggestions] = useState<FrameCandidate[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ url: string; size: number; dims: string; ext: string } | null>(null);
  const preview = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const draw = useCallback(() => {
    const c = preview.current;
    if (!c || !video || !video.videoWidth) return;
    const full = renderThumbnail(video, aspect, title);
    const s = Math.min(1, 420 / full.width, 320 / full.height);
    c.width = Math.round(full.width * s);
    c.height = Math.round(full.height * s);
    c.getContext("2d")!.drawImage(full, 0, 0, c.width, c.height);
  }, [video, aspect, title]);

  useEffect(() => {
    draw();
    if (!video) return;
    video.addEventListener("seeked", draw);
    video.addEventListener("pause", draw);
    return () => {
      video.removeEventListener("seeked", draw);
      video.removeEventListener("pause", draw);
    };
  }, [draw, video]);

  async function suggest() {
    setScanning(true);
    try {
      setSuggestions(await suggestFrames(url, range[0], range[1]));
    } finally {
      setScanning(false);
    }
  }

  async function exportThumb() {
    if (!video) return;
    video.pause();
    const c = renderThumbnail(video, aspect, title);
    const blob = await canvasToBlob(c, type, 0.9);
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    setResult({ url: URL.createObjectURL(blob), size: blob.size, dims: `${c.width} × ${c.height}`, ext });
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  return (
    <div className="vx-thumb">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <HudButton action="suggest-frames" compact busy={scanning} onClick={suggest} />
        <span className="vx-muted">ou place la tête de lecture sur l'image voulue.</span>
      </div>
      {suggestions && (
        <div className="vx-suggestions">
          {suggestions.map((s) => (
            <button key={s.time} type="button" className="vx-suggestion" onClick={() => { if (video) { video.pause(); video.currentTime = s.time; } }}
              aria-label={`Utiliser l'image à ${fmtTime(s.time)}`}>
              <img src={s.thumb} alt="" />
              <span>{fmtTime(s.time)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="vx-reframe-body">
        <div>
          <canvas ref={preview} className="vx-reframe-preview" aria-label="Aperçu de la miniature" />
          <p className="vx-hint">Aperçu : image à la position actuelle de la timeline.</p>
        </div>
        <div className="vx-fields" style={{ alignContent: "start" }}>
          <label>Format
            <select value={aspect} onChange={(e) => setAspect(e.target.value as ThumbAspect)}>
              {Object.entries(THUMB_SIZES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              <option value="original">Original ({video?.videoWidth || "?"} × {video?.videoHeight || "?"})</option>
            </select>
          </label>
          <label>Titre (facultatif)
            <input type="text" value={title.text} maxLength={80} placeholder="Ex. : 5 erreurs SEO à éviter"
              onChange={(e) => setTitle({ ...title, text: e.target.value })} />
          </label>
          {title.text.trim() && (
            <>
              <label>Position
                <select value={title.position} onChange={(e) => setTitle({ ...title, position: e.target.value as TitleStyle["position"] })}>
                  <option value="top">En haut</option>
                  <option value="center">Au centre</option>
                  <option value="bottom">En bas</option>
                </select>
              </label>
              <label>Taille : {title.size} %
                <input type="range" min={4} max={16} value={title.size} onChange={(e) => setTitle({ ...title, size: Number(e.target.value) })} />
              </label>
              <label>Couleur
                <span className="vx-chips">
                  {COLORS.map((c) => (
                    <button key={c} type="button" className={`vx-swatch${title.color === c ? " is-on" : ""}`} style={{ background: c }}
                      onClick={() => setTitle({ ...title, color: c })} aria-label={`Couleur ${c}`} />
                  ))}
                  <input type="color" value={title.color} onChange={(e) => setTitle({ ...title, color: e.target.value })} aria-label="Autre couleur" />
                </span>
              </label>
              <label className="vx-check"><input type="checkbox" checked={title.band} onChange={(e) => setTitle({ ...title, band: e.target.checked })} /> Bande de fond NOXEL (meilleure lisibilité)</label>
            </>
          )}
          <label>Fichier
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="image/jpeg">JPEG — accepté partout (YouTube, réseaux)</option>
              <option value="image/webp">WebP — plus léger, pour le web</option>
              <option value="image/png">PNG — sans perte</option>
            </select>
          </label>
        </div>
      </div>

      <HudButton action="capture-frame" disabled={!video} onClick={exportThumb} />
      {result && (
        <div className="vx-result">
          <span>✓ {result.dims} · {fmtBytes(result.size)} · {result.ext.toUpperCase()}</span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-miniature.${result.ext}`} />
        </div>
      )}
    </div>
  );
}
