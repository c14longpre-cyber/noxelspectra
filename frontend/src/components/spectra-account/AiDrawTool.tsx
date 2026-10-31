// Dessin IA — FLUX.2 [pro]. Le coût en crédits est affiché avant chaque génération.
import { useEffect, useRef, useState } from "react";
import { HudButton } from "../hud/HudButton";
import { API_URL, apiFetch, lireErreur, openLogin, openPricing, rafraichirCompte, useAccount } from "./account";

interface AiInfo { enabled: boolean; costPerImage: number; formats: Record<string, { label: string; width: number; height: number }> }

export function AiDrawTool({ onUseImage }: { onUseImage: (file: File) => void }) {
  const { account, accountsEnabled } = useAccount();
  const [info, setInfo] = useState<AiInfo | null>(null);
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("carre");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ url: string; blob: Blob } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_URL}/api/ai/info`).then((r) => r.json()).then(setInfo).catch(() => setInfo(null));
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); };  // libérée au démontage
  }, []);

  const cout = info?.costPerImage ?? 1;
  const reste = account?.credits.total ?? 0;
  const pasAssez = !!account && reste < cout;

  async function generer() {
    if (!account) { openLogin(); return; }
    if (pasAssez) { openPricing(); return; }
    setBusy(true); setErreur(null);
    try {
      const r = await apiFetch(`${API_URL}/api/ai/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, format }),
      });
      if (r.status === 401) { openLogin(); return; }
      if (!r.ok) throw new Error(await lireErreur(r));
      const blob = await r.blob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setResultat({ url, blob });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La génération a échoué.");
    } finally {
      setBusy(false);
      void rafraichirCompte();  // crédits à jour (rendus si l'image a échoué)
    }
  }

  function nomFichier() {
    const ext = resultat?.blob.type.includes("png") ? "png" : resultat?.blob.type.includes("webp") ? "webp" : "jpg";
    const base = prompt.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-|-$/g, "");
    return `${base || "dessin-ia"}-noxel-spectra.${ext}`;
  }

  if (!accountsEnabled || (info && !info.enabled)) {
    return <p className="sp-info">Le dessin IA arrive bientôt sur NOXEL SPECTRA.</p>;
  }

  return (
    <div className="sp-ai">
      <label className="sp-ai__label" htmlFor="sp-ai-prompt">Décris l'image à dessiner</label>
      <textarea id="sp-ai-prompt" className="sp-ai__prompt" rows={4} maxLength={2000} value={prompt}
        placeholder="Ex. : une tasse de café fumante sur une table en bois, lumière du matin, style photo"
        onChange={(e) => setPrompt(e.target.value)} />
      <div className="controls-grid" style={{ marginTop: 10 }}>
        <label>Format :{" "}
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {Object.entries(info?.formats ?? {}).map(([id, f]) => <option key={id} value={id}>{f.label} — {f.width}×{f.height}px</option>)}
          </select>
        </label>
      </div>

      <div className="sp-ai__cost" role="note">
        <strong>Coût : {cout} crédit{cout > 1 ? "s" : ""} par image.</strong>{" "}
        {account
          ? <>Il te reste {reste} crédit{reste > 1 ? "s" : ""} ({account.credits.inclus} inclus ce mois-ci, {account.credits.achetes} achetés). Un crédit est rendu si la génération échoue.</>
          : <>Connecte-toi pour utiliser tes crédits : le dessin IA est inclus à partir du forfait Silver.</>}
      </div>

      <HudButton action="suggest-frames" busy={busy} busyLabel="Dessin en cours… (jusqu'à 1 minute)"
        disabled={prompt.trim().length < 3}
        label={!account ? "Se connecter pour dessiner" : pasAssez ? "Obtenir des crédits" : `Dessiner (${cout} crédit${cout > 1 ? "s" : ""})`}
        onClick={generer} style={{ marginTop: 12 }} />

      {erreur && <p className="sp-error" role="alert">{erreur}</p>}

      {resultat && (
        <div className="sp-ai__result">
          <img src={resultat.url} alt={`Image dessinée par l'IA : ${prompt}`} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <a className="nx-pill" href={resultat.url} download={nomFichier()} style={{ textDecoration: "none" }}>⬇ Télécharger</a>
            <HudButton action="continue" compact label="Retoucher avec les outils SPECTRA"
              onClick={() => onUseImage(new File([resultat.blob], nomFichier(), { type: resultat.blob.type }))} />
          </div>
          <p className="sp-ai__legal">Image générée par IA (FLUX.2 [pro]). Indique-le si tu la publies là où c'est exigé.</p>
        </div>
      )}
    </div>
  );
}
