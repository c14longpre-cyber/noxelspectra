// Connexion NOXEL SPECTRA — copie des règles de NOXEL FORGE (routes/auth.routes.ts, auth.magic.ts, auth.passkey.ts) :
// Google, lien magique, courriel + mot de passe (compte créé seulement à la confirmation), passkeys.
// Une connexion n'ouvre un compte existant que si le fournisseur garantit l'adresse (userStore.connecterOuCreer).
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { BACKEND_URL, COOKIE_CLEAR_OPTS, COOKIE_NAME, COOKIE_OPTS, FRONTEND_URL, RP_ID, RP_NAME, WEBAUTHN_ORIGINS } from "./config";
import { createSession, signerJeton, verifierJeton, verifySession } from "./session";
import { connecterOuCreer, findUserByEmail, findUserById, findUserByProvider, toPublicUser, EmailDejaUtilise, type User } from "./userStore";
import { sendMagicLinkEmail, sendSignupConfirmationEmail } from "./email";
import { authLimiter, emailIpLimiter, emailRecipientLimiter } from "./limiters";
import { getSupabase } from "./supabase";
import { must } from "./supabaseCheck";
import { requireComptes, lireDemandeur, oublierDemandeur } from "./middleware";
import { creditsRestants } from "./members";
import { PLANS } from "./plans";

const router = Router();
router.use(requireComptes);

function ouvrirSession(res: Response, user: User) {
  res.cookie(COOKIE_NAME, createSession(user.id), COOKIE_OPTS);
}
const retour = (res: Response, q: string) => res.redirect(FRONTEND_URL + "/?" + q);
const langue = (req: Request) => String((req.body as any)?.lang || req.headers["accept-language"] || "fr").slice(0, 2);

// ── Session ──────────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  const d = await lireDemandeur(req);
  if (!d.user || !d.member) return res.status(401).json({ ok: false, error: "Aucune session" });
  const plan = PLANS[d.tier];
  return res.json({
    ok: true, user: toPublicUser(d.user),
    plan: { tier: d.tier, name: plan.name, opsPerDay: plan.opsPerDay, batchFiles: plan.batchFiles, subscriptionStatus: d.member.subscriptionStatus },
    credits: creditsRestants(d.member),
  });
});

router.post("/logout", (req, res) => {
  const p = verifySession((req as any).cookies?.[COOKIE_NAME] ?? "");
  if (p) oublierDemandeur(p.userId);
  res.clearCookie(COOKIE_NAME, COOKIE_CLEAR_OPTS);
  return res.json({ ok: true });
});

// ── Google (jeton d'identité Google Identity Services) ───────────────────
router.post("/google", authLimiter, async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    if (!clientId) return res.status(503).json({ ok: false, error: "Connexion Google non configurée (GOOGLE_CLIENT_ID)" });
    if (!token) return res.status(400).json({ ok: false, error: "Jeton Google manquant" });
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: token, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.email || !p.sub) return res.status(401).json({ ok: false, error: "Jeton Google invalide" });
    const user = await connecterOuCreer({ email: p.email, name: p.name || "", providerId: p.sub, provider: "google", avatarUrl: p.picture || null, emailVerified: p.email_verified === true });
    ouvrirSession(res, user);
    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (e) {
    if (e instanceof EmailDejaUtilise) return res.status(409).json({ ok: false, code: "email_in_use", error: e.message });
    console.error("[spectra/auth/google]", e);
    return res.status(500).json({ ok: false, error: "Connexion Google impossible" });
  }
});

