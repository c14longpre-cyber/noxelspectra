"""Basic shapes: same palette, no die-cut border, so they sit flush on a design."""
from nx import *
from reg import st

K = 'formes'
G1 = '01_Geometriques'
G2 = '02_Reperes'
G3 = '03_Composition'
G4 = '04_Badges_Interfaces'


def f(folder, file, title):
    return st(folder, file, title, kind=K)


def poly_n(n, r, rot=-90, cx=256, cy=256):
    return [(round(cx + r * math.cos(math.radians(rot + i * 360 / n)), 1),
             round(cy + r * math.sin(math.radians(rot + i * 360 / n)), 1)) for i in range(n)]


def gloss(s, d):
    s.hl(d, opacity='.35')


@f(G1, 'carre', 'Carré')
def _(s):
    s.rect(76, 76, 360, 360, 0, fill='S')


@f(G1, 'rectangle', 'Rectangle')
def _(s):
    s.rect(46, 136, 420, 240, 0, fill='S')


@f(G1, 'rectangle_arrondi', 'Rectangle arrondi')
def _(s):
    s.rect(46, 136, 420, 240, 56, fill='S')


@f(G1, 'cercle', 'Cercle')
def _(s):
    s.circle(256, 256, 190, fill='S')


@f(G1, 'ellipse', 'Ellipse')
def _(s):
    s.ellipse(256, 256, 210, 130, fill='S')


@f(G1, 'triangle', 'Triangle')
def _(s):
    s.poly([(256, 66), (456, 424), (56, 424)], fill='S')


@f(G1, 'losange', 'Losange')
def _(s):
    s.poly([(256, 46), (466, 256), (256, 466), (46, 256)], fill='S')


@f(G1, 'pentagone', 'Pentagone')
def _(s):
    s.poly(poly_n(5, 210, cy=270), fill='S')


@f(G1, 'hexagone', 'Hexagone')
def _(s):
    s.poly(poly_n(6, 210, rot=0), fill='S')


@f(G1, 'octogone', 'Octogone')
def _(s):
    s.poly(poly_n(8, 208, rot=22.5), fill='S')


@f(G1, 'etoile', 'Étoile')
def _(s):
    s.path(star_d(256, 270, 216, 92), fill='S')


@f(G1, 'coeur', 'Cœur')
def _(s):
    s.path(heart_d(256, 262, 196), fill='S')


@f(G1, 'parallelogramme', 'Parallélogramme')
def _(s):
    s.poly([(136, 136), (466, 136), (376, 376), (46, 376)], fill='S')


@f(G1, 'croissant', 'Croissant')
def _(s):
    s.path('M300 56 C190 66 96 156 96 276 C96 396 190 466 300 466 C356 466 404 446 440 410 '
           'C420 414 400 416 382 416 C272 416 190 336 190 228 C190 156 230 92 300 56Z', fill='S')


@f(G1, 'goutte', 'Goutte')
def _(s):
    s.path('M256 40 C300 120 400 220 400 316 C400 402 334 462 256 462 C178 462 112 402 112 316 C112 220 212 120 256 40Z', fill='S')


@f(G2, 'ligne', 'Ligne')
def _(s):
    s.path('M56 256 H456', stroke='G', stroke_width=26)


@f(G2, 'ligne_pointillee', 'Ligne pointillée')
def _(s):
    s.path('M56 256 H456', stroke='G', stroke_width=26, stroke_dasharray='1 46')


@f(G2, 'fleche_droite', 'Flèche droite')
def _(s):
    s.path('M66 256 H436 M316 136 L436 256 L316 376', stroke_width=30)


@f(G2, 'fleche_double', 'Flèche double')
def _(s):
    s.path('M86 256 H426 M186 156 L86 256 L186 356 M326 156 L426 256 L326 356', stroke_width=30)


@f(G2, 'fleche_courbe', 'Flèche courbe')
def _(s):
    s.path('M86 420 C96 250 200 150 400 150 M300 70 L410 150 L320 240', stroke_width=30)


@f(G2, 'chevron', 'Chevron')
def _(s):
    s.path('M176 86 L346 256 L176 426', stroke='P', stroke_width=40)


@f(G2, 'coche', 'Coche')
def _(s):
    s.path('M96 266 L206 376 L426 136', stroke='G', stroke_width=40)


