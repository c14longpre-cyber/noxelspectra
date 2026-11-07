// Images produits de la boutique : lecture, téléversement préparé (staged upload), remplacement du contenu
// d'une image en gardant le même média (fileUpdate), copie de l'original dans les Fichiers (fileCreate).
// API Admin GraphQL 2026-10. Portées : read_products, write_products, read_files, write_files.

type Graphql = (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
export type Admin = { graphql: Graphql };

export type ImageProduit = {
  mediaId: string;
  productId: string;
  productTitle: string;
  alt: string;
  url: string;          // aperçu (CDN Shopify)
  originalUrl: string;  // fichier original
  width: number;
  height: number;
  fileSize: number | null;
  mimeType: string | null;
  status: string;
};

async function gql<T>(admin: Admin, query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await admin.graphql(query, { variables });
  const j = (await r.json()) as { data?: T; errors?: unknown };
  if (!j.data) throw new Error(`GraphQL : ${JSON.stringify(j.errors ?? "réponse vide").slice(0, 300)}`);
  return j.data;
}

function premiereErreur(userErrors: { message: string }[] | undefined): void {
  if (userErrors?.length) throw new Error(userErrors.map((e) => e.message).join(" · "));
}

const REQUETE_PRODUITS = `#graphql
  query ImagesProduits($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        media(first: 20) {
          nodes {
            ... on MediaImage {
              id
              alt
              status
              mimeType
              image { url width height }
              originalSource { url fileSize }
            }
          }
        }
      }
    }
  }`;

type ReponseProduits = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      id: string; title: string;
      media: { nodes: ({ id?: string; alt?: string | null; status?: string; mimeType?: string | null;
        image?: { url: string; width: number; height: number } | null;
        originalSource?: { url: string; fileSize: number | null } | null })[] };
    }[];
  };
};

/** Une page de produits et leurs images (les vidéos et modèles 3D sont ignorés) */
export async function imagesProduits(admin: Admin, opts: { after?: string | null; recherche?: string; parPage?: number } = {}) {
  const d = await gql<ReponseProduits>(admin, REQUETE_PRODUITS, {
    first: opts.parPage ?? 20, after: opts.after || null, query: opts.recherche ? `title:*${opts.recherche.replace(/[^\p{L}\p{N} -]/gu, "")}*` : null,
  });
  const images: ImageProduit[] = [];
  for (const p of d.products.nodes) {
    for (const m of p.media.nodes) {
      if (!m.id || !m.image) continue;
      images.push({
        mediaId: m.id, productId: p.id, productTitle: p.title, alt: m.alt ?? "",
        url: m.image.url, originalUrl: m.originalSource?.url ?? m.image.url,
        width: m.image.width, height: m.image.height, fileSize: m.originalSource?.fileSize ?? null,
        mimeType: m.mimeType ?? null, status: m.status ?? "READY",
      });
    }
  }
  return { images, pageInfo: d.products.pageInfo };
}

/** Une image précise (pour la traiter) */
export async function imageParId(admin: Admin, mediaId: string): Promise<ImageProduit | null> {
  const d = await gql<{ node: (ReponseProduits["products"]["nodes"][number]["media"]["nodes"][number] & { product?: { id: string; title: string } | null }) | null }>(admin, `#graphql
    query UneImage($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          id alt status mimeType
          image { url width height }
          originalSource { url fileSize }
        }
      }
    }`, { id: mediaId });
  const m = d.node;
  if (!m?.id || !m.image) return null;
  return {
    mediaId: m.id, productId: "", productTitle: "", alt: m.alt ?? "", url: m.image.url,
    originalUrl: m.originalSource?.url ?? m.image.url, width: m.image.width, height: m.image.height,
    fileSize: m.originalSource?.fileSize ?? null, mimeType: m.mimeType ?? null, status: m.status ?? "READY",
  };
}

