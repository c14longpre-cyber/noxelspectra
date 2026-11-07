// Conformité : 48 h après la désinstallation, Shopify demande d'effacer les données de la boutique.
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);
  await db.operation.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });
  return new Response();
};
