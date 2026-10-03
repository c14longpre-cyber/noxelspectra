// NOXEL Spectra — pont entre l'Éditeur (JS natif) et le moteur de dégradés.
// Textes et formes : motif de remplissage calculé par le moteur.
// Stickers : le dégradé « spectrum » du SVG est remplacé par ce même motif,
// ce qui garde les contours et détails d'origine du sticker.

import { GEO_TYPES, MAX_STOPS, MIN_STOPS, PRESETS, makeLayer, normalizeDoc } from "../spectra-gradient/gradient-engine";
import type { Layer, Stop } from "../spectra-gradient/gradient-engine";
import { composeDoc, loadLibrary } from "../spectra-gradient/gradient-render";
import { HUD_MARKUP } from "../hud/hud-data";
import type { HudAction } from "../hud/hud-data";

type ItemGradient = { layers: Layer[] };
// Élément de l'Éditeur : seuls les champs utilisés ici sont typés
type EditorItem = { type: string; fillMode: string; gradient?: ItemGradient; gradientStops?: { position: number; color: string; opacity?: number }[] };

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

// ── Boutons HUD en HTML (l'Éditeur génère son interface en chaînes) ────
export function hudHtml(
  action: HudAction,
  label: string,
  opts: { attrs?: string; variant?: "compact" | "icon" | "big"; disabled?: boolean; title?: string; selected?: boolean } = {}
): string {
  const variant = opts.variant || "compact";
  const cls = ["noxel-hud", variant === "compact" && "noxel-hud--compact", variant === "icon" && "noxel-hud--icon-only"].filter(Boolean).join(" ");
  return `<button type="button" class="${cls}" aria-label="${esc(label)}" title="${esc(opts.title || (variant === "icon" ? label : ""))}"${opts.selected !== undefined ? ` aria-pressed="${opts.selected}"` : ""} ${opts.attrs || ""}${opts.disabled ? " disabled" : ""}><span class="noxel-hud__graphic" aria-hidden="true"><svg class="noxel-hud__svg" viewBox="0 0 128 128" focusable="false">${HUD_MARKUP[action]}</svg></span><span class="noxel-hud__label">${esc(label)}</span></button>`;
}

// Le même habillage pour un <label> (ouverture de fichier : garde le vrai <input type=file>)
export function hudLabelHtml(action: HudAction, label: string, inner: string, cls = ""): string {
  return `<label class="noxel-hud noxel-hud--compact ${cls}"><span class="noxel-hud__graphic" aria-hidden="true"><svg class="noxel-hud__svg" viewBox="0 0 128 128" focusable="false">${HUD_MARKUP[action]}</svg></span><span class="noxel-hud__label">${esc(label)}</span>${inner}</label>`;
}

// ── Dégradé d'un élément (migration des anciens « gradientStops ») ─────
export function gradientOf(item: EditorItem): ItemGradient {
  if (item.gradient?.layers?.length) return item.gradient;
  const stops: Stop[] = (item.gradientStops?.length ? item.gradientStops : [
    { position: 0, color: "#3ddc84" }, { position: 100, color: "#a855f7" },
  ]).map((s) => ({ position: s.position, color: s.color, opacity: s.opacity ?? 100 }));
  item.gradient = { layers: [makeLayer({ name: "Dégradé", x1: 0, y1: 50, x2: 100, y2: 50, stops })] };
  return item.gradient;
}

// ── Rendus mis en cache (l'Éditeur redessine à chaque mouvement) ──────
const canvases = new Map<string, HTMLCanvasElement>();
const dataUrls = new Map<string, string>();
const keyOf = (g: ItemGradient) => JSON.stringify(g.layers.map(({ id: _id, ...rest }) => rest));
function remember<T>(map: Map<string, T>, key: string, make: () => T): T {
  const hit = map.get(key);
  if (hit) return hit;
  const v = make();
  map.set(key, v);
  if (map.size > 48) map.delete(map.keys().next().value as string);
  return v;
}

function rendered(g: ItemGradient, w: number, h: number): HTMLCanvasElement {
  // Le motif est calculé au plus à 768 px de côté puis étiré : invisible à l'œil
  const s = Math.min(1, 768 / Math.max(w, h, 1));
  const rw = Math.max(2, Math.round(w * s));
  const rh = Math.max(2, Math.round(h * s));
  return remember(canvases, `${keyOf(g)}|${rw}x${rh}`, () => composeDoc({ version: 2, width: rw, height: rh, layers: g.layers }, rw, rh));
}