@f(G2, 'croix', 'Croix')
def _(s):
    s.path('M116 116 L396 396 M396 116 L116 396', stroke='C', stroke_width=40)


@f(G2, 'arc', 'Arc')
def _(s):
    s.path('M86 340 A170 170 0 0 1 426 340', stroke='P', stroke_width=30)


@f(G3, 'masque_circulaire', 'Masque circulaire')
def _(s):
    s.circle(256, 256, 190, fill='none', stroke='S', stroke_width=30)


@f(G3, 'encadre', 'Encadré')
def _(s):
    s.rect(66, 66, 380, 380, 30, fill='none', stroke='S', stroke_width=30)


@f(G3, 'grille', 'Grille des tiers')
def _(s):
    s.rect(56, 56, 400, 400, 20, fill='W')
    s.path('M189 56 V456 M322 56 V456 M56 189 H456 M56 322 H456', role='deco', stroke='#3DDC84', stroke_width=8)
    s.rect(56, 56, 400, 400, 20, role='deco', fill='none', stroke=INK, stroke_width=SW)


@f(G3, 'banniere', 'Bannière')
def _(s):
    s.path('M46 150 H466 L426 256 L466 362 H46 L86 256Z', fill='S')


@f(G3, 'ruban', 'Ruban')
def _(s):
    s.path('M116 56 H396 V456 L256 356 L116 456Z', fill='S')


@f(G3, 'badge', 'Badge')
def _(s):
    s.path(burst_d(256, 256, 210, 182, 16), fill='S')


@f(G3, 'bulle_dialogue', 'Bulle de dialogue')
def _(s):
    s.path('M86 80 H426 Q466 80 466 120 V320 Q466 360 426 360 H210 L120 440 L140 360 H86 Q46 360 46 320 V120 Q46 80 86 80Z', fill='S')


@f(G3, 'bulle_pensee', 'Bulle de pensée')
def _(s):
    s.path('M136 330 C80 330 46 290 50 246 C54 200 96 176 130 186 C130 120 190 80 250 96 C290 60 370 70 390 130 '
           'C440 130 470 180 456 228 C476 270 450 330 390 330Z', fill='W')
    s.circle(130, 384, 30, fill='W')
    s.circle(84, 446, 18, fill='W')


@f(G3, 'legende', 'Légende')
def _(s):
    s.rect(56, 150, 400, 212, 30, fill='W')
    s.path('M106 220 H330 M106 292 H260', role='deco', stroke='G', stroke_width=22)


@f(G4, 'bulle_alerte', 'Bulle alerte')
def _(s):
    s.path('M86 80 H426 Q466 80 466 120 V320 Q466 360 426 360 H210 L120 440 L140 360 H86 Q46 360 46 320 V120 Q46 80 86 80Z', fill='C')
    s.rect(234, 120, 44, 140, 22, role='deco', fill='#FFFFFF', stroke='none')
    s.circle(256, 304, 24, role='deco', fill='#FFFFFF', stroke='none')


@f(G4, 'etoile_quatre', 'Étoile à quatre branches')
def _(s):
    s.path(sparkle_d(256, 256, 216, .24), fill='S')


@f(G4, 'etiquette_prix', 'Étiquette de prix')
def _(s):
    s.path('M70 96 Q70 70 96 70 H250 L450 270 L270 450 L70 250Z', fill='Y')
    s.circle(154, 154, 30, role='deco', fill='#FFFFFF', stroke=INK, stroke_width=12)


@f(G4, 'cercle_pointille', 'Cercle pointillé')
def _(s):
    s.circle(256, 256, 186, fill='none', stroke='P', stroke_width=26, stroke_dasharray='1 44')


@f(G4, 'coche_double', 'Double coche')
def _(s):
    s.path('M50 266 L150 366 L330 156', stroke='K', stroke_width=36)
    s.path('M200 330 L236 366 L456 136', stroke='G', stroke_width=36)


@f(G4, 'pastille', 'Pastille de notification')
def _(s):
    s.circle(256, 256, 170, fill='C')
    s.text('3', 256, 318, 180, fill='#FFFFFF')


@f(G4, 'interrupteur', 'Interrupteur')
def _(s):
    s.rect(46, 156, 420, 200, 100, fill='G')
    s.circle(366, 256, 76, fill='W')
