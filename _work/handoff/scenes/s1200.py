import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=1201)
# вечер, дождь, мокрый асфальт
k.fill(rect(-20, -20, W + 40, 600), '#8c9bc4', gap=11, angle=7)
k.fill([(-20, 552), (W + 20, 546), (W + 20, H + 20), (-20, H + 20)], '#5d6272', gap=12, angle=-5)
k.line([(-20, 552), (W + 20, 546)], '#363a46', w=7, amp=2)

# тучи
for (cx, cy, s) in [(260, 80, 1.5), (700, 60, 1.7), (1100, 90, 1.4)]:
    k.cloud(cx, cy, s, '#4a5a7a', '#9aa3b8')

# дома на заднем плане (в окне — девочка)
k.shape(rect(830, 250, 440, 300), '#d9cbb0', '#6a5a3a', w=8, gap=12)
window_grid(k, 860, 280, 4, 3, ww=62, wh=70, gx=30, gy=34, lit=0.5, on='#ffe27a', off='#4a5a7a', frame='#6a5a3a')
# девочка в освещённом окне (занавеска, телефон экраном вниз)
k.shape(rect(1040, 280, 62, 70), '#ffe27a', '#6a5a3a', w=5, gap=9)
k.shape(ell(1071, 332, 16, 17, 10), SKIN, SKIND, w=3, gap=6)
k.shape([(1054, 320), (1058, 304), (1071, 298), (1084, 304), (1088, 320), (1080, 314), (1062, 314)], '#6a3a1c', '#3a1c08', w=3, gap=6, smooth=False)
k.dot(1065, 332, 2.5); k.dot(1077, 332, 2.5)
k.shape(rect(260, 330, 120, 220), '#c4c0b8', '#5a564e', w=7, gap=11)
window_grid(k, 276, 350, 2, 3, ww=40, wh=44, gx=20, gy=18, lit=0.45, frame='#5a564e')

# фонари — «фонари для нас не гаснут»
lamp(k, 180, 560, 330, 1.1); lamp(k, 790, 560, 310, 1.0)

# лужа с кругами, в которую он влетел
PX, PY = 520, 640
k.shape(ell(PX, PY, 190, 40, 20), '#a9c8f0', '#3a6aa8', w=7, gap=9)
k.line(ell(PX, PY + 2, 120, 22, 16), '#ffffff', w=4, closed=True, amp=1, twice=False)
k.line(ell(PX, PY + 2, 70, 12, 14), '#ffffff', w=4, closed=True, amp=1, twice=False)
k.shape(ell(PX + 60, PY + 8, 16, 10, 8), '#ffe566', None, gap=6)  # отражение фонаря

# мальчик в толстовке, без зонта, телефон в руке
bx, by = 500, 632
hx, hy, R = person(k, bx, by, 1.18, shirt='#2f4a8a', shirtd='#142a5a', pants='#22252e', armL=(-52, 62), armR=(88, -22),
                   mood='sad', hair='#3a2410', legs=((-26, 0), (34, -6)), look=(-4, 6))
# капюшон за головой
k.line(ell(hx, hy + 4, R * 1.28, R * 1.25, 18, a0=150, a1=390), '#142a5a', w=14, amp=1.4, twice=False)
# телефон в правой руке: экран с красной трубкой — звонки без ответа
phx, phy = bx + 88 * 1.18 + 12, by - 188 * 1.18 + 10 - 22 * 1.18
k.shape(rect(phx - 24, phy - 52, 48, 84), '#1f1f2a', '#000', w=5, gap=9)
k.shape(rect(phx - 18, phy - 44, 36, 62), '#bfe6ff', None, gap=6)
k.line([(phx - 10, phy - 18), (phx - 2, phy - 28), (phx + 10, phy - 14)], '#d01818', w=7, amp=0.5, twice=False)
for r_ in (22, 34):
    k.line(ell(phx, phy - 68, r_, r_, 10, a0=200, a1=340), '#d01818', w=4, amp=0.6, twice=False)       # «звонит» — дуги
# кроссовки: мокрые, с каплями
for (sx, sy, fl) in [(bx - 28, by + 6, False), (bx + 40, by - 2, False)]:
    sneaker(k, sx, sy, 0.42, '#f6f6fb', '#445', flip=fl)
    for dx in (-30, 10, 44):
        k.shape(drop(sx + dx, sy - 70 + (dx % 7), 6), '#4aa8ff', '#2a6ac0', w=2, gap=4)
# брызги
for (dx, dy) in [(-140, -10), (-110, -30), (150, -20), (170, 0), (120, -40)]:
    k.shape(drop(PX + dx, PY + dy - 20, 8), '#79b4ff', '#2a6ac0', w=3, gap=5)

# сломанный зонт валяется (ему он не нужен)
k.line(ell(760, 636, 80, 56, 14, a0=180, a1=360), '#c0392b', w=9, amp=1.4)
k.line([(680, 636), (840, 636)], '#7a1a12', w=5, amp=0.8, twice=False)
for ang in (210, 250, 290, 330):
    a = math.radians(ang)
    k.line([(760, 636), (760 + 80 * math.cos(a), 636 + 56 * math.sin(a))], '#7a1a12', w=4, amp=0.6, twice=False)
k.line([(760, 636), (836, 690)], '#5a3a1c', w=7, amp=1, twice=False)
k.line([(836, 690), (852, 676), (868, 688)], '#5a3a1c', w=7, amp=0.8, twice=False)

# ДОЖДЬ поверх всего
for i in range(150):
    x = k.r.uniform(-30, 1300); y = k.r.uniform(-30, 700); L = k.r.uniform(26, 44)
    k.line([(x, y), (x - L * 0.28, y + L)], '#3f78d6', w=4.5, amp=0.4, twice=False, smooth=False)

k.save('/tmp/narisoval/1200', 'media/img/narisoval/r3_1200_krossy.webp')
