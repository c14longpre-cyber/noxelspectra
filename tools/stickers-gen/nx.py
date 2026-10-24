"""NOXEL Spectra sticker toolkit: die-cut stickers built from plain SVG geometry (no filters)."""
import math, re
from functools import lru_cache

INK = '#142132'
SW = 14          # ink outline width
B = 13           # white die-cut margin beyond the ink outline
SHADOW_DY = 9
SHADOW = '#0B1220'

# vertical gradients (top -> bottom) give every fill a little volume
PAINTS = {
    'G': ('#86F7BE', '#22BE6B'),   # NOXEL green
    'P': ('#D2A8FF', '#8B3DE6'),   # NOXEL purple
    'Y': ('#FFE68A', '#FFB52E'),   # sun
    'O': ('#FFC27A', '#FF7A2F'),   # orange
    'C': ('#FFA59A', '#F2545B'),   # coral / red
    'K': ('#9EE0FF', '#2E9CEB'),   # sky
    'R': ('#FFB3DA', '#E9479A'),   # pink
    'W': ('#FFFFFF', '#E3E9F5'),   # paper white
    'L': ('#D9E1EE', '#A8B4C8'),   # light grey / metal
    'D': ('#3A4A63', '#16233A'),   # dark slate
    'T': ('#D9A577', '#9C5F33'),   # wood / brown
    'M': ('#FFE3C2', '#F2B98B'),   # cream / skin-neutral
}
SPECTRUM = ('#3DDC84', '#36C9D8', '#A855F7')


