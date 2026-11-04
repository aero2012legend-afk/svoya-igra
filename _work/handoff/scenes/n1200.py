import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=41201)
night(k, '#3a1a1a')
k.fill(rect(-20, -20, W + 40, 300), '#7a2a1a', gap=12, angle=-4)
# боксёрский ринг: канаты и пол
k.fill([(-20, 560), (W + 20, 550), (W + 20, H + 20), (-20, H + 20)], '#5a6a9a', gap=11, angle=-5)
for y, c in ((380, '#e63946'), (440, '#ffffff'), (500, '#e63946')):
    k.line([(-20, y), (W + 20, y + 4)], c, w=14, amp=2, twice=False)
for x in (80, 1200):
    k.line([(x, 340), (x, 600)], '#999', w=18, amp=1.5, twice=False)
# огромный глаз тигра слева
EX, EY = 330, 230
k.shape(ell(EX, EY, 220, 120, 28), '#ffb02e', '#8a4a00', w=10, gap=10)
k.fill(ell(EX, EY, 150, 70, 24), '#ffe066', gap=9, angle=20) if False else None
k.shape(ell(EX, EY, 130, 80, 24), '#ffd84a', '#8a4a00', w=7, gap=9)
k.shape(ell(EX, EY, 40, 80, 20), '#111', '#000', w=6, gap=7)
k.dot(EX - 12, EY - 28, 10, '#ffffff')
for dx in (-190, -140, 140, 190):                              # полоски вокруг глаза
    k.line([(EX + dx, EY - 130), (EX + dx * 0.9, EY - 210)], '#111', w=16, amp=2, twice=False)
k.line([(EX - 250, EY + 60), (EX - 340, EY + 100)], '#111', w=16, amp=2, twice=False)
k.line([(EX + 250, EY + 60), (EX + 330, EY + 110)], '#111', w=16, amp=2, twice=False)
# боксёр в перчатках справа (бьёт по груше) — человечек с красными перчатками
def glove(k, x, y, r=40, c='#d62828'):
    k.shape(ell(x, y, r, r * 0.9, 16), c, shade(c, -0.5), w=6, gap=8)
    k.shape(rect(x - r * 0.8, y + r * 0.6, r * 1.6, r * 0.7), '#ffffff', '#888', w=4, gap=8)
hx, hy, R = person(k, 900, 600, 1.2, shirt='#ffffff', shirtd='#999', pants='#1f3fbf', armL=(-60, -90), armR=(130, -120), mood='open', hair='#2a1a0a', legs=((-34, 0), (36, 0)))
glove(k, hx - 60 - 52, 600 - 130 * 1.2 - 190 * 0.0 - 8, 38) if False else None
glove(k, 794, 262, 36)
glove(k, 1098, 226, 38)
# трусы-пояс
k.line([(900 - 40, 600 - 100 * 1.2), (900 + 40, 600 - 100 * 1.2)], '#ffd43b', w=14, amp=1, twice=False)
# молния «энергия» и вспышка
k.shape(star5(660, 150, 50, 28), '#ffd43b', '#c79a00', w=6, gap=8, smooth=False)
# тренировка: ступени (без надписей) — лесенка с бегом вверх
for i in range(5):
    k.shape(rect(520 + i * 34, 600 - i * 26, 300 - i * 34, 26), '#cfcfcf', '#777', w=5, gap=9, smooth=False, amp=1)
# груша слева на цепи
k.line([(640, 280), (640, 330)], '#999', w=6, amp=0.6, twice=False)
note(k, 560, 160, 0.8, '#ffd43b')
k.save('/tmp/narisoval2/1200', 'media/img/narisoval/r3_1200_tiger.webp')
