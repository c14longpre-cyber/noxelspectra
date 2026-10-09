// NOXEL Spectra Vidéo — outils téléchargés à la demande
// Les outils (et le moteur vidéo) ne sont pas téléchargés au premier affichage : ils le sont dès
// qu'une vidéo est choisie (preloadTools), ou à l'ouverture de l'outil.
// Si un téléchargement échoue (connexion coupée, nouvelle version mise en ligne), l'outil le dit sans
// faire tomber la page. Le navigateur garde l'échec en mémoire : seul un rechargement le répare,
// et le message le dit tel quel.
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { HudButton } from "@hud/HudButton";

/** Message affiché quand un morceau de l'application n'a pas pu être téléchargé. */
export const LOAD_FAILED = "Le téléchargement n'a pas abouti. Vérifie ta connexion, puis recharge la page (il faudra choisir ta vidéo de nouveau).";

const loaders: (() => Promise<unknown>)[] = [];

/** Télécharge d'avance tous les outils, sans rien afficher : appelé dès qu'une vidéo est choisie. */
export function preloadTools() {
  for (const load of loaders) load().catch(() => {});
}

export function lazyTool<P extends object>(load: () => Promise<ComponentType<P>>) {
  let Loaded: ComponentType<P> | null = null;
  loaders.push(load);
  return function Tool(props: P) {
    const [ready, setReady] = useState(Loaded !== null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
      if (ready) return;
      let alive = true;
      load().then(
        (c) => { Loaded = c; if (alive) setReady(true); },
        () => { if (alive) setFailed(true); },
      );
      return () => { alive = false; };
    }, [ready]);
    if (Loaded) return <Loaded {...props} />;
    if (failed) {
      return (
        <div role="alert" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <p className="vx-alert" style={{ margin: 0 }}>Cet outil n'a pas pu se charger. {LOAD_FAILED}</p>
          <HudButton action="reload-page" compact onClick={() => window.location.reload()} />
        </div>
      );
    }
    return <p className="vx-muted">Chargement de l'outil…</p>;
  };
}
