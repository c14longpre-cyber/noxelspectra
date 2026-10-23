from nx import *
from reg import st

F = '04_Web_Affaires'


@st(F, 'panier', "Panier d'achat")
def _(s):
    s.path('M50 92 H120 L176 330 H400', stroke_width=20)
    s.path('M132 140 H440 L408 290 H164Z', fill='G')
    s.path('M190 170 L206 266 M256 170 V266 M322 170 L306 266 M376 170 L356 266', role='deco', stroke='#FFFFFF', stroke_width=10, opacity='.6')
    s.circle(200, 404, 36, fill='D')
    s.circle(370, 404, 36, fill='D')
    s.circle(200, 404, 10, role='deco', fill='#FFFFFF', stroke='none')
    s.circle(370, 404, 10, role='deco', fill='#FFFFFF', stroke='none')


@st(F, 'loupe', 'Loupe')
def _(s):
    s.tube('M330 330 L440 440', 'P', 46)
    s.circle(220, 220, 150, fill='D')
    s.circle(220, 220, 112, role='deco', fill='K', stroke=INK, stroke_width=SW)
    s.hl('M140 210 Q144 148 206 134 Q164 166 164 214Z', opacity='.8')


@st(F, 'lien', 'Lien')
def _(s):
    s.tube('M232 150 L292 90 C330 52 392 52 430 90 C468 128 468 190 430 228 L364 294', 'G', 44,
           transform='translate(-20 20)')
    s.tube('M280 362 L220 422 C182 460 120 460 82 422 C44 384 44 322 82 284 L148 218', 'P', 44,
           transform='translate(20 -20)')
    s.tube('M200 312 L312 200', 'L', 30)


@st(F, 'telephone', 'Téléphone intelligent')
def _(s):
    s.rect(132, 46, 248, 420, 46, fill='D')
    s.rect(156, 92, 200, 316, 18, role='deco', fill='S', stroke=INK, stroke_width=11)
    s.rect(226, 64, 60, 12, 6, role='deco', fill='#FFFFFF', opacity='.5', stroke='none')
    s.circle(256, 438, 14, role='deco', fill='#FFFFFF', opacity='.6', stroke='none')
    for i, (x, y) in enumerate(((198, 138), (256, 138), (314, 138), (198, 196), (256, 196), (314, 196))):
        s.rect(x - 20, y - 20, 40, 40, 11, role='deco', fill='#FFFFFF', opacity='.8', stroke='none')
    s.hl('M166 110 L210 110 L166 300Z', opacity='.25')


@st(F, 'bouclier', 'Bouclier de sécurité')
def _(s):
    s.path('M256 50 C320 90 376 102 430 102 C430 300 370 404 256 466 C142 404 82 300 82 102 C136 102 192 90 256 50Z', fill='S')
    s.path('M256 50 V466 C142 404 82 300 82 102 C136 102 192 90 256 50Z', role='hl', opacity='.18')
    s.path('M178 262 L236 318 L340 206', role='deco', stroke='#FFFFFF', stroke_width=38)


@st(F, 'ordinateur', 'Ordinateur portable')
def _(s):
    s.rect(96, 82, 320, 232, 26, fill='D')
    s.rect(120, 106, 272, 184, 10, role='deco', fill='S', stroke=INK, stroke_width=10)
    s.path('M150 250 L200 200 L240 230 L300 160 L360 200', role='deco', stroke='#FFFFFF', stroke_width=14)
    s.path('M50 330 H462 L440 396 Q434 412 416 412 H96 Q78 412 72 396Z', fill='L')
    s.rect(216, 330, 80, 22, 10, role='deco', fill=INK, opacity='.35', stroke='none')


@st(F, 'graphique_hausse', 'Graphique en hausse')
def _(s):
    s.rect(60, 70, 392, 380, 44, fill='W')
    for i, (h, c) in enumerate(((90, 'K'), (150, 'P'), (210, 'G'))):
        x = 110 + i * 100
        s.rect(x, 400 - h, 64, h, 12, role='deco', fill=c, stroke=INK, stroke_width=11)
    s.path('M100 290 L200 220 L270 250 L400 130', role='deco', stroke=INK, stroke_width=30)
    s.path('M100 290 L200 220 L270 250 L400 130', role='deco', stroke='O', stroke_width=14)
    s.path('M340 126 L410 118 L404 186Z', role='deco', fill='O', stroke=INK, stroke_width=11)


