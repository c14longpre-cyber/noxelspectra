import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import dotenv from "dotenv";
import archiver = require("archiver");
import toIco from "to-ico";
import { Potrace } from "potrace";

dotenv.config();

type SupportedFormat = "jpeg" | "png" | "webp" | "avif" | "gif";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return { r, g, b };
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "NOXEL Spectra", version: "0.1.0" });
});

// Formats where "quality" meaningfully controls output size — target-size search only applies here
const QUALITY_ADJUSTABLE_FORMATS = ["jpeg", "webp", "avif"];

function encodeAtQuality(
  buffer: Buffer,
  format: SupportedFormat,
  quality: number
): Promise<Buffer> {
  let pipeline = sharp(buffer);
  switch (format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality });
      break;
    case "avif":
      pipeline = pipeline.avif({ quality });
      break;
    case "png":
      pipeline = pipeline.png({ quality });
      break;
    case "gif":
      pipeline = pipeline.gif();
      break;
  }
  return pipeline.toBuffer();
}

// Binary search for the highest quality that stays under targetBytes.
// Caps at 7 iterations — enough precision (±1 quality step) without excessive re-encoding.
async function encodeToTargetSize(
  buffer: Buffer,
  format: SupportedFormat,
  targetBytes: number
): Promise<{ output: Buffer; qualityUsed: number; metTarget: boolean }> {
  let low = 1;
  let high = 100;
  let best: Buffer | null = null;
  let bestQuality = 1;

  for (let i = 0; i < 7; i++) {
    const mid = Math.floor((low + high) / 2);
    const candidate = await encodeAtQuality(buffer, format, mid);
    if (candidate.length <= targetBytes) {
      best = candidate;
      bestQuality = mid;
      low = mid + 1; // room to try higher quality, still under target
    } else {
      high = mid - 1;
    }
    if (low > high) break;
  }

  if (best) {
    return { output: best, qualityUsed: bestQuality, metTarget: true };
  }

  // Even quality=1 exceeds the target — return the smallest we can produce.
  const smallest = await encodeAtQuality(buffer, format, 1);
  return { output: smallest, qualityUsed: 1, metTarget: false };
}

