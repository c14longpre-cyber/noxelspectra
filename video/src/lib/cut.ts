// NOXEL Spectra Vidéo — découpe d'une sélection, dans le navigateur.
// Mediabunny copie les images sans réencoder quand c'est possible (rapide, sans
// perte) et ne réencode que le nécessaire pour couper précisément à l'image près.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat } from "mediabunny";
import { assertNoLostTrack } from "./tracks";

export type CutResult = { blob: Blob; ext: "mp4" | "webm"; duration: number };
// precise : coupe à l'image près (réencodage au débit de la source si nécessaire)
// fast    : aucune image réencodée ; démarre à l'image clé la plus proche (sans perte, quasi instantané)
export type CutMode = "precise" | "fast";

export async function cutVideo(
  file: File,
  start: number,
  end: number,
  mode: CutMode,
  onProgress: (p: number) => void,
  register?: (cancel: () => Promise<void>) => void
): Promise<CutResult> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    // WebM n'accepte que VP8, VP9 et AV1 : sinon (H.264, HEVC…) on produit un MP4
    const vt = await input.getPrimaryVideoTrack();
    const codec = vt ? await vt.getCodec() : null;
    const webm = codec === "vp8" || codec === "vp9" || codec === "av1";
    const output = new Output({
      format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    // Débit réel de la source : un réencodage ne doit jamais alourdir l'extrait
    const sourceBitrate = vt ? Math.round((await vt.computePacketStats()).averageBitrate) : 0;
    const conversion = await Conversion.init({
      input,
      output,
      trim: { start, end },
      ...(mode === "fast"
        ? { copy: { shiftTolerance: Infinity, boundaryPolicy: "expand" as const } }
        : sourceBitrate > 0
          ? { video: { bitrate: sourceBitrate } }
          : {}),
    });
    assertNoLostTrack(conversion);
    register?.(() => conversion.cancel());
    conversion.onProgress = (p) => onProgress(p);
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("aucune donnée produite");
    const blob = new Blob([buffer], { type: webm ? "video/webm" : "video/mp4" });
    // Durée mesurée sur le fichier produit (le mode rapide peut commencer un peu plus tôt)
    const check = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const duration = await check.computeDuration().finally(() => check.dispose());
    return { blob, ext: webm ? "webm" : "mp4", duration };
  } finally {
    input.dispose();
  }
}
