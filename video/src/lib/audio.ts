// NOXEL Spectra Vidéo — traitement du son.
// Seul l'audio est réencodé : la vidéo est recopiée telle quelle (rapide, aucune perte d'image).
import {
  ALL_FORMATS, AudioSample, BlobSource, BufferTarget, Conversion, EncodedPacketSink, Input, Mp4OutputFormat, OggOutputFormat, Output, WavOutputFormat,
  WebMOutputFormat, canEncodeAudio,
} from "mediabunny";
import type { InputVideoTrack } from "mediabunny";

type Progress = (p: number) => void;
type Register = (cancel: () => Promise<void>) => void;

/** Musique décodée (PCM), au taux d'échantillonnage de la vidéo. */
export type Music = { channels: Float32Array[]; sampleRate: number; duration: number; name: string };

export async function decodeMusic(file: File, sampleRate: number): Promise<Music> {
  const data = await file.arrayBuffer();
  // OfflineAudioContext rééchantillonne automatiquement au taux demandé
  const ctx = new OfflineAudioContext(2, 1, sampleRate);
  const buf = await ctx.decodeAudioData(data);
  const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  return { channels, sampleRate: buf.sampleRate, duration: buf.duration, name: file.name };
}

export type AudioEdit = {
  start: number;
  end: number;
  volume: number; // 0–2 (1 = inchangé)
  fadeIn: number; // secondes
  fadeOut: number;
  music: null | {
    pcm: Music;
    mode: "mix" | "replace";
    volume: number; // 0–1
    offset: number; // début de la musique dans la vidéo (s, depuis le début de la sélection)
    loop: boolean;
    fadeIn: number;
    fadeOut: number;
  };
};

/** Gain d'un fondu d'ouverture et de fermeture à l'instant t (sur une durée totale). */
const ramp = (t: number, total: number, fadeIn: number, fadeOut: number) => {
  let g = 1;
  if (fadeIn > 0 && t < fadeIn) g *= Math.max(0, t / fadeIn);
  if (fadeOut > 0 && t > total - fadeOut) g *= Math.max(0, (total - t) / fadeOut);
  return g;
};

/** Lit un échantillon en float32 planaire (un tableau par canal). */
function readPlanar(sample: AudioSample): Float32Array[] {
  return Array.from({ length: sample.numberOfChannels }, (_, c) => {
    const out = new Float32Array(sample.numberOfFrames);
    sample.copyTo(out, { planeIndex: c, format: "f32-planar" });
    return out;
  });
}
function makeSample(planes: Float32Array[], sampleRate: number, timestamp: number): AudioSample {
  const frames = planes[0].length;
  const data = new Float32Array(frames * planes.length);
  planes.forEach((p, c) => data.set(p, c * frames));
  return new AudioSample({ data, format: "f32-planar", numberOfChannels: planes.length, sampleRate, timestamp });
}

/** Volume, fondus et musique appliqués à un échantillon. */
export function processAudio(sample: AudioSample, e: AudioEdit): AudioSample {
  const planes = readPlanar(sample);
  const sr = sample.sampleRate;
  const total = e.end - e.start;
  const t0 = sample.timestamp; // temps local dans la sélection (Mediabunny a déjà retiré le début)
  const m = e.music;
  const own = m && m.mode === "replace" ? 0 : e.volume;
  for (let i = 0; i < sample.numberOfFrames; i++) {
    const t = t0 + i / sr;
    const g = own * ramp(t, total, e.fadeIn, e.fadeOut);
    const elapsed = t - (m ? m.offset : 0); // temps écoulé depuis le début de la musique (sans boucle)
    if (m && elapsed >= 0 && (m.loop || elapsed < m.pcm.duration)) {
      const mt = m.loop ? elapsed % m.pcm.duration : elapsed; // position dans le morceau
      const idx = Math.floor(mt * m.pcm.sampleRate);
      // Fondu d'ouverture une seule fois (pas à chaque tour de boucle) ; fondu de fermeture
      // en fin de morceau sans boucle, ou en fin de vidéo
      const end = m.loop ? total - m.offset : Math.min(m.pcm.duration, total - m.offset);
      const mg = m.volume * ramp(elapsed, end, m.fadeIn, Math.max(m.fadeOut, e.fadeOut));
      for (let c = 0; c < planes.length; c++) {
        const src = m.pcm.channels[Math.min(c, m.pcm.channels.length - 1)];
        planes[c][i] = Math.max(-1, Math.min(1, planes[c][i] * g + (src[idx] || 0) * mg));
      }
      continue;
    }
    for (let c = 0; c < planes.length; c++) planes[c][i] = Math.max(-1, Math.min(1, planes[c][i] * g));
  }
  return makeSample(planes, sr, sample.timestamp);
}

/** Vitesse : rééchantillonnage simple (la hauteur du son change avec la vitesse).
 *  La position de lecture et le dernier échantillon sont gardés d'un bloc au suivant :
 *  traités séparément, les blocs perdent chacun une fraction d'échantillon et le son clique. */
