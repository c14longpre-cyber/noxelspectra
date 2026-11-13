// Estimated gain of a lighter image on a website (shown after Convert, Resize, Social media).
// A plain calculation, labelled "estimate" in the UI: the real proof is a NOXEL SEO scan
// before and after (History → Before / after).

/** Mobile profile of PageSpeed / Lighthouse tests ("slow 4G"): 1.6 Mbit/s download. */
export const SLOW_4G_BITS_PER_SECOND = 1.6 * 1024 * 1024;

export type GainEstimate = {
  savedBytes: number;
  savedPct: number;
  /** Seconds saved downloading this image on the slow mobile profile. */
  secondsSlow4g: number;
};

/** null when the new file is not lighter (nothing to estimate). */
export function estimateGain(beforeBytes: number, afterBytes: number): GainEstimate | null {
  if (!(beforeBytes > 0) || !(afterBytes >= 0) || afterBytes >= beforeBytes) return null;
  const savedBytes = beforeBytes - afterBytes;
  return {
    savedBytes,
    savedPct: Math.round((savedBytes / beforeBytes) * 100),
    secondsSlow4g: (savedBytes * 8) / SLOW_4G_BITS_PER_SECOND,
  };
}

/** Bytes saved per month when the image is shown `viewsPerMonth` times. */
export function monthlySavedBytes(savedBytes: number, viewsPerMonth: number): number {
  if (!(viewsPerMonth > 0)) return 0;
  return savedBytes * Math.floor(viewsPerMonth);
}
