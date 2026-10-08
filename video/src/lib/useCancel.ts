// NOXEL Spectra Vidéo — annulation d'un traitement, partagée par les panneaux.
import { useEffect, useRef } from "react";

/**
 * Annulation fiable : la demande est mémorisée si le traitement n'est pas encore annulable,
 * n'est transmise qu'une fois, et quitter l'outil annule le traitement en cours.
 * `begin()` au lancement, `register` passé au moteur, `stop()` sur le bouton « Annuler ».
 */
export function useCancel() {
  const cancel = useRef<(() => Promise<void>) | null>(null);
  const stopped = useRef(false);
  const api = useRef({
    stopped,
    begin() {
      stopped.current = false;
      cancel.current = null;
    },
    register(c: () => Promise<void>) {
      cancel.current = c;
      if (stopped.current) c().catch(() => {});
    },
    stop() {
      if (stopped.current) return;
      stopped.current = true;
      cancel.current?.().catch(() => {});
    },
    end() {
      cancel.current = null;
    },
  }).current;
  useEffect(() => () => api.stop(), [api]);
  return api;
}
