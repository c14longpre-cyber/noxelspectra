// NOXEL Spectra — Auteur, droits et licence
//
// Intègre des métadonnées XMP (standards IPTC et PLUS) lisibles par Lightroom,
// Bridge, les banques d'images et Google Images. Les métadonnées DÉCLARENT des
// droits : elles ne bloquent pas la copie et ne prouvent pas la propriété.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { HudButton, HudLink } from "../hud/HudButton";

type Fields = Record<string, string>;

type Props = {
  file: File | null;
  apiUrl: string;
  renderContinueButton: (url: string | null, label: string) => ReactNode;
  registerRecipePart: (url: string, rights: Fields) => void;
};

const DEFAULTS_KEY = "noxel-spectra-rights-defaults";
// Champs d'identité mémorisés pour la prochaine fois (dans ce navigateur seulement)
const IDENTITY = ["creator", "copyrightOwner", "credit", "contactEmail", "contactUrl", "contactPhone", "licensorName", "licensorUrl", "licenseChoice", "status"];

const CC: Record<string, { code: string; name: string }> = {
  "cc-by": { code: "by", name: "Attribution" },
  "cc-by-sa": { code: "by-sa", name: "Attribution - Partage dans les mêmes conditions" },
  "cc-by-nd": { code: "by-nd", name: "Attribution - Pas de modification" },
  "cc-by-nc": { code: "by-nc", name: "Attribution - Pas d'utilisation commerciale" },
  "cc-by-nc-sa": { code: "by-nc-sa", name: "Attribution - Pas d'utilisation commerciale - Partage dans les mêmes conditions" },
  "cc-by-nc-nd": { code: "by-nc-nd", name: "Attribution - Pas d'utilisation commerciale - Pas de modification" },
};

const LABELS: Record<string, string> = {
  creator: "Auteur / créateur", copyrightOwner: "Titulaire des droits", copyrightNotice: "Mention copyright",
  credit: "Crédit à afficher", usageTerms: "Conditions d'utilisation", webStatement: "Page des droits / licence",
  contactEmail: "Courriel", contactUrl: "Site", contactPhone: "Téléphone", licensorName: "Responsable des licences",
  licensorUrl: "Obtenir une autorisation", status: "Statut des droits", licenseId: "Identifiant de licence",
  licensee: "Bénéficiaire", licenseStart: "Début de licence", licenseEnd: "Fin de licence",
  regionConstraints: "Territoires", mediaConstraints: "Supports", alterationConstraints: "Modifications",
  otherConstraints: "Autres conditions", modelReleaseStatus: "Autorisation des personnes", modelReleaseId: "Réf. autorisation personnes",
  propertyReleaseStatus: "Autorisation des biens", propertyReleaseId: "Réf. autorisation biens", termsText: "Conditions contractuelles",
  termsUrl: "Lien du contrat", dataMining: "Fouille de données / IA", title: "Titre", description: "Description",
  dateCreated: "Date de création", identifier: "Identifiant", sourceType: "Type de source", aiSystem: "Outil IA",
  aiSystemVersion: "Version de l'outil", aiPromptWriter: "Auteur du prompt", aiPrompt: "Prompt",
};

const input = { width: "100%", marginTop: 4 } as const;

