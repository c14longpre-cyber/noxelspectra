@AGENTS.md

# NOXEL SPECTRA pour Shopify — notes pour les agents

App Shopify intégrée à l'admin (modèle officiel React Router, `shopify-app-template-react-router`), servie sur `shopify.noxelspectra.com` (Railway, `Dockerfile`, Postgres). Plan et étapes : `PLAN.md`.

- **Ce qu'elle fait (V1)** : sur les images des produits, fond blanc (détourage par l'API NOXEL SPECTRA), format carré uniforme, allègement (2048 px au plus, recompression), texte alternatif, « Rétablir l'original ». Au plus 5 images par envoi (`MAX_PAR_ENVOI`, app.images.tsx) ; traitement en arrière-plan à venir.
- **Remplacement d'une image** : `fileUpdate` avec `originalSource` (même média, même place, même extension obligatoire) ; le format de sortie reste celui de l'original (le CDN Shopify sert déjà WebP / AVIF). Avant la première modification d'une image, l'original est copié dans les Fichiers de la boutique (`fileCreate`) et son identifiant est gardé dans `Operation.backupFileId`.
- **Détourage** : `app/lib/spectra.server.ts` appelle `POST /api/remove-background` de l'API SPECTRA avec l'en-tête `x-spectra-service` (`SPECTRA_SERVICE_TOKEN`, même valeur dans les deux services) ; l'API ne compte pas ces appels dans son quota par adresse IP (`estServiceSpectra`, backend/src/account/middleware.ts). Le reste (carré, allègement) est fait ici avec sharp.
- **Forfaits** : facturation Shopify « App Pricing » (obligatoire, pas de Stripe), plans créés dans le tableau de bord Partners avec les noms de `app/lib/forfaits.ts` ; quota = images modifiées dans le mois (table `Operation`). Le texte alternatif et « Rétablir » ne comptent pas.
- **Vie privée** : aucune donnée des clients de la boutique n'est stockée ; webhooks de conformité dans `app/routes/webhooks.*` (shop/redact efface la boutique).
- **Téléchargements** : `telecharger()` n'accepte que le CDN de Shopify.
- **Langue** : français si le navigateur du marchand est en français, sinon anglais (`app/lib/langue.ts`, `t(lang, fr, en)`).
- Commandes : `npm run typecheck`, `npm test` (forfaits + traitements d'image, sans Shopify), `npm run build`. `prisma generate` télécharge ses moteurs : à faire là où binaries.prisma.sh est accessible (Railway, ton ordinateur).
