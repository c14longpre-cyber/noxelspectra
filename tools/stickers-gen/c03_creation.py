from nx import *
from reg import st

F = '03_Creation'


@st(F, 'baguette_magique', 'Baguette magique')
def _(s):
    s.tube('M96 432 L300 228', 'D', 32)
    s.path('M246 282 L300 228', role='deco', stroke='#FFFFFF', stroke_width=32)
    s.path(star_d(340, 180, 108, 46, rot=-80), fill='Y')
    s.hl('M330 92 L312 160 L250 166 L318 172Z', opacity='.7')
    s.path(sparkle_d(170, 150, 34), fill='P', stroke_width=10)
    s.path(sparkle_d(440, 356, 28), fill='G', stroke_width=10)
    s.circle(452, 110, 12, fill='K', stroke_width=9)


@st(F, 'note_musique', 'Note de musique')
def _(s):
    s.path('M196 382 V120 L414 74 V330', stroke_width=30)
    s.path('M196 120 L414 74 V140 L196 186Z', fill='P')
    s.ellipse(150, 384, 72, 56, fill='S', transform='rotate(-18 150 384)')
    s.ellipse(368, 332, 72, 56, fill='S', transform='rotate(-18 368 332)')
    s.hl('M110 370 Q120 342 150 336 Q130 354 128 374Z', opacity='.7')
    s.hl('M328 318 Q338 290 368 284 Q348 302 346 322Z', opacity='.7')


@st(F, 'palette', 'Palette de couleurs')
def _(s):
    s.path('M256 64 C390 64 466 150 466 250 C466 320 420 350 370 340 C320 330 300 360 316 400 '
           'C334 446 300 460 252 460 C140 460 50 380 50 262 C50 150 140 64 256 64Z', fill='M')
    s.circle(182, 168, 34, role='deco', fill='C', stroke=INK, stroke_width=11)
    s.circle(290, 140, 34, role='deco', fill='Y', stroke=INK, stroke_width=11)
    s.circle(384, 210, 34, role='deco', fill='G', stroke=INK, stroke_width=11)
    s.circle(140, 286, 34, role='deco', fill='P', stroke=INK, stroke_width=11)
    s.circle(210, 384, 34, role='deco', fill='K', stroke=INK, stroke_width=11)
    s.ellipse(330, 296, 30, 24, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=11)


@st(F, 'pinceau', 'Pinceau')
def _(s):
    s.path('M420 70 C446 84 448 108 432 128 L292 300 L246 262 L376 84 C390 66 404 62 420 70Z', fill='T')
    s.path('M292 300 L246 262 L222 286 L270 328Z', fill='L')
    s.path('M222 286 L270 328 C262 380 220 440 120 452 C112 440 120 420 132 410 C170 380 170 330 222 286Z', fill='P')
    s.path('M140 446 C190 436 226 404 244 364', role='deco', stroke='#FFFFFF', stroke_width=10, opacity='.5')
    s.hl('M410 84 Q426 86 428 100 L320 236 L306 224Z', opacity='.45')


@st(F, 'ampoule', 'Ampoule')
def _(s):
    s.path('M256 50 C350 50 408 120 408 200 C408 260 370 290 346 326 C334 344 330 360 330 376 H182 '
           'C182 360 178 344 166 326 C142 290 104 260 104 200 C104 120 162 50 256 50Z', fill='Y')
    s.rect(182, 372, 148, 40, 14, fill='L')
    s.rect(194, 408, 124, 34, 14, fill='L')
    s.path('M222 440 H290 C290 462 276 474 256 474 C236 474 222 462 222 440Z', fill='D')
    s.path('M216 292 C216 240 240 220 256 220 C272 220 296 240 296 292 M232 360 V300 M280 360 V300', role='deco', stroke='O', stroke_width=12)
    s.hl('M146 182 Q150 106 236 84 Q172 128 172 196Z')
    for a in (-170, -138, -42, -10):
        x1, y1 = arc_pt(256, 200, 172, a); x2, y2 = arc_pt(256, 200, 204, a)
        s.line(round(x1), round(y1), round(x2), round(y2), stroke='O', stroke_width=16, role='deco')


@st(F, 'bulle_dialogue', 'Bulle de dialogue')
def _(s):
    s.path(rr_d(56, 80, 400, 270, 70)[:-1] + 'Z', fill='S')
    s.path('M150 340 L120 450 L240 346Z', fill='S')
    s.path('M140 338 L250 338', role='deco', stroke='#5BB8E0', stroke_width=18)
    s.circle(170, 216, 24, role='deco', fill='#FFFFFF', stroke='none')
    s.circle(256, 216, 24, role='deco', fill='#FFFFFF', stroke='none')
    s.circle(342, 216, 24, role='deco', fill='#FFFFFF', stroke='none')
    s.hl('M96 160 Q104 112 160 104 Q122 130 118 168Z', opacity='.6')