function loadDefaults(): Fields {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function RightsTool({ file, apiUrl, renderContinueButton, registerRecipePart }: Props) {
  const [f, setF] = useState<Fields>(() => ({ status: "copyrighted", licenseChoice: "arr", ...loadDefaults() }));
  const [remember, setRemember] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [origin, setOrigin] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [report, setReport] = useState<{ embedded: number; missing: string[]; xmp: boolean; format: string } | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);

  const set = (k: string) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  // Nouvelle image : on efface le résultat et on lit les droits déjà présents
  useEffect(() => {
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setReport(null);
    setError(null);
    setPrefillNote(null);
    if (!file) return;
    let cancelled = false;
    const fd = new FormData();
    fd.append("file", file);
    fetch(`${apiUrl}/api/read-rights`, { method: "POST", body: fd })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !data.count) return;
        setF((prev) => ({ ...prev, ...data.rights }));
        setPrefillNote(`${data.count} champ(s) déjà présent(s) dans l'image ont été repris dans le formulaire.`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [file, apiUrl]);

  // Licence → conditions d'utilisation + page de la licence
  function licenseFields(): Fields {
    const choice = f.licenseChoice || "arr";
    if (f.status === "public-domain") return { usageTerms: f.usageTerms || "Domaine public." };
    if (choice === "arr") return { usageTerms: f.usageTerms || "Tous droits réservés.", webStatement: f.webStatement || "" };
    if (choice === "custom") return { usageTerms: f.usageTerms || "", webStatement: f.webStatement || "" };
    const cc = CC[choice];
    return {
      usageTerms: `Cette œuvre est mise à disposition selon les termes de la licence Creative Commons ${cc.name} 4.0 International (CC ${cc.code.toUpperCase()} 4.0).`,
      webStatement: `https://creativecommons.org/licenses/${cc.code}/4.0/`,
    };
  }

  function buildRights(): Fields {
    const out: Fields = { ...f, ...licenseFields() };
    delete out.licenseChoice;
    if (out.status === "unknown") delete out.status;
    for (const k of Object.keys(out)) if (!out[k]?.trim()) delete out[k];
    return out;
  }

  function fillNotice() {
    const who = f.copyrightOwner || f.creator;
    if (who) setF((prev) => ({ ...prev, copyrightNotice: `© ${new Date().getFullYear()} ${who}` }));
  }

  async function handleEmbed() {
    if (!file) return;
    const rights = buildRights();
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("rights", JSON.stringify(rights));
      const res = await fetch(`${apiUrl}/api/copyright`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      const missing = (res.headers.get("X-Rights-Missing") || "").split(",").filter(Boolean);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      registerRecipePart(url, rights);
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setReport({
        embedded: Number(res.headers.get("X-Rights-Embedded") || 0),
        missing,
        xmp: res.headers.get("X-Rights-Xmp") === "true",
        format: res.headers.get("X-Format") || "",
      });
      if (remember) {
        const keep: Fields = {};
        for (const k of IDENTITY) if (f[k]) keep[k] = f[k];
        try {
          localStorage.setItem(DEFAULTS_KEY, JSON.stringify(keep));
        } catch {
          // stockage plein ou désactivé : sans conséquence
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intégration des droits échouée");
    } finally {
      setLoading(false);
    }
  }

  // Extrait JSON-LD pour la page qui publie l'image (Google Images : licence)
  const lic = licenseFields();
  const jsonLd =
    lic.webStatement || f.licensorUrl
      ? JSON.stringify(
          {
            "@context": "https://schema.org/",
            "@type": "ImageObject",
            contentUrl: "https://ton-site.com/chemin/image.webp",
            ...(lic.webStatement ? { license: lic.webStatement } : {}),
            ...(f.licensorUrl ? { acquireLicensePage: f.licensorUrl } : {}),
            ...(f.credit ? { creditText: f.credit } : {}),
            ...(f.creator ? { creator: { "@type": "Person", name: f.creator } } : {}),
            ...(f.copyrightNotice ? { copyrightNotice: f.copyrightNotice } : {}),
          },
          null,
          2
        )
      : null;

  const ext = report?.format === "jpeg" ? "jpg" : report?.format || "png";
  const isAI = f.sourceType === "trainedAlgorithmicMedia" || f.sourceType === "compositeWithTrainedAlgorithmicMedia";

  return (
    <div>
      <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
        Intègre l'auteur, les droits et la licence dans le fichier (standards IPTC et PLUS, lus par Lightroom,
        les banques d'images et Google Images). Ces informations <strong>déclarent</strong> tes droits : elles ne
        bloquent pas la copie et ne prouvent pas la propriété à elles seules. Les données privées de la photo (GPS,
        appareil) sont retirées.
      </p>
      {prefillNote && <p style={{ fontSize: 13, color: "#3ddc84" }}>{prefillNote}</p>}

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Auteur / créateur
          <input type="text" value={f.creator || ""} onChange={set("creator")} placeholder="Personne ou organisation" style={input} />
        </label>
        <label>
          Titulaire des droits
          <input type="text" value={f.copyrightOwner || ""} onChange={set("copyrightOwner")} placeholder="Peut différer de l'auteur" style={input} />
        </label>
        <div>
          <label>
            Mention copyright
            <input type="text" value={f.copyrightNotice || ""} onChange={set("copyrightNotice")} placeholder={`© ${new Date().getFullYear()} Titulaire`} style={input} />
          </label>
          {/* Hors du <label> : sinon l'étiquette se rattacherait au bouton plutôt qu'au champ */}
          <button type="button" className="ghost-button" onClick={fillNotice} disabled={!f.copyrightOwner && !f.creator} style={{ fontSize: 12, padding: "2px 10px", marginTop: 4, cursor: "pointer" }}>
            Générer « © {new Date().getFullYear()} {f.copyrightOwner || f.creator || "…"} »
          </button>
        </div>
        <label>
          Crédit à afficher
          <input type="text" value={f.credit || ""} onChange={set("credit")} placeholder="Photo : Nom / Studio" style={input} />
        </label>
        <label>
          Statut des droits
          <select value={f.status || "copyrighted"} onChange={set("status")} style={input}>
            <option value="copyrighted">Sous droit d'auteur</option>
            <option value="public-domain">Domaine public</option>
            <option value="unknown">Inconnu / non renseigné</option>
          </select>
        </label>
        {f.status !== "public-domain" && (
          <label>
            Licence
            <select value={f.licenseChoice || "arr"} onChange={set("licenseChoice")} style={input}>
              <option value="arr">Tous droits réservés</option>
              <option value="custom">Licence personnalisée</option>
              <optgroup label="Creative Commons 4.0">
                {Object.entries(CC).map(([id, cc]) => (
                  <option key={id} value={id}>
                    CC {cc.code.toUpperCase()} — {cc.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        )}
      </div>

      {f.licenseChoice?.startsWith("cc-") && f.status !== "public-domain" ? (
        <p style={{ fontSize: 13, color: "#aaa", margin: "10px 0 0" }}>
          {lic.usageTerms}{" "}
          <a href={lic.webStatement} target="_blank" rel="noreferrer">
            Voir la licence officielle
          </a>
          . Une licence Creative Commons n'est pas le domaine public : l'œuvre reste sous droit d'auteur.
        </p>
      ) : (
        <div className="controls-grid" style={{ marginTop: 12 }}>
          <label>
            Conditions d'utilisation
            <input type="text" value={f.usageTerms || ""} onChange={set("usageTerms")} placeholder={f.status === "public-domain" ? "Domaine public." : "Tous droits réservés."} style={input} />
          </label>
          {f.status !== "public-domain" && (
            <label>
              Page des droits / licence (URL)
              <input type="text" value={f.webStatement || ""} onChange={set("webStatement")} placeholder="https://…" style={input} />
            </label>
          )}
        </div>
      )}

      <div className="controls-grid" style={{ marginTop: 12 }}>
        <label>
          Contact : courriel
          <input type="text" value={f.contactEmail || ""} onChange={set("contactEmail")} placeholder="pro@exemple.com" style={input} />
        </label>
        <label>
          Contact : site
          <input type="text" value={f.contactUrl || ""} onChange={set("contactUrl")} placeholder="https://…" style={input} />
        </label>
        <label>
          Responsable des licences
          <input type="text" value={f.licensorName || ""} onChange={set("licensorName")} placeholder="Qui peut autoriser une utilisation" style={input} />
        </label>
        <label>
          Obtenir une autorisation (URL)
          <input type="text" value={f.licensorUrl || ""} onChange={set("licensorUrl")} placeholder="https://… (contact ou achat de licence)" style={input} />
        </label>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="ghost-button" onClick={() => setOrigin((v) => !v)} style={{ padding: "4px 12px", fontSize: 13, cursor: "pointer" }}>
          {origin ? "▾" : "▸"} Origine de l'image (titre, date, IA…)
        </button>
        <button type="button" className="ghost-button" onClick={() => setAdvanced((v) => !v)} style={{ padding: "4px 12px", fontSize: 13, cursor: "pointer" }}>
          {advanced ? "▾" : "▸"} Options avancées (licences, autorisations, IA)
        </button>
      </div>

      {origin && (
        <div className="controls-grid" style={{ marginTop: 12 }}>
          <label>
            Titre
            <input type="text" value={f.title || ""} onChange={set("title")} style={input} />
          </label>
          <label>
            Date de création connue
            <input type="date" value={f.dateCreated || ""} onChange={set("dateCreated")} style={input} />
          </label>
          <label>
            Identifiant unique
            <input type="text" value={f.identifier || ""} onChange={set("identifier")} placeholder="Ex. : NOX-0001" style={input} />
          </label>
          <label>
            Type de source
            <select value={f.sourceType || ""} onChange={set("sourceType")} style={input}>
              <option value="">Non renseigné</option>
              <option value="digitalCapture">Photographie</option>
              <option value="digitalCreation">Illustration / création logicielle</option>
              <option value="trainedAlgorithmicMedia">Générée par IA</option>
              <option value="compositeWithTrainedAlgorithmicMedia">Composition avec éléments IA</option>
              <option value="composite">Composition / montage</option>
            </select>
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Description
            <input type="text" value={f.description || ""} onChange={set("description")} style={input} />
          </label>
          {isAI && (
            <>
              <label>
                Outil IA
                <input type="text" value={f.aiSystem || ""} onChange={set("aiSystem")} placeholder="Ex. : Midjourney" style={input} />
              </label>
              <label>
                Version de l'outil
                <input type="text" value={f.aiSystemVersion || ""} onChange={set("aiSystemVersion")} style={input} />
              </label>
              <label>
                Auteur du prompt
                <input type="text" value={f.aiPromptWriter || ""} onChange={set("aiPromptWriter")} style={input} />
              </label>
              <label>
                Prompt (facultatif)
                <input type="text" value={f.aiPrompt || ""} onChange={set("aiPrompt")} style={input} />
              </label>
              {f.sourceType === "trainedAlgorithmicMedia" && (
                <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "#c89b3c", margin: 0 }}>
                  Pour une image entièrement générée, les recommandations IPTC suggèrent de laisser « Auteur » vide et
                  de renseigner ces champs IA : l'auteur du prompt n'est pas automatiquement l'auteur juridique de l'image.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {advanced && (
        <div className="controls-grid" style={{ marginTop: 12 }}>
          <label>
            Identifiant de licence
            <input type="text" value={f.licenseId || ""} onChange={set("licenseId")} style={input} />
          </label>
          <label>
            Bénéficiaire de la licence
            <input type="text" value={f.licensee || ""} onChange={set("licensee")} placeholder="Client autorisé" style={input} />
          </label>
          <label>
            Début de licence
            <input type="date" value={f.licenseStart || ""} onChange={set("licenseStart")} style={input} />
          </label>
          <label>
            Fin de licence
            <input type="date" value={f.licenseEnd || ""} onChange={set("licenseEnd")} style={input} />
          </label>
          <label>
            Restrictions territoriales
            <input type="text" value={f.regionConstraints || ""} onChange={set("regionConstraints")} placeholder="Ex. : Canada seulement" style={input} />
          </label>
          <label>
            Restrictions de supports
            <input type="text" value={f.mediaConstraints || ""} onChange={set("mediaConstraints")} placeholder="Ex. : Web, pas d'impression" style={input} />
          </label>
          <label>
            Restrictions de modification
            <input type="text" value={f.alterationConstraints || ""} onChange={set("alterationConstraints")} placeholder="Ex. : pas de recadrage" style={input} />
          </label>
          <label>
            Conditions supplémentaires
            <input type="text" value={f.otherConstraints || ""} onChange={set("otherConstraints")} style={input} />
          </label>
          <label>
            Autorisation des personnes photographiées
            <select value={f.modelReleaseStatus || ""} onChange={set("modelReleaseStatus")} style={input}>
              <option value="">Non renseigné</option>
              <option value="MR-NON">Aucune</option>
              <option value="MR-NAP">Sans objet</option>
              <option value="MR-UMR">Autorisations complètes</option>
              <option value="MR-LMR">Autorisations limitées</option>
            </select>
          </label>
          <label>
            Référence (personnes)
            <input type="text" value={f.modelReleaseId || ""} onChange={set("modelReleaseId")} style={input} />
          </label>
          <label>
            Autorisation des biens représentés
            <select value={f.propertyReleaseStatus || ""} onChange={set("propertyReleaseStatus")} style={input}>
              <option value="">Non renseigné</option>
              <option value="PR-NON">Aucune</option>
              <option value="PR-NAP">Sans objet</option>
              <option value="PR-UPR">Autorisations complètes</option>
              <option value="PR-LPR">Autorisations limitées</option>
            </select>
          </label>
          <label>
            Référence (biens)
            <input type="text" value={f.propertyReleaseId || ""} onChange={set("propertyReleaseId")} style={input} />
          </label>
          <label>
            Conditions contractuelles (texte)
            <input type="text" value={f.termsText || ""} onChange={set("termsText")} style={input} />
          </label>
          <label>
            Lien du contrat (URL)
            <input type="text" value={f.termsUrl || ""} onChange={set("termsUrl")} placeholder="https://…" style={input} />
          </label>
          <label>
            Fouille de données / entraînement IA
            <select value={f.dataMining || ""} onChange={set("dataMining")} style={input}>
              <option value="">Non renseigné</option>
              <option value="DMI-ALLOWED">Autorisé</option>
              <option value="DMI-PROHIBITED-AIMLTRAINING">Interdit pour l'entraînement IA</option>
              <option value="DMI-PROHIBITED-GENAIMLTRAINING">Interdit pour l'entraînement d'IA générative</option>
              <option value="DMI-PROHIBITED-EXCEPTSEARCHENGINEINDEXING">Interdit, sauf indexation par les moteurs de recherche</option>
              <option value="DMI-PROHIBITED">Interdit</option>
            </select>
          </label>
          <p style={{ gridColumn: "1 / -1", fontSize: 12, color: "#888", margin: 0 }}>
            Ces champs décrivent des autorisations ou des restrictions ; ils ne remplacent pas les documents
            correspondants. Une restriction d'entraînement IA inscrite ici n'est pas un blocage technique.
          </p>
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13 }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Mémoriser mon identité et ma licence pour la prochaine fois (dans ce navigateur seulement)
      </label>

      <HudButton
        action="protect"
        label="Intégrer les droits"
        busyLabel="Intégration…"
        disabled={!file}
        busy={loading}
        onClick={handleEmbed}
        style={{ marginTop: 16 }}
      />

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      {report && resultUrl && (
        <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, fontSize: 14 }}>
          {report.xmp ? (
            <div style={{ color: "#3ddc84", fontWeight: 600 }}>
              ✓ {report.embedded} champ(s) intégré(s) et vérifié(s) dans le fichier exporté
            </div>
          ) : (
            <div style={{ color: "#c89b3c" }}>
              Le format {report.format.toUpperCase()} ne prend pas en charge ces métadonnées. Convertis d'abord l'image en
              PNG, WebP, JPEG ou AVIF.
            </div>
          )}
          {report.xmp && report.missing.length > 0 && (
            <div style={{ color: "#c89b3c", marginTop: 4 }}>
              Non pris en charge par ce format : {report.missing.map((k) => LABELS[k] || k).join(", ")}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
            Astuce : fais cette étape en dernier. Les autres outils retirent les métadonnées ; dans une recette de lot,
            les droits sont réintégrés automatiquement à la fin.
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <HudLink action="download-protected" compact label="Télécharger l'image avec ses métadonnées" href={resultUrl} download={`image-droits.${ext}`} />
            {renderContinueButton(resultUrl, "Droits")}
          </div>
        </div>
      )}

      {jsonLd && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13 }}>Pour Google Images : extrait JSON-LD à placer sur la page qui publie l'image</summary>
          <p style={{ fontSize: 12, color: "#888" }}>
            Google peut afficher la licence et le lien d'autorisation à partir de ces informations, sans garantie
            d'affichage ni de meilleur classement. Remplace « contentUrl » par l'adresse réelle de l'image.
          </p>
          <pre style={{ fontSize: 12, background: "rgba(255,255,255,0.06)", padding: 10, borderRadius: 8, overflowX: "auto" }}>
            {`<script type="application/ld+json">\n${jsonLd}\n</script>`}
          </pre>
          <HudButton
            action="copy-srcset"
            compact
            label={jsonCopied ? "Copié !" : "Copier l'extrait"}
            onClick={() =>
              navigator.clipboard.writeText(`<script type="application/ld+json">\n${jsonLd}\n</script>`).then(() => {
                setJsonCopied(true);
                setTimeout(() => setJsonCopied(false), 1200);
              })
            }
          />
        </details>
      )}
    </div>
  );
}
