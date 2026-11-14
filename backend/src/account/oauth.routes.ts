// Connexion GitHub, LinkedIn et Microsoft — copie des routes de NOXEL FORGE (routes/auth.github.ts,
// auth.linkedin.ts, auth.microsoft.ts), mêmes règles : une connexion n'ouvre un compte existant que si le
// fournisseur garantit l'adresse (GitHub : adresse vérifiée ; LinkedIn : email_verified ; Microsoft : jamais).
// Chaque fournisseur ne fonctionne que si ses variables sont définies ; GET /api/auth/providers dit lesquels,
// et la fenêtre de connexion n'affiche que ceux-là (jamais de « bientôt »).
// Adresses de retour à déclarer chez chaque fournisseur : <BACKEND_URL>/api/auth/<github|linkedin|microsoft>/callback
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { BACKEND_URL, COOKIE_NAME, COOKIE_OPTS, FRONTEND_URL, IS_PROD, comptesActifs } from "./config";
import { createSession } from "./session";
import { connecterOuCreer, EmailDejaUtilise } from "./userStore";
import { authLimiter } from "./limiters";
import { requireComptes } from "./middleware";

type Fournisseur = "github" | "linkedin" | "microsoft";
const ENV: Record<Fournisseur, { id: string; secret: string }> = {
  github: { id: "GITHUB_CLIENT_ID", secret: "GITHUB_CLIENT_SECRET" },
  linkedin: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" },
  microsoft: { id: "MICROSOFT_CLIENT_ID", secret: "MICROSOFT_CLIENT_SECRET" },
};

export function fournisseursActifs(env: NodeJS.ProcessEnv = process.env): Fournisseur[] {
  return (Object.keys(ENV) as Fournisseur[]).filter((p) => !!env[ENV[p].id] && !!env[ENV[p].secret]);
}

const retourUri = (p: Fournisseur) => process.env[`${p.toUpperCase()}_REDIRECT_URI`] || `${BACKEND_URL}/api/auth/${p}/callback`;
const STATE_OPTS = IS_PROD
  ? { httpOnly: true, sameSite: "none" as const, secure: true, maxAge: 10 * 60 * 1000 }
  : { httpOnly: true, sameSite: "lax" as const, secure: false, maxAge: 10 * 60 * 1000 };
const retour = (res: Response, q: string) => res.redirect(FRONTEND_URL + "/?" + q);

async function lireJson(res: globalThis.Response) {
  const raw = await res.text();
  try { return JSON.parse(raw); } catch { return { raw }; }
}

const router = Router();

// Liste publique : quels boutons afficher (aucun secret renvoyé)
router.get("/providers", (_req, res) => res.json({ ok: true, providers: comptesActifs() ? fournisseursActifs() : [] }));

router.use(requireComptes);

function demarrer(p: Fournisseur, construire: (clientId: string, state: string, redirectUri: string) => string) {
  return (_req: Request, res: Response) => {
    const clientId = process.env[ENV[p].id];
    if (!clientId || !process.env[ENV[p].secret]) return res.status(503).json({ ok: false, error: `Connexion ${p} non configurée` });
    const state = crypto.randomBytes(24).toString("hex");
    res.cookie(`${p}_oauth_state`, state, STATE_OPTS);
    return res.redirect(construire(clientId, state, retourUri(p)));
  };
}

/** Commun aux trois retours : état, code, puis profil → compte et session */
function terminer(p: Fournisseur, profil: (code: string, clientId: string, secret: string, redirectUri: string) => Promise<{ email: string; name: string; providerId: string; avatarUrl: string | null; emailVerified: boolean } | null>) {
  return async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      const saved = String((req as any).cookies?.[`${p}_oauth_state`] || "");
      if (req.query.error) return retour(res, `auth_error=${p}_cancelled`);
      if (!code) return retour(res, "auth_error=missing_code");
      if (!state || state !== saved) return retour(res, "auth_error=invalid_state");
      res.clearCookie(`${p}_oauth_state`, { httpOnly: true, sameSite: STATE_OPTS.sameSite, secure: STATE_OPTS.secure });
      const clientId = process.env[ENV[p].id], secret = process.env[ENV[p].secret];
      if (!clientId || !secret) return retour(res, "auth_error=missing_env");
      const c = await profil(code, clientId, secret, retourUri(p));
      if (!c) return retour(res, "auth_error=profile_failed");
      const user = await connecterOuCreer({ ...c, provider: p });
      res.cookie(COOKIE_NAME, createSession(user.id), COOKIE_OPTS);
      return retour(res, `auth_success=${p}`);
    } catch (e) {
      if (e instanceof EmailDejaUtilise) return retour(res, "auth_error=email_in_use");
      console.error(`[spectra/auth/${p}/callback]`, e);
      return retour(res, "auth_error=server_error");
    }
  };
}

