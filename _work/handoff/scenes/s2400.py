import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Цвет настроения синий» (Киркоров, 2018): ночной клуб, тётя-«богиня» на тумбе с мартини и бутылкой, громкий звук,
# иней на окне («Синий иней» из припева), синяя подсветка. Надписей нет.
k = Kid(seed=2401)
night(k, '#1d2a9c', gap=11, angle=-8)

# лучи светомузыки от диско-шара
for (pts, c) in [([(985, 200), (1040, 200), (880, 640), (700, 640)], '#ff5fa2'),
                 ([(1030, 200), (1090, 200), (1270, 560), (1130, 600)], '#4fd0ff'),
                 ([(960, 190), (1000, 190), (560, 620), (430, 620)], '#ffd43b')]:
    k.fill(pts, c, gap=15, op=0.34)

# окно с инеем: ночь, месяц, ледяные снежинки
k.shape(rect(70, 50, 240, 250), '#0e1658', '#7a5a3a', w=9, gap=11)
k.shape(ell(125, 112, 30, 30, 14), '#fff3a0', '#c9a800', w=4, gap=7)
k.solid(ell(140, 104, 27, 27, 14), '#0e1658')
k.line([(190, 52), (190, 298)], '#7a5a3a', w=8, amp=1, twice=False)
k.line([(72, 178), (308, 178)], '#7a5a3a', w=8, amp=1, twice=False)


def flake(x, y, r=26, c='#d9f2ff'):
    for a in (0, 60, 120):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        k.line([(x - r * ca, y - r * sa), (x + r * ca, y + r * sa)], c, w=5, amp=0.5, twice=False)
    for a in range(0, 360, 60):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        k.dot(x + r * 1.08 * ca, y + r * 1.08 * sa, 4, c)


for (fx, fy, fr) in [(250, 108, 24), (132, 236, 26), (250, 240, 22), (232, 160, 12)]:
    flake(fx, fy, fr)

# часы: ровно полночь
k.shape(ell(560, 100, 48, 48, 18), '#ffffff', '#444', w=6, gap=9)
for a in range(0, 360, 30):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.dot(560 + 36 * ca, 100 + 36 * sa, 3, '#444')
k.line([(560, 100), (560, 68)], '#222', w=6, amp=0.5, twice=False)
k.line([(560, 100), (563, 58)], '#222', w=4, amp=0.5, twice=False)

# диско-шар
BX, BY = 1010, 140
k.line([(BX, -10), (BX, BY - 74)], '#888', w=5, amp=1, twice=False)
k.shape(ell(BX, BY, 74, 74, 18), '#cfd5e6', '#5a6178', w=7, gap=9)
for a in range(-60, 90, 30):
    k.line(ell(BX, BY, 74, 74, 12, a0=a - 30, a1=a + 150), '#ffffff', w=3, amp=0.6, twice=False)
k.line([(BX - 74, BY), (BX + 74, BY)], '#8a92a8', w=3, amp=0.5, twice=False)
for (dx, dy) in [(-110, -10), (-96, 80), (110, 70), (116, -20)]:
    sparkle(k, BX + dx, BY + dy, 16, '#ffffff', 5)
for (dx, dy, c) in [(-130, 40, '#ffd43b'), (130, 30, '#ff8aa8')]:
    sparkle(k, BX + dx, BY + dy, 12, c, 5)

# пол: сине-голубая шахматка
cols = ['#2f6bff', '#7fe0ff']
for r in range(2):
    for c in range(13):
        k.shape(rect(-10 + c * 100, 600 + r * 62, 96, 58), cols[(r + c) % 2], '#14216e', w=4, gap=9)

# колонка слева: «всё громче звук»
SX, SY, SW, SH = 60, 380, 170, 232
k.shape(rect(SX, SY, SW, SH), '#2e2e36', '#000', w=8, gap=10)
k.shape(ell(SX + SW / 2, SY + SH * 0.3, SW * 0.2, SW * 0.2, 12), '#888', '#222', w=5, gap=8)
k.shape(ell(SX + SW / 2, SY + SH * 0.68, SW * 0.34, SW * 0.34, 14), '#777', '#111', w=6, gap=8)
k.dot(SX + SW / 2, SY + SH * 0.68, 14, '#222')
for r_ in (60, 100, 140):
    k.line(ell(SX + SW + 6, SY + SH * 0.5, r_ * 0.6, r_, 10, a0=-55, a1=55), '#ffd43b', w=7, amp=1.4, twice=False)
note(k, 330, 360, 1.0, '#ffd43b'); note(k, 372, 470, 0.85, '#ff8aa8')

# тумба
k.shape(rect(510, 520, 260, 100), '#e8e4f4', '#555a70', w=7, gap=11)
k.shape(rect(496, 506, 288, 22), '#ffffff', '#555a70', w=6, gap=9)


