// Dessin IA NOXEL SPECTRA — FLUX.2 [pro] de Black Forest Labs (docs.bfl.ai)
// 1 crédit par image (≈ 1 mégapixel). Le crédit est pris AVANT l'appel et rendu si la génération échoue.
// L'image est téléchargée par le serveur et renvoyée au navigateur, jamais conservée (les URL de BFL
// expirent en 10 minutes et ne doivent pas être servies directement).
import { Router, type Request, type Response } from "express";
import { requireUser, type Demandeur } from "./middleware";
import { creditsRestants, depenserCredit, getMember, rendreCredit } from "./members";
import sharp from "sharp";
import { AI_COST_PER_IMAGE } from "./plans";

export const aiRouter = Router();

const BFL_BASE = (process.env.BFL_API_BASE || "https://api.bfl.ai").replace(/\/$/, "");
const BFL_MODEL = process.env.BFL_MODEL || "flux-2-pro";  // instantané figé (flux-2-pro-preview = dernière version)
const DELAI_MS = 120_000;

// Formats proposés (multiples de 16, environ 1 mégapixel au plus)
export const AI_FORMATS: Record<string, { label: string; width: number; height: number }> = {
  carre: { label: "Carré", width: 1024, height: 1024 },
  paysage: { label: "Paysage 16:9", width: 1344, height: 768 },
  portrait: { label: "Portrait 9:16", width: 768, height: 1344 },
  portrait45: { label: "Portrait 4:5", width: 896, height: 1120 },
  banniere: { label: "Bannière 3:1", width: 1536, height: 512 },
};

// Taille exacte demandée (formats des réseaux sociaux) : FLUX dessine aux mêmes proportions, en multiples
// de 16, puis l'image est mise aux dimensions exactes (sharp, cover). Coût : 1 crédit jusqu'à 1,5 mégapixel
// demandé (dessin d'environ 1 MP), 2 crédits au-delà (dessin jusqu'à 2 MP, la taille conseillée par BFL).
export const AI_SIZE_RULE = { oneCreditUpToMP: 1.5, maxCredits: 2, minSide: 64, maxSide: 4096, maxRatio: 8 };

export function coutPourTaille(width: number, height: number): number {
  return (width * height) / 1e6 > AI_SIZE_RULE.oneCreditUpToMP ? 2 : 1;
}

/** Dimensions de dessin (multiples de 16) aux proportions de la cible : environ 1 MP pour 1 crédit,
 *  jusqu'à 2 MP pour 2 crédits. Une petite cible est dessinée plus grand puis réduite (plus net). */
export function tailleDeDessin(width: number, height: number): { width: number; height: number } {
  const mp = (coutPourTaille(width, height) === 1 ? 1.0 : Math.min(2.0, (width * height) / 1e6)) * 1e6;
  const r = width / height;
  const h = Math.sqrt(mp / r);
  const bas16 = (n: number) => Math.max(64, Math.floor(n / 16) * 16);
  return { width: bas16(h * r), height: bas16(h) };
}

export function lireTaille(v: unknown): { width: number; height: number } | null {
  const o = v as { width?: unknown; height?: unknown } | null;
  const w = Number(o?.width), h = Number(o?.height);
  const { minSide, maxSide, maxRatio } = AI_SIZE_RULE;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < minSide || h < minSide || w > maxSide || h > maxSide) return null;
  if (Math.max(w / h, h / w) > maxRatio) return null;
  return { width: w, height: h };
}

const enCours = new Set<string>();  // une génération à la fois par compte

