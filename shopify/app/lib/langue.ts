// Langue de l'interface : français si le navigateur du marchand est en français, sinon anglais.
// Utilisable côté serveur (loader) et côté client : le loader renvoie `lang` à la page.
export type Lang = "fr" | "en";

export function langueDe(request: Request): Lang {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || request.headers.get("accept-language") || "";
  return locale.trim().toLowerCase().startsWith("fr") ? "fr" : "en";
}

/** t(lang, "texte français", "English text") */
export const t = (lang: Lang, fr: string, en: string): string => (lang === "fr" ? fr : en);
