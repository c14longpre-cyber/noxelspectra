from nx import *
from reg import st

F = '09_Nature_Animaux'


def ears_cat(s, fill, inner):
    s.path('M110 220 L96 70 L210 140Z', fill=fill)
    s.path('M402 220 L416 70 L302 140Z', fill=fill)
    s.path('M124 176 L118 104 L178 144Z', role='deco', fill=inner, stroke='none')
    s.path('M388 176 L394 104 L334 144Z', role='deco', fill=inner, stroke='none')


@st(F, 'chat', 'Chat')
def _(s):
    ears_cat(s, 'L', 'R')
    s.ellipse(256, 280, 190, 160, fill='L')
    s.path('M180 150 Q190 190 200 150 M240 140 V184 M312 150 Q322 190 332 150', role='deco', stroke='#8E9BB2', stroke_width=12)
    eye(s, 190, 270, 22); eye(s, 322, 270, 22)
    s.path('M244 318 H268 L256 334Z', role='deco', fill='R', stroke=INK, stroke_width=8)
    s.path('M226 352 Q240 366 256 346 Q272 366 286 352', role='deco', stroke=INK, stroke_width=11)
    s.path('M60 300 L150 312 M66 350 L152 336 M452 300 L362 312 M446 350 L360 336', role='deco', stroke=INK, stroke_width=9)
    cheeks(s, 256, 280, 118, 56)


@st(F, 'chien', 'Chien')
def _(s):
    s.ellipse(256, 270, 170, 160, fill='O')
    s.path('M110 140 C60 140 40 220 60 300 C70 340 120 330 130 290 L150 180Z', fill='T')
    s.path('M402 140 C452 140 472 220 452 300 C442 340 392 330 382 290 L362 180Z', fill='T')
    s.ellipse(256, 340, 96, 74, role='deco', fill='M', stroke=INK, stroke_width=12)
    eye(s, 194, 252, 20); eye(s, 318, 252, 20)
    s.ellipse(256, 310, 34, 24, role='deco', fill=INK, stroke='none')
    s.path('M256 334 V352 M226 360 Q256 384 286 360', role='deco', stroke=INK, stroke_width=11)
    s.path('M242 372 Q256 420 270 372Z', role='deco', fill='C', stroke=INK, stroke_width=9)
    s.hl('M140 210 Q150 150 210 130 Q170 170 166 214Z', opacity='.4')


@st(F, 'patte', 'Patte')
def _(s):
    s.path('M256 250 C340 250 400 330 390 390 C382 440 330 440 300 424 C276 412 236 412 212 424 C182 440 130 440 122 390 '
           'C112 330 172 250 256 250Z', fill='P')
    for cx, cy, r in ((120, 230, 46), (196, 140, 50), (316, 140, 50), (392, 230, 46)):
        s.ellipse(cx, cy, r * 0.82, r, fill='P', transform=f'rotate({(cx-256)/8:.0f} {cx} {cy})')
    s.hl('M170 320 Q190 280 240 270 Q200 300 196 336Z', opacity='.5')


@st(F, 'montagne', 'Montagne')
def _(s):
    s.path('M30 440 L196 150 L270 260 L340 170 L482 440Z', fill='P')
    s.path('M196 150 L240 226 L214 214 L196 240 L176 214 L154 226Z', role='deco', fill='#FFFFFF', stroke=INK, stroke_width=10)
    s.path('M340 170 L372 230 L352 224 L338 244 L320 226 L304 234Z', role='deco', fill='#FFFFFF', stroke=INK, stroke_width=10)
    s.path('M196 150 L130 440 H30Z', role='hl', opacity='.18')
    s.circle(420, 90, 40, fill='Y')


@st(F, 'arbre', 'Arbre')
def _(s):
    s.rect(220, 330, 72, 140, 16, fill='T')
    s.path('M256 40 C330 40 380 100 370 160 C430 180 450 260 410 300 C390 350 320 360 256 350 C192 360 122 350 102 300 '
           'C62 260 82 180 142 160 C132 100 182 40 256 40Z', fill='G')
    s.hl('M140 200 Q150 120 230 76 Q170 140 166 210Z', opacity='.4')
    s.circle(320, 180, 16, role='deco', fill='C', stroke=INK, stroke_width=9)
    s.circle(190, 260, 16, role='deco', fill='C', stroke=INK, stroke_width=9)
    s.circle(330, 290, 16, role='deco', fill='C', stroke=INK, stroke_width=9)


@st(F, 'cactus', 'Cactus')
def _(s):
    s.tube('M150 196 V270 Q150 300 190 300 H210', 'G', 50)
    s.tube('M362 160 V230 Q362 260 322 260 H300', 'G', 50)
    s.rect(196, 80, 120, 300, 60, fill='G')
    s.path('M226 130 V340 M286 130 V340', role='deco', stroke='#1E9E58', stroke_width=10)
    s.path('M120 370 H392 L366 470 H146Z', fill='O')
    s.rect(106, 350, 300, 50, 14, fill='O')
    s.circle(256, 74, 22, fill='R', stroke_width=11)


@st(F, 'oiseau', 'Oiseau')
def _(s):
    s.path('M100 300 C100 190 180 120 270 120 C360 120 420 190 420 270 C420 360 340 410 250 410 C170 410 120 380 70 410 '
           'C90 370 100 340 100 300Z', fill='K')
    s.path('M420 230 L476 254 L420 280Z', fill='Y')
    s.path('M180 290 C220 250 290 260 320 300 C280 330 220 340 180 290Z', role='deco', fill='#7DD3FC', stroke=INK, stroke_width=12)
    eye(s, 350, 218, 20)
    s.path('M200 130 C210 90 250 80 270 120 M270 120 C290 80 330 90 320 130', stroke_width=12)
    s.path('M226 410 V460 M286 410 V460', stroke_width=12)
    cheeks(s, 360, 218, 0, 50)


