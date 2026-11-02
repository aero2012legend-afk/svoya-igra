import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=1801)
night(k, '#1b2158')
for (sx, sy, R) in [(700, 40, 12), (980, 70, 13), (1230, 40, 12), (860, 190, 10)]:
    star(k, sx, sy, R)
# лучи светомузыки
for (pts, c) in [([(1010, -10), (1070, -10), (760, 330), (700, 330)], '#ff5fa2'),
                 ([(1150, -10), (1210, -10), (1260, 420), (1130, 420)], '#4fd0ff'),
                 ([(900, -10), (940, -10), (1010, 380), (900, 380)], '#ffd43b')]:
    k.fill(pts, c, gap=15, op=0.38)

# --- панельная многоэтажка с балконами (как в клипе: все танцуют на балконах) ---
k.shape(rect(30, 60, 640, 650), '#bdb6a8', '#5e594e', w=9, gap=13)
LIGHT = ['#ff9ec7', '#8fe6ff', '#ffe27a', '#c9a8ff']


def stick(x, y, h, arms='up', col='#222'):
    k.shape(ell(x, y - h, h * 0.16, h * 0.16, 12), SKIN, SKIND, w=4, gap=7)
    k.line([(x, y - h * 0.84), (x, y - h * 0.38)], col, w=8, amp=0.8, twice=False)
    k.line([(x, y - h * 0.38), (x - h * 0.16, y)], col, w=7, amp=0.8, twice=False)
    k.line([(x, y - h * 0.38), (x + h * 0.16, y)], col, w=7, amp=0.8, twice=False)
    if arms == 'up':
        k.line([(x, y - h * 0.74), (x - h * 0.28, y - h * 0.98)], col, w=7, amp=0.6, twice=False)
        k.line([(x, y - h * 0.74), (x + h * 0.28, y - h * 0.98)], col, w=7, amp=0.6, twice=False)
    else:
        k.line([(x, y - h * 0.74), (x - h * 0.3, y - h * 0.5)], col, w=7, amp=0.6, twice=False)
        k.line([(x, y - h * 0.74), (x + h * 0.3, y - h * 0.62)], col, w=7, amp=0.6, twice=False)


def balcony(cx, top, kind, ci):
    w, h = 176, 190
    k.shape(rect(cx, top, w, h - 18), LIGHT[ci % 4], '#5e594e', w=6, gap=10)
    base = top + h - 22
    if kind == 'dj':
        k.shape(rect(cx + 18, base - 52, w - 36, 36), '#3a3a46', '#000', w=5, gap=8)
        for dx in (46, 112):
            k.shape(ell(cx + dx, base - 52, 20, 7, 10), '#c7ccd6', '#333', w=3, gap=6)
        k.shape(ell(cx + w / 2, base - 112, 17, 17, 12), SKIN, SKIND, w=4, gap=7)
        k.line(ell(cx + w / 2, base - 114, 25, 25, 12, a0=180, a1=360), '#111', w=7, amp=0.6, twice=False)
        k.dot(cx + w / 2 - 25, base - 110, 9, '#111'); k.dot(cx + w / 2 + 25, base - 110, 9, '#111')
        k.line([(cx + w / 2, base - 94), (cx + w / 2, base - 56)], '#222', w=9, amp=0.6, twice=False)
    elif kind == 'ball':
        k.line([(cx + w / 2 - 36, top + 4), (cx + w / 2 - 36, top + 22)], '#777', w=3, amp=0.4, twice=False)
        k.shape(ell(cx + w / 2 - 36, top + 42, 20, 20, 12), '#cfd5e6', '#555a70', w=4, gap=7)
        stick(cx + w / 2 + 28, base, 104)
    elif kind == 'speaker':
        k.shape(rect(cx + 40, base - 130, 96, 130), '#2e2e36', '#000', w=6, gap=9)
        k.shape(ell(cx + 88, base - 96, 14, 14, 10), '#888', '#222', w=3, gap=6)
        k.shape(ell(cx + 88, base - 50, 26, 26, 12), '#777', '#111', w=4, gap=7)
    elif kind == 'couple':
        stick(cx + 56, base, 100); stick(cx + 122, base, 100, 'side')
    elif kind == 'laundry':
        k.line([(cx + 8, base - 124), (cx + w - 8, base - 120)], '#555', w=3, amp=0.8, twice=False)
        k.shape([(cx + 30, base - 120), (cx + 72, base - 120), (cx + 66, base - 76), (cx + 36, base - 76)], '#ffffff', '#555', w=3, gap=6, smooth=False)
        k.shape([(cx + 96, base - 120), (cx + 112, base - 120), (cx + 108, base - 70), (cx + 98, base - 70)], '#ff5f5f', '#a02020', w=3, gap=6, smooth=False)
        k.shape([(cx + 126, base - 120), (cx + 160, base - 120), (cx + 154, base - 92), (cx + 132, base - 92)], '#8fb0ff', '#3a5aa8', w=3, gap=6, smooth=False)
        stick(cx + 90, base, 66)
    elif kind == 'cat':
        k.shape(ell(cx + 88, base - 22, 34, 22, 12), '#f0922a', '#8a4a00', w=4, gap=6)
        k.shape(ell(cx + 62, base - 40, 17, 15, 10), '#f0922a', '#8a4a00', w=4, gap=6)
        k.shape([(cx + 50, base - 52), (cx + 54, base - 68), (cx + 64, base - 54)], '#f0922a', '#8a4a00', w=3, gap=5, smooth=False)
        k.shape([(cx + 62, base - 54), (cx + 74, base - 66), (cx + 76, base - 50)], '#f0922a', '#8a4a00', w=3, gap=5, smooth=False)
        k.line([(cx + 120, base - 24), (cx + 144, base - 56)], '#f0922a', w=7, amp=0.8, twice=False)
    else:
        stick(cx + w / 2, base, 108)
    # плита и перила
    k.shape(rect(cx - 10, base, w + 20, 18), '#8a867e', '#4a463e', w=5, gap=8)
    k.line([(cx - 4, base - 46), (cx + w + 4, base - 46)], '#4a463e', w=5, amp=0.8, twice=False)
    for i in range(1, 7):
        k.line([(cx + i * w / 7, base - 46), (cx + i * w / 7, base)], '#4a463e', w=3.5, amp=0.5, twice=False)


