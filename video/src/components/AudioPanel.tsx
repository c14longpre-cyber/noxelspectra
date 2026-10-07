// NOXEL Spectra Vidéo — Audio : volume, fondus, musique, retrait, extraction
import { useEffect, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { AUDIO_FORMATS, audioFormatSupport, decodeMusic, editAudio, extractAudio, planAudio, videoStaysIntact } from "../lib/audio";
import type { AudioFormat, AudioPlan, Music } from "../lib/audio";
import { fmtBytes, fmtTime } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  video: HTMLVideoElement | null;
  onContinue: (blob: Blob, ext: string, suffix: string) => void;
};

export function AudioPanel({ file, info, range, video, onContinue }: Props) {
  const [tab, setTab] = useState<"edit" | "extract">("edit");
  const [mute, setMute] = useState(false);
  const [volume, setVolume] = useState(100);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [music, setMusic] = useState<Music | null>(null);
  const [musicMode, setMusicMode] = useState<"mix" | "replace">("mix");
  const [musicVolume, setMusicVolume] = useState(35);
  const [musicOffset, setMusicOffset] = useState(0);
  const [loop, setLoop] = useState(true);
  const [musicFade, setMusicFade] = useState(2);
  const [decoding, setDecoding] = useState(false);
  const [fmt, setFmt] = useState<AudioFormat>("m4a");
  const [support, setSupport] = useState<Record<AudioFormat, boolean> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; kind: "video" | "audio"; label: string; note: string; name: string } | null>(null);
  const [intact, setIntact] = useState<boolean | null>(null); // la vidéo sera-t-elle recopiée sans réencodage ?
  const cancel = useRef<(() => Promise<void>) | null>(null);
  const musicInput = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  const alive = useRef(true);
  const stopped = useRef(false); // annulation demandée, même avant que le traitement soit annulable
  const stop = () => { if (stopped.current) return; stopped.current = true; cancel.current?.().catch(() => {}); };
  const register = (c: () => Promise<void>) => { cancel.current = c; if (stopped.current) c().catch(() => {}); };

  useEffect(() => { audioFormatSupport().then((s) => { setSupport(s); if (!s.m4a) setFmt(s.ogg ? "ogg" : "wav"); }); }, []);
  // En quittant l'outil seulement : annuler le traitement en cours et libérer les URL des résultats
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
  }, []);
  useEffect(() => {
    let current = true;
    setIntact(null);
    videoStaysIntact(file, range[0]).then((ok) => { if (current) setIntact(ok); }).catch(() => { if (current) setIntact(false); });
    return () => { current = false; };
  }, [file, range[0]]);
  // Ce que l'outil fera du son (débit, stéréo), pour le dire avant d'agir
  const [plan, setPlan] = useState<AudioPlan | null>(null);
  const planMode = tab === "edit" ? "edit" : fmt;
  useEffect(() => {
    let current = true;
    setPlan(null);
    planAudio(file, planMode, info.audio?.bitrate || 0).then((p) => { if (current) setPlan(p); }).catch(() => {});
    return () => { current = false; };
  }, [file, planMode]);

  const dur = range[1] - range[0];
  const hasAudio = !!info.audio;
  const maxOffset = Math.max(0, dur - 0.5);
  const offset = Math.min(musicOffset, maxOffset); // reste dans la sélection si elle a été raccourcie
  const replacing = !!music && musicMode === "replace";
  const channels = info.audio?.channels ?? 2;
  // Le son traité est réencodé en Opus (WebM) ou en AAC (MP4) : le navigateur doit savoir le faire
  const outCodec = info.video && ["vp8", "vp9"].includes(info.video.codec) ? "Opus" : "AAC";
  const planOk = !plan || plan.copy || plan.ok; // faux : l'encodeur refuse ce son, quel que soit le réglage
  const canEncode = (!support || (outCodec === "Opus" ? support.ogg : support.m4a)) && planOk;
  const srcBitrate = info.audio?.bitrate || 0;
  const planNotes = plan && !plan.copy && !(tab === "edit" && mute) && (
    <>
      {plan.downmix && <p className="vx-muted">Le son {channels} canaux sera converti en stéréo.</p>}
      {srcBitrate > 0 && plan.bitrate > srcBitrate * 1.15 && (
        <p className="vx-muted">
          Ce navigateur n'encode pas le son en {plan.codec === "opus" ? "Opus" : "AAC"} sous {Math.round(plan.bitrate / 1000)} kb/s : le son pèsera plus que l'original (environ {Math.round(srcBitrate / 1000)} kb/s).
          {tab === "extract" && fmt === "m4a" ? " Le format OGG est souvent plus léger." : ""}
        </p>
      )}
    </>
  );

  async function pickMusic(f: File | null) {
    if (!f || !info.audio) return;
    setError(null);
    setDecoding(true);
    try {
      setMusic(await decodeMusic(f, info.audio.sampleRate));
    } catch {
      setError("Ce fichier audio n'a pas pu être lu par le navigateur (essaie un MP3, M4A, WAV ou OGG).");
    } finally {
      setDecoding(false);
    }
  }

  async function run(kind: "video" | "audio") {
    stopped.current = false;
    setError(null);
    setResult(null); // pas d'ancien résultat affiché à côté d'une erreur
    setProgress(0);
    try {
      let r: { blob: Blob; ext: string; label: string; note: string; name: string };
      if (kind === "audio") {
        const x = await extractAudio(file, range[0], range[1], fmt, info.audio?.bitrate || 0, setProgress, register);
        r = { ...x, label: "Son extrait", note: x.copied ? "recopié sans réencodage" : "", name: "son" };
      } else {
        const x = await editAudio(file, {
          start: range[0], end: range[1], volume: volume / 100, fadeIn, fadeOut,
          music: music ? { pcm: music, mode: musicMode, volume: musicVolume / 100, offset, loop, fadeIn: musicFade, fadeOut: musicFade } : null,
        }, mute, { video: info.video?.bitrate || 2e6, audio: info.audio?.bitrate || 0 }, setProgress, register);
        r = { ...x, label: mute ? "Vidéo sans le son" : "Vidéo avec le nouveau son", note: x.reencoded ? "vidéo réencodée" : "", name: mute ? "sans-son" : "audio" };
      }
      if (!alive.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      setResult({ url, blob: r.blob, ext: r.ext, kind, label: r.label, note: r.note, name: r.name });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Traitement impossible : ${e.message}` : "Traitement impossible.");
    } finally {
      setProgress(null);
      cancel.current = null;
    }
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const busy = (verb: string) => (progress !== null ? `${verb}… ${Math.round(progress * 100)} %` : undefined);

  if (!hasAudio) {
    return (
      <p className="vx-muted">
        Cette vidéo n'a aucune piste audio. L'ajout d'une musique sur une vidéo totalement muette arrivera dans une prochaine version.
      </p>
    );
  }

  return (
    <div className="vx-audio">
      <div className="vx-rot">
        <button type="button" aria-pressed={tab === "edit"} className={`vx-chip${tab === "edit" ? " is-on" : ""}`} onClick={() => setTab("edit")}>Modifier le son de la vidéo</button>
        <button type="button" aria-pressed={tab === "extract"} className={`vx-chip${tab === "extract" ? " is-on" : ""}`} onClick={() => setTab("extract")}>Extraire le son seul</button>
      </div>
      <p className="vx-muted">Son actuel : {info.audio!.codec.toUpperCase()} · {channels === 1 ? "mono" : channels === 2 ? "stéréo" : `${channels} canaux`} · {info.audio!.sampleRate / 1000} kHz. Seule la sélection de la timeline ({fmtTime(dur)}) est traitée.</p>

      {tab === "edit" ? (
        <>
          <label className="vx-check" style={{ marginBottom: 10, display: "flex" }}>
            <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} /> Retirer complètement le son
          </label>
          {!mute && (
            <>
              <div className="vx-fields">
                <label>Volume : {volume} %
                  <input type="range" min={0} max={200} step={5} value={volume} disabled={replacing} onChange={(e) => setVolume(Number(e.target.value))} />
                </label>
                <label>Fondu d'ouverture : {fadeIn} s
                  <input type="range" min={0} max={5} step={0.5} value={fadeIn} disabled={replacing} onChange={(e) => setFadeIn(Number(e.target.value))} />
                </label>
                <label>Fondu de fermeture : {fadeOut} s
                  <input type="range" min={0} max={5} step={0.5} value={fadeOut} onChange={(e) => setFadeOut(Number(e.target.value))} />
                </label>
              </div>
              {replacing && <p className="vx-muted">Mode Remplacer : le son d'origine est retiré, donc son volume et son fondu d'ouverture ne s'appliquent pas. Règle ceux de la musique plus bas ; le fondu de fermeture s'applique à la musique.</p>}
              {volume > 100 && !replacing && <p className="vx-muted">Au-dessus de 100 %, les passages forts peuvent saturer : écoute le résultat.</p>}

              <h4 className="vx-code-title">Musique</h4>
              <input ref={musicInput} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => { pickMusic(e.target.files?.[0] || null); e.target.value = ""; }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                <HudButton action="add-music" compact label={music ? "Changer de musique" : "Ajouter une musique"} busy={decoding} onClick={() => musicInput.current?.click()} />
                {music && <span className="vx-file">{music.name} · {fmtTime(music.duration)}</span>}
                {music && <HudButton action="remove-music" compact onClick={() => setMusic(null)} />}
              </div>
              {music && (
                <div className="vx-fields">
                  <div className="vx-modes" role="radiogroup" aria-label="Mode musique">
                    <label><input type="radio" name="mmode" checked={musicMode === "mix"} onChange={() => setMusicMode("mix")} /><b>Mélanger</b> — la musique sous le son de la vidéo</label>
                    <label><input type="radio" name="mmode" checked={musicMode === "replace"} onChange={() => setMusicMode("replace")} /><b>Remplacer</b> — seulement la musique</label>
                  </div>
                  <label>Volume de la musique : {musicVolume} %
                    <input type="range" min={0} max={100} step={5} value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} />
                  </label>
                  <label>Début de la musique : {fmtTime(offset)}
                    <input type="range" min={0} max={maxOffset} step={0.1} value={offset} onChange={(e) => setMusicOffset(Number(e.target.value))} />
                  </label>
                  <HudButton action="place-playhead" compact label="Placer la musique à la tête de lecture" style={{ alignSelf: "start", justifySelf: "start" }} disabled={!video}
                    onClick={() => video && setMusicOffset(Math.min(Math.max(0, video.currentTime - range[0]), maxOffset))} />
                  <label>Fondus de la musique : {musicFade} s
                    <input type="range" min={0} max={5} step={0.5} value={musicFade} onChange={(e) => setMusicFade(Number(e.target.value))} />
                  </label>
                  {music.duration < dur - offset && (
                    <label className="vx-check"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Répéter la musique (elle est plus courte que la vidéo)</label>
                  )}
                </div>
              )}
            </>
          )}
          <p className="vx-muted">{intact === null
            ? "Vérification de la vidéo…"
            : intact
              ? "La vidéo n'est pas réencodée : seul le son est traité, donc c'est rapide et sans perte d'image."
              : "WebM : la sélection ne commence pas sur une image clé, donc la vidéo sera réencodée (plus long, légère perte d'image, et le poids du fichier peut changer). Pour la garder intacte, fais commencer la sélection au tout début de la vidéo."}</p>
          {planNotes}
          {!mute && !canEncode && <p className="vx-alert">Ce navigateur ne sait pas encoder le son en {outCodec} : il ne peut pas modifier le son de cette vidéo. Tu peux quand même le retirer complètement, ou essayer avec un autre navigateur.</p>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <HudButton action="apply-audio" label={mute ? "Retirer le son" : "Appliquer au son"} disabled={!mute && !canEncode} busy={progress !== null} busyLabel={busy("Traitement du son")} onClick={() => run("video")} />
            {progress !== null && <HudButton action="cancel" compact onClick={stop} />}
          </div>
        </>
      ) : (
        <>
          <div className="vx-fields">
            <label>Format
              <select value={fmt} onChange={(e) => setFmt(e.target.value as AudioFormat)}>
                {AUDIO_FORMATS.map((f) => <option key={f.id} value={f.id} disabled={support ? !support[f.id] : false}>{f.label}{support && !support[f.id] ? " (non disponible dans ce navigateur)" : ""}</option>)}
              </select>
            </label>
          </div>
          {planNotes}
          {!planOk && <p className="vx-alert">Ce navigateur ne sait pas encoder ce son en {plan!.codec === "opus" ? "Opus" : "AAC"} : choisis un autre format.</p>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <HudButton action="extract-audio" disabled={!planOk} busy={progress !== null} busyLabel={busy("Extraction")} onClick={() => run("audio")} />
            {progress !== null && <HudButton action="cancel" compact onClick={stop} />}
          </div>
        </>
      )}

      {error && <p className="vx-alert">{error}</p>}
      {result && (result.kind === "audio") === (tab === "extract") && (
        <div className="vx-result">
          <span>✓ {result.label} · {fmtBytes(result.blob.size)} · {result.ext.toUpperCase()}{result.note ? ` · ${result.note}` : ""}</span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-${result.name}.${result.ext}`} />
          {result.kind === "video" && <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext, result.name)} />}
        </div>
      )}
    </div>
  );
}
