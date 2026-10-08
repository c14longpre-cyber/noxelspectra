// NOXEL Spectra Vidéo — Copyright : droits inscrits dans le fichier, filigrane visible, vérification.
//
// Les métadonnées DÉCLARENT des droits : elles ne bloquent pas la copie et ne prouvent pas la
// propriété à elles seules. Seuls les champs remplis sont écrits, puis le fichier produit est
// relu : un champ demandé qui n'y est pas = une erreur.
import { ALL_FORMATS, BlobSource, BufferSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, WebMOutputFormat } from "mediabunny";
import type { MetadataTags } from "mediabunny";
import { itemSize, makeLogo, makeText } from "./overlay";
import type { OverlayItem } from "./overlay";
import { burnOverlays } from "./textlogo";
import { assertNoLostTrack } from "./tracks";

export type Container = "mp4" | "webm";

export type Rights = {
  title: string;
  creator: string; // auteur ou créateur de la vidéo
  owner: string; // titulaire des droits
  year: string;
  license: string; // id de LICENSES
  customLicense: string; // texte libre quand license = "custom"
  termsUrl: string; // page des conditions d'utilisation
  website: string;
  contact: string; // courriel ou autre moyen de contact
  description: string;
};

export const EMPTY_RIGHTS: Rights = { title: "", creator: "", owner: "", year: String(new Date().getFullYear()), license: "arr", customLicense: "", termsUrl: "", website: "", contact: "", description: "" };

