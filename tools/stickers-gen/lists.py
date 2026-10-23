import sys, os, glob, importlib, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nx; nx.FONT_PATH = sys.argv[1]
from reg import REGISTRY
for m in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'c*.py'))): importlib.import_module(os.path.basename(m)[:-3])
GROUPS = {'01_Reactions':'Réactions','02_Succes':'Succès','03_Creation':'Création','04_Web_Affaires':'Web et affaires',
 '05_Decoration':'Décoration','06_Etiquettes':'Étiquettes','07_Photo_Video':'Photo et vidéo','08_Annotations':'Annotations',
 '09_Nature_Animaux':'Nature et animaux','10_Fetes_Emotions':'Fêtes','11_Outils_Spectra':'Outils Spectra','12_Quebec_Hiver':'Québec et hiver',
 '01_Geometriques':'Géométriques','02_Reperes':'Repères','03_Composition':'Composition','04_Badges_Interfaces':'Badges et interface'}
def block(kind, name):
    rows = sorted([r for r in REGISTRY if r[0] == kind], key=lambda r: (r[1], r[2]))
    lines = [f'  static {name} = [']
    for k, folder, file, title, _ in rows:
        lines.append('    { key: %s, label: %s, group: %s },' % (json.dumps(f'{k}/{folder}/{file}'), json.dumps(title, ensure_ascii=False), json.dumps(GROUPS[folder], ensure_ascii=False)))
    lines.append('  ];')
    return '\n'.join(lines), len(rows)
a, na = block('stickers', 'STICKERS'); b, nb = block('formes', 'FORMES')
open(sys.argv[2], 'w').write(a + '\n' + b + '\n'); print(na, nb)
