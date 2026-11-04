import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=4601)
# небо без потолка
k.fill(rect(-20, -20, W + 40, H + 40), '#8fd3f7', gap=11, angle=5)
k.cloud(250, 120, 0.8, '#4a90d9', '#ffffff'); k.cloud(1000, 170, 0.9, '#4a90d9', '#ffffff'); k.cloud(620, 70, 0.6, '#4a90d9', '#ffffff')
# огромное улыбающееся солнце над комнатой
SX, SY = 640, 90
k.shape(ell(SX, SY, 70, 70, 22), '#ffd43b', '#e08a00', w=8, gap=9)
for i in range(14):
    a = math.radians(i * 360 / 14)
    k.line([(SX + math.cos(a) * 88, SY + math.sin(a) * 88), (SX + math.cos(a) * 128, SY + math.sin(a) * 128)], '#ffb000', w=9, amp=1.2, twice=False)
face(k, SX, SY + 4, 70, 'open', cheeks=True)
# комната: три стены, пол, потолка нет
k.shape([(150, 250), (1130, 250), (1130, 600), (150, 600)], '#fff0a8', '#b08a00', w=10, gap=12, smooth=False, amp=3)
k.fill([(150, 540), (1130, 540), (1130, 600), (150, 600)], '#c98b4a', gap=10, angle=-4)
for x in range(190, 1130, 120):
    k.line([(x, 280), (x, 520)], '#ffd966', w=14, amp=2, twice=False)               # обои в полоску
# картинка на стене и окно-дверь
k.shape(rect(210, 320, 120, 90), '#ffffff', '#6a4a2a', w=7, gap=10)
k.shape(heart(270, 368, 26), '#ff5f8a', '#a02050', w=4, gap=7)
# музыкант в большой коричневой шляпе по центру: хлопает
hx, hy, R = person(k, 640, 590, 1.1, shirt='#ff7a3c', shirtd='#a03c10', pants='#2b2f6b', armL=(-20, -92), armR=(20, -92), mood='open', hair='#2a1a0a', cheeks=True)
k.shape([(hx - R * 1.9, hy - R * 0.85), (hx + R * 1.9, hy - R * 0.85), (hx + R * 1.2, hy - R * 0.55), (hx - R * 1.2, hy - R * 0.55)], '#8a5a2b', '#4a2c10', w=6, gap=9, smooth=False)
k.shape([(hx - R * 0.95, hy - R * 0.6), (hx - R * 0.8, hy - R * 2.1), (hx + R * 0.8, hy - R * 2.1), (hx + R * 0.95, hy - R * 0.6)], '#8a5a2b', '#4a2c10', w=6, gap=9, smooth=False)
k.line([(hx - R * 0.95, hy - R * 0.95), (hx + R * 0.95, hy - R * 0.95)], '#3a1c08', w=10, amp=0.8, twice=False)
# следы хлопков
for dx, dy, a in ((-52, -5, -40), (52, -5, 40), (0, -34, 0)):
    cx, cy = 640 + dx, 295 + dy
    for t in (-30, 0, 30):
        aa = math.radians(a + t - 90)
        k.line([(cx + math.cos(aa) * 20, cy + math.sin(aa) * 20), (cx + math.cos(aa) * 46, cy + math.sin(aa) * 46)], '#e08a00', w=6, amp=0.5, twice=False)
# гости: слева девочка, справа дядя, обе хлопают
person(k, 360, 590, 0.95, dress='#e83e8c', armL=(-40, -80), armR=(40, -80), mood='open', hair='#222', hair_style='long', cheeks=True)
person(k, 920, 590, 1.0, shirt='#2fa84f', shirtd='#145a28', pants='#3a3a3a', armL=(-40, -80), armR=(40, -80), mood='open', hair='#7a4a1a', cheeks=True)
# воздушные шарики улетают вверх сквозь «дыру»
for (bx, by, c) in [(240, 190, '#ff5f8a'), (330, 120, '#4aa8ff'), (1000, 200, '#7ed957'), (1080, 110, '#ff9a3c')]:
    k.shape(ell(bx, by, 28, 36, 14), c, shade(c, -0.4), w=5, gap=8)
    k.line([(bx, by + 36), (bx + 8, by + 90), (bx - 4, by + 150), (bx + 4, 255)], '#666', w=3, amp=1.5, twice=False)
note(k, 470, 420, 0.9, '#7a3fc0'); note(k, 800, 400, 0.9, '#e83e8c')
k.save('/tmp/narisoval2/600', 'media/img/narisoval/r3_600_happy.webp')
