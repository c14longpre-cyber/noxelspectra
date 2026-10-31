// Qui fait la demande (session facultative) et quotas quotidiens des outils d'images
import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME, comptesActifs } from "./config";
import { verifySession } from "./session";
import { findUserById, type User } from "./userStore";
import { getMember, type Member } from "./members";
import { PLANS, type Tier } from "./plans";

export interface Demandeur { user: User | null; member: Member | null; tier: Tier }

// Forfait gardé 60 s en mémoire : pas une lecture Supabase à chaque image traitée
const cache = new Map<string, { at: number; d: Demandeur }>();
const CACHE_MS = 60_000;

export function oublierDemandeur(userId: string) { cache.delete(userId); }

export async function lireDemandeur(req: Request): Promise<Demandeur> {
  const anonyme: Demandeur = { user: null, member: null, tier: "bronze" };
  if (!comptesActifs()) return anonyme;
  const p = verifySession((req as any).cookies?.[COOKIE_NAME] ?? "");
  if (!p) return anonyme;
  const c = cache.get(p.userId);
  if (c && Date.now() - c.at < CACHE_MS) return c.d;
  try {
    const user = await findUserById(p.userId);
    if (!user) return anonyme;
    const member = await getMember(user.id);
    const d = { user, member, tier: member.tier };
    cache.set(p.userId, { at: Date.now(), d });
    return d;
  } catch (e) {
    console.error("[spectra] lecture du compte impossible", e);
    return anonyme;  // une panne Supabase ne bloque pas les outils gratuits
  }
}

export function requireComptes(_req: Request, res: Response, next: NextFunction) {
  if (!comptesActifs()) { res.status(503).json({ ok: false, code: "accounts_disabled", error: "Les comptes ne sont pas encore activés sur ce serveur." }); return; }
  next();
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!comptesActifs()) { res.status(503).json({ ok: false, code: "accounts_disabled", error: "Les comptes ne sont pas encore activés sur ce serveur." }); return; }
  const d = await lireDemandeur(req);
  if (!d.user || !d.member) { res.status(401).json({ ok: false, code: "auth_required", error: "Connecte-toi pour continuer." }); return; }
  (req as any).demandeur = d;
  next();
}

// ── Quota quotidien des outils d'images ─────────────────────────────────────
// Clé : le compte s'il y a une session, sinon l'adresse IP. Jour UTC, en mémoire (remis à zéro au
// redémarrage : c'est une protection d'usage, pas une facturation).
const compteurs = new Map<string, { jour: string; n: number }>();
const jourUtc = () => new Date().toISOString().slice(0, 10);

setInterval(() => {
  const j = jourUtc();
  for (const [k, v] of compteurs) if (v.jour !== j) compteurs.delete(k);
}, 60 * 60_000).unref();

export function quotaOutils(cout: (req: Request) => number = () => 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const d = await lireDemandeur(req);
    (req as any).demandeur = d;
    const limite = PLANS[d.tier].opsPerDay;
    const cle = d.user ? `u:${d.user.id}` : `ip:${req.ip}`;
    const j = jourUtc();
    const c = compteurs.get(cle);
    const n = c && c.jour === j ? c.n : 0;
    const ajout = Math.max(1, cout(req));
    if (n + ajout > limite) {
      res.setHeader("X-Quota-Limit", String(limite));
      res.setHeader("X-Quota-Remaining", "0");
      res.status(429).json({
        ok: false, code: "daily_quota", tier: d.tier, limit: limite,
        error: d.user
          ? `Limite de ${limite} opérations par jour atteinte pour le forfait ${PLANS[d.tier].name}. Elle revient à minuit (UTC), ou passe à un forfait supérieur.`
          : `Limite gratuite de ${limite} opérations par jour atteinte. Elle revient à minuit (UTC) ; un forfait SPECTRA l'augmente.`,
      });
      return;
    }
    compteurs.set(cle, { jour: j, n: n + ajout });
    res.setHeader("X-Quota-Limit", String(limite));
    res.setHeader("X-Quota-Remaining", String(Math.max(0, limite - n - ajout)));
    next();
  };
}
