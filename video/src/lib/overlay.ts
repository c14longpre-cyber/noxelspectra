// NOXEL SPECTRA Vidéo — éléments incrustés (texte, logo) : modèle et dessin sur canevas.
// Le même code dessine l'aperçu et l'export : ce qu'on voit est ce qui est produit.
// Toutes les mesures sont relatives à l'image (0–1), donc indépendantes de la résolution.
import { PRESETS } from "../../../frontend/src/components/spectra-gradient/gradient-engine";
import { ensureFont, isFontReady } from "../../../frontend/src/components/spectra-editor/font-library";

export type Anim = "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "zoom" | "typewriter";
export const ANIMS: { id: Anim; label: string; textOnly?: boolean }[] = [
  { id: "none", label: "Aucune" },
  { id: "fade", label: "Fondu" },
  { id: "slide-up", label: "Glisse vers le haut" },
  { id: "slide-down", label: "Glisse vers le bas" },
  { id: "slide-left", label: "Glisse vers la gauche" },
  { id: "slide-right", label: "Glisse vers la droite" },
  { id: "zoom", label: "Zoom" },
  { id: "typewriter", label: "Machine à écrire", textOnly: true },
];

export type Stop = { at: number; color: string }; // at : 0–1 le long du dégradé
// stops : couleurs et emplacements modifiés par l'utilisateur ; sinon ceux du dégradé prédéfini
// dir : sens du dégradé ; absent = celui du modèle prédéfini
export type GradDir = "horizontal" | "vertical" | "diagonal" | "radial";
export type GradientFill = { kind: "gradient"; id: string; stops?: Stop[]; dir?: GradDir };
export type Fill = { kind: "solid"; color: string } | GradientFill;

/**
 * Ombre portée réglable. dx, dy et blur sont des fractions de la taille de l'élément (texte :
 * taille de la police ; logo : sa hauteur), donc indépendantes de la résolution. fill : couleur
 * unie ou dégradé (jusqu'à 10 couleurs, horizontal, vertical, diagonal ou du centre vers l'extérieur).
 */
export type ShadowStyle = { dx: number; dy: number; blur: number; opacity: number; fill: Fill };
/** Même rendu que l'ancienne ombre fixe (noire, un peu sous le texte). */
export const DEFAULT_SHADOW: ShadowStyle = { dx: 0, dy: 0.05, blur: 0.14, opacity: 0.6, fill: { kind: "solid", color: "#000000" } };

type Base = {
  id: string;
  name: string;
  start: number; // secondes dans la vidéo source
  end: number;
  x: number; // centre de l'élément, 0–1 de la largeur de l'image
  y: number; // 0–1 de la hauteur
  opacity: number; // 0–1
  rotation: number; // degrés
  animIn: Anim;
  animOut: Anim;
  animDuration: number; // secondes
  shadowStyle?: ShadowStyle; // texte : réglages de l'ombre quand `shadow` est vrai ; logo : ombre si présent
};
export type TextItem = Base & {
  kind: "text";
  text: string;
  font: string; // id de FONTS (police de l'appareil) ou nom d'une famille de la bibliothèque (/fonts)
  weight: 400 | 700 | 900;
  italic: boolean;
  size: number; // hauteur d'une ligne, 0–1 de la hauteur de l'image
  align: "left" | "center" | "right";
  fill: Fill;
  stroke: { color: string; width: number } | null; // width : fraction de la taille du texte
  shadow: boolean;
  box: { color: string; opacity: number } | null; // fond arrondi derrière le texte
};
export type LogoItem = Base & {
  kind: "logo";
  image: CanvasImageSource;
  ratio: number; // largeur / hauteur de l'image
  width: number; // 0–1 de la largeur de l'image vidéo
  fileName: string;
};
export type OverlayItem = TextItem | LogoItem;

