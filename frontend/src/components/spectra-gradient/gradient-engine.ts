// NOXEL Spectra — moteur de dégradés partagé (outil Dégradé + Éditeur)
//
// Chaque calque est calculé pixel par pixel : toutes les géométries passent par
// le même chemin, ce qui garantit un rendu identique entre l'aperçu, le PNG et
// l'Éditeur. Les exports CSS et SVG ne contiennent que ce que ces formats savent
// représenter nativement ; le reste est signalé (et intégré en raster en SVG).

export type Stop = { position: number; color: string; opacity: number }; // position et opacité : 0–100

export type GeoType =
  | "linear"
  | "reflected"
  | "radial"
  | "conic"
  | "conic-symmetric"
  | "diamond"
  | "square"
  | "spiral-cw"
  | "spiral-ccw"
  | "four-corners"
  | "freeform";

export type RepeatMode = "none" | "repeat" | "reflect";

export const BLEND_MODES = [
  ["normal", "Normal"],
  ["multiply", "Produit"],
  ["screen", "Écran"],
  ["overlay", "Superposition"],
  ["darken", "Assombrir"],
  ["lighten", "Éclaircir"],
  ["color-dodge", "Densité couleur −"],
  ["color-burn", "Densité couleur +"],
  ["hard-light", "Lumière dure"],
  ["soft-light", "Lumière douce"],
  ["difference", "Différence"],
  ["exclusion", "Exclusion"],
  ["hue", "Teinte"],
  ["saturation", "Saturation"],
  ["color", "Couleur"],
  ["luminosity", "Luminosité"],
] as const;
export type BlendMode = (typeof BLEND_MODES)[number][0];

export const GEO_TYPES: { id: GeoType; label: string; group: string }[] = [
  { id: "linear", label: "Linéaire", group: "Base" },
  { id: "radial", label: "Radial (cercle ou ellipse)", group: "Base" },
  { id: "conic", label: "Conique / angulaire", group: "Base" },
  { id: "reflected", label: "Réfléchi / miroir", group: "Formes" },
  { id: "diamond", label: "Losange", group: "Formes" },
  { id: "square", label: "Carré", group: "Formes" },
  { id: "conic-symmetric", label: "Conique symétrique", group: "Formes" },
  { id: "spiral-cw", label: "Spirale horaire", group: "Formes" },
  { id: "spiral-ccw", label: "Spirale antihoraire", group: "Formes" },
  { id: "four-corners", label: "Quatre coins", group: "Plusieurs points" },
  { id: "freeform", label: "Libre par points (Freeform)", group: "Plusieurs points" },
];

export type FreePoint = { x: number; y: number; color: string; opacity: number; influence: number }; // x, y en %

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  type: GeoType;
  stops: Stop[];
  x1: number; y1: number; x2: number; y2: number; // linéaire / réfléchi : départ et arrivée (%)
  cx: number; cy: number; // centre (%) des formes centrées
  shape: "circle" | "ellipse";
  rx: number; ry: number; // rayon (% du plus petit côté) ; en ellipse rx = % largeur, ry = % hauteur
  angle: number; // départ (degrés, 0 = haut, sens horaire) : conique et spirales
  turns: number; // spirales : nombre d'enroulements sur le rayon
  repeat: RepeatMode;
  corners: [Stop, Stop, Stop, Stop]; // haut-gauche, haut-droite, bas-droite, bas-gauche
  points: FreePoint[];
  opacity: number; // 0–100
  blend: BlendMode;
  grain: number; // 0–100
};

export type GradientDoc = { version: 2; width: number; height: number; layers: Layer[] };

export const MAX_LAYERS = 8;
export const MIN_STOPS = 2;
export const MAX_STOPS = 10;
export const NATIVE_CSS: GeoType[] = ["linear", "reflected", "radial", "conic", "conic-symmetric"];
export const NATIVE_SVG: GeoType[] = ["linear", "reflected", "radial"];

