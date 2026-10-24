"""Fetch latin 400/700 normal woff2 for every Google Fonts family from the Fontsource npm packages.
usage: fetch_fonts.py <metadata.json> <outdir>"""
import json, os, sys, io, tarfile, urllib.request, concurrent.futures as cf, time

meta = json.load(open(sys.argv[1]))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)


def pick(weights, target):
    ws = sorted(weights)
    if target in ws:
        return target
    if target == 400:
        return min(ws, key=lambda w: (abs(w - 400), w))
    heavier = [w for w in ws if w >= 600]
    return min(heavier, key=lambda w: abs(w - 700)) if heavier else None


def get(url, tries=3):
    for i in range(tries):
        try:
            return urllib.request.urlopen(url, timeout=120).read()
        except Exception as e:
            err = e
            time.sleep(2 * (i + 1))
    raise err


def one(fid):
    m = meta[fid]
    d = os.path.join(out, fid)
    if os.path.exists(os.path.join(d, 'done')):
        return fid, 'cached'
    if 'latin' not in m['subsets'] or 'normal' not in m['styles']:
        return fid, 'skip-nolatin'
    w4 = pick(m['weights'], 400)
    w7 = pick(m['weights'], 700)
    if w7 == w4:
        w7 = None
    try:
        info = json.loads(get(f'https://registry.npmjs.org/@fontsource%2F{fid}/latest'))
        tgz = get(info['dist']['tarball'])
    except Exception as e:
        return fid, f'err {e}'
    want = {f'package/files/{fid}-latin-{w4}-normal.woff2': '400.woff2'}
    if w7:
        want[f'package/files/{fid}-latin-{w7}-normal.woff2'] = '700.woff2'
    got = {}
    with tarfile.open(fileobj=io.BytesIO(tgz), mode='r:gz') as tf:
        for mem in tf.getmembers():
            if mem.name in want and mem.isfile():
                got[want[mem.name]] = tf.extractfile(mem).read()
    if '400.woff2' not in got:
        return fid, 'err no-400'
    os.makedirs(d, exist_ok=True)
    for name, data in got.items():
        open(os.path.join(d, name), 'wb').write(data)
    json.dump({'w400': w4, 'w700': w7 if '700.woff2' in got else None}, open(os.path.join(d, 'done'), 'w'))
    return fid, 'ok'


ids = sorted(meta)
stats = {}
with cf.ThreadPoolExecutor(8) as ex:
    for n, (fid, st) in enumerate(ex.map(one, ids), 1):
        key = st.split()[0]
        stats[key] = stats.get(key, 0) + 1
        if not st.startswith(('ok', 'cached')):
            print(fid, st, flush=True)
        if n % 100 == 0:
            print(f'{n}/{len(ids)} {stats}', flush=True)
print('DONE', stats, flush=True)