def mix(a, b):
    ca = [int(a[i:i+2], 16) for i in (1, 3, 5)]
    cb = [int(b[i:i+2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{(x + y) // 2:02X}' for x, y in zip(ca, cb))


def _attr(k):
    return k.rstrip('_').replace('_', '-')


class Sticker:
    def __init__(self, slug, title, die_cut=True):
        self.slug, self.title, self.die_cut = slug, title, die_cut
        self.els = []      # (role, tag, attrs, inner)
        self.paints = set()
        self.extra_defs = []

    # ---- paint handling -------------------------------------------------
    def paint(self, v):
        if isinstance(v, str) and (v in PAINTS or v == 'S' or v == 'S2'):
            self.paints.add(v)
            return f'url(#{self.slug}-{v})'
        return v

    # ---- element creation ------------------------------------------------
    def add(self, tag, role='body', inner='', **a):
        attrs = {_attr(k): v for k, v in a.items() if v is not None}
        st_ = attrs.get('stroke')
        if isinstance(st_, str) and st_ in PAINTS:
            # strokes use a flat mid-tone: gradients on straight lines have a zero-size box and vanish
            attrs['stroke'] = mix(*PAINTS[st_])
        for k in ('fill', 'stroke'):
            if k in attrs:
                attrs[k] = self.paint(attrs[k])
        if role == 'body':
            attrs.setdefault('fill', 'none')
            attrs.setdefault('stroke', INK)
            if attrs['stroke'] != 'none':
                attrs.setdefault('stroke-width', SW)
        elif role == 'deco':
            attrs.setdefault('fill', 'none')
        elif role == 'hl':
            attrs.setdefault('fill', '#FFFFFF')
            attrs.setdefault('opacity', '.55')
            attrs.setdefault('stroke', 'none')
        elif role == 'shade':
            attrs.setdefault('fill', INK)
            attrs.setdefault('opacity', '.14')
            attrs.setdefault('stroke', 'none')
        self.els.append((role, tag, attrs, inner))
        return self

    # shorthands -----------------------------------------------------------
    def path(self, d, role='body', **a): return self.add('path', role, d=d, **a)
    def circle(self, cx, cy, r, role='body', **a): return self.add('circle', role, cx=cx, cy=cy, r=r, **a)
    def ellipse(self, cx, cy, rx, ry, role='body', **a): return self.add('ellipse', role, cx=cx, cy=cy, rx=rx, ry=ry, **a)
    def rect(self, x, y, w, h, rx=0, role='body', **a): return self.add('rect', role, x=x, y=y, width=w, height=h, rx=rx, **a)
    def poly(self, pts, role='body', **a):
        return self.add('polygon', role, points=' '.join(f'{x:g},{y:g}' for x, y in pts), **a)
    def line(self, x1, y1, x2, y2, role='body', **a):
        return self.add('line', role, x1=x1, y1=y1, x2=x2, y2=y2, **a)
    def tube(self, d, color, w, **a):
        """thick coloured stroke with an ink outline"""
        self.path(d, stroke_width=w + SW, fill='none', data_fixed='1', **a)
        return self.path(d, role='deco', stroke=color, stroke_width=w, fill='none', **a)

    def clip(self, name, d):
        cid = f'{self.slug}-{name}'
        self.extra_defs.append(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
        return f'url(#{cid})'

    def hl(self, d, **a): return self.path(d, role='hl', **a)
    def shade(self, d, **a): return self.path(d, role='shade', **a)
    def text(self, s, x, y, size, role='deco', anchor='middle', **a):
        d, w = text_path(s, x, y, size, anchor)
        a.setdefault('fill', INK)
        a.setdefault('stroke', 'none')
        return self.add('path', role, d=d, **a)

    # ---- serialisation ----------------------------------------------------
    @staticmethod
    def _tag(tag, attrs, inner=''):
        s = ' '.join(f'{k}="{v}"' for k, v in attrs.items())
        return f'<{tag} {s}>{inner}</{tag}>' if inner else f'<{tag} {s}/>'

    def _silhouette(self, color):
        out = []
        for role, tag, a, inner in self.els:
            if role != 'body':
                continue
            s = dict(a)
            for k in ('opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray', 'id', 'data-fixed'):
                s.pop(k, None)
            stroked = a.get('stroke', 'none') != 'none'
            w = float(a.get('stroke-width', 0)) if stroked else 0
            if s.get('fill', 'none') != 'none':
                s['fill'] = color
            s['stroke'] = color
            s.pop('stroke-width', None)
            s['style'] = f'stroke-width:{w + 2 * B:g}'
            out.append(self._tag(tag, s))
        return ''.join(out)

    def defs(self):
        out = []
        for p in sorted(self.paints):
            gid = f'{self.slug}-{p}'
            if p == 'S':
                stops = ''.join(f'<stop offset="{i/2:g}" stop-color="{c}"/>' for i, c in enumerate(SPECTRUM))
                out.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1">{stops}</linearGradient>')
            elif p == 'S2':   # horizontal spectrum, for thin bands
                stops = ''.join(f'<stop offset="{i/2:g}" stop-color="{c}"/>' for i, c in enumerate(SPECTRUM))
                out.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="0">{stops}</linearGradient>')
            else:
                a, b = PAINTS[p]
                out.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
                           f'<stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>')
        return ''.join(out) + ''.join(self.extra_defs)

    def primary(self):
        """Paint the Spectra editor recolours: the spectrum if used, else the first body fill."""
        if 'S' in self.paints:
            return 'S'
        pre = f'url(#{self.slug}-'
        for role, _, a, _ in self.els:
            f = a.get('fill', '')
            if role == 'body' and isinstance(f, str) and f.startswith(pre):
                return f[len(pre):-1]
        return None

    def _editor_attrs(self, a):
        """Editor contract (spectra-overlay-editor.js): only ink contours keep a stroke-width
        attribute, which the 'Épaisseur du contour' slider rewrites; every other width goes in style."""
        a = dict(a)
        fixed = a.pop('data-fixed', None)
        if 'stroke-width' in a and (fixed or (self.die_cut and a.get('stroke') != INK)):
            a['style'] = f"stroke-width:{a.pop('stroke-width')}"
        return a

    def svg(self):
        body = ''.join(self._tag(t, self._editor_attrs(a), i) for _, t, a, i in self.els)
        layers = ''
        if self.die_cut:
            # shadow colour differs from INK so the editor's contour-colour swap leaves it alone
            layers = (f'<g transform="translate(0 {SHADOW_DY})" opacity=".2" stroke-linecap="round" stroke-linejoin="round">'
                      f'{self._silhouette(SHADOW)}</g>'
                      f'<g stroke-linecap="round" stroke-linejoin="round">{self._silhouette("#FFFFFF")}</g>')
        d = self.defs()
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" '
                f'role="img" aria-labelledby="{self.slug}-t"><title id="{self.slug}-t">{self.title}</title>'
                + (f'<defs>{d}</defs>' if d else '') + layers +
                f'<g stroke-linecap="round" stroke-linejoin="round">{body}</g></svg>')

    def svg_for_editor(self):
        out = self.svg()
        p = self.primary()
        if p:
            # the editor swaps <linearGradient id="spectrum"> for the user's colour or gradient
            out = out.replace(f'url(#{self.slug}-{p})', 'url(#spectrum)').replace(f'id="{self.slug}-{p}"', 'id="spectrum"')
        return out


# ---------------------------------------------------------------- text -> path
FONT_PATH = None


@lru_cache(maxsize=1)
def _font():
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    f = TTFont(FONT_PATH)
    return instancer.instantiateVariableFont(f, {'wght': 650, 'wdth': 100})


def text_path(s, x, y, size, anchor='middle'):
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    f = _font()
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
    upm = f['head'].unitsPerEm
    k = size / upm
    total = sum(hmtx[cmap[ord(ch)]][0] for ch in s)
    x0 = x - (total * k / 2 if anchor == 'middle' else 0)
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))
    cx = 0
    for ch in s:
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (k, 0, 0, -k, x0 + cx * k, y))
        gs[g].draw(tp)
        cx += hmtx[g][0]
    return pen.getCommands(), total * k