let seq = 0;
export const newId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function makeLayer(partial: Partial<Layer> = {}): Layer {
  return {
    id: newId(),
    name: "Calque",
    visible: true,
    type: "linear",
    stops: [
      { position: 0, color: "#3ddc84", opacity: 100 },
      { position: 100, color: "#a855f7", opacity: 100 },
    ],
    x1: 0, y1: 50, x2: 100, y2: 50,
    cx: 50, cy: 50, shape: "circle", rx: 50, ry: 50,
    angle: 0, turns: 2,
    repeat: "none",
    corners: [
      { position: 0, color: "#3ddc84", opacity: 100 },
      { position: 0, color: "#a855f7", opacity: 100 },
      { position: 0, color: "#102542", opacity: 100 },
      { position: 0, color: "#7137a5", opacity: 100 },
    ],
    points: [
      { x: 20, y: 25, color: "#3ddc84", opacity: 100, influence: 50 },
      { x: 80, y: 30, color: "#a855f7", opacity: 100, influence: 50 },
      { x: 50, y: 80, color: "#102542", opacity: 100, influence: 50 },
    ],
    opacity: 100,
    blend: "normal",
    grain: 0,
    ...partial,
  };
}

// ── Validation (JSON importé, anciens fichiers v1) ─────────────────────
const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
const cleanStop = (s: any, d = "#000000"): Stop => ({
  position: num(s?.position, 0, 100, 0),
  color: hex(s?.color, d),
  opacity: num(s?.opacity ?? 100, 0, 100, 100),
});

export function normalizeDoc(raw: any): GradientDoc {
  // Ancien format (module v1) : un seul dégradé linéaire ou radial
  if (raw && !Array.isArray(raw.layers) && Array.isArray(raw.stops)) {
    const radial = raw.type === "radial";
    return normalizeDoc({
      version: 2,
      width: raw.width,
      height: raw.height,
      layers: [
        {
          name: "Dégradé",
          type: radial ? "radial" : "linear",
          stops: raw.stops,
          x1: raw.x1, y1: raw.y1, x2: raw.x2, y2: raw.y2,
          cx: raw.cx, cy: raw.cy, rx: raw.radius, ry: raw.radius,
        },
      ],
    });
  }
  const base = makeLayer();
  const layers: Layer[] = (Array.isArray(raw?.layers) ? raw.layers : []).slice(0, MAX_LAYERS).map((l: any) => {
    const stops = (Array.isArray(l?.stops) ? l.stops : base.stops).slice(0, MAX_STOPS).map((s: any) => cleanStop(s));
    while (stops.length < MIN_STOPS) stops.push(cleanStop({ position: 100, color: "#ffffff" }));
    const corners = (Array.isArray(l?.corners) && l.corners.length === 4 ? l.corners : base.corners).map((c: any) => cleanStop(c));
    const points = (Array.isArray(l?.points) && l.points.length >= 2 ? l.points : base.points).slice(0, MAX_STOPS).map((p: any) => ({
      x: num(p?.x, 0, 100, 50),
      y: num(p?.y, 0, 100, 50),
      color: hex(p?.color, "#ffffff"),
      opacity: num(p?.opacity ?? 100, 0, 100, 100),
      influence: num(p?.influence ?? 50, 5, 100, 50),
    }));
    return {
      ...base,
      id: newId(),
      name: typeof l?.name === "string" && l.name.trim() ? l.name.slice(0, 40) : "Calque",
      visible: l?.visible !== false,
      type: GEO_TYPES.some((g) => g.id === l?.type) ? l.type : "linear",
      stops,
      x1: num(l?.x1, -100, 200, 0), y1: num(l?.y1, -100, 200, 50),
      x2: num(l?.x2, -100, 200, 100), y2: num(l?.y2, -100, 200, 50),
      cx: num(l?.cx, -100, 200, 50), cy: num(l?.cy, -100, 200, 50),
      shape: l?.shape === "ellipse" ? "ellipse" : "circle",
      rx: num(l?.rx, 1, 300, 50), ry: num(l?.ry, 1, 300, 50),
      angle: num(l?.angle, -360, 360, 0),
      turns: num(l?.turns, 0, 20, 2),
      repeat: l?.repeat === "repeat" || l?.repeat === "reflect" ? l.repeat : "none",
      corners: corners as Layer["corners"],
      points,
      opacity: num(l?.opacity ?? 100, 0, 100, 100),
      blend: BLEND_MODES.some(([id]) => id === l?.blend) ? l.blend : "normal",
      grain: num(l?.grain ?? 0, 0, 100, 0),
    };
  });
  return {
    version: 2,
    width: Math.round(num(raw?.width, 16, 4096, 1200)),
    height: Math.round(num(raw?.height, 16, 4096, 630)),
    layers: layers.length ? layers : [makeLayer({ name: "Dégradé" })],
  };
}

