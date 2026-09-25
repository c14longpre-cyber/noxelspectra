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

// POST /api/convert — multipart form: file, format (jpeg|png|webp|avif|gif), quality (1-100)
app.post("/api/convert", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const format = (req.body.format || "webp") as keyof sharp.FormatEnum;
    const quality = Math.min(100, Math.max(1, parseInt(req.body.quality) || 75));

    const allowedFormats = ["jpeg", "png", "webp", "avif", "gif"];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ ok: false, error: `Unsupported format: ${format}` });
    }

    let pipeline = sharp(req.file.buffer);

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

    const outputBuffer = await pipeline.toBuffer();
    const mimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="converted.${format}"`);
    return res.send(outputBuffer);
  } catch (err) {
    console.error("Conversion error:", err);
    return res.status(500).json({ ok: false, error: "Conversion failed" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ NOXEL Spectra backend running on http://localhost:${PORT}`);
});
