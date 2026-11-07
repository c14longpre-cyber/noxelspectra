// Images produits : liste, choix des images, traitement (fond blanc, carré, alléger), texte alternatif, rétablir l'original.
// Au plus 5 images par envoi pour rester sous le délai d'une requête ; le traitement en arrière-plan viendra ensuite.
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { langueDe, t } from "../lib/langue";
import { imagesProduits } from "../lib/media.server";
import { ACTIONS, forfaitActif, imagesUtiliseesCeMois, mettreAlt, restaurer, traiter, type Action, type Resultat } from "../lib/traitement.server";

const MAX_PAR_ENVOI = 5;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = await imagesProduits(admin, { after: url.searchParams.get("apres"), recherche: url.searchParams.get("q") || undefined, parPage: 15 });
  return { lang: langueDe(request), ...page };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const lang = langueDe(request);
  const fr = lang === "fr";
  const f = await request.formData();
  const intent = String(f.get("intent") || "");
  const cibles = f.getAll("cible").map(String).slice(0, MAX_PAR_ENVOI);  // "productId|mediaId"
  const resultats: Resultat[] = [];

  if (intent === "alt") {
    const mediaId = String(f.get("mediaId") || "");
    resultats.push(await mettreAlt(admin, mediaId, String(f.get("alt") || ""), lang));
    return { resultats };
  }
  if (!cibles.length) return { resultats, erreur: fr ? "Choisis au moins une image." : "Select at least one image." };

  if (intent === "restaurer") {
    for (const c of cibles) {
      const [productId, mediaId] = c.split("|");
      try { resultats.push(await restaurer(admin, session.shop, productId, mediaId, lang)); }
      catch (e) { resultats.push({ mediaId, ok: false, message: (e as Error).message }); }
    }
    return { resultats };
  }

  if (!ACTIONS.includes(intent as Action)) return { resultats, erreur: fr ? "Action inconnue." : "Unknown action." };
  const forfait = await forfaitActif(admin);
  let utilisees = await imagesUtiliseesCeMois(session.shop);
  for (const c of cibles) {
    const [productId, mediaId] = c.split("|");
    if (utilisees >= forfait.imagesParMois) {
      resultats.push({ mediaId, ok: false, message: fr ? `Limite du forfait ${forfait.nom} atteinte (${forfait.imagesParMois} images ce mois-ci).` : `${forfait.nom} plan limit reached (${forfait.imagesParMois} images this month).` });
      continue;
    }
    try {
      const r = await traiter(admin, session.shop, productId, mediaId, intent as Action, lang);
      if (r.ok && r.apres !== r.avant) utilisees++;
      resultats.push(r);
    } catch (e) {
      const m = (e as Error).message;
      resultats.push({ mediaId, ok: false, message: m === "busy" ? (fr ? "Le détourage est très demandé : réessaie dans une minute." : "Background removal is busy: try again in a minute.") : m });
    }
  }
  return { resultats };
};

const ko = (n: number | null | undefined) => (n ? `${Math.round(n / 1024)} KB` : "—");