// ── Couleurs (interpolation en alpha prémultiplié, comme CSS) ──────────
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const sortStops = (stops: Stop[]) => stops.slice().sort((a, b) => a.position - b.position);

const LUT_SIZE = 1024;
function buildLut(stops: Stop[]): Float32Array {
  const s = sortStops(stops).map((st) => {
    const [r, g, b] = rgb(st.color);
    const a = st.opacity / 100;
    return { p: st.position / 100, r: r * a, g: g * a, b: b * a, a };
  });
  const lut = new Float32Array(LUT_SIZE * 4); // RGB prémultipliés + alpha
  for (let i = 0; i < LUT_SIZE; i++) {
    const t = i / (LUT_SIZE - 1);
    let k = 0;
    while (k < s.length - 1 && s[k + 1].p < t) k++;
    const A = s[k];
    const B = s[Math.min(k + 1, s.length - 1)];
    let u = 0;
    if (t <= s[0].p) u = 0;
    else if (t >= s[s.length - 1].p) u = 1;
    else u = B.p > A.p ? (t - A.p) / (B.p - A.p) : 0;
    const P = t <= s[0].p ? s[0] : t >= s[s.length - 1].p ? s[s.length - 1] : null;
    const o = i * 4;
    if (P) {
      lut[o] = P.r; lut[o + 1] = P.g; lut[o + 2] = P.b; lut[o + 3] = P.a;
    } else {
      lut[o] = A.r + (B.r - A.r) * u;
      lut[o + 1] = A.g + (B.g - A.g) * u;
      lut[o + 2] = A.b + (B.b - A.b) * u;
      lut[o + 3] = A.a + (B.a - A.a) * u;
    }
  }
  return lut;
}