/** Remplissage d'un texte ou d'une forme, centré sur l'élément (repère local). */
export function gradientFill(ctx: CanvasRenderingContext2D, item: EditorItem, w: number, h: number): CanvasPattern | string {
  const c = rendered(gradientOf(item), w, h);
  const p = ctx.createPattern(c, "no-repeat");
  if (!p) return "#3ddc84";
  p.setTransform(new DOMMatrix().translate(-w / 2, -h / 2).scale(w / c.width, h / c.height));
  return p;
}

/** Remplacement du dégradé « spectrum » d'un sticker par le motif du moteur. */
export function stickerSpectrum(item: EditorItem): { svg: string; key: string } {
  const g = gradientOf(item);
  const key = keyOf(g);
  const url = remember(dataUrls, key, () => rendered(g, 256, 256).toDataURL("image/png"));
  return {
    key,
    svg: `<pattern id="spectrum" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${url}" width="1" height="1" preserveAspectRatio="none"/></pattern>`,
  };
}

// ── Vignettes des préréglages et de la bibliothèque ───────────────────
const thumbs = new Map<string, string>();
function thumb(layers: Layer[]): string {
  return remember(thumbs, keyOf({ layers }), () => composeDoc({ version: 2, width: 96, height: 54, layers }, 96, 54).toDataURL("image/png"));
}

// ── Panneau de réglages (HTML) ─────────────────────────────────────────
const CENTERED = ["radial", "diamond", "square", "conic", "conic-symmetric", "spiral-cw", "spiral-ccw"];
const linearAngle = (l: Layer) => Math.round(((Math.atan2(l.x2 - l.x1, -(l.y2 - l.y1)) * 180) / Math.PI + 360) % 360);

