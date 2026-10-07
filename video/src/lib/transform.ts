// NOXEL Spectra Vidéo — Convertir, Pivoter & retourner, Vitesse
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, MovOutputFormat, Mp4OutputFormat, Output, WebMOutputFormat } from "mediabunny";
import type { AudioSample, ConversionOptions, VideoSample } from "mediabunny";
import { audioEncoding, audioOptions, createSpeedResampler } from "./audio";

export type ContainerId = "mp4" | "webm" | "mov";
export const CONTAINERS: { id: ContainerId; label: string; video: string[]; audio: string[]; mime: string }[] = [
  { id: "mp4", label: "MP4 — compatible partout (web, réseaux, téléphones)", video: ["avc", "hevc", "vp9", "av1"], audio: ["aac", "opus", "mp3"], mime: "video/mp4" },
  { id: "webm", label: "WebM — format ouvert du web, très léger", video: ["vp8", "vp9", "av1"], audio: ["opus", "vorbis"], mime: "video/webm" },
  { id: "mov", label: "MOV — Apple (iMovie, Final Cut, QuickTime)", video: ["avc", "hevc"], audio: ["aac"], mime: "video/quicktime" },
];
export type Result = { blob: Blob; ext: string; remuxed: boolean };
type Progress = (p: number) => void;
type Register = (cancel: () => Promise<void>) => void;

function makeOutput(id: ContainerId) {
  const format = id === "webm" ? new WebMOutputFormat() : id === "mov" ? new MovOutputFormat({ fastStart: "in-memory" }) : new Mp4OutputFormat({ fastStart: "in-memory" });
  return new Output({ format, target: new BufferTarget() });
}

async function run(file: File, id: ContainerId, build: (input: Input) => Promise<Omit<ConversionOptions, "input" | "output">>, onProgress: Progress, register?: Register): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const output = makeOutput(id);
    const conversion = await Conversion.init({ input, output, ...(await build(input)) });
    // Une piste vidéo écartée = échec, même si la conversion reste « valide » grâce à l'audio
    const lost = conversion.discardedTracks.filter((d) => d.track.type === "video" || (d.track.type === "audio" && d.reason !== "discarded_by_user"));
    if (!conversion.isValid || lost.length) {
      const why = (lost.length ? lost : conversion.discardedTracks).map((d) => `${d.track.type} : ${d.reason}`).join(", ");
      throw new Error(`format non pris en charge par ce navigateur (${why})`);
    }
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    return new Blob([buffer], { type: CONTAINERS.find((c) => c.id === id)!.mime });
  } finally {
    input.dispose();
  }
}

/** Le conteneur visé accepte-t-il les codecs actuels ? Alors on recopie sans réencoder. */
export async function canRemux(file: File, id: ContainerId): Promise<boolean> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const c = CONTAINERS.find((x) => x.id === id)!;
    const v = await input.getPrimaryVideoTrack();
    const a = await input.getPrimaryAudioTrack();
    const vc = v ? await v.getCodec() : null;
    const ac = a ? await a.getCodec() : null;
    return (!v || (!!vc && c.video.includes(vc))) && (!a || (!!ac && c.audio.includes(ac)));
  } finally {
    input.dispose();
  }
}

const defaultVideoCodec = (id: ContainerId) => (id === "webm" ? ("vp9" as const) : ("avc" as const));
const defaultAudioCodec = (id: ContainerId) => (id === "webm" ? ("opus" as const) : ("aac" as const));

/** Son réencodé : codec du format, au plus au débit de la source, stéréo au plus. */
async function audioFor(input: Input, id: ContainerId, sourceBitrate: number, process?: (s: AudioSample) => AudioSample | null) {
  const at = await input.getPrimaryAudioTrack();
  if (!at) return { codec: defaultAudioCodec(id), bitrate: 128000 };
  return audioOptions(await audioEncoding(defaultAudioCodec(id), 128000, sourceBitrate, at), process);
}

