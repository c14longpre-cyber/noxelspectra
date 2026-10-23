"""Build every registered sticker into OUT/<kind>/<folder>/<file>.svg"""
import sys, os, importlib, glob
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nx
nx.FONT_PATH = sys.argv[2]
from reg import REGISTRY, build

out = sys.argv[1]
only = sys.argv[3] if len(sys.argv) > 3 else None
for mod in sorted(glob.glob(os.path.join(HERE, 'c*.py'))):
    name = os.path.basename(mod)[:-3]
    if only and only not in name:
        continue
    importlib.import_module(name)

n = 0
for kind, folder, file, title, fn in REGISTRY:
    d = os.path.join(out, kind, folder)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, file + '.svg'), 'w', encoding='utf-8') as f:
        f.write(build(kind, folder, file, title, fn))
    n += 1
print(n, 'files')
