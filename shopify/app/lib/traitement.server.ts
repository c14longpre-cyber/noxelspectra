// Traitement d'une image produit : quota du forfait, copie de l'original (une seule fois par image),
// traitement, remplacement du contenu dans Shopify, journal (table Operation).
import db from "../db.server";
import { debutDuMois, forfaitDuNom } from "./forfaits";
import { alleger, carre, formatDuMime, versFormat } from "./image.server";
import { changerAlt, imageParId, nomDuFichier, remplacerContenu, sauvegarderOriginal, telecharger, televerser, urlDuFichier, type Admin } from "./media.server";
import { detourer } from "./spectra.server";

export type Action = "fond-blanc" | "carre" | "alleger";
export const ACTIONS: Action[] = ["fond-blanc", "carre", "alleger"];

export type Resultat = { mediaId: string; ok: boolean; message: string; avant?: number; apres?: number };

/** Forfait actif de la boutique (facturation Shopify), Free sans abonnement */
export async function forfaitActif(admin: Admin) {
  const r = await admin.graphql(`#graphql
    query Abonnement { currentAppInstallation { activeSubscriptions { name status } } }`);
  const j = (await r.json()) as { data?: { currentAppInstallation?: { activeSubscriptions?: { name: string; status: string }[] } } };
  const actif = j.data?.currentAppInstallation?.activeSubscriptions?.find((s) => s.status === "ACTIVE");
  return forfaitDuNom(actif?.name);
}

export async function imagesUtiliseesCeMois(shop: string): Promise<number> {
  return db.operation.count({ where: { shop, createdAt: { gte: debutDuMois() }, kind: { in: ACTIONS } } });
}

async function sauvegardeExistante(shop: string, mediaId: string): Promise<string | null> {
  const o = await db.operation.findFirst({ where: { shop, mediaId, backupFileId: { not: null } }, orderBy: { createdAt: "asc" } });
  return o?.backupFileId ?? null;
}

export async function traiter(admin: Admin, shop: string, productId: string, mediaId: string, action: Action, lang: "fr" | "en"): Promise<Resultat> {
  const fr = lang === "fr";
  const img = await imageParId(admin, mediaId);
  if (!img) return { mediaId, ok: false, message: fr ? "Image introuvable." : "Image not found." };
  const format = formatDuMime(img.mimeType);
  if (!format) return { mediaId, ok: false, message: fr ? "Format non pris en charge (JPEG, PNG ou WebP seulement)." : "Unsupported format (JPEG, PNG or WebP only)." };

  const original = await telecharger(img.originalUrl);
  const nom = nomDuFichier(img.originalUrl);
  const mime = format === "jpeg" ? "image/jpeg" : `image/${format}`;

  let sortie: Buffer | null;
  if (action === "fond-blanc") sortie = await versFormat(await detourer(original, nom, "#ffffff"), format);
  else if (action === "carre") sortie = await carre(original, format);
  else sortie = await alleger(original, format);
  if (!sortie) return { mediaId, ok: true, message: fr ? "Déjà optimisée : rien à changer." : "Already optimized: nothing to change.", avant: original.length, apres: original.length };

  // Copie de l'original avant la première modification de cette image
  const sauvegarde = (await sauvegardeExistante(shop, mediaId)) ?? (await sauvegarderOriginal(admin, original, nom, mime, mediaId));
  const source = await televerser(admin, sortie, nom, mime);
  await remplacerContenu(admin, mediaId, source);
  await db.operation.create({ data: { shop, productId, mediaId, kind: action, backupFileId: sauvegarde, bytesBefore: original.length, bytesAfter: sortie.length } });
  return { mediaId, ok: true, message: fr ? "Image remplacée." : "Image replaced.", avant: original.length, apres: sortie.length };
}

export async function restaurer(admin: Admin, shop: string, productId: string, mediaId: string, lang: "fr" | "en"): Promise<Resultat> {
  const fr = lang === "fr";
  const sauvegarde = await sauvegardeExistante(shop, mediaId);
  if (!sauvegarde) return { mediaId, ok: false, message: fr ? "Aucun original gardé pour cette image." : "No original saved for this image." };
  const url = await urlDuFichier(admin, sauvegarde);
  if (!url) return { mediaId, ok: false, message: fr ? "La copie de l'original est encore en préparation chez Shopify : réessaie dans une minute." : "The original copy is still being prepared by Shopify: try again in a minute." };
  const img = await imageParId(admin, mediaId);
  if (!img) return { mediaId, ok: false, message: fr ? "Image introuvable." : "Image not found." };
  const octets = await telecharger(url);
  const nom = nomDuFichier(img.originalUrl);
  const source = await televerser(admin, octets, nom, img.mimeType || "image/jpeg");
  await remplacerContenu(admin, mediaId, source);
  await db.operation.create({ data: { shop, productId, mediaId, kind: "restaurer", backupFileId: sauvegarde } });
  return { mediaId, ok: true, message: fr ? "Original rétabli." : "Original restored." };
}

export async function mettreAlt(admin: Admin, mediaId: string, alt: string, lang: "fr" | "en"): Promise<Resultat> {
  await changerAlt(admin, mediaId, alt);
  return { mediaId, ok: true, message: lang === "fr" ? "Texte alternatif enregistré." : "Alt text saved." };
}