@st(F, 'globe', 'Globe')
def _(s):
    s.circle(256, 256, 196, fill='K')
    s.path('M150 120 C190 140 230 120 260 150 C280 170 250 200 220 196 C190 192 176 230 140 230 C110 230 90 200 82 180 '
           'C100 150 120 130 150 120Z', role='deco', fill='G', stroke=INK, stroke_width=11)
    s.path('M300 250 C340 236 380 260 400 300 C410 340 380 380 340 400 C320 380 330 340 300 320 C280 300 280 260 300 250Z',
           role='deco', fill='G', stroke=INK, stroke_width=11)
    s.path('M170 340 C200 330 230 350 226 380 C220 410 190 420 170 400Z', role='deco', fill='G', stroke=INK, stroke_width=11)
    s.hl('M100 250 Q110 120 240 86 Q140 150 130 260Z', opacity='.4')
    s.circle(256, 256, 196, role='deco', fill='none', stroke=INK, stroke_width=SW)


@st(F, 'calendrier', 'Calendrier')
def _(s):
    s.rect(66, 96, 380, 360, 44, fill='W')
    s.path('M66 196 V140 Q66 96 110 96 H402 Q446 96 446 140 V196Z', role='deco', fill='C', stroke=INK, stroke_width=SW)
    for x in (160, 352):
        s.tube(f'M{x} 60 V130', 'L', 26)
    for r in range(3):
        for c in range(4):
            x, y = 118 + c * 78, 240 + r * 66
            hit = (r, c) == (1, 2)
            s.rect(x, y, 50, 42, 10, role='deco', fill='P' if hit else '#D7DEEB', stroke=INK if hit else 'none', stroke_width=10)
    s.path('M286 330 L300 344 L326 316', role='deco', stroke='#FFFFFF', stroke_width=10)


@st(F, 'eclair', 'Éclair')
def _(s):
    s.path('M300 40 L100 290 H240 L196 472 L412 200 H272Z', fill='Y', stroke_width=16)
    s.hl('M286 82 L148 266 H192Z', opacity='.6')


@st(F, 'courriel', 'Courriel')
def _(s):
    s.rect(56, 116, 400, 290, 40, fill='W')
    s.path('M70 140 L256 286 L442 140', role='deco', stroke=INK, stroke_width=SW)
    s.path('M70 392 L210 252 M442 392 L302 252', role='deco', stroke='L', stroke_width=12)
    s.circle(418, 132, 52, fill='C')
    s.text('1', 418, 156, 64, fill='#FFFFFF')


@st(F, 'cadenas', 'Cadenas')
def _(s):
    s.tube('M164 232 V170 C164 104 206 66 256 66 C306 66 348 104 348 170 V232', 'L', 34)
    s.rect(110, 226, 292, 230, 36, fill='P')
    s.hl('M134 252 H174 V430 H150 Q134 430 134 410Z', opacity='.35')
    s.circle(256, 322, 30, role='deco', fill=INK, stroke='none')
    s.path('M246 330 H266 L272 392 H240Z', role='deco', fill=INK, stroke='none')


@st(F, 'billet', 'Billet de banque')
def _(s):
    s.rect(80, 166, 372, 220, 26, fill='G', transform='rotate(-10 266 276)')
    s.rect(60, 140, 372, 220, 26, fill='G')
    s.rect(84, 164, 324, 172, 16, role='deco', fill='none', stroke=INK, stroke_width=8, opacity='.5')
    s.circle(246, 250, 64, role='deco', fill='#E8FFF2', stroke=INK, stroke_width=11)
    s.text('$', 246, 282, 96, fill=INK)
    s.circle(120, 200, 14, role='deco', fill='#FFFFFF', opacity='.6', stroke='none')
    s.circle(372, 300, 14, role='deco', fill='#FFFFFF', opacity='.6', stroke='none')


@st(F, 'nuage_televersement', 'Téléversement')
def _(s):
    s.path('M140 400 C80 400 46 354 46 306 C46 252 88 214 140 214 C150 140 210 92 280 92 C356 92 410 146 418 214 '
           'C436 212 466 236 466 306 C466 360 428 400 376 400Z', fill='K')
    s.hl('M92 286 Q100 240 150 232 Q120 258 116 296Z', opacity='.6')
    s.path('M256 356 V214 M196 268 L256 206 L316 268', role='deco', stroke=INK, stroke_width=46)
    s.path('M256 356 V214 M196 268 L256 206 L316 268', role='deco', stroke='#FFFFFF', stroke_width=24)
