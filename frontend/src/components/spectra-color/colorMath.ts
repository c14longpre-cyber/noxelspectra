// Conversions de couleur de la pipette (sans dépendance, testées dans colorMath.test.mts).
export type Rgb = [number, number, number];

const h2 = (n: number) => n.toString(16).padStart(2, "0");

export function rgbEnHsl([r, g, b]: Rgb): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return [Math.round(h) % 360, Math.round(s * 100), Math.round(l * 100)];
}

export function formats(rgb: Rgb) {
  const [r, g, b] = rgb;
  const [h, s, l] = rgbEnHsl(rgb);
  return { hex: `#${h2(r)}${h2(g)}${h2(b)}`, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${h}, ${s}%, ${l}%)` };
}

// Luminance relative et rapport de contraste, formules des WCAG 2.x
function luminance([r, g, b]: Rgb): number {
  const c = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

export function contraste(a: Rgb, b: Rgb): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hslEnRgb(h: number, s: number, l: number): Rgb {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function hexEnRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// « #abc », « abc », « #aabbcc » → « #aabbcc » ; null si ce n'est pas une couleur
export function normaliserHex(v: string): string | null {
  let s = v.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

// Critères WCAG 2.2 : 1.4.3 (AA), 1.4.6 (AAA), 1.4.11 (composants d'interface et graphiques)
export const CRITERES = [
  { id: "aa", seuil: 4.5 },
  { id: "aaLarge", seuil: 3 },
  { id: "aaa", seuil: 7 },
  { id: "aaaLarge", seuil: 4.5 },
  { id: "ui", seuil: 3 },
] as const;

// Couleur de texte la plus proche (même teinte et saturation, luminosité changée le moins possible)
// qui atteint le rapport voulu sur ce fond ; null si aucune n'y arrive.
export function couleurProche(texte: Rgb, fond: Rgb, cible: number): string | null {
  if (contraste(texte, fond) >= cible) return formats(texte).hex;
  const [h, s, l] = rgbEnHsl(texte);
  for (let d = 1; d <= 100; d++) {
    for (const L of [l - d, l + d]) {
      if (L < 0 || L > 100) continue;
      const rgb = hslEnRgb(h, s, L);
      if (contraste(rgb, fond) >= cible) return formats(rgb).hex;
    }
  }
  return null;
}
