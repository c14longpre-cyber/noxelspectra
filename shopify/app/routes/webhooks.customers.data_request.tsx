// Conformité (vie privée) : NOXEL SPECTRA ne stocke aucune donnée des clients de la boutique. Rien à transmettre.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`${topic} pour ${shop} : aucune donnée client stockée`);
  return new Response();
};
