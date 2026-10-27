import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=2700)
# серое небо, тучи закрывают свет
sky = [(-20, -20), (W + 20, -20), (W + 20, 500), (-20, 510)]
k.fill(sky, '#c9d3e2', gap=13, angle=8, op=0.8)

def cloud(cx, cy, s):
    pts = []
    for (dx, dy, r) in [(-90, 12, 44), (-40, -26, 56), (26, -34, 60), (84, -2, 50), (130, 18, 36)]:
        pts += ell(cx + dx * s, cy + dy * s, r * s, r * s, 10, a0=190, a1=350)
    pts += [(cx + 150 * s, cy + 52 * s), (cx - 120 * s, cy + 56 * s)]
    k.shape(pts, '#f4f6fa', '#6f7f99', w=8, amp=2.2, gap=10)
cloud(250, 120, 1.0); cloud(700, 80, 1.15); cloud(1090, 140, 0.95)

# земля: растрескавшаяся, снег и лёд
ground = [(-20, 480), (W + 20, 470), (W + 20, H + 20), (-20, H + 20)]
k.fill(ground, '#a98760', gap=12, angle=-6)
for pts in ([(40, 640), (90, 610), (70, 575), (130, 545)], [(330, 640), (370, 620), (350, 600), (400, 590)], [(850, 630), (880, 650), (860, 680)], [(1130, 700), (1100, 670), (1130, 640)], [(215, 640), (190, 610), (230, 590)], [(450, 690), (420, 665), (460, 645)], [(660, 690), (700, 670), (680, 650)], [(260, 700), (310, 660), (290, 628)], [(900, 690), (960, 650), (940, 615), (1010, 590)],
            [(1160, 650), (1200, 610), (1180, 570)], [(500, 690), (540, 670), (520, 650), (580, 640)], [(780, 700), (830, 676), (812, 650)]):
    k.line(pts, '#4a3018', w=6, amp=2, smooth=False, twice=False)
def ice(x, y, w, h):
    k.shape([(x, y + h * 0.3), (x + w * 0.3, y), (x + w, y + h * 0.15), (x + w * 0.9, y + h), (x + w * 0.2, y + h * 0.9)], '#d4e6f2', '#6f93b0', w=6, gap=9, smooth=False, amp=2)
    k.line([(x + w * 0.2, y + h * 0.2), (x + w * 0.5, y + h * 0.5), (x + w * 0.45, y + h * 0.9)], '#6f93b0', w=4, smooth=False, twice=False)
ice(40, 480, 170, 90); ice(1060, 484, 180, 86)
def snow(x, y, w, h):
    pts = [(x, y + h)] + ell(x + w / 2, y + h, w / 2, h, 14, a0=180, a1=360) + [(x + w, y + h)]
    k.solid(pts, '#ffffff'); k.line(pts, '#8aa0b8', w=6, amp=2)
snow(20, 590, 230, 100); snow(1010, 600, 250, 100); snow(300, 650, 150, 60); snow(800, 660, 170, 50)

# --- лоскутное одеяло ---
Q = [(300, 410), (980, 410), (1070, 612), (210, 612)]
def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
def P(u, v): return lerp(lerp(Q[0], Q[1], u), lerp(Q[3], Q[2], u), v)
NX, NY = 7, 3
cols = ['#e23b3b', '#ffb020', '#ffd43b', '#46a84f', '#2f6fd6', '#8e5bd0', '#f28cb1', '#3fc1c9']
for i in range(NX):
    for j in range(NY):
        poly = [P(i / NX, j / NY), P((i + 1) / NX, j / NY), P((i + 1) / NX, (j + 1) / NY), P(i / NX, (j + 1) / NY)]
        k.fill(poly, cols[(i * 3 + j * 5 + 1) % len(cols)], gap=9, angle=k.r.choice([40, -40, 75, 10]))
for i in range(NX + 1):
    k.line([P(i / NX, 0), P(i / NX, 1)], '#5a4a3a', w=4, amp=1.2, twice=False)
for j in range(NY + 1):
    k.line([P(0, j / NY), P(1, j / NY)], '#5a4a3a', w=4, amp=1.2, twice=False)
k.line(Q, '#3a2a1c', w=8, closed=True, amp=2, smooth=False)
# стежки
for i in range(NX):
    for j in range(NY):
        c = P((i + 0.5) / NX, (j + 0.5) / NY)
        k.line([(c[0] - 10, c[1]), (c[0] + 10, c[1])], '#ffffff', w=4, twice=False, smooth=False, amp=0.5)

# кольцевая дорога вокруг города на одеяле
ring = ell(640, 515, 255, 66, 28)
k.line(ring, '#6f7480', w=30, closed=True, amp=2.2)
k.line(ell(640, 515, 255, 66, 28), '#f4f4f4', w=4, closed=True, amp=1, twice=False)

def house(x, y, w, h, wall, roof, chim=False):
    k.shape(rect(x - w / 2, y - h, w, h), wall, '#333', w=5, gap=8)
    k.shape([(x - w / 2 - 6, y - h), (x, y - h - h * 0.55), (x + w / 2 + 6, y - h)], roof, '#333', w=5, gap=8, smooth=False, amp=1.2)
    k.shape(rect(x - w * 0.18, y - h * 0.45, w * 0.36, h * 0.45), '#6b3a1e', '#2a1608', w=3, gap=7)
    if chim:
        k.shape(rect(x + w * 0.22, y - h - h * 0.62, w * 0.18, h * 0.4), '#8a8a8a', '#333', w=3, gap=6)
for (x, y, w, h, wall, roof, chim) in sorted([
        (545, 508, 60, 50, '#fff2c9', '#c9552f', True), (610, 492, 54, 56, '#ffd2d2', '#2f6fd6', False), (690, 488, 78, 76, '#e8f3ff', '#c9552f', True),
        (775, 506, 58, 52, '#e2f5d6', '#8e5bd0', False), (655, 546, 50, 44, '#fff2c9', '#2f6fd6', True), (580, 548, 46, 38, '#ffd2d2', '#c9552f', False),
        (735, 548, 48, 40, '#fff2c9', '#46a84f', False)], key=lambda t: t[1]):
    house(x, y, w, h, wall, roof, chim)

# жёлтый дым над городом
for (x0, y0) in [(556, 396), (702, 360), (668, 470)]:
    pts = [(x0, y0)]
    for i in range(1, 6):
        pts.append((x0 + (18 if i % 2 else -18) + k.J(5), y0 - i * 42))
    k.line(pts, '#f2c200', w=16, amp=3)
for (cx, cy) in [(600, 215), (770, 195)]:
    for (dx, dy, r) in [(-34, 8, 30), (0, -12, 38), (36, 8, 30)]:
        k.shape(ell(cx + dx, cy + dy, r, r, 12), '#f7d94a', '#c9a400', w=4, gap=9)

k.save('/tmp/narisoval/2700', 'media/img/narisoval/r3_2700_zvezda.webp')
