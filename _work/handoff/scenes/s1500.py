import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=1501)
# ночь; слева — танцплощадка, справа — автострада с фонарями
night(k, '#322a72')
for (sx, sy, R) in [(70, 50, 13), (460, 70, 12), (610, 150, 11), (1180, 60, 14), (1010, 150, 11), (900, 40, 12)]:
    star(k, sx, sy, R)
# плитка танцпола (шахматка)
cols = ['#ff5fa2', '#4fd0ff']
for r in range(3):
    for c in range(8):
        x0, y0 = -10 + c * 105, 520 + r * 66
        k.shape(rect(x0, y0, 100, 62), cols[(r + c) % 2], '#3a2a6a', w=4, gap=9)
# автострада справа
k.fill([(840, 560), (W + 20, 540), (W + 20, H + 20), (840, H + 20)], '#585c6a', gap=12, angle=-4)
k.line([(840, 560), (W + 20, 540)], '#2a2c36', w=6, amp=2)
for x in range(870, W, 150):
    k.line([(x, 676), (x + 70, 674)], '#ffe566', w=10, amp=1.4, twice=False)

# диско-шар
k.line([(330, -10), (330, 70)], '#888', w=5, amp=1, twice=False)
k.shape(ell(330, 140, 74, 74, 18), '#cfd5e6', '#5a6178', w=7, gap=9)
for a in range(-60, 90, 30):
    k.line(ell(330, 140, 74, 74, 12, a0=a - 30, a1=a + 150), '#ffffff', w=3, amp=0.6, twice=False)
k.line([(256, 140), (404, 140)], '#8a92a8', w=3, amp=0.5, twice=False)
for (dx, dy) in [(-110, -10), (-96, 80), (110, 70), (116, -20), (0, 200)]:
    sparkle(k, 330 + dx, 140 + dy, 16, '#ffffff', 5)
for (dx, dy, c) in [(-130, 40, '#ffd43b'), (130, 30, '#ff8aa8'), (-70, 190, '#7bf0ff')]:
    sparkle(k, 330 + dx, 140 + dy, 12, c, 5)

# девушка-блондинка на танцполе
person(k, 300, 640, 1.0, dress='#ff2f8a', armL=(-62, -66), armR=(66, -48), mood='open', hair='#f3dd6a', hair_style='long',
       legs=((-24, 0), (32, -10)), cheeks=True)
note(k, 180, 430, 1.0, '#ffd43b'); note(k, 440, 400, 0.9, '#7bf0ff')

# магнитофон и букет — «подарил магнитофон и цветы»
bx, by = 650, 650
k.line([(bx - 48, by - 118), (bx - 40, by - 150), (bx + 40, by - 150), (bx + 48, by - 118)], '#444', w=8, amp=1, twice=False, smooth=False)
k.shape(rect(bx - 100, by - 120, 200, 110), '#555a66', '#1a1c24', w=8, gap=11)
for sx in (-58, 58):
    k.shape(ell(bx + sx, by - 62, 30, 30, 14), '#2a2c36', '#000', w=5, gap=8)
    k.shape(ell(bx + sx, by - 62, 11, 11, 10), '#9aa0b0', '#333', w=3, gap=6)
k.shape(rect(bx - 28, by - 98, 56, 30), '#bfe6ff', '#222', w=4, gap=7)
k.line([(bx - 14, by - 83), (bx + 14, by - 83)], '#222', w=4, amp=0.5, twice=False)
k.dot(bx - 18, by - 22, 5, '#ff5f5f'); k.dot(bx, by - 22, 5, '#ffd43b'); k.dot(bx + 18, by - 22, 5, '#5fff8a')
# букет
fx, fy = 800, 650
k.shape([(fx - 40, fy - 120), (fx + 40, fy - 120), (fx + 12, fy - 10), (fx - 12, fy - 10)], '#f4e9c8', '#8a7a3a', w=5, gap=9, smooth=False)
for (dx, dy, c) in [(-30, -150, '#e3242c'), (0, -172, '#ff5f8a'), (30, -150, '#e3242c')]:
    k.line([(fx + dx * 0.4, fy - 118), (fx + dx, fy + dy + 20)], '#2f8a3a', w=6, amp=1, twice=False)
    k.shape(ell(fx + dx, fy + dy, 24, 22, 12), c, '#7a1020', w=4, gap=7)

# кожаная куртка на плечиках
jx, jy = 1040, 120
k.line([(jx, jy - 60), (jx, jy - 30)], '#666', w=6, amp=0.8, twice=False)
k.line(ell(jx, jy - 78, 18, 14, 10, a0=20, a1=330), '#666', w=6, amp=0.6, twice=False)
k.shape([(jx - 40, jy - 22), (jx - 14, jy - 40), (jx + 14, jy - 40), (jx + 40, jy - 22), (jx + 120, jy + 40), (jx + 90, jy + 100), (jx + 64, jy + 76),
         (jx + 62, jy + 220), (jx - 62, jy + 220), (jx - 64, jy + 76), (jx - 90, jy + 100), (jx - 120, jy + 40)], '#1c1c22', '#000', w=7, gap=9, smooth=False, amp=1.6)
k.shape([(jx - 14, jy - 40), (jx - 44, jy + 10), (jx - 4, jy + 56)], '#34343e', '#000', w=5, gap=8, smooth=False)
k.shape([(jx + 14, jy - 40), (jx + 44, jy + 10), (jx + 4, jy + 56)], '#34343e', '#000', w=5, gap=8, smooth=False)
k.line([(jx, jy + 56), (jx, jy + 220)], '#c7ccd6', w=6, amp=0.8, twice=False)
for (dx, dy) in [(-96, 58), (96, 58), (-40, 120), (40, 120)]:
    k.dot(jx + dx, jy + dy, 5, '#c7ccd6')

# фонари вдоль трассы
lamp(k, 880, 560, 330, 1.0); lamp(k, 1230, 540, 380, 1.1)
# такси с шашечками
car(k, 1020, 690, 0.95, '#ffcf1a', '#7a5a00', flip=True)
for i in range(6):
    k.shape(rect(1020 - 90 + i * 20, 690 - 105, 20, 14), '#111' if i % 2 else '#ffffff', '#111', w=2, gap=5)
# школьник уходит в школу: автобусная остановка слева от фонаря — рюкзак, гитара, «адидас» с тремя полосками
sx0, sy0 = 1196, 700
hx, hy, R = person(k, sx0, sy0, 0.78, shirt='#6a9a4a', shirtd='#2a5a1a', pants='#3a3f8a', mood='sad', hair='#222', armL=(-30, 56), armR=(30, 56),
                   legs=((-18, 0), (18, 0)))
k.shape(rect(sx0 - 20, sy0 - 215, 42, 64), '#d64b2a', '#7a1f0a', w=4, gap=8)                  # рюкзак
for (dx) in (-38, 36):
    sneaker(k, sx0 + dx * 0.55, sy0 + 4, 0.25, '#ffffff', '#445', stripes='#111')

k.save('/tmp/narisoval/1500', 'media/img/narisoval/r3_1500_devyatka.webp')
