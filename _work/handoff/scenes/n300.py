import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=4301)
night(k, '#1d2f6e')
k.fill([(-20, 470), (W + 20, 455), (W + 20, H + 20), (-20, H + 20)], '#2f7d3b', gap=11, angle=-6)
for (sx, sy, R) in [(60, 40, 13), (420, 150, 11), (520, 60, 14), (760, 120, 12), (950, 50, 13), (180, 300, 10), (640, 250, 11), (1230, 300, 12)]:
    star(k, sx, sy, R)
# луна
k.shape(ell(190, 150, 80, 80, 22), '#fff3a8', '#c79a00', w=7, gap=10)
k.shape(ell(1110, 126, 64, 66, 22), '#1d2f6e', None, w=1, gap=10) if False else None
# трава
for x in range(0, W, 38):
    h = 24 + (x * 7 % 31)
    k.line([(x + 5, 640), (x + 14 + (x % 11), 640 - h - 40)], '#8fd18f', w=8, amp=1.5, twice=False)
k.grass_band(600, '#3e9a4a')

# конь (смотрит вправо, шагает)
def horse(k, x, y, s=1.0):
    T = Xf(x, y, s)
    body = '#8a5a2b'; dk = '#4a2c10'
    for lx in (-110, -70, 80, 120):               # ноги
        k.line(T([(lx, -110), (lx + 4, -20), (lx + 2, 0)]), body, w=20 * s, amp=1.5, twice=False)
        k.shape(T(rect(lx - 9, -8, 24, 14)), '#222', '#222', w=3, gap=5)
    k.shape(T(ell(0, -170, 150, 70, 22)), body, dk, w=8 * s, gap=11)                       # туловище
    k.shape(T([(100, -190), (150, -300), (205, -330), (255, -285), (225, -255), (190, -258), (150, -150)]), body, dk, w=8 * s, gap=11, smooth=False, amp=2)  # шея+голова
    k.shape(T([(222, -300), (245, -345), (250, -296)]), body, dk, w=5 * s, gap=7, smooth=False)    # ухо
    k.dot(*T.p((222, -296)), 6 * s, '#111')
    k.line(T([(104, -200), (126, -300), (170, -334), (212, -332)]), '#222', w=14 * s, amp=2, twice=False)          # грива
    k.line(T([(-148, -190), (-200, -150), (-212, -80), (-196, -40)]), '#222', w=15 * s, amp=2, twice=False)      # хвост
    return T
horse(k, 700, 590, 1.25)
# человек ведёт коня за повод
hx, hy, R = person(k, 1120, 610, 1.15, shirt='#c0392b', shirtd='#7a1c12', pants='#3a4a7a', armL=(-110, -30), armR=(30, 70), mood='smile', look=(-1, 0))
k.shape([(hx - R * 1.05, hy - R * 0.3), (hx - R * 0.9, hy - R * 1.0), (hx, hy - R * 1.2), (hx + R * 0.9, hy - R * 1.0), (hx + R * 1.1, hy - R * 0.3)], '#3b3b3b', '#111', w=4, gap=8, smooth=False)
k.line([(hx - 170, hy + 130), (hx - 120, hy + 60), (960, 300)], '#d6a050', w=6, amp=2, twice=False)
# ноты и сено
note(k, 520, 250, 1.0, '#ffd43b'); note(k, 400, 330, 0.9, '#ff8aa8')
k.save('/tmp/narisoval2/300', 'media/img/narisoval/r3_300_kon.webp')
