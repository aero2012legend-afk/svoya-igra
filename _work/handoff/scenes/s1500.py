import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=1500)

# --- ночное небо, луна, звёзды, земля ---
sky = [(-20, -20), (W + 20, -20), (W + 20, 430), (-20, 440)]
k.shape(sky, '#2a3b7a', None, gap=12, angle=10)
k.fill(sky, '#2a3b7a', gap=14, angle=-40, op=0.9)
k.shape(ell(190, 120, 58, 58, 20), '#ffe066', '#c9a400', w=6, gap=9)
for (x, y) in [(420, 70), (760, 130), (980, 60), (1180, 170), (560, 200), (60, 240)]:
    k.shape(star5(x, y, 16), '#ffe066', None)
k.grass_band(440, '#2f7a3a', 12)
k.fill([(-20, 450), (W + 20, 450), (W + 20, H + 20), (-20, H + 20)], '#2f7a3a', gap=14, angle=-35, op=0.9)

# --- ёлки сзади ---
def spruce(x, y, s):
    k.shape(rect(x - 12 * s, y - 20 * s, 24 * s, 50 * s), '#6b3a1e', '#3a1c08', w=5, gap=9)
    for i, (hw, hh) in enumerate([(78, 84), (60, 78), (42, 72)]):
        top = y - 22 * s - (i * 62 + hh) * s * 0.85
        base = y - 22 * s - i * 62 * s * 0.85
        k.shape([(x - hw * s, base), (x + hw * s, base), (x, top)], '#1f6b34', '#0d3a1a', w=6, gap=10, smooth=False, amp=2)
for (x, y, s) in [(70, 470, 1.15), (1220, 470, 1.2), (1090, 450, 0.9), (720, 440, 0.8)]:
    spruce(x, y, s)

# --- избушка ---
k.shape([(228, 300), (440, 180), (655, 300)], '#6b3a1e', '#3a1c08', w=9, gap=12, smooth=False, amp=2.5)     # крыша
k.shape(rect(250, 300, 385, 250), '#a8763f', '#4a2a10', w=9, gap=12, angle=80)                              # стена
for yy in (340, 380, 420, 460, 500):
    k.line([(252, yy), (633, yy + k.J(4))], '#5a3a1c', w=5, amp=1.8, twice=False)                           # брёвна
k.shape(rect(520, 150, 40, 90), '#8a8a8a', '#444', w=6, gap=10)                                              # труба
for (x0, y0) in [(540, 120), (566, 76), (540, 32)]:
    k.line([(x0, y0), (x0 + 30, y0 - 22), (x0, y0 - 44)], '#c8c8d0', w=9, amp=2, twice=False)              # дым
k.shape(rect(300, 390, 90, 160), '#241608', '#111', w=7, gap=10)                                             # дверь (открыта, внутри темно)
k.shape(rect(468, 360, 120, 100), '#ffe066', '#5a3a12', w=9, gap=10)                                         # окно светится
k.line([(528, 360), (528, 460)], '#5a3a12', w=6, twice=False); k.line([(468, 410), (588, 410)], '#5a3a12', w=6, twice=False)
k.line([(250, 551), (635, 551)], '#2a1608', w=8)
k.shape([(300, 551), (390, 551), (420, 620), (270, 620)], '#c9a36a', '#7a5a2a', w=5, gap=10, smooth=False)  # дорожка

# --- путник (слева): рюкзак, шляпа, палка ---
tx, ty = 150, 610
k.line([(tx - 4, ty - 120), (tx - 30, ty)], '#222', w=9); k.line([(tx + 2, ty - 120), (tx + 34, ty)], '#222', w=9)   # ноги
k.shape(rect(tx - 36, ty - 214, 62, 100), '#2f6fd6', '#1c3f94', w=6, gap=10)                                          # куртка
k.shape(rect(tx - 76, ty - 205, 44, 80), '#8a5a2b', '#47280e', w=6, gap=10)                                          # рюкзак
k.line([(tx + 20, ty - 190), (tx + 74, ty - 150)], '#222', w=8)                                                       # рука с палкой
k.line([(tx + 74, ty - 150), (tx + 74, ty + 4)], '#7a4a1c', w=9)
k.shape(ell(tx - 6, ty - 244, 26, 26, 14), '#f6c9a4', '#9b6a40', w=5, gap=8)
k.shape(ell(tx - 6, ty - 268, 36, 11, 12), '#5a3a12', '#2a1608', w=4, gap=7)
k.shape(rect(tx - 22, ty - 290, 32, 24), '#5a3a12', '#2a1608', w=4, gap=7)
k.dot(tx + 4, ty - 246, 3.5); k.dot(tx - 14, ty - 246, 3.5)

