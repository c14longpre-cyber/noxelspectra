// Abonnements et achats de crédits NOXEL SPECTRA (Stripe)
// Le compte Stripe peut être partagé avec NOXEL SEO et NOXEL FORGE : chaque session et chaque abonnement
// SPECTRA porte metadata.product = "spectra" et des clés propres (spectraUserId, spectraTier) ; le webhook
// SPECTRA ignore tout ce qui n'est pas à lui (abonnement reconnu par son prix SPECTRA ou sa metadata).
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { FRONTEND_URL } from "./config";
import { requireUser, oublierDemandeur, type Demandeur } from "./middleware";
import { CREDIT_PACK, PLANS, TIERS, normalizeTier, priceIdFor, tierForPrice, type Tier } from "./plans";
import { ajouterCredits, findMemberByCustomer, getMember, updateMember } from "./members";
import { getSupabase } from "./supabase";
import { must } from "./supabaseCheck";

const PRODUCT = "spectra";

function stripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-06-24.dahlia" as any });
}
const stripeActif = () => !!process.env.STRIPE_SECRET_KEY;

export const billingRouter = Router();

// GET /api/plans — public : la page de prix de l'app affiche ces chiffres (jamais recopiés à la main)
billingRouter.get("/plans", (_req, res) => {
  res.json({
    ok: true, currency: "CAD",
    plans: TIERS.map((t) => {
      const p = PLANS[t];
      return { ...p, available: t === "bronze" || (!!priceIdFor(t, "monthly") && stripeActif()), annualAvailable: !!priceIdFor(t, "annual") };
    }),
    creditPack: { ...CREDIT_PACK, available: !!process.env.SPECTRA_PRICE_CREDITS && stripeActif() },
  });
});

function erreur(res: Response, status: number, code: string, error: string) {
  return res.status(status).json({ ok: false, code, error });
}

// POST /api/billing/checkout { tier, cycle }
billingRouter.post("/billing/checkout", requireUser, async (req: Request, res: Response) => {
  if (!stripeActif()) return erreur(res, 503, "billing_disabled", "La facturation n'est pas encore activée.");
  const d = (req as any).demandeur as Demandeur;
  const tier = normalizeTier((req.body as any)?.tier);
  const cycle = (req.body as any)?.cycle === "annual" ? "annual" : "monthly";
  if (tier === "bronze") return erreur(res, 400, "free_tier", "Bronze est gratuit : aucun paiement.");
  const price = priceIdFor(tier, cycle);
  if (!price) return erreur(res, 503, "price_not_configured", `Prix ${tier} / ${cycle} non configuré.`);
  const m = d.member!;
  // Un seul abonnement : changer de forfait ou annuler passe par le portail
  if (m.stripeSubscriptionId && m.tier !== "bronze") {
    return erreur(res, 409, "already_subscribed", "Tu as déjà un abonnement : change de forfait ou annule depuis « Gérer l'abonnement ».");
  }
  try {
    const meta = { product: PRODUCT, spectraUserId: d.user!.id, spectraTier: tier, cycle };
    const s = await stripe().checkout.sessions.create({
      mode: "subscription",
      ...(m.stripeCustomerId ? { customer: m.stripeCustomerId } : { customer_email: d.user!.email }),
      line_items: [{ price, quantity: 1 }],
      metadata: meta,
      subscription_data: { metadata: meta },
      allow_promotion_codes: true,
      success_url: `${FRONTEND_URL}/?billing=success&tier=${tier}`,
      cancel_url: `${FRONTEND_URL}/?billing=cancelled`,
    });
    return res.json({ ok: true, url: s.url });
  } catch (e: any) {
    console.error("[spectra/billing/checkout]", e?.message ?? e);
    return erreur(res, 500, "stripe_error", "Paiement impossible pour le moment.");
  }
});

// POST /api/billing/credits — achat d'un paquet de crédits de dessin IA (paiement unique)
billingRouter.post("/billing/credits", requireUser, async (req: Request, res: Response) => {
  const price = process.env.SPECTRA_PRICE_CREDITS;
  if (!stripeActif() || !price) return erreur(res, 503, "billing_disabled", "L'achat de crédits n'est pas encore activé.");
  const d = (req as any).demandeur as Demandeur;
  try {
    const meta = { product: PRODUCT, spectraUserId: d.user!.id, spectraCredits: String(CREDIT_PACK.credits) };
    const s = await stripe().checkout.sessions.create({
      mode: "payment",
      ...(d.member!.stripeCustomerId ? { customer: d.member!.stripeCustomerId } : { customer_email: d.user!.email, customer_creation: "always" }),
      line_items: [{ price, quantity: 1 }],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      success_url: `${FRONTEND_URL}/?billing=credits`,
      cancel_url: `${FRONTEND_URL}/?billing=cancelled`,
    });
    return res.json({ ok: true, url: s.url });
  } catch (e: any) {
    console.error("[spectra/billing/credits]", e?.message ?? e);
    return erreur(res, 500, "stripe_error", "Paiement impossible pour le moment.");
  }
});

