# Générateur du pack de stickers

Source des fichiers de `frontend/public/stickers-pack/`. Chaque sticker est dessiné en Python : un fichier `c*.py` par catégorie, et `c90_formes.py` pour les formes.

## Régénérer

```bash
pip install fonttools
# Police des étiquettes (SIL OFL) : Fredoka, depuis github.com/google/fonts (ofl/fredoka)
python3 tools/stickers-gen/run.py frontend/public/stickers-pack Fredoka.ttf
# Listes STICKERS / FORMES à recopier dans spectra-overlay-editor.js
python3 tools/stickers-gen/lists.py Fredoka.ttf lists.js
```

## Contrat avec l'éditeur (`spectra-overlay-editor.js`)

L'éditeur recolore les stickers en modifiant le texte du SVG. Le générateur respecte ces règles :

- La couleur principale de chaque fichier est le dégradé `id="spectrum"`. Les modes Uni et Dégradé le remplacent.
- Le contour d'encre est `stroke="#142132"`. Le réglage « Couleur du contour » le remplace.
- Seuls les contours d'encre portent un attribut `stroke-width="…"`, que le réglage « Épaisseur du contour » réécrit. Les autres épaisseurs (bordure blanche, ombre, traits colorés) sont dans `style=`, pour ne pas être écrasées.
- L'ombre utilise `#0B1220` et non l'encre, pour ne pas changer de couleur avec le contour.
- Les textes sont vectorisés : aucune police n'est requise à l'affichage.

Les clés existantes (`stickers/01_Reactions/coeur`, etc.) ne doivent jamais être renommées : les projets sauvegardés y font référence.