# --- лесник: борода, шапка, ружьё, улыбка ---
lx, ly = 730, 580
k.line([(lx - 20, ly - 150), (lx - 26, ly)], '#222', w=12); k.line([(lx + 24, ly - 150), (lx + 30, ly)], '#222', w=12)
k.shape(ell(lx - 28, ly + 4, 30, 12, 10), '#222', '#111', w=4, gap=8); k.shape(ell(lx + 34, ly + 4, 30, 12, 10), '#222', '#111', w=4, gap=8)
k.shape([(lx - 52, ly - 250), (lx + 54, ly - 250), (lx + 68, ly - 130), (lx - 66, ly - 130)], '#6b7280', '#2f3646', w=7, gap=11, smooth=False)  # тулуп
k.shape(ell(lx, ly - 290, 38, 38, 16), '#f6c9a4', '#9b6a40', w=6, gap=9)
k.shape([(lx - 40, ly - 280), (lx + 40, ly - 280), (lx + 30, ly - 205), (lx, ly - 188), (lx - 30, ly - 205)], '#f4f4f4', '#9a9a9a', w=5, gap=9, smooth=False)  # борода
k.smile(lx, ly - 238, 30, 12, '#8a3030', 4)
k.dot(lx - 14, ly - 300, 4); k.dot(lx + 14, ly - 300, 4)
k.shape(ell(lx, ly - 326, 46, 20, 14), '#7a4a1c', '#3a200a', w=5, gap=8)                                  # шапка
k.shape(rect(lx - 32, ly - 352, 64, 34), '#7a4a1c', '#3a200a', w=5, gap=8)
k.line([(lx - 60, ly - 150), (lx + 74, ly - 262)], '#8a5a2b', w=15)                                       # ружьё: приклад...
k.line([(lx + 20, ly - 192), (lx + 112, ly - 270)], '#2a2a2a', w=9)                                         # ...и ствол
k.line([(lx - 30, ly - 214), (lx + 4, ly - 168)], '#6b7280', w=18, amp=1)                                   # рука

# --- волки воют (смотрят влево) ---
def wolf(x, y, s, flip=True):
    T = Xf(x, y, s, 0, flip)
    G, GD = '#8d99ae', '#2f3646'
    for pts in ([(-45, -38), (-50, 0)], [(-18, -38), (-22, 0)], [(38, -38), (34, 0)], [(60, -38), (66, 0)]):
        k.line(T(pts), G, w=17 * s, amp=1.2)
    k.shape(T([(-66, -70), (-120, -50), (-146, -6), (-110, -28), (-70, -42)]), G, GD, w=6, gap=10)         # хвост
    k.shape(T(ell(0, -64, 78, 38, 22)), G, GD, w=7, gap=10)                                                # туловище
    k.shape(T([(50, -84), (84, -128), (112, -158), (136, -146), (108, -86)]), G, GD, w=6, gap=10)         # шея
    k.shape(T(ell(122, -160, 34, 25, 16, rot=-45)), G, GD, w=6, gap=9)                                    # голова
    k.shape(T(ell(158, -192, 36, 13, 14, rot=-50)), G, GD, w=6, gap=9)                                    # морда
    k.shape(T([(176, -176), (196, -186), (190, -204)]), '#7a1f1f', None)                                  # пасть
    k.shape(T([(98, -176), (106, -208), (124, -182)]), G, GD, w=5, gap=8, smooth=False)                   # ухо
    k.dot(*T([(128, -162)])[0], 6 * s, '#ffe066'); k.dot(*T([(130, -163)])[0], 2.5 * s, '#111')
wolf(965, 648, 0.85); wolf(1150, 588, 0.9); wolf(1125, 706, 0.65)

k.save('/tmp/narisoval/1500', 'media/img/narisoval/r3_1500_lesnik.webp')
