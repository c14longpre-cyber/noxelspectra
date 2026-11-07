// Traitements d'image faits sur le serveur de l'app (sharp). Le détourage, lui, passe par l'API NOXEL SPECTRA
// (modèle d'IA hébergé sur api.noxelspectra.com). Le format de sortie reste celui de l'original : Shopify exige
// la même extension pour remplacer une image (fileUpdate), et son CDN sert déjà WebP / AVIF aux navigateurs.
import sharp from "sharp";

export type Format = "jpeg" | "png" | "webp";
export const COTE_MAX = 2048;  // assez pour le zoom des fiches produits, sans fichiers de 8 Mo

export function formatDuMime(mime: string | null | undefined): Format | null {
  const m = (mime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpeg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return null;  // GIF, AVIF, HEIC… : pas traités en V1
}

function encoder(img: sharp.Sharp, format: Format): Promise<Buffer> {
  if (format === "jpeg") return img.flatten({ background: "#ffffff" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  if (format === "webp") return img.webp({ quality: 82 }).toBuffer();
  return img.png({ compressionLevel: 9, palette: false }).toBuffer();
}

/** Alléger : côté le plus long ramené à 2048 px si besoin, puis recompression. null = pas plus léger que l'original. */
export async function alleger(entree: Buffer, format: Format): Promise<Buffer | null> {
  const img = sharp(entree, { failOn: "none" }).rotate().resize({ width: COTE_MAX, height: COTE_MAX, fit: "inside", withoutEnlargement: true });
  const sortie = await encoder(img, format);
  return sortie.length < entree.length * 0.97 ? sortie : null;
}

/** Carré uniforme : l'image entière centrée sur un fond carré (blanc, ou transparent pour PNG / WebP si demandé). */
export async function carre(entree: Buffer, format: Format, opts: { marge?: number; transparent?: boolean } = {}): Promise<Buffer> {
  const base = sharp(entree, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const w = meta.width || 1, h = meta.height || 1;
  const cote = Math.min(COTE_MAX, Math.max(w, h));
  const interieur = Math.round(cote * (1 - 2 * (opts.marge ?? 0.06)));
  const fond = opts.transparent && format !== "jpeg" ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };
  const img = base.resize({ width: interieur, height: interieur, fit: "contain", background: fond })
    .extend({ top: Math.floor((cote - interieur) / 2), bottom: Math.ceil((cote - interieur) / 2), left: Math.floor((cote - interieur) / 2), right: Math.ceil((cote - interieur) / 2), background: fond });
  return encoder(img, format);
}

/** Remet une image (PNG détouré, par exemple) dans le format de l'original */
export async function versFormat(entree: Buffer, format: Format): Promise<Buffer> {
  return encoder(sharp(entree, { failOn: "none" }).resize({ width: COTE_MAX, height: COTE_MAX, fit: "inside", withoutEnlargement: true }), format);
}
