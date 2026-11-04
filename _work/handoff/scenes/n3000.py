import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=43001)
# закат над пустыней
k.fill(rect(-20, -20, W + 40, 420), '#7a3a8a', gap=11, angle=4)
k.fill(rect(-20, 220, W + 40, 220), '#ff8a4a', gap=11, angle=-3)
k.shape(ell(250, 380, 90, 90, 22), '#ffd43b', '#c79a00', w=7, gap=10)
star(k, 800, 60, 11); star(k, 1000, 110, 12); star(k, 560, 40, 10); star(k, 1180, 50, 11)
# пустыня и шоссе
k.fill([(-20, 430), (W + 20, 424), (W + 20, H + 20), (-20, H + 20)], '#d9a441', gap=11, angle=-5)
k.shape([(540, 440), (740, 440), (1000, 730), (200, 730)], '#4a4a55', '#222', w=7, gap=11, smooth=False, amp=2)
for (y, w_) in ((470, 10), (520, 14), (590, 20), (680, 28)):
    k.line([(640, y), (640, y + 36)], '#ffd43b', w=w_, amp=0.6, twice=False)
# кактусы
def cactus(x, y, s=1.0):
    k.line([(x, y), (x, y - 140 * s)], '#2f8f4a', w=26 * s, amp=1.5, twice=False)
    k.line([(x, y - 60 * s), (x - 40 * s, y - 60 * s), (x - 40 * s, y - 110 * s)], '#2f8f4a', w=16 * s, amp=1.2, twice=False)
    k.line([(x, y - 80 * s), (x + 36 * s, y - 80 * s), (x + 36 * s, y - 120 * s)], '#2f8f4a', w=16 * s, amp=1.2, twice=False)
cactus(110, 560, 1.2); cactus(1160, 520, 1.0); cactus(330, 470, 0.6)
# отель вдали справа: здание, колокол, светящиеся окна, неон-звезда (без надписей)
k.shape(rect(820, 260, 360, 170), '#f0d9a8', '#7a5a30', w=8, gap=11)
k.shape(rect(960, 200, 100, 70), '#f0d9a8', '#7a5a30', w=7, gap=10)
k.shape([(950, 200), (1010, 150), (1070, 200)], '#c9552f', '#7a2a12', w=6, gap=9, smooth=False)
k.shape(ell(1010, 232, 24, 22, 12), '#ffd43b', '#9a7000', w=5, gap=8)            # колокол
k.line([(1010, 252), (1010, 262)], '#9a7000', w=6, amp=0.3, twice=False)
for x in (850, 900, 1090, 1140):
    k.shape(rect(x, 300, 34, 44), '#ffe27a', '#7a5a30', w=5, gap=8)
k.shape(rect(980, 340, 60, 90), '#6a3a1a', '#3a1c08', w=6, gap=9)
# девушка у двери со свечой
person(k, 1010, 436, 0.42, dress='#ffffff', armL=(-30, 40), armR=(30, 40), mood='smile', hair='#222', hair_style='long')
sparkle(k, 1044, 340, 12, '#ffffff', 4)
# вывеска-неоновая звезда
k.shape(star5(780, 200, 40, 20), '#ff3b7a', '#a01040', w=5, gap=7, smooth=False)
# машина едет по шоссе, водитель с ветром в волосах
car(k, 600, 700, 0.9, body='#d62828', bodyd='#7a1010', roof_row=False)
for dy in (-20, 10, 40):
    k.line([(440, 600 + dy), (340, 606 + dy)], '#ffffff', w=6, amp=1.5, twice=False)
# зеркало на потолке и бокал шампанского — врезка-«мысль»
bubble(k, 250, 160, 190, 100, tail_to=(450, 440))
k.shape(rect(120, 110, 280, 70), '#bfe3ff', '#6a8aa0', w=6, gap=9)
k.line([(140, 125), (200, 170)], '#ffffff', w=6, amp=0.6, twice=False)
k.shape([(330, 190), (360, 190), (352, 215), (338, 215)], '#ffe9a8', '#9a7000', w=3, gap=6, smooth=False)
k.save('/tmp/narisoval2/3000', 'media/img/narisoval/r3_3000_hotel.webp')
