// NOXEL Spectra Vidéo — avertissement partagé par les outils qui recopient l'image sans la réencoder.
// Une recopie ne peut commencer que sur une image clé : si la sélection commence après, les images
// entre cette image clé et le début choisi restent dans le fichier, masquées à la lecture.

/** À afficher avant d'agir quand l'image d'un MP4 est recopiée et que la sélection ne commence pas au début. */
export function LeadNote({ start }: { start: number }) {
  if (start <= 0.05) return null;
  return (
    <p className="vx-alert">
      La sélection ne commence pas au début de la vidéo : l'image est recopiée à partir de l'image clé qui précède, donc jusqu'à quelques secondes d'avant peuvent rester dans le fichier, masquées à la lecture mais récupérables.
      Pour les retirer vraiment, coupe d'abord l'extrait avec Couper & assembler en mode Précise, puis reviens ici.
    </p>
  );
}
