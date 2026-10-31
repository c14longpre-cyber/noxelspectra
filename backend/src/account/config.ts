// NOXEL SPECTRA — réglages des comptes, des forfaits et du dessin IA.
// Les comptes sont facultatifs : sans SPECTRA_JWT_SECRET ou sans Supabase, les outils gratuits
// continuent de fonctionner et les routes de compte répondent 503 (jamais de plantage au démarrage).
import type { CookieOptions } from "express";

export const IS_PROD = process.env.NODE_ENV === "production";

export const FRONTEND_URL = (process.env.FRONTEND_URL || (IS_PROD ? "https://app.noxelspectra.com" : "http://localhost:5173")).replace(/\/$/, "");
export const BACKEND_URL = (process.env.BACKEND_PUBLIC_URL || (IS_PROD ? "https://api.noxelspectra.com" : "http://localhost:" + (process.env.PORT || 5000))).replace(/\/$/, "");

export const COOKIE_NAME = process.env.SPECTRA_SESSION_COOKIE_NAME || "spectra_session";

// L'API doit être servie sous noxelspectra.com (api.noxelspectra.com) : le cookie est alors « same-site »
// pour app., video. et www. — un cookie tiers (API sur *.up.railway.app) est bloqué par Safari et bientôt Chrome.
// COOKIE_DOMAIN (ex. .noxelspectra.com) partage la session entre l'app d'images et l'outil vidéo.
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || (IS_PROD ? ".noxelspectra.com" : undefined);
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const COOKIE_OPTS: CookieOptions = IS_PROD
  ? { httpOnly: true, sameSite: "lax", secure: true, maxAge: MAX_AGE, domain: COOKIE_DOMAIN, path: "/" }
  : { httpOnly: true, sameSite: "lax", secure: false, maxAge: MAX_AGE, path: "/" };

export const COOKIE_CLEAR_OPTS: CookieOptions = { domain: COOKIE_OPTS.domain, path: "/", sameSite: COOKIE_OPTS.sameSite, secure: COOKIE_OPTS.secure };

// WebAuthn : une passkey SPECTRA ne marche que sur noxelspectra.com (et ses sous-domaines)
export const RP_NAME = "NOXEL SPECTRA";
export const RP_ID = IS_PROD ? "noxelspectra.com" : "localhost";
export const WEBAUTHN_ORIGINS = IS_PROD
  ? ["https://app.noxelspectra.com", "https://video.noxelspectra.com", "https://www.noxelspectra.com", "https://noxelspectra.com"]
  : ["http://localhost:5173", "http://localhost:5174"];

export function comptesActifs(): boolean {
  return !!(process.env.SPECTRA_JWT_SECRET && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}
