// Limites des routes de connexion (req.ip = client grâce à app.set("trust proxy", 1) dans server.ts)
import type { Request, Response } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const message = (req: Request, res: Response) => {
  const resetTime = (req as any).rateLimit?.resetTime as Date | undefined;
  const retryAfter = Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now() + 60_000) - Date.now()) / 1000));
  res.setHeader("Retry-After", String(retryAfter));
  res.status(429).json({ ok: false, code: "rate_limited", error: `Trop d'essais. Réessaie dans ${Math.ceil(retryAfter / 60)} min.`, retryAfter });
};

// Mot de passe, passkeys : 20 par 15 minutes par adresse
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-6", legacyHeaders: false, handler: message });

// Courriels envoyés (lien magique, confirmation) : 5 par heure par adresse IP ET par destinataire
export const emailIpLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: "draft-6", legacyHeaders: false, handler: message });
export const emailRecipientLimiter = rateLimit({
  windowMs: 60 * 60_000, limit: 5, standardHeaders: false, legacyHeaders: false, handler: message,
  keyGenerator: (req: Request) => {
    const email = String((req.body as any)?.email ?? "").trim().toLowerCase();
    return email ? `mail:${email}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
});
