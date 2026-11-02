import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=6001)
RASP, RASPD = '#d81f5a', '#7a0a2c'
# небо, холмы, дорога
k.fill(rect(-20, -20, W + 40, 470), '#a9dcf7', gap=11, angle=8)
k.cloud(190, 120, 1.0, '#4a90d9', '#ffffff'); k.cloud(930, 90, 0.8, '#4a90d9', '#ffffff')
k.shape([(-30, 460), (140, 380), (330, 420), (520, 372), (760, 430), (980, 380), (1160, 420), (1320, 400), (1320, 470), (-30, 470)],
        '#7cc67a', '#3a8a3e', w=7, gap=11, smooth=True)
k.fill([(-20, 462), (W + 20, 468), (W + 20, H + 20), (-20, H + 20)], '#a3a8b4', gap=12, angle=-4)
k.line([(-20, 464), (W + 20, 470)], '#5a5f6a', w=6, amp=2)
for x in range(30, W, 170):
    k.line([(x, 676), (x + 80, 672)], '#ffffff', w=11, amp=1.5, twice=False)

# солнце в очках
SX, SY = 1120, 190
for a in range(0, 360, 30):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.line([(SX + ca * 78, SY + sa * 78), (SX + ca * 118, SY + sa * 118)], '#ff9f1a', w=9, amp=1, twice=False)
k.shape(ell(SX, SY, 66, 66, 18), '#ffd43b', '#c79a00', w=8, gap=10)
k.shape(ell(SX - 26, SY - 8, 20, 15, 10), '#111', '#000', w=3, gap=6)
k.shape(ell(SX + 26, SY - 8, 20, 15, 10), '#111', '#000', w=3, gap=6)
k.line([(SX - 6, SY - 8), (SX + 6, SY - 8)], '#111', w=5, amp=0.4, twice=False)
k.smile(SX, SY + 24, 40, 16, '#c0392b', 5)

# --- малиновая машинка (хэтчбек, фары мигают) ---
CX, CY, S = 600, 640, 1.95
car(k, CX, CY, S, RASP, RASPD, windows=True)
# пассажиры: девочка сзади, водитель впереди (головы чуть торчат из окон)
face_r = 31
gx, gy = CX + (-45) * S, CY + (-122) * S
k.shape(ell(gx, gy, face_r + 12, face_r + 18, 14), '#3a2410', '#1a0a00', w=4, gap=8)
k.shape(ell(gx, gy + 4, face_r, face_r, 16), SKIN, SKIND, w=5, gap=9)
face(k, gx, gy + 4, face_r, 'open', cheeks=True)
dx_, dy_ = CX + 44 * S, CY + (-120) * S
k.shape(ell(dx_, dy_ + 4, face_r, face_r, 16), SKIN, SKIND, w=5, gap=9)
k.shape([(dx_ - 33, dy_ - 6), (dx_ - 24, dy_ - 34), (dx_, dy_ - 42), (dx_ + 24, dy_ - 34), (dx_ + 33, dy_ - 6), (dx_ + 14, dy_ - 22), (dx_ - 14, dy_ - 22)], '#222', '#000', w=3, gap=6, smooth=False)
face(k, dx_, dy_ + 4, face_r, 'tongue')
k.line([(dx_ - 28, dy_ + 28), (dx_ + 30, dy_ + 46)], '#111', w=9, amp=1, twice=False)          # ремень безопасности
# номер без цифр
k.shape(rect(CX + 138 * S - 70, CY - 78 * S, 86, 34), '#ffffff', '#555', w=4, gap=7)
# малинка на крыше (как антенна)
rx, ry = CX - 40 * S + 6, CY - 150 * S - 8
for (ox, oy) in [(-22, 4), (0, -8), (22, 4), (-12, 24), (12, 24), (-26, 26), (26, 26), (0, 42)]:
    k.shape(ell(rx + ox, ry - 22 + oy, 17, 17, 10), '#e0245e', RASPD, w=3, gap=5)
k.shape([(rx - 14, ry - 40), (rx, ry - 74), (rx + 4, ry - 46), (rx + 30, ry - 62), (rx + 16, ry - 38)], '#3aa04a', '#1d6a2a', w=4, gap=7, smooth=False)
# мигающий дальний свет
fx, fy = CX + 168 * S, CY - 76 * S
for (ex, ey) in [(150, -36), (190, 0), (160, 40)]:
    k.line([(fx + 6, fy), (fx + ex, fy + ey)], '#ffe94a', w=9, amp=1.4, twice=False)
k.line([(fx + 6, fy), (fx + 120, fy - 70)], '#ffe94a', w=9, amp=1.4, twice=False)
# сердечки и нотки («ла-ла-ла»)
k.shape(heart(gx - 90, gy - 70, 34), '#ff5f8a', '#a02050', w=5, gap=8)
k.shape(heart(gx - 40, gy - 118, 22), '#ff5f8a', '#a02050', w=4, gap=7)
note(k, 760, 180, 1.0, '#7a3fc0'); note(k, 860, 250, 0.9, '#2f6fd6'); note(k, 350, 190, 0.9, '#2f6fd6'); note(k, 250, 270, 0.8, '#7a3fc0')
# полоски скорости
for (y, l) in [(560, 150), (610, 120), (520, 100)]:
    k.line([(CX - 176 * S - 24, y), (CX - 176 * S - 24 - l, y)], '#8a8f9c', w=7, amp=1.2, twice=False)

k.save('/tmp/narisoval/600', 'media/img/narisoval/r3_600_malinovaya.webp')
