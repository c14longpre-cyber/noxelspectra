import { useEffect, useRef, useState } from "react";
import "./App.css";
import { OverlayEditor } from "./components/spectra-editor/OverlayEditor";
import { GradientTool } from "./components/spectra-gradient/GradientTool";

const FORMATS = ["webp", "avif", "jpeg", "png", "gif"] as const;
type Format = (typeof FORMATS)[number];

const TARGET_SIZE_FORMATS: Format[] = ["jpeg", "webp", "avif"];

type SocialPreset = { label: string; width: number; height: number };

const SOCIAL_PRESETS: Record<string, SocialPreset[]> = {
  Facebook: [
    { label: "Photo de profil", width: 320, height: 320 },
    { label: "Photo de couverture", width: 820, height: 312 },
    { label: "Image de publication", width: 1200, height: 630 },
    { label: "Couverture d'événement", width: 1920, height: 1005 },
  ],
  Instagram: [
    { label: "Photo de profil", width: 320, height: 320 },
    { label: "Publication (carré)", width: 1080, height: 1080 },
    { label: "Story / Reel", width: 1080, height: 1920 },
  ],
  YouTube: [
    { label: "Icône de chaîne", width: 800, height: 800 },
    { label: "Bannière de chaîne", width: 2560, height: 1440 },
    { label: "Vignette de vidéo", width: 1280, height: 720 },
  ],
  TikTok: [
    { label: "Photo de profil", width: 200, height: 200 },
    { label: "Vidéo", width: 1080, height: 1920 },
  ],
  LinkedIn: [
    { label: "Photo de profil (personnel)", width: 400, height: 400 },
    { label: "Bannière (personnel)", width: 1584, height: 396 },
    { label: "Logo d'entreprise", width: 300, height: 300 },
    { label: "Bannière d'entreprise", width: 1128, height: 191 },
  ],
  "X (Twitter)": [
    { label: "Photo de profil", width: 400, height: 400 },
    { label: "Bannière d'en-tête", width: 1500, height: 500 },
    { label: "Image de publication", width: 1200, height: 675 },
  ],
  Pinterest: [
    { label: "Photo de profil", width: 165, height: 165 },
    { label: "Épingle", width: 1000, height: 1500 },
  ],
};

type ConversionStats = {
  originalSize: number;
  outputSize: number;
  reductionPct: number;
  qualityUsed: number;
  metTarget: boolean;
};

type PaletteColor = {
  hex: string;
  rgb: [number, number, number];
  percent: number;
};

type ResizeStats = {
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  originalSize: number;
  outputSize: number;
};

type VectorizeMeta = {
  width: number;
  height: number;
  colorsUsed: number;
};

type AnalyzeCandidate = {
  format: string;
  quality: number;
  size: number;
  savingsPercent: number;
};

type AnalyzeResult = {
  sourceFormat: string;
  width: number;
  height: number;
  originalSize: number;
  hasAlpha: boolean;
  imageType: "graphic" | "photo";
  metadataOverheadBytes: number;
  recommendation: AnalyzeCandidate | null;
  alternatives: AnalyzeCandidate[];
  notes: string[];
};

type MetaCleanStats = {
  originalSize: number;
  outputSize: number;
  bytesRemoved: number;
  grewLarger: boolean;
};

