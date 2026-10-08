// NOXEL Spectra Vidéo — Texte & logo : incrustation dans l'image.
// Chaque image est redessinée avec les éléments par-dessus, donc la vidéo est réencodée
// (même famille de codec, au débit de la source). Le son est recopié tel quel.
import { ALL_FORMATS, BlobSource, BufferSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat } from "mediabunny";
import type { ConversionOptions, VideoSample } from "mediabunny";
import { drawOverlays } from "./overlay";
import type { OverlayItem } from "./overlay";
import { assertNoLostTrack } from "./tracks";

export type BurnResult = { blob: Blob; ext: "mp4" | "webm"; width: number; height: number; duration: number };

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function burnOverlays(
  file: File,
  items: OverlayItem[],
  start: number,
  end: number,
  sourceBitrate: number,
  onProgress: (p: number) => void,
  register?: (cancel: () => Promise<void>) => void,
  tags?: ConversionOptions["tags"] // métadonnées à inscrire (section Copyright) ; par défaut, celles de la source
): Promise<BurnResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error("cette vidéo n'a aucune piste vidéo");
    const codec = await vt.getCodec();
    // WebM n'accepte que VP8, VP9 et AV1 : sinon (H.264, HEVC…) on produit un MP4
    const webm = codec === "vp8" || codec === "vp9" || codec === "av1";
    const width = even(await vt.getDisplayWidth());
    const height = even(await vt.getDisplayHeight());
    // Canevas du document (pas OffscreenCanvas) : mêmes polices que l'aperçu
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    const output = new Output({ format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start, end },
      ...(tags ? { tags } : {}),
      video: {
        codec: webm ? "vp9" : "avc",
        // Jamais au-dessus du débit de la source
        bitrate: Math.max(1, Math.round(sourceBitrate)),
        forceTranscode: true,
        processedWidth: width,
        processedHeight: height,
        process: (sample: VideoSample) => {
          ctx.clearRect(0, 0, width, height);
          sample.draw(ctx, 0, 0, width, height);
          // L'horodatage reçu est relatif au début de la sélection ; les éléments sont calés sur la source
          drawOverlays(ctx, items, sample.timestamp + start, width, height);
          return canvas;
        },
      },
      // Son : aucun réglage imposé, il est recopié quand le format de sortie l'accepte
    });
    assertNoLostTrack(conversion);
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");

    // Mesure du fichier produit : dimensions et durée réelles
    const check = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS });
    try {
      const out = await check.getPrimaryVideoTrack();
      const duration = out ? await out.computeDuration() : 0;
      if (!out || !(duration > 0)) throw new Error("le fichier produit ne contient aucune image");
      return {
        blob: new Blob([buffer], { type: webm ? "video/webm" : "video/mp4" }),
        ext: webm ? "webm" : "mp4",
        width: await out.getDisplayWidth(),
        height: await out.getDisplayHeight(),
        duration,
      };
    } finally {
      check.dispose();
    }
  } finally {
    input.dispose();
  }
}
