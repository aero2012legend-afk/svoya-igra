import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=9001)
WINE, WINED = '#8a1236', '#4a0618'
# небо и бордовый горизонт
k.fill(rect(-20, -20, W + 40, 500), '#b6e0f5', gap=11, angle=6)
k.cloud(120, 330, 0.7, '#4a90d9', '#ffffff'); k.cloud(1180, 300, 0.6, '#4a90d9', '#ffffff')
k.fill([(-20, 470), (W + 20, 462), (W + 20, H + 20), (-20, H + 20)], WINE, gap=11, angle=-6)
k.fill([(-20, 470), (W + 20, 462), (W + 20, 500), (-20, 506)], '#c2304f', gap=10, angle=-3)
k.line([(-20, 470), (W + 20, 462)], WINED, w=6, amp=2)

# --- самолёт (летит вправо) ---
k.shape([(170, 214), (150, 108), (236, 108), (320, 196)], '#e85a5a', '#8a1f1f', w=7, gap=10, smooth=False, amp=1.8)          # хвост
k.shape([(380, 262), (300, 392), (420, 396), (560, 292)], '#dde4ee', '#59647a', w=7, gap=10, smooth=False, amp=1.8)         # крыло
k.shape([(176, 206), (260, 186), (520, 188), (720, 208), (800, 252), (720, 290), (500, 304), (260, 300), (186, 270)],
        '#f4f7fb', '#59647a', w=8, gap=12, smooth=True, amp=2)                                                               # корпус
k.line([(220, 262), (760, 266)], '#e85a5a', w=9, amp=1.5, twice=False)
for wx in (300, 360, 520, 580, 640):
    k.shape(ell(wx, 232, 17, 19, 10), '#bfe3ff', '#456', w=4, gap=7)
# девочка у окна боится летать
GX, GY = 440, 232
k.shape(ell(GX, GY - 6, 40, 46, 14), '#3a2410', '#1a0a00', w=4, gap=8)
k.shape(ell(GX, GY, 29, 31, 14), SKIN, SKIND, w=4, gap=8)
face(k, GX, GY + 2, 29, 'sad', cheeks=True)
k.shape(ell(GX, GY, 40, 42, 14), None, '#456', w=6, gap=8) if False else None
# окно вокруг неё
k.line(ell(GX, GY, 41, 43, 16), '#456', w=7, closed=True, amp=1.2)
# пилот в кабине
PX, PY = 726, 234
k.shape(ell(PX, PY, 21, 22, 12), SKIN, SKIND, w=4, gap=7)
k.shape([(PX - 23, PY - 4), (PX - 18, PY - 22), (PX, PY - 28), (PX + 18, PY - 22), (PX + 23, PY - 4), (PX + 8, PY - 12), (PX - 8, PY - 12)], '#2a4a9a', '#12295a', w=3, gap=6, smooth=False)
k.dot(PX - 8, PY, 3); k.dot(PX + 8, PY, 3)
k.smile(PX, PY + 8, 14, 6, '#c0392b', 3)
k.line(ell(PX, PY, 25, 26, 14), '#456', w=6, closed=True, amp=1, twice=False)
# мысль девочки — про пилота
bubble(k, 440, 78, 120, 62, tail_to=(440, 186))
k.shape(ell(440, 82, 36, 38, 14), SKIN, SKIND, w=4, gap=7)
k.shape([(402, 76), (410, 46), (440, 36), (470, 46), (478, 76), (458, 62), (422, 62)], '#2a4a9a', '#12295a', w=4, gap=7, smooth=False)
k.dot(428, 84, 4); k.dot(452, 84, 4); k.smile(440, 98, 22, 9, '#c0392b', 3)
k.shape(star5(440, 51, 8), '#ffd43b', '#c79a00', w=2, gap=4, smooth=False)

# --- часы (стрелки: без цифр, только чёрточки) ---
CX_, CY_, CR = 1090, 130, 82
k.shape(ell(CX_, CY_, CR, CR, 22), '#ffffff', '#c0392b', w=11, gap=12)
for i in range(12):
    a = math.radians(i * 30)
    k.line([(CX_ + math.sin(a) * (CR - 20), CY_ - math.cos(a) * (CR - 20)), (CX_ + math.sin(a) * (CR - 8), CY_ - math.cos(a) * (CR - 8))], '#333', w=5, amp=0.4, twice=False)
ha = math.radians(7 * 30 + 22 * 0.5); ma = math.radians(22 * 6)
k.line([(CX_, CY_), (CX_ + math.sin(ha) * 36, CY_ - math.cos(ha) * 36)], '#222', w=9, amp=0.5, twice=False)
k.line([(CX_, CY_), (CX_ + math.sin(ma) * 56, CY_ - math.cos(ma) * 56)], '#222', w=6, amp=0.5, twice=False)
k.dot(CX_, CY_, 7)

