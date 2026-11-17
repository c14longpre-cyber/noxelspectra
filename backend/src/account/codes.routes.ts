// Codes d'accès NOXEL SPECTRA : création et liste (SPECTRA_ADMIN_EMAILS), échange par un compte,
// forfait offert jusqu'à une date (fin lue à chaque lecture du membre, members.ts).
// Table access_codes partagée avec NOXEL SEO et NOXEL FORGE (product = 'spectra').
// Migration : noxelseo/backend/supabase/migration_2026-11-17_access_codes_modules.sql
import { Router, type Request, type Response } from "express";
import { getSupabase } from "./supabase";
import { must } from "./supabaseCheck";
import { requireUser, oublierDemandeur, type Demandeur } from "./middleware";
import { DUREES, MESSAGES_REFUS, finDans, joursAcces, normaliserCode, normaliserTier, nouveauCode, verifierCode } from "./codesAcces";
import { getMember, updateMember } from "./members";

const PRODUIT = "spectra";
const DELAI_ECHANGE_JOURS = 60;
const MIGRATION = "Migration à lancer : migration_2026-11-17_access_codes_modules.sql";

export function estAdminSpectra(email: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const liste = (env.SPECTRA_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return typeof email === "string" && liste.includes(email.trim().toLowerCase());
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const d = (req as any).demandeur as Demandeur;
  if (!estAdminSpectra(d?.user?.email)) { res.status(403).json({ ok: false, error: "Réservé aux administrateurs." }); return; }
  next();
}

export const codesRouter = Router();

codesRouter.get("/admin/codes", requireUser, requireAdmin, async (_req, res) => {
  const { data, error } = await getSupabase().from("access_codes")
    .select("code,tier,duration,created_by,created_at,expires_at,is_used,used_by,used_at")
    .eq("product", PRODUIT).order("created_at", { ascending: false }).limit(200);
  if (error) return res.status(/product/.test(error.message) ? 503 : 500).json({ ok: false, error: /product/.test(error.message) ? MIGRATION : "Erreur serveur." });
  return res.json({ ok: true, codes: data ?? [] });
});

codesRouter.post("/admin/codes", requireUser, requireAdmin, async (req, res) => {
  const b = req.body ?? {};
  const tier = normaliserTier(b.tier);
  if (!tier || tier === "bronze") return res.status(400).json({ ok: false, error: "Forfait invalide." });
  const duree = String(b.duration ?? "");
  if (!(DUREES as readonly string[]).includes(duree)) return res.status(400).json({ ok: false, error: "Durée invalide." });
  const nombre = Math.min(20, Math.max(1, Math.floor(Number(b.count) || 1)));
  const note = String(b.note ?? "").trim().slice(0, 120);
  const par = ((req as any).demandeur as Demandeur).user!.email;
  const lignes = Array.from({ length: nombre }, () => ({
    code: nouveauCode("NXS"), tier, duration: duree, product: PRODUIT,
    expires_at: finDans(new Date(), DELAI_ECHANGE_JOURS), created_by: note ? `${par} · ${note}` : par,
  }));
  const { data, error } = await getSupabase().from("access_codes").insert(lignes).select("code,tier,duration,created_by,created_at,expires_at");
  if (error) return res.status(/product/.test(error.message) ? 503 : 500).json({ ok: false, error: /product/.test(error.message) ? MIGRATION : "Erreur serveur." });
  return res.json({ ok: true, codes: data ?? [] });
});

codesRouter.post("/codes/redeem", requireUser, async (req, res) => {
  try {
    const d = (req as any).demandeur as Demandeur;
    const code = normaliserCode(req.body?.code);
    if (!code) return res.status(400).json({ ok: false, error: "Entre ton code." });
    const sb = getSupabase();
    const ligne = must(await sb.from("access_codes").select("*").eq("code", code).maybeSingle(), "access_codes select");
    const membre = await getMember(d.user!.id);
    const refus = verifierCode(ligne, PRODUIT, membre.tier);
    if (refus) return res.status(refus === "invalide" ? 404 : 400).json({ ok: false, error: MESSAGES_REFUS[refus] });

    const maintenant = new Date();
    const pris = must(await sb.from("access_codes").update({ is_used: true, used_by: d.user!.email, used_at: maintenant.toISOString() })
      .eq("code", code).or("is_used.is.null,is_used.eq.false").select("code"), "access_codes update");
    if (!pris?.length) return res.status(400).json({ ok: false, error: MESSAGES_REFUS.deja_utilise });

    const finAt = finDans(maintenant, joursAcces(ligne.duration));
    try {
      await updateMember(d.user!.id, { tier: ligne.tier, tier_expires_at: finAt, tier_after_expiry: finAt ? membre.tier : null });
    } catch (e) {
      await sb.from("access_codes").update({ is_used: false, used_by: null, used_at: null }).eq("code", code);
      console.error("[spectra/codes] mise à jour du membre", e);
      return res.status(503).json({ ok: false, error: "Échange du code momentanément indisponible." });
    }
    oublierDemandeur(d.user!.id);
    return res.json({ ok: true, tier: ligne.tier, expiresAt: finAt });
  } catch (e) {
    console.error("[spectra/codes]", e);
    return res.status(500).json({ ok: false, error: "Erreur serveur." });
  }
});
