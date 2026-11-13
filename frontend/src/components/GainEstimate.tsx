// "Estimated gain on your site" box, under the before / after figures of Convert, Resize and
// Social media. Weight saved, download time saved on a slow mobile connection (the mobile profile
// of PageSpeed tests) and bandwidth saved per month for the views the visitor types in.
// Always worded as an estimate: the proof is a NOXEL SEO scan before and after.
import { useState } from "react";
import { tr, shownLang } from "../i18n";
import { estimateGain, monthlySavedBytes } from "../utils/gain";

const VIEWS_KEY = "spectra-gain-views";

function readViews(): number {
  try {
    const n = Number(localStorage.getItem(VIEWS_KEY));
    return n > 0 ? n : 10000;
  } catch {
    return 10000;
  }
}

function fmtBytes(bytes: number): string {
  const n = (x: number, d: number) => (shownLang() === "fr" ? x.toFixed(d).replace(".", ",") : x.toFixed(d));
  if (bytes < 1024) return `${bytes} ${tr("o")}`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${n(kb, 1)} ${tr("Ko")}`;
  const mb = kb / 1024;
  if (mb < 1024) return `${n(mb, 1)} ${tr("Mo")}`;
  return `${n(mb / 1024, 2)} ${tr("Go")}`;
}

function fmtSeconds(s: number): string {
  if (s < 0.1) return tr("moins de 0,1 s");
  const v = s.toFixed(s < 10 ? 1 : 0);
  return `${shownLang() === "fr" ? v.replace(".", ",") : v} s`;
}

export function GainEstimate({ before, after }: { before: number; after: number }) {
  const [views, setViews] = useState(readViews);
  const gain = estimateGain(before, after);
  if (!gain) return null;
  const monthly = monthlySavedBytes(gain.savedBytes, views);

  const onViews = (v: string) => {
    const n = Math.max(0, Math.min(1e9, Math.floor(Number(v.replace(/\s/g, "")) || 0)));
    setViews(n);
    try { localStorage.setItem(VIEWS_KEY, String(n)); } catch { /* storage unavailable */ }
  };

  return (
    <div className="gain-estimate" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(61,220,132,0.35)", background: "rgba(61,220,132,0.06)", fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 800, color: "#3ddc84", marginBottom: 4 }}>{tr("Gain estimé sur votre site")}</div>
      <div>{tr("Poids économisé : {a} ({b} %)", { a: fmtBytes(gain.savedBytes), b: gain.savedPct })}</div>
      <div>{tr("Téléchargement plus rapide de {a} par affichage sur un mobile lent (1,6 Mbit/s, le profil mobile des tests PageSpeed)", { a: fmtSeconds(gain.secondsSlow4g) })}</div>
      <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
        {tr("Affichages de cette image par mois :")}
        <input type="number" min={0} step={1000} value={views} onChange={(e) => onViews(e.target.value)} style={{ width: 110, padding: "2px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "inherit", font: "inherit" }} />
        <span>→ {tr("{a} de bande passante en moins par mois", { a: fmtBytes(monthly) })}</span>
      </label>
      <div style={{ marginTop: 4, color: "#888", fontSize: 12 }}>{tr("Estimation : le gain réel dépend de la page et du réseau. Pour le mesurer, scannez la page avec NOXEL SEO avant et après.")}</div>
    </div>
  );
}
