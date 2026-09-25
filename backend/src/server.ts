import express from "express";
import cors from "cors";
import multer from "multer";
import sharp from "sharp";
import dotenv from "dotenv";

dotenv.config();

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
  format: keyof sharp.FormatEnum,
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
  format: keyof sharp.FormatEnum,
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

    const format = (req.body.format || "webp") as keyof sharp.FormatEnum;
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
    const selected = [];

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
app.listen(PORT, () => {
  console.log(`✅ NOXEL Spectra backend running on http://localhost:${PORT}`);
});
