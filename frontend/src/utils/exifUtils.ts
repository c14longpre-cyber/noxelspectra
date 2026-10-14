// NOXEL Spectra — lecture et retrait des métadonnées d'une image, sans dépendance.
//
// readMetadata() repère ce qu'un fichier JPEG, PNG ou WebP révèle (position GPS,
// date de prise de vue, appareil, logiciel, blocs XMP/IPTC/texte).
// stripMetadata() retire ces blocs SANS ré-encoder l'image : les pixels, le
// profil de couleur (ICC) et le reste du fichier restent identiques à l'octet près.
//
// Orientation : le navigateur (aperçu) applique l'orientation EXIF, et le serveur
// ne la corrige que dans le traitement par lots (sharp().rotate()). Retirer toute
// l'EXIF coucherait donc une photo de téléphone. Quand l'orientation n'est pas 1,
// on remet un bloc EXIF minimal qui ne contient QUE l'orientation.
//
// Toutes les lectures sont bornées : un fichier mal formé ne lève jamais
// d'exception, il donne simplement null (rien trouvé / rien retiré).

export type ImageMetaFormat = "jpeg" | "png" | "webp";

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

// ── API publique ──────────────────────────────────────────────────────

/** Analyse des octets. null si rien de notable n'est trouvé (ou format inconnu). */
export function parseMetadata(bytes: Uint8Array): ImageMetadata | null {
  try {
    const fmt = sniffFormat(bytes);
    const meta = fmt === "jpeg" ? parseJpeg(bytes) : fmt === "png" ? parsePng(bytes) : fmt === "webp" ? parseWebp(bytes) : null;
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
