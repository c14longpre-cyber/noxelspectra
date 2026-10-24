from nx import *
from reg import st

F = '05_Decoration'


@st(F, 'diamant', 'Diamant')
def _(s):
    s.path('M150 100 H362 L456 206 L256 446 L56 206Z', fill='K')
    s.path('M56 206 H456', role='deco', stroke=INK, stroke_width=12)
    s.path('M150 100 L200 206 L256 100 L312 206 L362 100 M200 206 L256 446 L312 206', role='deco', stroke=INK, stroke_width=10)
    s.path('M150 100 L200 206 H56Z', role='hl', opacity='.45')
    s.path('M256 100 L312 206 H200Z', role='hl', opacity='.3')
    s.path('M312 206 L256 446 L456 206Z', role='shade', opacity='.15')
    s.path(sparkle_d(410, 96, 34), fill='#FFFFFF', stroke_width=9)


@st(F, 'arc_en_ciel', 'Arc-en-ciel')
def _(s):
    for i, c in enumerate(('C', 'Y', 'G', 'K', 'P')):
        r = 200 - i * 34
        s.path(f'M{256-r} 360 A{r} {r} 0 0 1 {256+r} 360', role='body' if i == 0 else 'deco',
               stroke=INK, stroke_width=36 + SW)
        s.path(f'M{256-r} 360 A{r} {r} 0 0 1 {256+r} 360', role='deco', stroke=c, stroke_width=34, stroke_linecap='butt')
    for cx in (98, 414):
        s.path(f'M{cx-62} 410 C{cx-80} 410 {cx-82} 370 {cx-56} 364 C{cx-50} 330 {cx-10} 324 {cx} 340 '
               f'C{cx+20} 320 {cx+64} 334 {cx+60} 368 C{cx+86} 370 {cx+84} 410 {cx+62} 410Z', fill='W')


@st(F, 'feuille', 'Feuille')
def _(s):
    s.path('M90 440 C70 260 170 90 440 70 C450 330 300 450 90 440Z', fill='G')
    s.path('M90 440 C180 340 270 240 380 140', role='deco', stroke=INK, stroke_width=12)
    for a, b in (('M170 360 C160 300', '170 250'), ('M240 286 C240 230', '250 180'), ('M300 218 C310 180', '320 140')):
        pass
    s.path('M172 356 L150 270 M172 356 L260 360 M244 282 L230 200 M244 282 L330 286 M310 214 L304 150 M310 214 L380 216',
           role='deco', stroke=INK, stroke_width=9, opacity='.6')
    s.hl('M120 380 Q120 220 300 110 Q180 220 150 380Z', opacity='.35')


@st(F, 'soleil', 'Soleil')
def _(s):
    s.path(star_d(256, 256, 214, 150, 12), fill='O', stroke_width=14)
    s.circle(256, 256, 132, fill='Y')
    s.hl('M166 230 Q172 160 240 140 Q190 180 190 236Z', opacity='.7')
    eye(s, 214, 250, 15); eye(s, 298, 250, 15)
    s.path('M222 300 Q256 328 290 300', role='deco', stroke=INK, stroke_width=12)
    cheeks(s, 256, 256, 82, 34)


@st(F, 'fleur', 'Fleur')
def _(s):
    for k in range(6):
        a = k * 60 - 90
        x, y = arc_pt(256, 236, 106, a)
        s.ellipse(round(x), round(y), 78, 62, fill='R' if k % 2 == 0 else 'P', transform=f'rotate({a} {round(x)} {round(y)})')
    s.circle(256, 236, 72, fill='Y')
    s.hl('M214 220 Q218 184 250 176 Q228 196 228 224Z', opacity='.8')
    s.tube('M256 312 C256 360 250 410 240 466', 'G', 20)
    s.path('M248 410 C210 380 170 390 150 410 C180 432 220 432 248 410Z', fill='G', stroke_width=12)


@st(F, 'nuage', 'Nuage')
def _(s):
    s.path('M120 380 C64 380 40 336 40 296 C40 246 82 214 128 216 C134 150 190 104 254 104 C320 104 370 150 378 210 '
           'C432 206 472 246 472 296 C472 346 436 380 390 380Z', fill='W')
    s.shade('M60 330 C80 372 110 380 120 380 H390 C430 380 456 356 466 330 C430 352 120 356 60 330Z', opacity='.1')
    eye(s, 216, 266, 15); eye(s, 300, 266, 15)
    s.path('M236 306 Q258 326 280 306', role='deco', stroke=INK, stroke_width=11)
    cheeks(s, 258, 266, 92, 34)


@st(F, 'goutte', "Goutte d'eau")
def _(s):
    s.path('M256 40 C300 120 400 220 400 316 C400 402 334 462 256 462 C178 462 112 402 112 316 C112 220 212 120 256 40Z', fill='K')
    s.hl('M160 330 Q160 380 200 414 Q184 370 192 330Z', opacity='.8')
    s.hl('M200 230 Q220 190 250 150 Q236 200 222 236Z', opacity='.5')


