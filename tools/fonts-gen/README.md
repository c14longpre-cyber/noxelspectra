# Bibliothèque de polices de l'éditeur

Source de `frontend/public/fonts/` : toutes les familles Google Fonts qui contiennent l'alphabet latin, auto-hébergées. Aucune requête ne part vers Google, donc l'adresse IP des visiteurs n'est pas transmise.

- `<id>/400.woff2` et `<id>/700.woff2` : sous-ensemble latin (français, y compris œ et €). Le fichier 700 n'existe que si la famille a une graisse grasse.
- `<id>/preview.woff2` : seulement les lettres du nom de la police, quelques Ko. Le menu s'en sert pour afficher chaque nom dans son propre style.
- `catalogue.json` : `[id, famille, catégorie, gras, accents]`. Catégorie : `s` sans empattement, `e` avec empattement, `d` fantaisie, `h` manuscrite, `m` chasse fixe. `accents` vaut 0 pour les polices sans é è à ç, que le menu signale « sans accents ».
- `LICENCES.md` : licence et droits d'auteur de chaque famille (OFL, Apache 2.0 ou UFL, qui permettent toutes la redistribution).

## Mettre à jour

```bash
# 1. Métadonnées (paquet npm google-font-metadata)
npm pack google-font-metadata && tar -xzf google-font-metadata-*.tgz
# 2. Fichiers latin 400/700 depuis les paquets npm @fontsource/<id> (environ 20 min)
python3 tools/fonts-gen/fetch_fonts.py package/data/google-fonts-v2.json /tmp/fonts-files
# 3. Copie, aperçus, catalogue et licences (pip install fonttools brotli)
python3 tools/fonts-gen/build_library.py package/data/google-fonts-v2.json package/data/licenses.json /tmp/fonts-files frontend/public/fonts
```

Le code qui lit cette bibliothèque est `frontend/src/components/spectra-editor/font-library.ts`. Les 18 polices de `src/fonts.ts` restent livrées par @fontsource et n'attendent aucun chargement.
