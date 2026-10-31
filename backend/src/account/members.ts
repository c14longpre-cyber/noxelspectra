// Membres SPECTRA (table spectra_members) : forfait, abonnement Stripe et crédits de dessin IA
import { getSupabase } from "./supabase";
import { must } from "./supabaseCheck";
import { normalizeTier, PLANS, type Tier } from "./plans";

export interface Member {
  userId: string;
  tier: Tier;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  creditsPeriod: string | null;
  creditsUsed: number;
  creditsExtra: number;
}

function toMember(r: any): Member {
  return {
    userId: r.user_id, tier: normalizeTier(r.tier),
    stripeCustomerId: r.stripe_customer_id ?? null, stripeSubscriptionId: r.stripe_subscription_id ?? null,
    subscriptionStatus: r.subscription_status ?? null, creditsPeriod: r.credits_period ?? null,
    creditsUsed: r.credits_used ?? 0, creditsExtra: r.credits_extra ?? 0,
  };
}

export async function getMember(userId: string): Promise<Member> {
  const sb = getSupabase();
  const row = must(await sb.from("spectra_members").select("*").eq("user_id", userId).maybeSingle(), "spectra_members select");
  if (row) return toMember(row);
  const created = must(await sb.from("spectra_members").upsert({ user_id: userId }, { onConflict: "user_id" }).select().single(), "spectra_members insert");
  return toMember(created);
}

export async function findMemberByCustomer(customerId: string): Promise<Member | null> {
  const row = must(await getSupabase().from("spectra_members").select("*").eq("stripe_customer_id", customerId).maybeSingle(), "spectra_members select");
  return row ? toMember(row) : null;
}

export async function updateMember(userId: string, patch: Record<string, unknown>): Promise<void> {
  const sb = getSupabase();
  must(await sb.from("spectra_members").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" }), "spectra_members update");
}

export function periodeCourante(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Crédits restants : inclus du mois (remis à zéro chaque mois UTC) + achetés */
export function creditsRestants(m: Member): { inclus: number; achetes: number; total: number; parMois: number } {
  const parMois = PLANS[m.tier].aiCredits;
  const utilises = m.creditsPeriod === periodeCourante() ? m.creditsUsed : 0;
  const inclus = Math.max(0, parMois - utilises);
  return { inclus, achetes: m.creditsExtra, total: inclus + m.creditsExtra, parMois };
}

export async function depenserCredit(m: Member, cout: number): Promise<"inclus" | "achete" | null> {
  const { data, error } = await getSupabase().rpc("spectra_depenser_credit", { p_user: m.userId, p_inclus: PLANS[m.tier].aiCredits, p_cout: cout });
  if (error) throw new Error("spectra_depenser_credit: " + error.message);
  return (data as any) ?? null;
}

export async function rendreCredit(userId: string, reserve: "inclus" | "achete", cout: number): Promise<void> {
  const { error } = await getSupabase().rpc("spectra_rendre_credit", { p_user: userId, p_reserve: reserve, p_cout: cout });
  if (error) console.error("[spectra] remise de crédit impossible", error.message);
}

export async function ajouterCredits(userId: string, credits: number, sessionId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc("spectra_ajouter_credits", { p_user: userId, p_credits: credits, p_session: sessionId });
  if (error) throw new Error("spectra_ajouter_credits: " + error.message);
  return data === true;
}
