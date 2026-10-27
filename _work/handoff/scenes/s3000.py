import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=3000)
# голубое небо на весь фон
sky = [(-20, -20), (W + 20, -20), (W + 20, 610), (-20, 620)]
k.fill(sky, '#8fd0f2', gap=13, angle=8, op=0.9)
k.fill(sky, '#8fd0f2', gap=15, angle=-40, op=0.7)
k.cloud(210, 80, 0.8, '#ffffff', '#ffffff')
k.cloud(1090, 70, 0.7, '#ffffff', '#ffffff')

# сад: трава и цветы
k.grass_band(600, '#4fae52', 12)
def flower(x, y, c, r=14):
    k.line([(x, y + r), (x + k.J(6), y + r + 36)], '#2f8a3a', w=6, amp=1.2, twice=False)
    for a in range(0, 360, 72):
        k.shape(ell(x + r * 0.95 * math.cos(math.radians(a)), y + r * 0.95 * math.sin(math.radians(a)), r * 0.62, r * 0.62, 8), c, None)
    k.shape(ell(x, y, r * 0.55, r * 0.55, 8), '#ffd43b', '#c79a00', w=3, gap=6)
for (x, y, c) in [(60, 640, '#e23b3b'), (170, 690, '#f28cb1'), (330, 676, '#8e5bd0'), (440, 700, '#ff8a00'), (560, 686, '#e23b3b'), (720, 700, '#f28cb1'),
                  (860, 684, '#ff8a00'), (960, 700, '#8e5bd0'), (1090, 672, '#e23b3b'), (1200, 700, '#f28cb1'), (1220, 630, '#ff8a00'), (30, 700, '#8e5bd0')]:
    flower(x, y, c)

# --- яркая звезда над воротами ---
cx, cy = 640, 66
for a in range(0, 360, 30):
    k.line([(cx + 62 * math.cos(math.radians(a)), cy + 62 * math.sin(math.radians(a))), (cx + 88 * math.cos(math.radians(a)), cy + 88 * math.sin(math.radians(a)))], '#ffb020', w=7, twice=False, amp=1)
k.shape(star5(cx, cy, 54, 24), '#ffe14a', '#e08a00', w=7, gap=8, smooth=False, amp=1.5)

# --- прозрачные ворота ---
arch = [(530, 470), (530, 270)] + ell(640, 270, 110, 120, 14, a0=180, a1=360)[1:-1] + [(750, 270), (750, 470)]
k.solid(arch, '#f4fcff')
k.fill(arch, '#d6f2fb', gap=14, angle=60, op=0.7)
k.line(arch, '#d6a300', w=12, closed=True, amp=2)
for (x0, y0, x1, y1) in [(570, 330, 610, 290), (590, 410, 650, 340), (650, 440, 720, 360)]:
    k.line([(x0, y0), (x1, y1)], '#ffffff', w=8, twice=False, amp=1)                 # блики стекла
k.line([(640, 150), (640, 470)], '#d6a300', w=5, twice=False, amp=1)
for (x, y) in [(560, 200), (730, 220), (520, 140), (760, 150)]:
    k.shape(star5(x, y, 13), '#ffd43b', None)

# --- огнегривый лев (слева) ---
LX, LY = 250, 480
mane1 = []
for i in range(24):
    a = math.radians(i * 15 - 90)
    r = 140 if i % 2 == 0 else 100
    mane1.append((LX + r * math.cos(a) * 1.0, LY + r * math.sin(a) * 0.95))
k.shape(mane1, '#e8502a', '#8a2a10', w=7, gap=10, smooth=False, amp=2)
mane2 = []
for i in range(24):
    a = math.radians(i * 15 - 90 + 7)
    r = 112 if i % 2 == 0 else 82
    mane2.append((LX + r * math.cos(a), LY + r * math.sin(a) * 0.95))
k.shape(mane2, '#ffa020', None, gap=9, smooth=False)
k.shape(ell(LX, LY + 4, 66, 62, 18), '#ffd27a', '#9b6a10', w=7, gap=9)
for ex in (-46, 46):
    k.shape(ell(LX + ex, LY - 52, 18, 18, 10), '#ffd27a', '#9b6a10', w=5, gap=8)
k.dot(LX - 24, LY - 8, 7); k.dot(LX + 24, LY - 8, 7)
k.shape([(LX - 14, LY + 16), (LX + 14, LY + 16), (LX, LY + 32)], '#a0522d', '#4a2a10', w=4, gap=7, smooth=False)
k.line([(LX, LY + 32), (LX, LY + 44)], '#4a2a10', w=4, twice=False)
k.line([(LX - 26, LY + 48), (LX, LY + 62), (LX + 26, LY + 48)], '#4a2a10', w=5, amp=1, twice=False)
for (dx, dy, ex2, ey2) in [(-34, 30, -70, 22), (-34, 40, -72, 44), (34, 30, 70, 22), (34, 40, 72, 44)]:
    k.line([(LX + dx, LY + dy), (LX + ex2, LY + ey2)], '#4a2a10', w=3, twice=False, amp=0.6)
k.shape(ell(LX, 640, 112, 58, 18), '#ffc04a', '#9b6a10', w=7, gap=10)
k.shape(rect(LX - 70, 650, 40, 44), '#ffc04a', '#9b6a10', w=6, gap=9); k.shape(rect(LX + 30, 650, 40, 44), '#ffc04a', '#9b6a10', w=6, gap=9)
k.line([(LX + 108, 632), (LX + 146, 596), (LX + 150, 556)], '#9b6a10', w=9, amp=2)
k.shape(ell(LX + 150, 546, 18, 24, 10), '#e8502a', '#8a2a10', w=5, gap=8)

