// NOXEL Spectra Vidéo — Filigrane : texte ou logo incrusté pendant toute la sélection
// Même section que dans Spectra image. Le dessin est celui du filigrane de Copyright (layoutMark) :
// ce qu'on voit sur l'aperçu est ce qui est incrusté.
import { useEffect, useMemo, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { loadLogo } from "../lib/overlay";
import type { OverlayItem } from "../lib/overlay";
import { PLACES, containerFor, layoutMark } from "../lib/rights";
import { FontPicker } from "./FontPicker";
import { FillEditor } from "./FillEditor";
import type { Mark } from "../lib/rights";
import { burnOverlays } from "../lib/textlogo";
import type { BurnResult } from "../lib/textlogo";
import { formatSupport } from "../lib/compress";
import type { CompressFormat } from "../lib/compress";
import { fmtBitrate, fmtBytes, fmtTime } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";
import { useCancel } from "../lib/useCancel";
import "../textlogo.css";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  duration: number;
  onPreview: (items: OverlayItem[]) => void; // filigrane à montrer sur l'aperçu
  onContinue: (blob: Blob, ext: string, suffix: string) => void;
};

const pc = (v: number) => Math.round(v * 100);

// Réglages gardés tant que la page est ouverte, même pour une autre vidéo (sauf le logo choisi, qui reste aussi)
type Session = { mark: Mark; sizes: { text: number; logo: number } };
let session: Session = {
  mark: { kind: "text", text: "NOXEL", logo: null, place: "br", size: 0.045, opacity: 0.6, rotation: 0, color: "#ffffff" },
  sizes: { text: 0.045, logo: 0.16 },
};

