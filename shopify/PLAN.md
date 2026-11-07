# NOXEL SPECTRA pour Shopify — plan de la version 1

## La promesse

« Tes photos produits, prêtes pour la vente, en un clic, sans quitter Shopify. »

Ce que l'app fait sur les images des produits, directement dans les fiches :

| Action | Ce que ça fait | Compte dans le forfait |
|---|---|---|
| **Fond blanc** | Détourage par l'IA de NOXEL SPECTRA, fond blanc pur | oui |
| **Format carré** | Image entière centrée sur un carré blanc (grille de produits régulière) | oui |
| **Alléger** | Ramène à 2048 px au plus et recompresse ; ne touche à rien si ce n'est pas plus léger | oui |
| **Texte alternatif** | Saisie, ou nom du produit en un clic (référencement Google Images, accessibilité) | non |
| **Rétablir l'original** | L'original est copié dans les Fichiers Shopify avant la 1re modification | non |

Pourquoi pas « convertir en WebP » : le CDN de Shopify sert déjà WebP / AVIF aux navigateurs, et Shopify exige de garder l'extension d'origine pour remplacer une image. La vraie valeur est dans le fond, le cadrage, le poids de l'original et le texte alternatif.

## Ce qui est prêt (dossier `shopify/`)

- Squelette sur le modèle officiel de Shopify (React Router, App Bridge, composants Polaris), en français et en anglais
- Pages : Accueil (état du catalogue), Images produits (choix et actions), Forfaits
- Remplacement d'image sans changer le média (`fileUpdate`), copie de l'original (`fileCreate`), journal des opérations (Postgres)
- Webhooks obligatoires : désinstallation, `customers/data_request`, `customers/redact`, `shop/redact`
- Quotas par forfait (images modifiées dans le mois)
- API SPECTRA : jeton de service `SPECTRA_SERVICE_TOKEN` pour que l'app Shopify utilise le détourage sans quota par adresse IP
- Vérifié ici : type-check, build, lint, tests des forfaits et des traitements d'image
- **Pas encore testé contre une vraie boutique** : il faut l'app créée dans Shopify (étapes ci-dessous)

## Étapes pour Christian (à faire toi-même)

1. **Compte Shopify Partners** (gratuit) : https://partners.shopify.com → créer le compte (NOXEL, ton courriel).
2. **Boutique de test** : Partners → *Stores* → *Add store* → *Development store*. Ajoute 5 à 10 produits avec des photos (même des photos de ton téléphone).
3. **Créer l'app** : Partners → *Apps* → *Create app* → *Create app manually*, nom « NOXEL SPECTRA ». Note le **Client ID** et le **Client secret** (le secret ne se colle jamais dans le chat).
4. **Railway** : nouveau service à partir du dépôt `noxelspectra`, dossier racine `shopify/` (Railway détecte le `Dockerfile`), plus une base **Postgres** (bouton *Add* → *Database* → *PostgreSQL*). Variables du service :
   - `SHOPIFY_API_KEY` = Client ID
   - `SHOPIFY_API_SECRET` = Client secret
   - `SCOPES` = `read_products,write_products,read_files,write_files`
   - `SHOPIFY_APP_URL` = `https://shopify.noxelspectra.com`
   - `SHOPIFY_APP_HANDLE` = l'identifiant de l'app (visible dans l'adresse de l'app dans l'admin, souvent `noxel-spectra`)
   - `DATABASE_URL` = référence à la base Postgres (Railway : `${{Postgres.DATABASE_URL}}`)
   - `SPECTRA_API_URL` = `https://api.noxelspectra.com`
   - `SPECTRA_SERVICE_TOKEN` = une valeur aléatoire de 48 caractères (PowerShell : `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})`)
5. **Même `SPECTRA_SERVICE_TOKEN`** dans le service de l'API SPECTRA (Railway), puis redéploiement.
6. **Domaine** : Railway → service Shopify → *Custom Domain* `shopify.noxelspectra.com` → autoriser le CNAME dans Cloudflare (comme pour `api.`).
7. **Pousser la configuration** (sur ton ordinateur, dans VS Code) :
   ```
   cd shopify
   npm install
   npx shopify app config link     # choisis l'app « NOXEL SPECTRA » créée à l'étape 3
   npx shopify app deploy          # envoie les portées, les webhooks et les adresses à Shopify
   ```
8. **Forfaits** : Partners → l'app → *Distribution* / *Pricing* → **Manual / Managed pricing** : crée les plans avec exactement ces noms (proposition, à ajuster) :
   | Nom | Prix | Images par mois |
   |---|---|---|
   | Free | 0 $ US | 25 |
   | Starter | 9,99 $ US | 500 |
   | Pro | 24,99 $ US | 3 000 |
   | Business | 59,99 $ US | 15 000 |
9. **Installer sur la boutique de test** : Partners → l'app → *Test on development store*. Essaie chaque action, puis « Rétablir l'original ».
10. Envoie-moi des captures : je corrige ce qui accroche.

## Après les tests (avec moi)

- Traitement en arrière-plan de tout le catalogue (file d'attente), avec progression
- Texte alternatif proposé par l'IA (description de l'image), en option payante ou dans les forfaits supérieurs
- Fiche App Store : nom, description FR/EN, captures, icône 1200 × 1200, politique de confidentialité (section Shopify à ajouter sur noxelspectra.com), adresse de soutien
- Soumission à la révision de Shopify (1 à 3 semaines)

## Décisions à prendre

- Prix des forfaits (proposition ci-dessus)
- Fond blanc seulement, ou aussi d'autres couleurs / transparent pour les PNG
- Marge autour du produit en format carré (6 % aujourd'hui)
