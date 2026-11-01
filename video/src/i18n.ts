// Outil vidéo : même dictionnaire que l'app images (frontend/src/i18n), avec le React de video/
import { useEffect, useState } from "react";
import { onLangChange, getLang, shownLang, setLang, tr } from "../../frontend/src/i18n";
export { tr, getLang, shownLang, setLang } from "../../frontend/src/i18n";

export function useLang() {
  const [, setN] = useState(0);
  useEffect(() => onLangChange(() => setN((n) => n + 1)), []);
  return { tr, lang: getLang(), shown: shownLang(), setLang };
}