# --- вол, исполненный очей (в центре) ---
OX, OY = 650, 590
for dx in (-110, -70, 78, 118):
    k.shape(rect(OX + dx - 16, OY + 40, 32, 80), '#1f3f8a', '#0e1f4a', w=6, gap=9)
    k.shape(rect(OX + dx - 18, OY + 108, 36, 14), '#222222', None)
k.line([(OX + 150, OY - 20), (OX + 190, OY + 20), (OX + 180, OY + 90)], '#1c3f94', w=9, amp=2)
k.shape(ell(OX + 182, OY + 98, 16, 24, 10), '#1c3f94', '#0e1f4a', w=4, gap=7)
k.shape(ell(OX, OY, 158, 84, 24), '#2f5fc0', '#142a66', w=9, gap=12)
HX, HY = OX - 190, OY - 38
k.line([(HX + 20, HY - 40), (HX + 8, HY - 90), (HX - 30, HY - 98)], '#f1e8cf', w=14, amp=1.5)             # рога
k.line([(HX + 62, HY - 36), (HX + 82, HY - 86), (HX + 120, HY - 90)], '#f1e8cf', w=14, amp=1.5)
k.shape(ell(HX - 4, HY - 20, 18, 12, 10, rot=-20), '#3f70d0', '#142a66', w=5, gap=8)                   # уши
k.shape(ell(HX + 80, HY - 18, 18, 12, 10, rot=20), '#3f70d0', '#142a66', w=5, gap=8)
k.shape(ell(HX + 40, HY + 8, 58, 52, 20), '#3f70d0', '#142a66', w=8, gap=11)
k.shape(ell(HX + 24, HY + 34, 34, 24, 14), '#c7d8f5', '#5a78b0', w=5, gap=9)
k.dot(HX + 14, HY + 36, 4); k.dot(HX + 34, HY + 36, 4)
# много глаз по всему тулову
eyes = [(HX + 22, HY - 6, 16), (HX + 62, HY - 6, 16)]
pts = []
tries = 0
while len(pts) < 16 and tries < 600:
    tries += 1
    ang = k.r.uniform(0, 2 * math.pi); rr = math.sqrt(k.r.random())
    x, y = OX + 128 * rr * math.cos(ang), OY + 58 * rr * math.sin(ang)
    if all(math.hypot(x - px, y - py) > 40 for px, py, _ in pts):
        pts.append((x, y, k.r.uniform(11, 15)))
eyes += pts + [(OX - 110, OY + 78, 10), (OX + 80, OY + 84, 10)]
for (ex, ey, er) in eyes:
    k.shape(ell(ex, ey, er, er, 12), '#ffffff', '#111', w=4, gap=6)
    k.dot(ex + k.J(2), ey + k.J(2), er * 0.45, '#111')

# --- золотой орёл (справа в небе) ---
EX, EY = 1040, 330
def wing(flip):
    T = Xf(EX, EY, 1.0, 0, flip)
    pts = [(30, -30), (110, -96), (190, -110), (232, -78), (206, -60), (246, -34), (208, -18), (238, 14), (192, 26), (212, 58), (150, 52), (90, 40), (30, 30)]
    k.shape(T(pts), '#f5b400', '#6b3a00', w=8, gap=10, smooth=False, amp=1.8)
    for (a, b) in [((60, -10), (200, -60)), ((60, 8), (200, -20)), ((60, 22), (190, 24))]:
        k.line(T([a, b]), '#b87a00', w=4, twice=False, amp=1)
wing(False); wing(True)
k.shape([(EX - 30, EY + 60), (EX + 30, EY + 60), (EX + 44, EY + 132), (EX, EY + 156), (EX - 44, EY + 132)], '#f5b400', '#6b3a00', w=7, gap=9, smooth=False)
k.shape(ell(EX, EY, 52, 80, 20), '#f5b400', '#6b3a00', w=8, gap=10)
k.shape(ell(EX, EY + 18, 30, 50, 14), '#ffe08a', None)
k.shape(ell(EX, EY - 94, 34, 32, 14), '#ffd34a', '#6b3a00', w=7, gap=9)
k.shape([(EX + 12, EY - 108), (EX + 66, EY - 92), (EX + 60, EY - 70), (EX + 44, EY - 82), (EX + 14, EY - 78)], '#ff8a00', '#7a3a00', w=5, gap=7, smooth=False)  # крючковатый клюв
k.shape(ell(EX - 8, EY - 102, 9, 9, 10), '#ffffff', '#111', w=3, gap=5); k.dot(EX - 6, EY - 102, 4)
k.line([(EX - 24, EY - 120), (EX + 8, EY - 106)], '#6b3a00', w=6, twice=False, amp=0.8)                                                          # грозная бровь
for sx in (-22, 22):                                                                                                                              # лапы с когтями
    k.line([(EX + sx, EY + 70), (EX + sx * 1.3, EY + 118)], '#ff8a00', w=9, amp=1, twice=False)
    for cdx in (-12, 0, 12):
        k.line([(EX + sx * 1.3, EY + 118), (EX + sx * 1.3 + cdx, EY + 138)], '#7a3a00', w=5, twice=False, amp=0.6)

k.save('/tmp/narisoval/3000', 'media/img/narisoval/r3_3000_gorod.webp')