export async function convertVideo(file: File, range: [number, number], id: ContainerId, source: { video: number; audio: number }, onProgress: Progress, register?: Register): Promise<Result> {
  const remuxed = await canRemux(file, id);
  const blob = await run(file, id, async (input) => ({
    trim: { start: range[0], end: range[1] },
    // Sans réencodage si possible ; sinon codec standard du format, au débit de la source
    ...(remuxed ? {} : {
      video: { codec: defaultVideoCodec(id), bitrate: Math.max(300000, Math.round(source.video)) },
      audio: await audioFor(input, id, source.audio),
    }),
  }), onProgress, register);
  return { blob, ext: id, remuxed };
}

export type RotateOptions = { rotation: 0 | 90 | 180 | 270; flipH: boolean; flipV: boolean; bake: boolean };

export async function rotateVideo(file: File, range: [number, number], id: ContainerId, o: RotateOptions, sourceBitrate: number, onProgress: Progress, register?: Register): Promise<Result> {
  // Miroir vertical = rotation de 180° + miroir horizontal
  const rotation = ((o.rotation + (o.flipV ? 180 : 0)) % 360) as 0 | 90 | 180 | 270;
  const flip = o.flipH !== o.flipV;
  // MP4 et MOV peuvent inscrire la rotation (et le miroir) dans le fichier ; WebM ne le peut pas
  const metadataOnly = !o.bake && id !== "webm";
  const blob = await run(file, id, async () => ({
    trim: { start: range[0], end: range[1] },
    video: {
      rotate: rotation,
      flip,
      allowRotationMetadata: metadataOnly,
      allowTransformationMetadata: metadataOnly,
      // Rotation inscrite : aucun codec imposé (les images sont recopiées telles quelles).
      // Réencodage : codec standard du format, au débit de la source.
      ...(metadataOnly ? {} : { codec: defaultVideoCodec(id), bitrate: Math.max(300000, Math.round(sourceBitrate)), forceTranscode: true }),
    },
  }), onProgress, register);
  return { blob, ext: id, remuxed: metadataOnly };
}

export async function speedVideo(file: File, range: [number, number], id: ContainerId, speed: number, fps: number, source: { video: number; audio: number }, keepAudio: boolean, onProgress: Progress, register?: Register): Promise<Result> {
  const outFps = Math.min(30, Math.max(1, Math.round(fps)));
  const frame = 1 / outFps;
  let lastSlot = -1;
  const resample = createSpeedResampler(speed);
  const blob = await run(file, id, async (input) => ({
    trim: { start: range[0], end: range[1] },
    video: {
      codec: defaultVideoCodec(id),
      // Accéléré : le même nombre d'images/s contient plus d'action → un peu plus de débit
      bitrate: Math.max(300000, Math.round(source.video * Math.min(2, Math.max(1, speed)))),
      forceTranscode: true,
      process: (sample: VideoSample) => {
        const t = sample.timestamp / speed; // horodatage déjà relatif au début de la sélection
        const slot = Math.floor(t / frame + 1e-6);
        if (speed > 1 && slot === lastSlot) return null; // accéléré : on garde une image par créneau
        lastSlot = slot;
        // Accéléré : image calée sur son créneau (cadence régulière) ; ralenti : simplement étirée
        sample.setTimestamp(speed > 1 ? slot * frame : Math.max(0, t));
        sample.setDuration(speed > 1 ? frame : (sample.duration || frame) / speed);
        return sample;
      },
    },
    // Son gardé : rééchantillonné à la nouvelle vitesse (la hauteur change, comme un disque
    // joué plus vite). Garder la hauteur naturelle demande un étirement temporel, prévu plus tard.
    audio: keepAudio
      ? await audioFor(input, id, source.audio, resample)
      : { discard: true },
  }), onProgress, register);
  return { blob, ext: id, remuxed: false };
}
