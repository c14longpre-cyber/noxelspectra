// Vérificateur de contraste WCAG : une couleur de texte, une couleur de fond, le rapport et les
// critères 1.4.3 (AA), 1.4.6 (AAA) et 1.4.11 (composants d'interface). Les deux couleurs se prennent
// dans l'image avec la pipette (bouton « Viser »), à l'écran, ou se tapent en hexadécimal.
import { useState } from "react";
import { tr } from "../../i18n";
import { contraste, couleurProche, CRITERES, hexEnRgb, normaliserHex } from "./colorMath";

export type Cible = "texte" | "fond";

type Props = {
  texte: string;
  fond: string;
  cible: Cible | null;
  setCible: (c: Cible | null) => void;
  setTexte: (hex: string) => void;
  setFond: (hex: string) => void;
};

function Champ({ nom, valeur, actif, onViser, onChange }: { nom: string; valeur: string; actif: boolean; onViser: () => void; onChange: (hex: string) => void }) {
  const [saisie, setSaisie] = useState(valeur);
  const [vu, setVu] = useState(valeur);
  if (vu !== valeur) { setVu(valeur); setSaisie(valeur); } // couleur changée par la pipette
  const valide = normaliserHex(saisie);
  return (
    <div style={{ flex: "1 1 220px", border: actif ? "2px solid #3ddc84" : "1px solid rgba(255,255,255,.18)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>{nom}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={tr("Choisir la couleur : {nom}", { nom })}
          style={{ width: 40, height: 36, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
        <input type="text" value={saisie} spellCheck={false} aria-label={tr("Code hexadécimal : {nom}", { nom })}
          onChange={(e) => { setSaisie(e.target.value); const h = normaliserHex(e.target.value); if (h) onChange(h); }}
          style={{ width: 96, fontFamily: "monospace", fontSize: 14, padding: "7px 8px", borderRadius: 6, border: valide ? "1px solid #ddd" : "1px solid #ff6b6b", background: "#fff", color: "#111" }} />
        <button type="button" onClick={onViser} aria-pressed={actif}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #3ddc84", background: actif ? "#3ddc84" : "transparent", color: actif ? "#07090f" : "inherit", cursor: "pointer", fontSize: 13 }}>
          {actif ? tr("Cliquez dans l'image…") : tr("Viser dans l'image")}
        </button>
      </div>
    </div>
  );
}

export function ContrastChecker({ texte, fond, cible, setCible, setTexte, setFond }: Props) {
  const t = hexEnRgb(texte), f = hexEnRgb(fond);
  const r = contraste(t, f);
  const NOMS: Record<(typeof CRITERES)[number]["id"], string> = {
    aa: tr("Texte normal, AA"),
    aaLarge: tr("Gros texte, AA"),
    aaa: tr("Texte normal, AAA"),
    aaaLarge: tr("Gros texte, AAA"),
    ui: tr("Icônes et contours de champs (1.4.11)"),
  };
  const proche = r < 4.5 ? couleurProche(t, f, 4.5) : null;

  return (
    <section aria-labelledby="contraste-titre" style={{ marginTop: 32 }}>
      <h3 id="contraste-titre" style={{ fontSize: 16, marginBottom: 4 }}>{tr("Vérificateur de contraste WCAG")}</h3>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        {tr("Prenez la couleur du texte puis celle du fond directement dans l'image, ou tapez leurs codes. Le rapport est calculé avec la formule des WCAG 2.2.")}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        <Champ nom={tr("Texte")} valeur={texte} actif={cible === "texte"} onViser={() => setCible(cible === "texte" ? null : "texte")} onChange={setTexte} />
        <button type="button" onClick={() => { setTexte(fond); setFond(texte); }} title={tr("Inverser texte et fond")} aria-label={tr("Inverser texte et fond")}
          style={{ alignSelf: "center", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 16 }}>⇄</button>
        <Champ nom={tr("Fond")} valeur={fond} actif={cible === "fond"} onViser={() => setCible(cible === "fond" ? null : "fond")} onChange={setFond} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
        <div style={{ flex: "1 1 280px", background: fond, color: texte, borderRadius: 10, padding: "16px 18px", border: "1px solid rgba(255,255,255,.15)" }}>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25 }}>{tr("Gros texte (24 px)")}</div>
          <div style={{ fontSize: 16, marginTop: 6 }}>{tr("Texte normal de 16 px : voici à quoi ressemble votre paragraphe.")}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>{tr("Petit texte de 13 px, comme une mention en bas de page.")}</div>
        </div>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{r.toFixed(2)}:1</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {CRITERES.map((c) => {
              const ok = r >= c.seuil;
              return (
                <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                  <span>{NOMS[c.id]} <span style={{ color: "#888" }}>({c.seuil}:1)</span></span>
                  <strong style={{ color: ok ? "#3ddc84" : "#ff6b6b" }}>{ok ? tr("Réussi") : tr("Échoué")}</strong>
                </li>
              );
            })}
          </ul>
          <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>{tr("Gros texte : 24 px, ou 18,66 px en gras.")}</p>
        </div>
      </div>

      {r < 4.5 && (
        <p style={{ fontSize: 14, marginTop: 12 }}>
          {proche ? (
            <>
              {tr("Couleur de texte la plus proche qui réussit AA sur ce fond :")}{" "}
              <button type="button" onClick={() => setTexte(proche)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#111", cursor: "pointer", fontFamily: "monospace", fontSize: 13 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: proche, border: "1px solid rgba(0,0,0,.15)" }} />{proche}
              </button>{" "}
              <span style={{ color: "#888" }}>{tr("(même teinte, clic pour l'essayer)")}</span>
            </>
          ) : tr("Aucune nuance de cette teinte n'atteint AA sur ce fond : changez la couleur du fond.")}
        </p>
      )}
    </section>
  );
}
