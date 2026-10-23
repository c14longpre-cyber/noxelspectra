from nx import *
from reg import st

F = '06_Etiquettes'
NB = ' '


def fit(s, txt, cx, base, maxw, size, fill=INK):
    _, w = text_path(txt, 0, 0, size)
    if w > maxw:
        size = size * maxw / w
    s.text(txt, cx, base, size, fill=fill)
    return size


def pill(s, fill, y=168, h=176, x=40, w=432):
    s.rect(x, y, w, h, h / 2, fill=fill)
    s.hl(f'M{x+40} {y+28} H{x+w-60} Q{x+w-40} {y+28} {x+w-44} {y+48} H{x+30} Q{x+26} {y+30} {x+40} {y+28}Z', opacity='.4')


@st(F, 'nouveau', 'Nouveau')
def _(s):
    pill(s, 'S')
    fit(s, 'NOUVEAU', 256, 284, 330, 92, '#FFFFFF')
    s.path(sparkle_d(440, 160, 44), fill='Y', stroke_width=11)


@st(F, 'gratuit', 'Gratuit')
def _(s):
    s.path('M150 140 H430 Q462 140 462 172 V340 Q462 372 430 372 H150 L50 256Z', fill='G')
    s.circle(126, 256, 20, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=11)
    fit(s, 'GRATUIT', 312, 286, 240, 88)


@st(F, 'promo', 'Promo')
def _(s):
    s.path(burst_d(256, 256, 218, 180, 18), fill='C', stroke_width=15)
    fit(s, 'PROMO', 256, 288, 300, 96, '#FFFFFF')
    s.path(sparkle_d(130, 140, 28), role='deco', fill='#FFFFFF', stroke='none', opacity='.8')


@st(F, 'solde', 'Solde')
def _(s):
    s.path(burst_d(256, 256, 218, 184, 18), fill='Y', stroke_width=15)
    fit(s, '−50' + NB + '%', 256, 280, 300, 120)
    fit(s, 'SOLDE', 256, 352, 160, 52)


@st(F, 'avant', 'Avant')
def _(s):
    pill(s, 'L')
    fit(s, 'AVANT', 256, 284, 300, 96)


@st(F, 'apres', 'Après')
def _(s):
    pill(s, 'G')
    fit(s, 'APRÈS', 236, 284, 280, 96)
    s.path(sparkle_d(416, 220, 30), role='deco', fill='#FFFFFF', stroke='none')
    s.path(sparkle_d(400, 300, 18), role='deco', fill='#FFFFFF', stroke='none')


@st(F, 'a_decouvrir', 'À découvrir')
def _(s):
    s.path('M40 200 L108 200 L108 340 L40 340 L74 270Z', fill='D', transform='translate(0 30)')
    s.path('M472 200 L404 200 L404 340 L472 340 L438 270Z', fill='D', transform='translate(0 30)')
    s.path('M86 160 H426 V340 H86Z', fill='P')
    s.hl('M110 184 H400 V210 H110Z', opacity='.3')
    fit(s, 'À' + NB + 'DÉCOUVRIR', 256, 282, 300, 70, '#FFFFFF')


@st(F, 'top_choix', 'Top choix')
def _(s):
    s.path('M180 300 L130 470 L196 436 L230 490 L270 330Z', fill='P')
    s.path('M332 300 L382 470 L316 436 L282 490 L242 330Z', fill='G')
    s.path(burst_d(256, 224, 186, 162, 20), fill='Y', stroke_width=15)
    s.circle(256, 224, 134, role='deco', fill='none', stroke=INK, stroke_width=8, stroke_dasharray='2 18')
    fit(s, 'TOP', 256, 232, 180, 100)
    fit(s, 'CHOIX', 256, 290, 170, 50)


@st(F, 'cent_pour_cent', '100 %')
def _(s):
    s.circle(256, 256, 200, fill='S')
    s.circle(256, 256, 160, role='deco', fill='none', stroke='#FFFFFF', stroke_width=10, opacity='.6')
    fit(s, '100' + NB + '%', 256, 296, 280, 120, '#FFFFFF')
    s.hl('M110 200 Q130 110 230 86 Q150 130 140 210Z', opacity='.5')


@st(F, 'exclusif', 'Exclusif')
def _(s):
    s.path('M256 60 L430 160 V352 L256 452 L82 352 V160Z', fill='D')
    s.path('M256 96 L400 178 V334 L256 416 L112 334 V178Z', role='deco', fill='none', stroke='Y', stroke_width=8)
    s.path(star_d(256, 196, 44, 20), role='deco', fill='Y', stroke='none')
    fit(s, 'EXCLUSIF', 256, 318, 250, 64, '#FFFFFF')


@st(F, 'bientot', 'Bientôt')
def _(s):
    s.rect(40, 170, 432, 172, 46, fill='K')
    s.circle(116, 256, 48, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)
    s.path('M116 226 V258 L138 270', role='deco', stroke=INK, stroke_width=11)
    fit(s, 'BIENTÔT', 312, 286, 230, 84)


@st(F, 'merci', 'Merci')
def _(s):
    s.path('M60 230 C60 140 150 90 256 90 C362 90 452 140 452 230 C452 320 362 370 256 370 C230 370 206 368 184 362 '
           'L96 420 L118 330 C80 306 60 270 60 230Z', fill='R')
    fit(s, 'MERCI' + NB + '!', 256, 266, 320, 100, '#FFFFFF')
    s.path(heart_d(408, 112, 34), fill='C', stroke_width=11)


@st(F, 'wow', 'Wow')
def _(s):
    s.path(burst_d(256, 256, 220, 150, 11, -80), fill='Y', stroke_width=15)
    fit(s, 'WOW' + NB + '!', 256, 290, 260, 104, INK)


@st(F, 'en_direct', 'En direct')
def _(s):
    pill(s, 'C')
    s.circle(106, 256, 24, role='deco', fill='#FFFFFF', stroke='none')
    s.circle(106, 256, 40, role='deco', fill='none', stroke='#FFFFFF', stroke_width=7, opacity='.6')
    fit(s, 'EN' + NB + 'DIRECT', 302, 284, 228, 80, '#FFFFFF')


@st(F, 'bravo', 'Bravo')
def _(s):
    s.path('M40 200 L108 200 L108 340 L40 340 L74 270Z', fill='D', transform='translate(0 30)')
    s.path('M472 200 L404 200 L404 340 L472 340 L438 270Z', fill='D', transform='translate(0 30)')
    s.path('M86 160 Q256 120 426 160 V340 Q256 300 86 340Z', fill='G')
    fit(s, 'BRAVO' + NB + '!', 256, 278, 290, 92)
    s.path(sparkle_d(120, 90, 30), fill='Y', stroke_width=10)
    s.path(sparkle_d(400, 92, 24), fill='P', stroke_width=9)