// Polices de l'appareil uniquement : aucune police n'est téléchargée. Chaque pile se termine par
// une famille générique ; si la première manque, le navigateur prend la suivante (visible à l'aperçu).
export const FONTS: { id: string; label: string; stack: string }[] = [
  { id: "sans", label: "Sans empattement", stack: '"Segoe UI", "Helvetica Neue", Arial, sans-serif' },
  { id: "impact", label: "Impact (titres)", stack: 'Impact, "Arial Black", "Helvetica Neue", sans-serif' },
  { id: "serif", label: "Avec empattement", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Chasse fixe", stack: '"Cascadia Mono", Consolas, "Courier New", monospace' },
  { id: "round", label: "Arrondie", stack: '"Trebuchet MS", Verdana, sans-serif' },
];

// Dégradés : ceux du moteur de dégradés partagé (Spectra image) qui tiennent en un seul dégradé
// linéaire, donc dessinables à chaque image sans calcul par pixel.
export type GradientDef = { id: string; name: string; x1: number; y1: number; x2: number; y2: number; stops: { at: number; color: string }[] };
export const GRADIENTS: GradientDef[] = PRESETS.flatMap((p) => {
  const layers = p.build();
  const l = layers[0];
  if (layers.length !== 1 || l.type !== "linear" || l.repeat !== "none") return [];
  return [{ id: p.id, name: p.name, x1: l.x1 / 100, y1: l.y1 / 100, x2: l.x2 / 100, y2: l.y2 / 100, stops: l.stops.map((s) => ({ at: s.position / 100, color: s.color })) }];
});
const presetOf = (fill: GradientFill) => GRADIENTS.find((x) => x.id === fill.id) || GRADIENTS[0];
/** Sens effectif : celui choisi, sinon celui du modèle (classé selon son vecteur). */
export function fillDir(fill: GradientFill): GradDir {
  if (fill.dir) return fill.dir;
  const g = presetOf(fill);
  const dx = Math.abs(g.x2 - g.x1), dy = Math.abs(g.y2 - g.y1);
  return dy < 0.15 * dx ? "horizontal" : dx < 0.15 * dy ? "vertical" : "diagonal";
}
type Gc = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** Dégradé de canevas couvrant le rectangle (x, y, w, h), dans le sens choisi. */
export function canvasGradient(ctx: Gc, fill: GradientFill, x: number, y: number, w: number, h: number): CanvasGradient {
  const dir = fillDir(fill);
  let grad: CanvasGradient;
  if (dir === "radial") grad = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.hypot(w, h) / 2);
  else if (dir === "horizontal") grad = ctx.createLinearGradient(x, y + h / 2, x + w, y + h / 2);
  else if (dir === "vertical") grad = ctx.createLinearGradient(x + w / 2, y, x + w / 2, y + h);
  else if (!fill.dir) { const g = presetOf(fill); grad = ctx.createLinearGradient(x + g.x1 * w, y + g.y1 * h, x + g.x2 * w, y + g.y2 * h); }
  else grad = ctx.createLinearGradient(x, y, x + w, y + h);
  fillStops(fill).forEach((s) => grad.addColorStop(Math.min(1, Math.max(0, s.at)), s.color));
  return grad;
}
/** Même dégradé en CSS (pastilles et aperçus). */
export function fillCss(fill: GradientFill): string {
  const stops = fillStops(fill).map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ");
  const dir = fillDir(fill);
  if (dir === "radial") return `radial-gradient(circle closest-corner, ${stops})`;
  if (dir === "horizontal") return `linear-gradient(90deg, ${stops})`;
  if (dir === "vertical") return `linear-gradient(180deg, ${stops})`;
  if (!fill.dir) return gradientCss({ ...presetOf(fill), stops: fillStops(fill) });
  return `linear-gradient(135deg, ${stops})`;
}

/** Couleurs d'un remplissage dégradé, dans l'ordre où l'utilisateur les a créées (pour les modifier). */
export const rawStops = (fill: Extract<Fill, { kind: "gradient" }>): Stop[] =>
  fill.stops ?? (GRADIENTS.find((x) => x.id === fill.id) || GRADIENTS[0]).stops;
/** Mêmes couleurs triées par emplacement (pour dessiner). */
export const fillStops = (fill: Extract<Fill, { kind: "gradient" }>): Stop[] => rawStops(fill).slice().sort((a, b) => a.at - b.at);
export const gradientCss = (g: GradientDef) => {
  const angle = (Math.atan2(g.y2 - g.y1, g.x2 - g.x1) * 180) / Math.PI + 90;
  return `linear-gradient(${Math.round(angle)}deg, ${g.stops.map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ")})`;
};

let seq = 0;
export const newOverlayId = () => `o${Date.now().toString(36)}${(seq++).toString(36)}`;

export function makeText(start: number, end: number, partial: Partial<TextItem> = {}): TextItem {
  return {
    id: newOverlayId(), kind: "text", name: "Texte", start, end, x: 0.5, y: 0.5, opacity: 1, rotation: 0,
    animIn: "fade", animOut: "fade", animDuration: 0.5,
    text: "Ton texte", font: "sans", weight: 700, italic: false, size: 0.09, align: "center",
    fill: { kind: "solid", color: "#ffffff" }, stroke: null, shadow: true, box: null,
    ...partial,
  };
}
export function makeLogo(start: number, end: number, image: CanvasImageSource, ratio: number, fileName: string, partial: Partial<LogoItem> = {}): LogoItem {
  return {
    id: newOverlayId(), kind: "logo", name: "Logo", start, end, x: 0.86, y: 0.12, opacity: 1, rotation: 0,
    animIn: "fade", animOut: "fade", animDuration: 0.5,
    image, ratio, width: 0.18, fileName,
    ...partial,
  };
}

