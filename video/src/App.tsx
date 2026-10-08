// NOXEL Spectra Vidéo — version de test (video.noxelspectra.com)
// Tout le traitement se fait dans le navigateur (WebCodecs) : aucune vidéo n'est téléversée.
import { useEffect, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { Timeline } from "./components/Timeline";
import { analyzeVideo, encoderSupport, fmtBitrate, fmtBytes, fmtTime } from "./lib/probe";
import type { VideoInfo } from "./lib/probe";
import { cutVideo } from "./lib/cut";
import { CompressPanel } from "./components/CompressPanel";
import { ReframePanel } from "./components/ReframePanel";
import { SocialPanel } from "./components/SocialPanel";
import { ThumbPanel } from "./components/ThumbPanel";
import { WebReadyPanel } from "./components/WebReadyPanel";
import { ConvertPanel, RotatePanel, SpeedPanel } from "./components/BasicPanels";
import { AudioPanel } from "./components/AudioPanel";

type Tool = { id: string; label: string; icon: string; ready: boolean; plan: string };

const TOOLS: Tool[] = [
  { id: "analyze", label: "Analyser", icon: "⌁", ready: true, plan: "" },
  { id: "under25", label: "Moins de 25 Mo", icon: "◎", ready: true, plan: "Compression automatique vers une taille cible, avec aperçu du compromis de qualité." },
  { id: "web", label: "Prêt pour mon site", icon: "▣", ready: true, plan: "Vidéo légère, miniature, dimensions et code d'intégration." },
  { id: "social", label: "Décliner pour les réseaux", icon: "⚑", ready: true, plan: "Versions verticale, carrée et horizontale depuis le même clip, avec cadrage ajustable." },
  { id: "convert", label: "Convertir", icon: "↔", ready: true, plan: "MP4, WebM, MOV ; format conseillé selon la destination." },
  { id: "compress", label: "Compresser", icon: "⇲", ready: true, plan: "Qualité manuelle ou taille cible en Mo, avec estimation du poids final." },
  { id: "cut", label: "Couper & assembler", icon: "✂", ready: true, plan: "Prochainement : retirer un passage, réunir et réordonner plusieurs clips." },
  { id: "crop", label: "Recadrer & redimensionner", icon: "⊡", ready: true, plan: "9:16, 1:1, 4:5, 16:9 ; déplacer le cadrage ; bandes ou fond flouté." },
  { id: "rotate", label: "Pivoter & retourner", icon: "↻", ready: true, plan: "90°, angle libre, miroir horizontal ou vertical." },
  { id: "speed", label: "Vitesse", icon: "»", ready: true, plan: "Ralenti, accélération, lecture inversée." },
  { id: "audio", label: "Audio", icon: "♪", ready: true, plan: "Couper le son, volume, remplacer la piste, musique, fondus." },
  { id: "text", label: "Texte & logo", icon: "T", ready: false, plan: "Titres, filigrane, position, opacité, apparition/disparition." },
  { id: "thumb", label: "Miniature", icon: "▢", ready: true, plan: "Choisir une image de la vidéo, ajouter du texte, exporter une couverture." },
  { id: "export", label: "Exporter", icon: "⇩", ready: false, plan: "Résolution, FPS, qualité, format et préréglages selon l'usage." },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [tool, setTool] = useState("analyze");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<Awaited<ReturnType<typeof encoderSupport>> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [cutProgress, setCutProgress] = useState<number | null>(null);
  const [cutResult, setCutResult] = useState<{ url: string; size: number; ext: string; duration: number; requested: number; blob: Blob } | null>(null);
  const cancelCut = useRef<(() => Promise<void>) | null>(null);
  const cutStopped = useRef(false); // annulation demandée, même avant que la découpe soit annulable
  const [cutMode, setCutMode] = useState<"precise" | "fast">("precise");

  useEffect(() => {
    encoderSupport().then(setSupport);
  }, []);

  function openFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name)) {
      setError("Ce fichier ne semble pas être une vidéo.");
      return;
    }
    stopCut(); // sinon l'extrait de l'ancienne vidéo apparaîtrait sous la nouvelle
    setError(null);
    setInfo(null);
    setCutResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setFile(f);
    setUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  async function runAnalyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setInfo(await analyzeVideo(file));
    } catch (e) {
      setError(e instanceof Error ? `Analyse impossible : ${e.message}` : "Analyse impossible.");
    } finally {
      setBusy(false);
    }
  }

  function stopCut() {
    if (cutStopped.current) return;
    cutStopped.current = true;
    cancelCut.current?.().catch(() => {});
  }
  // Comme les autres outils : quitter Couper annule la découpe en cours
  useEffect(() => { if (tool !== "cut") stopCut(); }, [tool]);

  async function runCut() {
    if (!file) return;
    cutStopped.current = false;
    setError(null);
    // Pas d'ancien extrait affiché pendant ou après une nouvelle découpe (échouée ou annulée)
    setCutResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setCutProgress(0);
    try {
      const r = await cutVideo(file, range[0], range[1], cutMode, (p) => setCutProgress(p), (c) => {
        cancelCut.current = c;
        if (cutStopped.current) c().catch(() => {});
      });
      setCutResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(r.blob), size: r.blob.size, ext: r.ext, duration: r.duration, requested: range[1] - range[0], blob: r.blob };
      });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Découpe impossible : ${e.message}` : "Découpe impossible.");
    } finally {
      setCutProgress(null);
      cancelCut.current = null;
    }
  }

  // « Continuer avec ce résultat » : le résultat devient la vidéo de travail
  function continueWithCut() {
    if (!cutResult || !file) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    openFile(new File([cutResult.blob], `${base}-extrait.${cutResult.ext}`, { type: cutResult.blob.type }));
  }

  // Compresser a besoin de l'analyse (résolution, débit, images/s) : lancée automatiquement
  useEffect(() => {
    if ((tool === "compress" || tool === "under25" || tool === "crop" || tool === "social" || tool === "web" || tool === "convert" || tool === "rotate" || tool === "speed" || tool === "audio") && file && !info && !busy) runAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, file, info]);

  function continueWith(blob: Blob, ext: string, suffix: string) {
    if (!file) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    openFile(new File([blob], `${base}-${suffix}.${ext}`, { type: blob.type }));
  }

  const current = TOOLS.find((t) => t.id === tool)!;
  const baseName = file ? file.name.replace(/\.[^.]+$/, "") : "video";

  return (
    <div className="vx-shell">
      <aside className="vx-sidebar">
        <div className="vx-brand">
          <span className="vx-brand-mark">NOXEL</span> Spectra <b>Vidéo</b>
          <span className="vx-badge">TEST</span>
        </div>
        <nav>
          {TOOLS.map((t) => (
            <button key={t.id} type="button" className={`vx-nav${t.id === tool ? " is-active" : ""}`} onClick={() => setTool(t.id)}>
              <span aria-hidden="true" className="vx-nav-icon">{t.icon}</span>
              <span>{t.label}</span>
              {!t.ready && <span className="vx-soon">bientôt</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="vx-main">
        {support && !support.webcodecs && (
          <p className="vx-alert">Ton navigateur ne prend pas en charge WebCodecs : utilise une version récente de Chrome, Edge, Safari ou Firefox.</p>
        )}

        <section
          className={`vx-panel vx-drop${dragOver ? " is-over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); openFile(e.dataTransfer.files?.[0] || null); }}
        >
          <input ref={inputRef} type="file" accept="video/*,.mkv" style={{ display: "none" }} onChange={(e) => { openFile(e.target.files?.[0] || null); e.target.value = ""; }} />
          <HudButton action="choose-file" compact label="Choisir une vidéo" onClick={() => inputRef.current?.click()} />
          <span className="vx-muted">ou glisse-dépose une vidéo ici — elle reste sur ton appareil, rien n'est téléversé</span>
          {file && <span className="vx-file">{file.name} · {fmtBytes(file.size)}</span>}
        </section>

        {url && (
          <section className="vx-panel">
            <h3 className="vx-head"><b>01</b> / Aperçu</h3>
            <div className="vx-player">
              <video
                ref={(el) => { videoRef.current = el; setVideoEl(el); }}
                src={url}
                playsInline
                preload="auto"
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  setDuration(d);
                  setRange([0, d]);
                }}
              />
            </div>
            {duration > 0 && (
              <Timeline video={videoEl} duration={duration} inPoint={range[0]} outPoint={range[1]} onChange={(a, b) => setRange([a, b])} />
            )}
          </section>
        )}

        <section className="vx-panel">
          <h3 className="vx-head"><b>02</b> / {current.label}</h3>
          {tool === "audio" ? (
            file && info ? (
              <AudioPanel file={file} info={info} range={range} video={videoEl} onContinue={continueWith} />
            ) : (
              <p className="vx-muted">{file ? "Analyse de la vidéo…" : "Choisis d'abord une vidéo."}</p>
            )
          ) : (tool === "convert" || tool === "rotate" || tool === "speed") ? (
            file && info ? (
              tool === "convert" ? <ConvertPanel file={file} info={info} range={range} onContinue={continueWith} />
              : tool === "rotate" ? <RotatePanel file={file} info={info} range={range} onContinue={continueWith} />
              : <SpeedPanel file={file} info={info} range={range} onContinue={continueWith} />
            ) : (
              <p className="vx-muted">{file ? "Analyse de la vidéo…" : "Choisis d'abord une vidéo."}</p>
            )
          ) : tool === "thumb" ? (
            file && url ? <ThumbPanel file={file} url={url} range={range} video={videoEl} /> : <p className="vx-muted">Choisis d'abord une vidéo.</p>
          ) : tool === "web" ? (
            file && info ? (
              <WebReadyPanel file={file} info={info} range={range} video={videoEl} />
            ) : (
              <p className="vx-muted">{file ? "Analyse de la vidéo…" : "Choisis d'abord une vidéo."}</p>
            )
          ) : tool === "social" ? (
            file && info ? (
              <SocialPanel file={file} info={info} range={range} video={videoEl} />
            ) : (
              <p className="vx-muted">{file ? "Analyse de la vidéo…" : "Choisis d'abord une vidéo."}</p>
            )
          ) : tool === "crop" ? (
            file && info ? (
              <ReframePanel file={file} info={info} range={range} video={videoEl} onContinue={continueWith} />
            ) : (
              <p className="vx-muted">{file ? "Analyse de la vidéo…" : "Choisis d'abord une vidéo."}</p>
            )
          ) : tool === "compress" || tool === "under25" ? (
            file && info ? (
              <CompressPanel file={file} info={info} range={range} initialTargetMb={tool === "under25" ? 25 : null}
                onContinue={(blob, ext) => continueWith(blob, ext, "compresse")} />
            ) : (
              <p className="vx-muted">{file ? "Analyse de la vidéo…" : "Choisis d'abord une vidéo."}</p>
            )
          ) : tool === "cut" ? (
            <>
              <p className="vx-muted">
                Choisis le passage à garder sur la timeline (glisse les poignées, ou I / O pendant la lecture).
                La découpe est précise à l'image près ; la vidéo n'est réencodée qu'aux points de coupe quand c'est possible.
              </p>
              <p className="vx-muted">Extrait : <b style={{ color: "#3ddc84" }}>{fmtTime(range[0])} → {fmtTime(range[1])}</b> ({fmtTime(range[1] - range[0])})</p>
              <div className="vx-modes" role="radiogroup" aria-label="Mode de coupe">
                <label><input type="radio" name="cutmode" checked={cutMode === "precise"} onChange={() => setCutMode("precise")} />
                  <b>Précise</b> — à l'image près</label>
                <label><input type="radio" name="cutmode" checked={cutMode === "fast"} onChange={() => setCutMode("fast")} />
                  <b>Rapide, sans perte</b> — démarre à l'image clé la plus proche, aucune image réencodée</label>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <HudButton action="cut-video" disabled={!file || duration <= 0} busy={cutProgress !== null}
                  busyLabel={cutProgress !== null ? `Découpe… ${Math.round(cutProgress * 100)} %` : undefined} onClick={runCut} />
                {cutProgress !== null && (
                  <HudButton action="cancel" compact onClick={stopCut} />
                )}
              </div>
              {cutResult && (
                <div className="vx-result">
                  <span>✓ Extrait de {fmtTime(cutResult.duration)} · {fmtBytes(cutResult.size)} · {cutResult.ext.toUpperCase()}</span>
                  <HudLink action="download-result" compact href={cutResult.url} download={`${baseName}-extrait.${cutResult.ext}`} />
                  <HudButton action="continue" compact onClick={continueWithCut} />
                  {cutResult.duration - cutResult.requested > 0.5 && (
                    <p className="vx-alert" style={{ flexBasis: "100%", margin: 0 }}>
                      Cette vidéo n'a pas d'image clé près du début choisi : l'extrait dure {fmtTime(cutResult.duration)} au lieu de {fmtTime(cutResult.requested)}.
                      Utilise le mode Précise pour couper exactement.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : current.ready ? (
            <>
              <p className="vx-muted">Format, codecs, durée, résolution, images/s, débit, audio et potentiel de compression — calculés localement.</p>
              <HudButton action="analyse" disabled={!file} busy={busy} onClick={runAnalyze} />
              {info && <AnalyzeReport info={info} />}
            </>
          ) : (
            <p className="vx-muted">🛠 En construction — {current.plan}</p>
          )}
          {error && <p className="vx-alert">{error}</p>}
        </section>

        {support && (
          <p className="vx-foot">
            Encodeurs disponibles dans ce navigateur : H.264 {support.h264 ? "✓" : "✗"} · VP9 {support.vp9 ? "✓" : "✗"} · AV1 {support.av1 ? "✓" : "✗"}
          </p>
        )}
      </main>
    </div>
  );
}

function AnalyzeReport({ info }: { info: VideoInfo }) {
  const v = info.video;
  const a = info.audio;
  const rows: [string, string][] = [
    ["Conteneur", `${info.container} (${info.mimeType})`],
    ["Durée", fmtTime(info.duration)],
    ["Poids", fmtBytes(info.size)],
    ["Débit total", fmtBitrate((info.size * 8) / Math.max(info.duration, 0.001))],
  ];
  if (v) {
    rows.push(["Vidéo", `${v.codec.toUpperCase()} · ${v.width} × ${v.height}${v.rotation ? ` (rotation ${v.rotation}°)` : ""}${v.hdr ? " · HDR" : ""}`]);
    rows.push(["Images/s", `${v.fps}`]);
    rows.push(["Débit vidéo", fmtBitrate(v.bitrate)]);
    if (!v.decodable) rows.push(["⚠ Décodage", "ce codec vidéo n'est pas lisible par ce navigateur"]);
  } else rows.push(["Vidéo", "aucune piste vidéo"]);
  rows.push(["Audio", a ? `${a.codec.toUpperCase()} · ${a.channels === 1 ? "mono" : a.channels === 2 ? "stéréo" : `${a.channels} canaux`} · ${a.sampleRate / 1000} kHz · ${fmtBitrate(a.bitrate)}` : "aucune piste audio"]);

  const gain = Math.max(0, 1 - info.estimatedSize / info.size);
  return (
    <div className="vx-report">
      <dl>
        {rows.map(([k, val]) => (
          <div key={k}><dt>{k}</dt><dd>{val}</dd></div>
        ))}
      </dl>
      <div className={`vx-potential is-${info.potential}`}>
        <b>Potentiel de compression : {info.potential}</b>
        <span>
          {info.potential === "faible"
            ? "Cette vidéo est déjà bien compressée pour sa résolution."
            : `Estimation pour le web : environ ${fmtBytes(info.estimatedSize)} (−${Math.round(gain * 100)} %) à qualité visuelle comparable.`}
        </span>
      </div>
    </div>
  );
}
