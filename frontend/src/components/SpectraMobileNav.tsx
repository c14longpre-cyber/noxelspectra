// Navigation mobile (≤ 860 px), sur le modèle de NOXEL SEO : une barre fixe en bas avec 4 raccourcis
// et « Plus », qui ouvre un panneau avec tous les onglets. Le bouton rond du kit de consentement est
// caché sur mobile (il couvrait la barre) : son lien est dans le panneau.
import { useEffect, useState } from "react";
import { tr } from "../i18n";
import { NavIcon } from "./hud/NavIcon";

type Item = { id: string; label: string; icon: string };

const RACCOURCIS: { id: string; court: string }[] = [
  { id: "analyze", court: "Analyser" },
  { id: "convert", court: "Convertir" },
  { id: "removebg", court: "Détourer" },
  { id: "social", court: "Réseaux" },
];

export function SpectraMobileNav({ items, active, onGo }: { items: Item[]; active: string; onGo: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  // Échap ferme le panneau
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const aller = (id: string) => { onGo(id); setOpen(false); };
  const raccourciActif = RACCOURCIS.some((r) => r.id === active);

  return (
    <div className="sx-mnav">
      {open && <div className="sx-mnav__backdrop" onClick={() => setOpen(false)} />}
      <div className={`sx-mnav__sheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label={tr("Tous les outils")} aria-hidden={!open}>
        <div className="sx-mnav__grip" />
        <div className="sx-mnav__title">{tr("Tous les outils")}</div>
        <div className="sx-mnav__grid">
          {items.map((it) => (
            <button key={it.id} type="button" tabIndex={open ? 0 : -1} className={`sx-mnav__tile${active === it.id ? " active" : ""}`} onClick={() => aller(it.id)}>
              <span className="sx-mnav__icon"><NavIcon id={it.id} fallback={it.icon} /></span>
              <span>{it.label}</span>
            </button>
          ))}
        </div>
        <div className="sx-mnav__links">
          <a href="https://video.noxelspectra.com/" rel="noopener" tabIndex={open ? 0 : -1}>{tr("Vidéo")}</a>
          <a href="https://www.noxelspectra.com/" rel="noopener" tabIndex={open ? 0 : -1}>{tr("Aide")}</a>
          <a href="https://noxel360.com/" rel="noopener" tabIndex={open ? 0 : -1}>NOXEL360</a>
          <button type="button" data-noxel-consent-settings tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>{tr("Préférences de confidentialité")}</button>
        </div>
      </div>

      <nav className="sx-mnav__bar" aria-label={tr("Navigation")}>
        {RACCOURCIS.map((r) => {
          const it = items.find((x) => x.id === r.id);
          if (!it) return null;
          const on = active === r.id && !open;
          return (
            <button key={r.id} type="button" className={`sx-mnav__btn${on ? " active" : ""}`} aria-current={on ? "page" : undefined} onClick={() => aller(r.id)}>
              <span className="sx-mnav__icon"><NavIcon id={r.id} fallback={it.icon} /></span>
              <span>{tr(r.court)}</span>
            </button>
          );
        })}
        <button type="button" className={`sx-mnav__btn${open || !raccourciActif ? " active" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="sx-mnav__icon" style={{ fontSize: 18 }}>{open ? "✕" : "☰"}</span>
          <span>{open ? tr("Fermer") : tr("Plus")}</span>
        </button>
      </nav>
    </div>
  );
}