@st(F, 'papillon', 'Papillon')
def _(s):
    s.path('M248 240 C210 130 130 70 80 100 C40 126 60 220 130 250 C80 280 80 370 140 390 C190 404 236 340 248 290Z', fill='O')
    s.path('M264 240 C302 130 382 70 432 100 C472 126 452 220 382 250 C432 280 432 370 372 390 C322 404 276 340 264 290Z', fill='O')
    for x in (130, 382):
        s.circle(x, 172, 30, role='deco', fill=INK, stroke='none')
        s.circle(x, 172, 12, role='deco', fill='Y', stroke='none')
        s.circle(x + (12 if x < 256 else -12), 320, 22, role='deco', fill='#FFFFFF', opacity='.7', stroke='none')
    s.ellipse(256, 280, 22, 92, fill='D')
    s.path('M248 196 C236 150 214 130 192 124 M264 196 C276 150 298 130 320 124', stroke_width=11)
    s.circle(192, 124, 12, fill='D', stroke_width=9)
    s.circle(320, 124, 12, fill='D', stroke_width=9)


@st(F, 'renard', 'Renard')
def _(s):
    s.path('M96 100 L176 190 L130 230Z', fill='O')
    s.path('M416 100 L336 190 L382 230Z', fill='O')
    s.path('M60 210 C120 170 200 170 256 200 C312 170 392 170 452 210 C440 300 340 420 256 450 C172 420 72 300 60 210Z', fill='O')
    s.path('M60 210 C120 260 200 290 256 330 C312 290 392 260 452 210 C440 300 340 420 256 450 C172 420 72 300 60 210Z',
           role='deco', fill='W', stroke=INK, stroke_width=12)
    s.path(f'M60 210 C120 170 200 170 256 200 C312 170 392 170 452 210 C440 300 340 420 256 450 C172 420 72 300 60 210Z',
           role='deco', fill='none', stroke=INK, stroke_width=SW)
    eye(s, 196, 270, 18); eye(s, 316, 270, 18)
    s.ellipse(256, 418, 26, 18, role='deco', fill=INK, stroke='none')
    s.path('M112 120 L150 166 L130 184Z M400 120 L362 166 L382 184Z', role='deco', fill=INK, opacity='.5', stroke='none')


@st(F, 'hibou', 'Hibou')
def _(s):
    s.path('M120 120 L170 170 H342 L392 120 L410 300 C410 400 340 460 256 460 C172 460 102 400 102 300Z', fill='P')
    s.path('M180 300 C180 260 330 260 330 300 V420 C300 446 210 446 180 420Z', role='deco', fill='M', stroke=INK, stroke_width=11)
    for y in (330, 370, 410):
        s.path(f'M206 {y} q14 14 28 0 q14 14 28 0 q14 14 28 0', role='deco', stroke='#C7895B', stroke_width=8)
    s.circle(190, 220, 62, fill='W')
    s.circle(322, 220, 62, fill='W')
    s.circle(198, 222, 30, role='deco', fill=INK, stroke='none')
    s.circle(314, 222, 30, role='deco', fill=INK, stroke='none')
    s.circle(208, 210, 10, role='deco', fill='#FFFFFF', stroke='none')
    s.circle(324, 210, 10, role='deco', fill='#FFFFFF', stroke='none')
    s.path('M236 270 L256 300 L276 270Z', role='deco', fill='Y', stroke=INK, stroke_width=10)


@st(F, 'poisson', 'Poisson')
def _(s):
    s.path('M380 256 L470 170 V342Z', fill='O')
    s.path('M60 256 C110 150 230 120 320 160 C360 180 390 220 400 256 C390 292 360 332 320 352 C230 392 110 362 60 256Z', fill='O')
    s.path('M220 140 C240 100 300 100 320 160', fill='O', stroke_width=12)
    s.path('M230 170 C260 210 260 300 230 344 M290 176 C312 216 312 296 290 336', role='deco', stroke=INK, stroke_width=10, opacity='.5')
    eye(s, 142, 236, 20)
    s.path('M70 280 Q90 290 108 284', role='deco', stroke=INK, stroke_width=9)
    s.circle(60, 160, 18, fill='K', fill_opacity='.5', stroke_width=9)
    s.circle(96, 110, 12, fill='K', fill_opacity='.5', stroke_width=8)


@st(F, 'abeille', 'Abeille')
def _(s):
    s.ellipse(190, 160, 80, 54, fill='K', fill_opacity='.6', transform='rotate(-30 190 160)')
    s.ellipse(310, 150, 80, 54, fill='K', fill_opacity='.6', transform='rotate(30 310 150)')
    s.ellipse(256, 300, 170, 130, fill='Y')
    s.path('M190 182 C170 240 170 360 190 418 M262 172 C242 240 242 360 262 428 M334 190 C318 240 318 360 334 412',
           role='deco', stroke=INK, stroke_width=34, clip_path=s.clip('body', 'M86 300 A170 130 0 1 0 426 300 A170 130 0 1 0 86 300Z'))
    s.ellipse(256, 300, 170, 130, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.path('M426 300 L470 300', stroke_width=14)
    eye(s, 128, 290, 18)
    s.path('M110 336 Q126 350 146 338', role='deco', stroke=INK, stroke_width=10)
    s.hl('M130 240 Q170 190 230 182 Q180 210 160 250Z', opacity='.6')
