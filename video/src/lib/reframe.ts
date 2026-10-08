// NOXEL Spectra Vidéo — recadrage pour les réseaux (9:16, 1:1, 4:5, 16:9)
// crop  : on garde la zone choisie (cadrage déplaçable), sans bandes
// bars  : toute l'image, avec des bandes noires
// blur  : toute l'image, sur un fond flouté de la vidéo elle-même
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat } from "mediabunny";
import type { VideoSample } from "mediabunny";
import { audioEncoding, audioOptions } from "./audio";
import { assertNoLostTrack } from "./tracks";
import type { CompressFormat } from "./compress";

export type Aspect = "9:16" | "1:1" | "4:5" | "16:9";
export type ReframeMode = "crop" | "bars" | "blur";
export const ASPECTS: { id: Aspect; label: string; use: string }[] = [
  { id: "9:16", label: "9:16", use: "Reels, TikTok, Shorts, Stories" },
  { id: "1:1", label: "1:1", use: "Publication carrée" },
  { id: "4:5", label: "4:5", use: "Publication Instagram / Facebook" },
  { id: "16:9", label: "16:9", use: "YouTube, site web" },
];
const RATIO: Record<Aspect, number> = { "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9 };
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Dimensions de sortie : le petit côté vaut shortSide (1080 → 1080 × 1920 en 9:16). */
export function targetDims(aspect: Aspect, shortSide: number) {
  const r = RATIO[aspect];
  return r < 1 ? { width: even(shortSide), height: even(shortSide / r) } : { width: even(shortSide * r), height: even(shortSide) };
}

/** Zone gardée dans la source (mode crop) ; focus 0–1 = position du cadre. */
export function cropRect(src: { width: number; height: number }, aspect: Aspect, focusX: number, focusY: number) {
  const r = RATIO[aspect];
  let width = src.width, height = src.height;
  if (src.width / src.height > r) width = src.height * r;
  else height = src.width / r;
  width = Math.min(even(width), src.width - (src.width % 2));
  height = Math.min(even(height), src.height - (src.height % 2));
  const left = even((src.width - width) * Math.min(1, Math.max(0, focusX))) - 0;
  const top = even((src.height - height) * Math.min(1, Math.max(0, focusY)));
  return { left: Math.min(left, src.width - width), top: Math.min(top, src.height - height), width, height };
}

export type ReframeOptions = {
  start: number;
  end: number;
  aspect: Aspect;
  mode: ReframeMode;
  focusX: number;
  focusY: number;
  shortSide: number;
  format: CompressFormat;
  videoBitrate: number;
  fps30: boolean;
};

export async function reframeVideo(
  file: File,
  src: { width: number; height: number; fps: number; audioBitrate?: number },
  o: ReframeOptions,
  onProgress: (p: number) => void,
  register?: (cancel: () => Promise<void>) => void
): Promise<{ blob: Blob; ext: CompressFormat; width: number; height: number }> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const mp4 = o.format === "mp4";
    const out = targetDims(o.aspect, o.shortSide);
    const output = new Output({ format: mp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(), target: new BufferTarget() });
    const common = {
      codec: mp4 ? ("avc" as const) : ("vp9" as const),
      bitrate: o.videoBitrate,
      forceTranscode: true,
      ...(o.fps30 && src.fps > 31 ? { frameRate: 30 } : {}),
    };

    let video;
    if (o.mode === "crop") {
      video = { ...common, crop: cropRect(src, o.aspect, o.focusX, o.focusY), width: out.width, height: out.height, fit: "fill" as const };
    } else {
      // Bandes ou fond flouté : on compose chaque image nous-mêmes
      const canvas = new OffscreenCanvas(out.width, out.height);
      const ctx = canvas.getContext("2d")!;
      const small = new OffscreenCanvas(Math.max(8, Math.round(out.width / 24)), Math.max(8, Math.round(out.height / 24)));
      const sctx = small.getContext("2d")!;
      video = {
        ...common,
        processedWidth: out.width,
        processedHeight: out.height,
        process: (sample: VideoSample) => {
          const sw = sample.displayWidth, sh = sample.displayHeight;
          if (o.mode === "blur") {
            // Flou rapide et universel : réduction extrême puis agrandissement lissé
            const cover = Math.max(small.width / sw, small.height / sh);
            sample.draw(sctx, (small.width - sw * cover) / 2, (small.height - sh * cover) / 2, sw * cover, sh * cover);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(small, 0, 0, out.width, out.height);
            ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
            ctx.fillRect(0, 0, out.width, out.height);
          } else {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, out.width, out.height);
          }
          const fit = Math.min(out.width / sw, out.height / sh);
          const dw = sw * fit, dh = sh * fit;
          sample.draw(ctx, (out.width - dw) / 2, (out.height - dh) / 2, dw, dh);
          return canvas;
        },
      };
    }

    const at = await input.getPrimaryAudioTrack();
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: o.start, end: o.end },
      video,
      audio: at ? audioOptions(await audioEncoding(mp4 ? "aac" : "opus", 128000, src.audioBitrate || 0, at)) : { discard: true as const },
    });
    assertNoLostTrack(conversion); // un son écarté en silence = erreur, pas un « ✓ » sans son
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    return { blob: new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }), ext: o.format, width: out.width, height: out.height };
  } finally {
    input.dispose();
  }
}
