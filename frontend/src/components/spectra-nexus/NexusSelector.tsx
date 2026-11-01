// NOXEL NEXUS — sélecteur de langue par carte du monde, comme sur NOXEL FORGE et NOXEL SEO.
// Partagé avec l'outil vidéo (video/). Aucun appel extérieur : drapeaux en émoji (pas de flagcdn),
// carte embarquée dans le bundle.
import { useEffect, useMemo, useRef, useState } from "react";
import worldSvgRaw from "./world-map.svg?raw";
import { COUNTRY_DATA, type CountryInfo } from "../../i18n/nexus/countryData";
import { getIndigenousLanguagesLabel } from "../../i18n/nexus/indigenous";
import { LANGUAGES_115 } from "../../i18n/languages";
import { FULL_LANGS, tr } from "../../i18n";
import "./nexus.css";

type Props = { locale: string; onChange: (code: string) => void; onClose: () => void };

// Pays → langue de l'interface (même table que NOXEL FORGE, complétée)
const LANGUAGE_BY_ISO2: Record<string, string> = {
  CA: "fr", US: "en", GB: "en", IE: "en", FR: "fr", BE: "fr", CH: "fr", LU: "fr", MX: "es", BR: "pt", PE: "es",
  AR: "es", CL: "es", CO: "es", ES: "es", DE: "de", AT: "de", IT: "it", PT: "pt", NL: "nl", JP: "ja",
  CN: "zh", KR: "ko", IN: "hi", AU: "en", NZ: "en", SA: "ar", NO: "no", SE: "sv", DK: "da",
  FI: "fi", PL: "pl", TR: "tr", RU: "ru", UA: "uk", ET: "am", KE: "en", SN: "fr", CI: "fr", MA: "ar", DZ: "ar", TN: "ar",
};

const flagEmoji = (iso2: string) =>
  /^[A-Z]{2}$/.test(iso2) ? String.fromCodePoint(...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐";

function normalizeIso(raw?: string | null): string | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase().replace(/^_+/, "");
  return /^[a-z]{2,3}$/.test(clean) ? clean.toUpperCase() : null;
}

function isoFromElement(el: Element | null): string | null {
  for (let node = el; node; node = node.parentElement) {
    const iso = normalizeIso(node.getAttribute("data-id")) || normalizeIso(node.id) || normalizeIso(node.closest("g[id]")?.getAttribute("id") ?? null);
    if (iso) return iso;
  }
  return null;
}

// Les tracés du fichier sont décalés (x 31–815, y 242–700) : cadrage sur leur vraie étendue
const MAP_HTML = worldSvgRaw;
const MAP_VIEWBOX = "28 236 790 468";

