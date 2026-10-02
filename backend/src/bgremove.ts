// NOXEL Spectra — suppression d'arrière-plan
//
// Deux modèles au choix, via la variable d'environnement BG_MODEL :
//   isnet     (défaut) ISNet, licence Apache 2.0 — ~179 Mo, ~1,8 Go de mémoire en pointe
//   birefnet  BiRefNet lite, licence MIT — ~224 Mo, plus de 4 Go en pointe,
//             nettement plus précis sur les portraits et les fonds proches du sujet
//
// Le modèle est chargé seulement pendant le traitement, puis libéré. Une seule
// image est traitée à la fois pour plafonner la mémoire.

import * as fs from "fs";
import * as path from "path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

type ModelConfig = {
  file: string;
  mean: [number, number, number];
  std: [number, number, number];
  sigmoid: boolean; // BiRefNet sort des logits : sigmoïde avant normalisation
};

const MODELS: Record<string, ModelConfig> = {
  isnet: {
    file: "isnet-general-use.onnx",
    mean: [0.5, 0.5, 0.5],
    std: [1, 1, 1],
    sigmoid: false,
  },
  birefnet: {
    file: "BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx",
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    sigmoid: true,
  },
};

export const BG_MODEL_NAME = MODELS[process.env.BG_MODEL || ""] ? (process.env.BG_MODEL as string) : "isnet";
const MODEL = MODELS[BG_MODEL_NAME];
export const BG_MODEL_PATH = process.env.BG_MODEL_PATH || path.join(__dirname, "..", "models", MODEL.file);

const SIZE = 1024; // résolution d'entrée des deux modèles

export function bgModelAvailable(): boolean {
  return fs.existsSync(BG_MODEL_PATH);
}

// File d'attente : une suppression d'arrière-plan à la fois
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export type BgOptions = {
  background?: string; // couleur #rrggbb pour remplir le fond ; absent = transparent
  trim?: boolean; // recadrer au sujet (retire les bords transparents)
};

// Retourne un PNG sans perte (avec transparence si aucun fond n'est demandé)
export function removeBackground(input: Buffer, opts: BgOptions = {}): Promise<Buffer> {
  return exclusive(async () => {
    if (!bgModelAvailable()) {
      throw new Error("Modèle de suppression d'arrière-plan introuvable sur le serveur");
    }

    // Orientation EXIF appliquée d'abord : les photos de téléphone restent droites
    const { data: rgb, info } = await sharp(input)
      .rotate()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;

    // Prétraitement : 1024×1024, normalisé par le max puis par moyenne/écart-type
    const small = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
      .resize(SIZE, SIZE, { fit: "fill" })
      .raw()
      .toBuffer();
    let max = 1;
    for (let i = 0; i < small.length; i++) if (small[i] > max) max = small[i];
    const plane = SIZE * SIZE;
    const tensor = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) {
        tensor[c * plane + i] = (small[i * 3 + c] / max - MODEL.mean[c]) / MODEL.std[c];
      }
    }

    const session = await ort.InferenceSession.create(BG_MODEL_PATH, {
      executionMode: "sequential",
      graphOptimizationLevel: "all",
      enableCpuMemArena: false,
    });
    let out: Float32Array;
    try {
      const result = await session.run({
        [session.inputNames[0]]: new ort.Tensor("float32", tensor, [1, 3, SIZE, SIZE]),
      });
      out = result[session.outputNames[0]].data as Float32Array;
    } finally {
      await session.release();
    }

    // Masque : sigmoïde si nécessaire, normalisé 0-255, remis à la taille d'origine
    const values = MODEL.sigmoid ? Float32Array.from(out.subarray(0, plane), (v) => 1 / (1 + Math.exp(-v))) : out;
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = 0; i < plane; i++) {
      if (values[i] < mn) mn = values[i];
      if (values[i] > mx) mx = values[i];
    }
    const range = mx - mn || 1;
    const mask = Buffer.alloc(plane);
    for (let i = 0; i < plane; i++) mask[i] = Math.round(((values[i] - mn) / range) * 255);
    const alpha = await sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
      .resize(W, H)
      .extractChannel(0) // le redimensionnement peut produire 3 canaux
      .raw()
      .toBuffer();

    let result = sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(alpha, {
      raw: { width: W, height: H, channels: 1 },
    });

    if (opts.trim) {
      // Recadrage au sujet : on part du PNG transparent pour que trim() voie le vide.
      // Si rien n'est détecté (image entièrement transparente), on garde tel quel.
      const transparent = await result.png({ compressionLevel: 0 }).toBuffer();
      try {
        const trimmed = await sharp(transparent).trim({ threshold: 10 }).png({ compressionLevel: 0 }).toBuffer();
        result = sharp(trimmed);
      } catch {
        result = sharp(transparent);
      }
    }

    if (opts.background) {
      result = result.flatten({ background: opts.background });
    }
    return result.png({ compressionLevel: 0 }).toBuffer();
  });
}
