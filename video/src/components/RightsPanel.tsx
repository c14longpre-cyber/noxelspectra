// NOXEL Spectra Vidéo — Copyright : droits inscrits dans le fichier, filigrane visible, vérification
import { useEffect, useMemo, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { loadLogo } from "../lib/overlay";
import type { OverlayItem } from "../lib/overlay";
import { EMPTY_RIGHTS, LICENSES, PLACES, containerFor, copyrightNotice, layoutMark, planRights, readRights, shortNotice, writeRights } from "../lib/rights";
import type { FoundRights, Mark, Rights, RightsResult } from "../lib/rights";
import { formatSupport } from "../lib/compress";
import type { CompressFormat } from "../lib/compress";
import { fmtBitrate, fmtBytes, fmtTime } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";
import { useCancel } from "../lib/useCancel";
import "../textlogo.css";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  duration: number;
  onPreview: (items: OverlayItem[]) => void; // filigrane à montrer sur l'aperçu
  onContinue: (blob: Blob, ext: string, suffix: string) => void;
};

// Ce qui identifie l'auteur est gardé sur cet appareil pour la prochaine vidéo (jamais envoyé)
const MEMORY_KEY = "spectra-video-rights";
const REMEMBERED: (keyof Rights)[] = ["creator", "owner", "license", "customLicense", "termsUrl", "website", "contact"];
function recall(): Partial<Rights> {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMORY_KEY) || "{}");
    return Object.fromEntries(REMEMBERED.filter((k) => typeof saved[k] === "string").map((k) => [k, saved[k]]));
  } catch {
    return {};
  }
}
const pc = (v: number) => Math.round(v * 100);
const NO_MARK: Mark = { kind: "none", text: "", logo: null, place: "br", size: 0.045, opacity: 0.7, rotation: 0 };

// Réglages gardés tant que la page est ouverte : changer d'outil puis revenir ne les efface pas.
// Pour une autre vidéo, on garde l'identité et les réglages du filigrane, mais le filigrane est
// désactivé (un résultat rechargé le porte déjà) et le titre et la description repartent à vide.
type Session = { file: File; rights: Rights; mark: Mark; sizes: { text: number; logo: number }; markTextEdited: boolean; keepOther: boolean; remember: boolean };
let session: Session | null = null;
function restore(file: File): Omit<Session, "file"> {
  if (!session) return { rights: { ...EMPTY_RIGHTS, ...recall() }, mark: NO_MARK, sizes: { text: 0.045, logo: 0.16 }, markTextEdited: false, keepOther: false, remember: true };
  if (session.file === file) return session;
  return { ...session, rights: { ...session.rights, title: "", description: "" }, mark: { ...session.mark, kind: "none" } };
}

