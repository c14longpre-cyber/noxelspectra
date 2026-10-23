from nx import Sticker

REGISTRY = []   # (kind, folder, file, title, builder)


def st(folder, file, title, kind='stickers'):
    def deco(fn):
        REGISTRY.append((kind, folder, file, title, fn))
        return fn
    return deco


def build(kind, folder, file, title, fn):
    prefix = ('nxs' if kind == 'stickers' else 'nxf') + folder[:2] + '-' + file.replace('_', '-')
    s = Sticker(prefix, title, die_cut=(kind == 'stickers'))
    fn(s)
    return s.svg_for_editor()
