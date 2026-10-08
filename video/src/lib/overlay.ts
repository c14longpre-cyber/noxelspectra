// NOXEL Spectra Vidéo — éléments incrustés (texte, logo) : modèle et dessin sur canevas.
// Le même code dessine l'aperçu et l'export : ce qu'on voit est ce qui est produit.
// Toutes les mesures sont relatives à l'image (0–1), donc indépendantes de la résolution.
import { PRESETS } from "../../../frontend/src/components/spectra-gradient/gradient-engine";

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

export type Fill = { kind: "solid"; color: string } | { kind: "gradient"; id: string };

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
};
export type TextItem = Base & {
  kind: "text";
  text: string;
  font: string; // id de FONTS
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
const fontOf = (it: TextItem, px: number) => `${it.italic ? "italic " : ""}${it.weight} ${px}px ${FONTS.find((f) => f.id === it.font)?.stack || FONTS[0].stack}`;
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
  if (it.fill.kind === "gradient") {
    const fill = it.fill;
    const g = GRADIENTS.find((x) => x.id === fill.id) || GRADIENTS[0];
    const grad = ctx.createLinearGradient(-inner / 2 + g.x1 * inner, -h / 2 + g.y1 * h, -inner / 2 + g.x2 * inner, -h / 2 + g.y2 * h);
    g.stops.forEach((s) => grad.addColorStop(s.at, s.color));
    ctx.fillStyle = grad;
  } else ctx.fillStyle = it.fill.color;
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
    if (it.shadow) {
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
