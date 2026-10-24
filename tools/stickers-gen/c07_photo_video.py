from nx import *
from reg import st

F = '07_Photo_Video'


@st(F, 'camera', 'Appareil photo reflex')
def _(s):
    s.path('M70 170 Q70 140 100 140 H178 L206 96 H306 L334 140 H412 Q442 140 442 170 V400 Q442 430 412 430 H100 Q70 430 70 400Z', fill='D')
    s.rect(70, 196, 372, 40, 0, role='deco', fill='#2A3A55', stroke='none')
    s.circle(256, 296, 112, fill='L')
    s.circle(256, 296, 80, role='deco', fill='D', stroke=INK, stroke_width=12)
    s.circle(256, 296, 50, role='deco', fill='S', stroke=INK, stroke_width=10)
    s.hl('M226 270 Q238 248 266 250 Q244 262 240 282Z', opacity='.9')
    s.rect(96, 160, 56, 26, 10, role='deco', fill='C', stroke=INK, stroke_width=9)
    s.circle(402, 176, 14, role='deco', fill='Y', stroke=INK, stroke_width=9)


@st(F, 'camera_video', 'Caméra vidéo')
def _(s):
    s.rect(50, 150, 300, 230, 40, fill='P')
    s.path('M350 230 L462 166 V364 L350 300Z', fill='P')
    s.circle(140, 110, 48, fill='D')
    s.circle(250, 110, 48, fill='D')
    s.circle(140, 110, 16, role='deco', fill='L', stroke='none')
    s.circle(250, 110, 16, role='deco', fill='L', stroke='none')
    s.circle(110, 210, 16, role='deco', fill='C', stroke=INK, stroke_width=9)
    s.hl('M76 180 Q80 166 96 166 H300 Q290 180 276 182 H90Z', opacity='.5')
    s.rect(100, 280, 200, 50, 14, role='deco', fill='#FFFFFF', opacity='.3', stroke='none')


@st(F, 'lecture', 'Lecture')
def _(s):
    s.circle(256, 256, 196, fill='S')
    s.path('M212 168 Q200 160 200 176 V336 Q200 352 212 344 L346 266 Q358 256 346 246Z', role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)
    s.hl('M110 200 Q130 110 230 86 Q150 130 140 210Z', opacity='.5')


@st(F, 'microphone', 'Microphone')
def _(s):
    s.path('M136 250 C136 340 190 380 256 380 C322 380 376 340 376 250', stroke_width=20)
    s.tube('M256 384 V440', 'L', 18)
    s.rect(160, 432, 192, 34, 16, fill='D')
    s.rect(180, 50, 152, 278, 76, fill='P')
    s.path('M180 150 H332 M180 196 H332', role='deco', stroke=INK, stroke_width=9, opacity='.5')
    s.circle(206, 92, 8, role='deco', fill='#FFFFFF', stroke='none', opacity='.7')
    s.hl('M204 160 V280 Q204 300 220 304 V160Z', opacity='.45')


