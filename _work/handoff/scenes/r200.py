import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Я так видел» 200: Lacoste (зелёный крокодильчик). Тетрадная клетка, солнце, мячик, подпись «ВАСЯ 6 ЛЕТ». Букв и названия бренда нет.
k = Kid(seed=2001, paper='#fbfbf4')
grid_paper(k)

# солнце
SXc, SYc = 170, 140
for a in range(0, 360, 30):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.line([(SXc + 66 * ca, SYc + 66 * sa), (SXc + 100 * ca, SYc + 100 * sa)], '#f2a900', w=7, amp=1.0, twice=False)
k.shape(ell(SXc, SYc, 50, 50, 18), '#ffd43b', '#e08a00', w=6, gap=9)
k.dot(SXc - 16, SYc - 6, 5); k.dot(SXc + 16, SYc - 6, 5)
k.smile(SXc, SYc + 12, 40, 14, '#c0392b', 5)
k.cloud(930, 120, 1.0, '#4a90d9', '#e8f4ff')
k.cloud(1090, 220, 0.7, '#4a90d9', '#e8f4ff')

k.grass_band(600, '#46a84f', 11)

# --- крокодильчик (смотрит вправо), локальные координаты → Xf ---
s = 1.35
T = Xf(532, 414, s)
G, GD, GL = '#2fa04c', '#145f2a', '#9be08f'


def leg(pts, w=36):
    k.line(T(pts), GD, w=(w + 10) * s * 0.75, amp=1.0, twice=False)
    k.line(T(pts), G, w=w * s * 0.75, amp=1.0, twice=False)


# дальние лапы (потемнее)
leg([(205, 45), (228, 98), (262, 112)], 30)
leg([(-130, 35), (-120, 92), (-86, 108)], 30)
# нижняя челюсть и пасть
k.shape(T([(290, -18), (330, 12), (400, 20), (420, 6), (386, -6), (330, -8)]), G, GD, w=7, gap=10, smooth=False, amp=1.6)
k.shape(T([(292, -18), (402, -22), (422, -4), (400, 14), (332, 8)]), '#c0392b', None, gap=8, smooth=False)
# туловище + верхняя челюсть
body = [(-300, -110), (-250, -80), (-190, -45), (-120, -30), (-50, -40), (20, -55), (90, -60), (150, -55), (200, -62), (250, -72), (310, -70),
        (370, -58), (420, -48), (432, -30), (400, -22), (340, -24), (290, -18), (250, 10), (210, 35), (170, 50), (110, 60), (40, 62),
        (-30, 58), (-100, 50), (-170, 20), (-230, -25), (-280, -75)]
k.shape(T(body), G, GD, w=8, gap=11, amp=2.4)
# светлое брюшко
k.shape(T([(-90, 46), (-20, 52), (50, 52), (120, 50), (180, 40), (215, 24), (160, 34), (80, 40), (0, 40), (-60, 36)]), GL, None, gap=8, smooth=False)
# гребень на спине
back = [(-250, -80), (-190, -45), (-120, -30), (-50, -40), (20, -55), (90, -60), (150, -55), (200, -62), (250, -72)]


def back_y(x):
    for (x0, y0), (x1, y1) in zip(back, back[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return back[-1][1]


for x in range(-240, 240, 36):
    y = back_y(x)
    k.shape(T([(x - 15, y + 6), (x + 2, y - 30), (x + 17, y + 6)]), GD, GD, w=4, gap=6, smooth=False, amp=1.0)
# зубы (сверху и снизу)
for x in range(300, 410, 22):
    k.shape(T([(x, -22), (x + 9, -2), (x + 18, -22)]), '#ffffff', '#555', w=3, gap=6, smooth=False, amp=0.8)
for x in range(336, 400, 24):
    k.shape(T([(x, 10), (x + 8, -8), (x + 16, 12)]), '#ffffff', '#555', w=3, gap=6, smooth=False, amp=0.8)
# глаз и ноздря
ex, ey = T.p((276, -50))
k.shape(ell(ex, ey, 17, 15, 12), '#ffffff', '#222', w=4, gap=7)
k.dot(ex + 5, ey, 6, '#111')
k.line(T([(246, -70), (276, -80), (304, -66)]), GD, w=7, amp=0.8, twice=False)
nx, ny = T.p((412, -44))
k.dot(nx, ny, 5, '#145f2a')
# чешуя на боку
for (x, y) in [(-120, -2), (-60, 8), (0, 6), (60, 4), (120, 0), (-170, -16)]:
    k.line(T([(x - 14, y), (x, y + 12), (x + 14, y)]), GD, w=5, amp=0.6, twice=False)
# ближние лапы
leg([(150, 50), (172, 105), (208, 124)])
leg([(-70, 50), (-60, 108), (-26, 126)])
# коготки
for (x, y) in [(208, 124), (-26, 126), (262, 112), (-86, 108)]:
    for dy in (-8, 0, 8):
        k.line(T([(x + 12, y + dy), (x + 24, y + dy + 3)]), '#ffffff', w=5, amp=0.3, twice=False)

# --- дополнения Васи: теннисный мячик, цветочки, птичка ---
bx, by = 1010, 640
k.shape(ell(bx, by, 34, 34, 14), '#d8ea3c', '#8a9a10', w=5, gap=8)
k.line(ell(bx - 38, by, 34, 34, 10, a0=-50, a1=50), '#ffffff', w=5, amp=0.5, twice=False)
k.line(ell(bx + 38, by, 34, 34, 10, a0=130, a1=230), '#ffffff', w=5, amp=0.5, twice=False)


def flower(x, y, c, r=15):
    k.line([(x, y + r), (x + k.J(6), y + r + 38)], '#2f8a3a', w=6, amp=1.2, twice=False)
    for a in range(0, 360, 72):
        k.shape(ell(x + r * 0.95 * math.cos(math.radians(a)), y + r * 0.95 * math.sin(math.radians(a)), r * 0.62, r * 0.62, 8), c, None)
    k.shape(ell(x, y, r * 0.55, r * 0.55, 8), '#ffd43b', '#c79a00', w=3, gap=6)


for (x, y, c) in [(80, 640, '#e23b3b'), (200, 676, '#f28cb1'), (330, 650, '#8e5bd0'), (800, 662, '#ff8a00'), (1130, 650, '#e23b3b')]:
    flower(x, y, c)
k.line([(640, 70), (660, 56), (680, 72)], '#444', w=5, amp=0.6, twice=False)
k.line([(710, 100), (728, 86), (748, 102)], '#444', w=5, amp=0.6, twice=False)

signature(k, 1262, 66, 30, '#686868')
k.save('/tmp/takvidel/200', 'media/img/takvidel/r2_200_lacoste.webp')
