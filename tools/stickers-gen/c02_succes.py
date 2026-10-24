from nx import *
from reg import st

F = '02_Succes'


@st(F, 'trophee', 'Trophée')
def _(s):
    s.tube('M150 120 H96 C86 206 122 246 176 262', 'Y', 18)
    s.tube('M362 120 H416 C426 206 390 246 336 262', 'Y', 18)
    s.path('M218 330 H294 L302 392 H210Z', fill='Y')
    s.rect(160, 388, 192, 66, 16, fill='P')
    s.path('M140 92 H372 V176 C372 260 320 320 256 320 C192 320 140 260 140 176Z', fill='Y')
    s.hl('M168 112 H200 V190 C200 240 214 270 236 290 C190 280 168 230 168 190Z', opacity='.55')
    s.path(star_d(256, 196, 50, 22), role='deco', fill='#FFF3C4', stroke=INK, stroke_width=10)
    s.rect(206, 410, 100, 22, 8, role='deco', fill='#FFFFFF', opacity='.75', stroke='none')


@st(F, 'fusee', 'Fusée')
def _(s):
    s.path('M150 330 L96 340 L70 400 L150 380Z', fill='P')
    s.path('M182 362 L172 416 L112 442 L132 362Z', fill='P')
    s.path('M162 358 C140 398 132 432 110 452 C150 446 186 420 196 386Z', fill='O')
    s.path('M150 352 C170 220 260 110 432 80 C406 252 300 342 160 362Z', fill='W')
    s.path('M432 80 C424 128 410 160 392 186 L326 120 C352 102 388 88 432 80Z', role='deco', fill='C', stroke=INK, stroke_width=12)
    s.circle(298, 214, 40, role='deco', fill='K', stroke=INK, stroke_width=13)
    s.hl('M282 196 Q294 184 310 186 Q294 194 290 210Z', opacity='.9')


@st(F, 'confettis', 'Confettis')
def _(s):
    s.path('M96 440 L172 214 L298 340Z', fill='S')
    s.path('M120 370 L150 280 M150 410 L198 268 M210 410 L246 330', role='deco', stroke='#FFFFFF', stroke_width=12, opacity='.55')
    for x, y, c, r in ((248, 116, 'Y', 20), (360, 100, 'C', 16), (420, 210, 'G', 18), (300, 200, 'K', 14), (430, 330, 'P', 18)):
        s.circle(x, y, r, fill=c, stroke_width=10)
    s.path('M200 120 q20 -30 40 0 t40 0', stroke='P', stroke_width=16)
    s.path('M340 250 q20 -30 40 0 t40 0', stroke='G', stroke_width=16)
    s.path(sparkle_d(396, 420, 32), fill='Y', stroke_width=10)


@st(F, 'coche', 'Coche')
def _(s):
    s.circle(256, 256, 196, fill='G')
    s.hl('M110 200 Q130 100 236 82 Q150 124 140 210Z', opacity='.5')
    s.path('M162 262 L230 330 L358 196', role='deco', stroke='#FFFFFF', stroke_width=46)


@st(F, 'couronne', 'Couronne')
def _(s):
    s.path('M86 370 L66 156 L178 250 L256 110 L334 250 L446 156 L426 370Z', fill='Y')
    s.rect(86, 362, 340, 74, 20, fill='Y')
    s.hl('M100 200 L170 262 L118 346Z', opacity='.4')
    s.circle(256, 400, 20, role='deco', fill='P', stroke=INK, stroke_width=10)
    s.circle(170, 400, 15, role='deco', fill='G', stroke=INK, stroke_width=10)
    s.circle(342, 400, 15, role='deco', fill='C', stroke=INK, stroke_width=10)
    for x, y in ((66, 156), (256, 110), (446, 156)):
        s.circle(x, y, 24, fill='P')


@st(F, 'etoile', 'Étoile')
def _(s):
    s.path(star_d(256, 270, 214, 98), fill='Y', stroke_width=16)
    s.hl('M256 92 L222 196 L116 200 L216 210Z', opacity='.6')
    eye(s, 216, 270, 16); eye(s, 296, 270, 16)
    s.path('M226 320 Q256 346 286 320', role='deco', stroke=INK, stroke_width=13, fill='none')


@st(F, 'cible', 'Cible')
def _(s):
    s.circle(236, 276, 190, fill='W')
    s.circle(236, 276, 132, role='deco', fill='C', stroke=INK, stroke_width=12)
    s.circle(236, 276, 78, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)
    s.circle(236, 276, 30, role='deco', fill='C', stroke=INK, stroke_width=12)
    s.path('M236 276 L410 102', stroke_width=16)
    s.path('M410 102 L404 50 L452 62 L462 110 L414 104Z', fill='P', stroke_width=12)


@st(F, 'medaille', 'Médaille')
def _(s):
    s.path('M150 60 H226 L292 220 H216Z', fill='P')
    s.path('M362 60 H286 L220 220 H296Z', fill='G')
    s.circle(256, 330, 134, fill='Y')
    s.circle(256, 330, 96, role='deco', fill='none', stroke=INK, stroke_width=10, stroke_dasharray='4 22')
    s.path(star_d(256, 334, 64, 28), role='deco', fill='#FFF3C4', stroke=INK, stroke_width=11)
    s.hl('M156 290 Q176 220 240 204 Q186 240 178 300Z')


@st(F, 'podium', 'Podium')
def _(s):
    s.rect(186, 210, 140, 236, 12, fill='Y')
    s.rect(60, 290, 132, 156, 12, fill='L')
    s.rect(320, 330, 132, 116, 12, fill='O')
    s.text('1', 256, 340, 110, fill=INK)
    s.text('2', 126, 400, 88, fill=INK)
    s.text('3', 386, 420, 76, fill=INK)
    s.path(star_d(256, 120, 70, 30), fill='S')


@st(F, 'drapeau', "Drapeau d'arrivée")
def _(s):
    wave = 'M120 92 C200 52 270 132 400 92 V276 C270 316 200 236 120 276Z'
    s.path(wave, fill='W')
    cells = []
    for r in range(5):
        for c in range(6):
            if (r + c) % 2 == 0:
                x, y = 120 + c * 46.7, 52 + r * 50
                cells.append(f'M{x:.1f} {y:.1f} h46.7 v50 h-46.7Z')
    s.path(' '.join(cells), role='deco', fill=INK, stroke='none', clip_path=s.clip('flag', wave))
    s.path(wave, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.tube('M120 72 V456', 'T', 16)
    s.circle(120, 64, 22, fill='G')


@st(F, 'badge_verifie', 'Badge vérifié')
def _(s):
    s.path(burst_d(256, 256, 206, 176, 16), fill='S', stroke_width=16)
    s.circle(256, 256, 130, role='deco', fill='none', stroke='#FFFFFF', stroke_width=8, opacity='.6')
    s.path('M180 258 L236 312 L340 202', role='deco', stroke='#FFFFFF', stroke_width=42)


@st(F, 'cadenas_ouvert', 'Cadenas déverrouillé')
def _(s):
    s.tube('M166 230 V160 C166 96 210 60 262 60 C314 60 352 96 356 150', 'L', 34)
    s.rect(110, 226, 292, 230, 36, fill='G')
    s.hl('M134 252 H174 V430 H150 Q134 430 134 410Z', opacity='.4')
    s.circle(256, 322, 30, role='deco', fill=INK, stroke='none')
    s.path('M246 330 H266 L272 392 H240Z', role='deco', fill=INK, stroke='none')
    s.path(sparkle_d(410, 120, 36), fill='Y', stroke_width=10)
