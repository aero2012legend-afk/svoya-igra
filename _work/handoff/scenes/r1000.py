import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Я так видел» 1000: Shell (жёлтая раковина-гребешок с красными рёбрами). Фон — небо, море и песок; дополнения Васи — краб, морская звезда,
# солнце, чайки. Букв и названия бренда нет.
k = Kid(seed=10001)
k.fill(rect(-20, -20, W + 40, H + 40), '#cdeefb', gap=11, angle=-8)
# море
sea = [(-20, 420), (W + 20, 410), (W + 20, 610), (-20, 616)]
k.fill(sea, '#3a8ae0', gap=11, angle=6)
for row, y in enumerate((470, 530, 585)):
    for x in range(40 + (row % 2) * 60, W, 130):
        k.line([(x, y), (x + 22, y - 14), (x + 46, y), (x + 70, y - 14), (x + 92, y)], '#e8f4ff', w=5, amp=0.8, twice=False)
# песок
sand = [(-20, 604), (W + 20, 598), (W + 20, H + 20), (-20, H + 20)]
k.fill(sand, '#f1d99a', gap=12, angle=-5)
k.line([(-20, 604), (W + 20, 598)], '#c9a85a', w=6, amp=2)
for (x, y) in [(60, 690), (330, 700), (520, 676), (760, 700), (1060, 690), (1200, 640)]:
    k.dot(x, y, 4, '#c9a85a')

# солнце, облачко, чайки
SXc, SYc = 130, 120
for a in range(0, 360, 30):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.line([(SXc + 62 * ca, SYc + 62 * sa), (SXc + 94 * ca, SYc + 94 * sa)], '#f2a900', w=7, amp=1.0, twice=False)
k.shape(ell(SXc, SYc, 46, 46, 18), '#ffd43b', '#e08a00', w=6, gap=9)
k.dot(SXc - 15, SYc - 6, 5); k.dot(SXc + 15, SYc - 6, 5)
k.smile(SXc, SYc + 12, 36, 12, '#c0392b', 5)
k.cloud(1080, 140, 0.9, '#4a90d9', '#ffffff')
for (gx, gy) in [(360, 110), (470, 170), (900, 90)]:
    k.line([(gx, gy), (gx + 24, gy - 16), (gx + 48, gy), (gx + 72, gy - 16), (gx + 96, gy)], '#444', w=5, amp=0.8, twice=False)

# --- раковина-гребешок ---
PX, PY = 640, 648
lobes = []
for i in range(9):
    th = math.radians(-62 + i * 15.5)
    dx, dy = math.sin(th), -math.cos(th)
    lobes.append((i, th, dx, dy))
# рисуем с краёв к центру, чтобы центральная доля лежала сверху
order = sorted(lobes, key=lambda t: -abs(t[1]))
for (i, th, dx, dy) in order:
    cx, cy = PX + dx * 215, PY + dy * 215
    rot = math.degrees(math.atan2(dy, dx))
    k.shape(ell(cx, cy, 175, 46, 18, rot=rot), '#ffd21f', '#d6201f', w=8, gap=10)
    k.line([(PX + dx * 70, PY + dy * 70), (PX + dx * 330, PY + dy * 330)], '#d6201f', w=4, amp=0.8, twice=False)
# замок раковины
k.shape([(596, 664), (684, 664), (670, 604), (610, 604)], '#ffd21f', '#d6201f', w=7, gap=9, smooth=False, amp=1.4)

# --- краб ---
cx, cy = 250, 650
for sg in (-1, 1):
    for j in range(3):
        k.line([(cx + sg * 42, cy + 8 + j * 12), (cx + sg * (82 + j * 6), cy + 26 + j * 16)], '#c0392b', w=7, amp=0.8, twice=False)
    k.line([(cx + sg * 44, cy - 14), (cx + sg * 86, cy - 44)], '#c0392b', w=9, amp=0.8, twice=False)
    k.shape(ell(cx + sg * 100, cy - 62, 26, 24, 12), '#e3242c', '#7a1018', w=5, gap=8)
    k.shape([(cx + sg * 100, cy - 62), (cx + sg * 118, cy - 92), (cx + sg * 126, cy - 66)], '#e3242c', '#7a1018', w=4, gap=7, smooth=False)
    k.line([(cx + sg * 14, cy - 28), (cx + sg * 20, cy - 54)], '#7a1018', w=5, amp=0.4, twice=False)
    k.shape(ell(cx + sg * 20, cy - 58, 9, 9, 8), '#ffffff', '#222', w=3, gap=5)
    k.dot(cx + sg * 20, cy - 58, 3.5)
k.shape(ell(cx, cy, 64, 40, 16), '#e3242c', '#7a1018', w=7, gap=9)
k.smile(cx, cy + 6, 36, 12, '#ffffff', 4)
# --- морская звезда ---
k.shape(star5(880, 660, 40, 17), '#ff9a2a', '#a05000', w=5, gap=8, smooth=False)

signature(k, 1262, 704, 30, '#5a4a2a')
k.save('/tmp/takvidel/1000', 'media/img/takvidel/r2_1000_shell.webp')
