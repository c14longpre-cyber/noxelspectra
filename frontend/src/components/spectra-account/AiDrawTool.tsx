// Dessin IA — FLUX.2 [pro]. Le coût en crédits est affiché avant chaque génération.
import { useEffect, useRef, useState } from "react";
import { HudButton } from "../hud/HudButton";
import { API_URL, apiFetch, lireErreur, openLogin, openPricing, rafraichirCompte, useAccount } from "./account";

import { tr, pl } from "../../i18n";
import { SOCIAL_GROUPS, SOCIAL_PRESETS, ratioLabel } from "../../socialPresets";
interface AiInfo {
  enabled: boolean; costPerImage: number; formats: Record<string, { label: string; width: number; height: number }>;
  sizeRule?: { oneCreditUpToMP: number; maxCredits: number };
}

const LIBRE = "";  // format libre (liste du serveur) ; sinon nom du réseau social

export function AiDrawTool({ onUseImage }: { onUseImage: (file: File) => void }) {
  const { account, accountsEnabled } = useAccount();
  const [info, setInfo] = useState<AiInfo | null>(null);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("carre");
  const [reseau, setReseau] = useState(LIBRE);
  const [typeIndex, setTypeIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ url: string; blob: Blob } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/ai/info`).then((r) => r.json()).then(setInfo).catch(() => setInfo(null));
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };  // libérée au démontage
  }, []);

  // Format d'un réseau social : taille exacte demandée au serveur, coût selon la taille (même règle que le serveur)
  const preset = reseau ? SOCIAL_PRESETS[reseau]?.[typeIndex] : undefined;
  const regle = info?.sizeRule ?? { oneCreditUpToMP: 1.5, maxCredits: 2 };
  const cout = preset
    ? ((preset.width * preset.height) / 1e6 > regle.oneCreditUpToMP ? regle.maxCredits : 1)
    : info?.costPerImage ?? 1;
  const reste = account?.credits.total ?? 0;
  const pasAssez = !!account && reste < cout;

  async function generer() {
    if (!account) { openLogin(); return; }
    if (pasAssez) { openPricing(); return; }
    setBusy(true); setErreur(null);
    try {
      const r = await apiFetch(`${API_URL}/api/ai/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preset ? { prompt, size: { width: preset.width, height: preset.height } } : { prompt, format }),
      });
      if (r.status === 401) { openLogin(); return; }
      if (!r.ok) throw new Error(await lireErreur(r));
      const blob = await r.blob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResultat({ url, blob });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : tr("La génération a échoué."));
    } finally {
      setBusy(false);
      void rafraichirCompte();  // crédits à jour (rendus si l'image a échoué)
    }
  }

  function nomFichier() {
    const ext = resultat?.blob.type.includes("png") ? "png" : resultat?.blob.type.includes("webp") ? "webp" : "jpg";
    const base = prompt.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
    const taille = preset ? `-${reseau.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${preset.width}x${preset.height}` : "";
    return `${base || "dessin-ia"}${taille}-noxel-spectra.${ext}`;
  }

  if (!accountsEnabled || (info && !info.enabled)) {
    return <p className="sp-info">{tr("Le dessin IA arrive bientôt sur NOXEL SPECTRA.")}</p>;
  }

  return (
    <div className="sp-ai">
      <label className="sp-ai__label" htmlFor="sp-ai-prompt">{tr("Décris l'image à dessiner")}</label>
      <textarea id="sp-ai-prompt" className="sp-ai__prompt" rows={4} maxLength={2000} value={prompt}
        placeholder={tr("Ex. : une tasse de café fumante sur une table en bois, lumière du matin, style photo")}
        onChange={(e) => setPrompt(e.target.value)} />
      <p className="sp-ai__hint">{tr("Astuce : pour un mot écrit dans l'image (enseigne, titre), mets-le entre guillemets, par exemple « NOXEL ».")}</p>
      <div className="controls-grid" style={{ marginTop: 10 }}>
        <label>{tr("Pour :")}{" "}
          <select value={reseau} onChange={(e) => { setReseau(e.target.value); setTypeIndex(0); }}>
            <option value={LIBRE}>{tr("Format libre")}</option>
            {SOCIAL_GROUPS.map((g) => (
              <optgroup key={g.group} label={tr(g.group)}>
                {Object.keys(g.presets).map((n) => <option key={n} value={n}>{n}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {reseau ? (
          <label>{tr("Image :")}{" "}
            <select value={typeIndex} onChange={(e) => setTypeIndex(Number(e.target.value))}>
              {SOCIAL_PRESETS[reseau].map((p, i) => <option key={i} value={i}>{tr(p.label)} — {p.width}×{p.height}px</option>)}
            </select>
          </label>
        ) : (
          <label>{tr("Format :")}{" "}
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {Object.entries(info?.formats ?? {}).map(([id, f]) => <option key={id} value={id}>{tr(f.label)} — {f.width}×{f.height}px</option>)}
            </select>
          </label>
        )}
      </div>
      {preset && (
        <p className="sp-ai__hint">
          {tr("L'IA dessine directement aux proportions de {a} ({b}), puis l'image est mise aux dimensions exactes : {c} × {d} px, prête à téléverser.", { a: `${reseau} · ${tr(preset.label)}`, b: ratioLabel(preset.width, preset.height), c: preset.width, d: preset.height })}
          {preset.shape === "circle" ? " " + tr("Ce réseau affiche cette image en rond : décris un sujet centré, avec de la marge autour.") : ""}
          {preset.safe
            ? " " + tr("Sur un téléphone, seul le centre ({a} × {b} px) reste visible : décris un sujet centré et garde les côtés pour le décor.", { a: Math.round(preset.safe.w * preset.width), b: Math.round(preset.safe.h * preset.height) })
            : preset.note ? " " + tr(preset.note) : ""}
          {cout > 1 ? " " + tr("Grande image : {a} crédits.", { a: cout }) : ""}
        </p>
      )}

      <div className="sp-ai__cost" role="note">
        <strong>{tr("Coût :")}{" "}{cout} {tr("crédit")}{pl(cout)} {tr("par image.")}</strong>{" "}
        {account
          ? <>{tr("Il te reste")}{" "}{reste} {tr("crédit")}{pl(reste)} ({account.credits.inclus} {tr("inclus ce mois-ci,")}{" "}{account.credits.achetes} {tr("achetés). Un crédit est rendu si la génération échoue.")}</>
          : <>{tr("Connecte-toi pour utiliser tes crédits : le dessin IA est inclus à partir du forfait Silver.")}</>}
        <p className="sp-ai__buy">
          {tr("Besoin de plus de crédits ? Achète un paquet (sans date limite) ou choisis un forfait qui en inclut chaque mois, dans la section Forfaits.")}{" "}
          <button type="button" className="sp-ai__link" onClick={openPricing}>{tr("Acheter des crédits →")}</button>
        </p>
      </div>

      <HudButton action="suggest-frames" busy={busy} busyLabel={tr("Dessin en cours… (jusqu'à 1 minute)")}
        disabled={prompt.trim().length < 3}
        label={!account ? tr("Se connecter pour dessiner") : pasAssez ? tr("Obtenir des crédits") : tr("Dessiner ({a} crédit{b})", { a: cout, b: pl(cout) })}
        onClick={generer} style={{ marginTop: 12 }} />

      {erreur && <p className="sp-error" role="alert">{erreur}</p>}

      {resultat && (
        <div className="sp-ai__result">
          <img src={resultat.url} alt={tr("Image dessinée par l'IA : {a}", { a: prompt })} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <a className="nx-pill" href={resultat.url} download={nomFichier()} style={{ textDecoration: "none" }}>{tr("⬇ Télécharger")}</a>
            <HudButton action="continue" compact label={tr("Retoucher avec les outils SPECTRA")}
              onClick={() => onUseImage(new File([resultat.blob], nomFichier(), { type: resultat.blob.type }))} />
          </div>
          <p className="sp-ai__legal">{tr("Image générée par IA (FLUX.2 [pro]). Indique-le si tu la publies là où c'est exigé.")}</p>
        </div>
      )}
    </div>
  );
}
