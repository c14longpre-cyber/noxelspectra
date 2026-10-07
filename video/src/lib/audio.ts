// NOXEL Spectra Vidéo — traitement du son.
// Seul l'audio est réencodé : la vidéo est recopiée telle quelle (rapide, aucune perte d'image).
import {
  ALL_FORMATS, AudioSample, BlobSource, BufferSource, BufferTarget, Conversion, EncodedPacketSink, Input, Mp4OutputFormat, OggOutputFormat, Output, WavOutputFormat,
  WebMOutputFormat, canEncodeAudio,
} from "mediabunny";
import type { InputAudioTrack, InputVideoTrack } from "mediabunny";

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

const BITRATES = [32000, 48000, 64000, 96000, 128000, 160000, 192000];

/** Débit audio à demander : au plus celui de la source (0 = inconnu) quand l'encodeur l'accepte.
 *  Certains encodeurs AAC n'acceptent que quelques débits fixes (96, 128, 160, 192 kb/s) : on prend
 *  alors le débit accepté le plus proche, quitte à dépasser une source à faible débit (plancher de
 *  l'encodeur : une source à 24 kb/s sort à 96 kb/s sous Chrome/Windows). */
const capBitrate = (target: number, source: number) => (source > 0 ? Math.min(target, Math.round(source)) : target);

async function pickBitrate(codec: "aac" | "opus", target: number, source: number, numberOfChannels: number, sampleRate: number): Promise<number | null> {
  const cap = capBitrate(target, source);
  const near = BITRATES.filter((b) => b <= cap * 1.1 && b <= target).reverse(); // 124 kb/s mesurés = 128 nominal
  const above = BITRATES.filter((b) => b > cap * 1.1);
  for (const bitrate of [cap, ...near, ...above]) {
    if (await canEncodeAudio(codec, { bitrate, numberOfChannels, sampleRate }).catch(() => false)) return bitrate;
  }
  return null;
}

export type AudioEncoding = {
  options: { codec: "aac" | "opus"; bitrate: number; numberOfChannels?: number; sampleRate?: number };
  downmix: boolean; // plus de 2 canaux ramenés à la stéréo
  gain: number; // à appliquer après le mixage vers la stéréo pour ne pas saturer
  ok: boolean; // faux : l'encodeur du navigateur refuse ce son, quel que soit le réglage
};

/** Réglages d'encodage du son, partagés par Audio, Convertir et Vitesse : un débit que l'encodeur
 *  accepte, et stéréo au plus (en 5.1, l'AAC de Chrome sort 960 kb/s pour 160 demandés). Si
 *  l'encodeur refuse le taux d'échantillonnage de la source (22,05 ou 32 kHz en AAC), on passe à
 *  48 kHz, puis à 48 kHz stéréo. */
export async function audioEncoding(codec: "aac" | "opus", target: number, source: number, track: InputAudioTrack): Promise<AudioEncoding> {
  const [channels, sampleRate] = await Promise.all([track.getNumberOfChannels(), track.getSampleRate()]);
  const out = Math.min(channels, 2);
  // Le mixage 5.1 → stéréo de Mediabunny additionne L + 0,707 × (C + Ls) sans atténuer
  const gain = channels === 6 ? 1 / (1 + Math.SQRT2) : 1;
  for (const [ch, sr] of [[out, sampleRate], [out, 48000], [2, 48000]]) {
    const bitrate = await pickBitrate(codec, target, source, ch, sr);
    if (bitrate === null) continue;
    const options = { codec, bitrate, ...(ch !== channels ? { numberOfChannels: ch } : {}), ...(sr !== sampleRate ? { sampleRate: sr } : {}) };
    return { options, downmix: channels > 2, gain, ok: true };
  }
  return { options: { codec, bitrate: capBitrate(target, source) }, downmix: false, gain: 1, ok: false }; // l'erreur de l'encodeur sera affichée
}

/** Options audio complètes d'une conversion : encodage, puis traitement éventuel (le gain du
 *  mixage vers la stéréo passe en premier). */