export const LICENSES: { id: string; label: string; text: string; url: string }[] = [
  { id: "arr", label: "Tous droits réservés", text: "Tous droits réservés", url: "" },
  { id: "cc-by", label: "CC BY 4.0 — réutilisation libre avec mention de l'auteur", text: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  { id: "cc-by-sa", label: "CC BY-SA 4.0 — avec mention, partage dans les mêmes conditions", text: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { id: "cc-by-nc", label: "CC BY-NC 4.0 — avec mention, pas d'usage commercial", text: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/" },
  { id: "cc-by-nd", label: "CC BY-ND 4.0 — avec mention, pas de modification", text: "CC BY-ND 4.0", url: "https://creativecommons.org/licenses/by-nd/4.0/" },
  { id: "cc-by-nc-sa", label: "CC BY-NC-SA 4.0 — avec mention, non commercial, mêmes conditions", text: "CC BY-NC-SA 4.0", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/" },
  { id: "cc-by-nc-nd", label: "CC BY-NC-ND 4.0 — avec mention, non commercial, sans modification", text: "CC BY-NC-ND 4.0", url: "https://creativecommons.org/licenses/by-nc-nd/4.0/" },
  { id: "cc0", label: "CC0 — versé au domaine public", text: "CC0 1.0 (domaine public)", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  { id: "custom", label: "Autre (texte libre)", text: "", url: "" },
];

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
export const licenseOf = (r: Rights) => {
  const l = LICENSES.find((x) => x.id === r.license) || LICENSES[0];
  return { text: r.license === "custom" ? clean(r.customLicense) : l.text, url: clean(r.termsUrl) || l.url };
};

/** Mention de droits : « © 2026 Nom. Tous droits réservés. » (vide sans titulaire). */
export function copyrightNotice(r: Rights): string {
  const owner = clean(r.owner);
  if (!owner) return "";
  const lic = licenseOf(r).text;
  if (r.license === "cc0") return `${owner} — ${lic}`;
  return `© ${clean(r.year)} ${owner}`.replace(/\s+/g, " ") + (lic ? `. ${r.license === "arr" || r.license === "custom" ? lic : `Licence ${lic}`}.` : ".");
}
/** Mention courte pour un filigrane : « © 2026 Nom ». */
export const shortNotice = (r: Rights) => (clean(r.owner) ? `© ${clean(r.year)} ${clean(r.owner)}`.replace(/\s+/g, " ") : "");

// ── Où chaque champ est écrit ──────────────────────────────────────────
// MP4 (atomes de type iTunes, lus par la plupart des lecteurs et par ffprobe) n'a pas de champ
// séparé pour la licence, le site ou le contact : ils vont dans le commentaire. WebM (balises
// Matroska) a un champ pour chacun.
export type PlannedField = { label: string; value: string; where: string; read: (t: MetadataTags) => unknown };

const raw = (key: string) => (t: MetadataTags) => t.raw?.[key];

export function planRights(r: Rights, container: Container): { tags: MetadataTags; fields: PlannedField[] } {
  const lic = licenseOf(r);
  const notice = copyrightNotice(r);
  const v = { title: clean(r.title), creator: clean(r.creator), description: clean(r.description), website: clean(r.website), contact: clean(r.contact) };
  const tags: MetadataTags = { raw: {} };
  const fields: PlannedField[] = [];
  const add = (label: string, value: string, where: string, read: PlannedField["read"], write: () => void) => {
    if (!value) return;
    write();
    fields.push({ label, value, where, read });
  };
  const mp4 = container === "mp4";
  // Une licence n'a de sens que si quelqu'un est nommé : sans titulaire ni auteur, elle n'est pas écrite
  const named = !!notice || !!v.creator;
  add("Titre", v.title, mp4 ? "titre (©nam)" : "TITLE", (t) => t.title, () => { tags.title = v.title; });
  add("Auteur", v.creator, mp4 ? "artiste (©ART)" : "ARTIST", (t) => t.artist, () => { tags.artist = v.creator; });
  add("Mention de droits", notice, mp4 ? "copyright (cprt)" : "COPYRIGHT", raw(mp4 ? "cprt" : "COPYRIGHT"), () => { tags.raw![mp4 ? "cprt" : "COPYRIGHT"] = notice; });
  // MP4 : atome « desc », celui que lisent ffprobe et les lecteurs (le champ normalisé irait dans « ©des »)
  if (mp4) add("Description", v.description, "description (desc)", (t) => t.raw?.desc ?? t.description, () => { tags.raw!.desc = v.description; });
  else add("Description", v.description, "DESCRIPTION", (t) => t.description, () => { tags.description = v.description; });
  if (mp4) {
    const parts = [named && lic.text && `Licence : ${lic.text}`, named && lic.url && `Conditions : ${lic.url}`, v.website && `Site : ${v.website}`, v.contact && `Contact : ${v.contact}`].filter(Boolean);
    add("Licence, conditions, site et contact", parts.join(" | "), "commentaire (©cmt)", (t) => t.comment, () => { tags.comment = parts.join(" | "); });
  } else {
    add("Licence", named ? lic.text : "", "LICENSE", raw("LICENSE"), () => { tags.raw!.LICENSE = lic.text; });
    add("Conditions d'utilisation", named ? lic.url : "", "TERMS_OF_USE", raw("TERMS_OF_USE"), () => { tags.raw!.TERMS_OF_USE = lic.url; });
    add("Site web", v.website, "URL", raw("URL"), () => { tags.raw!.URL = v.website; });
    add("Contact", v.contact, "EMAIL", raw("EMAIL"), () => { tags.raw!.EMAIL = v.contact; });
  }
  return { tags, fields };
}

const webmFamily = (codec: string | null) => codec === "vp8" || codec === "vp9" || codec === "av1";
/** Format produit pour cette vidéo : WebM pour VP8, VP9 et AV1 ; MP4 sinon. */
export const containerFor = (videoCodec: string | null | undefined): Container => (webmFamily(videoCodec || null) ? "webm" : "mp4");

// ── Lecture : ce qu'un fichier contient réellement ─────────────────────
// Champs qui peuvent révéler où et avec quoi la vidéo a été filmée
const PRIVATE_KEYS: [RegExp, string][] = [
  [/^(©xyz|loci|com\.apple\.quicktime\.location|location|LOCATION|GPS)/i, "lieu (GPS)"],
  [/^(©mak|©mod|com\.apple\.quicktime\.(make|model)|com\.android\.(manufacturer|model))/i, "appareil"],
  [/^(©swr|com\.apple\.quicktime\.software)/i, "logiciel de l'appareil"],
];
const text = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : "");

export type FoundRights = { container: Container | "autre"; fields: { label: string; value: string }[]; others: string[]; sensitive: string[] };

async function readTags(input: Input): Promise<FoundRights> {
  const format = await input.getFormat();
  const container: FoundRights["container"] = /webm|matroska/i.test(format.name) ? "webm" : /mp4|quicktime|mov/i.test(format.name) ? "mp4" : "autre";
  const t = await input.getMetadataTags();
  const fields: FoundRights["fields"] = [];
  const used = new Set<string>();
  const push = (label: string, value: unknown, ...keys: string[]) => {
    keys.forEach((k) => used.add(k));
    const s = text(value);
    if (s) fields.push({ label, value: s });
  };
  push("Titre", t.title, "©nam", "TITLE", "title");
  push("Auteur", t.artist, "©ART", "ARTIST", "artist");
  push("Mention de droits", t.raw?.cprt ?? t.raw?.["©cpy"] ?? t.raw?.COPYRIGHT ?? t.raw?.copyright ?? t.raw?.["com.apple.quicktime.copyright"], "cprt", "©cpy", "COPYRIGHT", "copyright", "com.apple.quicktime.copyright");
  push("Licence", t.raw?.LICENSE, "LICENSE");
  push("Conditions d'utilisation", t.raw?.TERMS_OF_USE, "TERMS_OF_USE");
  push("Site web", t.raw?.URL, "URL");
  push("Contact", t.raw?.EMAIL, "EMAIL");
  push("Description", t.raw?.desc ?? t.description, "desc", "©des", "DESCRIPTION", "description");
  push("Commentaire", t.comment, "©cmt", "COMMENT", "comment");
  const others = new Set<string>();
  const sensitive = new Set<string>();
  for (const key of Object.keys(t.raw || {})) {
    if (used.has(key)) continue;
    const hit = PRIVATE_KEYS.find(([re]) => re.test(key));
    if (hit) sensitive.add(hit[1]);
    others.add(key);
  }
  if (t.date) others.add("date");
  return { container, fields, others: [...others], sensitive: [...sensitive] };
}

/** Droits et autres métadonnées présents dans une vidéo (lecture seule). */
export async function readRights(file: File): Promise<FoundRights> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    return await readTags(input);
  } finally {
    input.dispose();
  }
}

// ── Filigrane visible ──────────────────────────────────────────────────
export type Mark = {
  kind: "none" | "text" | "logo";
  text: string;
  logo: { image: CanvasImageSource; ratio: number; fileName: string } | null;
  place: "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br" | "tile";
  size: number; // texte : hauteur en fraction de l'image ; logo : largeur en fraction de l'image
  opacity: number;
  rotation: number;
};
export const PLACES: { id: Mark["place"]; label: string }[] = [
  { id: "tl", label: "Haut gauche" }, { id: "tc", label: "Haut centre" }, { id: "tr", label: "Haut droite" },
  { id: "ml", label: "Milieu gauche" }, { id: "mc", label: "Centre" }, { id: "mr", label: "Milieu droite" },
  { id: "bl", label: "Bas gauche" }, { id: "bc", label: "Bas centre" }, { id: "br", label: "Bas droite" },
  { id: "tile", label: "Répété sur toute l'image" },
];

let probe: CanvasRenderingContext2D | null = null;

const MAX_TILES = 40;
/**
 * Centres (en pixels) des copies d'un élément w × h tourné de `a` radians, répété en quinconce sur
 * une image W × H. La grille est construite dans le repère de l'élément : un pas le long de
 * l'élément, un pas en travers, une rangée sur deux décalée d'un demi-pas. Deux copies ne peuvent
 * donc pas se toucher, quelle que soit la rotation. Si l'élément est petit, les pas grandissent
 * pour ne pas dépasser MAX_TILES copies.
 */
export function tileCenters(w: number, h: number, a: number, W: number, H: number, logo: boolean): [number, number][] {
  const ux = Math.cos(a), uy = Math.sin(a); // le long de l'élément ; en travers : (−uy, ux)
  const reach = Math.hypot(W, H) / 2 + Math.hypot(w, h) / 2;
  // Boîte de l'élément tourné : une copie est gardée si au moins la moitié de sa boîte est dans l'image
  const bw = Math.abs(w * ux) + Math.abs(h * uy), bh = Math.abs(w * uy) + Math.abs(h * ux);
  for (let grow = 1; ; grow *= 1.25) {
    const along = w * (logo ? 1.6 : 1.3) * grow, across = h * (logo ? 1.6 : 2.6) * grow;
    const out: [number, number][] = [];
    const rows = Math.ceil(reach / across), cols = Math.ceil(reach / along) + 1;
    for (let j = -rows; j <= rows; j++) {
      for (let i = -cols; i <= cols; i++) {
        const s = (i + (j % 2 ? 0.5 : 0)) * along, t = j * across;
        const x = W / 2 + s * ux - t * uy, y = H / 2 + s * uy + t * ux;
        if (Math.abs(x - W / 2) <= W / 2 + bw / 4 && Math.abs(y - H / 2) <= H / 2 + bh / 4 && x > -bw / 4 && y > -bh / 4) out.push([x, y]);
      }
    }
    if (out.length <= MAX_TILES || grow > 20) return out.length ? out : [[W / 2, H / 2]];
  }
}

/**
 * Éléments à incruster pour ce filigrane dans une image W × H, présents de `start` à `end`, sans
 * animation. L'emplacement tient compte de la taille réelle de l'élément (texte mesuré, rotation
 * comprise) pour qu'il ne soit jamais coupé par le bord. `overflow` : il est plus grand que l'image.
 */
export function layoutMark(m: Mark, start: number, end: number, W: number, H: number): { items: OverlayItem[]; overflow: boolean } {
  if (!W || !H || m.kind === "none" || (m.kind === "text" && !m.text.trim()) || (m.kind === "logo" && !m.logo)) return { items: [], overflow: false };
  const base = { opacity: m.opacity, rotation: m.rotation, animIn: "none" as const, animOut: "none" as const };
  const make = (x: number, y: number): OverlayItem =>
    m.kind === "logo"
      ? makeLogo(start, end, m.logo!.image, m.logo!.ratio, m.logo!.fileName, { ...base, x, y, width: m.size, name: "Filigrane" })
      : makeText(start, end, { ...base, x, y, text: m.text.trim(), size: m.size, weight: 700, shadow: true, name: "Filigrane" });
  // Place occupée, rotation comprise, en fraction de l'image
  probe ||= document.createElement("canvas").getContext("2d")!;
  const { w, h } = itemSize(probe, make(0.5, 0.5), W, H);
  const a = (m.rotation * Math.PI) / 180;
  const bw = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / W;
  const bh = (Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a))) / H;
  const margin = 0.03 * Math.min(W, H);
  const mx = margin / W, my = margin / H;
  const overflow = bw > 1 || bh > 1; // plus grand que l'image : il sera coupé
  if (m.place === "tile") {
    return { items: tileCenters(w, h, a, W, H, m.kind === "logo").map(([x, y]) => make(x / W, y / H)), overflow };
  }
  const col = m.place[1], row = m.place[0];
  // Un élément plus large que l'image reste centré plutôt que de sortir d'un côté
  const x = col === "l" ? Math.min(0.5, mx + bw / 2) : col === "r" ? Math.max(0.5, 1 - mx - bw / 2) : 0.5;
  const y = row === "t" ? Math.min(0.5, my + bh / 2) : row === "b" ? Math.max(0.5, 1 - my - bh / 2) : 0.5;
  return { items: [make(x, y)], overflow };
}

