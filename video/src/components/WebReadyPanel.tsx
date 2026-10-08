// NOXEL Spectra Vidéo — Prêt pour mon site : vidéo légère, image d'aperçu, code d'intégration, JSON-LD
import { useEffect, useMemo, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { RESOLUTIONS, bitrateForQuality, compressVideo, formatSupport, outputSize } from "../lib/compress";
import type { CompressFormat, SourceInfo } from "../lib/compress";
import { canvasToBlob, drawCover, isoDuration } from "../lib/frames";
import { fmtBytes } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";

type Props = { file: File; info: VideoInfo; range: [number, number]; video: HTMLVideoElement | null };
type Out = { name: string; url: string; size: number; label: string };

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";

export function WebReadyPanel({ file, info, range, video }: Props) {
  const src: SourceInfo = useMemo(() => ({
    width: info.video?.width || 0, height: info.video?.height || 0, fps: info.video?.fps || 30,
    duration: info.duration, videoBitrate: info.video?.bitrate || 1, hasAudio: !!info.audio,
  }), [info]);
  const own = Math.min(src.width, src.height);
  const [usage, setUsage] = useState<"player" | "background">("player");
  const [shortSide, setShortSide] = useState<number | null>(own > 1080 ? 1080 : null);
  const [withWebm, setWithWebm] = useState(true);
  const [name, setName] = useState(slug(file.name.replace(/\.[^.]+$/, "")));
  const [titleText, setTitleText] = useState("");
  const [description, setDescription] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://ton-site.com/videos/");
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [step, setStep] = useState<{ label: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outs, setOuts] = useState<Out[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const outsRef = useRef<Out[]>([]);
  outsRef.current = outs;

  useEffect(() => { formatSupport().then(setSupport); }, []);
  useEffect(() => () => outsRef.current.forEach((o) => URL.revokeObjectURL(o.url)), []);

  const dims = outputSize(src, shortSide);
  const duration = range[1] - range[0];
  const background = usage === "background";
  const mp4Ok = !!support?.mp4, webmOk = !!support?.webm;
  const makeWebm = webmOk && (withWebm || !mp4Ok);

  async function run() {
    if (!video) return;
    setError(null);
    setOuts((prev) => { prev.forEach((o) => URL.revokeObjectURL(o.url)); return []; });
    const list: Out[] = [];
    const formats: CompressFormat[] = [...(makeWebm ? (["webm"] as const) : []), ...(mp4Ok ? (["mp4"] as const) : [])];
    try {
      for (let i = 0; i < formats.length; i++) {
        const f = formats[i];
        setStep({ label: `Étape ${i + 1}/${formats.length + 1} — vidéo ${f.toUpperCase()}`, progress: 0 });
        const r = await compressVideo(file, src, {
          start: range[0], end: range[1], format: f, shortSide, fps30: true, removeAudio: background,
          videoBitrate: bitrateForQuality(src, shortSide, true, background ? "light" : "balanced"),
          audioBitrate: background ? 0 : 128000,
        }, (p) => setStep((s) => (s ? { ...s, progress: p } : s)));
        list.push({ name: `${name}.${f}`, url: URL.createObjectURL(r.blob), size: r.blob.size, label: f === "webm" ? "Vidéo WebM (VP9)" : "Vidéo MP4 (H.264)" });
        setOuts([...list]);
      }
      // Image d'aperçu : image actuelle de la timeline, aux dimensions de la vidéo
      setStep({ label: `Étape ${formats.length + 1}/${formats.length + 1} — image d'aperçu`, progress: 1 });
      video.pause();
      const c = document.createElement("canvas");
      c.width = dims.width;
      c.height = dims.height;
      drawCover(c.getContext("2d")!, video, video.videoWidth, video.videoHeight, c.width, c.height);
      const poster = await canvasToBlob(c, "image/jpeg", 0.85);
      list.push({ name: `${name}-poster.jpg`, url: URL.createObjectURL(poster), size: poster.size, label: "Image d'aperçu (poster)" });
      setOuts([...list]);
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Préparation impossible : ${e.message}` : "Préparation impossible.");
    } finally {
      setStep(null);
    }
  }

  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const sources = [makeWebm && `  <source src="${base}${name}.webm" type="video/webm">`, mp4Ok && `  <source src="${base}${name}.mp4" type="video/mp4">`].filter(Boolean).join("\n");
  const attrs = background
    ? `autoplay muted loop playsinline preload="auto"`
    : `controls preload="metadata" playsinline`;
  const html = `<video ${attrs} width="${dims.width}" height="${dims.height}"\n  poster="${base}${name}-poster.jpg"${titleText ? ` title="${titleText.replace(/"/g, "&quot;")}"` : ""}\n  style="max-width: 100%; height: auto;">\n${sources}\n</video>`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: titleText || name,
    description: description || titleText || name,
    thumbnailUrl: `${base}${name}-poster.jpg`,
    uploadDate: new Date().toISOString().slice(0, 10),
    duration: isoDuration(duration),
    contentUrl: `${base}${name}.${mp4Ok ? "mp4" : "webm"}`,
    width: dims.width,
    height: dims.height,
  }, null, 2);

  function copy(text: string, id: string) {
    navigator.clipboard?.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500); }).catch(() => undefined);
  }
  function downloadAll() {
    outs.forEach((o, i) => setTimeout(() => { const a = document.createElement("a"); a.href = o.url; a.download = o.name; a.click(); }, i * 500));
  }

  return (
    <div className="vx-web">
      <div className="vx-modes" role="radiogroup" aria-label="Usage">
        <label><input type="radio" name="usage" checked={usage === "player"} onChange={() => setUsage("player")} /><b>Lecteur vidéo</b> — avec contrôles et son, chargé seulement au clic</label>
        <label><input type="radio" name="usage" checked={usage === "background"} onChange={() => setUsage("background")} /><b>Fond animé</b> — muet, en boucle, lecture automatique (bannière, section d'accueil)</label>
      </div>
      <div className="vx-fields">
        <label>Nom des fichiers
          <input type="text" value={name} onChange={(e) => setName(slug(e.target.value))} />
        </label>
        <label>Résolution
          <select value={shortSide ?? 0} onChange={(e) => setShortSide(Number(e.target.value) || null)}>
            <option value={0}>Originale ({src.width} × {src.height})</option>
            {RESOLUTIONS.filter((r) => r < own).map((r) => <option key={r} value={r}>{r}p</option>)}
          </select>
        </label>
        {mp4Ok && webmOk && (
          <label className="vx-check"><input type="checkbox" checked={withWebm} onChange={(e) => setWithWebm(e.target.checked)} /> Ajouter une version WebM (plus légère ; le navigateur choisit la meilleure)</label>
        )}
        <label>Adresse du dossier sur ton site
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
        <label>Titre de la vidéo (pour Google)
          <input type="text" value={titleText} maxLength={100} onChange={(e) => setTitleText(e.target.value)} placeholder="Ex. : Démo de NOXEL SEO" />
        </label>
        <label>Description (pour Google)
          <input type="text" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <p className="vx-muted">L'image d'aperçu sera l'image à la position actuelle de la timeline. Sortie : {dims.width} × {dims.height}, 30 i/s{background ? ", sans son" : ""}.</p>

      <HudButton action="web-ready" busy={step !== null} busyLabel={step ? `${step.label} — ${Math.round(step.progress * 100)} %` : undefined}
        disabled={!support || (!mp4Ok && !webmOk) || !video} onClick={run} />
      {error && <p className="vx-alert">{error}</p>}

      {outs.length > 0 && (
        <>
          <div className="vx-result" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {outs.map((o) => (
              <div key={o.name} className="vx-done-row">
                <span>✓ {o.label} · {o.name} · {fmtBytes(o.size)}</span>
                <HudLink action="download-result" compact label="Télécharger" href={o.url} download={o.name} />
              </div>
            ))}
            {!step && outs.length > 1 && <HudButton action="download-result" compact label={`Tout télécharger (${outs.length})`} onClick={downloadAll} />}
          </div>
          {!step && (
            <>
              <h4 className="vx-code-title">Code d'intégration <HudButton action="copy-code" compact label={copied === "html" ? "Copié !" : "Copier"} onClick={() => copy(html, "html")} /></h4>
              <pre className="vx-code">{html}</pre>
              <h4 className="vx-code-title">Données structurées pour Google (VideoObject) <HudButton action="copy-code" compact label={copied === "ld" ? "Copié !" : "Copier"} onClick={() => copy(`<script type="application/ld+json">\n${jsonLd}\n</script>`, "ld")} /></h4>
              <pre className="vx-code">{`<script type="application/ld+json">\n${jsonLd}\n</script>`}</pre>
              <p className="vx-hint">Dépose les fichiers dans le dossier indiqué ci-dessus, puis colle le code à l'endroit voulu de ta page. Le JSON-LD aide Google à afficher ta vidéo dans ses résultats ; il ne garantit pas l'affichage.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
