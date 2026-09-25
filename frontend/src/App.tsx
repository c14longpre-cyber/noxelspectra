import { useState } from "react";
import "./App.css";

const FORMATS = ["webp", "avif", "jpeg", "png", "gif"] as const;
type Format = (typeof FORMATS)[number];

const TARGET_SIZE_FORMATS: Format[] = ["jpeg", "webp", "avif"];

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

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("webp");
  const [mode, setMode] = useState<"quality" | "targetSize">("quality");
  const [quality, setQuality] = useState(75);
  const [targetSizeKB, setTargetSizeKB] = useState(200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<ConversionStats | null>(null);

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

  const [vectorizeColors, setVectorizeColors] = useState(6);
  const [vectorizeFilename, setVectorizeFilename] = useState("vectorized");
  const [vectorizeLoading, setVectorizeLoading] = useState(false);
  const [vectorizeError, setVectorizeError] = useState<string | null>(null);
  const [vectorizeSvg, setVectorizeSvg] = useState<string | null>(null);
  const [vectorizeMeta, setVectorizeMeta] = useState<VectorizeMeta | null>(null);

  const [detectedColors, setDetectedColors] = useState<string[] | null>(null);
  const [editedColors, setEditedColors] = useState<string[]>([]);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const [faviconLoading, setFaviconLoading] = useState(false);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconResultUrl, setFaviconResultUrl] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const targetSizeAvailable = TARGET_SIZE_FORMATS.includes(format);

  function handleFileChange(f: File | null) {
    setFile(f);
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

  function copyHex(hex: string) {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1200);
    });
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", fontFamily: "sans-serif", padding: 20 }}>
      <h1>NOXEL Spectra</h1>
      <p style={{ color: "#888" }}>Conversion d'images — v0.1</p>

      <div style={{ marginTop: 24 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        />
      </div>

      {/* ── Conversion ── */}
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
            background: "#f5f5f5",
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
          <img src={resultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ marginTop: 8 }}>
            <a href={resultUrl} download={`converted.${format}`}>
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      {/* ── Redimensionner ── */}
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
            background: "#f5f5f5",
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
          <img src={resizeResultUrl} alt="Résultat redimensionné" style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ marginTop: 8 }}>
            <a href={resizeResultUrl} download="resized">
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}

      {/* ── Palette de couleurs ── */}
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

      {/* ── Vectoriser ── */}
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
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              background: "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px",
            }}
            dangerouslySetInnerHTML={{ __html: vectorizeSvg }}
          />
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

      {/* ── Favicons ── */}
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
    </div>
  );
}
