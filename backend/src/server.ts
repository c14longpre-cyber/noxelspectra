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

app.listen(PORT, () => {
  console.log(`✅ NOXEL Spectra backend running on http://localhost:${PORT}`);
});
