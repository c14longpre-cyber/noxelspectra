from nx import *
from reg import st

F = '11_Outils_Spectra'


def photo(s, x, y, w, h, r=24):
    s.rect(x, y, w, h, r, fill='K')
    s.path(f'M{x} {y+h*0.72} L{x+w*0.3} {y+h*0.42} L{x+w*0.56} {y+h*0.68} L{x+w*0.72} {y+h*0.52} L{x+w} {y+h*0.78} '
           f'V{y+h-r} Q{x+w} {y+h} {x+w-r} {y+h} H{x+r} Q{x} {y+h} {x} {y+h-r}Z',
           role='deco', fill='G', stroke=INK, stroke_width=11)
    s.circle(x + w * 0.74, y + h * 0.26, min(w, h) * 0.1, role='deco', fill='Y', stroke=INK, stroke_width=9)
    s.rect(x, y, w, h, r, role='deco', fill='none', stroke=INK, stroke_width=SW)


@st(F, 'recadrage', 'Recadrage')
def _(s):
    photo(s, 130, 130, 250, 250)
    s.tube('M130 50 V382 H462', 'P', 30)
    s.tube('M50 130 H382 V462', 'G', 30)


@st(F, 'redimensionnement', 'Redimensionnement')
def _(s):
    s.rect(60, 60, 392, 392, 34, fill='W', stroke_dasharray=None)
    s.rect(60, 60, 392, 392, 34, role='deco', fill='none', stroke='#9AA6BB', stroke_width=8, stroke_dasharray='18 18')
    photo(s, 60, 230, 222, 222)
    s.tube('M300 212 L420 92', 'P', 24)
    s.path('M346 86 H426 V166', role='deco', stroke=INK, stroke_width=24 + SW)
    s.path('M346 86 H426 V166', role='deco', stroke='P', stroke_width=24)


@st(F, 'compression', 'Compression')
def _(s):
    s.rect(156, 140, 200, 232, 26, fill='S')
    s.text('KB', 256, 290, 84, fill='#FFFFFF')
    for sx in (-1, 1):
        x0 = 256 + sx * 236
        x1 = 256 + sx * 150
        s.tube(f'M{x0} 256 H{x1}', 'Y', 26)
        s.path(f'M{x1 + sx*40} 210 L{x1} 256 L{x1 + sx*40} 302', role='deco', stroke=INK, stroke_width=26 + SW)
        s.path(f'M{x1 + sx*40} 210 L{x1} 256 L{x1 + sx*40} 302', role='deco', stroke='Y', stroke_width=26)


@st(F, 'conversion', 'Conversion de format')
def _(s):
    s.rect(50, 70, 200, 250, 24, fill='L')
    s.text('PNG', 150, 222, 64, fill=INK)
    s.rect(262, 192, 200, 250, 24, fill='G')
    s.text('WebP', 362, 344, 60, fill=INK)
    s.path('M180 400 C180 440 210 460 250 452', stroke_width=18 + SW)
    s.path('M180 400 C180 440 210 460 250 452', role='deco', stroke='P', stroke_width=18)
    s.path('M330 112 C330 72 300 52 260 60', stroke_width=18 + SW)
    s.path('M330 112 C330 72 300 52 260 60', role='deco', stroke='P', stroke_width=18)
    s.path('M236 426 L262 452 L232 474', role='deco', stroke=INK, stroke_width=18 + SW)
    s.path('M236 426 L262 452 L232 474', role='deco', stroke='P', stroke_width=18)
    s.path('M276 38 L248 60 L274 86', role='deco', stroke=INK, stroke_width=18 + SW)
    s.path('M276 38 L248 60 L274 86', role='deco', stroke='P', stroke_width=18)


