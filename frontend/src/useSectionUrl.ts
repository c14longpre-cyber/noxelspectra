// Une adresse par onglet (app images et outil vidéo) : app.noxelspectra.com/convert,
// video.noxelspectra.com/trim… Le premier onglet garde « / ». Partagé avec video/ (une seule copie de
// React grâce à resolve.dedupe). Les adresses doivent aussi être réécrites vers index.html dans le
// vercel.json de chaque app, sinon Vercel répond 404.
import { useEffect, useRef } from "react";

/** Onglet correspondant à l'adresse actuelle (adresse inconnue → onglet par défaut) */
export function sectionDepuisChemin(slugs: Record<string, string>, defaut: string): string {
  if (typeof window === "undefined") return defaut;
  const p = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
  if (!p) return defaut;
  return Object.keys(slugs).find((id) => slugs[id] === p) ?? defaut;
}

export function cheminDeSection(section: string, slugs: Record<string, string>, defaut: string): string {
  return section === defaut || !slugs[section] ? "/" : `/${slugs[section]}`;
}

/** Garde l'adresse, le titre de l'onglet du navigateur et le lien canonique au rythme de l'onglet choisi ;
 *  les boutons Précédent / Suivant du navigateur changent d'onglet. */
export function useSectionUrl(section: string, setSection: (s: string) => void, slugs: Record<string, string>, defaut: string, titre: string) {
  const premier = useRef(true);
  const setRef = useRef(setSection);
  useEffect(() => { setRef.current = setSection; });

  useEffect(() => {
    const chemin = cheminDeSection(section, slugs, defaut);
    if (window.location.pathname !== chemin) {
      const url = chemin + window.location.search + window.location.hash;
      if (premier.current) window.history.replaceState(window.history.state, "", url);
      else window.history.pushState(null, "", chemin + window.location.search);
    }
    premier.current = false;
    document.title = titre;
    const canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canon) canon.href = window.location.origin + chemin;
  }, [section, titre, slugs, defaut]);

  useEffect(() => {
    const f = () => setRef.current(sectionDepuisChemin(slugs, defaut));
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, [slugs, defaut]);
}
