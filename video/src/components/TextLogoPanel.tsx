// NOXEL Spectra Vidéo — Texte & logo : éléments, réglages, incrustation
import { useEffect, useRef, useState } from "react";
import { HudButton, HudLink } from "@hud/HudButton";
import { ANIMS, FONTS, GRADIENTS, TEXT_TEMPLATES, gradientCss, loadLogo, makeLogo, makeText, newOverlayId } from "../lib/overlay";
import type { Anim, OverlayItem, TextItem } from "../lib/overlay";
import { burnOverlays } from "../lib/textlogo";
import { formatSupport } from "../lib/compress";
import type { CompressFormat } from "../lib/compress";
import { fmtBitrate, fmtBytes, fmtTime } from "../lib/probe";
import type { VideoInfo } from "../lib/probe";
import { useCancel } from "../lib/useCancel";
import { itemLabel } from "./OverlayTracks";
import "../textlogo.css";

type Props = {
  file: File;
  info: VideoInfo;
  range: [number, number];
  duration: number;
  video: HTMLVideoElement | null;
  items: OverlayItem[];
  setItems: (update: (items: OverlayItem[]) => OverlayItem[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null, item?: OverlayItem) => void; // item : élément tout juste créé, pas encore dans la liste
  onContinue: (blob: Blob, ext: string, suffix: string) => void;
};

const COLORS: [string, string][] = [["#ffffff", "blanc"], ["#07090f", "noir"], ["#3ddc84", "vert NOXEL"], ["#a855f7", "mauve NOXEL"], ["#ffd23f", "jaune"], ["#ff4d6d", "rose"]];
const SHORT = 4; // durée par défaut d'un texte ajouté à la tête de lecture (s)
const LEAD = 0.5; // avance sur la tête de lecture : la durée d'animation par défaut (s)
const pc = (v: number) => Math.round(v * 100);

/** Champ de temps : on tape librement, la valeur est appliquée en quittant le champ ou avec Entrée. */
function TimeField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const shown = value.toFixed(1);
  const [draft, setDraft] = useState<string | null>(null); // null : pas de saisie en cours
  const commit = () => {
    if (draft === null) return;
    // Chiffres avec un point ou une virgule seulement (pas de « 0x10 » ni de « 1e1 »)
    const text = draft.trim().replace(",", ".");
    if (/^-?\d+(\.\d+)?$/.test(text)) onCommit(Number(text));
    setDraft(null);
  };
  return (
    <label>{label}
      <input type="text" inputMode="decimal" autoComplete="off" value={draft ?? shown} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setDraft(null); }} />
    </label>
  );
}