// ── Modèles : dispositions prêtes à l'emploi ───────────────────────────
// whole : présent sur toute la sélection ; sinon quelques secondes à partir de la tête de lecture
export const TEXT_TEMPLATES: { id: string; label: string; whole?: boolean; build: (start: number, end: number) => TextItem }[] = [
  { id: "title", label: "Titre centré", build: (s, e) => makeText(s, e, { name: "Titre", text: "Ton titre", font: "impact", weight: 900, size: 0.14, fill: { kind: "gradient", id: "noxel" }, stroke: { color: "#07090f", width: 0.06 }, animIn: "zoom", animOut: "fade" }) },
  { id: "lower", label: "Bandeau en bas", build: (s, e) => makeText(s, e, { name: "Bandeau", text: "Nom · Fonction", size: 0.06, y: 0.86, box: { color: "#07090f", opacity: 0.72 }, shadow: false, animIn: "slide-up", animOut: "slide-down" }) },
  { id: "signature", label: "Signature dans un coin", whole: true, build: (s, e) => makeText(s, e, { name: "Signature", text: "@moncompte", size: 0.04, x: 0.84, y: 0.93, weight: 400, opacity: 0.85, animIn: "fade", animOut: "fade" }) },
  { id: "watermark", label: "Filigrane", whole: true, build: (s, e) => makeText(s, e, { name: "Filigrane", text: "© Mon nom", size: 0.045, x: 0.5, y: 0.5, weight: 700, opacity: 0.28, rotation: -20, shadow: false, animIn: "none", animOut: "none" }) },
];

// ── Dessin ──────────────────────────────────────────────────────────────
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
/** Pile CSS d'une police : celle de l'appareil, ou une famille de la bibliothèque avec repli. */
export const fontStack = (font: string) => FONTS.find((f) => f.id === font)?.stack ?? `"${font.replace(/"/g, "")}", ${FONTS[0].stack}`;
const isDevice = (font: string) => FONTS.some((f) => f.id === font);
/** Charge les polices de bibliothèque utilisées (à attendre avant un export). */
export const loadItemFonts = (items: OverlayItem[]) =>
  Promise.all(items.flatMap((it) => (it.kind === "text" && !isDevice(it.font) ? [ensureFont(it.font).catch(() => {})] : [])));
const fontOf = (it: TextItem, px: number) => {
  // Police de la bibliothèque pas encore chargée : on la demande, l'aperçu (redessiné à chaque image) la prendra ensuite
  if (!isDevice(it.font) && !isFontReady(it.font)) ensureFont(it.font).catch(() => {});
  return `${it.italic ? "italic " : ""}${it.weight} ${px}px ${fontStack(it.font)}`;
};
const LINE = 1.2; // interligne
// Découpe en caractères affichés (un emoji = un caractère), pour la machine à écrire
const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
const chars = (s: string) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));
const PAD = 0.35; // marge du fond, en fraction de la taille du texte

/** Taille de l'élément dans une image W × H (pixels, avant rotation et animation). */
export function itemSize(ctx: Ctx, it: OverlayItem, W: number, H: number): { w: number; h: number } {
  if (it.kind === "logo") {
    const w = it.width * W;
    return { w, h: w / it.ratio };
  }
  const px = it.size * H;
  ctx.font = fontOf(it, px);
  const lines = it.text.split("\n");
  const w = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
  const pad = it.box ? px * PAD : 0;
  return { w: w + pad * 2, h: lines.length * px * LINE + pad * 2 };
}