aiRouter.get("/ai/info", (_req, res) => {
  res.json({ ok: true, enabled: !!process.env.BFL_API_KEY, costPerImage: AI_COST_PER_IMAGE, model: "FLUX.2 [pro]", formats: AI_FORMATS, sizeRule: AI_SIZE_RULE });
});

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generer(prompt: string, width: number, height: number): Promise<{ buffer: Buffer; type: string }> {
  const key = process.env.BFL_API_KEY!;
  const debut = Date.now();
  const r = await fetch(`${BFL_BASE}/v1/${BFL_MODEL}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-key": key },
    body: JSON.stringify({ prompt, width, height }),
    signal: AbortSignal.timeout(30_000),
  });
  if (r.status === 402) throw new ErreurIA(503, "provider_credits", "Le service de dessin est temporairement indisponible.");
  if (r.status === 429) throw new ErreurIA(503, "provider_busy", "Le service de dessin est occupé, réessaie dans une minute.");
  if (!r.ok) throw new ErreurIA(502, "provider_error", `Erreur du service de dessin (${r.status}).`);
  const { polling_url } = (await r.json()) as { id: string; polling_url: string };
  if (!polling_url) throw new ErreurIA(502, "provider_error", "Réponse inattendue du service de dessin.");

  let attente = 500;
  while (Date.now() - debut < DELAI_MS) {
    await pause(attente);
    attente = Math.min(2000, attente + 250);
    const p = await fetch(polling_url, { headers: { accept: "application/json", "x-key": key }, signal: AbortSignal.timeout(15_000) });
    if (!p.ok) continue;
    const j = (await p.json()) as { status: string; result?: { sample?: string } };
    if (j.status === "Ready" && j.result?.sample) {
      const u = new URL(j.result.sample);
      if (!/^delivery\.[a-z0-9-]+\.bfl\.ai$/.test(u.hostname) && !u.hostname.endsWith(".bfl.ai")) throw new ErreurIA(502, "provider_error", "Adresse d'image inattendue.");
      const img = await fetch(u, { signal: AbortSignal.timeout(30_000) });
      if (!img.ok) throw new ErreurIA(502, "provider_error", "Image impossible à récupérer.");
      return { buffer: Buffer.from(await img.arrayBuffer()), type: img.headers.get("content-type") || "image/jpeg" };
    }
    if (j.status === "Content Moderated" || j.status === "Request Moderated") {
      throw new ErreurIA(422, "moderated", "Cette demande a été refusée par le filtre de contenu. Reformule ta description.");
    }
    if (j.status === "Error" || j.status === "Failed" || j.status === "Task not found") {
      throw new ErreurIA(502, "provider_error", "La génération a échoué. Réessaie.");
    }
  }
  throw new ErreurIA(504, "timeout", "La génération a pris trop de temps. Réessaie.");
}

class ErreurIA extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// POST /api/ai/generate { prompt, format } → image (corps binaire) ; en-têtes X-Credits-*
aiRouter.post("/ai/generate", requireUser, async (req: Request, res: Response) => {
  if (!process.env.BFL_API_KEY) return res.status(503).json({ ok: false, code: "ai_disabled", error: "Le dessin IA n'est pas encore activé." });
  const d = (req as any).demandeur as Demandeur;
  const userId = d.user!.id;
  const prompt = String((req.body as any)?.prompt ?? "").trim();
  const body = req.body as any;
  const cible = body?.size != null ? lireTaille(body.size) : null;
  if (body?.size != null && !cible) return res.status(400).json({ ok: false, code: "bad_size", error: "Dimensions invalides." });
  const format = AI_FORMATS[String(body?.format ?? "carre")] ?? AI_FORMATS.carre;
  const dessin = cible ? tailleDeDessin(cible.width, cible.height) : { width: format.width, height: format.height };
  const cout = cible ? coutPourTaille(cible.width, cible.height) : AI_COST_PER_IMAGE;
  if (prompt.length < 3) return res.status(400).json({ ok: false, code: "prompt_required", error: "Décris l'image à dessiner." });
  if (prompt.length > 2000) return res.status(400).json({ ok: false, code: "prompt_too_long", error: "Description trop longue (2 000 caractères au plus)." });
  if (enCours.has(userId)) return res.status(429).json({ ok: false, code: "in_progress", error: "Une image est déjà en cours de création." });

  enCours.add(userId);
  let reserve: "inclus" | "achete" | null = null;
  try {
    const m = await getMember(userId);
    reserve = await depenserCredit(m, cout);
    if (!reserve) {
      const c = creditsRestants(m);
      return res.status(402).json({ ok: false, code: "no_credits", credits: c, error: c.parMois === 0
        ? "Le dessin IA est inclus à partir du forfait Silver, ou avec un paquet de crédits."
        : "Plus de crédits ce mois-ci : ils reviennent le 1er du mois, ou achète un paquet de crédits." });
    }
    let img = await generer(prompt, dessin.width, dessin.height);
    if (cible) {
      // Mise aux dimensions exactes du réseau (les proportions sont déjà les bonnes, au pixel près)
      const png = img.type.includes("png");
      const out = sharp(img.buffer).resize(cible.width, cible.height, { fit: "cover", position: "centre", kernel: "lanczos3" });
      img = { buffer: await (png ? out.png() : out.jpeg({ quality: 92, mozjpeg: true })).toBuffer(), type: png ? "image/png" : "image/jpeg" };
    }
    const apres = creditsRestants(await getMember(userId));
    res.setHeader("Content-Type", img.type);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Credits-Remaining", String(apres.total));
    res.setHeader("X-Credits-Used", String(cout));
    res.setHeader("Access-Control-Expose-Headers", "X-Credits-Remaining, X-Credits-Used");
    return res.send(img.buffer);
  } catch (e: any) {
    if (reserve) await rendreCredit(userId, reserve, cout);  // échec : le crédit est rendu
    if (e instanceof ErreurIA) return res.status(e.status).json({ ok: false, code: e.code, error: e.message });
    console.error("[spectra/ai/generate]", e?.message ?? e);
    return res.status(500).json({ ok: false, code: "server_error", error: "La génération a échoué. Ton crédit a été rendu." });
  } finally {
    enCours.delete(userId);
  }
});