export function gradientPanelHtml(item: EditorItem): string {
  const g = gradientOf(item);
  const l = g.layers[0];
  const library = loadLibrary();
  const tiles = [
    ...PRESETS.map((p) => ({ attr: `data-grad-preset="${p.id}"`, name: p.name, layers: p.build() })),
    ...library.map((s) => ({ attr: `data-grad-lib="${esc(s.id)}"`, name: `★ ${s.name}`, layers: normalizeDoc(s.doc).layers })),
  ];
  const tilesHtml = `<div class="sp-grad-presets">${tiles
    .map((t) => `<button type="button" class="sp-grad-tile" ${t.attr} title="${esc(t.name)}" aria-label="Dégradé ${esc(t.name)}"><img src="${thumb(t.layers)}" alt=""><span>${esc(t.name)}</span></button>`)
    .join("")}</div>`;
  const num = (label: string, key: string, v: number, min: number, max: number, step = 1) =>
    `<label>${label}<input type="number" data-grad="${key}" min="${min}" max="${max}" step="${step}" value="${Math.round(v * 10) / 10}"></label>`;

  if (g.layers.length > 1) {
    return `<div class="sp-grad">
      <div class="sp-grad-head">Préréglages et bibliothèque</div>${tilesHtml}
      <p class="sp-help">Dégradé à ${g.layers.length} calques : ${g.layers.map((x) => esc(x.name)).join(", ")}. Ses réglages fins se font dans l'outil Dégradé.</p>
      ${hudHtml("reset-colors", "Simplifier (premier calque)", { attrs: 'data-grad-action="flatten"' })}
    </div>`;
  }

  let geo = "";
  if (l.type === "linear" || l.type === "reflected") geo += num("Angle (°)", "linearAngle", linearAngle(l), 0, 359);
  if (CENTERED.includes(l.type)) geo += num("Centre X (%)", "cx", l.cx, -100, 200) + num("Centre Y (%)", "cy", l.cy, -100, 200);
  if (["radial", "diamond", "square"].includes(l.type))
    geo += `<label>Forme<select data-grad="shape"><option value="circle"${l.shape === "circle" ? " selected" : ""}>Cercle</option><option value="ellipse"${l.shape === "ellipse" ? " selected" : ""}>Ellipse</option></select></label>`;
  if (["radial", "diamond", "square", "spiral-cw", "spiral-ccw"].includes(l.type)) {
    geo += num(l.shape === "ellipse" && !l.type.startsWith("spiral") ? "Rayon horizontal (%)" : "Rayon (%)", "rx", l.rx, 1, 300);
    if (l.shape === "ellipse" && !l.type.startsWith("spiral")) geo += num("Rayon vertical (%)", "ry", l.ry, 1, 300);
  }
  if (["conic", "conic-symmetric", "spiral-cw", "spiral-ccw"].includes(l.type)) geo += num("Angle de départ (°)", "angle", l.angle, -360, 360);
  if (l.type.startsWith("spiral")) geo += num("Enroulements", "turns", l.turns, 0, 20, 0.5);

  let colors = "";
  if (l.type === "four-corners") {
    colors = ["Haut gauche", "Haut droite", "Bas droite", "Bas gauche"]
      .map((name, i) => `<label>${name}<span class="sp-grad-pair"><input type="color" data-grad-corner="${i}" value="${l.corners[i].color}"><input type="number" data-grad-corner-op="${i}" min="0" max="100" value="${l.corners[i].opacity}" title="Opacité (%)"></span></label>`)
      .join("");
  } else if (l.type === "freeform") {
    colors = l.points
      .map((p, i) => `${i === 0 ? `<div class="sp-grad-cols"><span></span><span>X %</span><span>Y %</span><span></span></div>` : ""}<div class="sp-grad-stop"><input type="color" data-grad-point="${i}" data-field="color" value="${p.color}" aria-label="Couleur du point ${i + 1}">
        <input type="number" data-grad-point="${i}" data-field="x" min="0" max="100" value="${Math.round(p.x)}" title="X (%)" aria-label="X du point ${i + 1}">
        <input type="number" data-grad-point="${i}" data-field="y" min="0" max="100" value="${Math.round(p.y)}" title="Y (%)" aria-label="Y du point ${i + 1}">
        ${hudHtml("remove-image", `Retirer le point ${i + 1}`, { variant: "icon", attrs: `data-grad-del-point="${i}"`, disabled: l.points.length <= 2 })}</div>`)
      .join("") + hudHtml("add-point", "+ Point", { attrs: 'data-grad-action="add-point"', disabled: l.points.length >= MAX_STOPS });
  } else {
    colors = `<div class="sp-grad-cols"><span></span><span>POSITION %</span><span>OPACITÉ %</span><span></span></div>` + l.stops
      .map((s, i) => `<div class="sp-grad-stop"><input type="color" data-grad-stop="${i}" data-field="color" value="${s.color}" aria-label="Couleur ${i + 1}">
        <input type="number" data-grad-stop="${i}" data-field="position" min="0" max="100" value="${s.position}" title="Position (%)" aria-label="Position ${i + 1}">
        <input type="number" data-grad-stop="${i}" data-field="opacity" min="0" max="100" value="${s.opacity}" title="Opacité (%)" aria-label="Opacité ${i + 1}">
        ${hudHtml("remove-image", `Retirer la couleur ${i + 1}`, { variant: "icon", attrs: `data-grad-del-stop="${i}"`, disabled: l.stops.length <= MIN_STOPS })}</div>`)
      .join("") +
      `<div class="sp-grad-row">${hudHtml("add-color", "+ Couleur", { attrs: 'data-grad-action="add-stop"', disabled: l.stops.length >= MAX_STOPS })}${hudHtml("reverse-stops", "Inverser les couleurs", { variant: "icon", attrs: 'data-grad-action="reverse"' })}${hudHtml("spread-stops", "Répartir les couleurs", { variant: "icon", attrs: 'data-grad-action="spread"' })}</div>`;
  }

  const types = ["Base", "Formes", "Plusieurs points"]
    .map((grp) => `<optgroup label="${grp}">${GEO_TYPES.filter((t) => t.group === grp).map((t) => `<option value="${t.id}"${t.id === l.type ? " selected" : ""}>${t.label}</option>`).join("")}</optgroup>`)
    .join("");
  const repeat = ["four-corners", "freeform", "conic", "conic-symmetric"].includes(l.type)
    ? ""
    : `<label>Répétition<select data-grad="repeat">${[["none", "Aucune"], ["repeat", "Répétée"], ["reflect", "Aller-retour"]]
        .map(([v, t]) => `<option value="${v}"${l.repeat === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;

  return `<div class="sp-grad">
    <div class="sp-grad-head">Préréglages et bibliothèque</div>${tilesHtml}
    <div class="sp-grad-head">Géométrie</div>
    <label>Type<select data-grad="type">${types}</select></label>${repeat}${geo}
    <div class="sp-grad-head">${l.type === "four-corners" ? "Coins" : l.type === "freeform" ? `Points (${l.points.length}/${MAX_STOPS})` : `Couleurs (${l.stops.length}/${MAX_STOPS})`}</div>
    ${colors}
  </div>`;
}

// ── Écouteurs du panneau ───────────────────────────────────────────────
type Hooks = { draw: () => void; commit: () => void; rerender: () => void };

export function bindGradientPanel(host: HTMLElement, item: EditorItem, hooks: Hooks) {
  const g = gradientOf(item);
  const l = () => g.layers[0];
  const live = (el: Element, fn: (v: string) => void, structural = false) => {
    el.addEventListener("input", () => {
      fn((el as HTMLInputElement).value);
      if (structural) hooks.rerender();
      else hooks.draw();
    });
    if (!structural) el.addEventListener("change", () => hooks.commit());
  };

  host.querySelectorAll<HTMLElement>("[data-grad]").forEach((el) => {
    const key = el.dataset.grad as string;
    const structural = key === "type" || key === "shape" || key === "repeat";
    live(el, (v) => {
      const L = l();
      if (key === "type") L.type = v as Layer["type"];
      else if (key === "shape") L.shape = v === "ellipse" ? "ellipse" : "circle";
      else if (key === "repeat") L.repeat = v as Layer["repeat"];
      else if (key === "linearAngle") {
        const a = ((Number(v) || 0) * Math.PI) / 180;
        const dx = Math.sin(a) * 50, dy = -Math.cos(a) * 50;
        Object.assign(L, { x1: 50 - dx, y1: 50 - dy, x2: 50 + dx, y2: 50 + dy });
      } else (L as unknown as Record<string, number>)[key] = Number(v) || 0;
    }, structural);
  });
  host.querySelectorAll<HTMLElement>("[data-grad-stop]").forEach((el) => {
    const i = Number(el.dataset.gradStop), f = el.dataset.field as keyof Stop;
    live(el, (v) => {
      const s = l().stops[i];
      if (f === "color") s.color = v;
      else s[f] = clamp(Number(v) || 0, 0, 100) as never;
    });
  });
  host.querySelectorAll<HTMLElement>("[data-grad-point]").forEach((el) => {
    const i = Number(el.dataset.gradPoint), f = el.dataset.field as string;
    live(el, (v) => {
      const p = l().points[i];
      if (f === "color") p.color = v;
      else (p as unknown as Record<string, number>)[f] = clamp(Number(v) || 0, 0, 100);
    });
  });
  host.querySelectorAll<HTMLElement>("[data-grad-corner]").forEach((el) => live(el, (v) => { l().corners[Number(el.dataset.gradCorner)].color = v; }));
  host.querySelectorAll<HTMLElement>("[data-grad-corner-op]").forEach((el) => live(el, (v) => { l().corners[Number(el.dataset.gradCornerOp)].opacity = clamp(Number(v) || 0, 0, 100); }));

  const click = (sel: string, fn: (el: HTMLElement) => void) =>
    host.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener("click", () => { fn(el); hooks.rerender(); }));
  click("[data-grad-del-stop]", (el) => { if (l().stops.length > MIN_STOPS) l().stops.splice(Number(el.dataset.gradDelStop), 1); });
  click("[data-grad-del-point]", (el) => { if (l().points.length > 2) l().points.splice(Number(el.dataset.gradDelPoint), 1); });
  click("[data-grad-preset]", (el) => {
    const p = PRESETS.find((x) => x.id === el.dataset.gradPreset);
    if (p) g.layers = p.build();
  });
  click("[data-grad-lib]", (el) => {
    const s = loadLibrary().find((x) => x.id === el.dataset.gradLib);
    if (s) g.layers = normalizeDoc(s.doc).layers;
  });
  click("[data-grad-action]", (el) => {
    const a = el.dataset.gradAction, L = l();
    if (a === "flatten") g.layers = [g.layers[0]];
    if (a === "add-stop" && L.stops.length < MAX_STOPS) {
      const s = L.stops.slice().sort((x, y) => x.position - y.position);
      let gi = 0;
      for (let i = 0; i < s.length - 1; i++) if (s[i + 1].position - s[i].position > s[gi + 1].position - s[gi].position) gi = i;
      L.stops.push({ position: Math.round((s[gi].position + s[gi + 1].position) / 2), color: s[gi].color, opacity: 100 });
    }
    if (a === "reverse") L.stops = L.stops.map((s) => ({ ...s, position: 100 - s.position }));
    if (a === "spread") {
      const s = L.stops.slice().sort((x, y) => x.position - y.position);
      L.stops = s.map((st, i) => ({ ...st, position: Math.round((i / (s.length - 1)) * 100) }));
    }
    if (a === "add-point" && L.points.length < MAX_STOPS) L.points.push({ x: 50, y: 50, color: "#ffffff", opacity: 100, influence: 50 });
  });
}