// ── Courriel + mot de passe ──────────────────────────────────────────────
router.post("/register", authLimiter, emailIpLimiter, emailRecipientLimiter, async (req, res) => {
  try {
    const { email: brut, password, name } = req.body as { email?: string; password?: string; name?: string };
    const email = String(brut ?? "").trim().toLowerCase();
    if (!email.includes("@") || !password) return res.status(400).json({ ok: false, error: "Courriel et mot de passe requis" });
    if (password.length < 8) return res.status(400).json({ ok: false, error: "Le mot de passe doit avoir au moins 8 caractères" });
    if (password.length > 200) return res.status(400).json({ ok: false, error: "Mot de passe trop long" });
    if (await findUserByEmail(email)) return res.status(409).json({ ok: false, code: "email_in_use", error: "Un compte NOXEL existe déjà pour ce courriel (SEO, FORGE ou SPECTRA). Connecte-toi plutôt." });
    const hash = await bcrypt.hash(password, 12);
    const token = signerJeton({ email, name: String(name || "").slice(0, 80), kind: "password", ph: hash }, "signup", "24h");
    const ok = await sendSignupConfirmationEmail(email, `${BACKEND_URL}/api/auth/register/verify?token=${encodeURIComponent(token)}`, langue(req));
    if (!ok) return res.status(500).json({ ok: false, error: "Courriel de confirmation impossible à envoyer. Réessaie plus tard." });
    return res.json({ ok: true, pending: true, message: "Ouvre le lien reçu par courriel pour créer ton compte." });
  } catch (e) {
    console.error("[spectra/auth/register]", e);
    return res.status(500).json({ ok: false, error: "Inscription impossible" });
  }
});

router.get("/register/verify", async (req, res) => {
  const t = verifierJeton<{ email: string; name: string; kind: string; ph: string }>(String(req.query.token || ""), "signup");
  if (!t || t.kind !== "password") return retour(res, "auth_error=invalid_token");
  try {
    const deja = await findUserByProvider(t.ph, "email");
    const user = deja ?? await connecterOuCreer({ email: t.email, name: t.name, provider: "email", providerId: t.ph, emailVerified: false });
    ouvrirSession(res, user);
    return retour(res, "auth_success=register");
  } catch (e) {
    if (e instanceof EmailDejaUtilise) return retour(res, "auth_error=email_in_use");
    console.error("[spectra/auth/register/verify]", e);
    return retour(res, "auth_error=server_error");
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ ok: false, error: "Courriel et mot de passe requis" });
    const u = await findUserByEmail(email);
    if (!u || u.provider !== "email" || !u.password_hash?.startsWith("$2")) {
      return res.status(401).json({ ok: false, error: u && u.provider !== "email" ? `Ce compte se connecte avec ${u.provider}` : "Courriel ou mot de passe invalide" });
    }
    if (!(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ ok: false, error: "Courriel ou mot de passe invalide" });
    ouvrirSession(res, u);
    return res.json({ ok: true, user: toPublicUser(u) });
  } catch (e) {
    console.error("[spectra/auth/login]", e);
    return res.status(500).json({ ok: false, error: "Connexion impossible" });
  }
});

// ── Lien magique ─────────────────────────────────────────────────────────
router.post("/magic/request", emailIpLimiter, emailRecipientLimiter, async (req, res) => {
  try {
    const email = String((req.body as any)?.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) return res.status(400).json({ ok: false, error: "Courriel valide requis" });
    const token = crypto.randomBytes(32).toString("hex");
    must(await getSupabase().from("magic_links").insert({ email, token, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }), "magic_links insert");
    const ok = await sendMagicLinkEmail(email, `${BACKEND_URL}/api/auth/magic/verify?token=${token}`, langue(req));
    if (!ok) return res.status(500).json({ ok: false, error: "Courriel impossible à envoyer. Réessaie plus tard ou choisis une autre méthode." });
    return res.json({ ok: true, message: "Lien envoyé" });
  } catch (e) {
    console.error("[spectra/magic/request]", e);
    return res.status(500).json({ ok: false, error: "Envoi impossible" });
  }
});

router.get("/magic/verify", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) return retour(res, "auth_error=missing_token");
  try {
    const sb = getSupabase();
    const link = must(await sb.from("magic_links").select("*").eq("token", token).is("used_at", null).maybeSingle(), "magic_links select");
    if (!link) return retour(res, "auth_error=invalid_token");
    if (new Date(link.expires_at) < new Date()) return retour(res, "auth_error=token_expired");
    must(await sb.from("magic_links").update({ used_at: new Date().toISOString() }).eq("token", token), "magic_links update");
    const user = await connecterOuCreer({ email: link.email, name: link.email.split("@")[0], provider: "email", providerId: link.email, emailVerified: true });
    ouvrirSession(res, user);
    return retour(res, "auth_success=magic");
  } catch (e) {
    if (e instanceof EmailDejaUtilise) return retour(res, "auth_error=email_in_use");
    console.error("[spectra/magic/verify]", e);
    return retour(res, "auth_error=server_error");
  }
});

