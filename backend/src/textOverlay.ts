// NOXEL Spectra — rendu du texte des filigranes
//
// Sharp dessine le SVG avec librsvg, qui cherche ses polices via fontconfig.
// Le conteneur Railway n'a aucune police installée : chaque lettre sortait
// en rectangle vide. On embarque donc DejaVu Sans Bold (assets/fonts/) et on
// pointe fontconfig dessus avant le premier rendu de texte.

import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

const FONT_DIR = path.resolve(__dirname, "..", "assets", "fonts");
const FONT_FAMILY = "DejaVu Sans";

// Les polices du système restent disponibles quand elles existent (dev local).
if (!process.env.FONTCONFIG_FILE) {
  try {
    const confPath = path.join(os.tmpdir(), "noxel-spectra-fonts.conf");
    const esc = (p: string) => p.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    fs.writeFileSync(
      confPath,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n` +
        `  <dir>${esc(FONT_DIR)}</dir>\n` +
        `  <cachedir>${esc(path.join(os.tmpdir(), "noxel-spectra-fontcache"))}</cachedir>\n` +
        `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n` +
        `</fontconfig>\n`
    );
    process.env.FONTCONFIG_FILE = confPath;
  } catch (err) {
    console.error("Fontconfig setup failed:", err);
  }
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Rend le texte en PNG transparent, recadré au plus juste puis entouré d'une marge.
export async function renderTextOverlay(opts: {
  text: string;
  color: string;
  opacity: number; // 0-1
  fontSize: number;
}): Promise<Buffer> {
  const { text, opacity, fontSize } = opts;
  const color = /^#[0-9a-fA-F]{3,8}$/.test(opts.color) ? opts.color : "#ffffff";
  const pad = Math.round(fontSize * 0.6);
  // Largeur large exprès (lettres capitales en gras ≈ 0,8 em) ; trim() rogne ensuite
  const tw = Math.round(Math.max(1, text.length) * fontSize * 0.9) + pad * 2;
  const th = Math.round(fontSize * 1.5) + pad;
  const svg =
    `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">` +
    `<text x="${pad}" y="${Math.round(th * 0.68)}" font-family="${FONT_FAMILY}, sans-serif" font-size="${fontSize}" ` +
    `font-weight="700" fill="${color}" fill-opacity="${opacity}">${escapeXml(text)}</text></svg>`;
  const raw = await sharp(Buffer.from(svg)).png().toBuffer();
  try {
    return await sharp(raw)
      .trim()
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  } catch {
    // Texte vide ou entièrement transparent : rien à rogner
    return raw;
  }
}
