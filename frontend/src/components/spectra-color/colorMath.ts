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
