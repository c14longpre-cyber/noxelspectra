import { useState } from "react";
import "./App.css";

const FORMATS = ["webp", "avif", "jpeg", "png", "gif"] as const;
type Format = (typeof FORMATS)[number];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(75);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  async function handleConvert() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultUrl(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", format);
    formData.append("quality", String(quality));

    try {
      const res = await fetch(`${apiUrl}/api/convert`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion échouée");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", fontFamily: "sans-serif", padding: 20 }}>
      <h1>NOXEL Spectra</h1>
      <p style={{ color: "#888" }}>Conversion d'images — v0.1</p>

      <div style={{ marginTop: 24 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Format :{" "}
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </label>

        <label>
          Qualité : {quality}
          <input
            type="range"
            min={1}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            style={{ marginLeft: 8 }}
          />
        </label>
      </div>

      <button
        onClick={handleConvert}
        disabled={!file || loading}
        style={{ marginTop: 20, padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
      >
        {loading ? "Conversion..." : "Convertir"}
      </button>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      {resultUrl && (
        <div style={{ marginTop: 24 }}>
          <img src={resultUrl} alt="Résultat" style={{ maxWidth: "100%", borderRadius: 8 }} />
          <div style={{ marginTop: 8 }}>
            <a href={resultUrl} download={`converted.${format}`}>
              Télécharger le résultat
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
