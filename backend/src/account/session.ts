// Sessions SPECTRA : JWT signé par SPECTRA_JWT_SECRET (propre à SPECTRA, jamais celui de FORGE ou SEO)
import jwt from "jsonwebtoken";

function secret(): string {
  const s = process.env.SPECTRA_JWT_SECRET;
  if (!s) throw new Error("SPECTRA_JWT_SECRET is not set");
  return s;
}

export type SessionPayload = { userId: string; iat?: number; exp?: number };

export function createSession(userId: string): string {
  return jwt.sign({ userId }, secret(), { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  if (!token) return null;
  try {
    const p = jwt.verify(token, secret()) as SessionPayload & { purpose?: string };
    // Un jeton de confirmation (signerJeton) n'est jamais une session
    if (!p || p.purpose || typeof p.userId !== "string") return null;
    return p;
  } catch {
    return null;
  }
}

export function signerJeton(payload: Record<string, unknown>, purpose: string, expiresIn: string): string {
  return jwt.sign({ ...payload, purpose }, secret(), { expiresIn } as jwt.SignOptions);
}

export function verifierJeton<T = Record<string, unknown>>(token: string, purpose: string): (T & { purpose: string }) | null {
  try {
    const p = jwt.verify(token, secret()) as any;
    return p && p.purpose === purpose ? p : null;
  } catch {
    return null;
  }
}
