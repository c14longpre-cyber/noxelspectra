import { LANGUAGES_115 } from "../../i18n/languages";
import { tr } from "../../i18n";

/** Pastille de langue pour l'en-tête (drapeau · code · nom) */
export function LangPill({ lang, onClick }: { lang: string; onClick: () => void }) {
  const m = LANGUAGES_115.find((l) => l.code === lang);
  return (
    <button type="button" className="nx-pill" onClick={onClick} aria-label={tr("Langue")} data-nexus-pill>
      <span aria-hidden="true">{m?.flag || "🌐"}</span>
      <span className="nx-pill__code">{lang.toUpperCase()}</span>
      <span className="nx-pill__muted">{m?.native || ""}</span>
      <span className="nx-caret" aria-hidden="true">▼</span>
    </button>
  );
}
