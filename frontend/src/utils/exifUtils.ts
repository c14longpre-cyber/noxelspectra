// NOXEL SPECTRA — lecture et retrait des métadonnées d'une image, sans dépendance.
//
// readMetadata() repère ce qu'un fichier JPEG, PNG, WebP ou AVIF révèle (position GPS,
// date de prise de vue, appareil, logiciel, blocs XMP/IPTC/texte).
// stripMetadata() retire ces blocs SANS ré-encoder l'image : les pixels, le
// profil de couleur (ICC) et le reste du fichier restent identiques à l'octet près.
//
// Orientation : le navigateur (aperçu) applique l'orientation EXIF, et le serveur
// ne la corrige que dans le traitement par lots (sharp().rotate()). Retirer toute
// l'EXIF coucherait donc une photo de téléphone. Quand l'orientation n'est pas 1,
// on remet un bloc EXIF minimal qui ne contient QUE l'orientation.
//
// AVIF (conteneur ISOBMFF/HEIF) : l'EXIF et le XMP sont des « items » dont la
// position est donnée par la boîte iloc. Les retirer obligerait à recalculer
// toutes les positions du fichier ; on vide donc leur contenu SUR PLACE (EXIF
// vide mais valide, XMP remis à zéro), sans changer aucune taille ni position.
// L'orientation y est portée par les propriétés irot/imir, pas par l'EXIF :
// vider l'EXIF ne fait pas pivoter l'image. Le HEIC n'est pas analysé : le
// serveur (sharp précompilé) ne sait pas le décoder, l'application ne le prend
// donc pas en charge.
//
// Toutes les lectures sont bornées : un fichier mal formé ne lève jamais
// d'exception, il donne simplement null (rien trouvé / rien retiré).

export type ImageMetaFormat = "jpeg" | "png" | "webp" | "avif";

export type ImageMetadata = {
  format: ImageMetaFormat;
  gps?: { lat: number; lng: number };
  /** Date au format EXIF « AAAA:MM:JJ HH:MM:SS » */
  dateTime?: string;
  make?: string;
  model?: string;
  software?: string;
  /** Orientation EXIF (1 à 8), si présente */
  orientation?: number;
  /** Autres champs EXIF non techniques (auteur, numéro de série, objectif…) */
  otherExif: boolean;
  /** Position GPS présente mais illisible */
  gpsUnreadable: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  /** Commentaire JPEG ou blocs texte PNG (mots-clés) */
  textKeys: string[];
};

export type StripResult = {
  file: File;
  /** true si des métadonnées ont été retirées */
  removed: boolean;
  /** Format non pris en charge : fichier rendu tel quel */
  unsupported?: boolean;
};

const MAX_STRING = 256;

// ── Lecture d'octets bornée ───────────────────────────────────────────

function u16be(b: Uint8Array, o: number): number {
  return o >= 0 && o + 2 <= b.length ? (b[o] << 8) | b[o + 1] : -1;
}
function u32be(b: Uint8Array, o: number): number {
  return o >= 0 && o + 4 <= b.length ? ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) : -1;
}
function u32le(b: Uint8Array, o: number): number {
  return o >= 0 && o + 4 <= b.length ? ((b[o + 3] << 24) >>> 0) + ((b[o + 2] << 16) | (b[o + 1] << 8) | b[o]) : -1;
}
function ascii(b: Uint8Array, o: number, n: number): string {
  if (o < 0 || o + n > b.length) return "";
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]);
  return s;
}
function startsWith(b: Uint8Array, o: number, sig: string): boolean {
  return ascii(b, o, sig.length) === sig;
}
function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

export function sniffFormat(b: Uint8Array): ImageMetaFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && startsWith(b, 1, "PNG\r\n\x1a\n")) return "png";
  if (b.length >= 12 && startsWith(b, 0, "RIFF") && startsWith(b, 8, "WEBP")) return "webp";
  if (startsWith(b, 4, "ftyp")) {
    // Marque principale (octet 8) puis marques compatibles (à partir de l'octet 16)
    const size = Math.min(u32be(b, 0), b.length, 4096);
    for (let o = 8; o + 4 <= size; o += o === 8 ? 8 : 4) {
      const brand = ascii(b, o, 4);
      if (brand === "avif" || brand === "avis") return "avif";
    }
  }
  return null;
}

