import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=41501)
# серое дождливое небо, мокрый асфальт
k.fill(rect(-20, -20, W + 40, 460), '#aab4c4', gap=11, angle=-3)
k.cloud(200, 130, 1.0, '#6a7a90', '#dfe5ee'); k.cloud(700, 90, 1.2, '#6a7a90', '#dfe5ee'); k.cloud(1120, 150, 0.9, '#6a7a90', '#dfe5ee')
k.fill([(-20, 470), (W + 20, 462), (W + 20, H + 20), (-20, H + 20)], '#5a5f6a', gap=11, angle=-4)
for x in range(0, W, 150):
    k.line([(x + 20, 640), (x + 100, 640)], '#e8e8e8', w=9, amp=1, twice=False)
for (x, y) in [(60, 200), (160, 290), (260, 170), (360, 330), (470, 220), (570, 300), (690, 210), (800, 330), (900, 190), (1010, 300), (1110, 220), (1210, 330), (330, 420), (880, 420)]:
    k.line([(x, y), (x - 14, y + 40)], '#4a8fd8', w=5, amp=0.5, twice=False)
# забор позади
for x in range(0, W, 62):
    k.shape(rect(x, 330, 46, 150), '#9a7a52', '#5a4326', w=5, gap=9)
# две школьницы (бегут вправо, держатся за руки)
def girl(x, hair, ribbon):
    hx, hy, R = person(k, x, 640, 1.12, dress='#2a3f86', armL=(-50, 40), armR=(70, -10), mood='open', hair=hair, hair_style='long',
                       legs=((-38, 0), (40, -26)), look=(1, 0), cheeks=True)
    # белая блузка (воротник) и бант
    k.shape([(x - 26, 640 - 188 * 1.12), (x + 26, 640 - 188 * 1.12), (x + 20, 640 - 140 * 1.12), (x - 20, 640 - 140 * 1.12)], '#ffffff', '#889', w=4, gap=8, smooth=False)
    k.shape(ell(hx + 14, hy - R * 1.1, 14, 10, 8), ribbon, shade(ribbon, -0.4), w=3, gap=6)
    return hx, hy
girl(760, '#222', '#e83e8c')
girl(940, '#c9762c', '#4aa8ff')
k.line([(760 + 28 * 1.12 + 70 * 1.12, 640 - 178 * 1.12 - 10 * 1.12), (940 - 28 * 1.12 - 50 * 1.12, 640 - 178 * 1.12 + 40 * 1.12)], '#f6c9a4', w=10, amp=1, twice=False)
# погоня: дядя с портфелем, полицейский со свистком, собака
# дядя
hx, hy, R = person(k, 470, 640, 1.1, shirt='#555', shirtd='#222', pants='#333', armL=(-30, 50), armR=(90, -20), mood='angry' if False else 'sad', hair='#1a1a1a', legs=((-38, 0), (40, -24)), look=(1, 0))
k.shape(rect(470 + 28 * 1.1 + 90 * 1.1 - 30, 640 - 178 * 1.1 - 20 * 1.1 + 6, 62, 46), '#7a4a1a', '#3a2008', w=5, gap=8)
# полицейский
hx2, hy2, R2 = person(k, 250, 640, 1.1, shirt='#3a5a9a', shirtd='#1c2f5a', pants='#1c2f5a', armL=(-30, 40), armR=(80, -60), mood='sad', hair='#222', legs=((-38, 0), (40, -24)), look=(1, 0))
k.shape([(hx2 - R2 * 1.2, hy2 - R2 * 0.5), (hx2 + R2 * 1.2, hy2 - R2 * 0.5), (hx2 + R2 * 0.8, hy2 - R2 * 1.3), (hx2 - R2 * 0.8, hy2 - R2 * 1.3)], '#1c2f5a', '#0a1430', w=4, gap=8, smooth=False)
k.shape(star5(hx2, hy2 - R2 * 0.9, 9), '#ffd43b', '#9a7000', w=2, gap=4, smooth=False)
# собака
dx, dy = 90, 620
k.shape(ell(dx, dy - 40, 52, 26, 14), '#b5651d', '#5a3008', w=5, gap=8)
k.shape(ell(dx + 58, dy - 62, 24, 20, 12), '#b5651d', '#5a3008', w=5, gap=8)
k.dot(dx + 66, dy - 66, 4)
k.line([(dx - 48, dy - 50), (dx - 80, dy - 90)], '#5a3008', w=7, amp=1, twice=False)
for lx in (-30, -10, 24, 44):
    k.line([(dx + lx, dy - 22), (dx + lx + (6 if lx > 0 else -6), dy)], '#8a4a10', w=9, amp=1, twice=False)
# зигзаги скорости
for y in (400, 480, 560):
    k.line([(560, y), (600, y + 8), (640, y)], '#ffffff', w=5, amp=0.5, twice=False)
note(k, 1180, 400, 0.9, '#7a3fc0'); note(k, 1120, 500, 0.8, '#e83e8c')
k.save('/tmp/narisoval2/1500', 'media/img/narisoval/r3_1500_tatu.webp')
