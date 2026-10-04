// NOXEL Spectra Vidéo — version de test (video.noxelspectra.com)
// Tout le traitement se fait dans le navigateur (WebCodecs) : aucune vidéo n'est téléversée.
import { useEffect, useRef, useState } from "react";
import { HudButton } from "@hud/HudButton";
import { Timeline } from "./components/Timeline";
import { analyzeVideo, encoderSupport, fmtBitrate, fmtBytes, fmtTime } from "./lib/probe";
import type { VideoInfo } from "./lib/probe";

type Tool = { id: string; label: string; icon: string; ready: boolean; plan: string };

const TOOLS: Tool[] = [
  { id: "analyze", label: "Analyser", icon: "⌁", ready: true, plan: "" },
  { id: "under25", label: "Moins de 25 Mo", icon: "◎", ready: false, plan: "Compression automatique vers une taille cible, avec aperçu du compromis de qualité." },
  { id: "web", label: "Prêt pour mon site", icon: "▣", ready: false, plan: "Vidéo légère, miniature, dimensions et code d'intégration." },
  { id: "social", label: "Décliner pour les réseaux", icon: "⚑", ready: false, plan: "Versions verticale, carrée et horizontale depuis le même clip, avec cadrage ajustable." },
  { id: "convert", label: "Convertir", icon: "↔", ready: false, plan: "MP4, WebM, MOV ; format conseillé selon la destination." },
  { id: "compress", label: "Compresser", icon: "⇲", ready: false, plan: "Qualité manuelle ou taille cible en Mo, avec estimation du poids final." },
  { id: "cut", label: "Couper & assembler", icon: "✂", ready: false, plan: "Garder un extrait, retirer un passage, réunir et réordonner plusieurs clips." },
  { id: "crop", label: "Recadrer & redimensionner", icon: "⊡", ready: false, plan: "9:16, 1:1, 4:5, 16:9 ; déplacer le cadrage ; bandes ou fond flouté." },
  { id: "rotate", label: "Pivoter & retourner", icon: "↻", ready: false, plan: "90°, angle libre, miroir horizontal ou vertical." },
  { id: "speed", label: "Vitesse", icon: "»", ready: false, plan: "Ralenti, accélération, lecture inversée." },
  { id: "audio", label: "Audio", icon: "♪", ready: false, plan: "Couper le son, volume, remplacer la piste, musique, fondus." },
  { id: "text", label: "Texte & logo", icon: "T", ready: false, plan: "Titres, filigrane, position, opacité, apparition/disparition." },
  { id: "thumb", label: "Miniature", icon: "▢", ready: false, plan: "Choisir une image de la vidéo, ajouter du texte, exporter une couverture." },
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

  useEffect(() => {
    encoderSupport().then(setSupport);
  }, []);

  function openFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name)) {
      setError("Ce fichier ne semble pas être une vidéo.");
      return;
    }
    setError(null);
    setInfo(null);
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

  const current = TOOLS.find((t) => t.id === tool)!;

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
          {current.ready ? (
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
