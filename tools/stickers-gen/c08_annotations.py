from nx import *
from reg import st

F = '08_Annotations'


@st(F, 'fleches_quatre', 'Déplacer')
def _(s):
    d = ('M256 40 L326 120 H284 V228 H392 V186 L472 256 L392 326 V284 H284 V392 H326 L256 472 L186 392 H228 V284 '
         'H120 V326 L40 256 L120 186 V228 H228 V120 H186Z')
    s.path(d, fill='S', stroke_width=15)
    s.circle(256, 256, 30, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=10)


@st(F, 'zoom_plus', 'Zoom avant')
def _(s):
    s.tube('M326 326 L440 440', 'G', 46)
    s.circle(216, 216, 150, fill='W')
    s.path('M216 150 V282 M150 216 H282', role='deco', stroke='G', stroke_width=36)
    s.path('M216 150 V282 M150 216 H282', role='deco', stroke=INK, stroke_width=0)
    s.hl('M110 200 Q120 120 200 100 Q140 150 136 210Z', fill='K', opacity='.35')


@st(F, 'zoom_moins', 'Zoom arrière')
def _(s):
    s.tube('M326 326 L440 440', 'C', 46)
    s.circle(216, 216, 150, fill='W')
    s.path('M150 216 H282', role='deco', stroke='C', stroke_width=36)
    s.hl('M110 200 Q120 120 200 100 Q140 150 136 210Z', fill='K', opacity='.35')


@st(F, 'main', 'Main qui pointe')
def _(s):
    s.path('M190 470 C150 430 110 380 96 330 C88 300 110 284 132 300 L176 336 V120 C176 86 232 86 232 120 V250 '
           'V214 C232 186 284 186 284 214 V256 V232 C284 206 334 206 334 232 V270 V254 C334 230 384 230 384 254 V360 '
           'C384 420 350 470 300 470Z', fill='Y')
    s.path('M232 250 V300 M284 256 V300 M334 270 V300', role='deco', stroke=INK, stroke_width=11)
    s.hl('M188 120 Q190 100 206 100 Q196 120 198 200 H188Z', opacity='.7')
    s.path('M204 70 V30 M146 86 L116 56 M262 86 L292 56', role='deco', stroke='P', stroke_width=15)


@st(F, 'repere', 'Repère')
def _(s):
    s.path('M256 470 C200 390 100 300 100 196 C100 110 170 46 256 46 C342 46 412 110 412 196 C412 300 312 390 256 470Z', fill='C')
    s.circle(256, 196, 66, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=SW)
    s.hl('M140 180 Q144 110 214 80 Q166 130 164 186Z', opacity='.45')


@st(F, 'fleche_courbe', 'Flèche courbe')
def _(s):
    d = 'M80 420 C80 260 180 170 330 170 V100 L460 214 L330 328 V258 C230 258 150 300 80 420Z'
    s.path(d, fill='S', stroke_width=15)
    s.hl('M110 360 Q150 230 330 196 V180 Q180 190 110 360Z', opacity='.4')


@st(F, 'comparaison', 'Comparaison avant/après')
def _(s):
    s.rect(50, 80, 412, 352, 40, fill='L')
    s.path('M256 80 H422 Q462 80 462 120 V392 Q462 432 422 432 H256Z', role='deco', fill='S', stroke='none')
    s.rect(50, 80, 412, 352, 40, role='deco', fill='none', stroke=INK, stroke_width=SW)
    s.path('M256 50 V462', stroke_width=12)
    s.circle(256, 256, 46, fill='W')
    s.path('M236 236 L216 256 L236 276 M276 236 L296 256 L276 276', role='deco', stroke=INK, stroke_width=11)
    s.path('M90 380 L150 300 L190 340 L230 300', role='deco', stroke='#8090A8', stroke_width=14)
    s.path('M290 380 L340 290 L380 340 L430 260', role='deco', stroke='#FFFFFF', stroke_width=14)


@st(F, 'cible', 'Cible de mise au point')
def _(s):
    s.path('M70 160 V110 Q70 70 110 70 H160 M352 70 H402 Q442 70 442 110 V160 M442 352 V402 Q442 442 402 442 H352 '
           'M160 442 H110 Q70 442 70 402 V352', stroke='G', stroke_width=30)
    s.path('M70 160 V110 Q70 70 110 70 H160 M352 70 H402 Q442 70 442 110 V160 M442 352 V402 Q442 442 402 442 H352 '
           'M160 442 H110 Q70 442 70 402 V352', role='deco', stroke='G', stroke_width=26)
    s.circle(256, 256, 96, fill='none', stroke_width=26)
    s.circle(256, 256, 96, role='deco', fill='none', stroke='P', stroke_width=12)
    s.circle(256, 256, 22, fill='C')


@st(F, 'cercle_main', 'Cercle tracé à la main')
def _(s):
    d = 'M300 96 C150 70 50 170 70 280 C90 400 290 440 400 360 C480 300 470 170 380 120 C330 92 250 90 190 120'
    s.path(d, stroke_width=48)
    s.path(d, role='deco', stroke='C', stroke_width=32)


@st(F, 'soulignement', 'Soulignement')
def _(s):
    d = 'M50 300 C120 250 160 330 230 280 C300 230 330 320 400 270 C430 250 450 256 466 266'
    s.path(d, stroke_width=48)
    s.path(d, role='deco', stroke='Y', stroke_width=32)
    s.path('M90 380 C200 350 320 350 430 372', stroke_width=36)
    s.path('M90 380 C200 350 320 350 430 372', role='deco', stroke='P', stroke_width=20)


@st(F, 'exclamation', "Point d'exclamation")
def _(s):
    s.path(burst_d(256, 256, 214, 168, 12), fill='C', stroke_width=15)
    s.rect(226, 120, 60, 170, 30, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=11)
    s.circle(256, 360, 34, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=11)


@st(F, 'interrogation', "Point d'interrogation")
def _(s):
    s.circle(256, 256, 200, fill='P')
    s.path('M190 196 C190 150 220 126 258 126 C300 126 326 152 326 188 C326 240 260 240 260 292', role='deco',
           stroke=INK, stroke_width=58)
    s.path('M190 196 C190 150 220 126 258 126 C300 126 326 152 326 188 C326 240 260 240 260 292', role='deco',
           stroke='#FFFFFF', stroke_width=36)
    s.circle(260, 366, 30, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=11)
    s.hl('M110 200 Q130 110 230 86 Q150 130 140 210Z', opacity='.4')


@st(F, 'epingle', 'Épingle')
def _(s):
    s.tube('M216 300 L80 436', 'L', 14)
    s.path('M300 60 L452 212 L404 236 L320 330 C340 380 310 420 290 420 L92 222 C92 202 132 172 182 192 L276 108Z', fill='C')
    s.hl('M300 92 L420 212 L404 220 L292 108Z', opacity='.5')
    s.path('M300 60 L452 212', role='deco', stroke=INK, stroke_width=SW)