/** État d'animation à l'instant t : opacité, décalage (fraction de l'image), échelle, part du texte révélée. */
function animState(it: OverlayItem, t: number) {
  const s = { alpha: 1, dx: 0, dy: 0, scale: 1, reveal: 1 };
  const d = Math.min(it.animDuration, (it.end - it.start) / 2);
  if (d <= 0) return s;
  const apply = (anim: Anim, p: number, leaving: boolean) => {
    // p : 0 = élément absent, 1 = élément en place. « Glisse vers le haut » : l'élément arrive en
    // montant (il part du dessous) ou s'en va en montant, d'où le sens inversé à la disparition.
    const dir = leaving ? -1 : 1;
    const k = ease(p);
    if (anim === "none") return;
    if (anim === "typewriter") { s.reveal = Math.min(s.reveal, Math.min(1, Math.max(0, p))); return; }
    s.alpha *= k;
    if (anim === "slide-up") s.dy += dir * (1 - k) * 0.08;
    else if (anim === "slide-down") s.dy -= dir * (1 - k) * 0.08;
    else if (anim === "slide-left") s.dx += dir * (1 - k) * 0.08;
    else if (anim === "slide-right") s.dx -= dir * (1 - k) * 0.08;
    else if (anim === "zoom") s.scale *= 0.6 + 0.4 * k;
  };
  if (t < it.start + d) apply(it.animIn, (t - it.start) / d, false);
  if (t > it.end - d) apply(it.animOut, (it.end - t) / d, true);
  return s;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(ctx: Ctx, it: TextItem, W: number, H: number, reveal: number) {
  const px = it.size * H;
  const { w, h } = itemSize(ctx, it, W, H);
  const pad = it.box ? px * PAD : 0;
  if (it.box) {
    ctx.save();
    ctx.globalAlpha *= it.box.opacity;
    ctx.fillStyle = it.box.color;
    roundRect(ctx, -w / 2, -h / 2, w, h, px * 0.28);
    ctx.fill();
    ctx.restore();
  }
  ctx.font = fontOf(it, px);
  ctx.textBaseline = "middle";
  // Chaque ligne est ancrée à gauche, à la place qu'occupe la ligne entière : en machine à écrire,
  // les lettres apparaissent à leur place au lieu de recentrer le texte à chaque frappe
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  const inner = w - pad * 2;
  ctx.fillStyle = it.fill.kind === "gradient" ? canvasGradient(ctx, it.fill, -inner / 2, -h / 2 + pad, inner, h - pad * 2) : it.fill.color;
  const lines = it.text.split("\n");
  // Machine à écrire : nombre de caractères révélés sur l'ensemble des lignes
  const split = lines.map(chars);
  let left = reveal >= 1 ? Infinity : Math.floor(split.reduce((n, c) => n + c.length, 0) * reveal);
  lines.forEach((line, i) => {
    const shown = left === Infinity ? line : split[i].slice(0, Math.max(0, left)).join("");
    if (left !== Infinity) left -= split[i].length;
    if (!shown) return;
    const full = ctx.measureText(line).width;
    const tx = it.align === "left" ? -inner / 2 : it.align === "right" ? inner / 2 - full : -full / 2;
    const ty = -h / 2 + pad + px * LINE * (i + 0.5);
    if (it.shadow && !it.shadowStyle) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = px * 0.14;
      ctx.shadowOffsetY = px * 0.05;
    }
    if (it.stroke) {
      ctx.strokeStyle = it.stroke.color;
      ctx.lineWidth = px * it.stroke.width * 2; // moitié cachée sous le remplissage
      ctx.strokeText(shown, tx, ty);
      ctx.shadowColor = "transparent"; // une seule ombre, sous le contour
    }
    ctx.fillText(shown, tx, ty);
    ctx.shadowColor = "transparent";
  });
}

// ── Ombre réglable ─────────────────────────────────────────────────────
// La silhouette de l'élément (texte, contour et fond compris, ou logo) est recolorée avec la couleur
// ou le dégradé de l'ombre, puis floutée et posée sous l'élément, décalée. Mise en cache : les copies
// d'un filigrane répété et les images successives d'une vidéo réutilisent la même ombre.
// Flou : filtre du canevas quand le navigateur le gère, sinon réduction puis agrandissement lissé.
const canFilter = typeof document !== "undefined" && "filter" in (document.createElement("canvas").getContext("2d") ?? {});
type ShadowSprite = { canvas: HTMLCanvasElement; small: HTMLCanvasElement | null; w: number; h: number; blur: number };
const shadowCache = new Map<string, ShadowSprite>();
const imageIds = new WeakMap<object, number>();
let imageSeq = 0;
const imageId = (img: CanvasImageSource) => {
  let id = imageIds.get(img as object);
  if (id === undefined) imageIds.set(img as object, (id = ++imageSeq));
  return id;
};