export function audioOptions(enc: AudioEncoding, process?: (s: AudioSample) => AudioSample | null) {
  const chain = enc.gain === 1 ? process : (s: AudioSample) => {
    const planes = readPlanar(s);
    for (const p of planes) for (let i = 0; i < p.length; i++) p[i] *= enc.gain;
    const quiet = makeSample(planes, s.sampleRate, s.timestamp);
    if (!process) return quiet;
    const out = process(quiet);
    if (out !== quiet) quiet.close(); // échantillon intermédiaire
    return out;
  };
  return { ...enc.options, ...(chain ? { forceTranscode: true, process: chain } : {}) };
}

const TARGET_BITRATE = { edit: 160000, m4a: 192000, ogg: 128000 };

export type AudioPlan = { copy: boolean; codec: "aac" | "opus"; bitrate: number; downmix: boolean; ok: boolean };

/** Ce que l'outil fera du son, pour le dire avant d'agir. `mode` : "edit" (Appliquer au son) ou un
 *  format d'extraction. null = rien à annoncer (pas de son, ou WAV). */
export async function planAudio(file: File, mode: "edit" | AudioFormat, sourceBitrate: number): Promise<AudioPlan | null> {
  if (mode === "wav") return null;
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const at = await input.getPrimaryAudioTrack();
    if (!at) return null;
    let codec: "aac" | "opus" = mode === "ogg" ? "opus" : "aac";
    if (mode === "edit") {
      const vt = await input.getPrimaryVideoTrack();
      codec = webmFamily(vt ? await vt.getCodec() : null) ? "opus" : "aac";
    } else if ((await at.getCodec()) === codec) {
      return { copy: true, codec, bitrate: 0, downmix: false, ok: true };
    }
    const enc = await audioEncoding(codec, TARGET_BITRATE[mode], sourceBitrate, at);
    return { copy: false, codec, bitrate: enc.options.bitrate, downmix: enc.downmix, ok: enc.ok };
  } finally {
    input.dispose();
  }
}

const EMPTY_AUDIO = "le fichier produit ne contient aucun son (la sélection dépasse peut-être la fin de la piste audio)";

/** Relit le fichier produit : une piste attendue absente ou vide = erreur (jamais de faux succès). */
async function checkOutput(buffer: ArrayBuffer, want: { video: boolean; audio: boolean }) {
  const input = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS });
  try {
    // Un fichier illisible (réduit à son en-tête) compte comme une piste absente
    if (want.video) {
      const d = await input.getPrimaryVideoTrack().then((t) => (t ? t.computeDuration() : 0)).catch(() => 0);
      if (!(d > 0)) throw new Error("le fichier produit ne contient aucune image");
    }
    if (want.audio) {
      const d = await input.getPrimaryAudioTrack().then((t) => (t ? t.computeDuration() : 0)).catch(() => 0);
      if (!(d > 0)) throw new Error(EMPTY_AUDIO);
    }
  } finally {
    input.dispose();
  }
}

export async function editAudio(file: File, e: AudioEdit, mute: boolean, source: { video: number; audio: number }, onProgress: Progress, register?: Register): Promise<{ blob: Blob; ext: string; reencoded: boolean }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    const codec = vt ? await vt.getCodec() : null;
    const webm = webmFamily(codec);
    const reencoded = !!vt && webm && !(await startsOnKeyFrame(vt, e.start));
    const output = new Output({ format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const at = mute ? null : await input.getPrimaryAudioTrack();
    const enc = at ? await audioEncoding(webm ? "opus" : "aac", TARGET_BITRATE.edit, source.audio, at) : null;
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: e.start, end: e.end },
      // La vidéo est recopiée sans réencodage, sauf en WebM hors image clé : même codec,
      // jamais au-dessus du débit de la source
      ...(reencoded ? { video: { codec: codec!, bitrate: Math.round(source.video) } } : {}),
      audio: !enc
        ? { discard: true }
        : audioOptions(enc, (s) => processAudio(s, e)),
    });
    const lost = conversion.discardedTracks.filter((d) => d.track.type === "video" || (d.track.type === "audio" && d.reason !== "discarded_by_user"));
    if (!conversion.isValid || lost.length) {
      const why = (lost.length ? lost : conversion.discardedTracks).map((d) => `${d.track.type} : ${d.reason}`).join(", ");
      throw new Error(`format non pris en charge par ce navigateur${why ? ` (${why})` : ""}`);
    }
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    await checkOutput(buffer, { video: !!vt, audio: !mute });
    return { blob: new Blob([buffer], { type: webm ? "video/webm" : "video/mp4" }), ext: webm ? "webm" : "mp4", reencoded };
  } finally {
    input.dispose();
  }
}