// ── GitHub ──
router.get("/github/start", authLimiter, demarrer("github", (id, state, uri) =>
  "https://github.com/login/oauth/authorize?" + new URLSearchParams({ client_id: id, redirect_uri: uri, scope: "user:email read:user", state })));
router.get("/github/callback", terminer("github", async (code, id, secret) => {
  const tok = await lireJson(await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: id, client_secret: secret, code }),
  }));
  if (!tok.access_token) return null;
  const h = { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" };
  const u = await lireJson(await fetch("https://api.github.com/user", { headers: h }));
  if (!u.id) return null;
  // GitHub ne montre comme adresse publique qu'une adresse vérifiée ; sinon l'adresse principale vérifiée
  let email = u.email || "", emailVerified = !!email;
  if (!email) {
    const emails = await lireJson(await fetch("https://api.github.com/user/emails", { headers: h }));
    const principale = Array.isArray(emails) ? emails.find((e: any) => e.primary && e.verified) : null;
    email = principale?.email || `gh_${u.id}@noxelspectra.local`;
    emailVerified = !!principale;
  }
  return { email, name: u.name || u.login || "GitHub", providerId: String(u.id), avatarUrl: u.avatar_url || null, emailVerified };
}));

// ── LinkedIn (OpenID Connect) ──
router.get("/linkedin/start", authLimiter, demarrer("linkedin", (id, state, uri) =>
  "https://www.linkedin.com/oauth/v2/authorization?" + new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: uri, scope: process.env.LINKEDIN_SCOPE || "openid profile email", state })));
router.get("/linkedin/callback", terminer("linkedin", async (code, id, secret, uri) => {
  const tok = await lireJson(await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: id, client_secret: secret, redirect_uri: uri }).toString(),
  }));
  if (!tok.access_token) return null;
  const u = await lireJson(await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" } }));
  if (!u.sub) return null;
  const name = u.name || [u.given_name || "", u.family_name || ""].join(" ").trim() || "LinkedIn";
  return { email: u.email || `li_${u.sub}@noxelspectra.local`, name, providerId: u.sub, avatarUrl: u.picture || null, emailVerified: u.email_verified === true && !!u.email };
}));

// ── Microsoft ──
const MS_TENANT = () => process.env.MICROSOFT_TENANT_ID || "common";
router.get("/microsoft/start", authLimiter, demarrer("microsoft", (id, state, uri) =>
  `https://login.microsoftonline.com/${MS_TENANT()}/oauth2/v2.0/authorize?` + new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: uri, scope: "openid profile email User.Read", state, response_mode: "query" })));
router.get("/microsoft/callback", terminer("microsoft", async (code, id, secret, uri) => {
  const tok = await lireJson(await fetch(`https://login.microsoftonline.com/${MS_TENANT()}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, code, redirect_uri: uri, grant_type: "authorization_code" }).toString(),
  }));
  if (!tok.access_token) { console.error("[spectra/auth/microsoft/token]", JSON.stringify(tok).slice(0, 300)); return null; }
  const u = await lireJson(await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/json" } }));
  if (!u.id) return null;
  // Le champ « mail » de Microsoft n'est pas vérifié par Microsoft : jamais rattaché à un compte existant
  return { email: u.mail || u.userPrincipalName || `ms_${u.id}@noxelspectra.local`, name: u.displayName || u.givenName || "Microsoft", providerId: u.id, avatarUrl: null, emailVerified: false };
}));

export default router;