function shadowSprite(it: OverlayItem, W: number, H: number, reveal: number, st: ShadowStyle): ShadowSprite | null {
  const key = JSON.stringify([
    it.kind === "logo" ? [imageId(it.image), it.width, it.ratio] : [it.text, it.font, isFontReady(it.font), it.weight, it.italic, it.size, it.align, it.stroke, it.box, Math.round(reveal * 1000)],
    W, H, st.blur, st.fill,
  ]);
  const hit = shadowCache.get(key);
  if (hit) return hit;
  const probe = document.createElement("canvas").getContext("2d")!;
  const { w, h } = itemSize(probe, it, W, H);
  const ref = it.kind === "logo" ? h : it.size * H;
  const blur = Math.max(0, st.blur * ref);
  const m = Math.ceil(blur * 2.5) + 2;
  const cw = Math.ceil(w + m * 2), ch = Math.ceil(h + m * 2);
  if (cw * ch > 16e6) return null; // ombre démesurée : on s'abstient plutôt que de saturer la mémoire
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const sc = canvas.getContext("2d")!;
  sc.save();
  sc.translate(cw / 2, ch / 2);
  if (it.kind === "logo") sc.drawImage(it.image, -w / 2, -h / 2, w, h);
  else drawText(sc, { ...it, shadow: false }, W, H, reveal);
  sc.restore();
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = st.fill.kind === "gradient" ? canvasGradient(sc, st.fill, m, m, w, h) : st.fill.color;
  sc.fillRect(0, 0, cw, ch);
  let small: HTMLCanvasElement | null = null;
  if (!canFilter && blur >= 1) {
    const k = Math.max(1, blur / 1.5);
    small = document.createElement("canvas");
    small.width = Math.max(1, Math.round(cw / k));
    small.height = Math.max(1, Math.round(ch / k));
    const s2 = small.getContext("2d")!;
    s2.imageSmoothingEnabled = true;
    s2.imageSmoothingQuality = "high";
    s2.drawImage(canvas, 0, 0, small.width, small.height);
  }
  const sprite = { canvas, small, w: cw, h: ch, blur };
  shadowCache.set(key, sprite);
  if (shadowCache.size > 24) shadowCache.delete(shadowCache.keys().next().value!);
  return sprite;
}

function drawShadow(ctx: Ctx, it: OverlayItem, W: number, H: number, reveal: number, st: ShadowStyle) {
  if (st.opacity <= 0) return;
  const sprite = shadowSprite(it, W, H, reveal, st);
  if (!sprite) return;
  const ref = it.kind === "logo" ? (it.width * W) / it.ratio : it.size * H;
  const x = -sprite.w / 2 + st.dx * ref, y = -sprite.h / 2 + st.dy * ref;
  ctx.save();
  ctx.globalAlpha *= st.opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (sprite.small) ctx.drawImage(sprite.small, x, y, sprite.w, sprite.h);
  else {
    if (sprite.blur >= 0.5) (ctx as CanvasRenderingContext2D).filter = `blur(${sprite.blur.toFixed(1)}px)`;
    ctx.drawImage(sprite.canvas, x, y);
  }
  ctx.restore();
}

/** Dessine les éléments visibles à l'instant t (secondes dans la vidéo source) sur une image W × H. */
export function drawOverlays(ctx: Ctx, items: OverlayItem[], t: number, W: number, H: number) {
  for (const it of items) {
    if (t < it.start || t >= it.end) continue;
    const a = animState(it, t);
    ctx.save();
    ctx.globalAlpha = it.opacity * a.alpha;
    ctx.translate((it.x + a.dx) * W, (it.y + a.dy) * H);
    ctx.rotate((it.rotation * Math.PI) / 180);
    ctx.scale(a.scale, a.scale);
    const st = it.shadowStyle && (it.kind === "logo" || it.shadow) ? it.shadowStyle : null;
    if (st) drawShadow(ctx, it, W, H, a.reveal, st);
    if (it.kind === "logo") {
      const { w, h } = itemSize(ctx, it, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(it.image, -w / 2, -h / 2, w, h);
    } else drawText(ctx, it, W, H, a.reveal);
    ctx.restore();
  }
}

/** L'élément (rectangle tourné) contient-il le point (px, py) d'une image W × H ? */
export function hitTest(ctx: Ctx, it: OverlayItem, px: number, py: number, W: number, H: number, margin = 0): boolean {
  const { w, h } = itemSize(ctx, it, W, H);
  const r = (-it.rotation * Math.PI) / 180;
  const dx = px - it.x * W, dy = py - it.y * H;
  const lx = dx * Math.cos(r) - dy * Math.sin(r), ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= w / 2 + margin && Math.abs(ly) <= h / 2 + margin;
}

/** Charge un logo (PNG, JPG, WebP, SVG…) en image dessinable ; il reste sur l'appareil. */
export async function loadLogo(file: File): Promise<{ image: CanvasImageSource; ratio: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const w = img.naturalWidth || 512, h = img.naturalHeight || 512; // SVG sans dimensions : carré par défaut
    // Copie sur un canevas : l'élément ne dépend plus de l'URL, libérée tout de suite
    const s = Math.min(1, 2048 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return { image: c, ratio: c.width / c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