export type AudioFormat = "m4a" | "ogg" | "wav";
export const AUDIO_FORMATS: { id: AudioFormat; label: string }[] = [
  { id: "m4a", label: "M4A (AAC) — léger, lu partout" },
  { id: "ogg", label: "OGG (Opus) — très léger, pour le web" },
  { id: "wav", label: "WAV — non compressé, pour le montage" },
];

export async function audioFormatSupport(): Promise<Record<AudioFormat, boolean>> {
  const [aac, opus] = await Promise.all([canEncodeAudio("aac").catch(() => false), canEncodeAudio("opus").catch(() => false)]);
  return { m4a: aac, ogg: opus, wav: true };
}

/** Extraire la piste son seule. */
export async function extractAudio(file: File, start: number, end: number, fmt: AudioFormat, sourceBitrate: number, onProgress: Progress, register?: Register): Promise<{ blob: Blob; ext: string; copied: boolean }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const at = await input.getPrimaryAudioTrack();
    if (!at) throw new Error("cette vidéo n'a aucune piste audio");
    const makeOutput = () => new Output({
      format: fmt === "wav" ? new WavOutputFormat() : fmt === "ogg" ? new OggOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    const base = { input, trim: { start, end }, video: { discard: true as const } };
    // Son déjà dans le codec du format (AAC → M4A, Opus → OGG) : recopié tel quel, sans réencodage.
    // La copie se fait par paquets entiers : le début peut être décalé de quelques centièmes de seconde.
    let copied = (await at.getCodec()) === (fmt === "m4a" ? "aac" : fmt === "ogg" ? "opus" : null);
    let output = makeOutput();
    let conversion = copied ? await Conversion.init({ ...base, output, copy: { mode: "forced", shiftTolerance: Infinity } }) : null;
    if (conversion && (!conversion.isValid || conversion.discardedTracks.some((d) => d.reason === "cannot_copy"))) {
      conversion = null;
      copied = false;
      output = makeOutput();
    }
    // Sinon réencodage, au plus au débit de la source quand l'encodeur l'accepte
    conversion ??= await Conversion.init({
      ...base,
      output,
      audio: fmt === "wav"
        ? { codec: "pcm-s16" }
        : audioOptions(await audioEncoding(fmt === "ogg" ? "opus" : "aac", TARGET_BITRATE[fmt], sourceBitrate, at)),
    });
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.filter((d) => d.track.type === "audio").map((d) => d.reason).join(", ");
      throw new Error(`ce navigateur ne peut pas produire ce format à partir de cette piste audio${why ? ` (${why})` : ""}`);
    }
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute().catch((err) => {
      // WAV refuse de se finaliser sans aucun échantillon : même cas qu'un fichier sans son
      throw err instanceof Error && /empty|no packets/i.test(err.message) ? new Error(EMPTY_AUDIO) : err;
    });
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    await checkOutput(buffer, { video: false, audio: true });
    const mime = fmt === "wav" ? "audio/wav" : fmt === "ogg" ? "audio/ogg" : "audio/mp4";
    return { blob: new Blob([buffer], { type: mime }), ext: fmt, copied };
  } finally {
    input.dispose();
  }
}
