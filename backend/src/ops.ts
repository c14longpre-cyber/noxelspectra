// NOXEL Spectra — moteur de traitement par lots
//
// Principe : chaque opération reçoit un buffer PNG sans perte et rend un
// buffer PNG sans perte. L'encodage final (WebP, AVIF, JPEG…) n'arrive
// qu'une seule fois, à la toute fin de la recette — aucune perte en cascade.
//
// Les métadonnées (EXIF/GPS/ICC) disparaissent naturellement : Sharp ne les
// recopie jamais sans withMetadata(). Seule l'étape de sortie peut en
// ajouter (copyright).

import sharp from "sharp";
import { removeBackground } from "./bgremove";

export type OutputFormat = "jpeg" | "png" | "webp" | "avif" | "gif";
const OUTPUT_FORMATS: OutputFormat[] = ["jpeg", "png", "webp", "avif", "gif"];
const SEPIA: [[number, number, number], [number, number, number], [number, number, number]] = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];

export type RecipeStep =
  | { op: "removeBg"; background?: string; trim: boolean }
  | { op: "resize"; width?: number; height?: number; maintainAspect: boolean; allowEnlarge: boolean }
  | { op: "rotate"; angle: number; flipHorizontal: boolean; flipVertical: boolean }
  | {
      op: "adjust";
      brightness: number;
      contrast: number;
      saturation: number;
      sharpen: number;
      blurAmount: number;
      effect: "none" | "grayscale" | "sepia";
      invert: boolean;
      pixelate: number;
      reduceNoise: number;
      vignetteIntensity: number;
    }
  | { op: "shadow"; offsetX: number; offsetY: number; blur: number; opacity: number }
  | { op: "glow"; intensity: number }
  | {
      op: "watermarkText";
      text: string;
      color: string;
      position: string;
      opacity: number;
      size: number;
    };

export type RecipeOutput = {
  format: "original" | OutputFormat;
  quality: number;
  targetSizeKB?: number;
  copyright?: { author: string; text: string };
};

export type Recipe = { steps: RecipeStep[]; output: RecipeOutput };

// ── Validation ─────────────────────────────────────────────────────────
const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const WATERMARK_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right", "center", "tiled"];
const MAX_STEPS = 15;

export function parseRecipe(raw: unknown): Recipe {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error("Recette invalide (JSON mal formé)");
    }
  }
  if (!obj || typeof obj !== "object") throw new Error("Recette invalide");
  const rawSteps = Array.isArray((obj as any).steps) ? (obj as any).steps : [];
  if (rawSteps.length > MAX_STEPS) throw new Error(`Recette trop longue (${MAX_STEPS} étapes maximum)`);

  const steps: RecipeStep[] = rawSteps.map((s: any, i: number): RecipeStep => {
    switch (s?.op) {
      case "resize": {
        const width = s.width ? Math.round(clamp(s.width, 1, 10000, 0)) : undefined;
        const height = s.height ? Math.round(clamp(s.height, 1, 10000, 0)) : undefined;
        if (!width && !height) throw new Error(`Étape ${i + 1} : largeur ou hauteur requise`);
        // Dans une recette, une taille est un maximum : on n'agrandit pas sauf demande explicite
        return { op: "resize", width, height, maintainAspect: s.maintainAspect !== false, allowEnlarge: s.allowEnlarge === true };
      }
      case "rotate":
        return {
          op: "rotate",
          angle: Math.round(clamp(s.angle, -360, 360, 0)),
          flipHorizontal: s.flipHorizontal === true,
          flipVertical: s.flipVertical === true,
        };
      case "adjust":
        return {
          op: "adjust",
          brightness: clamp(s.brightness, 0.3, 2, 1),
          contrast: clamp(s.contrast, 0.3, 2, 1),
          saturation: clamp(s.saturation, 0, 2, 1),
          sharpen: clamp(s.sharpen, 0, 10, 0),
          blurAmount: clamp(s.blurAmount, 0, 20, 0),
          effect: s.effect === "grayscale" || s.effect === "sepia" ? s.effect : "none",
          invert: s.invert === true,
          pixelate: Math.round(clamp(s.pixelate, 0, 50, 0)),
          reduceNoise: [3, 5, 7].includes(Number(s.reduceNoise)) ? Number(s.reduceNoise) : 0,
          vignetteIntensity: Math.round(clamp(s.vignetteIntensity, 0, 100, 0)),
        };
      case "shadow":
        return {
          op: "shadow",
          offsetX: Math.round(clamp(s.offsetX, -50, 50, 15)),
          offsetY: Math.round(clamp(s.offsetY, -50, 50, 15)),
          blur: clamp(s.blur, 0.3, 30, 8),
          opacity: clamp(s.opacity, 0, 100, 60),
        };
      case "removeBg":
        return {
          op: "removeBg",
          background: /^#[0-9a-fA-F]{6}$/.test(s.background) ? s.background : undefined,
          trim: s.trim === true,
        };
      case "glow":
        return { op: "glow", intensity: clamp(s.intensity, 0, 30, 12) };
      case "watermarkText":
        return {
          op: "watermarkText",
          text: String(s.text || "NOXEL").slice(0, 200),
          color: /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : "#ffffff",
          position: WATERMARK_POSITIONS.includes(s.position) ? s.position : "bottom-right",
          opacity: clamp(s.opacity, 0, 100, 60),
          size: Math.round(clamp(s.size, 0, 200, 0)),
        };
      default:
        throw new Error(`Étape ${i + 1} : opération inconnue « ${s?.op} »`);
    }
  });

  const o = (obj as any).output || {};
  const format = o.format === "original" || OUTPUT_FORMATS.includes(o.format) ? o.format : "original";
  const output: RecipeOutput = {
    format,
    quality: Math.round(clamp(o.quality, 1, 100, 80)),
  };
  if (o.targetSizeKB && Number(o.targetSizeKB) > 0) {
    output.targetSizeKB = Math.round(clamp(o.targetSizeKB, 1, 50000, 200));
  }
  if (o.copyright && (o.copyright.author || o.copyright.text)) {
    output.copyright = {
      author: String(o.copyright.author || "").slice(0, 200),
      text: String(o.copyright.text || "").slice(0, 300),
    };
  }
  return { steps, output };
}

