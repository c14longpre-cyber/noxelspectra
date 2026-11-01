// Hook React de l'app images : re-render quand la langue change (sélecteur NOXEL NEXUS)
import { useEffect, useState } from "react";
import { onLangChange, getLang, shownLang, setLang, tr } from "./index";

export function useLang() {
  const [, setN] = useState(0);
  useEffect(() => onLangChange(() => setN((n) => n + 1)), []);
  return { tr, lang: getLang(), shown: shownLang(), setLang };
}