@st(F, 'appareil_photo', 'Appareil photo instantané')
def _(s):
    s.rect(60, 120, 392, 300, 52, fill='W')
    s.path('M60 300 H452 V368 Q452 420 400 420 H112 Q60 420 60 368Z', role='deco', fill='S', stroke='none')
    s.rect(60, 120, 392, 300, 52, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.circle(256, 270, 98, fill='D')
    s.circle(256, 270, 56, role='deco', fill='K', stroke=INK, stroke_width=12)
    s.hl('M226 246 Q236 224 262 222 Q242 236 240 256Z', opacity='.9')
    s.rect(96, 152, 64, 40, 12, role='deco', fill='Y', stroke=INK, stroke_width=11)
    s.circle(392, 172, 18, role='deco', fill='C', stroke=INK, stroke_width=11)


@st(F, 'crayon', 'Crayon')
def _(s):
    s.path('M380 60 L452 132 L190 394 L118 322Z', fill='Y')
    s.path('M380 60 L412 28 C428 12 452 12 468 28 L484 44 C500 60 500 84 484 100 L452 132Z', fill='R')
    s.path('M360 80 L432 152', role='deco', stroke=INK, stroke_width=SW)
    s.path('M370 70 L442 142', role='deco', stroke='L', stroke_width=18)
    s.path('M118 322 L190 394 L84 430 Q70 436 76 420Z', fill='M')
    s.path('M96 380 L130 414 L84 430 Q70 436 76 420Z', role='deco', fill=INK, stroke='none')
    s.path('M140 300 L340 100', role='deco', stroke='#FFFFFF', stroke_width=12, opacity='.5')


@st(F, 'pipette', 'Pipette')
def _(s):
    s.path('M330 70 C360 40 410 40 440 70 C470 100 470 150 440 180 L404 216 L294 106Z', fill='P')
    s.rect(270, 150, 92, 46, 18, fill='L', transform='rotate(45 316 173)')
    s.path('M300 200 L148 352 L126 418 L192 396 L344 244Z', fill='W')
    s.path('M246 290 L172 364 L160 400 L196 388 L270 314Z', role='deco', fill='G', stroke='none')
    s.path('M126 418 L94 450', stroke_width=16)
    s.path('M78 466 C70 450 86 432 94 450 C102 466 86 480 78 466Z', fill='G', stroke_width=10)
    s.hl('M350 80 Q376 62 404 68 Q370 82 362 104Z', opacity='.6')


@st(F, 'calques', 'Calques')
def _(s):
    s.path('M256 290 L466 356 L256 446 L46 356Z', fill='P')
    s.path('M256 210 L466 276 L256 366 L46 276Z', fill='K')
    s.path('M256 76 L466 172 L256 286 L46 172Z', fill='G')
    s.hl('M256 104 L404 172 L256 158 L108 172Z', opacity='.35')


@st(F, 'pot_peinture', 'Pot de peinture')
def _(s):
    s.path('M96 168 V396 C96 436 170 462 256 462 C342 462 416 436 416 396 V168', fill='L')
    s.ellipse(256, 168, 160, 52, fill='D')
    s.path('M110 170 C150 200 210 206 256 204 C300 204 366 200 402 170 C402 196 398 268 360 270 C330 272 340 216 300 216 '
           'C270 216 280 300 240 302 C200 304 220 220 180 220 C140 220 150 260 124 258 C100 254 106 210 110 170Z', fill='S', stroke_width=12)
    s.path('M96 196 C70 140 90 80 150 64', stroke_width=12)
    s.path('M416 196 C442 140 422 80 362 64 C300 46 200 46 150 64', stroke_width=12)
    s.hl('M120 300 Q118 360 140 410 Q150 350 146 296Z', opacity='.6')


@st(F, 'gomme', 'Gomme')
def _(s):
    s.path('M254 74 L438 258 L276 420 L92 236Z', fill='R')
    s.path('M184 144 L368 328 L276 420 L92 236Z', role='deco', fill='K', stroke=INK, stroke_width=SW)
    s.path('M254 74 L438 258 L276 420 L92 236Z', role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.hl('M254 102 L410 258 L392 276 L236 120Z', opacity='.45')