@st(F, 'clap', 'Clap de cinéma')
def _(s):
    s.rect(70, 200, 372, 250, 22, fill='D')
    s.path('M66 132 L418 60 L436 140 L84 212Z', fill='W')
    s.path('M120 122 L170 196 M210 104 L260 178 M300 86 L350 160 M390 68 L420 112', role='deco', stroke=INK, stroke_width=36)
    s.path('M66 132 L418 60 L436 140 L84 212Z', role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.path('M70 200 H442 V250 H70Z', role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)
    s.path('M120 200 L150 250 M200 200 L230 250 M280 200 L310 250 M360 200 L390 250', role='deco', stroke=INK, stroke_width=30)
    s.circle(84, 212, 18, fill='C', stroke_width=10)
    s.rect(110, 300, 160, 18, 9, role='deco', fill='#FFFFFF', opacity='.5', stroke='none')
    s.rect(110, 350, 240, 18, 9, role='deco', fill='#FFFFFF', opacity='.3', stroke='none')


@st(F, 'ciseaux', 'Ciseaux')
def _(s):
    s.tube('M160 322 L446 98', 'L', 38)
    s.tube('M160 190 L446 414', 'L', 38)
    s.path('M244 256 L446 98', role='deco', stroke='#FFFFFF', stroke_width=10, opacity='.6')
    s.circle(244, 256, 14, role='deco', fill=INK, stroke='none')
    s.circle(122, 152, 72, fill='C')
    s.circle(122, 360, 72, fill='C')
    s.circle(122, 152, 34, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)
    s.circle(122, 360, 34, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)


@st(F, 'casque_audio', "Casque d'écoute")
def _(s):
    s.tube('M98 300 V250 C98 150 170 80 256 80 C342 80 414 150 414 250 V300', 'D', 30)
    s.rect(64, 260, 108, 180, 46, fill='S')
    s.rect(340, 260, 108, 180, 46, fill='S')
    s.hl('M86 292 Q90 276 108 276 Q98 300 98 330 Q86 320 86 292Z', opacity='.6')
    s.hl('M362 292 Q366 276 384 276 Q374 300 374 330 Q362 320 362 292Z', opacity='.6')
    s.path('M226 196 V160 L290 148 V186', role='deco', stroke='P', stroke_width=12)


@st(F, 'eclairage', 'Éclairage de studio')
def _(s):
    s.tube('M256 300 L176 466 M256 300 L336 466 M256 300 V466', 'D', 12)
    s.path('M110 100 H402 L362 300 H150Z', fill='W')
    s.path('M150 300 H362 L340 330 H172Z', fill='D')
    s.path('M140 124 H372', role='deco', stroke='Y', stroke_width=14)
    s.path('M86 60 L140 96 M256 30 V80 M426 60 L372 96', role='deco', stroke='Y', stroke_width=16)
    s.hl('M140 120 H190 L180 280 H160Z', opacity='.5')


@st(F, 'film', 'Pellicule')
def _(s):
    s.rect(84, 52, 344, 408, 30, fill='D')
    s.rect(140, 90, 232, 150, 10, role='deco', fill='S', stroke=INK, stroke_width=10)
    s.rect(140, 272, 232, 150, 10, role='deco', fill='K', stroke=INK, stroke_width=10)
    for y in range(82, 440, 52):
        s.rect(100, y, 24, 28, 6, role='deco', fill='#FFFFFF', stroke='none')
        s.rect(388, y, 24, 28, 6, role='deco', fill='#FFFFFF', stroke='none')
    s.path('M176 210 L224 160 L256 190 L300 140 L338 210Z', role='deco', fill='#FFFFFF', opacity='.7', stroke='none')


@st(F, 'image', 'Image')
def _(s):
    s.rect(56, 92, 400, 328, 44, fill='K')
    s.path('M56 330 L176 216 L280 316 L342 256 L456 360 V376 Q456 420 412 420 H100 Q56 420 56 376Z', role='deco', fill='G', stroke=INK, stroke_width=12)
    s.circle(352, 172, 38, role='deco', fill='Y', stroke=INK, stroke_width=11)
    s.rect(56, 92, 400, 328, 44, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.hl('M90 140 Q92 116 120 116 H190 Q130 130 110 180Z', opacity='.5')


@st(F, 'montage', 'Montage vidéo')
def _(s):
    s.rect(50, 76, 412, 360, 40, fill='D')
    s.rect(80, 110, 352, 170, 14, role='deco', fill='S', stroke=INK, stroke_width=10)
    s.path('M236 160 V232 L296 196Z', role='deco', fill='#FFFFFF', stroke='none')
    s.rect(80, 304, 160, 40, 10, role='deco', fill='P', stroke=INK, stroke_width=9)
    s.rect(250, 304, 182, 40, 10, role='deco', fill='G', stroke=INK, stroke_width=9)
    s.rect(80, 358, 240, 40, 10, role='deco', fill='O', stroke=INK, stroke_width=9)
    s.path('M300 290 V412', role='deco', stroke='C', stroke_width=10)
    s.path('M286 284 H314 L300 300Z', role='deco', fill='C', stroke='none')


@st(F, 'musique', 'Musique')
def _(s):
    s.path('M168 380 V140 L420 90 V330', stroke_width=26)
    s.path('M168 140 L420 90 V150 L168 200Z', fill='G')
    s.circle(122, 386, 60, fill='P')
    s.circle(374, 336, 60, fill='P')
    s.hl('M92 372 Q100 346 128 342 Q110 360 108 380Z', opacity='.7')
    s.hl('M344 322 Q352 296 380 292 Q362 310 360 330Z', opacity='.7')


@st(F, 'enregistrer', 'Enregistrement')
def _(s):
    s.rect(46, 156, 420, 200, 100, fill='D')
    s.circle(150, 256, 52, role='deco', fill='C', stroke=INK, stroke_width=11)
    s.circle(150, 256, 74, role='deco', fill='none', stroke='C', stroke_width=8, opacity='.5')
    s.text('REC', 318, 292, 100, fill='#FFFFFF')


@st(F, 'objectif', 'Objectif')
def _(s):
    s.circle(256, 256, 200, fill='D')
    s.circle(256, 256, 160, role='deco', fill='#2A3A55', stroke=INK, stroke_width=10)
    s.circle(256, 256, 116, role='deco', fill='S', stroke=INK, stroke_width=12)
    s.circle(256, 256, 60, role='deco', fill='#1B2740', stroke=INK, stroke_width=10)
    s.hl('M180 220 Q200 170 256 160 Q210 190 206 232Z', opacity='.8')
    s.circle(300, 300, 14, role='deco', fill='#FFFFFF', opacity='.6', stroke='none')
    for a in range(0, 360, 30):
        x1, y1 = arc_pt(256, 256, 172, a); x2, y2 = arc_pt(256, 256, 190, a)
        s.line(round(x1), round(y1), round(x2), round(y2), role='deco', stroke='L', stroke_width=7)


@st(F, 'bobine', 'Bobine de film')
def _(s):
    s.circle(220, 230, 180, fill='L')
    for a in range(-90, 270, 72):
        x, y = arc_pt(220, 230, 100, a)
        s.circle(round(x), round(y), 40, role='deco', fill='D', stroke=INK, stroke_width=10)
    s.circle(220, 230, 22, role='deco', fill='D', stroke=INK, stroke_width=10)
    s.path('M300 392 C360 420 410 420 470 380 L470 440 C410 480 350 470 290 446Z', fill='D')
    s.hl('M80 200 Q90 110 180 70 Q110 130 104 210Z', opacity='.6')