// ── EXIF (TIFF) ───────────────────────────────────────────────────────

type TiffInfo = {
  gps?: { lat: number; lng: number };
  gpsUnreadable: boolean;
  dateTime?: string;
  make?: string;
  model?: string;
  software?: string;
  orientation?: number;
  otherExif: boolean;
};

// Champs purement techniques : leur présence seule ne justifie pas d'alerte.
const TECHNICAL_IFD0 = new Set([
  0x0100, 0x0101, 0x0102, 0x0103, 0x0106, 0x0112, 0x0115, 0x011a, 0x011b, 0x011c, 0x0128, 0x0213,
  0x0201, 0x0202, 0x0111, 0x0116, 0x0117, 0x0110, 0x010f, 0x0131, 0x0132, 0x8769, 0x8825, 0xa005,
]);
const TECHNICAL_EXIF = new Set([0x9000, 0x9101, 0xa000, 0xa001, 0xa002, 0xa003, 0x9003, 0x9004, 0xa005]);
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

type Entry = { tag: number; type: number; count: number; valueOffset: number };

/** Lit un bloc TIFF (en-tête « II*\0 » ou « MM\0* »). Jamais d'exception. */
export function parseTiff(b: Uint8Array, start: number, length: number): TiffInfo | null {
  try {
    const end = Math.min(b.length, start + length);
    if (start < 0 || start + 8 > end) return null;
    const order = ascii(b, start, 2);
    if (order !== "II" && order !== "MM") return null;
    const le = order === "II";
    const r16 = (o: number) => {
      const a = start + o;
      if (o < 0 || a + 2 > end) return -1;
      return le ? b[a] | (b[a + 1] << 8) : (b[a] << 8) | b[a + 1];
    };
    const r32 = (o: number) => {
      const a = start + o;
      if (o < 0 || a + 4 > end) return -1;
      return le ? u32le(b, a) : u32be(b, a);
    };
    if (r16(2) !== 42) return null;

    const seen = new Set<number>();
    const readIfd = (offset: number): Entry[] => {
      if (offset <= 0 || seen.has(offset)) return [];
      seen.add(offset);
      const count = r16(offset);
      if (count <= 0 || count > 1000) return [];
      const entries: Entry[] = [];
      for (let i = 0; i < count; i++) {
        const e = offset + 2 + i * 12;
        const tag = r16(e);
        const type = r16(e + 2);
        const n = r32(e + 4);
        if (tag < 0 || type < 0 || n < 0) break;
        const size = (TYPE_SIZE[type] ?? 0) * n;
        // Valeur dans l'entrée si elle tient sur 4 octets, sinon à l'adresse indiquée
        const valueOffset = size <= 4 ? e + 8 : r32(e + 8);
        if (valueOffset < 0 || size === 0 || valueOffset + size > end - start) continue;
        entries.push({ tag, type, count: n, valueOffset });
      }
      return entries;
    };
    const str = (en: Entry | undefined): string | undefined => {
      if (!en || en.type !== 2) return undefined;
      const n = Math.min(en.count, MAX_STRING);
      const bytes = b.subarray(start + en.valueOffset, start + en.valueOffset + n);
      const zero = bytes.indexOf(0);
      const text = new TextDecoder("utf-8").decode(zero >= 0 ? bytes.subarray(0, zero) : bytes);
      // eslint-disable-next-line no-control-regex
      const clean = text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
      return clean || undefined;
    };
    const num = (en: Entry | undefined): number | undefined => {
      if (!en) return undefined;
      if (en.type === 3) return r16(en.valueOffset);
      if (en.type === 4) return r32(en.valueOffset);
      return undefined;
    };
    const rationals = (en: Entry | undefined, n: number): number[] | null => {
      if (!en || en.type !== 5 || en.count < n) return null;
      const out: number[] = [];
      for (let i = 0; i < n; i++) {
        const num = r32(en.valueOffset + i * 8);
        const den = r32(en.valueOffset + i * 8 + 4);
        if (num < 0 || den <= 0) return null;
        out.push(num / den);
      }
      return out;
    };

    const info: TiffInfo = { gpsUnreadable: false, otherExif: false };
    const ifd0 = readIfd(r32(4));
    const find = (list: Entry[], tag: number) => list.find((e) => e.tag === tag);
    info.make = str(find(ifd0, 0x010f));
    info.model = str(find(ifd0, 0x0110));
    info.software = str(find(ifd0, 0x0131));
    const o = num(find(ifd0, 0x0112));
    if (o !== undefined && o >= 1 && o <= 8) info.orientation = o;
    if (ifd0.some((e) => !TECHNICAL_IFD0.has(e.tag))) info.otherExif = true;

    const exifPtr = num(find(ifd0, 0x8769));
    const exif = exifPtr !== undefined ? readIfd(exifPtr) : [];
    info.dateTime = str(find(exif, 0x9003)) ?? str(find(exif, 0x9004)) ?? str(find(ifd0, 0x0132));
    if (exif.some((e) => !TECHNICAL_EXIF.has(e.tag))) info.otherExif = true;

    const gpsPtr = num(find(ifd0, 0x8825));
    const gps = gpsPtr !== undefined ? readIfd(gpsPtr) : [];
    if (gps.length) {
      const latRef = str(find(gps, 0x0001))?.toUpperCase();
      const lat = rationals(find(gps, 0x0002), 3);
      const lngRef = str(find(gps, 0x0003))?.toUpperCase();
      const lng = rationals(find(gps, 0x0004), 3);
      if (lat && lng) {
        const latDeg = (lat[0] + lat[1] / 60 + lat[2] / 3600) * (latRef === "S" ? -1 : 1);
        const lngDeg = (lng[0] + lng[1] / 60 + lng[2] / 3600) * (lngRef === "W" ? -1 : 1);
        if (Number.isFinite(latDeg) && Number.isFinite(lngDeg) && Math.abs(latDeg) <= 90 && Math.abs(lngDeg) <= 180) {
          info.gps = { lat: latDeg, lng: lngDeg };
        } else info.gpsUnreadable = true;
      } else if (gps.some((e) => e.tag !== 0x0000)) {
        // Version GPS seule = rien ; tout autre champ GPS (altitude, heure…) compte
        info.gpsUnreadable = true;
      }
    }
    return info;
  } catch {
    return null;
  }
}