@st(F, 'detourage', "Détourage d'arrière-plan")
def _(s):
    s.rect(60, 60, 392, 392, 40, fill='W')
    cells = []
    for r in range(8):
        for c in range(8):
            if (r + c) % 2:
                cells.append(f'M{60+c*49} {60+r*49} h49 v49 h-49Z')
    s.path(' '.join(cells), role='deco', fill='#D5DCE8', stroke='none', clip_path=s.clip('board', rr_d(60, 60, 392, 392, 40)))
    s.rect(60, 60, 392, 392, 40, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.circle(256, 200, 72, role='deco', fill='P', stroke=INK, stroke_width=SW)
    s.path('M120 452 C120 340 180 290 256 290 C332 290 392 340 392 452Z', role='deco', fill='P', stroke=INK, stroke_width=SW)
    s.path(sparkle_d(410, 110, 36), fill='Y', stroke_width=10)


@st(F, 'vectorisation', 'Vectorisation')
def _(s):
    d = 'M90 380 C120 200 220 120 300 150 C380 180 330 300 422 300'
    s.path(d, stroke='S2', stroke_width=26 + SW)
    s.path(d, role='deco', stroke='S2', stroke_width=22)
    s.path('M90 380 L170 160 M300 150 L410 120', role='deco', stroke=INK, stroke_width=8)
    for x, y in ((90, 380), (300, 150), (422, 300)):
        s.rect(x - 26, y - 26, 52, 52, 8, fill='W', stroke_width=11)
    for x, y in ((170, 160), (410, 120)):
        s.circle(x, y, 22, fill='P', stroke_width=10)


@st(F, 'favicon', 'Favicon')
def _(s):
    s.path('M40 190 Q40 150 80 150 H230 Q256 150 264 120 L280 96 Q290 80 310 80 H432 Q472 80 472 120 V400 Q472 440 432 440 H80 Q40 440 40 400Z', fill='W')
    s.path('M40 190 H472', role='deco', stroke=INK, stroke_width=11)
    s.rect(96, 220, 140, 140, 32, role='deco', fill='S', stroke=INK, stroke_width=SW)
    s.path(sparkle_d(166, 290, 46), role='deco', fill='#FFFFFF', stroke='none')
    s.rect(266, 230, 160, 22, 11, role='deco', fill='L', stroke='none')
    s.rect(266, 280, 120, 22, 11, role='deco', fill='L', stroke='none')
    s.rect(266, 330, 140, 22, 11, role='deco', fill='L', stroke='none')
    s.circle(320, 114, 10, role='deco', fill='G', stroke='none')


@st(F, 'traitement_lot', 'Traitement par lots')
def _(s):
    s.rect(140, 50, 300, 230, 28, fill='P', transform='rotate(8 290 165)')
    s.rect(110, 110, 300, 230, 28, fill='K', transform='rotate(-4 260 225)')
    photo(s, 70, 190, 300, 230)
    s.circle(420, 410, 58, fill='G')
    s.text('×20', 420, 432, 54, fill=INK)


def fmt(s, label, fill, tc=INK):
    s.path('M100 60 H320 L412 152 V416 Q412 452 376 452 H136 Q100 452 100 416 V96 Q100 60 136 60Z', fill='W')
    s.path('M320 60 V128 Q320 152 344 152 H412', role='deco', fill='L', stroke=INK, stroke_width=SW)
    s.rect(60, 260, 300, 132, 30, fill=fill)
    _, w = text_path(label, 0, 0, 96)
    size = 96 if w <= 240 else 96 * 240 / w
    s.text(label, 210, 360, size, fill=tc)


@st(F, 'format_webp', 'Format WebP')
def _(s): fmt(s, 'WEBP', 'G')


@st(F, 'format_avif', 'Format AVIF')
def _(s): fmt(s, 'AVIF', 'P', '#FFFFFF')


@st(F, 'format_svg', 'Format SVG')
def _(s): fmt(s, 'SVG', 'O')


@st(F, 'format_png', 'Format PNG')
def _(s): fmt(s, 'PNG', 'K')