@st(F, 'lune', 'Lune')
def _(s):
    s.path('M300 60 C190 70 100 160 100 276 C100 390 190 466 300 466 C360 466 410 442 444 404 '
           'C430 408 410 410 390 410 C280 410 196 330 196 222 C196 150 236 90 300 60Z', fill='Y')
    s.circle(186, 300, 22, role='deco', fill='#F2A93B', stroke='none', opacity='.6')
    s.circle(250, 400, 16, role='deco', fill='#F2A93B', stroke='none', opacity='.6')
    s.circle(150, 220, 12, role='deco', fill='#F2A93B', stroke='none', opacity='.6')
    s.path(sparkle_d(380, 150, 40), fill='P', stroke_width=10)
    s.path(sparkle_d(440, 270, 24), fill='K', stroke_width=9)


@st(F, 'flocon', 'Flocon')
def _(s):
    arms = []
    for k in range(6):
        a = k * 60 - 90
        x, y = arc_pt(256, 256, 190, a)
        bx, by = arc_pt(256, 256, 110, a)
        l1 = arc_pt(bx, by, 56, a - 135); l2 = arc_pt(bx, by, 56, a + 135)
        arms.append(f'M256 256 L{x:.0f} {y:.0f} M{l1[0]:.0f} {l1[1]:.0f} L{bx:.0f} {by:.0f} L{l2[0]:.0f} {l2[1]:.0f}')
    d = ' '.join(arms)
    s.path(d, stroke_width=34 + SW)
    s.path(d, role='deco', stroke='K', stroke_width=32)
    s.circle(256, 256, 44, fill='W', stroke_width=12)
    s.circle(256, 256, 14, role='deco', fill='K', stroke='none')


@st(F, 'papillon', 'Papillon')
def _(s):
    s.path('M248 240 C200 120 120 60 70 90 C30 116 50 220 120 250 C70 280 70 370 130 390 C180 406 230 340 248 290Z', fill='S')
    s.path('M264 240 C312 120 392 60 442 90 C482 116 462 220 392 250 C442 280 442 370 382 390 C332 406 282 340 264 290Z', fill='S')
    s.circle(140, 170, 24, role='deco', fill='#FFFFFF', opacity='.6', stroke='none')
    s.circle(372, 170, 24, role='deco', fill='#FFFFFF', opacity='.6', stroke='none')
    s.ellipse(256, 280, 24, 90, fill='D')
    s.path('M246 196 C230 150 210 130 190 126 M266 196 C282 150 302 130 322 126', stroke_width=11)


@st(F, 'etoile_filante', 'Étoile filante')
def _(s):
    s.path('M70 420 L270 240 L300 290 Z', fill='S2', stroke_width=12)
    s.path('M60 330 L230 214', stroke='P', stroke_width=16)
    s.path('M150 456 L292 312', stroke='G', stroke_width=16)
    s.path(star_d(330, 196, 134, 58, rot=-70), fill='Y', stroke_width=15)
    s.hl('M330 80 L300 166 L210 174 L304 180Z', opacity='.6')


@st(F, 'planete', 'Planète')
def _(s):
    rot = 'rotate(-18 256 270)'
    s.tube('M36 270 A220 64 0 0 1 476 270', 'Y', 24, transform=rot)
    s.circle(256, 256, 148, fill='P')
    s.path('M124 216 C200 246 320 232 394 198 M116 292 C210 320 330 300 398 266', role='deco', stroke='#FFFFFF', stroke_width=14, opacity='.35')
    s.hl('M150 220 Q160 150 236 126 Q180 170 176 230Z', opacity='.5')
    s.tube('M36 270 A220 64 0 0 0 476 270', 'Y', 24, transform=rot)
    s.circle(420, 90, 14, fill='K', stroke_width=10)
    s.path(sparkle_d(90, 120, 30), fill='G', stroke_width=9)


@st(F, 'bulles', 'Bulles')
def _(s):
    for cx, cy, r in ((200, 290, 150), (380, 170, 82), (390, 380, 56), (110, 110, 40)):
        s.circle(cx, cy, r, fill='K', fill_opacity='.45')
        s.path(f'M{cx-r*0.6:.0f} {cy-r*0.15:.0f} A{r*0.62:.0f} {r*0.62:.0f} 0 0 1 {cx-r*0.1:.0f} {cy-r*0.6:.0f}',
               role='deco', stroke='#FFFFFF', stroke_width=max(8, r * 0.12))
        s.circle(cx + r * 0.42, cy + r * 0.42, r * 0.1, role='deco', fill='#FFFFFF', stroke='none', opacity='.8')


@st(F, 'vague', 'Vague')
def _(s):
    s.path('M46 400 C46 250 140 120 290 110 C400 104 470 180 456 260 C446 316 380 330 350 290 '
           'C330 262 360 230 390 240 C380 200 330 184 296 200 C230 230 220 330 280 400Z', fill='K')
    s.hl('M100 330 Q130 200 260 150 Q170 220 140 330Z', opacity='.4')
    s.path('M300 220 C266 240 254 290 280 330', role='deco', stroke='#FFFFFF', stroke_width=14, opacity='.7')
