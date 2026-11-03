import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Я так видел» 1400: Pringles (усатое лицо). Фон — жёлтая страница, красная банка за лицом; дополнения Васи — чипсы-«седёлки» вокруг,
# звёздочки. Букв и названия бренда нет.
k = Kid(seed=14001)
k.fill(rect(-20, -20, W + 40, H + 40), '#ffe58a', gap=11, angle=-8)


def chip(x, y, rot, s=1.0):
    k.shape(ell(x, y, 56 * s, 32 * s, 16, rot=rot), '#f6cd62', '#9a6a10', w=5, gap=8)
    k.line(ell(x, y, 34 * s, 12 * s, 10, a0=200, a1=340, rot=rot), '#9a6a10', w=4, amp=0.6, twice=False)
    for (dx, dy) in [(-24, 6), (22, 8), (4, -14)]:
        c, sn = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        k.dot(x + (dx * c - dy * sn) * s, y + (dx * sn + dy * c) * s, 3, '#9a6a10')


for (x, y, r_, s_) in [(190, 190, -25, 1.0), (1090, 170, 28, 1.1), (210, 480, 18, 1.15), (1070, 470, -30, 1.0), (330, 650, -10, 0.9), (960, 650, 14, 1.0), (140, 330, 40, 0.8)]:
    chip(x, y, r_, s_)
for (sx, sy, R) in [(330, 80, 12), (960, 70, 12), (110, 600, 12), (1180, 330, 12), (1190, 610, 11)]:
    star(k, sx, sy, R, '#ff9a2a', '#a05000')

# красная банка
can = [(420, 76), (860, 76), (860, 676)] + ell(640, 676, 220, 30, 10, a0=0, a1=180)[::1] + [(420, 676)]
k.shape(can, '#d9231c', '#6f0e0b', w=9, gap=11, smooth=False, amp=2.0)
k.shape(ell(640, 76, 220, 30, 20), '#d9dde6', '#5a6074', w=7, gap=9)

# --- лицо ---
T = Xf(640, 392, 1.0)
HAIR, HAIRD = '#4a2a12', '#2a1408'
# уши
for sg in (-1, 1):
    k.shape(T(ell(sg * 150, 10, 26, 40, 12)), '#f7d5a8', '#9a6a40', w=5, gap=8)
# лицо
k.shape(T(ell(0, 0, 150, 172, 26)), '#f9dcb4', '#9a6a40', w=7, gap=10)
# волосы: шапка и завитки по бокам
k.shape(T([(-152, -50), (-138, -128), (-80, -186), (0, -204), (80, -186), (138, -128), (152, -50), (112, -96), (60, -124), (0, -100), (-60, -124), (-112, -96)]),
        HAIR, HAIRD, w=6, gap=9, smooth=True, amp=1.6)
for sg in (-1, 1):
    k.line(T([(sg * 150, -70), (sg * 176, -112), (sg * 150, -150), (sg * 118, -138), (sg * 126, -108)]), HAIR, w=22, amp=1.2, twice=False)
# брови
for sg in (-1, 1):
    k.line(T([(sg * 100, -52), (sg * 62, -84), (sg * 24, -70)]), HAIR, w=19, amp=1.0, twice=False)
# глаза
for sg in (-1, 1):
    ex, ey = T.p((sg * 56, -26))
    k.shape(ell(ex, ey, 18, 21, 12), '#ffffff', '#333', w=4, gap=7)
    k.dot(ex + sg * -2, ey + 2, 7, '#111')
# нос и щёки
k.shape(T(ell(0, 22, 22, 18, 10)), '#f2bf90', '#9a6a40', w=4, gap=7)
for sg in (-1, 1):
    k.dot(*T.p((sg * 100, 38)), 15, '#ff9a9a')
# усы — главное
for sg in (-1, 1):
    k.line(T([(0, 60), (sg * 60, 50), (sg * 122, 62), (sg * 172, 96), (sg * 204, 78), (sg * 198, 38)]), HAIR, w=40, amp=1.4, twice=False)
    k.line(T([(sg * 20, 56), (sg * 70, 56), (sg * 124, 70), (sg * 166, 96)]), '#7a4a28', w=6, amp=0.8, twice=False)
k.shape(T(ell(0, 58, 46, 24, 12)), HAIR, HAIRD, w=4, gap=7)

signature(k, 1262, 704, 30, '#5a4a1a')
k.save('/tmp/takvidel/1400', 'media/img/takvidel/r2_1400_pringles.webp')