export function createSpeedResampler(speed: number): (sample: AudioSample) => AudioSample | null {
  let phase = 0; // position de lecture dans le bloc courant (−1 = dernier échantillon du bloc précédent)
  let prev: number[] = [];
  let origin = 0; // horodatage de sortie du premier échantillon écrit
  let written = -1; // échantillons écrits depuis origin (−1 = rien encore)
  return (sample) => {
    const n = sample.numberOfFrames;
    if (!n) return null;
    const planes = readPlanar(sample);
    const sr = sample.sampleRate;
    // L'horodatage reçu est déjà relatif au début de la sélection
    const expected = Math.max(0, sample.timestamp / speed);
    // Premier bloc, ou trou dans la piste source : on repart de l'horodatage réel
    if (written < 0 || prev.length !== planes.length || Math.abs(origin + written / sr - expected) > 0.02) {
      origin = expected;
      written = 0;
      phase = 0;
      prev = planes.map((p) => p[0]);
    }
    const count = phase > n - 1 ? 0 : Math.floor((n - 1 - phase) / speed) + 1;
    const out = planes.map((p, c) => {
      const o = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const x = phase + i * speed;
        const j = Math.floor(x);
        const f = x - j;
        const a = j < 0 ? prev[c] : p[j];
        o[i] = a * (1 - f) + (p[j + 1] ?? a) * f;
      }
      return o;
    });
    const timestamp = origin + written / sr;
    phase += count * speed - n;
    prev = planes.map((p) => p[n - 1]);
    written += count;
    return count ? makeSample(out, sr, timestamp) : null;
  };
}

const webmFamily = (codec: string | null) => codec === "vp8" || codec === "vp9";

/** WebM ne peut recopier la vidéo que si la sélection commence sur une image clé. */
async function startsOnKeyFrame(track: InputVideoTrack, start: number): Promise<boolean> {
  const key = await new EncodedPacketSink(track).getKeyPacket(start, { verifyKeyPackets: true });
  return !key || key.timestamp >= start;
}

/** La vidéo sera-t-elle recopiée telle quelle par editAudio ? (faux = réencodage imposé, WebM seulement) */
export async function videoStaysIntact(file: File, start: number): Promise<boolean> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || !webmFamily(await vt.getCodec())) return true;
    return await startsOnKeyFrame(vt, start);
  } finally {
    input.dispose();
  }
}

export async function editAudio(file: File, e: AudioEdit, mute: boolean, sourceBitrate: number, onProgress: Progress, register?: Register): Promise<{ blob: Blob; ext: string; reencoded: boolean }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    const codec = vt ? await vt.getCodec() : null;
    const webm = webmFamily(codec);
    const reencoded = !!vt && webm && !(await startsOnKeyFrame(vt, e.start));
    const output = new Output({ format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: e.start, end: e.end },
      // La vidéo est recopiée sans réencodage, sauf en WebM hors image clé : même codec,
      // jamais au-dessus du débit de la source
      ...(reencoded ? { video: { codec: codec!, bitrate: Math.round(sourceBitrate) } } : {}),
      audio: mute
        ? { discard: true }
        : { codec: webm ? "opus" : "aac", bitrate: 160000, forceTranscode: true, process: (s: AudioSample) => processAudio(s, e) },
    });
    const lost = conversion.discardedTracks.filter((d) => d.track.type === "video" || (d.track.type === "audio" && d.reason !== "discarded_by_user"));
    if (!conversion.isValid || lost.length) throw new Error(`format non pris en charge par ce navigateur (${lost.map((d) => `${d.track.type} : ${d.reason}`).join(", ")})`);
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    return { blob: new Blob([buffer], { type: webm ? "video/webm" : "video/mp4" }), ext: webm ? "webm" : "mp4", reencoded };
  } finally {
    input.dispose();
  }
}

export type AudioFormat = "m4a" | "ogg" | "wav";
export const AUDIO_FORMATS: { id: AudioFormat; label: string }[] = [
  { id: "m4a", label: "M4A (AAC) — léger, lu partout" },
  { id: "ogg", label: "OGG (Opus) — très léger, pour le web" },
  { id: "wav", label: "WAV — sans perte, pour le montage" },
];

export async function audioFormatSupport(): Promise<Record<AudioFormat, boolean>> {
  const [aac, opus] = await Promise.all([canEncodeAudio("aac").catch(() => false), canEncodeAudio("opus").catch(() => false)]);
  return { m4a: aac, ogg: opus, wav: true };
}

/** Extraire la piste son seule. */
export async function extractAudio(file: File, start: number, end: number, fmt: AudioFormat, onProgress: Progress, register?: Register): Promise<{ blob: Blob; ext: string }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const format = fmt === "wav" ? new WavOutputFormat() : fmt === "ogg" ? new OggOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" });
    const output = new Output({ format, target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start, end },
      video: { discard: true },
      audio: fmt === "wav" ? { codec: "pcm-s16" } : { codec: fmt === "ogg" ? "opus" : "aac", bitrate: fmt === "ogg" ? 128000 : 192000 },
    });
    if (!conversion.isValid) throw new Error("aucune piste audio exploitable dans cette vidéo");
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    const mime = fmt === "wav" ? "audio/wav" : fmt === "ogg" ? "audio/ogg" : "audio/mp4";
    return { blob: new Blob([buffer], { type: mime }), ext: fmt };
  } finally {
    input.dispose();
  }
}
