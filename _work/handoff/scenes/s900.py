import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=900)
k.sky_band(46)
RED, REDD = '#e3242c', '#8a1016'

# --- большой дом с окном, где стоит актриса ---
k.shape([(740, 176), (950, 66), (1166, 176)], '#c9552f', '#7a2a12', w=9, gap=11, smooth=False, amp=2)      # крыша
k.shape(rect(764, 176, 376, 380), '#f6e08a', '#8a6a1c', w=9, gap=12)                                         # стена
for (wx, wy, ww, wh) in [(790, 220, 66, 100), (1050, 220, 66, 100)]:                                        # боковые окна
    k.shape(rect(wx, wy, ww, wh), '#cfe9ff', '#5a4a1c', w=6, gap=10)
    k.line([(wx + ww / 2, wy), (wx + ww / 2, wy + wh)], '#5a4a1c', w=4, twice=False)
k.shape(rect(868, 222, 182, 190), '#cfe9ff', '#5a3a12', w=9, gap=11)                                         # окно
k.shape([(870, 224), (900, 224), (890, 330), (870, 330)], '#f28cb1', None)                                   # шторки
k.shape([(1048, 224), (1018, 224), (1028, 330), (1048, 330)], '#f28cb1', None)
# актриса в окне
k.shape(ell(959, 352, 62, 76, 20), '#1b1b1b', '#000', w=4, gap=9)                                            # волосы
k.shape(ell(959, 340, 40, 46, 18), '#f6c9a4', '#9b6a40', w=5, gap=9)                                         # лицо
k.dot(945, 332, 4); k.dot(975, 332, 4)
k.smile(960, 356, 28, 10, '#d01020', 5)
k.shape(ell(1000, 262, 12, 12, 10), '#ff8fb0', '#b0456b', w=3, gap=6)                                        # бантик
k.shape(ell(900, 404, 16, 16, 10), '#f6c9a4', '#9b6a40', w=4, gap=7)                                         # рука на подоконнике
k.line([(852, 414), (1066, 414)], '#5a3a12', w=12)                                                           # подоконник
k.shape(rect(930, 470, 60, 90), '#8a5a2b', '#47280e', w=6, gap=10)                                           # дверь

# --- домик слева и мольберт с холстом ---
k.shape([(14, 340), (100, 262), (186, 340)], '#b8442a', '#6a2010', w=8, gap=10, smooth=False, amp=2)
k.shape(rect(30, 340, 140, 130), '#f4b6c2', '#a04a62', w=8, gap=11)
k.shape(rect(52, 372, 44, 44), '#cfe9ff', '#5a3a12', w=5, gap=9)
k.shape(rect(116, 392, 36, 78), '#8a5a2b', '#47280e', w=5, gap=9)
k.shape(rect(138, 270, 22, 40), '#9a6a4a', '#47280e', w=5, gap=9)                                            # труба
# мольберт
k.line([(268, 380), (232, 540)], '#7a4a1c', w=12); k.line([(338, 380), (372, 540)], '#7a4a1c', w=12)
k.line([(303, 380), (303, 545)], '#7a4a1c', w=10)
k.solid(rect(212, 214, 184, 170), '#ffffff')
k.shape(rect(212, 214, 184, 170), None, '#5a3a12', w=9)
k.shape(ell(270, 280, 24, 24, 12), '#ffd43b', '#c79a00', w=4, gap=7)                                         # на холсте — солнышко
k.line([(226, 350), (262, 330), (300, 352), (340, 328), (382, 350)], '#2f6fd6', w=9)
k.shape([(330, 240), (370, 240), (350, 296)], '#46a84f', '#2a7a2e', w=4, gap=8, smooth=False)

# --- море алых цветов (до самого окна второго этажа) ---
pts = []
for i in range(124):
    y = 470 + 240 * (i / 124) ** 0.8 + k.J(14)
    x = k.r.uniform(-10, 1290)
    pts.append((x, y))
pts.sort(key=lambda p: p[1])
def flower(x, y):
    r = 18 + (y - 460) / 240 * 18
    k.line([(x, y + r * 0.6), (x + k.J(10), y + r + 46)], '#2f8a3a', w=7, amp=1.6, twice=False)
    k.line([(x, y + r + 20), (x + 26, y + r + 6)], '#2f8a3a', w=6, amp=1.2, twice=False)                 # листик
    k.shape(ell(x, y, r, r, 14), RED, REDD, w=4, gap=7)
    k.line([(x - r * 0.4, y - r * 0.1), (x, y + r * 0.3), (x + r * 0.45, y - r * 0.2)], REDD, w=4, amp=0.8, twice=False)
for (x, y) in pts:
    flower(x, y)

# --- художник (палка-палка-огуречик, берет, палитра) ---
px, py = 520, 300
k.line([(px - 36, py - 170 + 170), (px - 52, py + 232)], '#222', w=9)                                      # ноги
k.line([(px + 6, py + 118), (px + 44, py + 232)], '#222', w=9)
k.shape([(px - 4, py + 28), (px - 56, py + 140), (px + 56, py + 140)], '#3a6fd8', '#1c3f94', w=6, gap=10, smooth=False)   # халат
k.line([(px - 22, py + 56), (px - 100, py + 20), (px - 132, py - 30)], '#222', w=8)                         # рука с кистью
k.line([(px - 132, py - 30), (px - 150, py - 62)], '#a0622a', w=7, twice=False)
k.dot(px - 152, py - 66, 6, '#e3242c')
k.line([(px + 20, py + 60), (px + 72, py + 90)], '#222', w=8)                                               # рука с палитрой
k.shape(ell(px + 96, py + 96, 44, 30, 14, rot=-10), '#d9b27a', '#7a5a2a', w=5, gap=8)
for (dx, dy, c) in [(70, 88, '#e3242c'), (92, 80, '#ffd43b'), (114, 90, '#2f6fd6'), (96, 106, '#46a84f')]:
    k.dot(px + dx, py + dy, 6, c)
k.shape(ell(px, py - 12, 30, 32, 16), '#f6c9a4', '#9b6a40', w=6, gap=9)                                    # голова
k.shape(ell(px, py - 38, 36, 14, 14), '#e3242c', '#8a1016', w=5, gap=8)                                    # берет
k.shape(ell(px + 14, py - 50, 18, 9, 10), '#e3242c', '#8a1016', w=4, gap=7)
k.dot(px - 10, py - 14, 4); k.dot(px + 12, py - 14, 4)
k.smile(px + 1, py + 2, 24, 9, '#c0392b', 4)
# передний ряд цветов поверх ног художника
for (x, y) in [(470, 640), (560, 655), (500, 690), (610, 676), (430, 676)]:
    flower(x, y)

k.save('/tmp/narisoval/900', 'media/img/narisoval/r3_900_rozy.webp')