export default function Images() {
  const { lang, images, pageInfo } = useLoaderData<typeof loader>();
  const L = (fr: string, en: string) => t(lang, fr, en);
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [params, setParams] = useSearchParams();
  const [choix, setChoix] = useState<string[]>([]);
  const [alts, setAlts] = useState<Record<string, string>>({});
  const occupe = fetcher.state !== "idle";

  useEffect(() => {
    const d = fetcher.data;
    if (!d) return;
    if ("erreur" in d && d.erreur) shopify.toast.show(d.erreur, { isError: true });
    else if (d.resultats?.length) {
      const ok = d.resultats.filter((r) => r.ok).length;
      shopify.toast.show(L(`${ok} / ${d.resultats.length} terminée(s)`, `${ok} / ${d.resultats.length} done`), { isError: ok === 0 });
    }
  }, [fetcher.data]);  // eslint-disable-line react-hooks/exhaustive-deps

  const basculer = (cle: string) => setChoix((c) => (c.includes(cle) ? c.filter((x) => x !== cle) : c.length >= MAX_PAR_ENVOI ? c : [...c, cle]));
  const lancer = (intent: string) => {
    const fd = new FormData();
    fd.set("intent", intent);
    choix.forEach((c) => fd.append("cible", c));
    fetcher.submit(fd, { method: "POST" });
  };
  const resultatDe = (mediaId: string) => fetcher.data?.resultats?.find((r) => r.mediaId === mediaId);

  return (
    <s-page heading={L("Images produits", "Product images")}>
      <s-section>
        <s-stack direction="inline" gap="base">
          <s-search-field label={L("Rechercher un produit", "Search a product")} labelAccessibilityVisibility="exclusive"
            placeholder={L("Rechercher un produit", "Search a product")} value={params.get("q") || ""}
            onChange={(e) => setParams((p) => { const v = e.currentTarget.value; if (v) p.set("q", v); else p.delete("q"); p.delete("apres"); return p; })} />
        </s-stack>
        <s-paragraph>
          {L(`Choisis jusqu'à ${MAX_PAR_ENVOI} images, puis une action. L'original est gardé dans tes Fichiers Shopify.`, `Select up to ${MAX_PAR_ENVOI} images, then an action. The original is kept in your Shopify Files.`)}
          {" "}{L(`${choix.length} choisie(s).`, `${choix.length} selected.`)}
        </s-paragraph>
        <s-stack direction="inline" gap="small">
          <s-button variant="primary" disabled={!choix.length || occupe} loading={occupe} onClick={() => lancer("fond-blanc")}>{L("Fond blanc", "White background")}</s-button>
          <s-button disabled={!choix.length || occupe} onClick={() => lancer("carre")}>{L("Format carré", "Square format")}</s-button>
          <s-button disabled={!choix.length || occupe} onClick={() => lancer("alleger")}>{L("Alléger", "Lighten")}</s-button>
          <s-button variant="tertiary" disabled={!choix.length || occupe} onClick={() => lancer("restaurer")}>{L("Rétablir l'original", "Restore original")}</s-button>
        </s-stack>
      </s-section>

      <s-section>
        <s-stack direction="block" gap="base">
          {images.length === 0 && <s-paragraph>{L("Aucune image de produit trouvée.", "No product images found.")}</s-paragraph>}
          {images.map((img) => {
            const cle = `${img.productId}|${img.mediaId}`;
            const r = resultatDe(img.mediaId);
            return (
              <s-box key={img.mediaId} padding="base" borderWidth="base" borderRadius="base">
                <s-stack direction="inline" gap="base" alignItems="center">
                  <s-checkbox accessibilityLabel={L("Choisir cette image", "Select this image")} checked={choix.includes(cle)} onChange={() => basculer(cle)} />
                  <s-thumbnail src={`${img.url}${img.url.includes("?") ? "&" : "?"}width=120`} alt={img.alt || img.productTitle} size="small" />
                  <s-stack direction="block" gap="small-200">
                    <s-text type="strong">{img.productTitle}</s-text>
                    <s-text color="subdued">{img.width} × {img.height} px · {ko(img.fileSize)}{Math.abs(img.width / img.height - 1) > 0.02 ? ` · ${L("pas carrée", "not square")}` : ""}</s-text>
                    {r && <s-badge tone={r.ok ? "success" : "critical"}>{r.message}{r.avant && r.apres && r.apres !== r.avant ? ` ${ko(r.avant)} → ${ko(r.apres)}` : ""}</s-badge>}
                  </s-stack>
                </s-stack>
                <s-stack direction="inline" gap="small" alignItems="end">
                  <s-text-field label={L("Texte alternatif", "Alt text")} value={alts[img.mediaId] ?? img.alt}
                    placeholder={L("Ex. : Tasse en céramique verte, vue de face", "E.g.: Green ceramic mug, front view")}
                    onInput={(e) => { const v = e.currentTarget.value; setAlts((a) => ({ ...a, [img.mediaId]: v })); }} />
                  <s-button variant="secondary" disabled={occupe} onClick={() => fetcher.submit({ intent: "alt", mediaId: img.mediaId, alt: alts[img.mediaId] ?? img.alt }, { method: "POST" })}>{L("Enregistrer", "Save")}</s-button>
                  {!img.alt && <s-button variant="tertiary" onClick={() => setAlts((a) => ({ ...a, [img.mediaId]: img.productTitle }))}>{L("Utiliser le nom du produit", "Use product name")}</s-button>}
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>
        {pageInfo.hasNextPage && (
          <s-button variant="tertiary" onClick={() => setParams((p) => { p.set("apres", pageInfo.endCursor || ""); return p; })}>{L("Produits suivants →", "Next products →")}</s-button>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
