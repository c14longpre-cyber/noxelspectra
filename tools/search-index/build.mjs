// Écrit search-index.json (recherche de la barre du haut, NOXEL Shell 1.3, nx-search.js) dans les 3 sites :
// frontend/public (app), video/public (vidéo) et landing (vitrine). Même index partout, adresses complètes.
// Onglets de l'app et de la vidéo (libellé français ; anglais lu dans frontend/src/i18n/en.ts) + pages de la vitrine.
// Relancer après l'ajout d'un onglet ou d'une page : node tools/search-index/build.mjs (--check pour vérifier).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APP = "https://app.noxelspectra.com";
const VIDEO = "https://video.noxelspectra.com";
const WWW = "https://www.noxelspectra.com";

const en = {};
for (const m of readFileSync(join(ROOT, "frontend/src/i18n/en.ts"), "utf8").matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) {
  en[JSON.parse(`"${m[1]}"`)] = JSON.parse(`"${m[2]}"`);
}
const both = (fr) => (en[fr] && en[fr] !== fr ? { fr, en: en[fr] } : fr);

const slugs = (file, name) => JSON.parse(readFileSync(join(ROOT, file), "utf8").match(new RegExp(`${name}: Record<string, string> = (\\{[^}]*\\})`))[1]);
const APP_SLUGS = slugs("frontend/src/App.tsx", "SECTION_SLUGS");
const VIDEO_SLUGS = slugs("video/src/App.tsx", "TOOL_SLUGS");

const APP_TABS = {
  analyze: "Analyser", convert: "Convertir", batch: "Traitement par lots", resize: "Redimensionner", crop: "Rogner",
  removebg: "Supprimer l'arrière-plan", rotate: "Rotation / Miroir", adjust: "Filtres / Réglages", responsive: "Tailles responsives",
  palette: "Palette de couleurs", vectorize: "Vectoriser", favicon: "Favicons", metaclean: "Nettoyer les métadonnées",
  shadow: "Ombre portée", glow: "Effet lumineux", social: "Réseaux sociaux", editor: "Éditeur", gradient: "Dégradé",
  watermark: "Filigrane", copyright: "Auteur et droits", ai: "Dessin IA", projects: "Mes projets", pricing: "Forfaits",
};
const VIDEO_TABS = {
  analyze: "Analyser", under25: "Moins de 25 Mo", web: "Prêt pour mon site", social: "Décliner pour les réseaux", convert: "Convertir",
  compress: "Compresser", cut: "Couper & assembler", crop: "Recadrer & redimensionner", rotate: "Pivoter & retourner", speed: "Vitesse",
  audio: "Audio", text: "Texte & logo", watermark: "Filigrane", rights: "Copyright", thumb: "Miniature", export: "Exporter",
};

function page(file, lang) {
  const html = readFileSync(join(ROOT, file), "utf8");
  const t = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const d = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "";
  const u = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1];
  const ent = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"');
  return { k: "guide", l: lang, t: ent(t), d: ent(d), u };
}

export function buildIndex() {
  const out = [];
  for (const [id, fr] of Object.entries(APP_TABS)) {
    const slug = APP_SLUGS[id];
    if (slug === undefined) throw new Error(`onglet inconnu : ${id}`);
    out.push({ k: "app", t: both(fr), d: { fr: "NOXEL SPECTRA · images", en: "NOXEL SPECTRA · images" }, u: id === "analyze" ? `${APP}/` : `${APP}/${slug}` });
  }
  for (const [id, fr] of Object.entries(VIDEO_TABS)) {
    const slug = VIDEO_SLUGS[id];
    if (slug === undefined) throw new Error(`outil vidéo inconnu : ${id}`);
    const label = both(fr);
    out.push({
      k: "app",
      t: typeof label === "string" ? { fr: `Vidéo : ${fr}`, en: `Video: ${fr}` } : { fr: `Vidéo : ${label.fr}`, en: `Video: ${label.en}` },
      d: { fr: "NOXEL SPECTRA · vidéo", en: "NOXEL SPECTRA · video" },
      u: id === "analyze" ? `${VIDEO}/` : `${VIDEO}/${slug}`,
    });
  }
  for (const f of ["landing/index.html", "landing/images/index.html", "landing/video/index.html"]) out.push(page(f, "fr"));
  for (const f of ["landing/en/index.html", "landing/en/images/index.html", "landing/en/video/index.html"]) out.push(page(f, "en"));
  out.push({ k: "app", t: "NOXEL SEO", d: { fr: "Mesurer le poids des images de votre site", en: "Measure the weight of your site's images" }, u: "https://www.noxelseo.com/" });
  out.push({ k: "app", t: "NOXEL360", d: { fr: "Guides Learn et tableau de bord", en: "Learn guides and dashboard" }, u: "https://noxel360.com/learn/" });
  return JSON.stringify(out) + "\n";
}

const TARGETS = ["frontend/public/search-index.json", "video/public/search-index.json", "landing/search-index.json"];
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = buildIndex();
  if (process.argv.includes("--check")) {
    const stale = TARGETS.filter((t) => { try { return readFileSync(join(ROOT, t), "utf8") !== json; } catch { return true; } });
    if (stale.length) { console.error(`index périmé : ${stale.join(", ")} — node tools/search-index/build.mjs`); process.exit(1); }
    console.log("search-index.json à jour");
  } else {
    for (const t of TARGETS) writeFileSync(join(ROOT, t), json);
    console.log(`search-index.json : ${JSON.parse(json).length} entrées, écrit dans ${TARGETS.length} dossiers`);
  }
}
