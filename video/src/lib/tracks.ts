// NOXEL Spectra Vidéo — vérification des pistes d'une conversion Mediabunny.
import type { Conversion } from "mediabunny";

// Écartées volontairement, ou en trop pour le format de sortie : ce ne sont pas des pertes
const EXPECTED = ["discarded_by_user", "max_track_count_reached", "max_track_count_of_type_reached"];

/** Une piste perdue = échec, même si la conversion reste « valide » grâce à l'autre piste. */
export function assertNoLostTrack(conversion: Conversion) {
  const lost = conversion.discardedTracks.filter((d) => !EXPECTED.includes(d.reason));
  if (conversion.isValid && !lost.length) return;
  const why = (lost.length ? lost : conversion.discardedTracks).map((d) => `${d.track.type} : ${d.reason}`).join(", ");
  throw new Error(`format non pris en charge par ce navigateur${why ? ` (${why})` : ""}`);
}
