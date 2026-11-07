// Conformité (vie privée) : aucune donnée des clients de la boutique n'est stockée, donc rien à effacer.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`${topic} pour ${shop} : aucune donnée client stockée`);
  return new Response();
};
