// Forfaits : affichage, et lien vers la page de facturation de Shopify (App Pricing) où le marchand choisit.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { langueDe, t } from "../lib/langue";
import { FORFAITS } from "../lib/forfaits";
import { forfaitActif, imagesUtiliseesCeMois } from "../lib/traitement.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [forfait, utilisees] = await Promise.all([forfaitActif(admin), imagesUtiliseesCeMois(session.shop)]);
  const boutique = session.shop.replace(".myshopify.com", "");
  const handle = process.env.SHOPIFY_APP_HANDLE || "noxel-spectra";
  return { lang: langueDe(request), forfait, utilisees, urlPrix: `https://admin.shopify.com/store/${boutique}/charges/${handle}/pricing_plans` };
};

export default function Forfaits() {
  const { lang, forfait, utilisees, urlPrix } = useLoaderData<typeof loader>();
  const L = (fr: string, en: string) => t(lang, fr, en);
  return (
    <s-page heading={L("Forfaits", "Plans")}>
      <s-button slot="primary-action" href={urlPrix} target="_top">{L("Changer de forfait", "Change plan")}</s-button>
      <s-section>
        <s-paragraph>{L(`Forfait actuel : ${forfait.nom} · ${utilisees} / ${forfait.imagesParMois} images ce mois-ci (remis à zéro le 1er).`, `Current plan: ${forfait.nom} · ${utilisees} / ${forfait.imagesParMois} images this month (resets on the 1st).`)}</s-paragraph>
      </s-section>
      {FORFAITS.map((f) => (
        <s-section key={f.cle} heading={`${f.nom}${f.cle === forfait.cle ? L(" (actuel)", " (current)") : ""}`}>
          <s-paragraph>{f.prixUsd ? L(`${f.prixUsd.toFixed(2)} $ US par mois`, `US$${f.prixUsd.toFixed(2)} per month`) : L("Gratuit", "Free")} · {L(`${f.imagesParMois} images par mois`, `${f.imagesParMois} images per month`)}</s-paragraph>
        </s-section>
      ))}
      <s-section>
        <s-paragraph>{L("Une image compte quand elle est vraiment modifiée (fond blanc, carré ou allègement). Le texte alternatif et « Rétablir l'original » sont gratuits. La facturation passe par Shopify.", "An image counts when it's actually changed (white background, square or lighten). Alt text and “Restore original” are free. Billing goes through Shopify.")}</s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
