// Forfaits de l'app Shopify (facturation Shopify « App Pricing », réglée dans le tableau de bord Partners).
// Le NOM du forfait dans Shopify doit correspondre à une clé ci-dessous (insensible à la casse).
// Proposition à valider par Christian : prix en $ US (Shopify facture en dollars américains).
export type Forfait = { cle: string; nom: string; prixUsd: number; imagesParMois: number };

export const FORFAITS: Forfait[] = [
  { cle: "free", nom: "Free", prixUsd: 0, imagesParMois: 25 },
  { cle: "starter", nom: "Starter", prixUsd: 9.99, imagesParMois: 500 },
  { cle: "pro", nom: "Pro", prixUsd: 24.99, imagesParMois: 3000 },
  { cle: "business", nom: "Business", prixUsd: 59.99, imagesParMois: 15000 },
];

export function forfaitDuNom(nom: string | null | undefined): Forfait {
  const n = (nom || "").trim().toLowerCase();
  return FORFAITS.find((f) => f.cle === n || f.nom.toLowerCase() === n) ?? FORFAITS[0];
}

/** Début du mois courant (UTC) : les quotas repartent à zéro le 1er */
export function debutDuMois(maintenant = new Date()): Date {
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), 1));
}