// POST /api/billing/portal — changer de forfait, annuler, carte, factures
billingRouter.post("/billing/portal", requireUser, async (req: Request, res: Response) => {
  if (!stripeActif()) return erreur(res, 503, "billing_disabled", "La facturation n'est pas encore activée.");
  const d = (req as any).demandeur as Demandeur;
  if (!d.member!.stripeCustomerId) return erreur(res, 404, "no_subscription", "Aucun abonnement sur ce compte.");
  try {
    const s = await stripe().billingPortal.sessions.create({
      customer: d.member!.stripeCustomerId,
      return_url: `${FRONTEND_URL}/`,
      // Configuration du portail propre à SPECTRA (prix SPECTRA seulement), créée dans le tableau de bord Stripe
      ...(process.env.SPECTRA_PORTAL_CONFIG ? { configuration: process.env.SPECTRA_PORTAL_CONFIG } : {}),
    });
    return res.json({ ok: true, url: s.url });
  } catch (e: any) {
    console.error("[spectra/billing/portal]", e?.message ?? e);
    return erreur(res, 500, "stripe_error", "Portail indisponible pour le moment.");
  }
});

// ── Webhook ─────────────────────────────────────────────────────────────────
/** Forfait d'un abonnement selon son état : actif → forfait payé ; impayé/annulé → bronze ; sinon inchangé */
export function tierPourAbonnement(status: string | null | undefined, tier: Tier | null): Tier | "garder" {
  if (status === "active" || status === "trialing") return tier ?? "garder";
  if (status === "unpaid" || status === "canceled" || status === "incomplete_expired" || status === "paused") return "bronze";
  return "garder";
}

/** L'abonnement est-il un abonnement SPECTRA ? (metadata posée au checkout, sinon prix SPECTRA) */
export function estSpectra(sub: { metadata?: Record<string, string> | null; items?: { data?: { price?: { id?: string } }[] } }): boolean {
  if (sub.metadata?.product === PRODUCT) return true;
  const price = sub.items?.data?.[0]?.price?.id;
  return !!price && tierForPrice(price) !== null;
}

async function membreDeAbonnement(sub: Stripe.Subscription): Promise<string | null> {
  const parMeta = sub.metadata?.spectraUserId;
  if (parMeta) return parMeta;
  const m = await findMemberByCustomer(String(sub.customer));
  return m?.userId ?? null;
}

export async function stripeWebhook(req: Request, res: Response) {
  const secret = process.env.SPECTRA_STRIPE_WEBHOOK_SECRET;
  if (!stripeActif() || !secret) return res.status(503).json({ error: "Stripe not configured" });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, secret);
  } catch (e: any) {
    console.error("[spectra/webhook] signature", e?.message);
    return res.status(400).json({ error: "Invalid signature" });
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.product !== PRODUCT) break;  // session de NOXEL SEO ou NOXEL FORGE
        const userId = s.metadata.spectraUserId;
        if (!userId) break;
        if (s.mode === "payment") {
          if (s.payment_status !== "paid") break;
          const n = parseInt(s.metadata.spectraCredits || "0", 10);
          if (n > 0) {
            const ajoute = await ajouterCredits(userId, n, s.id);
            if (s.customer) await updateMember(userId, { stripe_customer_id: String(s.customer) });
            console.log(`[spectra/webhook] ${n} crédits ${ajoute ? "ajoutés" : "déjà ajoutés"} (${userId})`);
          }
        } else if (s.mode === "subscription") {
          await getMember(userId);
          await updateMember(userId, {
            tier: normalizeTier(s.metadata.spectraTier), stripe_customer_id: String(s.customer),
            stripe_subscription_id: String(s.subscription), subscription_status: "active",
          });
        }
        oublierDemandeur(userId);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        if (!estSpectra(sub)) break;
        const userId = await membreDeAbonnement(sub);
        if (!userId) { console.warn(`[spectra/webhook] abonnement ${sub.id} sans membre`); break; }
        const tier = tierPourAbonnement(sub.status, tierForPrice(sub.items.data[0]?.price?.id || ""));
        await updateMember(userId, {
          subscription_status: sub.status, stripe_customer_id: String(sub.customer),
          ...(tier === "garder" ? {} : tier === "bronze" ? { tier: "bronze", stripe_subscription_id: null } : { tier, stripe_subscription_id: sub.id }),
        });
        oublierDemandeur(userId);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (!estSpectra(sub)) break;
        const rows = must(await getSupabase().from("spectra_members")
          .update({ tier: "bronze", stripe_subscription_id: null, subscription_status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id).select("user_id"), "spectra_members update (deleted)");
        for (const r of rows ?? []) oublierDemandeur(r.user_id);
        break;
      }
    }
  } catch (e: any) {
    console.error(`[spectra/webhook] ${event.type}`, e?.message ?? e);
    return res.status(500).json({ error: "Webhook handling failed" });  // Stripe réessaie
  }
  return res.json({ received: true });
}
