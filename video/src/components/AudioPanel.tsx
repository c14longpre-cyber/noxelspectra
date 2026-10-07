// NOXEL Spectra Vidéo — Audio : volume, fondus, musique, retrait, extraction
import { useEffect, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { AUDIO_FORMATS, audioFormatSupport, decodeMusic, editAudio, extractAudio, videoStaysIntact } from "../lib/audio";
import type { AudioFormat, Music } from "../lib/audio";
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
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; kind: "video" | "audio"; reencoded: boolean } | null>(null);
  const [intact, setIntact] = useState<boolean | null>(null); // la vidéo sera-t-elle recopiée sans réencodage ?
  const cancel = useRef<(() => Promise<void>) | null>(null);
  const musicInput = useRef<HTMLInputElement | null>(null);
  const urls = useRef<string[]>([]);
  const alive = useRef(true);

  useEffect(() => { audioFormatSupport().then((s) => { setSupport(s); if (!s.m4a) setFmt(s.ogg ? "ogg" : "wav"); }); }, []);
  // En quittant l'outil seulement : annuler le traitement en cours et libérer les URL des résultats
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancel.current?.().catch(() => {});
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

  const dur = range[1] - range[0];
  const hasAudio = !!info.audio;

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
    setError(null);
    setResult(null); // pas d'ancien résultat affiché à côté d'une erreur
    setProgress(0);
    try {
      const r = kind === "audio"
        ? { ...(await extractAudio(file, range[0], range[1], fmt, setProgress, (c) => (cancel.current = c))), reencoded: false }
        : await editAudio(file, {
            start: range[0], end: range[1], volume: volume / 100, fadeIn, fadeOut,
            music: music ? { pcm: music, mode: musicMode, volume: musicVolume / 100, offset: musicOffset, loop, fadeIn: musicFade, fadeOut: musicFade } : null,
          }, mute, info.video?.bitrate || 2e6, setProgress, (c) => (cancel.current = c));
      if (!alive.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      setResult({ url, blob: r.blob, ext: r.ext, kind, reencoded: r.reencoded });
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
        <button type="button" className={`vx-chip${tab === "edit" ? " is-on" : ""}`} onClick={() => setTab("edit")}>Modifier le son de la vidéo</button>
        <button type="button" className={`vx-chip${tab === "extract" ? " is-on" : ""}`} onClick={() => setTab("extract")}>Extraire le son seul</button>
      </div>
      <p className="vx-muted">Son actuel : {info.audio!.codec.toUpperCase()} · {info.audio!.channels === 1 ? "mono" : "stéréo"} · {info.audio!.sampleRate / 1000} kHz. Seule la sélection de la timeline ({fmtTime(dur)}) est traitée.</p>

      {tab === "edit" ? (
        <>
          <label className="vx-check" style={{ marginBottom: 10, display: "flex" }}>
            <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} /> Retirer complètement le son
          </label>
          {!mute && (
            <>
              <div className="vx-fields">
                <label>Volume : {volume} %
                  <input type="range" min={0} max={200} step={5} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                </label>
                <label>Fondu d'ouverture : {fadeIn} s
                  <input type="range" min={0} max={5} step={0.5} value={fadeIn} onChange={(e) => setFadeIn(Number(e.target.value))} />
                </label>
                <label>Fondu de fermeture : {fadeOut} s
                  <input type="range" min={0} max={5} step={0.5} value={fadeOut} onChange={(e) => setFadeOut(Number(e.target.value))} />
                </label>
              </div>
              {volume > 100 && <p className="vx-muted">Au-dessus de 100 %, les passages forts peuvent saturer : écoute le résultat.</p>}

              <h4 className="vx-code-title">Musique</h4>
              <input ref={musicInput} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => { pickMusic(e.target.files?.[0] || null); e.target.value = ""; }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                <button type="button" className="vx-btn" onClick={() => musicInput.current?.click()} disabled={decoding}>
                  {decoding ? "Lecture de la musique…" : music ? "Changer de musique" : "🎵 Ajouter une musique"}
                </button>
                {music && <span className="vx-file">{music.name} · {fmtTime(music.duration)}</span>}
                {music && <button type="button" className="vx-btn" onClick={() => setMusic(null)}>Retirer la musique</button>}
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
                  <label>Début de la musique : {fmtTime(musicOffset)}
                    <input type="range" min={0} max={Math.max(0, dur - 0.5)} step={0.1} value={musicOffset} onChange={(e) => setMusicOffset(Number(e.target.value))} />
                    <button type="button" className="vx-btn" style={{ alignSelf: "start" }}
                      onClick={() => video && setMusicOffset(Math.min(Math.max(0, video.currentTime - range[0]), Math.max(0, dur - 0.5)))}>
                      Placer à la tête de lecture
                    </button>
                  </label>
                  <label>Fondus de la musique : {musicFade} s
                    <input type="range" min={0} max={5} step={0.5} value={musicFade} onChange={(e) => setMusicFade(Number(e.target.value))} />
                  </label>
                  {music.duration < dur - musicOffset && (
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
              : "WebM : la sélection ne commence pas sur une image clé, donc la vidéo sera réencodée (plus long, légère perte d'image, au plus au débit de la source). Pour la garder intacte, fais commencer la sélection au tout début de la vidéo."}</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <HudButton action="apply-audio" label={mute ? "Retirer le son" : "Appliquer au son"} busy={progress !== null} busyLabel={busy("Traitement du son")} onClick={() => run("video")} />
            {progress !== null && <button type="button" className="vx-btn" onClick={() => cancel.current?.()}>Annuler</button>}
          </div>
        </>
      ) : (
        <>
          <div className="vx-fields">
            <label>Format
              <select value={fmt} onChange={(e) => setFmt(e.target.value as AudioFormat)}>
                {AUDIO_FORMATS.map((f) => <option key={f.id} value={f.id} disabled={support ? !support[f.id] : false}>{f.label}</option>)}
              </select>
            </label>
          </div>
          <HudButton action="extract-audio" busy={progress !== null} busyLabel={busy("Extraction")} onClick={() => run("audio")} />
        </>
      )}

      {error && <p className="vx-alert">{error}</p>}
      {result && (
        <div className="vx-result">
          <span>✓ {result.kind === "audio" ? "Son extrait" : "Vidéo avec le nouveau son"} · {fmtBytes(result.blob.size)} · {result.ext.toUpperCase()}{result.reencoded ? " · vidéo réencodée" : ""}</span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-${result.kind === "audio" ? "son" : "audio"}.${result.ext}`} />
          {result.kind === "video" && <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext, "audio")} />}
        </div>
      )}
    </div>
  );
}
