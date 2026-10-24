from nx import *
from reg import st

F = '01_Reactions'


@st(F, 'coeur', 'Cœur')
def _(s):
    s.path(heart_d(256, 262, 190), fill='S')
    s.hl('M128 170 Q150 112 214 118 Q160 140 146 196 Q132 196 128 170Z')
    s.path(sparkle_d(380, 150, 26), role='deco', fill='#FFFFFF', stroke='none')


@st(F, 'sourire', 'Sourire')
def _(s):
    face(s)
    eye(s, 196, 222); eye(s, 316, 222)
    cheeks(s, dy=48)
    s.path('M176 300 Q256 380 336 300', role='deco', stroke=INK, stroke_width=16, fill='none')


@st(F, 'clin_oeil', "Clin d'œil")
def _(s):
    face(s)
    eye(s, 196, 222)
    s.path('M290 226 Q316 204 342 226', role='deco', stroke=INK, stroke_width=15, fill='none')
    cheeks(s, dy=48)
    s.path('M180 304 Q262 372 334 296', role='deco', stroke=INK, stroke_width=16, fill='none')
    s.path('M300 330 Q318 372 290 384 Q262 380 270 346Z', role='deco', fill='C', stroke=INK, stroke_width=10)


@st(F, 'surprise', 'Surprise')
def _(s):
    face(s)
    s.path('M164 172 Q190 152 222 164', role='deco', stroke=INK, stroke_width=12, fill='none')
    s.path('M290 164 Q322 152 348 172', role='deco', stroke=INK, stroke_width=12, fill='none')
    eye(s, 196, 226, 19); eye(s, 316, 226, 19)
    s.ellipse(256, 330, 36, 46, role='deco', fill='#3B1D2E', stroke=INK, stroke_width=12)
    s.ellipse(256, 350, 20, 14, role='deco', fill='C', stroke='none')


@st(F, 'rire', 'Rire aux larmes')
def _(s):
    face(s)
    s.path('M168 222 L216 206 L168 190', role='deco', stroke=INK, stroke_width=15, fill='none')
    s.path('M344 222 L296 206 L344 190', role='deco', stroke=INK, stroke_width=15, fill='none')
    s.path('M160 278 Q256 290 352 278 Q340 384 256 384 Q172 384 160 278Z', role='deco', fill='#3B1D2E', stroke=INK, stroke_width=13)
    s.path('M176 284 Q256 296 336 284 L330 306 Q256 314 182 306Z', role='deco', fill='#FFFFFF', stroke='none')
    s.path('M206 360 Q256 330 306 360 Q282 380 256 380 Q230 380 206 360Z', role='deco', fill='C', stroke='none')
    for sx in (-1, 1):
        x = 256 + sx * 178
        s.path(f'M{x} 220 Q{x+sx*30} 262 {x+sx*14} 286 Q{x-sx*6} 302 {x-sx*16} 282 Q{x-sx*24} 260 {x} 220Z', fill='K', stroke_width=11)


@st(F, 'yeux_coeur', 'Yeux en cœur')
def _(s):
    face(s)
    s.path(heart_d(196, 222, 40), role='deco', fill='C', stroke=INK, stroke_width=11)
    s.path(heart_d(316, 222, 40), role='deco', fill='C', stroke=INK, stroke_width=11)
    s.hl('M168 206 Q172 192 186 192 Q176 200 176 212Z', opacity='.8')
    s.hl('M288 206 Q292 192 306 192 Q296 200 296 212Z', opacity='.8')
    s.path('M184 300 Q256 370 328 300 Z', role='deco', fill='#3B1D2E', stroke=INK, stroke_width=13)


@st(F, 'cool', 'Cool')
def _(s):
    face(s)
    s.path('M120 206 H392 L380 222 Q372 288 318 288 Q270 288 262 236 H250 Q242 288 194 288 Q140 288 132 222Z',
           role='deco', fill='D', stroke=INK, stroke_width=12)
    s.hl('M162 220 L196 220 L168 262 Q156 252 158 236Z', opacity='.35')
    s.hl('M284 220 L318 220 L290 262 Q278 252 280 236Z', opacity='.35')
    s.path('M196 334 Q262 370 322 320', role='deco', stroke=INK, stroke_width=16, fill='none')


