import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=1800)
k.sky_band(40, '#bfe1f7')
# пол
floor = [(-20, 648), (W + 20, 640), (W + 20, H + 20), (-20, H + 20)]
k.fill(floor, '#d9b27a', gap=12, angle=-6)
k.line([(-20, 648), (W + 20, 640)], '#8a6a3a', w=7, amp=2)

# --- холодильник справа ---
FX, FY, FW, FH = 880, 104, 230, 540
k.shape(rect(FX, FY, FW, FH), '#d6e6f7', '#4f6486', w=10, gap=12, angle=70)
k.line([(FX, FY + 170), (FX + FW, FY + 170)], '#4f6486', w=9)
k.shape(rect(FX + 16, FY + 52, 14, 82), '#44506a', '#222', w=4, gap=8)                  # ручки
k.shape(rect(FX + 16, FY + 210, 14, 140), '#44506a', '#222', w=4, gap=8)
k.shape(star5(FX + 150, FY + 250, 24), '#ffd43b', '#c79a00', w=4)                         # магнитик на двери
k.shape(rect(FX + 16, FH + FY - 6, 40, 12), '#44506a', None); k.shape(rect(FX + FW - 56, FH + FY - 6, 40, 12), '#44506a', None)

# --- автоответчик на столике слева ---
k.shape(rect(50, 560, 390, 26), '#8a5a2b', '#47280e', w=7, gap=10)
k.line([(86, 586), (80, 645)], '#47280e', w=11); k.line([(404, 586), (410, 645)], '#47280e', w=11)
k.shape(rect(80, 416, 330, 144), '#aab3c2', '#3d4455', w=9, gap=11, angle=60)
k.shape(rect(116, 440, 180, 78), '#eef4ff', '#3d4455', w=6, gap=10)                          # окошко кассеты
for (rx, ry) in [(160, 480), (252, 480)]:
    k.shape(ell(rx, ry, 24, 24, 12), '#ffffff', '#222', w=5, gap=8)
    k.dot(rx, ry, 7, '#222')
    for a in (0, 120, 240):
        k.line([(rx, ry), (rx + 18 * math.cos(math.radians(a)), ry + 18 * math.sin(math.radians(a)))], '#222', w=4, twice=False, amp=0.6)
k.line([(160, 504), (206, 498), (252, 504)], '#6b3a1e', w=4, twice=False, amp=1)             # плёнка
k.shape(ell(358, 452, 15, 15, 12), '#ff2a2a', '#8a1010', w=5, gap=7)                         # лампочка «сообщения»
for a in range(0, 360, 60):
    k.line([(358 + 22 * math.cos(math.radians(a)), 452 + 22 * math.sin(math.radians(a))),
            (358 + 34 * math.cos(math.radians(a)), 452 + 34 * math.sin(math.radians(a)))], '#ff2a2a', w=4, twice=False, amp=0.5)
for bx in (318, 344, 370):
    k.shape(rect(bx, 512, 20, 26), '#2a2a2a', '#111', w=3, gap=7)
k.line([(80, 540), (40, 560), (60, 600), (30, 640)], '#222', w=6, amp=2, twice=False)         # шнур

# --- пачка жвачки по центру (крупно) ---
T = Xf(596, 430, 0.8, -6)
k.shape(T(rect(236, -40, 112, 52)), '#ffffff', '#8a8a8a', w=5, gap=9)                            # вылезла пластинка
k.shape(T(rect(236, -76, 100, 40)), '#ffffff', '#8a8a8a', w=5, gap=9)
k.solid(T(rect(-190, -80, 430, 180)), '#ffffff')
k.shape(T(rect(-190, -80, 430, 180)), None, '#1c3f94', w=10)
k.shape(T(rect(-190, -80, 430, 62)), '#2f6fd6', '#1c3f94', w=6, gap=10)                          # синяя полоса
k.shape(T(ell(-60, 38, 36, 36, 16)), '#ffb020', '#b86a00', w=5, gap=9)                          # планета
k.line(T(ell(-60, 38, 78, 20, 20, rot=-20)), '#e23b3b', w=7, closed=True, amp=1.5)              # орбита
for (sx, sy) in [(60, 22), (120, 60), (170, 20), (190, 70)]:
    k.shape(star5(*T([(sx, sy)])[0], 12), '#ffd43b', None)
k.line(T([(20, 70), (200, 70)]), '#2f6fd6', w=5, amp=1.2, twice=False)

# --- розовый пузырь над пачкой ---
k.shape(ell(600, 190, 82, 78, 20), '#ff9fc4', '#c2417a', w=8, gap=11)
k.line([(550, 155), (570, 133), (600, 125)], '#ffffff', w=9, amp=1, twice=False)

k.save('/tmp/narisoval/1500', 'media/img/narisoval/r3_1500_orbit.webp')