def martini(x, y, s=1.0, liquid='#a9e6ff'):
    """(x, y) — середина кромки бокала"""
    k.shape([(x - 46 * s, y), (x + 46 * s, y), (x, y + 52 * s)], liquid, '#456', w=5 * s, gap=8, smooth=False, amp=1.2)
    k.line([(x, y + 52 * s), (x, y + 98 * s)], '#456', w=5 * s, amp=0.6, twice=False)
    k.line([(x - 26 * s, y + 100 * s), (x + 26 * s, y + 100 * s)], '#456', w=6 * s, amp=0.6, twice=False)
    k.line([(x - 8 * s, y - 26 * s), (x + 4 * s, y + 36 * s)], '#8a5a2a', w=3 * s, amp=0.3, twice=False)
    k.shape(ell(x + 3 * s, y + 20 * s, 12 * s, 9 * s, 10), '#6cae3a', '#2f5a10', w=3 * s, gap=5)
    k.dot(x + 3 * s, y + 20 * s, 3 * s, '#c0392b')


def bottle(x, yb, s=1.0):
    k.shape([(x - 24 * s, yb), (x + 24 * s, yb), (x + 24 * s, yb - 80 * s), (x + 10 * s, yb - 110 * s), (x + 10 * s, yb - 150 * s),
             (x - 10 * s, yb - 150 * s), (x - 10 * s, yb - 110 * s), (x - 24 * s, yb - 80 * s)], '#5fb35a', '#235a1c', w=5 * s, gap=9, smooth=False, amp=1.2)
    k.shape(rect(x - 12 * s, yb - 162 * s, 24 * s, 14 * s), '#c0392b', '#7a1a12', w=3 * s, gap=6)
    k.shape(rect(x - 20 * s, yb - 72 * s, 40 * s, 42 * s), '#fff3b0', '#8a7a2a', w=3 * s, gap=6)
    for dx in (-10, 0, 10):
        k.line([(x + dx * s, yb - 34 * s), (x + dx * 0.4 * s, yb - 64 * s)], '#2f8a3a', w=3 * s, amp=0.3, twice=False)


# тётя-«богиня» на тумбе
hx, hy, R = person(k, 640, 506, 1.12, dress='#ff3d9a', armL=(-70, -70), armR=(72, -28), mood='open', hair='#b5651d', hair_style='long',
                   legs=((-22, 0), (24, 0)), cheeks=True, shoes='#7a1a50')
# длинные пряди по бокам лица
for sg in (-1, 1):
    k.shape([(hx + sg * R * 0.92, hy - R * 0.1), (hx + sg * R * 1.32, hy + R * 0.9), (hx + sg * R * 1.18, hy + R * 2.0),
             (hx + sg * R * 0.62, hy + R * 1.7), (hx + sg * R * 0.74, hy + R * 0.5)], '#b5651d', '#6a3a10', w=4, gap=8, smooth=False, amp=1.2)
# золотая корона
cx, cy = hx, hy - R * 1.12
k.shape([(cx - 36, cy), (cx - 38, cy - 34), (cx - 18, cy - 16), (cx, cy - 44), (cx + 18, cy - 16), (cx + 38, cy - 34), (cx + 36, cy)], '#ffd43b', '#c79a00',
        w=5, gap=7, smooth=False, amp=1.2)
for (dx, c) in [(-38, '#e3242c'), (0, '#3a8ae0'), (38, '#e3242c')]:
    k.dot(cx + dx, cy - 34 if abs(dx) > 1 else cy - 44, 5, c)
for (dx, dy) in [(-70, -40), (70, -50), (0, -90)]:
    sparkle(k, cx + dx, cy + dy, 13, '#ffd43b', 5)
star(k, cx, cy - 120, 20)
# бокал в левой руке (над головой слева), бутылка в правой
martini(520, 186, 1.0)
bottle(752, 338, 1.0)

# столик справа с двумя бокалами
tx, ty = 1090, 530
k.shape(ell(tx, ty, 130, 24, 18), '#f4f4fb', '#556', w=6, gap=9)
k.line([(tx, ty + 24), (tx, 650)], '#556', w=10, amp=1, twice=False)
k.shape(ell(tx, 652, 70, 12, 14), '#556', '#223', w=4, gap=7)
martini(1040, ty - 100 * 0.8 - 6, 0.8)
martini(1136, ty - 100 * 0.8 - 2, 0.8, '#ffe9a0')

# звёздочки по стене
for (sx, sy, Rr) in [(400, 180, 12), (880, 60, 12), (1230, 220, 13), (380, 80, 10)]:
    star(k, sx, sy, Rr)

k.save('/tmp/narisoval/2400', 'media/img/narisoval/r3_2400_sinij.webp')