# --- шато с башенками и погребом, на горизонте ---
k.shape(rect(560, 372, 190, 96), '#e8d6a8', '#7a6430', w=7, gap=11)
for tx in (548, 738):
    k.shape(rect(tx, 340, 44, 128), '#dcc590', '#7a6430', w=6, gap=10)
    k.shape([(tx - 8, 340), (tx + 22, 286), (tx + 52, 340)], '#c9552f', '#7a2a12', w=6, gap=9, smooth=False, amp=1.5)
k.shape([(560, 372), (655, 330), (750, 372)], '#c9552f', '#7a2a12', w=6, gap=9, smooth=False, amp=1.5)
k.shape([(630, 468), (630, 420), (655, 402), (680, 420), (680, 468)], '#5a3a1c', '#2a1608', w=5, gap=8, smooth=False)
k.shape(rect(570, 396, 30, 36), '#9fd0ee', '#456', w=4, gap=7); k.shape(rect(712, 396, 30, 36), '#9fd0ee', '#456', w=4, gap=7)
# бочка (погреб)
k.shape(ell(820, 438, 34, 40, 14), '#a8682c', '#5a3410', w=6, gap=9)
k.line([(788, 424), (852, 424)], '#5a3410', w=5, amp=0.8, twice=False); k.line([(788, 452), (852, 452)], '#5a3410', w=5, amp=0.8, twice=False)

# --- Эйфелева башня вдалеке справа (по-детски: треугольник с крестиками) ---
k.line([(990, 466), (1036, 330), (1082, 466)], '#555a66', w=9, amp=1.2)
k.line([(1036, 330), (1036, 290)], '#555a66', w=7, amp=0.6, twice=False)
for (y, hw) in [(420, 22), (380, 14)]:
    k.line([(1036 - hw, y), (1036 + hw, y)], '#555a66', w=7, amp=0.6, twice=False)
k.line([(1010, 440), (1062, 400)], '#555a66', w=5, amp=0.6, twice=False); k.line([(1062, 440), (1010, 400)], '#555a66', w=5, amp=0.6, twice=False)

# --- плетёное кресло и столик с чашкой (уютное кафе) ---
k.shape(ell(190, 596, 62, 18, 14), '#e8c98a', '#7a5a22', w=6, gap=9)
k.line([(190, 610), (190, 690)], '#7a5a22', w=9, amp=1, twice=False); k.line([(150, 690), (230, 690)], '#7a5a22', w=8, amp=1, twice=False)
k.shape(rect(172, 560, 36, 26), '#ffffff', '#555', w=4, gap=7)
k.line([(208, 568), (222, 570), (220, 580), (208, 582)], '#555', w=4, amp=0.6, twice=False)
k.line([(180, 548), (176, 532)], '#bbb', w=4, amp=0.8, twice=False); k.line([(196, 548), (200, 530)], '#bbb', w=4, amp=0.8, twice=False)  # пар
# кресло
k.shape(ell(380, 560, 52, 62, 16), '#d9a85a', '#6a4a14', w=7, gap=8)
for i in range(-2, 3):
    k.line([(380 - 44 + i * 20, 508), (380 + 22 + i * 20, 612)], '#8a5a1a', w=4, amp=0.6, twice=False)
    k.line([(380 + 44 + i * 20, 508), (380 - 22 + i * 20, 612)], '#8a5a1a', w=4, amp=0.6, twice=False)
k.shape(rect(318, 624, 124, 22), '#d9a85a', '#6a4a14', w=6, gap=8)
k.line([(330, 646), (322, 700)], '#6a4a14', w=8, amp=1, twice=False); k.line([(430, 646), (440, 700)], '#6a4a14', w=8, amp=1, twice=False)

# --- бокал бордового вина ---
BX, BY = 930, 700
k.shape([(BX - 70, BY - 230), (BX + 70, BY - 230), (BX + 62, BY - 150), (BX + 24, BY - 110), (BX - 24, BY - 110), (BX - 62, BY - 150)], '#f3e6ee', '#6a3a5a', w=7, gap=12, smooth=True)
k.shape([(BX - 63, BY - 178), (BX + 63, BY - 178), (BX + 56, BY - 150), (BX + 24, BY - 116), (BX - 24, BY - 116), (BX - 56, BY - 150)], '#6a0a2a', '#3a0614', w=4, gap=7, smooth=True)
k.line([(BX, BY - 110), (BX, BY - 26)], '#6a3a5a', w=9, amp=1, twice=False)
k.shape(ell(BX, BY - 18, 62, 14, 14), '#f3e6ee', '#6a3a5a', w=6, gap=9)
k.line([(BX - 40, BY - 214), (BX - 46, BY - 160)], '#ffffff', w=8, amp=0.8, twice=False)

k.save('/tmp/narisoval/900', 'media/img/narisoval/r3_900_provans.webp')