type RotateDims = {
  width: number;
  height: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} Ko`;
  return `${(kb / 1024).toFixed(2)} Mo`;
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  const cleaned = trimmed.replace(/[\\/:*?"<>|]/g, "").replace(/\.svg$/i, "");
  return cleaned || "vectorized";
}

function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  checkered = false,
}: {
  beforeUrl: string;
  afterUrl: string;
  checkered?: boolean;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  function updatePos(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    setPos(pct);
  }

  function handlePointerDown(e: React.PointerEvent) {
    dragging.current = true;
    updatePos(e.clientX);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    updatePos(e.clientX);
  }
  function handlePointerUp() {
    dragging.current = false;
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "relative",
        width: "100%",
        cursor: "ew-resize",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #ddd",
        touchAction: "none",
        background: checkered
          ? "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px"
          : undefined,
      }}
    >
      <img
        src={beforeUrl}
        alt="Avant"
        draggable={false}
        style={{ display: "block", width: "100%", height: "auto" }}
      />
      <img
        src={afterUrl}
        alt="Après"
        draggable={false}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          clipPath: `inset(0 0 0 ${pos}%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${pos}%`,
          width: 2,
          background: "#fff",
          boxShadow: "0 0 4px rgba(0,0,0,0.6)",
          transform: "translateX(-1px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${pos}%`,
          transform: "translate(-50%, -50%)",
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#fff",
          border: "2px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        }}
      >
        ↔
      </div>
      <span
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 4,
        }}
      >
        Avant
      </span>
      <span
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 4,
        }}
      >
        Après
      </span>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("webp");
  const [mode, setMode] = useState<"quality" | "targetSize">("quality");
  const [quality, setQuality] = useState(75);
  const [targetSizeKB, setTargetSizeKB] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ConversionStats | null>(null);

  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const convertSectionRef = useRef<HTMLDivElement | null>(null);
  const analyzeSectionRef = useRef<HTMLDivElement | null>(null);
  const resizeSectionRef = useRef<HTMLDivElement | null>(null);
  const cropSectionRef = useRef<HTMLDivElement | null>(null);
  const rotateSectionRef = useRef<HTMLDivElement | null>(null);
  const adjustSectionRef = useRef<HTMLDivElement | null>(null);
  const responsiveSectionRef = useRef<HTMLDivElement | null>(null);
  const paletteSectionRef = useRef<HTMLDivElement | null>(null);
  const vectorizeSectionRef = useRef<HTMLDivElement | null>(null);
  const faviconSectionRef = useRef<HTMLDivElement | null>(null);
  const metaCleanSectionRef = useRef<HTMLDivElement | null>(null);
  const shadowSectionRef = useRef<HTMLDivElement | null>(null);
  const glowSectionRef = useRef<HTMLDivElement | null>(null);
  const socialSectionRef = useRef<HTMLDivElement | null>(null);
  const editorSectionRef = useRef<HTMLDivElement | null>(null);
  const gradientSectionRef = useRef<HTMLDivElement | null>(null);
  const watermarkSectionRef = useRef<HTMLDivElement | null>(null);
  const copyrightSectionRef = useRef<HTMLDivElement | null>(null);

  const [activeSection, setActiveSection] = useState("analyze");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const NAV_ITEMS: { id: string; label: string; icon: string; ref: React.RefObject<HTMLDivElement | null> }[] = [
    { id: "analyze", label: "Analyser", icon: "⌁", ref: analyzeSectionRef },
    { id: "convert", label: "Convertir", icon: "↔", ref: convertSectionRef },
    { id: "resize", label: "Redimensionner", icon: "⤢", ref: resizeSectionRef },
    { id: "crop", label: "Rogner", icon: "⊡", ref: cropSectionRef },
    { id: "rotate", label: "Rotation / Miroir", icon: "↻", ref: rotateSectionRef },
    { id: "adjust", label: "Filtres / Réglages", icon: "☷", ref: adjustSectionRef },
    { id: "responsive", label: "Tailles responsives", icon: "▣", ref: responsiveSectionRef },
    { id: "palette", label: "Palette de couleurs", icon: "◉", ref: paletteSectionRef },
    { id: "vectorize", label: "Vectoriser", icon: "◇", ref: vectorizeSectionRef },
    { id: "favicon", label: "Favicons", icon: "☆", ref: faviconSectionRef },
    { id: "metaclean", label: "Nettoyer les métadonnées", icon: "▤", ref: metaCleanSectionRef },
    { id: "shadow", label: "Ombre portée", icon: "▢", ref: shadowSectionRef },
    { id: "glow", label: "Effet lumineux", icon: "☼", ref: glowSectionRef },
    { id: "social", label: "Réseaux sociaux", icon: "⚑", ref: socialSectionRef },
    { id: "editor", label: "Éditeur", icon: "✎", ref: editorSectionRef },
    { id: "gradient", label: "Dégradé", icon: "◐", ref: gradientSectionRef },
    { id: "watermark", label: "Filigrane", icon: "⛆", ref: watermarkSectionRef },
    { id: "copyright", label: "Copyright", icon: "©", ref: copyrightSectionRef },
  ];

  function goToSection(id: string) {
    setActiveSection(id);
    setSidebarOpen(false);
  }

  const [paletteCount, setPaletteCount] = useState(6);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteColor[] | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const [resizeWidth, setResizeWidth] = useState<string>("");
  const [resizeHeight, setResizeHeight] = useState<string>("");
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [resizeFormat, setResizeFormat] = useState<"original" | Format>("original");
  const [resizeLoading, setResizeLoading] = useState(false);
  const [resizeError, setResizeError] = useState<string | null>(null);
  const [resizeResultUrl, setResizeResultUrl] = useState<string | null>(null);
  const [resizeStats, setResizeStats] = useState<ResizeStats | null>(null);

  const [responsiveFormat, setResponsiveFormat] = useState<Format>("webp");
  const [responsiveQuality, setResponsiveQuality] = useState(80);
  const [responsiveLoading, setResponsiveLoading] = useState(false);
  const [responsiveError, setResponsiveError] = useState<string | null>(null);
  const [responsiveResultUrl, setResponsiveResultUrl] = useState<string | null>(null);
  const [responsiveSrcset, setResponsiveSrcset] = useState<string | null>(null);
  const [responsiveSizes, setResponsiveSizes] = useState<string | null>(null);
  const [srcsetCopied, setSrcsetCopied] = useState(false);

  const [vectorizeColors, setVectorizeColors] = useState(6);
  const [vectorizeFilename, setVectorizeFilename] = useState("vectorized");
  const [vectorizeLoading, setVectorizeLoading] = useState(false);
  const [vectorizeError, setVectorizeError] = useState<string | null>(null);
  const [vectorizeSvg, setVectorizeSvg] = useState<string | null>(null);
  const [vectorizeMeta, setVectorizeMeta] = useState<VectorizeMeta | null>(null);
  const [vectorizeSvgUrl, setVectorizeSvgUrl] = useState<string | null>(null);

  const [detectedColors, setDetectedColors] = useState<string[] | null>(null);
  const [editedColors, setEditedColors] = useState<string[]>([]);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [faviconLoading, setFaviconLoading] = useState(false);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconResultUrl, setFaviconResultUrl] = useState<string | null>(null);

  const [metaCleanLoading, setMetaCleanLoading] = useState(false);
  const [metaCleanError, setMetaCleanError] = useState<string | null>(null);
  const [metaCleanResultUrl, setMetaCleanResultUrl] = useState<string | null>(null);
  const [metaCleanStats, setMetaCleanStats] = useState<MetaCleanStats | null>(null);

  const [rotateAngle, setRotateAngle] = useState(0);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [rotateLoading, setRotateLoading] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateResultUrl, setRotateResultUrl] = useState<string | null>(null);
  const [rotateDims, setRotateDims] = useState<RotateDims | null>(null);

  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [sharpenAmount, setSharpenAmount] = useState(0);
  const [blurAmount, setBlurAmount] = useState(0);
  const [effect, setEffect] = useState<"none" | "grayscale" | "sepia">("none");
  const [invertColors, setInvertColors] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustResultUrl, setAdjustResultUrl] = useState<string | null>(null);
  const [filtersTouched, setFiltersTouched] = useState(false);
  const [pixelateSize, setPixelateSize] = useState(0);
  const [reduceNoise, setReduceNoise] = useState(0);
  const [vignetteIntensity, setVignetteIntensity] = useState(0);
  const [quantizeColors, setQuantizeColors] = useState(0);

  const [shadowOffsetX, setShadowOffsetX] = useState(15);
  const [shadowOffsetY, setShadowOffsetY] = useState(15);
  const [shadowBlur, setShadowBlur] = useState(8);
  const [shadowOpacity, setShadowOpacity] = useState(60);
  const [shadowLoading, setShadowLoading] = useState(false);
  const [shadowError, setShadowError] = useState<string | null>(null);
  const [shadowResultUrl, setShadowResultUrl] = useState<string | null>(null);

  const [glowIntensity, setGlowIntensity] = useState(12);
  const [glowLoading, setGlowLoading] = useState(false);
  const [glowError, setGlowError] = useState<string | null>(null);
  const [glowResultUrl, setGlowResultUrl] = useState<string | null>(null);

  const [watermarkType, setWatermarkType] = useState<"text" | "logo">("text");
  const [watermarkText, setWatermarkText] = useState("NOXEL");
  const [watermarkColor, setWatermarkColor] = useState("#ffffff");
  const [watermarkLogoFile, setWatermarkLogoFile] = useState<File | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(60);
  const [watermarkSize, setWatermarkSize] = useState(0);
  const [watermarkLoading, setWatermarkLoading] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const [watermarkResultUrl, setWatermarkResultUrl] = useState<string | null>(null);

  const [copyrightAuthor, setCopyrightAuthor] = useState("");
  const [copyrightText, setCopyrightText] = useState("");
  const [copyrightLoading, setCopyrightLoading] = useState(false);
  const [copyrightError, setCopyrightError] = useState<string | null>(null);
  const [copyrightResultUrl, setCopyrightResultUrl] = useState<string | null>(null);

  const [socialPlatform, setSocialPlatform] = useState<string>(Object.keys(SOCIAL_PRESETS)[0]);
  const [socialPresetIndex, setSocialPresetIndex] = useState(0);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialResultUrl, setSocialResultUrl] = useState<string | null>(null);
  const [socialStats, setSocialStats] = useState<ResizeStats | null>(null);

  const [cropNaturalWidth, setCropNaturalWidth] = useState(0);
  const [cropNaturalHeight, setCropNaturalHeight] = useState(0);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(0);
  const [cropHeight, setCropHeight] = useState(0);
  const [cropLoading, setCropLoading] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [cropResultUrl, setCropResultUrl] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const targetSizeAvailable = TARGET_SIZE_FORMATS.includes(format);

  useEffect(() => {
    if (!vectorizeSvg) {
      setVectorizeSvgUrl(null);
      return;
    }
    const blob = new Blob([vectorizeSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    setVectorizeSvgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [vectorizeSvg]);

  function handleFileChange(f: File | null) {
    setFile(f);
    setOriginalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setResultUrl(null);
    setStats(null);
    setPalette(null);
    setError(null);
    setPaletteError(null);
    setResizeResultUrl(null);
    setResizeStats(null);
    setResizeError(null);
    setVectorizeSvg(null);
    setVectorizeMeta(null);
    setVectorizeError(null);
    setDetectedColors(null);
    setEditedColors([]);
    setDetectError(null);
    setFaviconResultUrl(null);
    setFaviconError(null);
    setAnalyzeResult(null);
    setAnalyzeError(null);
    setResponsiveResultUrl(null);
    setResponsiveSrcset(null);
    setResponsiveSizes(null);
    setResponsiveError(null);
    setMetaCleanResultUrl(null);
    setMetaCleanStats(null);
    setMetaCleanError(null);
    setRotateResultUrl(null);
    setRotateDims(null);
    setRotateError(null);
    setAdjustResultUrl(null);
    setAdjustError(null);
    setFiltersTouched(false);
    setCropResultUrl(null);
    setCropError(null);
    setCropNaturalWidth(0);
    setCropNaturalHeight(0);
    setCropX(0);
    setCropY(0);
    setCropWidth(0);
    setCropHeight(0);
    setShadowResultUrl(null);
    setShadowError(null);
    setGlowResultUrl(null);
    setGlowError(null);
    setSocialResultUrl(null);
    setSocialError(null);
    setSocialStats(null);
    setWatermarkResultUrl(null);
    setWatermarkError(null);
    setCopyrightResultUrl(null);
    setCopyrightError(null);
  }

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzeLoading(true);
    setAnalyzeError(null);
    setAnalyzeResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setAnalyzeResult(data);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analyse échouée");
    } finally {
      setAnalyzeLoading(false);
    }
  }

  function applyRecommendation() {
    if (!analyzeResult?.recommendation) return;
    const rec = analyzeResult.recommendation;
    if ((FORMATS as readonly string[]).includes(rec.format)) {
      setFormat(rec.format as Format);
    }
    setMode("quality");
    setQuality(rec.quality);
    setActiveSection("convert");
  }

  async function handleConvert() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultUrl(null);
    setStats(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", format);

    if (mode === "targetSize" && targetSizeAvailable) {
      formData.append("targetSizeKB", String(targetSizeKB));
    } else {
      formData.append("quality", String(quality));
    }

    try {
      const res = await fetch(`${apiUrl}/api/convert`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const originalSize = Number(res.headers.get("X-Original-Size") || file.size);
      const outputSize = Number(res.headers.get("X-Output-Size") || 0);
      const reductionPct = Number(res.headers.get("X-Reduction-Pct") || 0);
      const qualityUsed = Number(res.headers.get("X-Quality-Used") || quality);
      const metTarget = res.headers.get("X-Met-Target") !== "false";

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setStats({ originalSize, outputSize, reductionPct, qualityUsed, metTarget });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion échouée");
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractPalette() {
    if (!file) return;
    setPaletteLoading(true);
    setPaletteError(null);
    setPalette(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("count", String(paletteCount));

    try {
      const res = await fetch(`${apiUrl}/api/palette`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setPalette(data.palette);
    } catch (err) {
      setPaletteError(err instanceof Error ? err.message : "Extraction échouée");
    } finally {
      setPaletteLoading(false);
    }
  }

  async function handleResize() {
    if (!file) return;
    if (!resizeWidth && !resizeHeight) {
      setResizeError("Indique au moins une largeur ou une hauteur");
      return;
    }

    setResizeLoading(true);
    setResizeError(null);
    setResizeResultUrl(null);
    setResizeStats(null);

    const formData = new FormData();
    formData.append("file", file);
    if (resizeWidth) formData.append("width", resizeWidth);
    if (resizeHeight) formData.append("height", resizeHeight);
    formData.append("maintainAspect", String(maintainAspect));
    if (resizeFormat !== "original") formData.append("format", resizeFormat);

    try {
      const res = await fetch(`${apiUrl}/api/resize`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const originalWidth = Number(res.headers.get("X-Original-Width") || 0);
      const originalHeight = Number(res.headers.get("X-Original-Height") || 0);
      const outputWidth = Number(res.headers.get("X-Output-Width") || 0);
      const outputHeight = Number(res.headers.get("X-Output-Height") || 0);
      const originalSize = Number(res.headers.get("X-Original-Size") || file.size);
      const outputSize = Number(res.headers.get("X-Output-Size") || 0);

      const blob = await res.blob();
      setResizeResultUrl(URL.createObjectURL(blob));
      setResizeStats({ originalWidth, originalHeight, outputWidth, outputHeight, originalSize, outputSize });
    } catch (err) {
      setResizeError(err instanceof Error ? err.message : "Redimensionnement échoué");
    } finally {
      setResizeLoading(false);
    }
  }

  async function handleGenerateResponsive() {
    if (!file) return;
    setResponsiveLoading(true);
    setResponsiveError(null);
    setResponsiveResultUrl(null);
    setResponsiveSrcset(null);
    setResponsiveSizes(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", responsiveFormat);
    formData.append("quality", String(responsiveQuality));

    try {
      const res = await fetch(`${apiUrl}/api/responsive`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const srcsetHeader = res.headers.get("X-Srcset");
      const sizesHeader = res.headers.get("X-Sizes-Generated");

      const blob = await res.blob();
      setResponsiveResultUrl(URL.createObjectURL(blob));
      setResponsiveSrcset(srcsetHeader ? decodeURIComponent(srcsetHeader) : null);
      setResponsiveSizes(sizesHeader);
    } catch (err) {
      setResponsiveError(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setResponsiveLoading(false);
    }
  }

  function copySrcset() {
    if (!responsiveSrcset) return;
    navigator.clipboard.writeText(responsiveSrcset).then(() => {
      setSrcsetCopied(true);
      setTimeout(() => setSrcsetCopied(false), 1200);
    });
  }

  async function handleDetectColors() {
    if (!file) return;
    setDetectLoading(true);
    setDetectError(null);
    setDetectedColors(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("colors", String(vectorizeColors));

    try {
      const res = await fetch(`${apiUrl}/api/vectorize-colors`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const hexes: string[] = data.palette.map((c: { hex: string }) => c.hex);
      setDetectedColors(hexes);
      setEditedColors(hexes);
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : "Détection échouée");
    } finally {
      setDetectLoading(false);
    }
  }

  function updateEditedColor(index: number, value: string) {
    setEditedColors((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function resetEditedColors() {
    if (detectedColors) setEditedColors(detectedColors);
  }

  async function handleVectorize() {
    if (!file) return;
    setVectorizeLoading(true);
    setVectorizeError(null);
    setVectorizeSvg(null);
    setVectorizeMeta(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("colors", String(vectorizeColors));
    if (detectedColors && editedColors.length > 0) {
      formData.append("palette", JSON.stringify(editedColors));
    }

    try {
      const res = await fetch(`${apiUrl}/api/vectorize`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setVectorizeSvg(data.svg);
      setVectorizeMeta({ width: data.width, height: data.height, colorsUsed: data.colorsUsed });
    } catch (err) {
      setVectorizeError(err instanceof Error ? err.message : "Vectorisation échouée");
    } finally {
      setVectorizeLoading(false);
    }
  }

  function downloadVectorizedSvg() {
    if (!vectorizeSvg) return;
    const blob = new Blob([vectorizeSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(vectorizeFilename)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleGenerateFavicons() {
    if (!file) return;
    setFaviconLoading(true);
    setFaviconError(null);
    setFaviconResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/api/favicon`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setFaviconResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setFaviconLoading(false);
    }
  }

  async function handleStripMetadata() {
    if (!file) return;
    setMetaCleanLoading(true);
    setMetaCleanError(null);
    setMetaCleanResultUrl(null);
    setMetaCleanStats(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/api/strip-metadata`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const originalSize = Number(res.headers.get("X-Original-Size") || file.size);
      const outputSize = Number(res.headers.get("X-Output-Size") || 0);
      const bytesRemoved = Number(res.headers.get("X-Metadata-Bytes-Removed") || 0);
      const grewLarger = res.headers.get("X-Grew-Larger") === "true";

      const blob = await res.blob();
      setMetaCleanResultUrl(URL.createObjectURL(blob));
      setMetaCleanStats({ originalSize, outputSize, bytesRemoved, grewLarger });
    } catch (err) {
      setMetaCleanError(err instanceof Error ? err.message : "Nettoyage échoué");
    } finally {
      setMetaCleanLoading(false);
    }
  }

  async function handleApplySocialPreset() {
    if (!file) return;
    const preset = SOCIAL_PRESETS[socialPlatform][socialPresetIndex];
    if (!preset) return;

    setSocialLoading(true);
    setSocialError(null);
    setSocialResultUrl(null);
    setSocialStats(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("width", String(preset.width));
    formData.append("height", String(preset.height));
    formData.append("maintainAspect", "false");

    try {
      const res = await fetch(`${apiUrl}/api/resize`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const originalWidth = Number(res.headers.get("X-Original-Width") || 0);
      const originalHeight = Number(res.headers.get("X-Original-Height") || 0);
      const outputWidth = Number(res.headers.get("X-Output-Width") || 0);
      const outputHeight = Number(res.headers.get("X-Output-Height") || 0);
      const originalSize = Number(res.headers.get("X-Original-Size") || file.size);
      const outputSize = Number(res.headers.get("X-Output-Size") || 0);

      const blob = await res.blob();
      setSocialResultUrl(URL.createObjectURL(blob));
      setSocialStats({ originalWidth, originalHeight, outputWidth, outputHeight, originalSize, outputSize });
    } catch (err) {
      setSocialError(err instanceof Error ? err.message : "Redimensionnement échoué");
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleGlow() {
    if (!file) return;
    setGlowLoading(true);
    setGlowError(null);
    setGlowResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("intensity", String(glowIntensity));

    try {
      const res = await fetch(`${apiUrl}/api/glow`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setGlowResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setGlowError(err instanceof Error ? err.message : "Effet lumineux échoué");
    } finally {
      setGlowLoading(false);
    }
  }

  async function handleWatermark() {
    if (!file) return;
    setWatermarkLoading(true);
    setWatermarkError(null);
    setWatermarkResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", watermarkType);
    formData.append("position", watermarkPosition);
    formData.append("opacity", String(watermarkOpacity));
    formData.append("size", String(watermarkSize));
    if (watermarkType === "text") {
      formData.append("text", watermarkText);
      formData.append("color", watermarkColor);
    } else {
      if (!watermarkLogoFile) {
        setWatermarkError("Choisis d'abord un logo");
        setWatermarkLoading(false);
        return;
      }
      formData.append("logo", watermarkLogoFile);
    }

    try {
      const res = await fetch(`${apiUrl}/api/watermark`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setWatermarkResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setWatermarkError(err instanceof Error ? err.message : "Filigrane échoué");
    } finally {
      setWatermarkLoading(false);
    }
  }

  async function handleCopyright() {
    if (!file) return;
    setCopyrightLoading(true);
    setCopyrightError(null);
    setCopyrightResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("author", copyrightAuthor);
    formData.append("copyrightText", copyrightText);

    try {
      const res = await fetch(`${apiUrl}/api/copyright`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setCopyrightResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setCopyrightError(err instanceof Error ? err.message : "Protection échouée");
    } finally {
      setCopyrightLoading(false);
    }
  }

  async function handleDropShadow() {
    if (!file) return;
    setShadowLoading(true);
    setShadowError(null);
    setShadowResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("offsetX", String(shadowOffsetX));
    formData.append("offsetY", String(shadowOffsetY));
    formData.append("blur", String(shadowBlur));
    formData.append("opacity", String(shadowOpacity));

    try {
      const res = await fetch(`${apiUrl}/api/drop-shadow`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setShadowResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setShadowError(err instanceof Error ? err.message : "Ombre portée échouée");
    } finally {
      setShadowLoading(false);
    }
  }

  useEffect(() => {
    if (!file || !filtersTouched) return;
    const timer = setTimeout(() => {
      handleAdjust();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brightness, contrast, saturation, sharpenAmount, blurAmount, effect, invertColors, pixelateSize, reduceNoise, vignetteIntensity, quantizeColors, filtersTouched]);

  async function handleAdjust() {
    if (!file) return;
    setAdjustLoading(true);
    setAdjustError(null);
    setAdjustResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("brightness", String(brightness));
    formData.append("contrast", String(contrast));
    formData.append("saturation", String(saturation));
    formData.append("sharpen", String(sharpenAmount));
    formData.append("blurAmount", String(blurAmount));
    formData.append("effect", effect);
    formData.append("invert", String(invertColors));
    formData.append("pixelate", String(pixelateSize));
    formData.append("reduceNoise", String(reduceNoise));
    formData.append("vignetteIntensity", String(vignetteIntensity));
    formData.append("quantizeColors", String(quantizeColors));

    try {
      const res = await fetch(`${apiUrl}/api/adjust`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setAdjustResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Ajustement échoué");
    } finally {
      setAdjustLoading(false);
    }
  }

  function handleCropImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (cropNaturalWidth === 0) {
      setCropNaturalWidth(img.naturalWidth);
      setCropNaturalHeight(img.naturalHeight);
      setCropX(0);
      setCropY(0);
      setCropWidth(img.naturalWidth);
      setCropHeight(img.naturalHeight);
    }
  }

  function resetCrop() {
    setCropX(0);
    setCropY(0);
    setCropWidth(cropNaturalWidth);
    setCropHeight(cropNaturalHeight);
  }

  async function handleCrop() {
    if (!file) return;
    setCropLoading(true);
    setCropError(null);
    setCropResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("x", String(cropX));
    formData.append("y", String(cropY));
    formData.append("width", String(cropWidth));
    formData.append("height", String(cropHeight));

    try {
      const res = await fetch(`${apiUrl}/api/crop`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setCropResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setCropError(err instanceof Error ? err.message : "Recadrage échoué");
    } finally {
      setCropLoading(false);
    }
  }

  function adjustAngle(delta: number) {
    setRotateAngle((prev) => {
      let next = prev + delta;
      if (next > 180) next -= 360;
      if (next < -180) next += 360;
      return next;
    });
  }

  async function handleRotate() {
    if (!file) return;
    setRotateLoading(true);
    setRotateError(null);
    setRotateResultUrl(null);
    setRotateDims(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("angle", String(rotateAngle));
    formData.append("flipHorizontal", String(flipHorizontal));
    formData.append("flipVertical", String(flipVertical));

    try {
      const res = await fetch(`${apiUrl}/api/rotate`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const width = Number(res.headers.get("X-Output-Width") || 0);
      const height = Number(res.headers.get("X-Output-Height") || 0);

      const blob = await res.blob();
      setRotateResultUrl(URL.createObjectURL(blob));
      setRotateDims({ width, height });
    } catch (err) {
      setRotateError(err instanceof Error ? err.message : "Rotation échouée");
    } finally {
      setRotateLoading(false);
    }
  }

  function copyHex(hex: string) {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1200);
    });
  }

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-btn"
        aria-label="Ouvrir le menu"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        ☰
      </button>
      <div
        className={`sidebar-backdrop${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="sidebar-logo">
          <img src="/noxel_spectra_logo.svg" alt="NOXEL Spectra" className="sidebar-logo-img" />
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item${activeSection === item.id ? " active" : ""}`}
              onClick={() => goToSection(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        <div style={{ width: "100%", fontFamily: "sans-serif" }}>
      <p style={{ color: "var(--muted)" }}>Conversion d'images — v0.1</p>

      <div
        className={`dropzone${isDraggingOver ? " dropzone-active" : ""}`}
        style={{ marginTop: 24 }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile) handleFileChange(droppedFile);
        }}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
          ou glisse-dépose une image ici
        </p>
      </div>

      {activeSection === "analyze" && (
      <>
      {/* ── Analyser / Smart Optimize ── */}
      <div
        ref={analyzeSectionRef}
        className="glass-panel glass-panel--accent"
        style={{ marginTop: 24 }}
      >
        <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>✨ Analyser (recommandation intelligente)</h2>
        <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
          Teste plusieurs formats réels et recommande le plus léger pour cette image précise.
        </p>

        <button
          onClick={handleAnalyze}
          disabled={!file || analyzeLoading}
          style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          {analyzeLoading ? "Analyse en cours..." : "Analyser"}
        </button>

        {analyzeError && <p style={{ color: "red", marginTop: 16 }}>{analyzeError}</p>}

        {analyzeResult && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>
              {analyzeResult.sourceFormat.toUpperCase()} — {analyzeResult.width}×{analyzeResult.height}px —{" "}
              {formatBytes(analyzeResult.originalSize)} —{" "}
              {analyzeResult.imageType === "graphic" ? "Graphique/logo" : "Photo"}
              {analyzeResult.hasAlpha ? " — Transparent" : ""}
            </div>

            {analyzeResult.notes.length > 0 && (
              <ul style={{ fontSize: 13, color: "#555", paddingLeft: 18, marginBottom: 12 }}>
                {analyzeResult.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {analyzeResult.alternatives.map((c) => {
                const isRecommended =
                  analyzeResult.recommendation &&
                  c.format === analyzeResult.recommendation.format &&
                  c.quality === analyzeResult.recommendation.quality;
                return (
                  <div
                    key={c.format}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: isRecommended ? "rgba(61,220,132,0.12)" : "rgba(255,255,255,0.06)",
                      border: isRecommended ? "1px solid rgba(61,220,132,0.4)" : "1px solid transparent",
                      fontSize: 14,
                    }}
                  >
                    <span>
                      {isRecommended && "🏆 "}
                      {c.format.toUpperCase()} (q{c.quality})
                    </span>
                    <span>
                      {formatBytes(c.size)}{" "}
                      <span style={{ color: c.savingsPercent >= 0 ? "#2a8a4a" : "#c0392b" }}>
                        ({c.savingsPercent >= 0 ? "-" : "+"}
                        {Math.abs(c.savingsPercent)}%)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            {analyzeResult.recommendation && (
              <button
                onClick={applyRecommendation}
                style={{ marginTop: 14, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
              >
                Utiliser cette recommandation →
              </button>
            )}
          </div>
        )}
      </div>

      </>
      )}
      {activeSection === "convert" && (
      <>
      {/* ── Conversion ── */}
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <div ref={convertSectionRef}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Convertir</h2>

        <div style={{ marginTop: 16 }}>
          <label>
            Format :{" "}
            <select
              value={format}
              onChange={(e) => {
                const next = e.target.value as Format;
                setFormat(next);
                if (!TARGET_SIZE_FORMATS.includes(next)) setMode("quality");
              }}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>{f.toUpperCase()}</option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="radio"
              checked={mode === "quality"}
              onChange={() => setMode("quality")}
            />
            Qualité manuelle
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: targetSizeAvailable ? 1 : 0.4,
            }}
            title={targetSizeAvailable ? "" : "Pas disponible pour PNG/GIF"}
          >
            <input
              type="radio"
              checked={mode === "targetSize"}
              disabled={!targetSizeAvailable}
              onChange={() => setMode("targetSize")}
            />
            Taille cible
          </label>
        </div>

        {mode === "quality" && (
          <div style={{ marginTop: 12 }}>
            <label>
              Qualité : {quality}
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                style={{ marginLeft: 8, verticalAlign: "middle" }}
              />
            </label>
          </div>
        )}

        {mode === "targetSize" && targetSizeAvailable && (
          <div style={{ marginTop: 12 }}>
            <label>
              Poids max (Ko) :{" "}
              <input
                type="number"
                min={1}
                value={targetSizeKB}
                onChange={(e) => setTargetSizeKB(Number(e.target.value))}
                style={{ width: 80 }}
              />
            </label>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              La qualité sera ajustée automatiquement pour rester sous cette limite.
            </div>
          </div>
        )}

        <button
          onClick={handleConvert}
          disabled={!file || loading}
          style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          {loading ? "Conversion..." : "Convertir"}
        </button>

        {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

        {stats && (
          <div
            style={{
              marginTop: 20,
              padding: 12,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            <div>Avant : {formatBytes(stats.originalSize)}</div>
            <div>Après : {formatBytes(stats.outputSize)}</div>
            <div style={{ fontWeight: 600, color: stats.reductionPct >= 0 ? "#2a8a4a" : "#c0392b" }}>
              {stats.reductionPct >= 0
                ? `Réduction de ${stats.reductionPct}%`
                : `Augmentation de ${Math.abs(stats.reductionPct)}%`}
            </div>
            {mode === "targetSize" && (
              <div style={{ marginTop: 4, color: "#888" }}>
                Qualité utilisée : {stats.qualityUsed}
                {!stats.metTarget && (
                  <span style={{ color: "#c0392b" }}>
                    {" "}
                    — impossible de descendre sous la limite demandée, taille minimale atteinte
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {resultUrl && (
          <div style={{ marginTop: 20 }}>
            {originalPreviewUrl ? (
              <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={resultUrl} />
            ) : (
              <img src={resultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
            )}
            <div style={{ marginTop: 8 }}>
              <a href={resultUrl} download={`converted.${format}`}>
                Télécharger le résultat
              </a>
            </div>
          </div>
        )}
      </div>

      </>
      )}
      {activeSection === "resize" && (
      <>
      {/* ── Redimensionner ── */}
      <div ref={resizeSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Redimensionner</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Change les dimensions de l'image sélectionnée ci-dessus.
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Largeur (px) :{" "}
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={resizeWidth}
            onChange={(e) => setResizeWidth(e.target.value)}
            style={{ width: 90 }}
          />
        </label>
        <label>
          Hauteur (px) :{" "}
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={resizeHeight}
            onChange={(e) => setResizeHeight(e.target.value)}
            style={{ width: 90 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={maintainAspect}
            onChange={(e) => setMaintainAspect(e.target.checked)}
          />
          Conserver le ratio (sinon étire exactement à ces dimensions)
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          Format de sortie :{" "}
          <select
            value={resizeFormat}
            onChange={(e) => setResizeFormat(e.target.value as "original" | Format)}
          >
            <option value="original">Garder l'original</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={handleResize}
        disabled={!file || resizeLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {resizeLoading ? "Redimensionnement..." : "Redimensionner"}
      </button>

      {resizeError && <p style={{ color: "red", marginTop: 16 }}>{resizeError}</p>}

      {resizeStats && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <div>
            Avant : {resizeStats.originalWidth}×{resizeStats.originalHeight}px ({formatBytes(resizeStats.originalSize)})
          </div>
          <div>
            Après : {resizeStats.outputWidth}×{resizeStats.outputHeight}px ({formatBytes(resizeStats.outputSize)})
          </div>
        </div>
      )}

      {resizeResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={resizeResultUrl} />
          ) : (
            <img src={resizeResultUrl} alt="Résultat redimensionné" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <a href={resizeResultUrl} download="resized">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "crop" && (
      <>
      {/* ── Rogner ── */}
      <div ref={cropSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Rogner</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Ajuste la zone ci-dessous — l'aperçu montre exactement ce qui sera gardé.
      </p>

      {originalPreviewUrl && (
        <div style={{ marginTop: 12, position: "relative", display: "inline-block", maxWidth: "100%", overflow: "hidden", borderRadius: 8 }}>
          <img
            src={originalPreviewUrl}
            alt="Aperçu de rognage"
            onLoad={handleCropImageLoad}
            style={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: 8 }}
          />
          {cropNaturalWidth > 0 && (
            <div
              style={{
                position: "absolute",
                left: `${(cropX / cropNaturalWidth) * 100}%`,
                top: `${(cropY / cropNaturalHeight) * 100}%`,
                width: `${(cropWidth / cropNaturalWidth) * 100}%`,
                height: `${(cropHeight / cropNaturalHeight) * 100}%`,
                border: "2px dashed #fff",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                boxSizing: "border-box",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label>
          X :{" "}
          <input
            type="number"
            min={0}
            max={Math.max(0, cropNaturalWidth - 1)}
            value={cropX}
            onChange={(e) => setCropX(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Y :{" "}
          <input
            type="number"
            min={0}
            max={Math.max(0, cropNaturalHeight - 1)}
            value={cropY}
            onChange={(e) => setCropY(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Largeur :{" "}
          <input
            type="number"
            min={1}
            max={cropNaturalWidth}
            value={cropWidth}
            onChange={(e) => setCropWidth(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label>
          Hauteur :{" "}
          <input
            type="number"
            min={1}
            max={cropNaturalHeight}
            value={cropHeight}
            onChange={(e) => setCropHeight(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button
          onClick={resetCrop}
          disabled={!file}
          style={{ padding: "8px 16px", fontSize: 14, cursor: "pointer" }}
        >
          Réinitialiser
        </button>
        <button
          onClick={handleCrop}
          disabled={!file || cropLoading}
          style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          {cropLoading ? "Rognage..." : "Rogner"}
        </button>
      </div>

      {cropError && <p style={{ color: "red", marginTop: 16 }}>{cropError}</p>}

      {cropResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={cropResultUrl} />
          ) : (
            <img src={cropResultUrl} alt="Résultat rogné" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <a href={cropResultUrl} download="cropped">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "rotate" && (
      <>
      {/* ── Rotation / Miroir ── */}
      <div ref={rotateSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Rotation / Miroir</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Tourne ou retourne l'image sélectionnée ci-dessus.
      </p>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => adjustAngle(-5)}
            style={{ padding: "6px 12px", fontSize: 15, cursor: "pointer" }}
          >
            − 5°
          </button>
          <input
            type="number"
            value={rotateAngle}
            onChange={(e) => setRotateAngle(Number(e.target.value))}
            style={{ width: 70, textAlign: "center", fontSize: 15, padding: "6px 4px" }}
          />
          <span>°</span>
          <button
            onClick={() => adjustAngle(5)}
            style={{ padding: "6px 12px", fontSize: 15, cursor: "pointer" }}
          >
            + 5°
          </button>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          {[0, 90, 180, 270].map((preset) => (
            <button
              key={preset}
              onClick={() => setRotateAngle(preset)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
                background: rotateAngle === preset ? "#e0e0e0" : "#fff",
                border: "1px solid #ddd",
                borderRadius: 4,
              }}
            >
              {preset}°
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={flipHorizontal}
            onChange={(e) => setFlipHorizontal(e.target.checked)}
          />
          Miroir horizontal
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={flipVertical}
            onChange={(e) => setFlipVertical(e.target.checked)}
          />
          Miroir vertical
        </label>
      </div>

      <button
        onClick={handleRotate}
        disabled={!file || rotateLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {rotateLoading ? "Application..." : "Appliquer"}
      </button>

      {rotateError && <p style={{ color: "red", marginTop: 16 }}>{rotateError}</p>}

      {rotateResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={rotateResultUrl} />
          ) : (
            <img src={rotateResultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          {rotateDims && (
            <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
              {rotateDims.width}×{rotateDims.height}px
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <a href={rotateResultUrl} download="rotated">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "adjust" && (
      <>
      {/* ── Filtres / Réglages ── */}
      <div ref={adjustSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Filtres / Réglages</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Ajuste la luminosité, le contraste, la saturation, la netteté ou applique un effet.
      </p>

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Luminosité : {brightness.toFixed(2)}
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={brightness}
            onChange={(e) => { setBrightness(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Contraste : {contrast.toFixed(2)}
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={contrast}
            onChange={(e) => { setContrast(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Saturation : {saturation.toFixed(2)}
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={saturation}
            onChange={(e) => { setSaturation(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Netteté : {sharpenAmount.toFixed(1)}
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={sharpenAmount}
            onChange={(e) => { setSharpenAmount(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Flou : {blurAmount.toFixed(1)}
          <input
            type="range"
            min={0}
            max={20}
            step={0.5}
            value={blurAmount}
            onChange={(e) => { setBlurAmount(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Pixeliser : {pixelateSize === 0 ? "Désactivé" : pixelateSize}
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={pixelateSize}
            onChange={(e) => { setPixelateSize(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Vignette : {vignetteIntensity === 0 ? "Désactivée" : `${vignetteIntensity}%`}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={vignetteIntensity}
            onChange={(e) => { setVignetteIntensity(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Réduction du bruit :{" "}
          <select
            value={reduceNoise}
            onChange={(e) => { setReduceNoise(Number(e.target.value)); setFiltersTouched(true); }}
          >
            <option value={0}>Désactivée</option>
            <option value={3}>Légère</option>
            <option value={5}>Moyenne</option>
            <option value={7}>Forte</option>
          </select>
        </label>
        <label>
          Quantize (nb de couleurs) : {quantizeColors === 0 ? "Désactivé" : quantizeColors}
          <input
            type="range"
            min={0}
            max={256}
            step={4}
            value={quantizeColors}
            onChange={(e) => { setQuantizeColors(Number(e.target.value)); setFiltersTouched(true); }}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
          <div style={{ fontSize: 12, color: "#888" }}>
            Fonctionne uniquement quand le format de sortie est PNG.
          </div>
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
        <label>
          Effet :{" "}
          <select value={effect} onChange={(e) => { setEffect(e.target.value as "none" | "grayscale" | "sepia"); setFiltersTouched(true); }}>
            <option value="none">Aucun</option>
            <option value="grayscale">Niveaux de gris</option>
            <option value="sepia">Sépia</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={invertColors}
            onChange={(e) => { setInvertColors(e.target.checked); setFiltersTouched(true); }}
          />
          Inverser les couleurs
        </label>
      </div>

      <button
        onClick={handleAdjust}
        disabled={!file || adjustLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {adjustLoading ? "Application..." : "Appliquer"}
      </button>

      {adjustError && <p style={{ color: "red", marginTop: 16 }}>{adjustError}</p>}

      {adjustResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={adjustResultUrl} />
          ) : (
            <img src={adjustResultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <a href={adjustResultUrl} download="adjusted">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "responsive" && (
      <>
      {/* ── Tailles responsives / srcset ── */}
      <div ref={responsiveSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Générer des tailles responsives (srcset)</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Produit plusieurs largeurs (320 à 1920px, jamais agrandies au-delà de l'original) et
        un <code>srcset</code> prêt à coller dans ton HTML.
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
        <label>
          Format :{" "}
          <select
            value={responsiveFormat}
            onChange={(e) => setResponsiveFormat(e.target.value as Format)}
          >
            {FORMATS.filter((f) => f !== "gif").map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <label>
          Qualité : {responsiveQuality}
          <input
            type="range"
            min={1}
            max={100}
            value={responsiveQuality}
            onChange={(e) => setResponsiveQuality(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle" }}
          />
        </label>
      </div>

      <button
        onClick={handleGenerateResponsive}
        disabled={!file || responsiveLoading}
        style={{ marginTop: 16, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {responsiveLoading ? "Génération..." : "Générer les tailles"}
      </button>

      {responsiveError && <p style={{ color: "red", marginTop: 16 }}>{responsiveError}</p>}

      {responsiveSizes && (
        <div style={{ marginTop: 16, fontSize: 13, color: "#888" }}>
          Tailles générées : {responsiveSizes.split(",").join("px, ")}px
        </div>
      )}

      {responsiveSrcset && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              fontFamily: "monospace",
              wordBreak: "break-all",
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            {responsiveSrcset}
          </div>
          <button
            onClick={copySrcset}
            style={{ marginTop: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
          >
            {srcsetCopied ? "Copié !" : "Copier le srcset"}
          </button>
        </div>
      )}

      {responsiveResultUrl && (
        <div style={{ marginTop: 16 }}>
          <a href={responsiveResultUrl} download="responsive-images.zip">
            Télécharger le pack (responsive-images.zip)
          </a>
        </div>
      )}

      </>
      )}
      {activeSection === "palette" && (
      <>
      {/* ── Palette de couleurs ── */}
      <div ref={paletteSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Palette de couleurs</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Extrait les couleurs dominantes de l'image sélectionnée ci-dessus.
      </p>

      <div style={{ marginTop: 12 }}>
        <label>
          Nombre de couleurs : {paletteCount}
          <input
            type="range"
            min={3}
            max={10}
            value={paletteCount}
            onChange={(e) => setPaletteCount(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle" }}
          />
        </label>
      </div>

      <button
        onClick={handleExtractPalette}
        disabled={!file || paletteLoading}
        style={{ marginTop: 16, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {paletteLoading ? "Extraction..." : "Extraire la palette"}
      </button>

      {paletteError && <p style={{ color: "red", marginTop: 16 }}>{paletteError}</p>}

      {palette && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 60 }}>
            {palette.map((c) => (
              <div
                key={c.hex}
                title={`${c.hex} — ${c.percent}%`}
                style={{ background: c.hex, flexGrow: c.percent, flexBasis: 0 }}
              />
            ))}
          </div>

          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {palette.map((c) => (
              <button
                key={c.hex}
                onClick={() => copyHex(c.hex)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "monospace",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: c.hex,
                    border: "1px solid rgba(0,0,0,0.1)",
                    display: "inline-block",
                  }}
                />
                {copiedHex === c.hex ? "Copié !" : c.hex}
                <span style={{ color: "#aaa" }}>{c.percent}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "vectorize" && (
      <>
      {/* ── Vectoriser ── */}
      <div ref={vectorizeSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Vectoriser (PNG/WebP → SVG)</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Trace l'image en SVG multi-couleurs. Fonctionne mieux sur des logos simples
        que sur des photos complexes.
      </p>

      <div style={{ marginTop: 12 }}>
        <label>
          Nombre de couleurs : {vectorizeColors}
          <input
            type="range"
            min={2}
            max={16}
            value={vectorizeColors}
            onChange={(e) => {
              setVectorizeColors(Number(e.target.value));
              setDetectedColors(null);
              setEditedColors([]);
            }}
            style={{ marginLeft: 8, verticalAlign: "middle" }}
          />
        </label>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button
          onClick={handleDetectColors}
          disabled={!file || detectLoading}
          style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          {detectLoading ? "Détection..." : "Détecter les couleurs"}
        </button>

        <button
          onClick={handleVectorize}
          disabled={!file || vectorizeLoading}
          style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          {vectorizeLoading ? "Vectorisation... (peut prendre un moment)" : "Vectoriser"}
        </button>
      </div>

      {detectError && <p style={{ color: "red", marginTop: 16 }}>{detectError}</p>}

      {detectedColors && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
            Ajuste au besoin avant de vectoriser — chaque couleur sera utilisée telle quelle.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {editedColors.map((hex, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000"}
                  onChange={(e) => updateEditedColor(i, e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, border: "1px solid #ddd", borderRadius: 4 }}
                />
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => updateEditedColor(i, e.target.value)}
                  style={{ width: 100, fontFamily: "monospace", fontSize: 13 }}
                />
                {detectedColors[i] !== hex && (
                  <span style={{ fontSize: 12, color: "#888" }}>
                    (détecté : {detectedColors[i]})
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={resetEditedColors}
            style={{ marginTop: 10, padding: "4px 10px", fontSize: 13, cursor: "pointer" }}
          >
            Réinitialiser les couleurs détectées
          </button>
        </div>
      )}

      {vectorizeError && <p style={{ color: "red", marginTop: 16 }}>{vectorizeError}</p>}

      {vectorizeSvg && vectorizeMeta && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl && vectorizeSvgUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={vectorizeSvgUrl} checkered />
          ) : (
            <div
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                background: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px",
              }}
              dangerouslySetInnerHTML={{ __html: vectorizeSvg }}
            />
          )}
          <div style={{ marginTop: 8, fontSize: 13, color: "#888" }}>
            {vectorizeMeta.width}×{vectorizeMeta.height}px — {vectorizeMeta.colorsUsed} couleur(s) utilisée(s)
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13 }}>
              Nom du fichier :{" "}
              <input
                type="text"
                value={vectorizeFilename}
                onChange={(e) => setVectorizeFilename(e.target.value)}
                placeholder="vectorized"
                style={{ width: 160 }}
              />
              .svg
            </label>
          </div>

          <div style={{ marginTop: 8 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); downloadVectorizedSvg(); }}>
              Télécharger le SVG
            </a>
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "favicon" && (
      <>
      {/* ── Favicons ── */}
      <div ref={faviconSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Générer les favicons</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Génère un pack complet à partir de l'image sélectionnée ci-dessus : favicon.ico,
        favicon-16x16.png, favicon-32x32.png, favicon-48x48.png, apple-touch-icon.png,
        favicon-192x192.png et favicon-512x512.png.
      </p>

      <button
        onClick={handleGenerateFavicons}
        disabled={!file || faviconLoading}
        style={{ marginTop: 16, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {faviconLoading ? "Génération..." : "Générer les favicons"}
      </button>

      {faviconError && <p style={{ color: "red", marginTop: 16 }}>{faviconError}</p>}

      {faviconResultUrl && (
        <div style={{ marginTop: 16 }}>
          <a href={faviconResultUrl} download="favicon-package.zip">
            Télécharger le pack (favicon-package.zip)
          </a>
        </div>
      )}

      </>
      )}
      {activeSection === "metaclean" && (
      <>
      {/* ── Nettoyer les métadonnées ── */}
      <div ref={metaCleanSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Nettoyer les métadonnées</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Retire les données EXIF/GPS/ICC embarquées (utile pour la vie privée) sans changer
        le format ni visiblement la qualité.
      </p>

      <button
        onClick={handleStripMetadata}
        disabled={!file || metaCleanLoading}
        style={{ marginTop: 16, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {metaCleanLoading ? "Nettoyage..." : "Nettoyer les métadonnées"}
      </button>

      {metaCleanError && <p style={{ color: "red", marginTop: 16 }}>{metaCleanError}</p>}

      {metaCleanStats && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <div>Avant : {formatBytes(metaCleanStats.originalSize)}</div>
          <div>Après : {formatBytes(metaCleanStats.outputSize)}</div>
          {metaCleanStats.grewLarger ? (
            <div style={{ marginTop: 6, color: "#c0392b" }}>
              Ce PNG est déjà plus compact que ce qu'un réencodage sans perte peut faire —
              le fichier original a été gardé tel quel (métadonnées incluses) pour éviter de
              te renvoyer un fichier plus lourd. Pour un vrai gain de poids sur une photo,
              utilise plutôt <strong>Convertir</strong> (WebP ou AVIF).
            </div>
          ) : (
            <div style={{ fontWeight: 600, color: "#2a8a4a" }}>
              {metaCleanStats.bytesRemoved > 0
                ? `${formatBytes(metaCleanStats.bytesRemoved)} de métadonnées retirées`
                : "Aucune métadonnée trouvée dans le fichier"}
            </div>
          )}
        </div>
      )}

      {metaCleanResultUrl && (
        <div style={{ marginTop: 16 }}>
          <a href={metaCleanResultUrl} download="cleaned">
            Télécharger le fichier nettoyé
          </a>
        </div>
      )}

      </>
      )}
      {activeSection === "shadow" && (
      <>
      {/* ── Ombre portée ── */}
      <div ref={shadowSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Ombre portée</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Fonctionne mieux sur une image avec transparence (logo, icône vectorisée).
      </p>

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Décalage X : {shadowOffsetX}px
          <input
            type="range"
            min={-50}
            max={50}
            value={shadowOffsetX}
            onChange={(e) => setShadowOffsetX(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Décalage Y : {shadowOffsetY}px
          <input
            type="range"
            min={-50}
            max={50}
            value={shadowOffsetY}
            onChange={(e) => setShadowOffsetY(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Flou : {shadowBlur}
          <input
            type="range"
            min={0}
            max={30}
            value={shadowBlur}
            onChange={(e) => setShadowBlur(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Opacité : {shadowOpacity}%
          <input
            type="range"
            min={0}
            max={100}
            value={shadowOpacity}
            onChange={(e) => setShadowOpacity(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
      </div>

      <button
        onClick={handleDropShadow}
        disabled={!file || shadowLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {shadowLoading ? "Application..." : "Appliquer"}
      </button>

      {shadowError && <p style={{ color: "red", marginTop: 16 }}>{shadowError}</p>}

      {shadowResultUrl && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              background: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px",
            }}
          >
            <img src={shadowResultUrl} alt="Résultat" style={{ maxWidth: "100%", display: "block" }} />
          </div>
          <div style={{ marginTop: 8 }}>
            <a href={shadowResultUrl} download="drop-shadow.png">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      </>
      )}
      {activeSection === "glow" && (
      <>
      {/* ── Effet lumineux (Glow) ── */}
      <div ref={glowSectionRef} />
      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: "1px solid #ddd" }} />

      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Effet lumineux (Glow)</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Ajoute un halo lumineux doux, utile pour des visuels promotionnels.
      </p>

      <label>
        Intensité : {glowIntensity}
        <input
          type="range"
          min={0}
          max={30}
          value={glowIntensity}
          onChange={(e) => setGlowIntensity(Number(e.target.value))}
          style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
        />
      </label>

      <div>
        <button
          onClick={handleGlow}
          disabled={!file || glowLoading}
          style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          {glowLoading ? "Application..." : "Appliquer"}
        </button>
      </div>

      {glowError && <p style={{ color: "red", marginTop: 16 }}>{glowError}</p>}

      {glowResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={glowResultUrl} />
          ) : (
            <img src={glowResultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <a href={glowResultUrl} download="glow">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}
      </>
      )}

      {activeSection === "social" && (
      <>
      {/* ── Réseaux sociaux ── */}
      <div ref={socialSectionRef} />
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Tailles pour réseaux sociaux</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Redimensionne l'image sélectionnée aux dimensions exactes recommandées par
        chaque réseau. Ajuste précisément la taille (donc peut légèrement déformer
        une image dont le ratio diffère) — utilise Rogner avant si tu veux éviter
        toute déformation.
      </p>

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Réseau :{" "}
          <select
            value={socialPlatform}
            onChange={(e) => {
              setSocialPlatform(e.target.value);
              setSocialPresetIndex(0);
            }}
          >
            {Object.keys(SOCIAL_PRESETS).map((platform) => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
        </label>
        <label>
          Type d'image :{" "}
          <select
            value={socialPresetIndex}
            onChange={(e) => setSocialPresetIndex(Number(e.target.value))}
          >
            {SOCIAL_PRESETS[socialPlatform].map((preset, i) => (
              <option key={preset.label} value={i}>
                {preset.label} — {preset.width}×{preset.height}px
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={handleApplySocialPreset}
        disabled={!file || socialLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {socialLoading ? "Redimensionnement..." : "Redimensionner à cette taille"}
      </button>

      {socialError && <p style={{ color: "red", marginTop: 16 }}>{socialError}</p>}

      {socialStats && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          <div>
            Avant : {socialStats.originalWidth}×{socialStats.originalHeight}px ({formatBytes(socialStats.originalSize)})
          </div>
          <div>
            Après : {socialStats.outputWidth}×{socialStats.outputHeight}px ({formatBytes(socialStats.outputSize)})
          </div>
        </div>
      )}

      {socialResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={socialResultUrl} />
          ) : (
            <img src={socialResultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <a href={socialResultUrl} download="social-image">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}
      </>
      )}

      {activeSection === "editor" && (
      <>
      {/* ── Éditeur ── */}
      <div ref={editorSectionRef} />
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Éditeur</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Ajoute du texte, des stickers et des formes sur l'image sélectionnée en haut.
        Utilise le bouton "Exporter PNG" dans la barre d'outils pour télécharger le résultat.
      </p>
      <div style={{ marginTop: 12 }}>
        <OverlayEditor file={file} />
      </div>
      </>
      )}

      {activeSection === "gradient" && (
      <>
      {/* ── Dégradé ── */}
      <div ref={gradientSectionRef} />
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Dégradé</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Crée un dégradé linéaire ou radial (2 à 10 couleurs) et exporte en PNG, SVG, CSS ou JSON.
      </p>
      <div style={{ marginTop: 12 }}>
        <GradientTool />
      </div>
      </>
      )}

      {activeSection === "watermark" && (
      <>
      {/* ── Filigrane ── */}
      <div ref={watermarkSectionRef} />
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Filigrane</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Applique un filigrane texte ou logo sur l'image sélectionnée en haut.
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            checked={watermarkType === "text"}
            onChange={() => setWatermarkType("text")}
          />
          Texte
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="radio"
            checked={watermarkType === "logo"}
            onChange={() => setWatermarkType("logo")}
          />
          Logo
        </label>
      </div>

      {watermarkType === "text" ? (
        <div className="controls-grid" style={{ marginTop: 12 }}>
          <label>
            Texte :{" "}
            <input
              type="text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              style={{ width: 160 }}
            />
          </label>
          <label>
            Couleur<input
              type="color"
              value={watermarkColor}
              onChange={(e) => setWatermarkColor(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setWatermarkLogoFile(e.target.files?.[0] || null)}
          />
        </div>
      )}

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Position :{" "}
          <select value={watermarkPosition} onChange={(e) => setWatermarkPosition(e.target.value)}>
            <option value="bottom-right">Bas droite</option>
            <option value="bottom-left">Bas gauche</option>
            <option value="top-right">Haut droite</option>
            <option value="top-left">Haut gauche</option>
            <option value="center">Centre</option>
            <option value="tiled">Mosaïque (répété)</option>
          </select>
        </label>
        <label>
          Opacité : {watermarkOpacity}%
          <input
            type="range"
            min={0}
            max={100}
            value={watermarkOpacity}
            onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
        <label>
          Taille : {watermarkSize === 0 ? "Auto" : watermarkSize}
          <input
            type="range"
            min={0}
            max={watermarkType === "text" ? 200 : 60}
            value={watermarkSize}
            onChange={(e) => setWatermarkSize(Number(e.target.value))}
            style={{ marginLeft: 8, verticalAlign: "middle", width: "100%" }}
          />
        </label>
      </div>

      <button
        onClick={handleWatermark}
        disabled={!file || watermarkLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {watermarkLoading ? "Application..." : "Appliquer le filigrane"}
      </button>

      {watermarkError && <p style={{ color: "red", marginTop: 16 }}>{watermarkError}</p>}

      {watermarkResultUrl && (
        <div style={{ marginTop: 20 }}>
          {originalPreviewUrl ? (
            <BeforeAfterSlider beforeUrl={originalPreviewUrl} afterUrl={watermarkResultUrl} />
          ) : (
            <img src={watermarkResultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 8 }}>
            <a href={watermarkResultUrl} download="watermarked">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}
      </>
      )}

      {activeSection === "copyright" && (
      <>
      {/* ── Copyright ── */}
      <div ref={copyrightSectionRef} />
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Protection copyright</h2>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Intègre une mention d'auteur/copyright dans les métadonnées du fichier — invisible à
        l'œil, mais présente dans les propriétés du fichier. Fonctionne mieux en JPEG ; le
        support varie selon le format pour les autres.
      </p>

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Auteur :{" "}
          <input
            type="text"
            value={copyrightAuthor}
            onChange={(e) => setCopyrightAuthor(e.target.value)}
            placeholder="Ton nom ou celui de NOXEL"
            style={{ width: 200 }}
          />
        </label>
        <label>
          Copyright :{" "}
          <input
            type="text"
            value={copyrightText}
            onChange={(e) => setCopyrightText(e.target.value)}
            placeholder="© 2026 NOXEL"
            style={{ width: 200 }}
          />
        </label>
      </div>

      <button
        onClick={handleCopyright}
        disabled={!file || copyrightLoading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {copyrightLoading ? "Application..." : "Protéger"}
      </button>

      {copyrightError && <p style={{ color: "red", marginTop: 16 }}>{copyrightError}</p>}

      {copyrightResultUrl && (
        <div style={{ marginTop: 16 }}>
          <a href={copyrightResultUrl} download="protected">
            Télécharger le fichier protégé
          </a>
        </div>
      )}
      </>
      )}
        </div>
      </main>
    </div>
  );
}