function wrap(t: number, mode: RepeatMode): number {
  if (mode === "repeat") return t - Math.floor(t);
  if (mode === "reflect") {
    const m = t - 2 * Math.floor(t / 2);
    return m <= 1 ? m : 2 - m;
  }
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

// Paramètre t (0–1 avant répétition) d'un pixel, pour les géométries à arrêts
function makeT(l: Layer, w: number, h: number): (x: number, y: number) => number {
  const minSide = Math.min(w, h);
  const cx = (l.cx / 100) * w;
  const cy = (l.cy / 100) * h;
  const rx = Math.max(0.5, l.shape === "ellipse" ? (l.rx / 100) * w : (l.rx / 100) * minSide);
  const ry = Math.max(0.5, l.shape === "ellipse" ? (l.ry / 100) * h : (l.rx / 100) * minSide);
  const conicT = (x: number, y: number) => {
    let deg = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90 - l.angle; // 0 = haut, sens horaire
    deg = ((deg % 360) + 360) % 360;
    return deg / 360;
  };
  switch (l.type) {
    case "linear":
    case "reflected": {
      const x1 = (l.x1 / 100) * w, y1 = (l.y1 / 100) * h;
      const dx = (l.x2 / 100) * w - x1, dy = (l.y2 / 100) * h - y1;
      const len2 = dx * dx + dy * dy || 1;
      return l.type === "linear"
        ? (x, y) => ((x - x1) * dx + (y - y1) * dy) / len2
        : (x, y) => Math.abs(((x - x1) * dx + (y - y1) * dy) / len2);
    }
    case "radial":
      return (x, y) => Math.hypot((x - cx) / rx, (y - cy) / ry);
    case "diamond":
      return (x, y) => Math.abs(x - cx) / rx + Math.abs(y - cy) / ry;
    case "square":
      return (x, y) => Math.max(Math.abs(x - cx) / rx, Math.abs(y - cy) / ry);
    case "conic":
      return conicT;
    case "conic-symmetric":
      return (x, y) => {
        const t = conicT(x, y);
        return 1 - Math.abs(2 * t - 1);
      };
    case "spiral-cw":
    case "spiral-ccw": {
      const dir = l.type === "spiral-cw" ? 1 : -1;
      return (x, y) => {
        const a = conicT(x, y);
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        return (dir === 1 ? a : 1 - a) + d * l.turns;
      };
    }
    default:
      return () => 0;
  }
}

const premul = (s: { color: string; opacity: number }) => {
  const [r, g, b] = rgb(s.color);
  const a = s.opacity / 100;
  return [r * a, g * a, b * a, a];
};

// Rendu d'un calque (sans son opacité ni son mode de fusion : appliqués à la composition)
export function renderLayerPixels(l: Layer, w: number, h: number, seed = 1): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const put = (o: number, r: number, g: number, b: number, a: number) => {
    if (a <= 0) return;
    out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a * 255;
  };
  if (l.type === "four-corners") {
    const [tl, tr, br, bl] = l.corners.map(premul);
    for (let y = 0; y < h; y++) {
      const v = h > 1 ? y / (h - 1) : 0;
      for (let x = 0; x < w; x++) {
        const u = w > 1 ? x / (w - 1) : 0;
        const o = (y * w + x) * 4;
        const c = [0, 1, 2, 3].map((k) => (tl[k] * (1 - u) + tr[k] * u) * (1 - v) + (bl[k] * (1 - u) + br[k] * u) * v);
        put(o, c[0], c[1], c[2], c[3]);
      }
    }
  } else if (l.type === "freeform") {
    // Pondération par distance inverse : chaque point attire sa couleur selon son influence
    const diag = Math.hypot(w, h);
    const pts = l.points.map((p) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h, c: premul(p), k: (p.influence / 50) ** 2 }));
    const eps = (diag * 0.004) ** 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sw = 0, r = 0, g = 0, b = 0, a = 0;
        for (const p of pts) {
          const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
          const wt = p.k / (d2 + eps);
          sw += wt; r += p.c[0] * wt; g += p.c[1] * wt; b += p.c[2] * wt; a += p.c[3] * wt;
        }
        put((y * w + x) * 4, r / sw, g / sw, b / sw, a / sw);
      }
    }
  } else {
    const lut = buildLut(l.stops);
    const tf = makeT(l, w, h);
    const spiral = l.type === "spiral-cw" || l.type === "spiral-ccw";
    const mode: RepeatMode = spiral && l.repeat === "none" ? "repeat" : l.repeat; // une spirale tourne toujours
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = wrap(tf(x + 0.5, y + 0.5), mode);
        const i = Math.round(t * (LUT_SIZE - 1)) * 4;
        put((y * w + x) * 4, lut[i], lut[i + 1], lut[i + 2], lut[i + 3]);
      }
    }
  }
  if (l.grain > 0) {
    // Bruit déterministe (même grain à chaque rendu) : générateur xorshift
    let s = (seed * 2654435761) >>> 0 || 1;
    const amp = (l.grain / 100) * 60;
    for (let o = 0; o < out.length; o += 4) {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      const n = ((s / 4294967295) - 0.5) * 2 * amp;
      if (out[o + 3] === 0) {
        // Zone transparente : grain gris neutre (128), à fusionner en Superposition
        out[o] = 128 + n; out[o + 1] = 128 + n; out[o + 2] = 128 + n; out[o + 3] = 255;
      } else {
        out[o] = out[o] + n; out[o + 1] = out[o + 1] + n; out[o + 2] = out[o + 2] + n;
      }
    }
  }
  return out;
}