/** Bloc TIFF minimal (gros-boutiste) ne contenant que l'orientation. */
function minimalOrientationTiff(orientation: number): Uint8Array {
  return new Uint8Array([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // en-tête, IFD0 à l'octet 8
    0x00, 0x01, // une entrée
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, orientation >> 8, orientation & 0xff, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // pas d'IFD suivant
  ]);
}

function emptyMeta(format: ImageMetaFormat): ImageMetadata {
  return { format, otherExif: false, gpsUnreadable: false, hasXmp: false, hasIptc: false, textKeys: [] };
}

function mergeTiff(meta: ImageMetadata, t: TiffInfo | null) {
  if (!t) return;
  meta.gps ??= t.gps;
  meta.dateTime ??= t.dateTime;
  meta.make ??= t.make;
  meta.model ??= t.model;
  meta.software ??= t.software;
  meta.orientation ??= t.orientation;
  meta.otherExif ||= t.otherExif;
  meta.gpsUnreadable ||= t.gpsUnreadable;
}

function isSignificant(m: ImageMetadata): boolean {
  return !!(
    m.gps || m.gpsUnreadable || m.dateTime || m.make || m.model || m.software ||
    m.otherExif || m.hasXmp || m.hasIptc || m.textKeys.length
  );
}

// ── JPEG ──────────────────────────────────────────────────────────────

type JpegSegment = { marker: number; start: number; end: number };