// POST /api/convert — multipart form:
//   file            required
//   format          jpeg|png|webp|avif|gif
//   quality         1-100 (manual mode, ignored if targetSizeKB is set)
//   targetSizeKB    optional — auto-search for the best quality under this size
//                   (jpeg/webp/avif only; ignored for png/gif)
app.post("/api/convert", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const format = (req.body.format || "webp") as SupportedFormat;
    const allowedFormats = ["jpeg", "png", "webp", "avif", "gif"];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ ok: false, error: `Unsupported format: ${format}` });
    }

    const originalSize = req.file.size;
    const targetSizeKBRaw = req.body.targetSizeKB ? parseInt(req.body.targetSizeKB) : null;
    const useTargetSize =
      targetSizeKBRaw && targetSizeKBRaw > 0 && QUALITY_ADJUSTABLE_FORMATS.includes(format);

    let outputBuffer: Buffer;
    let qualityUsed: number;
    let metTarget = true;

    if (useTargetSize) {
      const targetBytes = targetSizeKBRaw! * 1024;
      const result = await encodeToTargetSize(req.file.buffer, format, targetBytes);
      outputBuffer = result.output;
      qualityUsed = result.qualityUsed;
      metTarget = result.metTarget;
    } else {
      const quality = Math.min(100, Math.max(1, parseInt(req.body.quality) || 75));
      outputBuffer = await encodeAtQuality(req.file.buffer, format, quality);
      qualityUsed = quality;
    }

    const mimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    const outputSize = outputBuffer.length;
    const reductionPct = Math.round((1 - outputSize / originalSize) * 100);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="converted.${format}"`);
    res.setHeader("X-Original-Size", String(originalSize));
    res.setHeader("X-Output-Size", String(outputSize));
    res.setHeader("X-Reduction-Pct", String(reductionPct));
    res.setHeader("X-Quality-Used", String(qualityUsed));
    res.setHeader("X-Met-Target", String(metTarget));
    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-Original-Size, X-Output-Size, X-Reduction-Pct, X-Quality-Used, X-Met-Target"
    );

    return res.send(outputBuffer);
  } catch (err) {
    console.error("Conversion error:", err);
    return res.status(500).json({ ok: false, error: "Conversion failed" });
  }
});

// POST /api/palette — multipart form: file, count (3-10, default 6)
// Returns dominant colors as hex + percentage of image they cover.
app.post("/api/palette", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const count = Math.min(10, Math.max(3, parseInt(req.body.count) || 6));

    // Downscale first — palette extraction doesn't need full resolution,
    // and it keeps this fast even on large uploads.
    const { data, info } = await sharp(req.file.buffer)
      .resize(200, 200, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels; // 3 (RGB) since alpha removed
    const totalPixels = data.length / channels;

    // Quantize each channel to 16 levels (4 bits) to bucket visually similar
    // colors together, then average the actual pixel values within each
    // bucket for an accurate representative color (not just the bucket center).
    const buckets = new Map();

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = (r >> 4) + "-" + (g >> 4) + "-" + (b >> 4);

      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    const allBuckets = [...buckets.values()].sort((a, b) => b.count - a.count);

    // Pure frequency ranking tends to return several near-identical dark or
    // near-identical light shades from a busy background, crowding out
    // smaller-but-visually-distinct accent colors. Greedily pick buckets
    // that are sufficiently far apart in RGB space, falling back to the
    // remaining most-frequent buckets only if the image is too monochrome
    // to fill the requested count with distinct colors.
    const MIN_DISTANCE = 70;
    const selected: { r: number; g: number; b: number; count: number }[] = [];

    for (const bucket of allBuckets) {
      if (selected.length >= count) break;
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      const isDistinct = selected.every((s) => {
        const dr = s.r - r;
        const dg = s.g - g;
        const db = s.b - b;
        return Math.sqrt(dr * dr + dg * dg + db * db) >= MIN_DISTANCE;
      });
      if (isDistinct) selected.push({ r, g, b, count: bucket.count });
    }

    if (selected.length < count) {
      for (const bucket of allBuckets) {
        if (selected.length >= count) break;
        const r = bucket.r / bucket.count;
        const g = bucket.g / bucket.count;
        const b = bucket.b / bucket.count;
        const alreadyIn = selected.some((s) => s.r === r && s.g === g && s.b === b);
        if (!alreadyIn) selected.push({ r, g, b, count: bucket.count });
      }
    }

    const palette = selected.map((s) => {
      const r = Math.round(s.r);
      const g = Math.round(s.g);
      const b = Math.round(s.b);
      const hex =
        "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
      const percent = Math.round((s.count / totalPixels) * 1000) / 10;
      return { hex, rgb: [r, g, b], percent };
    });

    return res.json({ ok: true, totalPixels, palette });
  } catch (err) {
    console.error("Palette extraction error:", err);
    return res.status(500).json({ ok: false, error: "Palette extraction failed" });
  }
});
// POST /api/resize — multipart form:
//   file             required
//   width, height    at least one required (pixels)
//   maintainAspect   "true" (default) fits inside width/height keeping ratio; "false" stretches to exact size
//   format           optional — if omitted, keeps the original format
//   quality          1-100 (default 85, ignored for png/gif)
app.post("/api/resize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const meta = await sharp(req.file.buffer).metadata();
    const originalWidth = meta.width || 0;
    const originalHeight = meta.height || 0;

    const width = req.body.width ? parseInt(req.body.width) : undefined;
    const height = req.body.height ? parseInt(req.body.height) : undefined;

    if (!width && !height) {
      return res.status(400).json({ ok: false, error: "Provide width and/or height" });
    }

    const maintainAspect = req.body.maintainAspect !== "false";

    const allowedFormats = ["jpeg", "png", "webp", "avif", "gif"];
    let format = req.body.format;
    if (!format) {
      const sourceFormat = meta.format;
      format = allowedFormats.includes(sourceFormat) ? sourceFormat : "png";
    }
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ ok: false, error: "Unsupported format: " + format });
    }

    const quality = Math.min(100, Math.max(1, parseInt(req.body.quality) || 85));

    let pipeline = sharp(req.file.buffer).resize({
      width,
      height,
      fit: maintainAspect ? "inside" : "fill",
      withoutEnlargement: false,
    });

    switch (format) {
      case "jpeg":
        pipeline = pipeline.jpeg({ quality });
        break;
      case "png":
        pipeline = pipeline.png({ quality });
        break;
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      case "avif":
        pipeline = pipeline.avif({ quality });
        break;
      case "gif":
        pipeline = pipeline.gif();
        break;
    }

    const { data: outputBuffer, info } = await pipeline.toBuffer({ resolveWithObject: true });
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/" + format;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", "attachment; filename=\"resized." + format + "\"");
    res.setHeader("X-Original-Width", String(originalWidth));
    res.setHeader("X-Original-Height", String(originalHeight));
    res.setHeader("X-Output-Width", String(info.width));
    res.setHeader("X-Output-Height", String(info.height));
    res.setHeader("X-Original-Size", String(req.file.size));
    res.setHeader("X-Output-Size", String(outputBuffer.length));
    res.setHeader(
      "Access-Control-Expose-Headers",
      "X-Original-Width, X-Original-Height, X-Output-Width, X-Output-Height, X-Original-Size, X-Output-Size"
    );

    return res.send(outputBuffer);
  } catch (err) {
    console.error("Resize error:", err);
    return res.status(500).json({ ok: false, error: "Resize failed" });
  }
});
// POST /api/favicon — multipart form: file
// Returns a ZIP containing favicon.ico + the standard PNG sizes used across web/PWA/iOS.
app.post("/api/favicon", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const sizes = [16, 32, 48, 180, 192, 512];
    const buffers = {};

    for (const size of sizes) {
      buffers[size] = await sharp(req.file.buffer)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    }

    const icoBuffer = await toIco([buffers[16], buffers[32], buffers[48]]);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="favicon-package.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);
    archive.append(icoBuffer, { name: "favicon.ico" });
    archive.append(buffers[16], { name: "favicon-16x16.png" });
    archive.append(buffers[32], { name: "favicon-32x32.png" });
    archive.append(buffers[48], { name: "favicon-48x48.png" });
    archive.append(buffers[180], { name: "apple-touch-icon.png" });
    archive.append(buffers[192], { name: "favicon-192x192.png" });
    archive.append(buffers[512], { name: "favicon-512x512.png" });
    await archive.finalize();
  } catch (err) {
    console.error("Favicon generation error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: "Favicon generation failed" });
    }
  }
});
// Traces a single boolean mask (0/255 grayscale) into an SVG <path> filled with the given color.
// Wrapped as a Promise since potrace only offers a callback API.
function traceMaskToPathTag(maskPngBuffer: Buffer, fillColor: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const tracer = new Potrace();
    tracer.setParameters({
      threshold: 128,
      turdSize: 2,
      optCurve: true,
      alphaMax: 1,
      optTolerance: 0.15,
      color: fillColor,
      background: "transparent",
    });
    tracer.loadImage(maskPngBuffer, (err) => {
      if (err) return reject(err);
      try {
        resolve(tracer.getPathTag(fillColor) as string);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// POST /api/vectorize — multipart form: file, colors (2-16, default 6)
// Extracts the dominant colors, builds one black/white mask per color (pixels
// nearest to that color become white / traceable foreground), traces each mask
// with potrace, and combines the resulting paths into a single multi-color SVG.
app.post("/api/vectorize", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const colorCount = Math.min(16, Math.max(2, parseInt(req.body.colors) || 6));
    const cleanup = req.body.cleanup !== "false";

    // Downscale before tracing — potrace cost and output complexity both grow
    // fast with resolution, and this feature targets logos/simple graphics.
    const MAX_DIM = 900;
    const { data, info } = await sharp(req.file.buffer)
      .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    const pixelCount = width * height;

    // Step 1 — bucket pixels into coarse color groups (same approach as /api/palette).
    const ALPHA_THRESHOLD = 128;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += channels) {
      if (data[i + 3] < ALPHA_THRESHOLD) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = (r >> 4) + "-" + (g >> 4) + "-" + (b >> 4);
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    const allBuckets = [...buckets.values()].sort((a, b) => b.count - a.count);

    // Step 2 — greedily pick diverse representative colors (avoids colorCount
    // near-duplicate dark shades crowding out visually distinct accent colors).
    const MIN_DISTANCE = 45;
    const palette: { r: number; g: number; b: number }[] = [];
    for (const bucket of allBuckets) {
      if (palette.length >= colorCount) break;
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      const isDistinct = palette.every((p) => {
        const dr = p.r - r;
        const dg = p.g - g;
        const db = p.b - b;
        return Math.sqrt(dr * dr + dg * dg + db * db) >= MIN_DISTANCE;
      });
      if (isDistinct) palette.push({ r, g, b });
    }
    if (palette.length < colorCount) {
      for (const bucket of allBuckets) {
        if (palette.length >= colorCount) break;
        const r = bucket.r / bucket.count;
        const g = bucket.g / bucket.count;
        const b = bucket.b / bucket.count;
        const already = palette.some((p) => p.r === r && p.g === g && p.b === b);
        if (!already) palette.push({ r, g, b });
      }
    }

    // Step 3 — assign every pixel to its nearest palette color.
    // Refine the palette with a few Lloyd's-algorithm iterations over the
    // bucketed pixel data — each pass reassigns buckets to their nearest
    // current color and recomputes that color as the true weighted average,
    // converging on cleaner, more accurate cluster colors than the initial
    // frequency-based picks alone.
    const KMEANS_ITERATIONS = 5;
    for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
      const sums = palette.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
      for (const bucket of allBuckets) {
        const br = bucket.r / bucket.count;
        const bg = bucket.g / bucket.count;
        const bb = bucket.b / bucket.count;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let c = 0; c < palette.length; c++) {
          const dr = palette[c].r - br;
          const dg = palette[c].g - bg;
          const db = palette[c].b - bb;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = c;
          }
        }
        sums[bestIdx].r += bucket.r;
        sums[bestIdx].g += bucket.g;
        sums[bestIdx].b += bucket.b;
        sums[bestIdx].weight += bucket.count;
      }
      for (let c = 0; c < palette.length; c++) {
        if (sums[c].weight > 0) {
          palette[c] = {
            r: sums[c].r / sums[c].weight,
            g: sums[c].g / sums[c].weight,
            b: sums[c].b / sums[c].weight,
          };
        }
      }
    }

    // If the client supplied edited colors (after reviewing the auto-detected
    // palette), use those exactly instead of the auto-computed ones.
    if (req.body.palette) {
      try {
        const userColors = JSON.parse(req.body.palette);
        if (Array.isArray(userColors) && userColors.length > 0) {
          palette.length = 0;
          for (const hex of userColors) {
            palette.push(hexToRgb(hex));
          }
        }
      } catch {
        // Ignore malformed palette overrides and keep the auto-detected one.
      }
    }

    const assignments = new Int16Array(pixelCount);
    for (let p = 0; p < pixelCount; p++) {
      const i = p * channels;
      if (data[i + 3] < ALPHA_THRESHOLD) {
        assignments[p] = -1;
        continue;
      }
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < palette.length; c++) {
        const dr = palette[c].r - r;
        const dg = palette[c].g - g;
        const db = palette[c].b - b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }
      assignments[p] = bestIdx;
    }

    // Step 4 — for each palette color, build a mask PNG (white = this color,
    // black = elsewhere) and trace it with potrace into a filled <path>.
    const pathTags: string[] = [];
    for (let c = 0; c < palette.length; c++) {
      const mask = Buffer.alloc(pixelCount);
      for (let p = 0; p < pixelCount; p++) {
        mask[p] = assignments[p] === c ? 0 : 255;
      }
      const maskPng = await sharp(mask, { raw: { width, height, channels: 1 } })
        .blur(0.4)
        .png()
        .toBuffer();

      const hex =
        "#" +
        [palette[c].r, palette[c].g, palette[c].b]
          .map((v) => Math.round(v).toString(16).padStart(2, "0"))
          .join("");

      try {
        const pathTag = await traceMaskToPathTag(maskPng, hex);
        pathTags.push(pathTag);
      } catch (traceErr) {
        console.error("Trace failed for one color layer, skipping:", traceErr);
      }
    }

    let svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      width +
      " " +
      height +
      '">' +
      pathTags.join("") +
      "</svg>";

    if (cleanup) {
      svg = svg
        .replace(/(\d+\.\d{3,})/g, (m) => parseFloat(m).toFixed(2))
        .replace(/>\s+</g, "><");
    }

    return res.json({ ok: true, width, height, colorsUsed: palette.length, svg });
  } catch (err) {
    console.error("Vectorize error:", err);
    return res.status(500).json({ ok: false, error: "Vectorization failed" });
  }
});
// POST /api/vectorize-colors — multipart form: file, colors (2-16, default 6)
// Runs the same color-detection pipeline as /api/vectorize (bucket +
// diversity selection + k-means refinement) but returns only the palette,
// skipping the slow tracing step — lets the client review/edit colors first.
app.post("/api/vectorize-colors", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const colorCount = Math.min(16, Math.max(2, parseInt(req.body.colors) || 6));

    const MAX_DIM = 900;
    const { data, info } = await sharp(req.file.buffer)
      .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    const ALPHA_THRESHOLD = 128;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += channels) {
      if (data[i + 3] < ALPHA_THRESHOLD) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = (r >> 4) + "-" + (g >> 4) + "-" + (b >> 4);
      const existing = buckets.get(key);
      if (existing) {
        existing.count++;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        buckets.set(key, { count: 1, r, g, b });
      }
    }

    const allBuckets = [...buckets.values()].sort((a, b) => b.count - a.count);

    const MIN_DISTANCE = 45;
    const palette: { r: number; g: number; b: number }[] = [];
    for (const bucket of allBuckets) {
      if (palette.length >= colorCount) break;
      const r = bucket.r / bucket.count;
      const g = bucket.g / bucket.count;
      const b = bucket.b / bucket.count;
      const isDistinct = palette.every((p) => {
        const dr = p.r - r;
        const dg = p.g - g;
        const db = p.b - b;
        return Math.sqrt(dr * dr + dg * dg + db * db) >= MIN_DISTANCE;
      });
      if (isDistinct) palette.push({ r, g, b });
    }
    if (palette.length < colorCount) {
      for (const bucket of allBuckets) {
        if (palette.length >= colorCount) break;
        const r = bucket.r / bucket.count;
        const g = bucket.g / bucket.count;
        const b = bucket.b / bucket.count;
        const already = palette.some((p) => p.r === r && p.g === g && p.b === b);
        if (!already) palette.push({ r, g, b });
      }
    }

    const KMEANS_ITERATIONS = 5;
    for (let iter = 0; iter < KMEANS_ITERATIONS; iter++) {
      const sums = palette.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
      for (const bucket of allBuckets) {
        const br = bucket.r / bucket.count;
        const bg = bucket.g / bucket.count;
        const bb = bucket.b / bucket.count;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let c = 0; c < palette.length; c++) {
          const dr = palette[c].r - br;
          const dg = palette[c].g - bg;
          const db = palette[c].b - bb;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = c;
          }
        }
        sums[bestIdx].r += bucket.r;
        sums[bestIdx].g += bucket.g;
        sums[bestIdx].b += bucket.b;
        sums[bestIdx].weight += bucket.count;
      }
      for (let c = 0; c < palette.length; c++) {
        if (sums[c].weight > 0) {
          palette[c] = {
            r: sums[c].r / sums[c].weight,
            g: sums[c].g / sums[c].weight,
            b: sums[c].b / sums[c].weight,
          };
        }
      }
    }

    const result = palette.map((p) => {
      const r = Math.round(p.r);
      const g = Math.round(p.g);
      const b = Math.round(p.b);
      const hex =
        "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      return { hex, rgb: [r, g, b] };
    });

    return res.json({ ok: true, width, height, palette: result });
  } catch (err) {
    console.error("Vectorize color-preview error:", err);
    return res.status(500).json({ ok: false, error: "Color detection failed" });
  }
});
// POST /api/analyze — multipart form: file
// Real analysis, not guesses: actually encodes the image into several
// candidate formats (WebP, AVIF, and JPEG or PNG depending on alpha),
// measures the real output size of each, and recommends the smallest.
// Also flags simple-graphic images (good vectorize candidates) and
// stripped-out-EXIF/ICC savings.
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const meta = await sharp(req.file.buffer).metadata();
    const originalSize = req.file.size;
    const hasAlpha = !!meta.hasAlpha;
    const width = meta.width || 0;
    const height = meta.height || 0;
    const sourceFormat = meta.format || "unknown";

    const metadataOverheadBytes =
      (meta.exif ? meta.exif.length : 0) +
      (meta.icc ? meta.icc.length : 0) +
      (meta.iptc ? meta.iptc.length : 0) +
      (meta.xmp ? meta.xmp.length : 0);

    // Downscaled working copy for fast color-complexity analysis.
    const ANALYZE_MAX_DIM = 400;
    const { data, info } = await sharp(req.file.buffer)
      .resize(ANALYZE_MAX_DIM, ANALYZE_MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels;
    const ALPHA_THRESHOLD = 128;
    const buckets = new Set();
    let opaqueCount = 0;
    for (let i = 0; i < data.length; i += channels) {
      if (data[i + 3] < ALPHA_THRESHOLD) continue;
      opaqueCount++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      buckets.add((r >> 4) + "-" + (g >> 4) + "-" + (b >> 4));
    }
    const distinctColorBuckets = buckets.size;
    const complexityRatio = opaqueCount > 0 ? distinctColorBuckets / opaqueCount : 0;
    const isSimpleGraphic = distinctColorBuckets <= 48 || complexityRatio < 0.02;
    const imageType = isSimpleGraphic ? "graphic" : "photo";

    // Real candidate encodes — actual bytes, not estimates.
    const testFormats: { format: SupportedFormat; quality: number }[] = [
      { format: "webp", quality: 80 },
      { format: "avif", quality: 75 },
    ];
    if (!hasAlpha) testFormats.push({ format: "jpeg", quality: 80 });
    if (hasAlpha) testFormats.push({ format: "png", quality: 90 });

    const candidates: { format: string; quality: number; size: number; savingsPercent: number }[] = [];
    for (const t of testFormats) {
      try {
        const out = await encodeAtQuality(req.file.buffer, t.format, t.quality);
        candidates.push({
          format: t.format,
          quality: t.quality,
          size: out.length,
          savingsPercent: Math.round((1 - out.length / originalSize) * 1000) / 10,
        });
      } catch (e) {
        console.error("Analyze: skipping format " + t.format, e);
      }
    }
    candidates.sort((a, b) => a.size - b.size);
    const recommendation = candidates[0] || null;

    const notes: string[] = [];
    if (metadataOverheadBytes > 5000) {
      notes.push(
        Math.round(metadataOverheadBytes / 1024) +
          " KB of embedded metadata (EXIF/ICC/etc.) could be stripped."
      );
    }
    if (isSimpleGraphic && hasAlpha) {
      notes.push(
        "This looks like a simple graphic or logo — vectorizing to SVG may give an even smaller, infinitely scalable result. Try the Vectorizer."
      );
    }
    if (sourceFormat === "png" && imageType === "photo") {
      notes.push(
        "This PNG looks photographic — PNG's lossless compression is likely making the file much larger than necessary."
      );
    }

    return res.json({
      ok: true,
      sourceFormat,
      width,
      height,
      originalSize,
      hasAlpha,
      imageType,
      metadataOverheadBytes,
      recommendation,
      alternatives: candidates,
      notes,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return res.status(500).json({ ok: false, error: "Analysis failed" });
  }
});
app.listen(PORT, () => {
  console.log(`✅ NOXEL Spectra backend running on http://localhost:${PORT}`);
});
