import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=2701)
# --- серое осеннее небо (без листьев: слово из названия не рисуем) ---
sky = [(-20, -20), (W + 20, -20), (W + 20, 500), (-20, 510)]
k.fill(sky, '#b8c4d8', gap=13, angle=8, op=0.9)
k.fill(sky, '#b8c4d8', gap=15, angle=-40, op=0.7)

def cloud(cx, cy, s, fill='#f4f6fa', line='#6f7f99', face=False):
    pts = []
    for (dx, dy, r) in [(-90, 12, 44), (-40, -26, 56), (26, -34, 60), (84, -2, 50), (130, 18, 36)]:
        pts += ell(cx + dx * s, cy + dy * s, r * s, r * s, 10, a0=190, a1=350)
    pts += [(cx + 150 * s, cy + 52 * s), (cx - 120 * s, cy + 56 * s)]
    k.shape(pts, fill, line, w=7, amp=2.0, gap=10)
cloud(640, 92, 0.85)

# --- горящие корабли в небе ---
def flame(x, y, s):
    for (sc, col, ln) in [(1.0, '#e8402a', '#8a1a0a'), (0.68, '#ff9a1f', None), (0.38, '#ffe14a', None)]:
        pts = [(-26, 30), (-14, -10), (-22, -40), (-2, -20), (4, -70), (14, -30), (30, -44), (26, 30)]
        k.shape([(x + px * s * sc, y + py * s * sc + (1 - sc) * 24 * s) for px, py in pts], col, ln, w=4, gap=7, smooth=False, amp=1.2)
def ship(x, y, s):
    T = Xf(x, y, s)
    k.line(T([(130, -6), (200, -34)]), '#47280e', w=8, amp=1.2, twice=False)                                     # бушприт
    k.shape(T([(-140, -8), (140, -8), (116, 44), (60, 62), (-60, 62), (-116, 44)]), '#8a5a2b', '#47280e', w=8, gap=11)    # корпус
    for yy in (14, 34):
        k.line(T([(-120, yy), (120, yy)]), '#47280e', w=4, twice=False, amp=1)
    k.line(T([(0, -8), (0, -240)]), '#47280e', w=10, amp=1.2)                                                     # мачта
    k.shape(T([(-8, -222), (-8, -44), (-128, -44)]), '#f4efe0', '#47280e', w=6, gap=9, smooth=False)             # паруса
    k.shape(T([(8, -200), (8, -44), (110, -44)]), '#f4efe0', '#47280e', w=6, gap=9, smooth=False)
    k.shape(T([(0, -240), (0, -276), (46, -258)]), '#c0392b', '#7a1a10', w=4, gap=7, smooth=False)               # флажок
    for (fx, fy, fs) in [(-70, -100, 0.9), (-36, -160, 0.8), (58, -92, 0.9), (76, -50, 0.7), (-100, -52, 0.7)]:
        fx2, fy2 = T([(fx, fy)])[0]
        flame(fx2, fy2, fs * s)
    for (ox, oy) in [(-60, -210), (60, -186)]:                                                                     # дым
        sx, sy = T([(ox, oy)])[0]
        k.line([(sx, sy), (sx + 22 * s, sy - 44 * s), (sx - 12 * s, sy - 90 * s), (sx + 20 * s, sy - 136 * s)], '#6a6a76', w=15 * s, amp=2.5)
        k.shape(ell(sx + 18 * s, sy - 150 * s, 24 * s, 18 * s, 10), '#8a8a96', None)
ship(215, 232, 0.62); ship(1075, 190, 0.55)

# --- земля, лужа, камни ---
ground = [(-20, 468), (W + 20, 460), (W + 20, H + 20), (-20, H + 20)]
k.fill(ground, '#9a9486', gap=12, angle=-6, op=0.95)
k.fill(ground, '#9a9486', gap=14, angle=40, op=0.7)
k.line([(-20, 468), (W + 20, 460)], '#5a554a', w=6, amp=2)
PX, PY, PRX, PRY = 640, 604, 360, 92
puddle = ell(PX, PY, PRX, PRY, 30)
k.solid(puddle, '#a9dcf5', smooth=True)
k.fill(puddle, '#8fd0f2', gap=11, angle=5, op=0.8)
k.line(puddle, '#3f6a9e', w=10, closed=True, amp=2.4)
# небо в луже: облака, птицы и плачущее небо под ногами
for (cx2, cy2, s2) in [(450, 590, 0.30), (830, 600, 0.30), (730, 548, 0.22)]:
    cloud(cx2, cy2, s2, '#ffffff', '#7fa6cf')
cloud(640, 606, 0.42, '#ffffff', '#6f93b8')
def bird(x, y, s):
    k.line([(x - 18 * s, y - 4 * s), (x - 8 * s, y - 14 * s), (x, y), (x + 8 * s, y - 14 * s), (x + 18 * s, y - 4 * s)], '#1b1b22', w=5 * s + 2, amp=0.8, twice=False)
for (x, y, s) in [(430, 640, 0.9), (540, 560, 0.8), (780, 640, 0.9), (870, 578, 0.8), (580, 650, 0.7), (700, 648, 0.7)]:
    bird(x, y, s)                                                                               # отражения
for (x, y, s) in [(500, 520, 1.7), (590, 420, 1.5), (690, 500, 2.0), (790, 400, 1.6), (900, 490, 1.8), (400, 430, 1.4)]:
    bird(x, y, s)                                                                               # птицы разлетаются
for (x, y, rx, ry) in [(110, 612, 74, 46), (1186, 604, 86, 54), (255, 692, 54, 30), (1012, 694, 62, 32)]:
    k.shape(ell(x, y, rx, ry, 16), '#9aa0ab', '#4a4f5a', w=7, gap=10)
    k.line([(x - rx * 0.5, y - ry * 0.3), (x - rx * 0.1, y - ry * 0.6)], '#d8dce4', w=6, twice=False, amp=1)


# --- ветер вновь играет рваными цепями ---
for (x0, y0) in [(300, 262), (330, 352), (940, 280)]:
    k.line([(x0, y0), (x0 + 70, y0 - 16), (x0 + 140, y0 + 6), (x0 + 210, y0 - 14)], '#ffffff', w=7, amp=2.4, twice=False)
links = []
for i in range(15):
    t = i / 14.0
    x = 360 + 560 * t
    y = 318 + 34 * math.sin(t * 2 * math.pi * 1.1)
    links.append((x, y))
for i, (x, y) in enumerate(links):
    if i == 14:
        k.line(ell(x, y, 26, 15, 14, a0=40, a1=320), '#3d424d', w=9, amp=1.2)                 # последнее звено порвано
    elif i % 2 == 0:
        k.line(ell(x, y, 27, 15, 14), '#3d424d', w=9, closed=True, amp=1.2)
    else:
        k.line(ell(x, y, 13, 21, 14), '#3d424d', w=9, closed=True, amp=1.2)

k.save('/tmp/narisoval/2700', 'media/img/narisoval/r3_2700_osen.webp')