/** Découpe l'en-tête JPEG jusqu'au premier SOS. null si mal formé. */
function jpegSegments(b: Uint8Array): { segments: JpegSegment[]; scanStart: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const segments: JpegSegment[] = [];
  let pos = 2;
  while (pos < b.length) {
    if (b[pos] !== 0xff) return null;
    let p = pos;
    while (p < b.length && b[p] === 0xff) p++; // octets de remplissage
    if (p >= b.length) return null;
    const marker = b[p];
    const segStart = p - 1;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos = p + 1;
      continue;
    }
    if (marker === 0xd9) return { segments, scanStart: segStart }; // fin sans image
    const len = u16be(b, p + 1);
    if (len < 2 || p + 1 + len > b.length) return null;
    if (marker === 0xda) return { segments, scanStart: segStart };
    segments.push({ marker, start: segStart, end: p + 1 + len });
    pos = p + 1 + len;
  }
  return null;
}

/** Position juste après l'EOI de l'image principale (les données suivantes, images MPF incluses, sont ignorées). */
function jpegEnd(b: Uint8Array, scanStart: number): number {
  let i = scanStart;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m === 0xd9) return i + 2;
    if (m === 0x00 || m === 0xff || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += m === 0xff ? 1 : 2;
      continue;
    }
    // Segment entre deux passes (SOS, DHT, DQT…) : on saute sa longueur
    const len = u16be(b, i + 2);
    if (len < 2) return b.length;
    i += 2 + len;
  }
  return b.length;
}

const XMP_SIG = "http://ns.adobe.com/xap/1.0/\0";
const XMP_EXT_SIG = "http://ns.adobe.com/xmp/extension/\0";

function parseJpeg(b: Uint8Array): ImageMetadata | null {
  const parsed = jpegSegments(b);
  if (!parsed) return null;
  const meta = emptyMeta("jpeg");
  for (const s of parsed.segments) {
    const data = s.start + 4;
    if (s.marker === 0xe1) {
      if (startsWith(b, data, "Exif\0\0")) mergeTiff(meta, parseTiff(b, data + 6, s.end - data - 6));
      else if (startsWith(b, data, XMP_SIG) || startsWith(b, data, XMP_EXT_SIG)) meta.hasXmp = true;
      else meta.otherExif = true;
    } else if (s.marker === 0xed) {
      meta.hasIptc = true;
    } else if (s.marker === 0xfe) {
      if (!meta.textKeys.includes("Commentaire")) meta.textKeys.push("Commentaire");
    }
  }
  return meta;
}

function stripJpeg(b: Uint8Array, orientation: number | undefined): Uint8Array<ArrayBuffer> | null {
  const parsed = jpegSegments(b);
  if (!parsed) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let inserted = !(orientation && orientation !== 1);
  const insertOrientation = () => {
    if (inserted) return;
    inserted = true;
    const tiff = minimalOrientationTiff(orientation!);
    const len = 2 + 6 + tiff.length;
    parts.push(new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0]), tiff);
  };
  for (const s of parsed.segments) {
    const data = s.start + 4;
    // APP1 (EXIF, XMP), APP13 (IPTC/Photoshop), COM (commentaire), APP2 MPF
    // (renvoie vers les images annexes, retirées plus bas)
    const drop =
      s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe ||
      (s.marker === 0xe2 && startsWith(b, data, "MPF\0"));
    // Bloc d'orientation après l'APP0 JFIF (qui doit rester en tête), sinon en premier
    if (s.marker !== 0xe0) insertOrientation();
    if (!drop) parts.push(b.subarray(s.start, s.end));
  }
  insertOrientation();
  parts.push(b.subarray(parsed.scanStart, jpegEnd(b, parsed.scanStart)));
  return concat(parts);
}

// ── PNG ───────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type PngChunk = { type: string; start: number; dataStart: number; dataLen: number; end: number };