@st(F, 'bisou', 'Bisou')
def _(s):
    face(s)
    s.path('M170 226 Q196 204 222 226', role='deco', stroke=INK, stroke_width=15, fill='none')
    s.path('M290 226 Q316 204 342 226', role='deco', stroke=INK, stroke_width=15, fill='none')
    cheeks(s, dy=40)
    s.path('M246 296 Q286 300 270 324 Q292 344 248 352', role='deco', stroke=INK, stroke_width=15, fill='none')
    s.path(heart_d(388, 330, 40), fill='C', stroke_width=12)


@st(F, 'feu', 'Feu')
def _(s):
    s.path('M256 470 C150 470 96 400 96 316 C96 230 160 190 172 110 C214 150 222 196 214 236 '
           'C244 216 262 160 248 56 C340 110 416 210 416 318 C416 404 356 470 256 470Z', fill='O')
    s.path('M256 448 C200 448 170 410 170 360 C170 310 210 290 222 250 C246 276 246 300 240 318 '
           'C268 306 290 278 288 240 C330 276 344 326 344 362 C344 410 312 448 256 448Z',
           role='deco', fill='Y', stroke=INK, stroke_width=11)
    s.path('M256 432 C228 432 212 412 212 388 C212 360 238 348 256 324 C276 350 300 362 300 390 C300 414 284 432 256 432Z',
           role='deco', fill='#FFF6D6', stroke='none')
    s.hl('M140 300 Q150 240 196 210 Q170 260 168 318Z', opacity='.4')


@st(F, 'pouce_leve', 'Pouce levé')
def _(s):
    s.rect(70, 236, 86, 214, 26, fill='P')
    s.path('M156 256 C200 238 232 200 246 150 C254 112 264 72 300 74 C336 76 340 120 330 164 L322 204 '
           'H404 C436 204 456 232 448 262 L414 410 C406 436 386 450 360 450 H156Z', fill='Y')
    for y in (262, 316, 370):
        s.path(f'M{452 - (y-262)*0.12:g} {y} H{392 - (y-262)*0.08:g}', role='deco', stroke=INK, stroke_width=11)
    s.hl('M276 96 Q300 88 312 110 Q292 108 284 140 Q270 120 276 96Z', opacity='.7')
    s.circle(113, 410, 12, role='deco', fill='#FFFFFF', stroke='none', opacity='.8')


HAND = ('M60 300 C34 280 30 240 34 200 L8 140 A18 18 0 0 1 40 124 L66 170 L60 66 A18 18 0 0 1 96 64 L100 150 '
        'L100 44 A18 18 0 0 1 136 44 L138 150 L142 60 A18 18 0 0 1 178 64 L174 160 L182 96 A16 16 0 0 1 214 102 '
        'L204 220 C200 270 180 300 150 306 Z')


@st(F, 'applaudissements', 'Applaudissements')
def _(s):
    s.path(HAND, fill='O', transform='translate(452 150) scale(-1.05 1.05) rotate(-12)')
    s.path(HAND, fill='Y', transform='translate(60 150) scale(1.05) rotate(-12)')
    s.hl('M0 0 Q6 -40 16 -70 Q22 -30 14 6Z', transform='translate(110 290)', opacity='.6')
    s.path('M150 116 l-18 -42 M256 100 v-50 M362 116 l18 -42', role='deco', stroke='P', stroke_width=15)
    s.path('M96 176 l-38 -16 M416 176 l38 -16', role='deco', stroke='G', stroke_width=15)


@st(F, 'etincelles', 'Étincelles')
def _(s):
    s.path(sparkle_d(222, 280, 170, .24), fill='S')
    s.path(sparkle_d(390, 130, 70, .26), fill='Y')
    s.path(sparkle_d(400, 380, 46, .28), fill='P')
    s.hl('M222 140 Q236 230 300 268 Q234 246 222 140Z', opacity='.6')
