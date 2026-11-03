import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Я так видел» 400: Mitsubishi (три красных ромба, сходящихся в центре). Фон — голубое небо; дополнения Васи: весёлые рожицы на ромбах,
# радуга, солнце, облака, травка. Букв и названия бренда нет.
k = Kid(seed=4001)
k.fill(rect(-20, -20, W + 40, H + 40), '#a9ddff', gap=11, angle=-8)

# радуга
for i, c in enumerate(['#e3242c', '#ff8a00', '#ffd43b', '#46a84f', '#3a8ae0', '#7a3fc0']):
    r = 470 - i * 26
    k.line(ell(640, 610, r, r, 30, a0=180, a1=360), c, w=24, amp=1.6, twice=False)

# солнце и облака
SXc, SYc = 130, 120
for a in range(0, 360, 30):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.line([(SXc + 64 * ca, SYc + 64 * sa), (SXc + 96 * ca, SYc + 96 * sa)], '#f2a900', w=7, amp=1.0, twice=False)
k.shape(ell(SXc, SYc, 48, 48, 18), '#ffd43b', '#e08a00', w=6, gap=9)
k.cloud(1090, 140, 1.0, '#4a90d9', '#ffffff')
k.cloud(250, 330, 0.7, '#4a90d9', '#ffffff')
k.cloud(1180, 400, 0.6, '#4a90d9', '#ffffff')

k.grass_band(612, '#46a84f', 11)


def diamond(cx, cy, ang, a=115, b=66):
    u = (math.cos(math.radians(ang)), math.sin(math.radians(ang)))
    v = (-u[1], u[0])
    mid = (cx + u[0] * a, cy + u[1] * a)
    far = (cx + u[0] * 2 * a, cy + u[1] * 2 * a)
    return [(cx, cy), (mid[0] + v[0] * b, mid[1] + v[1] * b), far, (mid[0] - v[0] * b, mid[1] - v[1] * b)]


CX, CY = 640, 380
for ang in (-90, 150, 30):
    k.shape(diamond(CX, CY, ang), '#e3242c', '#7a1018', w=9, gap=11, smooth=False, amp=2.4)
# весёлые рожицы на ромбах
for ang in (-90, 150, 30):
    fx, fy = CX + math.cos(math.radians(ang)) * 115, CY + math.sin(math.radians(ang)) * 115
    k.dot(fx - 15, fy - 8, 6, '#fff'); k.dot(fx + 15, fy - 8, 6, '#fff')
    k.dot(fx - 15, fy - 8, 3, '#111'); k.dot(fx + 15, fy - 8, 3, '#111')
    k.smile(fx, fy + 12, 40, 14, '#ffd0d0', 5)

# цветочки на травке
def flower(x, y, c, r=14):
    k.line([(x, y + r), (x + k.J(6), y + r + 34)], '#2f8a3a', w=6, amp=1.2, twice=False)
    for a in range(0, 360, 72):
        k.shape(ell(x + r * 0.95 * math.cos(math.radians(a)), y + r * 0.95 * math.sin(math.radians(a)), r * 0.62, r * 0.62, 8), c, None)
    k.shape(ell(x, y, r * 0.55, r * 0.55, 8), '#ffd43b', '#c79a00', w=3, gap=6)


for (x, y, c) in [(90, 660, '#ffffff'), (240, 690, '#f28cb1'), (420, 650, '#ff8a00'), (880, 664, '#ffffff'), (1050, 690, '#f28cb1'), (1200, 656, '#8e5bd0')]:
    flower(x, y, c)

signature(k, 1262, 66, 30, '#4a4a4a')
k.save('/tmp/takvidel/400', 'media/img/takvidel/r2_400_mitsubishi.webp')