// ── Export CSS (géométries natives seulement) ──────────────────────────
const cssColor = (s: Stop, layerOpacity: number) => {
  const [r, g, b] = rgb(s.color);
  const a = Math.round((s.opacity / 100) * (layerOpacity / 100) * 1000) / 1000;
  return a >= 1 ? s.color : `rgba(${r}, ${g}, ${b}, ${a})`;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// Arrêts placés entre deux positions (en % de la ligne CSS), avec répétition miroir si demandé
function stopsBetween(stops: Stop[], from: number, to: number, op: number, mode: RepeatMode, mirror: boolean) {
  const s = sortStops(stops);
  const span = to - from;
  let list = s.map((st) => ({ st, p: from + (st.position / 100) * span }));
  if (mirror || mode === "reflect") {
    // Période doublée : aller puis retour (exact pour la répétition miroir et le dégradé réfléchi)
    const back = s.slice().reverse().map((st) => ({ st, p: to + ((100 - st.position) / 100) * span }));
    list = list.concat(back);
  }
  return list.map(({ st, p }) => `${cssColor(st, op)} ${r2(p)}%`).join(", ");
}

export function layerToCss(l: Layer, w: number, h: number): string | null {
  if (!NATIVE_CSS.includes(l.type)) return null;
  const repeating = l.repeat !== "none" ? "repeating-" : "";
  if (l.type === "linear" || l.type === "reflected") {
    let x1 = (l.x1 / 100) * w, y1 = (l.y1 / 100) * h, x2 = (l.x2 / 100) * w, y2 = (l.y2 / 100) * h;
    if (l.type === "reflected") {
      x1 = 2 * x1 - x2; // le dégradé part de l'axe dans les deux directions
      y1 = 2 * y1 - y2;
    }
    const dx = x2 - x1, dy = y2 - y1;
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI; // CSS : 0deg = vers le haut
    const ux = Math.sin((angle * Math.PI) / 180), uy = -Math.cos((angle * Math.PI) / 180);
    const L = Math.abs(w * ux) + Math.abs(h * uy) || 1;
    const pos = (x: number, y: number) => (((x - w / 2) * ux + (y - h / 2) * uy + L / 2) / L) * 100;
    const p1 = pos(x1, y1), p2 = pos(x2, y2);
    if (l.type === "reflected") {
      const mid = (p1 + p2) / 2;
      const half = stopsBetween(l.stops, mid, p2, l.opacity, "none", false).split(", ");
      const back = sortStops(l.stops).reverse().map((st) => `${cssColor(st, l.opacity)} ${r2(mid - (st.position / 100) * (p2 - mid))}%`);
      return `${repeating}linear-gradient(${r2(angle)}deg, ${back.join(", ")}, ${half.join(", ")})`;
    }
    return `${repeating}linear-gradient(${r2(angle)}deg, ${stopsBetween(l.stops, p1, p2, l.opacity, l.repeat, false)})`;
  }
  if (l.type === "radial") {
    const minSide = Math.min(w, h);
    const size = l.shape === "ellipse"
      ? `ellipse ${r2((l.rx / 100) * w)}px ${r2((l.ry / 100) * h)}px`
      : `circle ${r2((l.rx / 100) * minSide)}px`;
    return `${repeating}radial-gradient(${size} at ${r2(l.cx)}% ${r2(l.cy)}%, ${stopsBetween(l.stops, 0, 100, l.opacity, l.repeat, false)})`;
  }
  // Coniques
  const sym = l.type === "conic-symmetric";
  const stops = sym ? stopsBetween(l.stops, 0, 50, l.opacity, "none", true) : stopsBetween(l.stops, 0, 100, l.opacity, "none", false);
  return `conic-gradient(from ${r2(l.angle)}deg at ${r2(l.cx)}% ${r2(l.cy)}%, ${stops})`;
}

export function docToCss(doc: GradientDoc): { css: string; skipped: string[] } {
  const visible = doc.layers.filter((l) => l.visible);
  const parts: string[] = [];
  const blends: string[] = [];
  const skipped: string[] = [];
  // CSS : le premier arrière-plan est au-dessus → on inverse l'ordre des calques
  for (const l of visible.slice().reverse()) {
    // Calque entièrement transparent (ex. grain seul) : rien à représenter en CSS
    const invisible = NATIVE_CSS.includes(l.type) && l.stops.every((s) => s.opacity === 0);
    const css = invisible ? null : layerToCss(l, doc.width, doc.height);
    if (invisible) {
      if (l.grain > 0) skipped.push(`${l.name} : grain`);
      continue;
    }
    if (!css) {
      skipped.push(`${l.name} (${GEO_TYPES.find((g) => g.id === l.type)?.label})`);
      continue;
    }
    if (l.grain > 0) skipped.push(`${l.name} : grain`);
    parts.push(css);
    blends.push(l.blend);
  }
  const lines = [`/* NOXEL Spectra — ${doc.width} × ${doc.height} px */`];
  if (skipped.length) lines.push(`/* Non représentable en CSS natif (utilise l'export PNG) : ${skipped.join(" ; ")} */`);
  if (parts.length) {
    lines.push(`background: ${parts.join(",\n            ")};`);
    if (blends.some((b) => b !== "normal")) lines.push(`background-blend-mode: ${blends.join(", ")};`);
  }
  return { css: lines.join("\n"), skipped };
}

// ── Export SVG (linéaire et radial vectoriels ; le reste en image intégrée) ─
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// SVG interpole couleur et opacité séparément ; CSS et le moteur interpolent en alpha
// prémultiplié. Quand l'opacité change entre deux arrêts, on ajoute des arrêts
// intermédiaires calculés pour que le SVG reproduise exactement le même mélange.
function expandForSvg(list: { st: Stop; p: number }[]): { st: Stop; p: number }[] {
  const out: { st: Stop; p: number }[] = [];
  const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  for (let i = 0; i < list.length; i++) {
    out.push(list[i]);
    const B = list[i + 1];
    if (!B) break;
    const A = list[i];
    if (A.st.opacity === B.st.opacity || B.p === A.p) continue;
    const ca = premul(A.st), cb = premul(B.st);
    for (let k = 1; k < 8; k++) {
      const u = k / 8;
      const c = [0, 1, 2, 3].map((j) => ca[j] + (cb[j] - ca[j]) * u);
      const al = c[3];
      const color = al > 0 ? `#${toHex(c[0] / al)}${toHex(c[1] / al)}${toHex(c[2] / al)}` : B.st.color;
      out.push({ st: { position: 0, color, opacity: al * 100 }, p: A.p + (B.p - A.p) * u });
    }
  }
  return out;
}

export function docToSvg(doc: GradientDoc, rasterize: (l: Layer) => string): { svg: string; rasterized: string[] } {
  const { width: w, height: h } = doc;
  const defs: string[] = [];
  const body: string[] = [];
  const rasterized: string[] = [];
  doc.layers.forEach((l, i) => {
    if (!l.visible) return;
    const style = `opacity:${l.opacity / 100}${l.blend !== "normal" ? `;mix-blend-mode:${l.blend}` : ""}`;
    if (NATIVE_SVG.includes(l.type) && l.grain === 0) {
      const id = `g${i}`;
      const spread = l.repeat === "repeat" ? "repeat" : l.repeat === "reflect" ? "reflect" : "pad";
      const stopTags = (list: { st: Stop; p: number }[]) =>
        expandForSvg(list).map(({ st, p }) => `<stop offset="${r2(p)}%" stop-color="${st.color}" stop-opacity="${r2(st.opacity / 100)}"/>`).join("");
      const s = sortStops(l.stops);
      if (l.type === "linear" || l.type === "reflected") {
        let x1 = (l.x1 / 100) * w, y1 = (l.y1 / 100) * h;
        const x2 = (l.x2 / 100) * w, y2 = (l.y2 / 100) * h;
        let list = s.map((st) => ({ st, p: st.position }));
        if (l.type === "reflected") {
          x1 = 2 * x1 - x2;
          y1 = 2 * y1 - y2;
          list = s.slice().reverse().map((st) => ({ st, p: 50 - st.position / 2 })).concat(s.map((st) => ({ st, p: 50 + st.position / 2 })));
        }
        defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" spreadMethod="${spread}">${stopTags(list)}</linearGradient>`);
      } else {
        const minSide = Math.min(w, h);
        const rxp = l.shape === "ellipse" ? (l.rx / 100) * w : (l.rx / 100) * minSide;
        const ryp = l.shape === "ellipse" ? (l.ry / 100) * h : rxp;
        const cx = (l.cx / 100) * w, cy = (l.cy / 100) * h;
        defs.push(
          `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" spreadMethod="${spread}" gradientTransform="translate(${r2(cx)} ${r2(cy)}) scale(${r2(rxp)} ${r2(ryp)})">${stopTags(s.map((st) => ({ st, p: st.position })))}</radialGradient>`
        );
      }
      body.push(`<rect width="${w}" height="${h}" fill="url(#${id})" style="${style}"/>`);
    } else {
      rasterized.push(l.name);
      body.push(`<image width="${w}" height="${h}" href="${esc(rasterize(l))}" style="${style}"/>`);
    }
  });
  const note = rasterized.length
    ? `<!-- NOXEL Spectra : calques intégrés en image (pas de géométrie SVG native) : ${esc(rasterized.join(", "))} -->`
    : "";
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${note}<defs>${defs.join("")}</defs><g style="isolation:isolate">${body.join("")}</g></svg>`,
    rasterized,
  };
}

// ── Préréglages ─────────────────────────────────────────────────────────
const st = (position: number, color: string, opacity = 100): Stop => ({ position, color, opacity });

export const PRESETS: { id: string; name: string; build: () => Layer[] }[] = [
  { id: "noxel", name: "NOXEL", build: () => [makeLayer({ name: "NOXEL", x1: 0, y1: 0, x2: 100, y2: 100 })] },
  {
    id: "sunset", name: "Coucher de soleil",
    build: () => [makeLayer({ name: "Coucher de soleil", x1: 50, y1: 0, x2: 50, y2: 100, stops: [st(0, "#2b1055"), st(45, "#d53369"), st(75, "#f27121"), st(100, "#ffd23f")] })],
  },
  {
    id: "ocean", name: "Océan",
    build: () => [makeLayer({ name: "Océan", x1: 0, y1: 100, x2: 100, y2: 0, stops: [st(0, "#0f2027"), st(50, "#2c5364"), st(100, "#38ef7d")] })],
  },
  {
    id: "spectrum", name: "Spectre",
    build: () => [makeLayer({ name: "Spectre", stops: [st(0, "#ff0040"), st(17, "#ff9900"), st(33, "#ffee00"), st(50, "#33dd55"), st(67, "#00bbff"), st(83, "#5544ff"), st(100, "#cc33ff")] })],
  },
  {
    id: "aurora", name: "Aurore",
    build: () => [
      makeLayer({ name: "Nuit", stops: [st(0, "#050814"), st(100, "#0b1a2e")], x1: 50, y1: 0, x2: 50, y2: 100 }),
      makeLayer({ name: "Halo vert", type: "radial", shape: "ellipse", cx: 30, cy: 35, rx: 55, ry: 45, blend: "screen", stops: [st(0, "#3ddc84", 85), st(100, "#3ddc84", 0)] }),
      makeLayer({ name: "Halo mauve", type: "radial", shape: "ellipse", cx: 72, cy: 55, rx: 50, ry: 50, blend: "screen", stops: [st(0, "#a855f7", 80), st(100, "#a855f7", 0)] }),
      makeLayer({ name: "Halo bleu", type: "radial", shape: "ellipse", cx: 55, cy: 15, rx: 40, ry: 30, blend: "screen", stops: [st(0, "#22d3ee", 55), st(100, "#22d3ee", 0)] }),
    ],
  },
  {
    id: "neon", name: "Néon",
    build: () => [
      makeLayer({ name: "Fond", stops: [st(0, "#07090f"), st(100, "#0c0f1a")] }),
      makeLayer({ name: "Lueur verte", type: "radial", cx: 25, cy: 50, rx: 45, blend: "screen", stops: [st(0, "#3ddc84", 100), st(35, "#3ddc84", 45), st(100, "#3ddc84", 0)] }),
      makeLayer({ name: "Lueur mauve", type: "radial", cx: 75, cy: 50, rx: 45, blend: "screen", stops: [st(0, "#a855f7", 100), st(35, "#a855f7", 45), st(100, "#a855f7", 0)] }),
      makeLayer({ name: "Grain", stops: [st(0, "#808080", 0), st(100, "#808080", 0)], grain: 18, blend: "overlay" }),
    ],
  },
  {
    id: "metal", name: "Métallique",
    build: () => [
      makeLayer({ name: "Chrome", x1: 0, y1: 0, x2: 30, y2: 30, repeat: "reflect", stops: [st(0, "#2b2f36"), st(30, "#c9d1d9"), st(50, "#f5f7fa"), st(70, "#8b949e"), st(100, "#3b414a")] }),
      makeLayer({ name: "Reflet", type: "radial", shape: "ellipse", cx: 30, cy: 20, rx: 60, ry: 40, blend: "soft-light", stops: [st(0, "#ffffff", 70), st(100, "#ffffff", 0)] }),
    ],
  },
  {
    id: "holo", name: "Holographique",
    build: () => [
      makeLayer({ name: "Prisme", type: "conic", angle: 30, stops: [st(0, "#ff7eb3"), st(20, "#ffd36e"), st(40, "#7afcff"), st(60, "#a3a1ff"), st(80, "#3ddc84"), st(100, "#ff7eb3")] }),
      makeLayer({ name: "Voile", x1: 0, y1: 0, x2: 100, y2: 100, blend: "soft-light", stops: [st(0, "#ffffff", 70), st(50, "#a855f7", 40), st(100, "#ffffff", 70)] }),
    ],
  },
  {
    id: "stripes", name: "Bandes nettes",
    build: () => [makeLayer({ name: "Bandes", x1: 0, y1: 0, x2: 8, y2: 8, repeat: "repeat", stops: [st(0, "#3ddc84"), st(50, "#3ddc84"), st(50, "#07090f"), st(100, "#07090f")] })],
  },
];

// Calques à ajouter par-dessus le dégradé existant
export const ADD_ONS: { id: string; name: string; build: () => Layer }[] = [
  {
    id: "vignette", name: "+ Vignette",
    build: () => makeLayer({ name: "Vignette", type: "radial", shape: "ellipse", rx: 75, ry: 75, blend: "multiply", stops: [st(0, "#000000", 0), st(55, "#000000", 0), st(100, "#000000", 85)] }),
  },
  {
    id: "grain", name: "+ Grain",
    build: () => makeLayer({ name: "Grain", stops: [st(0, "#808080", 0), st(100, "#808080", 0)], grain: 25, blend: "overlay" }),
  },
  {
    id: "halo", name: "+ Halo lumineux",
    build: () => makeLayer({ name: "Halo", type: "radial", cx: 50, cy: 40, rx: 40, blend: "screen", stops: [st(0, "#ffffff", 60), st(100, "#ffffff", 0)] }),
  },
];
