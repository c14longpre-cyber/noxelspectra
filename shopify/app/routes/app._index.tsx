// Accueil : forfait, images traitées ce mois-ci et état d'un échantillon du catalogue.
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { langueDe, t } from "../lib/langue";
import { imagesProduits } from "../lib/media.server";
import { forfaitActif, imagesUtiliseesCeMois } from "../lib/traitement.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const lang = langueDe(request);
  const [forfait, utilisees, page] = await Promise.all([
    forfaitActif(admin), imagesUtiliseesCeMois(session.shop), imagesProduits(admin, { parPage: 50 }),
  ]);
  const imgs = page.images;
  return {
    lang, forfait, utilisees,
    echantillon: {
      images: imgs.length,
      sansAlt: imgs.filter((i) => !i.alt.trim()).length,
      lourdes: imgs.filter((i) => (i.fileSize ?? 0) > 1_000_000).length,
      nonCarrees: imgs.filter((i) => Math.abs(i.width / i.height - 1) > 0.02).length,
      tropGrandes: imgs.filter((i) => Math.max(i.width, i.height) > 2048).length,
    },
  };
};

export default function Accueil() {
  const { lang, forfait, utilisees, echantillon: e } = useLoaderData<typeof loader>();
  const L = (fr: string, en: string) => t(lang, fr, en);
  return (
    <s-page heading="NOXEL SPECTRA">
      <s-button slot="primary-action" href="/app/images">{L("Optimiser mes images", "Optimize my images")}</s-button>

      <s-section heading={L("Tes photos produits, prêtes pour la vente", "Your product photos, ready to sell")}>
        <s-paragraph>
          {L(
            "Fond blanc net, format carré uniforme, fichiers allégés et textes alternatifs pour le référencement : directement dans tes fiches produits, sans téléchargement. L'original est toujours gardé et peut être rétabli en un clic.",
            "Clean white background, uniform square format, lighter files and alt text for SEO: right in your product pages, no downloading. The original is always kept and can be restored in one click.",
          )}
        </s-paragraph>
      </s-section>

      <s-section heading={L("Ton catalogue (50 derniers produits modifiés)", "Your catalog (last 50 updated products)")}>
        <s-stack direction="block" gap="small">
          <s-text>{L(`${e.images} images examinées`, `${e.images} images checked`)}</s-text>
          <s-text>{L(`${e.sansAlt} sans texte alternatif (invisibles pour Google Images et les lecteurs d'écran)`, `${e.sansAlt} without alt text (invisible to Google Images and screen readers)`)}</s-text>
          <s-text>{L(`${e.lourdes} de plus de 1 Mo`, `${e.lourdes} over 1 MB`)}</s-text>
          <s-text>{L(`${e.tropGrandes} de plus de 2048 px`, `${e.tropGrandes} larger than 2048 px`)}</s-text>
          <s-text>{L(`${e.nonCarrees} pas carrées (grille de produits irrégulière)`, `${e.nonCarrees} not square (uneven product grid)`)}</s-text>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading={L("Forfait", "Plan")}>
        <s-paragraph>
          <s-text>{forfait.nom}</s-text> · {L(`${utilisees} / ${forfait.imagesParMois} images ce mois-ci`, `${utilisees} / ${forfait.imagesParMois} images this month`)}
        </s-paragraph>
        <s-link href="/app/forfaits">{L("Voir les forfaits", "See plans")}</s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
