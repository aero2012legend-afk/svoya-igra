import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=41801)
k.fill(rect(-20, -20, W + 40, 430), '#8fd3f7', gap=11, angle=4)
k.cloud(200, 120, 1.0, '#4a90d9', '#ffffff'); k.cloud(700, 80, 1.2, '#4a90d9', '#ffffff'); k.cloud(1100, 150, 0.9, '#4a90d9', '#ffffff')
k.fill([(-20, 400), (W + 20, 394), (W + 20, H + 20), (-20, H + 20)], '#46a84f', gap=11, angle=-5)
for x in range(-20, W, 160):
    k.fill([(x, 400), (x + 80, 400), (x + 80, H + 20), (x, H + 20)], '#3d9a47', gap=12, angle=-5, op=0.5)
# линии поля
k.line([(60, 560), (1220, 560)], '#ffffff', w=8, amp=1.5, twice=False)
k.line(ell(640, 600, 130, 50, 20), '#ffffff', w=8, closed=True, amp=1.5, twice=False)
# ворота справа и мяч в сетке
k.shape([(980, 300), (1220, 300), (1220, 540), (980, 540)], None, '#ffffff', w=10, gap=12, smooth=False, amp=2)
for x in range(1000, 1220, 30):
    k.line([(x, 304), (x, 536)], '#dddddd', w=3, amp=1, twice=False)
for y in range(330, 540, 30):
    k.line([(984, y), (1216, y)], '#dddddd', w=3, amp=1, twice=False)
def ball(x, y, r):
    k.shape(ell(x, y, r, r, 20), '#ffffff', '#222', w=6, gap=10)
    k.shape(star5(x, y, r * 0.35, r * 0.28), '#222', '#222', w=2, gap=5, smooth=False)
for (bx, by) in ((1110, 480), (1050, 440), (1170, 410), (1020, 500), (1160, 500)):
    ball(bx, by, 26)
ball(780, 580, 34)
# флаги на шестах: Аргентина (голубой-белый-голубой), Ямайка (чёрно-зелёно-жёлтый крест)
k.line([(120, 170), (120, 440)], '#8a8a8a', w=10, amp=1, twice=False)
for i, c in enumerate(('#6ec3f0', '#ffffff', '#6ec3f0')):
    k.shape([(124, 170 + i * 42), (330, 170 + i * 42 + 6), (330, 212 + i * 42 + 6), (124, 212 + i * 42)], c, '#667', w=4, gap=8, smooth=False)
k.shape(ell(228, 234, 14, 14, 10), '#ffd43b', '#c79a00', w=3, gap=6)
k.line([(420, 170), (420, 440)], '#8a8a8a', w=10, amp=1, twice=False)
fx0, fy0, fw, fh = 424, 170, 220, 130
k.shape([(fx0, fy0), (fx0 + fw, fy0 + 6), (fx0 + fw, fy0 + fh + 6), (fx0, fy0 + fh)], '#2f9a3a', '#164a1c', w=4, gap=8, smooth=False)
k.shape([(fx0 + fw / 2, fy0 + fh / 2 + 3), (fx0 + 30, fy0), (fx0 + fw - 30, fy0 + 6)], '#111', '#000', w=3, gap=6, smooth=False) if False else None
k.shape([(fx0, fy0), (fx0 + 80, fy0 + 2), (fx0 + fw / 2, fy0 + fh / 2 + 3), (fx0 + 80, fy0 + fh - 2), (fx0, fy0 + fh)], '#111', '#000', w=3, gap=7, smooth=False) if False else None
k.line([(fx0, fy0), (fx0 + fw, fy0 + fh + 6)], '#ffd43b', w=16, amp=1, twice=False)
k.line([(fx0, fy0 + fh), (fx0 + fw, fy0 + 6)], '#ffd43b', w=16, amp=1, twice=False)
k.shape([(fx0 + 8, fy0 + 6), (fx0 + 8, fy0 + fh - 6), (fx0 + fw / 2 - 8, fy0 + fh / 2 + 3)], '#111', '#111', w=3, gap=7, smooth=False)
k.shape([(fx0 + fw - 8, fy0 + 12), (fx0 + fw - 8, fy0 + fh), (fx0 + fw / 2 + 8, fy0 + fh / 2 + 6)], '#111', '#111', w=3, gap=7, smooth=False)
# горюющий болельщик: рука на сердце, слёзы
person(k, 640, 640, 1.15, shirt='#6ec3f0', shirtd='#2a7ab0', pants='#222', armL=(-20, 10), armR=(14, -50), mood='sad', tears=True, hair='#3a2410', cheeks=True)
# вратарь возле ворот в перчатках-звёздах
person(k, 890, 560, 0.55, shirt='#ffd43b', shirtd='#9a7000', pants='#222', armL=(-50, -40), armR=(50, -40), mood='sad', hair='#222')
note(k, 520, 380, 0.9, '#7a3fc0')
k.save('/tmp/narisoval2/1800', 'media/img/narisoval/r3_1800_football.webp')