function pngChunks(b: Uint8Array): PngChunk[] | null {
  if (sniffFormat(b) !== "png") return null;
  const chunks: PngChunk[] = [];
  let pos = 8;
  while (pos + 12 <= b.length) {
    const len = u32be(b, pos);
    const type = ascii(b, pos + 4, 4);
    if (len < 0 || pos + 12 + len > b.length || !/^[A-Za-z]{4}$/.test(type)) return null;
    chunks.push({ type, start: pos, dataStart: pos + 8, dataLen: len, end: pos + 12 + len });
    pos += 12 + len;
    if (type === "IEND") return chunks;
  }
  return null;
}

const PNG_TEXT = new Set(["tEXt", "iTXt", "zTXt"]);

function parsePng(b: Uint8Array): ImageMetadata | null {
  const chunks = pngChunks(b);
  if (!chunks) return null;
  const meta = emptyMeta("png");
  for (const c of chunks) {
    if (c.type === "eXIf") {
      // Certains logiciels préfixent le bloc par « Exif\0\0 »
      const off = startsWith(b, c.dataStart, "Exif\0\0") ? 6 : 0;
      const t = parseTiff(b, c.dataStart + off, c.dataLen - off);
      if (t) mergeTiff(meta, t);
      else meta.otherExif = true;
    } else if (PNG_TEXT.has(c.type)) {
      const raw = b.subarray(c.dataStart, c.dataStart + Math.min(c.dataLen, 80));
      const zero = raw.indexOf(0);
      const key = ascii(raw, 0, zero >= 0 ? zero : raw.length).trim() || c.type;
      if (key === "XML:com.adobe.xmp") meta.hasXmp = true;
      else {
        if (key === "Software" && c.type === "tEXt" && zero >= 0) {
          const value = ascii(b, c.dataStart + zero + 1, Math.min(c.dataLen - zero - 1, MAX_STRING)).trim();
          if (value) meta.software ??= value;
        }
        if (!meta.textKeys.includes(key) && meta.textKeys.length < 20) meta.textKeys.push(key);
      }
    }
  }
  return meta;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function stripPng(b: Uint8Array, orientation: number | undefined): Uint8Array<ArrayBuffer> | null {
  const chunks = pngChunks(b);
  if (!chunks) return null;
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  for (const c of chunks) {
    if (c.type === "eXIf") {
      if (orientation && orientation !== 1) parts.push(pngChunk("eXIf", minimalOrientationTiff(orientation)));
      continue;
    }
    if (PNG_TEXT.has(c.type)) continue;
    parts.push(b.subarray(c.start, c.end));
  }
  return concat(parts);
}

// ── WebP ──────────────────────────────────────────────────────────────

type RiffChunk = { fourcc: string; start: number; dataStart: number; dataLen: number; end: number };

function webpChunks(b: Uint8Array): RiffChunk[] | null {
  if (sniffFormat(b) !== "webp") return null;
  const riffEnd = Math.min(b.length, 8 + u32le(b, 4));
  const chunks: RiffChunk[] = [];
  let pos = 12;
  while (pos + 8 <= riffEnd) {
    const fourcc = ascii(b, pos, 4);
    const len = u32le(b, pos + 4);
    const end = pos + 8 + len + (len & 1);
    if (len < 0 || pos + 8 + len > riffEnd) return null;
    chunks.push({ fourcc, start: pos, dataStart: pos + 8, dataLen: len, end: Math.min(end, riffEnd) });
    pos = end;
  }
  return chunks.length ? chunks : null;
}

function parseWebp(b: Uint8Array): ImageMetadata | null {
  const chunks = webpChunks(b);
  if (!chunks) return null;
  const meta = emptyMeta("webp");
  for (const c of chunks) {
    if (c.fourcc === "EXIF") {
      const off = startsWith(b, c.dataStart, "Exif\0\0") ? 6 : 0;
      const t = parseTiff(b, c.dataStart + off, c.dataLen - off);
      if (t) mergeTiff(meta, t);
      else meta.otherExif = true;
    } else if (c.fourcc === "XMP ") meta.hasXmp = true;
  }
  return meta;
}

function stripWebp(b: Uint8Array, orientation: number | undefined): Uint8Array<ArrayBuffer> | null {
  const chunks = webpChunks(b);
  if (!chunks) return null;
  const keepOrientation = !!(orientation && orientation !== 1);
  const parts: Uint8Array[] = [b.subarray(0, 12)];
  let vp8x: Uint8Array | null = null;
  for (const c of chunks) {
    if (c.fourcc === "XMP ") continue;
    if (c.fourcc === "EXIF") {
      if (keepOrientation) {
        const tiff = minimalOrientationTiff(orientation!);
        const head = new Uint8Array(8);
        head.set([0x45, 0x58, 0x49, 0x46]);
        new DataView(head.buffer).setUint32(4, tiff.length, true);
        parts.push(head, tiff); // 26 octets : pas de remplissage
      }
      continue;
    }
    const bytes = b.slice(c.start, c.end);
    if (c.fourcc === "VP8X" && bytes.length >= 9) vp8x = bytes;
    parts.push(bytes);
  }
  if (vp8x) {
    // Drapeaux VP8X : 0x08 = EXIF, 0x04 = XMP
    vp8x[8] &= ~0x04;
    if (!keepOrientation) vp8x[8] &= ~0x08;
  }
  const out = concat(parts);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}

// ── AVIF (ISOBMFF / HEIF) ─────────────────────────────────────────────

type IsoBox = { type: string; start: number; dataStart: number; end: number };

/** Boîtes ISOBMFF entre start et end. Arrêt silencieux sur une boîte mal formée. */
function isoBoxes(b: Uint8Array, start: number, end: number): IsoBox[] {
  const boxes: IsoBox[] = [];
  let pos = start;
  while (pos + 8 <= end && boxes.length < 10000) {
    let size = u32be(b, pos);
    const type = ascii(b, pos + 4, 4);
    let header = 8;
    if (size === 1) {
      size = u64be(b, pos + 8);
      header = 16;
    } else if (size === 0) size = end - pos; // jusqu'à la fin du conteneur
    if (size < header || pos + size > end) break;
    boxes.push({ type, start: pos, dataStart: pos + header, end: pos + size });
    pos += size;
  }
  return boxes;
}

function u64be(b: Uint8Array, o: number): number {
  const hi = u32be(b, o);
  const lo = u32be(b, o + 4);
  if (hi < 0 || lo < 0 || hi > 0x1fffff) return -1; // au-delà de 2^53 : refusé
  return hi * 0x100000000 + lo;
}
/** Entier gros-boutiste de 0, 4 ou 8 octets (tailles permises par iloc). */
function uNbe(b: Uint8Array, o: number, n: number): number {
  return n === 0 ? 0 : n === 4 ? u32be(b, o) : n === 8 ? u64be(b, o) : -1;
}
/** Chaîne terminée par un zéro ; renvoie le texte et la position suivante. */
function cString(b: Uint8Array, o: number, end: number): { text: string; next: number } | null {
  let i = o;
  while (i < end && b[i] !== 0) i++;
  if (i >= end) return null;
  return { text: ascii(b, o, Math.min(i - o, MAX_STRING)), next: i + 1 };
}

type IsoExtent = { pos: number; len: number };
type IsoItem = { id: number; type: string; contentType?: string; extents?: IsoExtent[] };

/** Items EXIF et XMP de la boîte meta, avec la position de leurs données dans le fichier. */
function isoMetaItems(b: Uint8Array): IsoItem[] | null {
  if (sniffFormat(b) !== "avif") return null;
  const top = isoBoxes(b, 0, b.length);
  const meta = top.find((x) => x.type === "meta");
  if (!meta) return [];
  // meta est une « full box » : 4 octets de version et de drapeaux
  const children = isoBoxes(b, meta.dataStart + 4, meta.end);
  const items = new Map<number, IsoItem>();

  const iinf = children.find((x) => x.type === "iinf");
  if (iinf) {
    const version = b[iinf.dataStart];
    const first = iinf.dataStart + 4 + (version === 0 ? 2 : 4);
    for (const infe of isoBoxes(b, first, iinf.end)) {
      if (infe.type !== "infe") continue;
      const v = b[infe.dataStart];
      let p = infe.dataStart + 4;
      if (v >= 2) {
        const id = v === 2 ? u16be(b, p) : u32be(b, p);
        p += (v === 2 ? 2 : 4) + 2; // item_ID, protection_index
        const type = ascii(b, p, 4);
        p += 4;
        const name = cString(b, p, infe.end);
        let contentType: string | undefined;
        if (type === "mime" && name) contentType = cString(b, name.next, infe.end)?.text;
        if (id >= 0 && (type === "Exif" || type === "mime")) items.set(id, { id, type, contentType });
      } else {
        // Versions 0 et 1 : pas de type d'item, seulement un type MIME
        const id = u16be(b, p);
        const name = cString(b, p + 4, infe.end);
        const contentType = name ? cString(b, name.next, infe.end)?.text : undefined;
        if (id >= 0 && contentType) items.set(id, { id, type: "mime", contentType });
      }
    }
  }
  if (!items.size) return [];

  const idat = children.find((x) => x.type === "idat");
  const iloc = children.find((x) => x.type === "iloc");
  if (iloc) {
    const version = b[iloc.dataStart];
    let p = iloc.dataStart + 4;
    const offsetSize = b[p] >> 4;
    const lengthSize = b[p] & 15;
    const baseOffsetSize = b[p + 1] >> 4;
    const indexSize = version === 1 || version === 2 ? b[p + 1] & 15 : 0;
    p += 2;
    const count = version < 2 ? u16be(b, p) : u32be(b, p);
    p += version < 2 ? 2 : 4;
    if (version > 2 || count < 0) return [...items.values()];
    for (let i = 0; i < count && p < iloc.end; i++) {
      const id = version < 2 ? u16be(b, p) : u32be(b, p);
      p += version < 2 ? 2 : 4;
      let method = 0;
      if (version === 1 || version === 2) {
        method = u16be(b, p) & 15;
        p += 2;
      }
      p += 2; // data_reference_index
      const base = uNbe(b, p, baseOffsetSize);
      p += baseOffsetSize;
      const extentCount = u16be(b, p);
      p += 2;
      if (id < 0 || base < 0 || extentCount < 0) break;
      const extents: IsoExtent[] = [];
      let valid = method === 0 || (method === 1 && !!idat);
      for (let k = 0; k < extentCount; k++) {
        p += indexSize;
        const off = uNbe(b, p, offsetSize);
        p += offsetSize;
        let len = uNbe(b, p, lengthSize);
        p += lengthSize;
        if (p > iloc.end || off < 0 || len < 0) {
          valid = false;
          break;
        }
        // Méthode 1 : données dans la boîte idat de meta
        const origin = method === 1 && idat ? idat.dataStart : 0;
        const limit = method === 1 && idat ? idat.end : b.length;
        const pos = origin + base + off;
        if (len === 0) len = limit - pos; // 0 = jusqu'à la fin
        if (pos < origin || pos + len > limit) valid = false;
        else extents.push({ pos, len });
      }
      if (p > iloc.end) break;
      const item = items.get(id);
      if (item && valid) item.extents = extents;
    }
  }
  return [...items.values()];
}

const MAX_ISO_ITEM = 4 * 1024 * 1024;

/** Copie des données d'un item (bornée). null si position inconnue. */
function isoItemData(b: Uint8Array, item: IsoItem): Uint8Array | null {
  if (!item.extents) return null;
  const total = item.extents.reduce((n, e) => n + e.len, 0);
  if (total > MAX_ISO_ITEM) return null;
  return concat(item.extents.map((e) => b.subarray(e.pos, e.pos + e.len)));
}

const isXmpItem = (item: IsoItem) => item.type === "mime" && item.contentType?.trim() === "application/rdf+xml";

function parseAvif(b: Uint8Array): ImageMetadata | null {
  const items = isoMetaItems(b);
  if (!items) return null;
  const meta = emptyMeta("avif");
  for (const item of items) {
    if (item.type === "Exif") {
      const data = isoItemData(b, item);
      // Contenu entièrement nul = EXIF déjà vidé
      if (!data) meta.otherExif = true;
      else if (data.some((v) => v !== 0)) {
        // 4 octets : décalage jusqu'à l'en-tête TIFF (souvent 6, après « Exif\0\0 »)
        const skip = u32be(data, 0);
        const t = skip >= 0 ? parseTiff(data, 4 + skip, data.length - 4 - skip) : null;
        if (t) mergeTiff(meta, { ...t, orientation: undefined }); // orientation : irot/imir
        else meta.otherExif = true;
      }
    } else if (isXmpItem(item)) {
      const data = isoItemData(b, item);
      if (!data || data.some((v) => v !== 0)) meta.hasXmp = true;
    }
  }
  return meta;
}

/** Vide sur place les items EXIF et XMP (mêmes tailles, mêmes positions). */
function stripAvif(b: Uint8Array): Uint8Array<ArrayBuffer> | null {
  const items = isoMetaItems(b);
  if (!items) return null;
  const out = b.slice();
  for (const item of items) {
    if (item.type !== "Exif" && !isXmpItem(item)) continue;
    if (!item.extents) return null; // position inconnue : impossible de garantir le retrait
    // EXIF vide mais valide : décalage 0, en-tête TIFF, IFD0 sans entrée
    const fill =
      item.type === "Exif"
        ? new Uint8Array([0, 0, 0, 0, 0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0])
        : new Uint8Array(0);
    const total = item.extents.reduce((n, e) => n + e.len, 0);
    let logical = 0;
    for (const e of item.extents) {
      out.fill(0, e.pos, e.pos + e.len);
      if (total >= fill.length && logical < fill.length) {
        const part = fill.subarray(logical, Math.min(fill.length, logical + e.len));
        out.set(part, e.pos);
      }
      logical += e.len;
    }
  }
  return out;
}

// ── API publique ──────────────────────────────────────────────────────

/** Analyse des octets. null si rien de notable n'est trouvé (ou format inconnu). */
export function parseMetadata(bytes: Uint8Array): ImageMetadata | null {
  try {
    const fmt = sniffFormat(bytes);
    const meta =
      fmt === "jpeg" ? parseJpeg(bytes) : fmt === "png" ? parsePng(bytes) : fmt === "webp" ? parseWebp(bytes) : fmt === "avif" ? parseAvif(bytes) : null;
    return meta && isSignificant(meta) ? meta : null;
  } catch {
    return null;
  }
}

/** Retire les métadonnées sans ré-encoder. null si format inconnu ou fichier mal formé. */
export function stripMetadataBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> | null {
  try {
    const fmt = sniffFormat(bytes);
    if (!fmt) return null;
    if (fmt === "avif") {
      const avif = stripAvif(bytes);
      return avif && parseMetadata(avif) === null ? avif : null;
    }
    const meta = fmt === "jpeg" ? parseJpeg(bytes) : fmt === "png" ? parsePng(bytes) : parseWebp(bytes);
    const orientation = meta?.orientation;
    const out = fmt === "jpeg" ? stripJpeg(bytes, orientation) : fmt === "png" ? stripPng(bytes, orientation) : stripWebp(bytes, orientation);
    // Contrôle : le résultat ne doit plus rien révéler
    return out && parseMetadata(out) === null ? out : null;
  } catch {
    return null;
  }
}

export async function readMetadata(file: Blob): Promise<ImageMetadata | null> {
  try {
    return parseMetadata(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return null;
  }
}

export async function stripMetadata(file: File): Promise<StripResult> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!sniffFormat(bytes)) return { file, removed: false, unsupported: true };
    const out = stripMetadataBytes(bytes);
    if (!out) return { file, removed: false, unsupported: true };
    if (out.length === bytes.length && out.every((v, i) => v === bytes[i])) return { file, removed: false };
    return { file: new File([out], file.name, { type: file.type, lastModified: file.lastModified }), removed: true };
  } catch {
    return { file, removed: false, unsupported: true };
  }
}
