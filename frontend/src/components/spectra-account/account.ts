// NOXEL SPECTRA — compte, forfait et crédits (côté navigateur)
// Le cookie de session est posé par l'API (api.noxelspectra.com) : chaque appel doit l'envoyer
// (credentials: "include"), sinon le quota compte l'adresse IP au lieu du compte.
import { useCallback, useEffect, useState } from "react";

export const API_URL: string = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { credentials: "include", ...init });
}

export type Tier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface Account {
  user: { id: string; email: string; name: string; avatarUrl: string | null; provider: string };
  plan: { tier: Tier; name: string; opsPerDay: number; batchFiles: number; subscriptionStatus: string | null };
  credits: { inclus: number; achetes: number; total: number; parMois: number };
}

export interface PlanInfo {
  tier: Tier; name: string; monthly: number; annual: number; opsPerDay: number; aiCredits: number;
  batchFiles: number; features: { fr: string[]; en: string[] }; available: boolean; annualAvailable: boolean;
}

export const TIER_COLORS: Record<Tier, string> = {
  bronze: "#cd7f32", silver: "#aab0cc", gold: "#ffb74d", platinum: "#ce93d8", diamond: "#3ddc84",
};
export const TIER_MEDAL = (t: Tier) => `/tiers/${t[0].toUpperCase()}${t.slice(1)}_tier.png`;

// Un seul état partagé par tous les composants (en-tête, page de prix, dessin IA)
let courant: Account | null = null;
let charge = false;
let actif = true;  // false quand le serveur répond « comptes désactivés »
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((f) => f());

export async function rafraichirCompte(): Promise<Account | null> {
  try {
    const r = await apiFetch(`${API_URL}/api/auth/me`);
    if (r.status === 503) actif = false;
    courant = r.ok ? ((await r.json()) as Account) : null;
  } catch {
    courant = null;
  }
  charge = true;
  notifier();
  return courant;
}

export async function deconnecter() {
  try { await apiFetch(`${API_URL}/api/auth/logout`, { method: "POST" }); } catch { /* hors ligne : on oublie quand même */ }
  courant = null;
  notifier();
}

export function useAccount() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    abonnes.add(f);
    if (!charge) void rafraichirCompte();
    return () => { abonnes.delete(f); };
  }, []);
  const refresh = useCallback(() => rafraichirCompte(), []);
  return { account: courant, loaded: charge, accountsEnabled: actif, refresh };
}

// Ouvrir la fenêtre de connexion depuis n'importe quel composant
export const LOGIN_EVENT = "spectra-open-login";
export const openLogin = () => window.dispatchEvent(new CustomEvent(LOGIN_EVENT));
export const PRICING_EVENT = "spectra-open-pricing";
export const openPricing = () => window.dispatchEvent(new CustomEvent(PRICING_EVENT));

export async function lireErreur(r: Response): Promise<string> {
  const d = await r.json().catch(() => ({} as { error?: string; url?: string }));
  return d.error || `Erreur ${r.status}`;
}

export async function allerVers(path: string, body?: object): Promise<void> {
  const r = await apiFetch(`${API_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
  });
  if (r.status === 401) { openLogin(); return; }
  const d = await r.json().catch(() => ({} as { error?: string; url?: string }));
  if (!r.ok || !d.url) throw new Error(d.error || `Erreur ${r.status}`);
  window.location.assign(d.url);
}