export function WatermarkPanel({ file, info, range, duration, onPreview, onContinue }: Props) {
  const [mark, setMark] = useState<Mark>(session.mark);
  // Dernière taille choisie pour chaque type de filigrane, retrouvée en y revenant
  const [sizes, setSizes] = useState(session.sizes);
  const setSize = (size: number) => { setMark((m) => ({ ...m, size })); if (mark.kind !== "none") setSizes((s) => ({ ...s, [mark.kind]: size })); };
  useEffect(() => { session = { mark, sizes }; }, [mark, sizes]);
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(BurnResult & { url: string; source: number }) | null>(null);
  const job = useCancel();
  const urls = useRef<string[]>([]);
  const logoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { formatSupport().then(setSupport); }, []);
  // Les fichiers produits ne sont libérés qu'en quittant l'outil
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Incrémenté quand une police de la bibliothèque finit de charger : le filigrane est remesuré
  // (sa place exacte dépend de la largeur du texte dans sa vraie police)
  const [fontTick, setFontTick] = useState(0);
  const frameW = info.video?.width || 0, frameH = info.video?.height || 0;
  const layout = useMemo(
    () => layoutMark(mark, 0, Math.max(duration, range[1]), frameW, frameH),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mark.kind, mark.text, mark.logo, mark.place, mark.size, mark.opacity, mark.rotation, mark.color, mark.font, mark.fill, mark.shadow, fontTick, duration, range[1], frameW, frameH]
  );
  const overlays = layout.items;
  useEffect(() => { onPreview(overlays); }, [overlays, onPreview]);
  useEffect(() => () => onPreview([]), [onPreview]);

  // Un résultat décrit les réglages du moment où il a été produit
  useEffect(() => { setResult(null); }, [overlays, range[0], range[1]]);

  async function pickLogo(f: File | null) {
    if (!f) return;
    setError(null);
    try {
      const { image, ratio } = await loadLogo(f);
      setMark((m) => ({ ...m, kind: "logo", logo: { image, ratio, fileName: f.name } }));
    } catch {
      setError("Cette image n'a pas pu être lue par le navigateur (essaie un PNG, JPG, WebP ou SVG).");
    }
  }

  const container = containerFor(info.video?.codec);
  const codecName = container === "webm" ? "VP9" : "H.264";
  const formatName = container === "webm" ? "WebM" : "MP4";
  const emptySelection = range[1] - range[0] < 0.05;
  const canEncode = !support || (container === "webm" ? support.webm : support.mp4);
  const bitrate = Math.round((info.video?.bitrate || 2e6) * 0.95);
  const sourceBytes = file.size * ((range[1] - range[0]) / Math.max(info.duration, 0.001));
  const empty = overlays.length === 0;

  async function run() {
    job.begin();
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const r = await burnOverlays(file, overlays, range[0], range[1], bitrate, setProgress, job.register);
      if (job.stopped.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      setResult({ ...r, url, source: sourceBytes });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Filigrane impossible : ${e.message}` : "Filigrane impossible.");
    } finally {
      setProgress(null);
      job.end();
    }
  }

  const base = file.name.replace(/\.[^.]+$/, "");

  return (
    <div className="vx-rights">
      <p className="vx-muted">
        Applique un filigrane texte ou logo sur toute la sélection de la timeline. Il est dans l'image : il reste visible même si la vidéo est réencodée,
        mais un recadrage peut le couper s'il est dans un coin (« Répété sur toute l'image » protège mieux).
      </p>

      <div className="vx-modes" role="radiogroup" aria-label="Type de filigrane">
        <label><input type="radio" name="wkind" checked={mark.kind === "text"} onChange={() => setMark((m) => ({ ...m, kind: "text", size: sizes.text }))} /><b>Texte</b></label>
        <label><input type="radio" name="wkind" checked={mark.kind === "logo"} onChange={() => setMark((m) => ({ ...m, kind: "logo", size: sizes.logo }))} /><b>Logo</b> — une image, de préférence à fond transparent</label>
      </div>
      <input ref={logoInput} type="file" accept="image/*,.svg" style={{ display: "none" }} onChange={(e) => { pickLogo(e.target.files?.[0] || null); e.target.value = ""; }} />
      <div className="vx-fields">
        {mark.kind === "text" ? (
          <>
            <label>Texte
              <input type="text" value={mark.text} maxLength={200} placeholder="© 2026 Ton nom" onChange={(e) => setMark((m) => ({ ...m, text: e.target.value }))} />
            </label>
            <div className="vx-font-field"><span>Police</span>
              <FontPicker value={mark.font || "sans"} onChange={(font) => setMark((m) => ({ ...m, font }))} onReady={() => setFontTick((n) => n + 1)} />
            </div>
            <label className="vx-check"><input type="checkbox" checked={mark.shadow ?? true} onChange={(e) => setMark((m) => ({ ...m, shadow: e.target.checked }))} /> Ombre portée</label>
            <div className="vx-fill-field"><span>Couleur</span>
              <FillEditor value={mark.fill ?? { kind: "solid", color: mark.color || "#ffffff" }}
                onChange={(fill) => setMark((m) => ({ ...m, fill, ...(fill.kind === "solid" ? { color: fill.color } : {}) }))} />
            </div>
          </>
        ) : (
          <div className="vx-row">
            <HudButton action="add-logo" compact label={mark.logo ? "Changer de logo" : "Choisir un logo"} onClick={() => logoInput.current?.click()} />
            {mark.logo && <span className="vx-file">{mark.logo.fileName}</span>}
          </div>
        )}
        <label>Position
          <select value={mark.place} onChange={(e) => setMark((m) => ({ ...m, place: e.target.value as Mark["place"], rotation: e.target.value === "tile" ? (m.rotation === 0 ? -25 : m.rotation) : m.place === "tile" && m.rotation === -25 ? 0 : m.rotation }))}>
            {PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label>{mark.kind === "text" ? `Taille : ${(mark.size * 100).toFixed(1)} % de la hauteur` : `Largeur : ${pc(mark.size)} % de l'image`}
          <input type="range" min={mark.kind === "text" ? 2 : 4} max={mark.kind === "text" ? 20 : 60} step={mark.kind === "text" ? 0.5 : 1} value={mark.size * 100} onChange={(e) => setSize(Number(e.target.value) / 100)} />
        </label>
        <label>Opacité : {pc(mark.opacity)} %
          <input type="range" min={5} max={100} step={5} value={pc(mark.opacity)} onChange={(e) => setMark((m) => ({ ...m, opacity: Number(e.target.value) / 100 }))} />
        </label>
        <label>Rotation : {mark.rotation}°
          <input type="range" min={-90} max={90} step={5} value={mark.rotation} onChange={(e) => setMark((m) => ({ ...m, rotation: Number(e.target.value) }))} />
        </label>
      </div>
      {empty && <p className="vx-alert">{mark.kind === "text" ? "Le filigrane est vide : écris un texte." : "Aucun logo choisi."}</p>}
      {layout.overflow && <p className="vx-alert">Le filigrane est plus grand que l'image : il sera coupé. Réduis sa taille ou raccourcis le texte.</p>}

      <p className="vx-muted">
        Le filigrane est visible sur l'aperçu. L'incruster impose de réencoder l'image ({codecName}, en visant {fmtBitrate(bitrate)}, un peu sous le débit de la source) :
        l'image perd légèrement en qualité. Le son est recopié tel quel quand le format le permet.
        {" "}Seule la sélection de la timeline ({fmtTime(range[1] - range[0])}) est traitée ; le fichier produit est un {formatName}.
        {" "}Pour un texte animé ou à un moment précis, utilise l'outil Texte & logo.
      </p>
      {emptySelection && <p className="vx-alert">La sélection de la timeline est vide : cette vidéo n'a pas pu être lue correctement.</p>}
      {!canEncode && <p className="vx-alert">Ce navigateur ne sait pas encoder en {codecName} : le filigrane n'est pas possible ici pour cette vidéo.</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="apply-watermark" disabled={empty || !canEncode || emptySelection} busy={progress !== null}
          busyLabel={progress !== null ? `Incrustation… ${Math.round(progress * 100)} %` : undefined} onClick={run} />
        {progress !== null && <HudButton action="cancel" compact onClick={job.stop} />}
      </div>
      {error && <p className="vx-alert">{error}</p>}

      {result && (
        <div className="vx-result">
          <span>✓ {result.width} × {result.height} · {fmtTime(result.duration)} · {fmtBytes(result.blob.size)} · {result.ext === "webm" ? "WebM" : "MP4"}</span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-filigrane.${result.ext}`} />
          <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext, "filigrane")} />
          {result.blob.size > result.source * 1.02 && (
            <p className="vx-alert" style={{ flexBasis: "100%", margin: 0 }}>
              Ce fichier pèse plus que l'extrait d'origine ({fmtBytes(result.source)}) : l'encodeur de ce navigateur ne descend pas au débit de cette vidéo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