# ---------------------------------------------------------------- geometry helpers
def star_pts(cx, cy, r1, r2, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2
        a = math.radians(rot + i * 180 / n)
        pts.append((round(cx + r * math.cos(a), 1), round(cy + r * math.sin(a), 1)))
    return pts


def star_d(cx, cy, r1, r2, n=5, rot=-90):
    p = star_pts(cx, cy, r1, r2, n, rot)
    return 'M' + ' L'.join(f'{x:g} {y:g}' for x, y in p) + 'Z'


def sparkle_d(cx, cy, r, k=.28):
    """four-point sparkle with curved sides"""
    i = r * k
    return (f'M{cx} {cy-r} Q{cx+i} {cy-i} {cx+r} {cy} Q{cx+i} {cy+i} {cx} {cy+r} '
            f'Q{cx-i} {cy+i} {cx-r} {cy} Q{cx-i} {cy-i} {cx} {cy-r}Z')


def burst_d(cx, cy, r1, r2, n=14, rot=-90):
    return star_d(cx, cy, r1, r2, n, rot)


def heart_d(cx, cy, s):
    """heart centred at (cx, cy), roughly 2s wide"""
    return (f'M{cx} {cy+s*0.95} C{cx-s*0.35} {cy+s*0.7} {cx-s} {cy+s*0.25} {cx-s} {cy-s*0.3} '
            f'C{cx-s} {cy-s*0.85} {cx-s*0.3} {cy-s*1.05} {cx} {cy-s*0.55} '
            f'C{cx+s*0.3} {cy-s*1.05} {cx+s} {cy-s*0.85} {cx+s} {cy-s*0.3} '
            f'C{cx+s} {cy+s*0.25} {cx+s*0.35} {cy+s*0.7} {cx} {cy+s*0.95}Z')


def rr_d(x, y, w, h, r):
    return (f'M{x+r} {y}H{x+w-r}Q{x+w} {y} {x+w} {y+r}V{y+h-r}Q{x+w} {y+h} {x+w-r} {y+h}'
            f'H{x+r}Q{x} {y+h} {x} {y+h-r}V{y+r}Q{x} {y} {x+r} {y}Z')


def arc_pt(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def face(s, cx=256, cy=262, r=176, fill='Y'):
    """round emoji head with gloss"""
    s.circle(cx, cy, r, fill=fill)
    s.hl(f'M{cx-r*0.62} {cy-r*0.38} Q{cx-r*0.55} {cy-r*0.78} {cx-r*0.12} {cy-r*0.86} '
         f'Q{cx-r*0.5} {cy-r*0.62} {cx-r*0.62} {cy-r*0.38}Z')
    s.shade(f'M{cx-r*0.92} {cy+r*0.2} A{r} {r} 0 0 0 {cx+r*0.92} {cy+r*0.2} '
            f'A{r*1.15} {r*0.95} 0 0 1 {cx-r*0.92} {cy+r*0.2}Z')
    return s


def eye(s, x, y, r=17):
    s.ellipse(x, y, r * 0.82, r * 1.15, role='deco', fill=INK, stroke='none')
    s.circle(x + r * 0.25, y - r * 0.4, r * 0.32, role='deco', fill='#FFFFFF', stroke='none')


def cheeks(s, cx=256, cy=262, dx=112, dy=40):
    for sx in (-1, 1):
        s.ellipse(cx + sx * dx, cy + dy, 26, 15, role='deco', fill='#FF7A8A', opacity='.55', stroke='none')
