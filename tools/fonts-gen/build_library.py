"""Builds frontend/public/fonts from the downloaded files.

usage: build_library.py <google-fonts-v2.json> <licenses.json> <downloaded dir> <frontend/public/fonts>

- copies <id>/400.woff2 and <id>/700.woff2 (latin subset)
- writes <id>/preview.woff2: only the glyphs of the family name, so the menu can show
  every name in its own font for a few KB each
- writes catalogue.json: [[id, family, category code, has bold, has French accents], ...] sorted by family
- writes LICENCES.md (every family is OFL, Apache 2.0 or UFL: redistribution allowed)
"""
import io, json, os, shutil, sys
from fontTools.ttLib import TTFont
from fontTools import subset

meta = json.load(open(sys.argv[1]))
licenses = json.load(open(sys.argv[2]))
src, out = sys.argv[3], sys.argv[4]
CODE = {'sans-serif': 's', 'serif': 'e', 'display': 'd', 'handwriting': 'h', 'monospace': 'm'}
# Icon / symbol / emoji families: no letters to show
EXCLUDE_PREFIX = ('material-', 'noto-color-emoji', 'noto-emoji')

os.makedirs(out, exist_ok=True)
rows, skipped, lic_rows = [], [], []
for fid in sorted(meta):
    d = os.path.join(src, fid)
    if fid.startswith(EXCLUDE_PREFIX) or not os.path.exists(os.path.join(d, 'done')):
        continue
    m = meta[fid]
    family = m['family']
    f400 = os.path.join(d, '400.woff2')
    try:
        font = TTFont(f400)
        cmap = font.getBestCmap() or {}
    except Exception as e:
        skipped.append((fid, f'unreadable {e}'))
        continue
    # must draw Latin letters (all-caps fonts count), or the font is useless in the editor
    if not (any(ord(c) in cmap for c in 'Aa') and any(ord(c) in cmap for c in 'Ee')):
        skipped.append((fid, 'no latin letters'))
        continue
    o = os.path.join(out, fid)
    os.makedirs(o, exist_ok=True)
    shutil.copyfile(f400, os.path.join(o, '400.woff2'))
    bold = os.path.exists(os.path.join(d, '700.woff2'))
    if bold:
        shutil.copyfile(os.path.join(d, '700.woff2'), os.path.join(o, '700.woff2'))
    # preview subset: the name's glyphs only
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'rlig']
    opts.name_IDs = []
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    s = subset.Subsetter(opts)
    s.populate(text=family + ' ')
    pf = TTFont(f400)
    s.subset(pf)
    buf = io.BytesIO()
    pf.flavor = 'woff2'
    pf.save(buf)
    open(os.path.join(o, 'preview.woff2'), 'wb').write(buf.getvalue())
    # French accents present? (lowercase or, for all-caps fonts, uppercase)
    accents = all(ord(c) in cmap for c in 'éèàç') or all(ord(c) in cmap for c in 'ÉÈÀÇ')
    rows.append([fid, family, CODE.get(m['category'], 'd'), 1 if bold else 0, 1 if accents else 0])
    L = licenses.get(fid) or {}
    lic_rows.append((family, (L.get('license') or {}).get('type', ''), (L.get('authors') or {}).get('copyright', '')))

rows.sort(key=lambda r: r[1].lower())
json.dump(rows, open(os.path.join(out, 'catalogue.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(out, 'LICENCES.md'), 'w', encoding='utf-8') as f:
    f.write('# Licences des polices\n\nPolices issues de Google Fonts (via les paquets Fontsource), sous-ensemble latin. '
            'Chaque famille est distribuée sous SIL Open Font License 1.1, Apache License 2.0 ou Ubuntu Font Licence 1.0, '
            'qui permettent toutes la redistribution, y compris sur le web.\n\n| Famille | Licence | Droits d\u2019auteur |\n|---|---|---|\n')
    for fam, lic, cp in sorted(lic_rows, key=lambda x: x[0].lower()):
        cp = cp.replace('|', '/').replace('\n', ' ')
        f.write(f'| {fam} | {lic or "voir fonts.google.com"} | {cp} |\n')
print(len(rows), 'families;', len(skipped), 'skipped:', skipped[:15])
