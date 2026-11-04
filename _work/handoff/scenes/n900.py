import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=4901)
# закатное небо
k.fill(rect(-20, -20, W + 40, 480), '#ffb347', gap=11, angle=4)
k.fill(rect(-20, -20, W + 40, 200), '#ff7a3c', gap=12, angle=-3, ) if False else None
SX, SY = 640, 330
k.shape(ell(SX, SY, 150, 150, 26), '#ff5a36', '#b02a10', w=9, gap=10)
for i in range(16):
    a = math.radians(i * 360 / 16)
    k.line([(SX + math.cos(a) * 175, SY + math.sin(a) * 175), (SX + math.cos(a) * 225, SY + math.sin(a) * 225)], '#ff5a36', w=10, amp=1.5, twice=False)
# саванна
k.fill([(-20, 440), (W + 20, 430), (W + 20, H + 20), (-20, H + 20)], '#d9a441', gap=11, angle=-5)
k.fill([(-20, 600), (W + 20, 590), (W + 20, H + 20), (-20, H + 20)], '#b9822c', gap=11, angle=-5)
# акация
k.line([(170, 560), (180, 440), (150, 360)], '#5a3a1c', w=22, amp=3, twice=False)
k.line([(180, 440), (240, 380)], '#5a3a1c', w=14, amp=2, twice=False)
k.shape(ell(190, 330, 150, 46, 20), '#3c9a3c', '#1f5a1f', w=7, gap=10)
k.shape(ell(120, 345, 90, 30, 16), '#4aaa4a', '#1f5a1f', w=5, gap=9)
# жираф вдали
gx = 1080
for lx in (-34, -14, 12, 32):
    k.line([(gx + lx, 540), (gx + lx, 450)], '#e8b34a', w=12, amp=1, twice=False)
k.shape(ell(gx, 430, 58, 32, 14), '#e8b34a', '#8a5a10', w=5, gap=9)
k.line([(gx + 40, 420), (gx + 70, 330), (gx + 78, 290)], '#e8b34a', w=22, amp=1.5, twice=False)
k.shape(ell(gx + 90, 280, 24, 15, 12, rot=-20), '#e8b34a', '#8a5a10', w=4, gap=7)
k.dot(gx + 96, 276, 3)
for (dx, dy) in ((-20, 424), (10, 440), (50, 380), (62, 340)):
    k.dot(gx + dx, dy, 8, '#8a4a10')
# футбольный мяч по центру
BX, BY, BR = 640, 570, 62
k.shape(ell(BX, BY, BR, BR, 24), '#ffffff', '#222', w=8, gap=11)
k.shape(star5(BX, BY, 22, 22 * 0.8), '#222', '#222', w=3, gap=5, smooth=False)
for a in range(5):
    t = math.radians(a * 72 - 90)
    px, py = BX + math.cos(t) * 44, BY + math.sin(t) * 44
    k.line([(BX + math.cos(t) * 20, BY + math.sin(t) * 20), (px, py)], '#222', w=5, amp=0.6, twice=False)
    k.dot(BX + math.cos(t) * 58, BY + math.sin(t) * 58, 11, '#222')
# танцующие: ребёнок слева с флагом, девочка и мальчик справа
person(k, 400, 640, 1.0, shirt='#2fa84f', shirtd='#145a28', pants='#e8c000', skin='#a0663a', hair='#1a1008', armL=(-50, -85), armR=(50, -85), mood='open', legs=((-34, 0), (30, -18)), cheeks=True)
person(k, 880, 640, 1.0, dress='#e83e8c', skin='#a0663a', hair='#1a1008', hair_style='long', armL=(-60, -70), armR=(60, -70), mood='open', legs=((-30, -16), (28, 0)), cheeks=True)
# барабан
k.shape(rect(1010, 560, 110, 100), '#c0392b', '#6a1a10', w=7, gap=10)
k.shape(ell(1065, 560, 55, 16, 14), '#f0d9a0', '#6a4a10', w=5, gap=8)
for (a, b) in ((1020, 570), (1050, 660), (1090, 570), (1060, 660)):
    pass
k.line([(1020, 575), (1065, 655), (1110, 575)], '#f0d9a0', w=5, amp=1, twice=False)
# маленький кубок
k.shape([(540, 450), (590, 450), (580, 500), (550, 500)], '#ffd43b', '#9a7000', w=6, gap=8, smooth=False)
k.line([(565, 500), (565, 525)], '#9a7000', w=8, amp=0.5, twice=False)
k.shape(rect(545, 525, 40, 14), '#ffd43b', '#9a7000', w=5, gap=8)
sparkle(k, 520, 440, 14); sparkle(k, 610, 430, 12)
note(k, 700, 450, 0.9, '#7a3fc0'); note(k, 300, 480, 0.8, '#7a3fc0')
k.save('/tmp/narisoval2/900', 'media/img/narisoval/r3_900_waka.webp')
