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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} Ko`;
  return `${(kb / 1024).toFixed(2)} Mo`;
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

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const targetSizeAvailable = TARGET_SIZE_FORMATS.includes(format);

  function handleFileChange(f: File | null) {
    setFile(f);
    setResultUrl(null);
    setStats(null);
    setPalette(null);
    setError(null);
    setPaletteError(null);
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
    </div>
  );
}