export function TextLogoPanel({ file, info, range, duration, video, items, setItems, selectedId, onSelect, onContinue }: Props) {
  const [support, setSupport] = useState<Record<CompressFormat, boolean> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string; dims: string; duration: number; source: number } | null>(null);
  const job = useCancel();
  const urls = useRef<string[]>([]);
  const logoInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { formatSupport().then(setSupport); }, []);
  // Les fichiers produits ne sont libérés qu'en quittant l'outil
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  // Un résultat décrit les éléments et la sélection du moment où il a été produit
  useEffect(() => { setResult(null); }, [items, range[0], range[1]]);

  const sel = items.find((i) => i.id === selectedId) || null;
  const patch = (p: Partial<OverlayItem>) => { if (sel) setItems((list) => list.map((i) => (i.id === sel.id ? ({ ...i, ...p } as OverlayItem) : i))); };
  const patchText = (p: Partial<TextItem>) => patch(p as Partial<OverlayItem>);
  const add = (it: OverlayItem) => { setItems((list) => [...list, it]); onSelect(it.id, it); };

  // Nouvel élément : toute la sélection, ou quelques secondes à partir de la tête de lecture
  const span = (whole: boolean): [number, number] => {
    if (whole) return [range[0], range[1]];
    const t = video ? video.currentTime : range[0];
    // Démarre un peu avant la tête de lecture : l'animation d'apparition est déjà finie à cet instant,
    // donc l'élément est visible tout de suite et la tête de lecture n'a pas à avancer à chaque ajout
    const start = t >= range[0] && t < range[1] - 0.2 ? Math.max(range[0], t - LEAD) : range[0];
    return [start, Math.min(start + SHORT, range[1])];
  };

  async function pickLogo(f: File | null) {
    if (!f) return;
    setError(null);
    try {
      const { image, ratio } = await loadLogo(f);
      add(makeLogo(...span(true), image, ratio, f.name));
    } catch {
      setError("Cette image n'a pas pu être lue par le navigateur (essaie un PNG, JPG, WebP ou SVG).");
    }
  }

  const index = sel ? items.findIndex((i) => i.id === sel.id) : -1;
  const reorder = (delta: number) => setItems((list) => {
    const to = index + delta;
    if (index < 0 || to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });
  const duplicate = () => {
    if (!sel) return;
    add({ ...sel, id: newOverlayId(), x: Math.min(1, sel.x + 0.03), y: Math.min(1, sel.y + 0.03) });
  };
  const remove = () => {
    if (!sel) return;
    setItems((list) => list.filter((i) => i.id !== sel.id));
    onSelect(null);
  };
  // Un début placé après la fin (ou l'inverse) pousse l'autre borne en gardant la durée, pour que
  // la valeur saisie soit respectée quel que soit l'ordre de saisie
  const setTime = (key: "start" | "end", value: number) => {
    if (!sel || !Number.isFinite(value)) return;
    const len = sel.end - sel.start;
    if (key === "start") {
      const start = Math.min(Math.max(0, value), duration - 0.2);
      patch({ start, end: start >= sel.end - 0.2 ? Math.min(duration, start + len) : sel.end });
    } else {
      const end = Math.max(Math.min(duration, value), 0.2);
      patch({ end, start: end <= sel.start + 0.2 ? Math.max(0, end - len) : sel.start });
    }
  };

  // Ce que l'export fera, dit avant d'agir
  const webm = !!info.video && ["vp8", "vp9", "av1"].includes(info.video.codec);
  const canEncode = !support || (webm ? support.webm : support.mp4);
  const inRange = (i: OverlayItem) => i.end > range[0] && i.start < range[1];
  const outside = items.filter((i) => !inRange(i)).length;
  // Éléments qui seront réellement dessinés : dans la sélection, et pas un texte vide
  const visible = items.filter((i) => inRange(i) && (i.kind !== "text" || i.text.trim() !== "")).length;
  const sourceBytes = file.size * ((range[1] - range[0]) / Math.max(info.duration, 0.001));
  // Un peu sous le débit de la source : l'encodeur dépasse de quelques pour cent le débit demandé
  const bitrate = Math.round((info.video?.bitrate || 2e6) * 0.95);

  async function run() {
    job.begin();
    setError(null);
    setResult(null); // pas d'ancien résultat affiché à côté d'une erreur ou d'une annulation
    setProgress(0);
    try {
      const r = await burnOverlays(file, items, range[0], range[1], bitrate, setProgress, job.register);
      if (job.stopped.current) return;
      const url = URL.createObjectURL(r.blob);
      urls.current.push(url);
      setResult({ url, blob: r.blob, ext: r.ext, dims: `${r.width} × ${r.height}`, duration: r.duration, source: sourceBytes });
    } catch (e) {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setError(e instanceof Error ? `Incrustation impossible : ${e.message}` : "Incrustation impossible.");
    } finally {
      setProgress(null);
      job.end();
    }
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const anims = (text: boolean) => ANIMS.filter((a) => text || !a.textOnly);

  return (
    <div className="vx-textlogo">
      <div className="vx-text-add">
        <HudButton action="add-text" compact label="Ajouter un texte" onClick={() => add(makeText(...span(false)))} />
        <input ref={logoInput} type="file" accept="image/*,.svg" style={{ display: "none" }} onChange={(e) => { pickLogo(e.target.files?.[0] || null); e.target.value = ""; }} />
        <HudButton action="add-logo" compact onClick={() => logoInput.current?.click()} />
        <span className="vx-muted">Le logo reste sur ton appareil, rien n'est téléversé.</span>
      </div>
      <div className="vx-rot" role="group" aria-label="Modèles de texte">
        <span className="vx-muted">Modèles :</span>
        {TEXT_TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="vx-chip" onClick={() => add(t.build(...span(!!t.whole)))}>{t.label}</button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="vx-muted">Ajoute un texte, un logo ou un modèle : il apparaît sur l'aperçu, où tu peux le glisser et le redimensionner, et sur une piste sous la timeline, où tu règles son début et sa fin.</p>
      ) : (
        <ul className="vx-items" aria-label="Éléments, du fond vers le dessus">
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" className={`vx-item${it.id === selectedId ? " is-on" : ""}`} aria-pressed={it.id === selectedId} onClick={() => onSelect(it.id)}
                aria-label={`${it.kind === "text" ? "Texte" : "Logo"} « ${itemLabel(it)} », de ${fmtTime(it.start)} à ${fmtTime(it.end)}${inRange(it) ? "" : ", hors de la sélection"}`}>
                <b>{it.kind === "text" ? "TEXTE" : "LOGO"}</b>
                <span>{itemLabel(it)}</span>
                <small className={inRange(it) ? "" : "is-out"}>{fmtTime(it.start)} → {fmtTime(it.end)}{inRange(it) ? "" : " · hors sélection"}</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      {sel && (
        <div className="vx-editor">
          {sel.kind === "text" ? (
            <>
              <h4 className="vx-code-title">Texte</h4>
              <div className="vx-fields">
                <label>Contenu (Entrée pour une nouvelle ligne)
                  <textarea value={sel.text} rows={2} onChange={(e) => patchText({ text: e.target.value })} />
                </label>
                <label>Police
                  <select value={sel.font} onChange={(e) => patchText({ font: e.target.value })}>
                    {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </label>
                <label>Graisse
                  <select value={sel.weight} onChange={(e) => patchText({ weight: Number(e.target.value) as TextItem["weight"] })}>
                    <option value={400}>Normale</option>
                    <option value={700}>Grasse</option>
                    <option value={900}>Très grasse</option>
                  </select>
                </label>
                <label>Taille : {pc(sel.size)} % de la hauteur
                  <input type="range" min={2} max={50} step={1} value={pc(sel.size)} onChange={(e) => patchText({ size: Number(e.target.value) / 100 })} />
                </label>
                <label>Alignement des lignes
                  <select value={sel.align} onChange={(e) => patchText({ align: e.target.value as TextItem["align"] })}>
                    <option value="left">À gauche</option>
                    <option value="center">Centré</option>
                    <option value="right">À droite</option>
                  </select>
                </label>
                <label className="vx-check"><input type="checkbox" checked={sel.italic} onChange={(e) => patchText({ italic: e.target.checked })} /> Italique</label>
              </div>

              <h4 className="vx-code-title">Couleur</h4>
              <div className="vx-row" role="group" aria-label="Couleur unie">
                {COLORS.map(([c, name]) => (
                  <button key={c} type="button" className={`vx-swatch${sel.fill.kind === "solid" && sel.fill.color === c ? " is-on" : ""}`} style={{ background: c }}
                    aria-label={`Couleur ${name}`} title={name} aria-pressed={sel.fill.kind === "solid" && sel.fill.color === c} onClick={() => patchText({ fill: { kind: "solid", color: c } })} />
                ))}
                <input type="color" aria-label="Autre couleur" value={sel.fill.kind === "solid" ? sel.fill.color : "#ffffff"} onChange={(e) => patchText({ fill: { kind: "solid", color: e.target.value } })} />
              </div>
              <div className="vx-row" role="group" aria-label="Dégradé" style={{ marginTop: 8 }}>
                <span className="vx-muted">Dégradés :</span>
                {GRADIENTS.map((g) => (
                  <button key={g.id} type="button" className={`vx-grad${sel.fill.kind === "gradient" && sel.fill.id === g.id ? " is-on" : ""}`} style={{ background: gradientCss(g) }}
                    aria-label={`Dégradé ${g.name}`} title={g.name} aria-pressed={sel.fill.kind === "gradient" && sel.fill.id === g.id} onClick={() => patchText({ fill: { kind: "gradient", id: g.id } })} />
                ))}
              </div>
              <div className="vx-fields" style={{ marginTop: 12 }}>
                <label className="vx-check"><input type="checkbox" checked={sel.shadow} onChange={(e) => patchText({ shadow: e.target.checked })} /> Ombre portée</label>
                <label className="vx-check">
                  <input type="checkbox" checked={!!sel.stroke} onChange={(e) => patchText({ stroke: e.target.checked ? { color: "#07090f", width: 0.06 } : null })} /> Contour
                  {sel.stroke && <input type="color" aria-label="Couleur du contour" value={sel.stroke.color} onChange={(e) => patchText({ stroke: { ...sel.stroke!, color: e.target.value } })} />}
                </label>
                {sel.stroke && (
                  <label>Épaisseur du contour : {pc(sel.stroke.width)} %
                    <input type="range" min={1} max={20} step={1} value={pc(sel.stroke.width)} onChange={(e) => patchText({ stroke: { ...sel.stroke!, width: Number(e.target.value) / 100 } })} />
                  </label>
                )}
                <label className="vx-check">
                  <input type="checkbox" checked={!!sel.box} onChange={(e) => patchText({ box: e.target.checked ? { color: "#07090f", opacity: 0.72 } : null })} /> Fond arrondi
                  {sel.box && <input type="color" aria-label="Couleur du fond" value={sel.box.color} onChange={(e) => patchText({ box: { ...sel.box!, color: e.target.value } })} />}
                </label>
                {sel.box && (
                  <label>Opacité du fond : {pc(sel.box.opacity)} %
                    <input type="range" min={10} max={100} step={5} value={pc(sel.box.opacity)} onChange={(e) => patchText({ box: { ...sel.box!, opacity: Number(e.target.value) / 100 } })} />
                  </label>
                )}
              </div>
            </>
          ) : (
            <>
              <h4 className="vx-code-title">Logo</h4>
              <div className="vx-fields">
                <label>Largeur : {pc(sel.width)} % de l'image
                  <input type="range" min={3} max={100} step={1} value={Math.min(100, pc(sel.width))} onChange={(e) => patch({ width: Number(e.target.value) / 100 })} />
                </label>
              </div>
              <p className="vx-muted">{sel.fileName} — un PNG ou un SVG à fond transparent donne le meilleur résultat.</p>
            </>
          )}

          <h4 className="vx-code-title">Position</h4>
          <div className="vx-fields">
            <label>Horizontale : {pc(sel.x)} %
              <input type="range" min={0} max={100} step={1} value={pc(sel.x)} onChange={(e) => patch({ x: Number(e.target.value) / 100 })} />
            </label>
            <label>Verticale : {pc(sel.y)} %
              <input type="range" min={0} max={100} step={1} value={pc(sel.y)} onChange={(e) => patch({ y: Number(e.target.value) / 100 })} />
            </label>
            <label>Opacité : {pc(sel.opacity)} %
              <input type="range" min={5} max={100} step={5} value={pc(sel.opacity)} onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })} />
            </label>
            <label>Rotation : {sel.rotation}°
              <input type="range" min={-180} max={180} step={1} value={sel.rotation} onChange={(e) => patch({ rotation: Number(e.target.value) })} />
            </label>
          </div>

          <h4 className="vx-code-title">Moment</h4>
          <div className="vx-fields">
            <TimeField key={`s${sel.id}`} label="Début (s)" value={sel.start} onCommit={(v) => setTime("start", v)} />
            <TimeField key={`e${sel.id}`} label="Fin (s)" value={sel.end} onCommit={(v) => setTime("end", v)} />
          </div>
          <div className="vx-row">
            <HudButton action="set-in" compact label="Début à la tête de lecture" disabled={!video} onClick={() => video && setTime("start", video.currentTime)} />
            <HudButton action="set-out" compact label="Fin à la tête de lecture" disabled={!video} onClick={() => video && setTime("end", video.currentTime)} />
            <button type="button" className="vx-chip" onClick={() => patch({ start: range[0], end: range[1] })}>Toute la sélection</button>
          </div>

          <h4 className="vx-code-title">Animation</h4>
          <div className="vx-fields">
            <label>Apparition
              <select value={sel.animIn} onChange={(e) => patch({ animIn: e.target.value as Anim })}>
                {anims(sel.kind === "text").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <label>Disparition
              <select value={sel.animOut} onChange={(e) => patch({ animOut: e.target.value as Anim })}>
                {anims(sel.kind === "text").map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <label>Durée de l'animation : {sel.animDuration.toFixed(1)} s
              <input type="range" min={0.1} max={2} step={0.1} value={sel.animDuration} onChange={(e) => patch({ animDuration: Number(e.target.value) })} />
            </label>
          </div>

          <div className="vx-item-actions">
            <HudButton action="duplicate-layer" compact onClick={duplicate} />
            <HudButton action="layer-up" compact label="Passer devant" disabled={index >= items.length - 1} onClick={() => reorder(1)} />
            <HudButton action="layer-down" compact label="Passer derrière" disabled={index <= 0} onClick={() => reorder(-1)} />
            <HudButton action="delete-layer" compact onClick={remove} />
          </div>
        </div>
      )}

      <p className="vx-muted">
        Incruster un texte ou un logo impose de réencoder l'image ({webm ? "VP9" : "H.264"}, en visant {fmtBitrate(bitrate)}, un peu sous le débit de la source) :
        c'est plus long qu'une recopie et l'image perd en qualité, légèrement pour une vidéo ordinaire. Une vidéo déjà très légère peut ressortir plus lourde et moins nette,
        parce que l'encodeur du navigateur a un débit minimal. Le son est recopié tel quel quand le format le permet.
        Seule la sélection de la timeline ({fmtTime(range[1] - range[0])}) est exportée, en {info.video?.width} × {info.video?.height}.
        Les polices sont celles de ton appareil : l'aperçu montre exactement ce qui sera incrusté.
      </p>
      {outside > 0 && <p className="vx-alert">{outside > 1 ? `${outside} éléments sont hors de la sélection de la timeline : ils n'apparaîtront pas` : "1 élément est hors de la sélection de la timeline : il n'apparaîtra pas"} dans la vidéo produite.</p>}
      {!canEncode && <p className="vx-alert">Ce navigateur ne sait pas encoder en {webm ? "VP9" : "H.264"} : l'incrustation n'est pas possible ici pour cette vidéo.</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <HudButton action="burn-overlays" disabled={!visible || !canEncode} busy={progress !== null}
          busyLabel={progress !== null ? `Incrustation… ${Math.round(progress * 100)} %` : undefined} onClick={run} />
        {progress !== null && <HudButton action="cancel" compact onClick={job.stop} />}
      </div>
      {error && <p className="vx-alert">{error}</p>}
      {result && (
        <div className="vx-result">
          <span>✓ {result.dims} · {fmtTime(result.duration)} · {fmtBytes(result.blob.size)} · {result.ext.toUpperCase()}</span>
          <HudLink action="download-result" compact href={result.url} download={`${base}-texte.${result.ext}`} />
          <HudButton action="continue" compact onClick={() => onContinue(result.blob, result.ext, "texte")} />
          {result.blob.size > result.source * 1.02 && (
            <p className="vx-alert" style={{ flexBasis: "100%", margin: 0 }}>
              Ce fichier pèse plus que l'extrait d'origine ({fmtBytes(result.source)}) : l'encodeur de ce navigateur ne descend pas au débit de cette vidéo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
