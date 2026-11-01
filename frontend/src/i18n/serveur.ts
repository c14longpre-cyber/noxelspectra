// Messages renvoyés par le serveur (en français) : traduction à l'affichage.
// Les messages fixes sont dans le dictionnaire (en.ts) ; ceux qui contiennent un nombre ou un nom
// sont reconnus ici par un motif. Un message inconnu s'affiche tel quel.
import { shownLang, tr } from "./index";

type Motif = [RegExp, (m: RegExpMatchArray) => string];

const MOTIFS_EN: Motif[] = [
  [/^Trop d'essais\. Réessaie dans (\d+) min\.$/, (m) => `Too many attempts. Try again in ${m[1]} min.`],
  [/^Image trop grande \((\d+) × (\d+) px\)\. Maximum : 50 mégapixels, par exemple 8 000 × 6 000\.$/, (m) => `Image too large (${m[1]} × ${m[2]} px). Maximum: 50 megapixels, for example 8,000 × 6,000.`],
  [/^Format non pris en charge : (.+)$/, (m) => `Unsupported format: ${m[1]}`],
  [/^La largeur et la hauteur doivent être entre 1 et (\d+) px$/, (m) => `Width and height must be between 1 and ${m[1]} px`],
  [/^Zone de rognage invalide pour une image de (\d+) × (\d+) px$/, (m) => `Invalid crop area for a ${m[1]} × ${m[2]} px image`],
  [/^Ton forfait traite (\d+) fichiers par lot au plus\.$/, (m) => `Your plan processes at most ${m[1]} files per batch.`],
  [/^Ce compte se connecte avec (.+)$/, (m) => `This account signs in with ${m[1]}`],
  [/^Prix (.+) \/ (.+) non configuré\.$/, (m) => `Price ${m[1]} / ${m[2]} not configured.`],
  [/^Limite de (.+) opérations par jour atteinte pour le forfait (.+)\. Elle revient à minuit \(UTC\), ou passe à un forfait supérieur\.$/, (m) => `Daily limit of ${m[1]} operations reached for the ${m[2]} plan. It resets at midnight (UTC), or upgrade to a higher plan.`],
  [/^Limite gratuite de (.+) opérations par jour atteinte\. Elle revient à minuit \(UTC\) ; un forfait SPECTRA l'augmente\.$/, (m) => `Free limit of ${m[1]} operations per day reached. It resets at midnight (UTC); a SPECTRA plan raises it.`],
  [/^Recette trop longue \((\d+) étapes maximum\)$/, (m) => `Recipe too long (${m[1]} steps maximum)`],
  [/^Étape (\d+) : largeur ou hauteur requise$/, (m) => `Step ${m[1]}: width or height required`],
  [/^Étape (\d+) : opération inconnue « (.+) »$/, (m) => `Step ${m[1]}: unknown operation “${m[2]}”`],
  [/^(\d+) réussie\(s\), (\d+) en échec\.$/, (m) => `${m[1]} succeeded, ${m[2]} failed.`],
  [/^qualité ramenée à (\d+) pour ne pas dépasser le poids d'origine$/, (m) => `quality lowered to ${m[1]} so as not to exceed the original size`],
  [/^impossible de descendre sous (\d+) Ko$/, (m) => `could not go below ${m[1]} KB`],
  [/^Cette image est animée \((\d+) images\) : chaque format ci-dessous est une conversion fixe qui perdrait l'animation\. Utilise Convertir avec prudence, ou garde l'original si l'animation compte\.$/, (m) => `This image is animated (${m[1]} frames): each format below is a still conversion that would lose the animation. Use Convert with care, or keep the original if the animation matters.`],
  [/^(\d+) Ko de métadonnées intégrées \(EXIF, ICC…\) pourraient être retirés\.$/, (m) => `${m[1]} KB of embedded metadata (EXIF, ICC…) could be removed.`],
];

/** Message d'erreur ou d'information venant du serveur, dans la langue affichée */
export function trServeur(msg: unknown, status?: number): string {
  if (typeof msg !== "string" || !msg) return status ? tr("Erreur {a}", { a: status }) : tr("Erreur");
  if (shownLang() === "fr") return msg;
  const exact = tr(msg);
  if (exact !== msg) return exact;
  for (const [re, f] of MOTIFS_EN) {
    const m = msg.match(re);
    if (m) return f(m);
  }
  return msg;
}
