// NOXEL Spectra Vidéo — panneau Compresser / Moins de 25 Mo
import { useEffect, useMemo, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { RESOLUTIONS, bitrateForQuality, compressVideo, estimateBytes, formatSupport, nextLowerResolution, outputSize, planForTarget } from "../lib/compress";
import type { CompressFormat, CompressOptions, SourceInfo } from "../lib/compress";
import { realAudioBitrate } from "../lib/audio";
import { fmtBitrate, fmtBytes, fmtTime } from "../lib/probe";
import { useCancel } from "../lib/useCancel";
import type { VideoInfo } from "../lib/probe";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  initialTargetMb: number | null; // 25 pour « Moins de 25 Mo »
  onContinue: (blob: Blob, ext: string) => void;
};

const MB = 1000 * 1000; // Mo des plateformes (Discord, courriel…) : 1 Mo = 1 000 000 octets
// Essai de l'encodeur avant une compression à taille cible : durée maximale de l'essai (une
// sélection plus courte est essayée en entier), et durée minimale de la sélection
const TRIAL_SECONDS = 10;
const TRIAL_FIT = 1.03; // l'essai « tient » si le débit obtenu ne dépasse pas l'autorisé de plus de 3 %
const TRIAL_MIN_DURATION = 0.2;

export function CompressPanel({ file, info, range, initialTargetMb, onContinue }: Props) {
  const src: SourceInfo = useMemo(
    () => ({
      width: info.video?.width || 0,
      height: info.video?.height || 0,
      fps: info.video?.fps || 30,
      duration: info.duration,
      videoBitrate: info.video?.bitrate || 1,
      hasAudio: !!info.audio,
      audioBitrate: info.audio?.bitrate || 0,
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
  const [trying, setTrying] = useState(false); // essai de l'encodeur en cours
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; size: number; dims: string; saved: number; target: number | null; note: string } | null>(null);
  const job = useCancel();
  const urls = useRef<string[]>([]);
  const [audioReal, setAudioReal] = useState<number | null>(null); // débit audio que l'encodeur utilisera vraiment

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
  // Les fichiers produits ne sont libérés qu'en quittant l'outil
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  // Une erreur parle des réglages d'un lancement : elle ne reste pas affichée quand ils changent
  useEffect(() => { setError(null); }, [mode, targetMb, format, removeAudio]);

  const duration = range[1] - range[0];
  const plan = mode === "target" ? planForTarget(src, targetMb * MB, duration, fps30, removeAudio) : null;
  // Certains encodeurs n'acceptent pas le débit audio prévu (AAC sous 96 kb/s) : on affiche et on
  // budgète le débit réel, pris sur la vidéo quand il faut tenir une taille cible
  const plannedAudio = plan ? plan.audioBitrate : removeAudio || !src.hasAudio ? 0 : 128000;
  useEffect(() => {
    let current = true;
    setAudioReal(null);
    if (plannedAudio) realAudioBitrate(file, format === "mp4" ? "aac" : "opus", plannedAudio, src.audioBitrate || 0).then((b) => { if (current) setAudioReal(b); }).catch(() => {});
    return () => { current = false; };
  }, [file, format, plannedAudio, src.audioBitrate]);
  const audioBitrate = plannedAudio ? audioReal ?? plannedAudio : 0;
  const options: CompressOptions = {
    start: range[0],
    end: range[1],
    format,
    shortSide: plan ? plan.shortSide : shortSide,
    fps30,
    removeAudio,
    videoBitrate: plan ? Math.max(100000, plan.videoBitrate - Math.max(0, audioBitrate - plan.audioBitrate)) : bitrateForQuality(src, shortSide, fps30, level),
    audioBitrate,
  };
  const estimate = estimateBytes(options);
  const outDims = outputSize(src, options.shortSide);
  // L'essai préalable ne sert que si la cible est serrée et la sélection assez longue
  const trialUseful = !!plan && duration >= TRIAL_MIN_DURATION && estimate > targetMb * MB * 0.7;
  const sourceBytes = file.size * (duration / Math.max(info.duration, 0.001));

  async function run() {
    job.begin();
    setError(null);
    setStatus(null);
    setResult(null); // pas d'ancien résultat affiché à côté d'une erreur ou d'une annulation
    setProgress(0);
    try {
      let opts = options;
      let note = "";
      const floored = (lower: typeof opts) => {
        note = `Résolution réduite à ${lower.shortSide}p : l'encodeur de ce navigateur ne descend pas au débit prévu pour une image plus grande.`;
        return lower;
      };
      // Taille cible serrée : essai de quelques secondes avant le vrai passage. Certains encodeurs ne
      // descendent pas jusqu'au débit demandé ; on mesure ce qu'ils produisent, on réduit la résolution
      // d'un cran à la fois tant que cela aide, et si la cible reste hors de portée on le dit tout de
      // suite, avant un long encodage.
      if (trialUseful) {
        setTrying(true);
        setStatus("Essai de l'encodeur sur quelques secondes…");
        // Débit vidéo qui tient dans la cible (3 % de marge pour le conteneur)
        const allowed = ((targetMb * MB * 8) / duration) * 0.97 - opts.audioBitrate;
        const len = Math.min(TRIAL_SECONDS, duration);
        const from = range[0] + (duration - len) / 2;
        const measure = async (o: CompressOptions) => {
          const t = await compressVideo(file, src, { ...o, start: from, end: from + len, removeAudio: true, audioBitrate: 0 }, () => {}, job.register);
          return (t.blob.size * 8) / len;
        };
        // À une résolution donnée : mesure au débit prévu ; si l'encodeur dépasse, on lui demande moins
        // (il dépasse souvent en proportion) et on re-mesure. S'il ne descend pas, c'est son plancher.
        const tune = async (at: CompressOptions) => {
          let o = at;
          let actual = await measure(o);
          for (let k = 0; k < 2 && actual > allowed * TRIAL_FIT; k++) {
            const less = { ...o, videoBitrate: Math.max(50000, Math.round(o.videoBitrate * (allowed / actual) * 0.97)) };
            if (less.videoBitrate >= o.videoBitrate) break; // déjà au minimum : la mesure serait la même
            const got = await measure(less);
            const helped = got < actual * 0.95;
            if (got < actual) { o = less; actual = got; }
            if (!helped) break;
          }
          return { o, actual };
        };
        let best = await tune(opts);
        let at = opts;
        while (best.actual > allowed * TRIAL_FIT) {
          const lower = nextLowerResolution(src, at);
          if (!lower) break;
          const got = await tune(lower);
          if (got.actual > best.actual * 0.92) break; // réduire l'image n'aide plus : inutile de la dégrader davantage
          best = got;
          at = lower;
        }
        setTrying(false);
        // L'essai surestime un peu le débit d'un passage complet : on ne renonce qu'au-delà de 20 %
        if (best.actual > allowed * 1.2) {
          const size = (((best.actual + opts.audioBitrate) * duration) / 8 / MB).toFixed(1);
          setError(`Cible de ${targetMb} Mo hors de portée${format === "mp4" ? " en MP4" : ""} pour cette sélection : à l'essai, l'encodeur de ce navigateur produit environ ${fmtBitrate(best.actual)} de vidéo, soit un fichier d'environ ${size} Mo. ${format === "mp4" ? "Le format WebM tient parfois une cible plus basse ; sinon, essaie un" : "Essaie un"} extrait plus court ou une cible plus grande.`);
          setStatus(null);
          return;
        }
        if (best.o.shortSide !== opts.shortSide) opts = floored(best.o);
        else opts = best.o; // même résolution, débit éventuellement ajusté
        setStatus(note ? `L'encodeur ne tient pas le débit prévu à une taille d'image plus grande : compression en ${opts.shortSide}p pour respecter les ${targetMb} Mo…` : null);
        setProgress(0);
      }
      let r = await compressVideo(file, src, opts, setProgress, job.register);
      // Taille cible dépassée (encodage en une passe) : un seul réencodage, à une résolution plus basse
      // si l'encodeur est à son plancher, sinon au débit corrigé
      if (mode === "target" && r.blob.size > targetMb * MB) {
        const actual = (r.blob.size * 8) / duration - opts.audioBitrate;
        const lower = actual > opts.videoBitrate * 1.15 ? nextLowerResolution(src, opts) : null;
        if (lower) {
          setStatus(`Au-dessus de la cible : l'encodeur ne descend pas assez bas, nouvel essai en ${lower.shortSide}p…`);
          opts = floored(lower);
        } else {
          setStatus("Légèrement au-dessus de la cible : second passage plus serré…");
          const ratio = (targetMb * MB) / r.blob.size;
          opts = { ...opts, videoBitrate: Math.round(opts.videoBitrate * ratio * 0.93) };
        }
        setProgress(0);
        r = await compressVideo(file, src, opts, setProgress, job.register);
      }
      // Budget sous-utilisé (contenu facile : écran, plans fixes) et résolution réduite :
      // on retente plus net, et on garde le meilleur résultat qui respecte la cible.
      if (mode === "target" && !note && opts.shortSide && r.blob.size < targetMb * MB * 0.6) {
        const boost = Math.min(3, ((targetMb * MB) / r.blob.size) * 0.9);
        const richer = planForTarget(src, targetMb * MB * boost, duration, fps30, removeAudio);
        const higher: CompressOptions = {
          ...opts,
          shortSide: richer.shortSide,
          videoBitrate: Math.min(Math.round(opts.videoBitrate * boost), Math.round(src.videoBitrate * 0.95)),
        };
        if (higher.shortSide !== opts.shortSide) {
          setStatus(`Il reste du budget : nouvel essai en ${higher.shortSide ? `${higher.shortSide}p` : "résolution originale"} pour une image plus nette…`);
          setProgress(0);
          const r2 = await compressVideo(file, src, higher, setProgress, job.register);
          if (r2.blob.size <= targetMb * MB) {
            r = r2;
            opts = higher;
          }
        }
      }
      const outRes = outputSize(src, opts.shortSide);
      if (job.stopped.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      // Gain calculé sur la sélection traitée, pas sur celle affichée plus tard
      const saved = Math.max(0, Math.round((1 - r.blob.size / sourceBytes) * 100));
      setResult({ url, blob: r.blob, ext: r.ext, size: r.blob.size, dims: `${outRes.width} × ${outRes.height}`, saved, target: mode === "target" ? targetMb : null, note });
      setStatus(null);
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Compression impossible : ${e.message}` : "Compression impossible.");
      setStatus(null);
    } finally {
      setTrying(false);
      setProgress(null);
      job.end();
    }
  }

  const resOptions = RESOLUTIONS.filter((r) => r < Math.min(src.width, src.height));
  const base = file.name.replace(/\.[^.]+$/, "");
  // Jugé sur la cible de la compression faite, pas sur les réglages affichés ensuite
  const underTarget = result && result.target !== null ? result.size <= result.target * MB : null;

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
        {trialUseful && <span className="vx-muted">Au lancement, un essai de quelques secondes vérifie que l'encodeur tient ce débit. Sinon la résolution est réduite pour respecter la cible, ou l'outil s'arrête en disant pourquoi elle est hors de portée.</span>}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="compress-video" label={mode === "target" ? `Compresser sous ${targetMb} Mo` : "Compresser"}
          busy={progress !== null} busyLabel={progress !== null ? (trying ? "Essai de l'encodeur…" : `Compression… ${Math.round(progress * 100)} %`) : undefined}
          disabled={!support || (!support.mp4 && !support.webm)} onClick={run} />
        {progress !== null && <HudButton action="cancel" compact onClick={job.stop} />}
      </div>
      {status && <p className="vx-muted">{status}</p>}
      {error && <p className="vx-alert">{error}</p>}

      {result && result.note && <p className="vx-muted">{result.note}</p>}
      {result && underTarget === false && (
        <p className="vx-alert">
          Le fichier dépasse les {result.target} Mo : l'encodeur de ce navigateur ne descend pas assez bas pour cette durée.
          {result.ext === "mp4" ? " Le format WebM tient parfois une cible plus basse ; sinon, coupe un extrait plus court ou augmente la taille cible." : " Coupe un extrait plus court ou augmente la taille cible."}
        </p>
      )}
      {result && (
        <div className="vx-result">
          <span>
            {underTarget === false ? "Cible non atteinte ·" : "✓"} {fmtBytes(result.size)} · {result.dims} · −{result.saved} %
            {underTarget !== null && (underTarget ? ` · sous les ${result.target} Mo` : ` · au-dessus des ${result.target} Mo`)}
          </span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-compresse.${result.ext}`} />
          <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext)} />
        </div>
      )}
    </div>
  );
}
