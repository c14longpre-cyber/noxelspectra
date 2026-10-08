// NOXEL Spectra Vidéo — compression dans le navigateur (WebCodecs via Mediabunny).
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat, canEncodeVideo } from "mediabunny";
import { audioEncoding, audioOptions } from "./audio";
import { referenceBitrate } from "./probe";
import { assertNoLostTrack } from "./tracks";

export type CompressFormat = "mp4" | "webm"; // mp4 = H.264 + AAC (compatible partout) ; webm = VP9 + Opus (plus léger)
export type CompressOptions = {
  start: number;
  end: number;
  format: CompressFormat;
  shortSide: number | null; // 1080, 720, 480… (petit côté, fonctionne aussi en vertical) ; null = originale
  fps30: boolean;
  removeAudio: boolean;
  videoBitrate: number; // bits/s
  audioBitrate: number; // bits/s
};
export type SourceInfo = { width: number; height: number; fps: number; duration: number; videoBitrate: number; hasAudio: boolean; audioBitrate?: number };

export const RESOLUTIONS = [2160, 1440, 1080, 720, 480, 360];

/** Dimensions de sortie (paires, proportions conservées). */
export function outputSize(src: SourceInfo, shortSide: number | null): { width: number; height: number } {
  const s = Math.min(src.width, src.height);
  const f = shortSide && shortSide < s ? shortSide / s : 1;
  return { width: Math.round((src.width * f) / 2) * 2, height: Math.round((src.height * f) / 2) * 2 };
}

/** Débit vidéo pour un niveau de qualité, jamais au-dessus de la source (sinon on alourdirait). */
export function bitrateForQuality(src: SourceInfo, shortSide: number | null, fps30: boolean, level: "high" | "balanced" | "light"): number {
  const { width, height } = outputSize(src, shortSide);
  const fps = fps30 ? Math.min(30, src.fps) : src.fps;
  const ref = referenceBitrate(width, height, fps);
  const factor = level === "high" ? 1 : level === "balanced" ? 0.6 : 0.35;
  return Math.round(Math.min(ref * factor, src.videoBitrate * 0.9));
}

/** Plan pour une taille cible : débits + meilleure résolution possible pour ce poids. */
export function planForTarget(src: SourceInfo, targetBytes: number, duration: number, fps30: boolean, removeAudio: boolean) {
  const total = ((targetBytes * 8) / Math.max(duration, 0.1)) * 0.96; // 4 % de marge pour le conteneur
  const audioBitrate = !src.hasAudio || removeAudio ? 0 : total < 1.2e6 ? 64000 : 128000;
  const videoBitrate = Math.round(total - audioBitrate);
  const fps = fps30 ? Math.min(30, src.fps) : src.fps;
  const own = Math.min(src.width, src.height);
  const candidates = [own, ...RESOLUTIONS.filter((r) => r < own)];
  // Plus grande résolution qui garde au moins ~40 % du débit de référence (en dessous, l'image se dégrade)
  let shortSide = candidates[candidates.length - 1];
  for (const c of candidates) {
    const { width, height } = outputSize(src, c);
    if (videoBitrate >= referenceBitrate(width, height, fps) * 0.4) {
      shortSide = c;
      break;
    }
  }
  return {
    videoBitrate: Math.min(videoBitrate, Math.round(src.videoBitrate * 0.95)),
    audioBitrate,
    shortSide: shortSide === own ? null : shortSide,
    feasible: videoBitrate >= 120000,
  };
}

export const estimateBytes = (o: CompressOptions) => Math.round(((o.videoBitrate + o.audioBitrate) * (o.end - o.start)) / 8 / 0.97);

export async function formatSupport(): Promise<Record<CompressFormat, boolean>> {
  const [mp4, webm] = await Promise.all([canEncodeVideo("avc").catch(() => false), canEncodeVideo("vp9").catch(() => false)]);
  return { mp4, webm };
}

export async function compressVideo(
  file: File,
  src: SourceInfo,
  o: CompressOptions,
  onProgress: (p: number) => void,
  register?: (cancel: () => Promise<void>) => void
): Promise<{ blob: Blob; ext: CompressFormat }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const mp4 = o.format === "mp4";
    const output = new Output({
      format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const size = outputSize(src, o.shortSide);
    // Son : au plus le débit demandé et celui de la source, à un débit que l'encodeur accepte
    const at = o.removeAudio ? null : await input.getPrimaryAudioTrack();
    const audio = at
      ? { ...audioOptions(await audioEncoding(mp4 ? "aac" : "opus", o.audioBitrate || 128000, src.audioBitrate || 0, at)), forceTranscode: true }
      : { discard: true as const };
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: o.start, end: o.end },
      video: {
        codec: mp4 ? "avc" : "vp9",
        bitrate: o.videoBitrate,
        forceTranscode: true,
        ...(o.shortSide ? { width: size.width, height: size.height, fit: "fill" as const } : {}),
        ...(o.fps30 && src.fps > 31 ? { frameRate: 30 } : {}),
      },
      audio,
    });
    assertNoLostTrack(conversion); // un son écarté en silence = erreur, pas un « ✓ » sans son
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    return { blob: new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }), ext: o.format };
  } finally {
    input.dispose();
  }
}
