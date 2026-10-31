// Tests des règles de compte SPECTRA (sans Supabase ni Stripe) : npx tsx --test test/*.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { estSpectra, tierPourAbonnement } from "../src/account/billing.routes";
import { normalizeTier, PLANS, priceIdFor, tierForPrice, TIERS } from "../src/account/plans";
import { creditsRestants, periodeCourante, type Member } from "../src/account/members";

test("un abonnement d'un autre produit NOXEL est ignoré par le webhook SPECTRA", () => {
  process.env.SPECTRA_PRICE_GOLD_MONTHLY = "price_spectra_gold";
  assert.equal(estSpectra({ metadata: { product: "spectra" } }), true);
  assert.equal(estSpectra({ metadata: {}, items: { data: [{ price: { id: "price_spectra_gold" } }] } }), true);
  assert.equal(estSpectra({ metadata: { tier: "gold", userId: "x" }, items: { data: [{ price: { id: "price_forge_gold" } }] } }), false);
  assert.equal(tierForPrice("price_spectra_gold"), "gold");
  assert.equal(priceIdFor("bronze", "monthly"), undefined);
});

test("forfait selon l'état de l'abonnement", () => {
  assert.equal(tierPourAbonnement("active", "gold"), "gold");
  assert.equal(tierPourAbonnement("past_due", "gold"), "garder");
  assert.equal(tierPourAbonnement("canceled", "gold"), "bronze");
  assert.equal(tierPourAbonnement("active", null), "garder");  // prix inconnu : jamais de rétrogradation
});

test("forfaits : prix annuel = 10 mois (−17 %), crédits croissants", () => {
  for (const t of TIERS) {
    const p = PLANS[t];
    if (p.monthly > 0) assert.equal(p.annual, p.monthly * 10);
  }
  const credits = TIERS.map((t) => PLANS[t].aiCredits);
  assert.deepEqual([...credits].sort((a, b) => a - b), credits);
  assert.equal(normalizeTier("GOLD"), "gold");
  assert.equal(normalizeTier("n'importe quoi"), "bronze");
});

test("crédits restants : le compteur mensuel repart à zéro au changement de mois", () => {
  const base: Member = { userId: "u", tier: "silver", stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: null, creditsPeriod: periodeCourante(), creditsUsed: 5, creditsExtra: 10 };
  assert.deepEqual(creditsRestants(base), { inclus: 15, achetes: 10, total: 25, parMois: 20 });
  assert.equal(creditsRestants({ ...base, creditsPeriod: "2000-01" }).inclus, 20);
  assert.equal(creditsRestants({ ...base, tier: "bronze", creditsUsed: 0 }).total, 10);
});