/** Télécharge un fichier du CDN de Shopify (seulement ce domaine : jamais une adresse quelconque) */
export async function telecharger(url: string): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !(u.hostname === "cdn.shopify.com" || u.hostname.endsWith(".myshopify.com") || u.hostname.endsWith(".shopifycdn.com"))) {
    throw new Error(`Adresse refusée : ${u.hostname}`);
  }
  const r = await fetch(u, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Téléchargement impossible (${r.status})`);
  const taille = Number(r.headers.get("content-length") || 0);
  if (taille > 40 * 1024 * 1024) throw new Error("Image trop lourde (40 Mo au plus)");
  return Buffer.from(await r.arrayBuffer());
}

/** Téléverse des octets chez Shopify et renvoie l'adresse à passer en originalSource */
export async function televerser(admin: Admin, octets: Buffer, nom: string, mime: string): Promise<string> {
  const d = await gql<{ stagedUploadsCreate: { stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[]; userErrors: { message: string }[] } }>(admin, `#graphql
    mutation Preparer($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`, { input: [{ resource: "IMAGE", filename: nom, mimeType: mime, httpMethod: "POST", fileSize: String(octets.length) }] });
  premiereErreur(d.stagedUploadsCreate.userErrors);
  const cible = d.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of cible.parameters) form.append(p.name, p.value);
  form.append("file", new Blob([new Uint8Array(octets)], { type: mime }), nom);
  const r = await fetch(cible.url, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`Téléversement refusé (${r.status})`);
  return cible.resourceUrl;
}

/** Copie de l'original dans les Fichiers de la boutique (pour « Rétablir l'original ») */
export async function sauvegarderOriginal(admin: Admin, octets: Buffer, nom: string, mime: string, mediaId: string): Promise<string> {
  const source = await televerser(admin, octets, nom, mime);
  const d = await gql<{ fileCreate: { files: { id: string }[]; userErrors: { message: string }[] } }>(admin, `#graphql
    mutation Sauvegarde($files: [FileCreateInput!]!) {
      fileCreate(files: $files) { files { id } userErrors { field message } }
    }`, { files: [{ originalSource: source, contentType: "IMAGE", alt: `NOXEL SPECTRA — original ${mediaId.split("/").pop()}` }] });
  premiereErreur(d.fileCreate.userErrors);
  return d.fileCreate.files[0].id;
}

/** Remplace le contenu d'une image produit : même média, même place dans la fiche, même adresse */
export async function remplacerContenu(admin: Admin, mediaId: string, source: string): Promise<void> {
  const d = await gql<{ fileUpdate: { userErrors: { message: string }[] } }>(admin, `#graphql
    mutation Remplacer($files: [FileUpdateInput!]!) {
      fileUpdate(files: $files) { files { id fileStatus } userErrors { field message code } }
    }`, { files: [{ id: mediaId, originalSource: source }] });
  premiereErreur(d.fileUpdate.userErrors);
}

export async function changerAlt(admin: Admin, mediaId: string, alt: string): Promise<void> {
  const d = await gql<{ fileUpdate: { userErrors: { message: string }[] } }>(admin, `#graphql
    mutation Alt($files: [FileUpdateInput!]!) {
      fileUpdate(files: $files) { files { id } userErrors { field message code } }
    }`, { files: [{ id: mediaId, alt: alt.slice(0, 512) }] });
  premiereErreur(d.fileUpdate.userErrors);
}

/** Adresse du fichier de sauvegarde (null tant que Shopify ne l'a pas fini) */
export async function urlDuFichier(admin: Admin, fileId: string): Promise<string | null> {
  const d = await gql<{ node: { fileStatus?: string; image?: { url: string } | null; originalSource?: { url: string } | null } | null }>(admin, `#graphql
    query Fichier($id: ID!) {
      node(id: $id) { ... on MediaImage { fileStatus image { url } originalSource { url } } }
    }`, { id: fileId });
  if (d.node?.fileStatus !== "READY") return null;
  return d.node.originalSource?.url ?? d.node.image?.url ?? null;
}

/** Nom de fichier tiré de l'adresse du CDN (l'extension doit rester la même pour fileUpdate) */
export function nomDuFichier(url: string): string {
  const base = new URL(url).pathname.split("/").pop() || "image.jpg";
  return decodeURIComponent(base);
}