// ── Opérations (PNG sans perte → PNG sans perte) ──────────────────────
// compressionLevel 0 : les buffers intermédiaires ne sortent jamais du
// serveur, inutile de dépenser du CPU à les compresser.
const lossless = (p: ReturnType<typeof sharp>) => p.png({ compressionLevel: 0 }).toBuffer();

async function dims(buf: Buffer) {
  const m = await sharp(buf).metadata();
  return { width: m.width || 0, height: m.height || 0, hasAlpha: !!m.hasAlpha };
}

async function applyStep(buf: Buffer, step: RecipeStep): Promise<Buffer> {
  switch (step.op) {
    case "resize":
      return lossless(
        sharp(buf).resize({
          width: step.width,
          height: step.height,
          fit: step.maintainAspect ? "inside" : "fill",
          withoutEnlargement: !step.allowEnlarge,
        })
      );

    case "rotate": {
      const { hasAlpha } = await dims(buf);
      let p = sharp(buf);
      if (step.angle !== 0) {
        p = p.rotate(step.angle, {
          background: hasAlpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255 },
        });
      }
      if (step.flipHorizontal) p = p.flop();
      if (step.flipVertical) p = p.flip();
      return lossless(p);
    }

    case "adjust": {
      const { width, height } = await dims(buf);
      let p = sharp(buf);
      if (step.pixelate > 1 && width > 0 && height > 0) {
        const small = await sharp(buf)
          .resize(Math.max(1, Math.round(width / step.pixelate)), Math.max(1, Math.round(height / step.pixelate)), {
            kernel: "nearest",
          })
          .toBuffer();
        p = sharp(small).resize(width, height, { kernel: "nearest" });
      }
      if (step.reduceNoise > 0) p = p.median(step.reduceNoise);
      if (step.brightness !== 1 || step.saturation !== 1) {
        p = p.modulate({ brightness: step.brightness, saturation: step.saturation });
      }
      if (step.contrast !== 1) p = p.linear(step.contrast, 128 * (1 - step.contrast));
      if (step.sharpen > 0) p = p.sharpen({ sigma: step.sharpen });
      if (step.blurAmount > 0) p = p.blur(step.blurAmount);
      if (step.effect === "grayscale") p = p.grayscale();
      else if (step.effect === "sepia") p = p.recomb(SEPIA);
      if (step.invert) p = p.negate({ alpha: false });
      if (step.vignetteIntensity > 0 && width > 0 && height > 0) {
        const svg =
          `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
          `<defs><radialGradient id="v" cx="50%" cy="50%" r="75%">` +
          `<stop offset="55%" stop-color="white" stop-opacity="0"/>` +
          `<stop offset="100%" stop-color="black" stop-opacity="${step.vignetteIntensity / 100}"/>` +
          `</radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
        const vignette = await sharp(Buffer.from(svg)).png().toBuffer();
        p = p.composite([{ input: vignette, blend: "multiply" }]);
      }
      return lossless(p);
    }

    case "shadow": {
      const { width, height } = await dims(buf);
      const opacity = step.opacity / 100;
      const padding = Math.ceil(step.blur * 3) + Math.max(Math.abs(step.offsetX), Math.abs(step.offsetY));
      const source = await sharp(buf).ensureAlpha().png().toBuffer();
      const mask = await sharp(source).extractChannel(3).png().toBuffer();
      const layer = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: mask, blend: "dest-in" }])
        .ensureAlpha()
        .png()
        .toBuffer();
      const blurred = await sharp(layer).blur(step.blur).png().toBuffer();
      const faded = await sharp(blurred)
        .composite([
          {
            input: { create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: opacity } } },
            blend: "dest-in",
          },
        ])
        .png()
        .toBuffer();
      return lossless(
        sharp({
          create: {
            width: width + padding * 2,
            height: height + padding * 2,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          },
        }).composite([
          { input: faded, left: padding + step.offsetX, top: padding + step.offsetY },
          { input: source, left: padding, top: padding },
        ])
      );
    }

    case "removeBg":
      return removeBackground(buf, { background: step.background, trim: step.trim });

    case "glow": {
      const sigma = Math.max(0.3, step.intensity * 0.3);
      const glowLayer = await sharp(buf)
        .blur(sigma)
        .modulate({ brightness: 1 + step.intensity / 30 })
        .png()
        .toBuffer();
      return lossless(sharp(buf).composite([{ input: glowLayer, blend: "screen" }]));
    }

    case "watermarkText": {
      const { width, height } = await dims(buf);
      const opacity = step.opacity / 100;
      const fontSize = step.size > 0 ? step.size : Math.max(18, Math.round(width * 0.04));
      const escaped = step.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const pad = Math.round(fontSize * 0.6);
      const tw = Math.round(escaped.length * fontSize * 0.6) + pad * 2;
      const th = Math.round(fontSize * 1.5) + pad;
      const svg =
        `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">` +
        `<text x="${pad}" y="${Math.round(th * 0.68)}" font-family="Arial, sans-serif" font-size="${fontSize}" ` +
        `font-weight="700" fill="${step.color}" fill-opacity="${opacity}">${escaped}</text></svg>`;
      let overlay = await sharp(Buffer.from(svg)).png().toBuffer();
      let om = await sharp(overlay).metadata();
      // Un filigrane plus grand que l'image ferait planter composite()
      if ((om.width || 0) > width || (om.height || 0) > height) {
        overlay = await sharp(overlay).resize({ width, height, fit: "inside" }).png().toBuffer();
        om = await sharp(overlay).metadata();
      }
      const ow = om.width || tw;
      const oh = om.height || th;
      const margin = Math.round(Math.min(width, height) * 0.03);
      const composites: { input: Buffer; left: number; top: number }[] = [];
      if (step.position === "tiled") {
        for (let y = margin; y < height; y += oh + margin * 2) {
          for (let x = margin; x < width; x += ow + margin * 2) {
            composites.push({
              input: overlay,
              left: Math.min(x, Math.max(0, width - ow)),
              top: Math.min(y, Math.max(0, height - oh)),
            });
          }
        }
      } else {
        const pos: Record<string, [number, number]> = {
          "top-left": [margin, margin],
          "top-right": [width - ow - margin, margin],
          "bottom-left": [margin, height - oh - margin],
          center: [Math.round((width - ow) / 2), Math.round((height - oh) / 2)],
          "bottom-right": [width - ow - margin, height - oh - margin],
        };
        const [left, top] = pos[step.position] || pos["bottom-right"];
        composites.push({ input: overlay, left: Math.max(0, left), top: Math.max(0, top) });
      }
      return lossless(sharp(buf).composite(composites));
    }
  }
}