export default function NexusSelector({ locale, onChange, onClose }: Props) {
  const startIso = (navigator.language.split("-")[1] || "").toUpperCase();
  const [selectedIso, setSelectedIso] = useState<string>(COUNTRY_DATA[startIso] ? startIso : "CA");
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null);
  const [manual, setManual] = useState(locale);
  const host = useRef<HTMLDivElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);

  const byIso = useMemo(() => {
    const m = new Map<string, CountryInfo>();
    Object.values(COUNTRY_DATA).forEach((c) => c.iso2 && m.set(c.iso2.toUpperCase(), c));
    return m;
  }, []);
  const country = byIso.get(selectedIso) || null;
  const mapped = LANGUAGE_BY_ISO2[selectedIso] || "en";
  const meta = (code: string) => LANGUAGES_115.find((l) => l.code === code);
  const partial = (code: string) => !FULL_LANGS.includes(code.split("-")[0]);

  // Fenêtre modale : défilement de la page bloqué, Échap pour fermer, focus dans la fenêtre
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    dialog.current?.focus();
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // Préparer la carte une fois : chaque tracé reçoit son code pays
  useEffect(() => {
    const svg = host.current?.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("viewBox", MAP_VIEWBOX);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", tr("Carte du monde : clique un pays pour choisir sa langue"));
    svg.querySelectorAll("path").forEach((p) => {
      const id = (p.id || p.closest("g[id]")?.id || "").trim().toLowerCase();
      if (id) p.setAttribute("data-id", id);
    });
  }, []);

  useEffect(() => {
    host.current?.querySelectorAll<SVGPathElement>("path[data-id]").forEach((p) => {
      const id = p.getAttribute("data-id");
      p.classList.toggle("iso-selected", id === selectedIso.toLowerCase());
      p.classList.toggle("iso-hovered", id === hover?.iso.toLowerCase());
    });
  }, [selectedIso, hover]);

  function onMove(e: React.PointerEvent) {
    const iso = isoFromElement(e.target as Element);
    if (!iso || !host.current) { setHover(null); return; }
    const r = host.current.getBoundingClientRect();
    setHover({ iso, x: e.clientX - r.left + 12, y: e.clientY - r.top + 12 });
  }

  const row = (label: string, value: string) => (
    <div><strong>{label}</strong> {value || "—"}</div>
  );

  return (
    <div className="nexus-overlay" role="dialog" aria-modal="true" aria-labelledby="nexus-title" ref={dialog} tabIndex={-1}>
      <div className="nexus-inner">
        <div className="nexus-top">
          <div className="nexus-kicker">NOXEL NEXUS</div>
          <button type="button" className="nexus-close" onClick={onClose}>{tr("Fermer")}</button>
        </div>
        <h1 id="nexus-title" className="nexus-title">{tr("Choisis ta langue")}</h1>

        <div className="nexus-grid">
          <div className="nexus-map">
            <div
              ref={host}
              className="noxel-map-wrap"
              onClick={(e) => { const iso = isoFromElement(e.target as Element); if (iso) setSelectedIso(iso); }}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
              dangerouslySetInnerHTML={{ __html: MAP_HTML }}
            />
            {hover && (
              <div className="nexus-tip" style={{ left: hover.x, top: hover.y }}>
                <div style={{ fontWeight: 700 }}>{flagEmoji(hover.iso)} {byIso.get(hover.iso)?.name || hover.iso}</div>
                <div style={{ opacity: 0.7 }}>{hover.iso}</div>
              </div>
            )}
          </div>

          <aside className="nexus-panel">
            <div className="nexus-kicker">{tr("Sélecteur de langue")}</div>
            <h2 className="nexus-country"><span aria-hidden="true">{flagEmoji(selectedIso)}</span> {country?.name || selectedIso}</h2>
            <div className="nexus-facts">
              {row(tr("Capitale :"), country?.capital || "")}
              {row(tr("Région :"), [country?.region, country?.subregion].filter(Boolean).join(" · "))}
              {row(tr("Devise :"), country?.currency || "")}
              {row(tr("Langues officielles :"), country?.officialLanguages?.join(", ") || "")}
              {row(tr("Langues autochtones :"), country?.indigenousLanguages?.length ? country.indigenousLanguages.join(", ") : getIndigenousLanguagesLabel(selectedIso))}
              {row(tr("Langue de l'interface :"), `${meta(mapped)?.native || mapped} (${mapped.toUpperCase()})`)}
            </div>
            {partial(mapped) && <p className="nexus-note">{tr("NOXEL SPECTRA est traduit en français et en anglais pour l'instant : les autres langues s'affichent en anglais en attendant leur traduction.")}</p>}
            <button type="button" className="nexus-apply" onClick={() => onChange(mapped)}>{tr("Appliquer la langue")}</button>

            <label className="nexus-manual">
              {tr("Ou choisis dans la liste :")}
              <select value={manual} onChange={(e) => setManual(e.target.value)}>
                {LANGUAGES_115.map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.native}{partial(l.code) ? ` · ${tr("anglais en attendant")}` : ""}</option>
                ))}
              </select>
            </label>
            <button type="button" className="nexus-apply nexus-apply--ghost" onClick={() => onChange(manual)}>{tr("Appliquer")}</button>
            <p className="nexus-current">{tr("Langue actuelle :")} {(meta(locale)?.native || locale)} ({locale.toUpperCase()})</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