export function RightsPanel({ file, info, range, duration, onPreview, onContinue }: Props) {
  const [initial] = useState(() => restore(file));
  const [rights, setRights] = useState<Rights>(initial.rights);
  const [remember, setRemember] = useState(initial.remember);
  const [keepOther, setKeepOther] = useState(initial.keepOther);
  const [mark, setMark] = useState<Mark>(initial.mark);
  const [markTextEdited, setMarkTextEdited] = useState(initial.markTextEdited);
  // Dernière taille choisie pour chaque type de filigrane, retrouvée en y revenant
  const [sizes, setSizes] = useState(initial.sizes);
  const setSize = (size: number) => { setMark((m) => ({ ...m, size })); if (mark.kind !== "none") setSizes((s) => ({ ...s, [mark.kind]: size })); };
  useEffect(() => { session = { file, rights, mark, sizes, markTextEdited, keepOther, remember }; }, [file, rights, mark, sizes, markTextEdited, keepOther, remember]);
  const [found, setFound] = useState<FoundRights | null>(null);
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(RightsResult & { url: string; source: number }) | null>(null);
  const job = useCancel();
  const urls = useRef<string[]>([]);
  const logoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { formatSupport().then(setSupport); }, []);
  // Les fichiers produits ne sont libérés qu'en quittant l'outil
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  // Ce que la vidéo contient déjà
  useEffect(() => {
    let current = true;
    setFound(null);
    readRights(file).then((f) => { if (current) setFound(f); }).catch(() => {});
    return () => { current = false; };
  }, [file]);

  const set = (patch: Partial<Rights>) => setRights((r) => ({ ...r, ...patch }));
  const container = containerFor(info.video?.codec);
  const plan = useMemo(() => planRights(rights, container), [rights, container]);
  const notice = copyrightNotice(rights);
  // Champs d'origine que nos champs remplaceront (utile quand on garde les métadonnées d'origine)
  const slot = (where: string) => where.replace(/^.*\(|\)$/g, "");
  const SLOTS: Record<string, string[]> = { Titre: ["©nam", "TITLE"], Auteur: ["©ART", "ARTIST"], "Mention de droits": ["cprt", "COPYRIGHT"], Description: ["desc", "DESCRIPTION"], Commentaire: ["©cmt", "COMMENT"], Licence: ["LICENSE"], "Conditions d'utilisation": ["TERMS_OF_USE"], "Site web": ["URL"], Contact: ["EMAIL"] };
  const replaced = (found?.fields || []).filter((f) => plan.fields.some((p) => (SLOTS[f.label] || []).includes(slot(p.where)))).map((f) => f.label);

  // Le texte du filigrane suit la mention de droits tant qu'il n'a pas été modifié à la main
  const markText = markTextEdited ? mark.text : shortNotice(rights);
  const effectiveMark: Mark = { ...mark, text: markText };
  const frameW = info.video?.width || 0, frameH = info.video?.height || 0;
  const layout = useMemo(
    () => layoutMark(effectiveMark, 0, Math.max(duration, range[1]), frameW, frameH),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mark.kind, markText, mark.logo, mark.place, mark.size, mark.opacity, mark.rotation, duration, range[1], frameW, frameH]
  );
  const overlays = layout.items;
  useEffect(() => { onPreview(overlays); }, [overlays, onPreview]);
  useEffect(() => () => onPreview([]), [onPreview]);

  // Un résultat décrit les réglages du moment où il a été produit
  useEffect(() => { setResult(null); }, [rights, keepOther, overlays, range[0], range[1]]);

  async function pickLogo(f: File | null) {
    if (!f) return;
    setError(null);
    try {
      const { image, ratio } = await loadLogo(f);
      setMark((m) => ({ ...m, kind: "logo", logo: { image, ratio, fileName: f.name } }));
    } catch {
      setError("Cette image n'a pas pu être lue par le navigateur (essaie un PNG, JPG, WebP ou SVG).");
    }
  }

  // Ce que le traitement fera, dit avant d'agir
  const reencode = overlays.length > 0;
  const codecName = container === "webm" ? "VP9" : "H.264";
  const formatName = container === "webm" ? "WebM" : "MP4";
  const emptySelection = range[1] - range[0] < 0.05;
  const canEncode = !reencode || !support || (container === "webm" ? support.webm : support.mp4);
  const bitrate = Math.round((info.video?.bitrate || 2e6) * 0.95);
  const sourceBytes = file.size * ((range[1] - range[0]) / Math.max(info.duration, 0.001));
  const nothing = plan.fields.length === 0 && !reencode;
  const markWanted = mark.kind !== "none" && !reencode; // filigrane choisi mais vide

  async function run() {
    job.begin();
    setError(null);
    setResult(null);
    setProgress(0);
    if (remember) {
      try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify(Object.fromEntries(REMEMBERED.map((k) => [k, rights[k]]))));
      } catch { /* stockage indisponible : sans conséquence */ }
    }
    try {
      const r = await writeRights(file, rights, { start: range[0], end: range[1], overlays, keepOther, sourceBitrate: bitrate, videoCodec: info.video?.codec || null }, setProgress, job.register);
      if (job.stopped.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      setResult({ ...r, url, source: sourceBytes });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Traitement impossible : ${e.message}` : "Traitement impossible.");
    } finally {
      setProgress(null);
      job.end();
    }
  }

  function forget() {
    try { localStorage.removeItem(MEMORY_KEY); } catch { /* rien à effacer */ }
    setRemember(false);
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  // Champs de droits présents dans le fichier produit que nous n'avons pas écrits nous-mêmes
  const kept = (r: RightsResult) => r.after.fields.filter((f) => !r.checks.some((c) => c.found === f.value)).map((f) => f.label);

  return (
    <div className="vx-rights">
      <p className="vx-muted">
        Les métadonnées <b>déclarent</b> tes droits : elles ne bloquent pas la copie et ne prouvent pas la propriété à elles seules, et une plateforme qui réencode la vidéo peut les retirer.
        Le filigrane, lui, est dans l'image : il reste visible même si la vidéo est réencodée, mais un recadrage peut le couper s'il est dans un coin.
      </p>

      <h4 className="vx-code-title">Dans cette vidéo actuellement</h4>
      {!found ? <p className="vx-muted">Lecture des métadonnées…</p> : (
        <>
          {found.fields.length === 0
            ? <p className="vx-muted">Aucun droit n'est inscrit dans ce fichier.</p>
            : <dl className="vx-rights-list">{found.fields.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
          {found.sensitive.length > 0 && (
            <p className="vx-alert">Ce fichier contient aussi des informations personnelles : {found.sensitive.join(", ")}. {keepOther ? "Tu as choisi de garder les métadonnées d'origine : seuls les champs en texte que le format de sortie accepte seront recopiés ; un lieu enregistré sous forme binaire ne le sera pas." : "Elles ne seront pas recopiées dans le fichier produit."}</p>
          )}
          {found.others.length > 0 && found.sensitive.length === 0 && (
            <p className="vx-muted">{found.others.length > 1 ? `${found.others.length} autres champs techniques sont présents` : "1 autre champ technique est présent"} ({found.others.slice(0, 6).join(", ")}{found.others.length > 6 ? "…" : ""}).</p>
          )}
        </>
      )}

      <h4 className="vx-code-title">1 · Droits inscrits dans le fichier</h4>
      <div className="vx-fields">
        <label>Titulaire des droits
          <input type="text" value={rights.owner} placeholder="Ton nom ou celui de ton entreprise" onChange={(e) => set({ owner: e.target.value })} />
        </label>
        <label>Année
          <input type="text" inputMode="numeric" value={rights.year} onChange={(e) => set({ year: e.target.value.replace(/[^\d–-]/g, "").slice(0, 9) })} />
        </label>
        <label>Auteur ou créateur
          <input type="text" value={rights.creator} placeholder="Qui a réalisé la vidéo" onChange={(e) => set({ creator: e.target.value })} />
        </label>
        <label>Licence
          <select value={rights.license} onChange={(e) => set({ license: e.target.value })}>
            {LICENSES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        {rights.license === "custom" && (
          <label>Texte de la licence
            <input type="text" value={rights.customLicense} placeholder="Ex. : usage éditorial seulement" onChange={(e) => set({ customLicense: e.target.value })} />
          </label>
        )}
        <label>Page des conditions d'utilisation (facultatif)
          <input type="text" inputMode="url" value={rights.termsUrl} placeholder={LICENSES.find((l) => l.id === rights.license)?.url || "https://…"} onChange={(e) => set({ termsUrl: e.target.value })} />
        </label>
        <label>Site web
          <input type="text" inputMode="url" value={rights.website} placeholder="https://…" onChange={(e) => set({ website: e.target.value })} />
        </label>
        <label>Contact
          <input type="text" value={rights.contact} placeholder="Courriel pour les demandes d'utilisation" onChange={(e) => set({ contact: e.target.value })} />
        </label>
        <label>Titre de la vidéo
          <input type="text" value={rights.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label>Description
          <input type="text" value={rights.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
      </div>
      <div className="vx-fields">
        <label className="vx-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Mémoriser ces informations sur cet appareil pour la prochaine vidéo (titre et description exclus)</label>
        <label className="vx-check"><input type="checkbox" checked={keepOther} onChange={(e) => setKeepOther(e.target.checked)} /> Garder aussi les autres métadonnées d'origine quand c'est possible (champs en texte : appareil, logiciel, lieu…)</label>
      </div>
      <div className="vx-row"><button type="button" className="vx-chip" onClick={forget}>Effacer les informations mémorisées</button></div>

      <div className="vx-estimate" style={{ marginTop: 12 }}>
        {plan.fields.length === 0 ? <span>Remplis au moins le titulaire des droits pour inscrire une mention. La licence n'est inscrite que si un titulaire ou un auteur est nommé.</span> : (
          <>
            <span>Ce qui sera inscrit dans le fichier {formatName} :</span>
            <dl className="vx-rights-list">
              {plan.fields.map((f) => <div key={f.label}><dt>{f.label} <small>→ {f.where}</small></dt><dd>{f.value}</dd></div>)}
            </dl>
            {container === "mp4" && plan.fields.some((f) => f.where.includes("©cmt")) && (
              <span className="vx-muted">Le format MP4 n'a pas de champ séparé pour la licence, le site et le contact : ils sont réunis dans le commentaire.</span>
            )}
            {keepOther && replaced.length > 0 && <span className="vx-muted">Dans le fichier d'origine, {replaced.length > 1 ? "ces champs seront remplacés" : "ce champ sera remplacé"} : {replaced.join(", ").toLowerCase()}.</span>}
            {!notice && <span className="vx-alert">Sans titulaire des droits, aucune mention « © » n'est inscrite.</span>}
          </>
        )}
      </div>

      <h4 className="vx-code-title">2 · Filigrane visible</h4>
      <div className="vx-modes" role="radiogroup" aria-label="Filigrane">
        <label><input type="radio" name="mkind" checked={mark.kind === "none"} onChange={() => setMark((m) => ({ ...m, kind: "none" }))} /><b>Aucun</b> — l'image n'est pas touchée, le fichier est recopié sans perte</label>
        <label><input type="radio" name="mkind" checked={mark.kind === "text"} onChange={() => setMark((m) => ({ ...m, kind: "text", size: sizes.text }))} /><b>Texte</b> — ta mention de droits dans l'image</label>
        <label><input type="radio" name="mkind" checked={mark.kind === "logo"} onChange={() => setMark((m) => ({ ...m, kind: "logo", size: sizes.logo }))} /><b>Logo</b> — une image, de préférence à fond transparent</label>
      </div>
      <input ref={logoInput} type="file" accept="image/*,.svg" style={{ display: "none" }} onChange={(e) => { pickLogo(e.target.files?.[0] || null); e.target.value = ""; }} />
      {mark.kind !== "none" && (
        <div className="vx-fields">
          {mark.kind === "text" ? (
            <label>Texte du filigrane
              <input type="text" value={markText} placeholder="© 2026 Ton nom" onChange={(e) => { setMarkTextEdited(true); setMark((m) => ({ ...m, text: e.target.value })); }} />
            </label>
          ) : (
            <div className="vx-row">
              <HudButton action="add-logo" compact label={mark.logo ? "Changer de logo" : "Choisir un logo"} onClick={() => logoInput.current?.click()} />
              {mark.logo && <span className="vx-file">{mark.logo.fileName}</span>}
            </div>
          )}
          <label>Emplacement
            <select value={mark.place} onChange={(e) => setMark((m) => ({ ...m, place: e.target.value as Mark["place"], rotation: e.target.value === "tile" ? (m.rotation === 0 ? -25 : m.rotation) : m.place === "tile" && m.rotation === -25 ? 0 : m.rotation }))}>
              {PLACES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label>{mark.kind === "text" ? `Taille : ${(mark.size * 100).toFixed(1)} % de la hauteur` : `Largeur : ${pc(mark.size)} % de l'image`}
            <input type="range" min={mark.kind === "text" ? 2 : 4} max={mark.kind === "text" ? 20 : 60} step={mark.kind === "text" ? 0.5 : 1} value={mark.size * 100} onChange={(e) => setSize(Number(e.target.value) / 100)} />
          </label>
          <label>Opacité : {pc(mark.opacity)} %
            <input type="range" min={5} max={100} step={5} value={pc(mark.opacity)} onChange={(e) => setMark((m) => ({ ...m, opacity: Number(e.target.value) / 100 }))} />
          </label>
          <label>Rotation : {mark.rotation}°
            <input type="range" min={-90} max={90} step={5} value={mark.rotation} onChange={(e) => setMark((m) => ({ ...m, rotation: Number(e.target.value) }))} />
          </label>
        </div>
      )}
      {markWanted && <p className="vx-alert">{mark.kind === "text" ? "Le filigrane est vide : écris un texte, ou remplis le titulaire des droits." : "Aucun logo choisi."}</p>}
      {layout.overflow && <p className="vx-alert">Le filigrane est plus grand que l'image : il sera coupé. Réduis sa taille ou raccourcis le texte.</p>}
      {reencode && <p className="vx-muted">Le filigrane est visible sur l'aperçu, pendant toute la vidéo. Pour un texte ou un logo animé, ou à un moment précis, utilise l'outil Texte & logo.</p>}

      <p className="vx-muted">
        {reencode
          ? <>Le filigrane impose de réencoder l'image ({codecName}, en visant {fmtBitrate(bitrate)}, un peu sous le débit de la source) : c'est plus long et l'image perd en qualité, légèrement pour une vidéo ordinaire. Le son est recopié tel quel quand le format le permet.</>
          : <>Sans filigrane, l'image et le son sont recopiés tels quels : seules les métadonnées changent, sans aucune perte.</>}
        {" "}Seule la sélection de la timeline ({fmtTime(range[1] - range[0])}) est traitée ; le fichier produit est un {formatName}.
        {keepOther ? "" : " Les autres métadonnées d'origine ne sont pas recopiées."}
        {" "}Après le traitement, le fichier est relu pour vérifier que chaque champ y est bien.
      </p>
      {!reencode && range[0] > 0.05 && (
        <p className="vx-alert">
          La sélection ne commence pas au début de la vidéo : la recopie part de l'image clé qui la précède, donc jusqu'à quelques secondes d'avant restent dans le fichier, masquées à la lecture mais récupérables.
          Pour les retirer vraiment, coupe d'abord l'extrait avec Couper & assembler en mode Précise, puis reviens ici.
        </p>
      )}
      {emptySelection && <p className="vx-alert">La sélection de la timeline est vide : cette vidéo n'a pas pu être lue correctement.</p>}
      {!canEncode && <p className="vx-alert">Ce navigateur ne sait pas encoder en {codecName} : le filigrane n'est pas possible ici pour cette vidéo. Les droits peuvent quand même être inscrits sans filigrane.</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="protect" label={!reencode ? "Inscrire les droits" : plan.fields.length ? "Inscrire les droits et le filigrane" : "Incruster le filigrane"} disabled={nothing || markWanted || !canEncode || emptySelection} busy={progress !== null}
          busyLabel={progress !== null ? `Traitement… ${Math.round(progress * 100)} %` : undefined} onClick={run} />
        {progress !== null && <HudButton action="cancel" compact onClick={job.stop} />}
      </div>
      {error && <p className="vx-alert">{error}</p>}

      {result && (
        <>
          <div className="vx-result">
            <span>✓ {result.width} × {result.height} · {fmtTime(result.duration)} · {fmtBytes(result.blob.size)} · {result.ext === "webm" ? "WebM" : "MP4"}{result.reencoded ? " · image réencodée" : " · recopié sans réencodage"}</span>
            <HudLink action="download-protected" compact href={result.url} download={`${base}-droits.${result.ext}`} />
            <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext, "droits")} />
            {result.blob.size > result.source * 1.02 && (
              <p className="vx-alert" style={{ flexBasis: "100%", margin: 0 }}>
                Ce fichier pèse plus que l'extrait d'origine ({fmtBytes(result.source)}) : {result.reencoded ? "l'encodeur de ce navigateur ne descend pas au débit de cette vidéo." : "la recopie part de l'image clé qui précède le début de la sélection."}
              </p>
            )}
          </div>
          <h4 className="vx-code-title">3 · Vérification du fichier produit</h4>
          <p className="vx-muted">Le fichier a été relu après l'écriture. Voici ce qu'il contient réellement.</p>
          <dl className="vx-rights-list">
            {result.checks.map((c) => <div key={c.label}><dt>✓ {c.label} <small>→ {c.where}</small></dt><dd>{c.found}</dd></div>)}
          </dl>
          {result.checks.length === 0 && <p className="vx-muted">Aucun droit n'a été demandé : seul le filigrane a été incrusté.</p>}
          {result.reencoded && <p className="vx-muted">Le filigrane est dans l'image : il se vérifie en regardant la vidéo produite (« Continuer avec ce résultat » la charge dans l'aperçu).</p>}
          {keepOther && kept(result).length > 0 && <p className="vx-muted">Champs d'origine gardés tels quels : {kept(result).join(", ").toLowerCase()}.</p>}
          <p className="vx-muted">
            {result.after.sensitive.length > 0
              ? `Le fichier produit contient encore : ${result.after.sensitive.join(", ")} (tu as choisi de garder les métadonnées d'origine).`
              : result.after.others.length > 0
                ? `Autres champs présents dans le fichier produit : ${result.after.others.slice(0, 8).join(", ")}${result.after.others.length > 8 ? "…" : ""}.`
                : "Aucune autre métadonnée d'origine dans le fichier produit."}
            {" "}L'outil d'écriture y inscrit aussi la date du traitement et son propre nom (Mediabunny).
          </p>
          {keepOther && found && found.others.some((k) => !result.after.others.includes(k)) && (
            <p className="vx-alert">Des métadonnées d'origine n'ont pas pu être gardées (champ binaire, ou clé que le format {result.ext === "webm" ? "WebM" : "MP4"} produit n'accepte pas) : {found.others.filter((k) => !result.after.others.includes(k)).slice(0, 8).join(", ")}.</p>
          )}
        </>
      )}
    </div>
  );
}
