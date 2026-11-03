import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Я так видел» 600: Red Bull (два красных быка бодаются на фоне золотого солнца). Фон — сине-серебристая «банка»; дополнение Васи —
# маленькие крылышки быкам. Букв и названия бренда нет.
k = Kid(seed=6001)
k.fill(rect(-20, -20, W + 40, H + 40), '#2f55ad', gap=11, angle=-8)
# серебристые диагонали
for pts in ([(-20, 60), (160, -20), (300, -20), (-20, 200)], [(900, -20), (1040, -20), (W + 20, 120), (W + 20, 260)]):
    k.fill(pts, '#cfd6e6', gap=12, angle=40, op=0.85)
# серебристая земля
ground = [(-20, 612), (320, 604), (700, 616), (1000, 602), (W + 20, 610), (W + 20, H + 20), (-20, H + 20)]
k.fill(ground, '#cfd5e2', gap=12, angle=-6)
k.line(ground[:6], '#7d8498', w=6, amp=2)

# золотое солнце
SX, SY = 640, 330
for a in range(0, 360, 24):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.line([(SX + 176 * ca, SY + 176 * sa), (SX + 214 * ca, SY + 214 * sa)], '#ffd43b', w=8, amp=1.2, twice=False)
k.shape(ell(SX, SY, 160, 160, 30), '#ffc21a', '#e07a00', w=9, gap=10)
k.shape(ell(SX, SY, 108, 108, 24), '#ffe566', None, gap=9)


def bull(x, y, s=1.0, flip=False):
    T = Xf(x, y, s, flip=flip)
    R, RD = '#d9231c', '#6f0e0b'

    def leg(pts, col, w=30):
        k.line(T(pts), RD, w=(w + 9) * s, amp=1.0, twice=False)
        k.line(T(pts), col, w=w * s, amp=1.0, twice=False)

    # дальние ноги
    leg([(70, 45), (95, 98), (140, 120)], '#a8160f', 28)
    leg([(-80, 50), (-108, 108), (-76, 138)], '#a8160f', 28)
    # хвост
    k.line(T([(-140, -20), (-178, -62), (-166, -112), (-192, -140)]), RD, w=9 * s, amp=1.2, twice=False)
    k.shape(T(ell(-194, -146, 13, 18, 10)), '#3a0806', '#3a0806', w=3, gap=5)
    # туловище с горбом
    k.shape(T([(-140, -8), (-122, -55), (-60, -74), (20, -80), (72, -100), (122, -76), (152, -30), (152, 20), (120, 56), (40, 70), (-50, 70), (-112, 52)]),
            R, RD, w=8 * s, gap=11, amp=2.2)
    # голова пониже, рога вперёд-вверх
    k.shape(T(ell(176, 16, 50, 38, 14, rot=22)), R, RD, w=7 * s, gap=9)
    k.shape(T(ell(214, 40, 26, 22, 12, rot=22)), '#ffb3a0', '#a8160f', w=5 * s, gap=7)
    horn = [(158, -12), (184, -48), (226, -62), (250, -96)]
    k.line(T(horn), '#7a5a30', w=19 * s, amp=0.8, twice=False)
    k.line(T(horn), '#fff0c8', w=12 * s, amp=0.8, twice=False)
    k.shape(T(ell(136, -6, 14, 22, 10, rot=-30)), '#a8160f', RD, w=4 * s, gap=6)
    ex, ey = T.p((192, 8))
    k.shape(ell(ex, ey, 9 * s, 8 * s, 8), '#ffffff', '#222', w=3, gap=5)
    k.dot(ex + 2 * s, ey, 4 * s, '#111')
    nx, ny = T.p((226, 40))
    k.dot(nx, ny, 4 * s, '#5a0e0a')
    # ближние ноги
    leg([(100, 50), (135, 104), (186, 122)], R)
    leg([(-62, 55), (-92, 114), (-58, 142)], R)
    for (hx_, hy_) in [(190, 124), (-54, 144)]:
        k.shape(T(ell(hx_, hy_, 17, 10, 8)), '#2a1a12', '#2a1a12', w=3, gap=5)
    # крылышки — дополнение Васи
    k.shape(T([(-4, -78), (-34, -128), (-86, -166), (-72, -118), (-118, -140), (-96, -96), (-142, -104), (-98, -66)]), '#ffffff', '#8a96c0', w=6 * s, gap=9,
            smooth=False, amp=1.4)


bull(300, 500, 0.95, False)
bull(980, 500, 0.95, True)

signature(k, 1262, 704, 30, '#4a4a4a')
k.save('/tmp/takvidel/600', 'media/img/takvidel/r2_600_redbull.webp')
