from nx import *
from reg import st

F = '10_Fetes_Emotions'


@st(F, 'fete', 'Chapeau de fête')
def _(s):
    s.path('M256 70 L400 430 H112Z', fill='P')
    s.path('M226 145 L288 150 M190 236 L320 250 M156 330 L356 350', role='deco', stroke='Y', stroke_width=24,
           clip_path=s.clip('hat', 'M256 70 L400 430 H112Z'))
    s.path('M256 70 L400 430 H112Z', role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.rect(90, 418, 332, 46, 23, fill='G')
    s.circle(256, 66, 40, fill='Y')
    s.hl('M246 110 L170 380 H190Z', opacity='.4')


@st(F, 'gateau', "Gâteau d'anniversaire")
def _(s):
    for x in (176, 256, 336):
        s.rect(x - 12, 110, 24, 80, 8, fill='K')
        s.path(f'M{x} 50 C{x+22} 76 {x+18} 100 {x} 100 C{x-18} 100 {x-22} 76 {x} 50Z', fill='Y', stroke_width=10)
    s.rect(90, 190, 332, 120, 26, fill='R')
    s.rect(70, 300, 372, 150, 30, fill='T')
    s.path('M90 230 C120 270 150 270 170 230 C190 270 230 270 250 230 C270 270 310 270 330 230 C350 270 390 270 422 230',
           role='deco', stroke='#FFFFFF', stroke_width=20)
    s.path('M70 360 H442', role='deco', stroke='M', stroke_width=26)
    s.rect(46, 438, 420, 34, 17, fill='L')


@st(F, 'coeur_double', 'Deux cœurs')
def _(s):
    s.path(heart_d(330, 210, 120), fill='P', transform='rotate(14 330 210)')
    s.path(heart_d(196, 300, 150), fill='C', transform='rotate(-12 196 300)')
    s.hl('M90 240 Q100 180 160 170 Q116 200 112 254Z', opacity='.5')
    s.path(sparkle_d(430, 380, 32), fill='Y', stroke_width=10)


@st(F, 'etoiles', 'Étoiles')
def _(s):
    s.path(star_d(200, 300, 160, 72, rot=-80), fill='Y', stroke_width=15)
    s.path(star_d(390, 140, 82, 38, rot=-100), fill='P', stroke_width=13)
    s.path(star_d(400, 380, 52, 24), fill='G', stroke_width=11)
    s.hl('M200 160 L176 240 L96 246 L180 254Z', opacity='.6')


@st(F, 'cadeau', 'Cadeau')
def _(s):
    s.path('M256 150 C210 70 120 70 130 120 C140 160 220 156 256 150Z', fill='Y')
    s.path('M256 150 C302 70 392 70 382 120 C372 160 292 156 256 150Z', fill='Y')
    s.rect(96, 230, 320, 230, 18, fill='P')
    s.rect(70, 150, 372, 94, 20, fill='P')
    s.rect(226, 150, 60, 310, 0, role='deco', fill='Y', stroke=INK, stroke_width=12)
    s.rect(70, 150, 372, 94, 20, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.path('M226 244 H286', role='deco', stroke=INK, stroke_width=12)
    s.hl('M120 260 H150 V430 H120Z', opacity='.3')


@st(F, 'ballons', 'Ballons')
def _(s):
    s.path('M150 300 C150 360 200 380 220 470 M330 290 C330 350 290 380 260 470 M256 250 C256 330 240 400 240 470', stroke_width=8)
    s.ellipse(150, 200, 92, 112, fill='C')
    s.ellipse(362, 196, 92, 112, fill='K')
    s.ellipse(256, 150, 96, 116, fill='Y')
    for cx, cy in ((150, 200), (362, 196), (256, 150)):
        s.path(f'M{cx-12} {cy+120} L{cx+12} {cy+120} L{cx} {cy+104}Z', role='deco', fill=INK, stroke='none')
        s.hl(f'M{cx-58} {cy-20} Q{cx-50} {cy-80} {cx-6} {cy-90} Q{cx-38} {cy-56} {cx-40} {cy-14}Z', opacity='.55')


@st(F, 'cotillon', 'Cotillon')
def _(s):
    s.path('M70 450 L130 250 L262 382Z', fill='S')
    s.path('M96 360 L130 250 M120 420 L166 286', role='deco', stroke='#FFFFFF', stroke_width=12, opacity='.5')
    s.path('M190 240 C210 170 180 120 220 80', stroke='P', stroke_width=16)
    s.path('M260 300 C330 270 360 220 440 240', stroke='G', stroke_width=16)
    s.path('M230 270 C280 210 300 160 360 120', stroke='Y', stroke_width=16)
    for x, y, c in ((300, 70, 'C'), (440, 150, 'K'), (420, 330, 'P'), (150, 110, 'Y')):
        s.rect(x - 14, y - 14, 28, 28, 6, fill=c, stroke_width=9, transform=f'rotate(25 {x} {y})')


@st(F, 'trinquer', 'Trinquer')
def _(s):
    s.path('M90 110 L210 90 L228 230 C232 280 196 316 156 322 C116 328 76 296 70 250Z', fill='W', transform='rotate(-10 150 210)')
    s.path('M78 196 L218 176 L228 232 C232 280 196 316 156 322 C116 328 76 296 70 250Z', role='deco', fill='Y', stroke=INK, stroke_width=11, transform='rotate(-10 150 210)')
    s.path('M422 110 L302 90 L284 230 C280 280 316 316 356 322 C396 328 436 296 442 250Z', fill='W', transform='rotate(10 362 210)')
    s.path('M434 196 L294 176 L284 232 C280 280 316 316 356 322 C396 328 436 296 442 250Z', role='deco', fill='C', stroke=INK, stroke_width=11, transform='rotate(10 362 210)')
    s.tube('M170 322 L190 430 M342 322 L322 430', 'W', 14)
    s.path('M140 440 H240 M272 440 H372', stroke_width=18)
    s.path('M256 60 V20 M206 70 L186 40 M306 70 L326 40', role='deco', stroke='Y', stroke_width=14)


@st(F, 'guirlande', 'Guirlande')
def _(s):
    s.path('M40 120 C160 200 352 200 472 120', stroke_width=12)
    colors = ('C', 'Y', 'G', 'K', 'P')
    P = ((40, 120), (160, 200), (352, 200), (472, 120))
    for i, c in enumerate(colors):
        u = (i + 0.5) / len(colors)
        x = sum(w * p[0] for w, p in zip(((1-u)**3, 3*u*(1-u)**2, 3*u*u*(1-u), u**3), P))
        y = sum(w * p[1] for w, p in zip(((1-u)**3, 3*u*(1-u)**2, 3*u*u*(1-u), u**3), P))
        s.path(f'M{x-38:.0f} {y-6:.0f} L{x+38:.0f} {y-6:.0f} L{x:.0f} {y+110:.0f}Z', fill=c, stroke_width=12)
    s.path(sparkle_d(130, 370, 30), fill='Y', stroke_width=10)
    s.path(sparkle_d(380, 390, 24), fill='P', stroke_width=9)


@st(F, 'sucette', 'Sucette')
def _(s):
    s.tube('M256 330 V480', 'W', 20)
    s.circle(256, 210, 160, fill='R')
    import math as _m
    pts = []
    for i in range(0, 361):
        th = i / 360 * 3.2 * 2 * _m.pi
        r = 8 + th * 7.4
        pts.append(f'{256 + r * _m.cos(th):.1f} {210 + r * _m.sin(th):.1f}')
    d = 'M' + ' L'.join(pts)
    s.path(d, role='deco', stroke='#FFFFFF', stroke_width=20, clip_path=s.clip('pop', 'M96 210 A160 160 0 1 0 416 210 A160 160 0 1 0 96 210Z'))
    s.circle(256, 210, 160, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.hl('M140 170 Q160 100 230 80 Q170 120 162 180Z', opacity='.6')