kinds = [['dj', 'ball', 'speaker'], ['dance', 'couple', 'dance'], ['speaker', 'laundry', 'cat']]
for r, row in enumerate(kinds):
    for c, kind in enumerate(row):
        balcony(48 + c * 204, 84 + r * 205, kind, r + c)

# --- героиня: плачет, слёзы льются ручьями ---
gx, gy = 930, 650
hx, hy, R = person(k, gx, gy, 1.22, shirt='#232a3a', shirtd='#0a0e18', pants='#2a2f6a', armL=(-70, 34), armR=(54, 74), mood='cry',
                   hair='#7a3a1c', hair_style='long', legs=((-26, 0), (30, 0)))
# нашивка на рукаве (компас) на правом рукаве
cxp, cyp = gx + 40 * 1.22 + 6, gy - 188 * 1.22 + 52
k.shape(ell(cxp, cyp, 17, 17, 12), '#ffffff', '#222', w=3, gap=6)
k.line([(cxp - 12, cyp), (cxp + 12, cyp)], '#222', w=3, amp=0.3, twice=False); k.line([(cxp, cyp - 12), (cxp, cyp + 12)], '#222', w=3, amp=0.3, twice=False)
# слёзы-ручьи
for sx in (-1, 1):
    k.line([(hx + sx * R * 0.4, hy + 4), (hx + sx * R * 0.55, hy + R * 1.0), (hx + sx * R * 0.7, hy + R * 2.4), (hx + sx * R * 0.9, hy + R * 4.2)], '#4aa8ff', w=9, amp=1.2, twice=False)
for (dx, dy) in [(-90, -250), (100, -270), (130, -150), (-110, -140)]:
    k.shape(drop(gx + dx, gy + dy, 12), '#4aa8ff', '#2a6ac0', w=3, gap=6)
# лужа слёз
k.shape(ell(gx + 6, gy + 4, 140, 28, 18), '#7ec0ff', '#2a6ac0', w=6, gap=9)

# --- диджей справа: пульт + большие наушники ---
dx_, dy_ = 1170, 660
k.shape(rect(dx_ - 90, dy_ - 120, 180, 96), '#3a3a46', '#000', w=7, gap=10)
for ox in (-46, 46):
    k.shape(ell(dx_ + ox, dy_ - 120, 34, 12, 12), '#e8ecf5', '#333', w=4, gap=7)
k.line([(dx_ - 20, dy_ - 92), (dx_ + 20, dy_ - 92)], '#ff5fa2', w=7, amp=0.6, twice=False)
hxd, hyd, Rd = person(k, dx_, dy_ - 98, 0.62, shirt='#ffffff', shirtd='#999', pants='#222', mood='smile', hair='#222', armL=(-60, 30), armR=(60, 30))
k.line(ell(hxd, hyd - 4, Rd * 1.25, Rd * 1.25, 14, a0=180, a1=360), '#111', w=11, amp=0.8, twice=False)
k.shape(ell(hxd - Rd * 1.25, hyd + 4, 14, 20, 10), '#111', '#000', w=3, gap=6); k.shape(ell(hxd + Rd * 1.25, hyd + 4, 14, 20, 10), '#111', '#000', w=3, gap=6)

# --- кроссовки «бывшего» и «новой»: шахматка и галочка ---
for (sx, sy, fl) in [(640, 690, False)]:
    pass
k.shape([(700, 690), (700, 654), (726, 648), (752, 636), (782, 654), (822, 664), (830, 684), (822, 690)], '#ffffff', '#222', w=5, gap=9, smooth=False, amp=1.4)
for i in range(4):
    for j in range(2):
        if (i + j) % 2 == 0:
            k.shape(rect(704 + i * 30, 662 + j * 14, 24, 14), '#111', None, gap=5)
k.shape([(560, 690), (560, 654), (586, 648), (612, 636), (642, 654), (682, 664), (690, 684), (682, 690)], '#f4f4f8', '#222', w=5, gap=9, smooth=False, amp=1.4)
k.line([(590, 666), (606, 678), (650, 658)], '#111', w=8, amp=0.6, twice=False)

# слёзы капают с неба — брызги по всей картине
for (x, y) in [(60, 40), (360, 30), (600, 20)]:
    pass

k.save('/tmp/narisoval/1800', 'media/img/narisoval/r3_1800_tehno.webp')
