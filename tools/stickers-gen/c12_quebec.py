from nx import *
from reg import st

F = '12_Quebec_Hiver'

MAPLE = ('M256 40 L290 112 L330 96 L314 200 L370 140 L384 176 L452 166 L428 236 L462 254 L360 330 L376 368 '
         'L276 352 L270 470 H242 L236 352 L136 368 L152 330 L50 254 L84 236 L60 166 L128 176 L142 140 L198 200 '
         'L182 96 L222 112Z')


@st(F, 'feuille_erable', "Feuille d'érable")
def _(s):
    s.path(MAPLE, fill='C', stroke_width=15)
    s.path('M256 120 V420 M256 330 L150 250 M256 330 L362 250 M256 250 L190 170 M256 250 L322 170', role='deco', stroke='#B8323A', stroke_width=10)
    s.hl('M256 60 L236 120 L196 112 L210 200 L170 162 Z', opacity='.4')


@st(F, 'sirop_erable', "Sirop d'érable")
def _(s):
    s.path('M200 40 H312 V110 C380 130 410 190 410 260 V420 Q410 460 370 460 H142 Q102 460 102 420 V260 C102 190 132 130 200 110Z', fill='O')
    s.rect(190, 30, 132, 50, 14, fill='C')
    s.path('M110 250 H402 V390 H110Z', role='deco', fill='#FFF3D9', stroke=INK, stroke_width=12)
    s.path(MAPLE, role='deco', fill='C', stroke=INK, stroke_width=12, transform='translate(207 258) scale(.19)')
    s.text('SIROP', 256, 378, 32, fill=INK)
    s.hl('M130 230 Q140 160 200 132 Q160 180 156 240Z', opacity='.5')
    s.path('M410 220 C460 220 470 300 410 320', stroke_width=26 + SW)
    s.path('M410 220 C460 220 470 300 410 320', role='deco', stroke='O', stroke_width=26)


@st(F, 'tuque', 'Tuque')
def _(s):
    s.path('M90 330 C90 180 170 110 256 110 C342 110 422 180 422 330Z', fill='C')
    s.path('M150 330 C150 220 190 150 220 130 M256 330 V112 M362 330 C362 220 322 150 292 130', role='deco', stroke='#B8323A', stroke_width=12)
    s.rect(70, 316, 372, 110, 34, fill='W')
    s.path('M70 352 H442 M70 390 H442', role='deco', stroke='C', stroke_width=12, opacity='.6')
    s.circle(256, 92, 56, fill='W')
    s.path('M226 70 L246 96 M270 64 L262 98 M296 90 L270 104 M220 110 L248 108', role='deco', stroke='L', stroke_width=8)
    s.hl('M126 290 Q130 200 200 150 Q160 210 158 290Z', opacity='.4')


@st(F, 'mitaine', 'Mitaine')
def _(s):
    s.path('M150 400 V200 C150 120 190 70 260 70 C330 70 370 120 370 200 V260 C400 220 440 220 450 250 C462 290 420 340 370 380 V400Z',
           fill='K')
    s.path('M150 220 H370 M150 270 H370', role='deco', stroke='#FFFFFF', stroke_width=14, opacity='.7')
    s.path('M190 245 L210 225 L230 245 L250 225 L270 245 L290 225 L310 245 L330 225 L350 245', role='deco', stroke='#FFFFFF', stroke_width=8, opacity='.7')
    s.rect(130, 390, 260, 76, 26, fill='W')
    s.path('M170 400 V456 M210 400 V456 M250 400 V456 M290 400 V456 M330 400 V456', role='deco', stroke='L', stroke_width=9)
    s.hl('M180 190 Q182 120 240 96 Q204 140 204 196Z', opacity='.5')


@st(F, 'bonhomme_neige', 'Bonhomme de neige')
def _(s):
    s.circle(256, 360, 120, fill='W')
    s.circle(256, 180, 92, fill='W')
    s.rect(176, 60, 160, 30, 10, fill='D')
    s.rect(200, 10, 112, 70, 12, fill='D')
    s.rect(200, 52, 112, 18, 0, role='deco', fill='C', stroke='none')
    eye(s, 224, 170, 13); eye(s, 288, 170, 13)
    s.path('M256 196 L320 214 L256 220Z', role='deco', fill='O', stroke=INK, stroke_width=9)
    s.path('M180 262 C220 280 292 280 332 262 L350 296 C300 314 212 314 162 296Z', fill='C')
    s.path('M300 290 L320 360 L292 362Z', fill='C', stroke_width=12)
    for y in (330, 380, 430):
        s.circle(256, y, 12, role='deco', fill=INK, stroke='none')
    s.path('M140 340 L60 290 M80 300 L60 270', stroke='T', stroke_width=14)
    s.path('M372 340 L452 290 M432 300 L456 274', stroke='T', stroke_width=14)


@st(F, 'chocolat_chaud', 'Chocolat chaud')
def _(s):
    s.path('M100 200 H380 V360 C380 420 330 460 270 460 H210 C150 460 100 420 100 360Z', fill='C')
    s.path('M380 240 C450 230 470 330 380 350', stroke_width=30 + SW)
    s.path('M380 240 C450 230 470 330 380 350', role='deco', stroke='C', stroke_width=30)
    s.ellipse(240, 204, 140, 28, role='deco', fill='T', stroke=INK, stroke_width=12)
    s.rect(170, 170, 54, 46, 12, fill='W', transform='rotate(-14 197 193)')
    s.rect(244, 166, 54, 46, 12, fill='W', transform='rotate(10 271 189)')
    s.path('M190 140 C170 110 210 90 190 56 M260 130 C240 100 280 80 260 46', stroke='L', stroke_width=14)
    s.path(MAPLE, role='deco', fill='#FFFFFF', stroke='none', opacity='.85', transform='translate(200 300) scale(.22)')


@st(F, 'patin', 'Patin à glace')
def _(s):
    s.path('M150 60 H280 V230 C340 240 420 260 430 320 V350 H110 V90 Q110 60 150 60Z', fill='W')
    s.path('M150 110 L250 110 M150 150 L250 150 M150 190 L250 190', role='deco', stroke='K', stroke_width=12)
    s.rect(110, 346, 320, 34, 10, fill='D')
    s.path('M80 430 H420 Q456 430 456 396', stroke='L', stroke_width=22 + SW)
    s.path('M80 430 H420 Q456 430 456 396', role='deco', stroke='L', stroke_width=22)
    s.path('M150 380 V430 M380 380 V430', stroke_width=16)
    s.hl('M126 100 Q130 80 150 78 V330 H126Z', opacity='.5')
