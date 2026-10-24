// Couleur d'un texte (Texte & logo, Filigrane, titre de Miniature) : unie ou dégradé.
// Dégradé : modèles prédéfinis, sens (horizontal, vertical, diagonal, du centre vers l'extérieur)
// et jusqu'à 10 couleurs dont l'emplacement se règle comme dans Spectra image.
import { GRADIENTS, fillCss, fillDir, gradientCss, rawStops } from "../lib/overlay";
import type { Fill, GradDir } from "../lib/overlay";
import { GradientStops } from "./GradientStops";
import "../textlogo.css";

export const DEFAULT_COLORS: [string, string][] = [["#ffffff", "blanc"], ["#07090f", "noir"], ["#3ddc84", "vert NOXEL"], ["#a855f7", "mauve NOXEL"], ["#ffd23f", "jaune"], ["#ff4d6d", "rose"]];
const DIRS: { id: GradDir; label: string; icon: string }[] = [
  { id: "horizontal", label: "Horizontal (de gauche à droite)", icon: "→" },
  { id: "vertical", label: "Vertical (de haut en bas)", icon: "↓" },
  { id: "diagonal", label: "En diagonale", icon: "↘" },
  { id: "radial", label: "Du centre vers l'extérieur", icon: "◎" },
];

export function FillEditor({ value, onChange, colors = DEFAULT_COLORS, label = "Couleur" }: {
  value: Fill; onChange: (fill: Fill) => void; colors?: [string, string][]; label?: string;
}) {
  const grad = value.kind === "gradient" ? value : null;
  return (
    <div className="vx-fill">
      <div className="vx-row" role="group" aria-label={`${label} unie`}>
        {colors.map(([c, name]) => (
          <button key={c} type="button" className={`vx-swatch${value.kind === "solid" && value.color === c ? " is-on" : ""}`} style={{ background: c }}
            aria-label={`Couleur ${name}`} title={name} aria-pressed={value.kind === "solid" && value.color === c} onClick={() => onChange({ kind: "solid", color: c })} />
        ))}
        <input type="color" aria-label="Autre couleur" value={value.kind === "solid" ? value.color : "#ffffff"} onChange={(e) => onChange({ kind: "solid", color: e.target.value })} />
      </div>
      <div className="vx-row" role="group" aria-label="Dégradé" style={{ marginTop: 8 }}>
        <span className="vx-muted">Dégradés :</span>
        {GRADIENTS.map((g) => (
          <button key={g.id} type="button" className={`vx-grad${grad?.id === g.id ? " is-on" : ""}`} style={{ background: gradientCss(g) }}
            aria-label={`Dégradé ${g.name}`} title={g.name} aria-pressed={grad?.id === g.id}
            // Garde le sens choisi ; les couleurs reprennent celles du modèle
            onClick={() => onChange({ kind: "gradient", id: g.id, ...(grad?.dir ? { dir: grad.dir } : {}) })} />
        ))}
      </div>
      {grad && (
        <div className="vx-fill-grad">
          <div className="vx-fill-head">
            <span className="vx-fill-preview" style={{ background: fillCss(grad) }} aria-hidden="true" />
            <div className="vx-dirs" role="radiogroup" aria-label="Sens du dégradé">
              {DIRS.map((d) => {
                const on = fillDir(grad) === d.id;
                return (
                  <button key={d.id} type="button" role="radio" aria-checked={on} className={`vx-dir${on ? " is-on" : ""}`} title={d.label} aria-label={d.label}
                    onClick={() => onChange({ ...grad, dir: d.id })}>{d.icon}</button>
                );
              })}
            </div>
          </div>
          <p className="vx-muted" style={{ margin: "8px 0 4px" }}>
            Glisse une pastille sur la barre ou règle son emplacement. {fillDir(grad) === "radial" ? "0 % = centre, 100 % = coins." : ""} Choisir un modèle reprend ses couleurs.
          </p>
          <GradientStops stops={rawStops(grad)} onChange={(stops) => onChange({ ...grad, stops })} />
        </div>
      )}
    </div>
  );
}