// ── Encodage final (une seule fois) ───────────────────────────────────
function encode(buf: Buffer, format: OutputFormat, quality: number, copyright?: RecipeOutput["copyright"]) {
  let p = sharp(buf);
  if (copyright) {
    p = p.withMetadata({
      exif: {
        IFD0: {
          ...(copyright.text ? { Copyright: copyright.text } : {}),
          ...(copyright.author ? { Artist: copyright.author } : {}),
        },
      },
    });
  }
  switch (format) {
    case "jpeg":
      return p.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
    case "webp":
      return p.webp({ quality }).toBuffer();
    case "avif":
      return p.avif({ quality }).toBuffer();
    case "gif":
      return p.gif().toBuffer();
    case "png":
    default:
      return p.png({ compressionLevel: 9, effort: 10 }).toBuffer();
  }
}

async function encodeToTarget(
  buf: Buffer,
  format: OutputFormat,
  targetBytes: number,
  copyright?: RecipeOutput["copyright"]
): Promise<{ data: Buffer; quality: number; metTarget: boolean }> {
  let low = 1;
  let high = 100;
  let best: { data: Buffer; quality: number } | null = null;
  for (let i = 0; i < 7 && low <= high; i++) {
    const mid = Math.floor((low + high) / 2);
    const candidate = await encode(buf, format, mid, copyright);
    if (candidate.length <= targetBytes) {
      best = { data: candidate, quality: mid };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (best) return { ...best, metTarget: true };
  return { data: await encode(buf, format, 1, copyright), quality: 1, metTarget: false };
}

export type RecipeResult = {
  data: Buffer;
  format: OutputFormat;
  width: number;
  height: number;
  originalSize: number;
  outputSize: number;
  note?: string;
};

export async function runRecipe(input: Buffer, recipe: Recipe): Promise<RecipeResult> {
  const meta = await sharp(input).metadata();
  const notes: string[] = [];
  if ((meta.pages || 1) > 1) notes.push("GIF animé : seule la première image est conservée");

  // rotate() sans argument applique l'orientation EXIF (photos de téléphone)
  // avant que les métadonnées ne disparaissent — sinon l'image sortirait couchée.
  let buf: Buffer = await lossless(sharp(input).rotate());
  for (const step of recipe.steps) {
    buf = await applyStep(buf, step);
  }

  // Sharp signale l'AVIF comme « heif » (compression av1)
  const source = meta.format === "heif" && meta.compression === "av1" ? "avif" : (meta.format as string);
  const format: OutputFormat =
    recipe.output.format !== "original"
      ? recipe.output.format
      : OUTPUT_FORMATS.includes(source as OutputFormat)
        ? (source as OutputFormat)
        : "png";

  let data: Buffer;
  if (recipe.output.targetSizeKB && ["jpeg", "webp", "avif"].includes(format)) {
    const r = await encodeToTarget(buf, format, recipe.output.targetSizeKB * 1024, recipe.output.copyright);
    data = r.data;
    if (!r.metTarget) notes.push(`impossible de descendre sous ${recipe.output.targetSizeKB} Ko`);
  } else {
    data = await encode(buf, format, recipe.output.quality, recipe.output.copyright);
  }

  // « Format d'origine » = garder le fichier comme il était : si un format
  // avec perte gonfle au réencodage (source déjà très compressée), on baisse
  // la qualité jusqu'à repasser sous le poids d'origine.
  if (
    recipe.output.format === "original" &&
    !recipe.output.targetSizeKB &&
    ["jpeg", "webp", "avif"].includes(format) &&
    data.length > input.length
  ) {
    for (const q of [80, 70, 60, 50]) {
      if (q >= recipe.output.quality) continue;
      const candidate = await encode(buf, format, q, recipe.output.copyright);
      if (candidate.length < data.length) data = candidate;
      if (candidate.length <= input.length) {
        notes.push(`qualité ramenée à ${q} pour ne pas dépasser le poids d'origine`);
        break;
      }
    }
  }

  const out = await sharp(data).metadata();
  return {
    data,
    format,
    width: out.width || 0,
    height: out.height || 0,
    originalSize: input.length,
    outputSize: data.length,
    note: notes.length ? notes.join(" ; ") : undefined,
  };
}

// Exécute fn sur chaque élément avec au plus `limit` traitements simultanés
export async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