// ── Écriture et vérification ───────────────────────────────────────────
export type RightsCheck = { label: string; where: string; expected: string; found: string; ok: boolean };
export type RightsResult = {
  blob: Blob; ext: Container; width: number; height: number; duration: number;
  reencoded: boolean; // vrai quand un filigrane a imposé de réencoder l'image
  checks: RightsCheck[];
  after: FoundRights; // tout ce que le fichier produit contient
};

export async function writeRights(
  file: File,
  r: Rights,
  o: { start: number; end: number; overlays: OverlayItem[]; keepOther: boolean; sourceBitrate: number; videoCodec: string | null },
  onProgress: (p: number) => void,
  register?: (cancel: () => Promise<void>) => void
): Promise<RightsResult> {
  const ext = containerFor(o.videoCodec);
  const plan = planRights(r, ext);
  // Par défaut, seuls nos champs sont écrits : les métadonnées d'origine (lieu, appareil…) ne sont pas recopiées
  const tags = (input: MetadataTags): MetadataTags =>
    o.keepOther
      ? {
          ...input,
          ...plan.tags,
          // Seuls les champs texte sont recopiés : un champ binaire (lieu « loci »…) serait réécrit dans
          // une forme que les lecteurs ne savent pas relire
          raw: { ...Object.fromEntries(Object.entries(input.raw || {}).filter(([, value]) => typeof value === "string")), ...(plan.tags.raw || {}) },
        }
      : plan.tags;

  let buffer: ArrayBuffer;
  const reencoded = o.overlays.length > 0;
  if (reencoded) {
    buffer = await (await burnOverlays(file, o.overlays, o.start, o.end, o.sourceBitrate, onProgress, register, tags)).blob.arrayBuffer();
  } else {
    // Sans filigrane : image et son recopiés tels quels, seules les métadonnées changent
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      const output = new Output({ format: ext === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
      const conversion = await Conversion.init({ input, output, trim: { start: o.start, end: o.end }, tags });
      assertNoLostTrack(conversion);
      register?.(() => conversion.cancel());
      conversion.onProgress = (p) => onProgress(p);
      await conversion.execute();
      if (!output.target.buffer) throw new Error("aucune donnée produite");
      buffer = output.target.buffer;
    } finally {
      input.dispose();
    }
  }

  // Vérification : le fichier produit est relu, champ par champ
  const check = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS });
  try {
    const vt = await check.getPrimaryVideoTrack();
    const duration = vt ? await vt.computeDuration() : 0;
    if (!vt || !(duration > 0)) throw new Error("le fichier produit ne contient aucune image");
    const written = await check.getMetadataTags();
    const checks = plan.fields.map((f) => {
      const found = text(f.read(written));
      return { label: f.label, where: f.where, expected: f.value, found, ok: found === f.value };
    });
    const missing = checks.filter((c) => !c.ok);
    if (missing.length) throw new Error(`${missing.length > 1 ? "des champs n'ont" : "un champ n'a"} pas été inscrit dans le fichier (${missing.map((c) => c.label).join(", ")})`);
    return {
      blob: new Blob([buffer], { type: ext === "webm" ? "video/webm" : "video/mp4" }),
      ext, width: await vt.getDisplayWidth(), height: await vt.getDisplayHeight(), duration, reencoded, checks, after: await readTags(check),
    };
  } finally {
    check.dispose();
  }
}
