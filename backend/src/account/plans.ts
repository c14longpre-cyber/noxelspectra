// Forfaits NOXEL SPECTRA — source unique côté serveur (la page de prix de l'app les lit par GET /api/plans).
// Prix en dollars canadiens, facturés par Stripe (SPECTRA_PRICE_<TIER>_<MONTHLY|ANNUAL>).
// Les outils d'images et l'outil vidéo sont inclus dans tous les forfaits.

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";
export const TIERS: Tier[] = ["bronze", "silver", "gold", "platinum", "diamond"];

export interface Plan {
  tier: Tier;
  name: string;
  monthly: number;      // CAD / mois, 0 = gratuit
  annual: number;       // CAD / an
  opsPerDay: number;    // opérations d'images par jour (convertir, redimensionner, détourer… ; les aperçus de filtres ne comptent pas)
  aiCredits: number;    // crédits de dessin IA inclus chaque mois
  batchFiles: number;   // fichiers par lot (plafond technique : BATCH_MAX_FILES = 20 dans server.ts)
  features: { fr: string[]; en: string[] };
}

export const PLANS: Record<Tier, Plan> = {
  bronze: {
    tier: "bronze", name: "Bronze", monthly: 0, annual: 0, opsPerDay: 50, aiCredits: 0, batchFiles: 10,
    features: {
      fr: ["Tous les outils d'images", "50 opérations par jour", "Outil vidéo (test)", "Sans compte"],
      en: ["Every image tool", "50 operations per day", "Video tool (beta)", "No account needed"],
    },
  },
  silver: {
    tier: "silver", name: "Silver", monthly: 5, annual: 50, opsPerDay: 300, aiCredits: 20, batchFiles: 20,
    features: {
      fr: ["300 opérations par jour", "20 crédits de dessin IA par mois", "Lots de 20 fichiers", "Outil vidéo"],
      en: ["300 operations per day", "20 AI drawing credits per month", "Batches of 20 files", "Video tool"],
    },
  },
  gold: {
    tier: "gold", name: "Gold", monthly: 15, annual: 150, opsPerDay: 1000, aiCredits: 100, batchFiles: 20,
    features: {
      fr: ["1 000 opérations par jour", "100 crédits de dessin IA par mois", "Lots de 20 fichiers", "Outil vidéo"],
      en: ["1,000 operations per day", "100 AI drawing credits per month", "Batches of 20 files", "Video tool"],
    },
  },
  platinum: {
    tier: "platinum", name: "Platinum", monthly: 40, annual: 400, opsPerDay: 3000, aiCredits: 300, batchFiles: 20,
    features: {
      fr: ["3 000 opérations par jour", "300 crédits de dessin IA par mois", "Lots de 20 fichiers", "Outil vidéo"],
      en: ["3,000 operations per day", "300 AI drawing credits per month", "Batches of 20 files", "Video tool"],
    },
  },
  diamond: {
    tier: "diamond", name: "Diamond", monthly: 80, annual: 800, opsPerDay: 10000, aiCredits: 800, batchFiles: 20,
    features: {
      fr: ["Utilisation intensive (10 000 opérations par jour)", "800 crédits de dessin IA par mois", "Lots de 20 fichiers", "Outil vidéo"],
      en: ["Heavy use (10,000 operations per day)", "800 AI drawing credits per month", "Batches of 20 files", "Video tool"],
    },
  },
};

// Achat de crédits supplémentaires (sans date limite), un prix Stripe unique : SPECTRA_PRICE_CREDITS
export const CREDIT_PACK = { credits: 50, priceCad: 5 };

// Coût d'une image IA en crédits (Flux 2 pro, environ 1 mégapixel)
export const AI_COST_PER_IMAGE = 1;

export function normalizeTier(t: unknown): Tier {
  const v = String(t ?? "").trim().toLowerCase();
  return (TIERS as string[]).includes(v) ? (v as Tier) : "bronze";
}

export function priceIdFor(tier: Tier, cycle: "monthly" | "annual"): string | undefined {
  if (tier === "bronze") return undefined;
  return process.env[`SPECTRA_PRICE_${tier.toUpperCase()}_${cycle.toUpperCase()}`] || undefined;
}

export function tierForPrice(priceId: string): Tier | null {
  for (const tier of TIERS) {
    if (tier === "bronze") continue;
    for (const cycle of ["monthly", "annual"] as const) {
      if (priceIdFor(tier, cycle) === priceId) return tier;
    }
  }
  return null;
}
