// Formats des réseaux sociaux : partagés par l'outil Réseaux sociaux (recadrage) et le dessin IA.
import { locale } from "./i18n";

// shape : affiché en rond par le réseau ; safe : zone toujours visible (fraction du cadre, centrée) ;
// note : ce que le réseau coupe ou recouvre
export type SocialPreset = { label: string; width: number; height: number; shape?: "circle"; safe?: { w: number; h: number }; note?: string };

// Tailles recommandées par réseau (vérifiées en octobre 2026). Réseaux repris de la liste de NOXEL SEO
// (backend/src/social/networks.ts) quand on y téléverse une photo de profil, un en-tête ou une image.
export const SOCIAL_GROUPS: { group: string; presets: Record<string, SocialPreset[]> }[] = [
  { group: "Grands réseaux", presets: {
    Facebook: [
      { label: "Photo de profil", width: 320, height: 320, shape: "circle" },
      { label: "Photo de couverture", width: 820, height: 312, note: "Sur un téléphone, Facebook coupe les côtés : garde l'essentiel au centre." },
      { label: "Image de publication", width: 1200, height: 630 },
      { label: "Couverture d'événement", width: 1920, height: 1005 },
    ],
    Instagram: [
      { label: "Photo de profil", width: 320, height: 320, shape: "circle" },
      { label: "Publication (carré)", width: 1080, height: 1080 },
      { label: "Publication (portrait 4:5)", width: 1080, height: 1350 },
      { label: "Story / Reel", width: 1080, height: 1920 },
    ],
    YouTube: [
      { label: "Icône de chaîne", width: 800, height: 800, shape: "circle" },
      { label: "Bannière de chaîne", width: 2560, height: 1440, safe: { w: 1546 / 2560, h: 423 / 1440 }, note: "Sur un téléphone, YouTube ne montre que le centre (1 546 × 423) : garde le texte et le logo dans le cadre pointillé." },
      { label: "Vignette de vidéo", width: 1280, height: 720 },
    ],
    TikTok: [
      { label: "Photo de profil", width: 200, height: 200, shape: "circle" },
      { label: "Vidéo / photo", width: 1080, height: 1920 },
    ],
    LinkedIn: [
      { label: "Photo de profil (personnel)", width: 400, height: 400, shape: "circle" },
      { label: "Bannière (personnel)", width: 1584, height: 396, note: "Ta photo de profil recouvre la partie gauche du bas de la bannière." },
      { label: "Logo d'entreprise", width: 300, height: 300 },
      { label: "Bannière d'entreprise", width: 1128, height: 191 },
      { label: "Image de publication", width: 1200, height: 627 },
    ],
    "X (Twitter)": [
      { label: "Photo de profil", width: 400, height: 400, shape: "circle" },
      { label: "Bannière d'en-tête", width: 1500, height: 500, note: "Ta photo de profil recouvre le bas à gauche, et le haut et le bas peuvent être rognés selon l'écran." },
      { label: "Image de publication", width: 1200, height: 675 },
    ],
    Pinterest: [
      { label: "Photo de profil", width: 165, height: 165, shape: "circle" },
      { label: "Épingle", width: 1000, height: 1500 },
    ],
    Threads: [
      { label: "Photo de profil", width: 320, height: 320, shape: "circle" },
      { label: "Publication (carré)", width: 1080, height: 1080 },
      { label: "Publication (portrait 4:5)", width: 1080, height: 1350 },
    ],
    Bluesky: [
      { label: "Photo de profil", width: 400, height: 400, shape: "circle" },
      { label: "Bannière", width: 1500, height: 500, note: "Sur un téléphone, Bluesky montre la bannière plus étroite (environ 4:1) : garde l'essentiel au centre." },
      { label: "Publication (paysage)", width: 1600, height: 900 },
      { label: "Publication (portrait 4:5)", width: 1080, height: 1350 },
    ],
    Mastodon: [
      { label: "Photo de profil", width: 400, height: 400 },
      { label: "En-tête", width: 1500, height: 500 },
    ],
    Snapchat: [
      { label: "Photo de profil", width: 320, height: 320, shape: "circle" },
      { label: "Story", width: 1080, height: 1920 },
    ],
  } },
  { group: "Vidéo et diffusion", presets: {
    Twitch: [
      { label: "Photo de profil", width: 512, height: 512, shape: "circle" },
      { label: "Bannière de profil", width: 1920, height: 480 },
      { label: "Écran hors ligne", width: 1920, height: 1080 },
      { label: "Panneau", width: 320, height: 100 },
    ],
    Discord: [
      { label: "Photo de profil", width: 512, height: 512, shape: "circle" },
      { label: "Bannière de profil", width: 600, height: 240 },
      { label: "Icône de serveur", width: 512, height: 512, shape: "circle" },
      { label: "Bannière de serveur", width: 960, height: 540 },
    ],
  } },
  { group: "Fiches et boutiques", presets: {
    "Google Business Profile": [
      { label: "Logo", width: 720, height: 720 },
      { label: "Photo de l'établissement (4:3)", width: 1200, height: 900 },
    ],
    Etsy: [
      { label: "Icône de boutique", width: 500, height: 500 },
      { label: "Grande bannière", width: 3360, height: 840 },
      { label: "Mini bannière", width: 1200, height: 160 },
      { label: "Photo d'annonce", width: 2700, height: 2025 },
    ],
  } },
  { group: "Musique et balados", presets: {
    Spotify: [
      { label: "Photo d'artiste", width: 750, height: 750, shape: "circle" },
      { label: "Pochette / couverture de balado", width: 3000, height: 3000 },
    ],
    "Apple Podcasts": [
      { label: "Couverture de balado", width: 3000, height: 3000 },
    ],
    SoundCloud: [
      { label: "Photo de profil", width: 1000, height: 1000, shape: "circle" },
      { label: "Bannière", width: 2480, height: 520 },
      { label: "Pochette", width: 800, height: 800 },
    ],
  } },
  { group: "Communautés et projets", presets: {
    Reddit: [
      { label: "Icône de communauté", width: 500, height: 500, shape: "circle" },
      { label: "Bannière de communauté", width: 1600, height: 480 },
    ],
    "Product Hunt": [
      { label: "Vignette", width: 240, height: 240 },
      { label: "Image de galerie", width: 1270, height: 760 },
    ],
    GitHub: [
      { label: "Aperçu social du dépôt", width: 1280, height: 640 },
    ],
    Tumblr: [
      { label: "En-tête", width: 3000, height: 1055 },
    ],
  } },
];

export const SOCIAL_PRESETS: Record<string, SocialPreset[]> = Object.assign({}, ...SOCIAL_GROUPS.map((g) => g.presets));

// « 16:9 », « 3:1 »… (proportions réduites ; arrondies quand elles ne tombent pas juste)
export function ratioLabel(w: number, h: number): string {
  const pgcd = (a: number, b: number): number => (b ? pgcd(b, a % b) : a);
  const g = pgcd(w, h);
  if (w / g <= 21 && h / g <= 21) return `${w / g}:${h / g}`;
  const r = w / h;
  return r >= 1 ? `${(Math.round(r * 100) / 100).toLocaleString(locale())}:1` : `1:${(Math.round((1 / r) * 100) / 100).toLocaleString(locale())}`;
}
