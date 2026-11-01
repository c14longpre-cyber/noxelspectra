// NOXEL SPECTRA — traduction de l'interface.
// Le texte source est le français, écrit tel quel dans le code : tr("Convertir").
// Chaque langue est un dictionnaire { "texte français": "traduction" } (en.ts) ; une langue sans
// traduction pour un texte affiche l'anglais, puis le français. Les variables s'écrivent {nom} :
// tr("Il te reste {n} crédits", { n: 3 }).
// La langue choisie est gardée sous « noxel-lang », comme sur les autres sites NOXEL, et choisie
// avec le sélecteur NOXEL NEXUS. Fonction nommée tr (et non t) : beaucoup de composants ont déjà une variable t.
import en from "./en";

export const STORAGE_KEY = "noxel-lang";
const DICTS: Record<string, Record<string, string>> = { en };
// Langues entièrement traduites (les autres affichent l'anglais en attendant)
export const FULL_LANGS = ["fr", "en"];

function langueInitiale(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  } catch { /* stockage indisponible */ }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "fr").toLowerCase();
  return nav.startsWith("fr") ? "fr" : "en";
}

let lang = langueInitiale();
const abonnes = new Set<() => void>();
if (typeof document !== "undefined") document.documentElement.lang = lang.split("-")[0];

export function getLang(): string { return lang; }
/** "fr" ou "en" : la langue réellement affichée (une langue sans traduction affiche l'anglais) */
export function shownLang(): "fr" | "en" { return lang.startsWith("fr") ? "fr" : "en"; }

export function setLang(code: string) {
  lang = code;
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* stockage indisponible */ }
  if (typeof document !== "undefined") document.documentElement.lang = code.split("-")[0];
  abonnes.forEach((f) => f());
}

function remplir(s: string, vars?: Record<string, unknown>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all));
}

export function tr(fr: string, vars?: Record<string, unknown>): string {
  if (lang.startsWith("fr")) return remplir(fr, vars);
  const base = lang.split("-")[0];
  const s = DICTS[lang]?.[fr] ?? DICTS[base]?.[fr] ?? en[fr] ?? fr;
  return remplir(s, vars);
}

/** Prévient fn à chaque changement de langue ; renvoie de quoi se désabonner.
 *  Pas de React ici : ce fichier est partagé avec l'outil vidéo (video/), qui a son propre React. */
export function onLangChange(fn: () => void): () => void {
  abonnes.add(fn);
  return () => { abonnes.delete(fn); };
}

/** Nombres et dates dans la langue affichée */
export const locale = () => (shownLang() === "fr" ? "fr-CA" : "en-CA");