// ── Passkeys (RP noxelspectra.com : une passkey de FORGE ou SEO ne sert pas ici) ──
type PasskeyNeuve = { id: string; publicKey: string; counter: number; deviceType: string; backedUp: boolean; transports: string[] };

async function enregistrerPasskey(userId: string, p: PasskeyNeuve) {
  must(await getSupabase().from("passkeys").insert({
    user_id: userId, credential_id: p.id, public_key: p.publicKey, counter: p.counter,
    device_type: p.deviceType, backed_up: p.backedUp, transports: p.transports,
  }), "passkeys insert");
}

// Le défi signé par l'appareil, lu dans clientDataJSON : on retrouve exactement CE défi
// (le « dernier défi » de FORGE pouvait mélanger deux connexions simultanées)
function defiDe(credential: any): string | null {
  try {
    const c = JSON.parse(Buffer.from(String(credential?.response?.clientDataJSON || ""), "base64url").toString("utf8"));
    return typeof c.challenge === "string" ? c.challenge : null;
  } catch { return null; }
}

async function prendreDefi(challenge: string | null, type: "registration" | "authentication") {
  if (!challenge) return null;
  const sb = getSupabase();
  const row = must(await sb.from("passkey_challenges").select("*").eq("challenge", challenge).eq("type", type)
    .gt("expires_at", new Date().toISOString()).maybeSingle(), "passkey_challenges select");
  if (row) must(await sb.from("passkey_challenges").delete().eq("id", row.id), "passkey_challenges delete");
  return row;
}

router.post("/passkey/register/start", authLimiter, async (req, res) => {
  try {
    const { email, name } = req.body as { email?: string; name?: string };
    if (!email) return res.status(400).json({ ok: false, error: "Courriel requis" });
    const options = await generateRegistrationOptions({
      rpName: RP_NAME, rpID: RP_ID, userName: email, userDisplayName: name || email,
      attestationType: "none", authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });
    must(await getSupabase().from("passkey_challenges").insert({
      challenge: options.challenge, user_id: String(email).trim().toLowerCase(), type: "registration",
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    }), "passkey_challenges insert");
    return res.json({ ok: true, options });
  } catch (e) {
    console.error("[spectra/passkey/register/start]", e);
    return res.status(500).json({ ok: false, error: "Passkey impossible" });
  }
});

router.post("/passkey/register/finish", authLimiter, emailIpLimiter, emailRecipientLimiter, async (req, res) => {
  try {
    const { email, name, credential } = req.body as any;
    if (!email || !credential) return res.status(400).json({ ok: false, error: "Champs manquants" });
    const adresse = String(email).trim().toLowerCase();
    const defi = await prendreDefi(defiDe(credential), "registration");
    if (!defi || defi.user_id !== adresse) return res.status(400).json({ ok: false, error: "Défi expiré ou introuvable" });
    const v = await verifyRegistrationResponse({ response: credential, expectedChallenge: defi.challenge, expectedOrigin: WEBAUTHN_ORIGINS, expectedRPID: RP_ID });
    if (!v.verified || !v.registrationInfo) return res.status(400).json({ ok: false, error: "Vérification échouée" });
    const cred = v.registrationInfo.credential;
    const neuve: PasskeyNeuve = {
      id: cred.id, publicKey: Buffer.from(cred.publicKey).toString("base64"), counter: cred.counter,
      deviceType: v.registrationInfo.credentialDeviceType, backedUp: v.registrationInfo.credentialBackedUp,
      transports: credential.response?.transports || [],
    };
    const existant = await findUserByEmail(adresse);
    if (existant) {
      // Ajouter une passkey à un compte existant exige la session de CE compte
      const s = verifySession((req as any).cookies?.[COOKIE_NAME] ?? "");
      if (s?.userId !== existant.id) {
        return res.status(409).json({ ok: false, code: "email_in_use", error: "Un compte NOXEL existe déjà pour ce courriel. Connecte-toi d'abord avec ta méthode habituelle, puis ajoute une passkey." });
      }
      await enregistrerPasskey(existant.id, neuve);
      return res.json({ ok: true, user: toPublicUser(existant) });
    }
    const token = signerJeton({ email: adresse, name: String(name || "").slice(0, 80), kind: "passkey", pk: neuve }, "signup", "24h");
    const ok = await sendSignupConfirmationEmail(adresse, `${BACKEND_URL}/api/auth/passkey/register/verify?token=${encodeURIComponent(token)}`, langue(req));
    if (!ok) return res.status(500).json({ ok: false, error: "Courriel de confirmation impossible à envoyer." });
    return res.json({ ok: true, pending: true, message: "Ouvre le lien reçu par courriel pour créer ton compte ; ta passkey fonctionnera ensuite." });
  } catch (e) {
    console.error("[spectra/passkey/register/finish]", e);
    return res.status(500).json({ ok: false, error: "Enregistrement de la passkey impossible" });
  }
});

router.get("/passkey/register/verify", async (req, res) => {
  const t = verifierJeton<{ email: string; name: string; kind: string; pk: PasskeyNeuve }>(String(req.query.token || ""), "signup");
  if (!t || t.kind !== "passkey" || !t.pk?.id) return retour(res, "auth_error=invalid_token");
  try {
    const sb = getSupabase();
    const dejaCle = must(await sb.from("passkeys").select("user_id").eq("credential_id", t.pk.id).maybeSingle(), "passkeys select");
    let user: User | null;
    if (dejaCle) user = await findUserById(dejaCle.user_id);
    else {
      user = (await findUserByProvider(t.email, "passkey"))
        ?? await connecterOuCreer({ email: t.email, name: t.name, provider: "passkey", providerId: t.email, emailVerified: false });
      await enregistrerPasskey(user.id, t.pk);
    }
    if (!user) return retour(res, "auth_error=server_error");
    ouvrirSession(res, user);
    return retour(res, "auth_success=passkey");
  } catch (e) {
    if (e instanceof EmailDejaUtilise) return retour(res, "auth_error=email_in_use");
    console.error("[spectra/passkey/register/verify]", e);
    return retour(res, "auth_error=server_error");
  }
});

router.post("/passkey/login/start", authLimiter, async (_req, res) => {
  try {
    const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: "preferred" });
    must(await getSupabase().from("passkey_challenges").insert({
      challenge: options.challenge, type: "authentication", expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    }), "passkey_challenges insert");
    return res.json({ ok: true, options });
  } catch (e) {
    console.error("[spectra/passkey/login/start]", e);
    return res.status(500).json({ ok: false, error: "Passkey impossible" });
  }
});

router.post("/passkey/login/finish", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body as any;
    if (!credential?.id) return res.status(400).json({ ok: false, error: "Passkey manquante" });
    const sb = getSupabase();
    const pk = must(await sb.from("passkeys").select("*").eq("credential_id", credential.id).maybeSingle(), "passkeys select");
    if (!pk) return res.status(400).json({ ok: false, error: "Passkey inconnue sur NOXEL SPECTRA" });
    const defi = await prendreDefi(defiDe(credential), "authentication");
    if (!defi) return res.status(400).json({ ok: false, error: "Défi expiré" });
    const v = await verifyAuthenticationResponse({
      response: credential, expectedChallenge: defi.challenge, expectedOrigin: WEBAUTHN_ORIGINS, expectedRPID: RP_ID,
      credential: { id: pk.credential_id, publicKey: new Uint8Array(Buffer.from(pk.public_key, "base64")), counter: pk.counter, transports: pk.transports },
    });
    if (!v.verified) return res.status(400).json({ ok: false, error: "Vérification échouée" });
    must(await sb.from("passkeys").update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq("credential_id", credential.id), "passkeys update");
    const user = await findUserById(pk.user_id);
    if (!user) return res.status(404).json({ ok: false, error: "Compte introuvable" });
    ouvrirSession(res, user);
    return res.json({ ok: true, user: toPublicUser(user) });
  } catch (e) {
    console.error("[spectra/passkey/login/finish]", e);
    return res.status(500).json({ ok: false, error: "Connexion par passkey impossible" });
  }
});

export default router;
