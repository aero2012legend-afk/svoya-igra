import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Комета» (JONY, 2019): мальчик летит на огненной комете с шаром «инь-ян» к девочке на лугу; снизу в него целится водяным пистолетом
# дядя в шляпе; слева — метель и воющий волк («Буря мглою…» Пушкина) под падающей луной. Надписей нет, слова «комета» нет.
k = Kid(seed=2701)
night(k, '#171f6b', gap=11, angle=-8)
for (sx, sy, R) in [(60, 190, 12), (430, 60, 13), (590, 170, 11), (720, 40, 12), (1010, 70, 12), (1190, 150, 14), (1240, 330, 11), (330, 160, 10), (950, 190, 10)]:
    star(k, sx, sy, R)

# --- земля: снег слева, цветочный холм справа (метель и «наше лето») ---
snow = [(-20, 610), (160, 596), (380, 604), (600, 632), (640, 740), (-20, 740)]
k.shape(snow, '#eef4ff', '#8fa6c8', w=6, gap=12, angle=-8)
hill = [(500, 740), (640, 664), (820, 608), (1040, 566), (1280, 584), (1300, 740)]
k.shape(hill, '#4fae52', '#1e7a34', w=7, gap=11, angle=-10)


def flower(x, y, c, r=13):
    k.line([(x, y + r), (x + k.J(5), y + r + 30)], '#2f8a3a', w=5, amp=1.0, twice=False)
    for a in range(0, 360, 72):
        k.shape(ell(x + r * 0.95 * math.cos(math.radians(a)), y + r * 0.95 * math.sin(math.radians(a)), r * 0.62, r * 0.62, 8), c, None)
    k.shape(ell(x, y, r * 0.55, r * 0.55, 8), '#ffd43b', '#c79a00', w=3, gap=6)


for (x, y, c) in [(760, 670, '#ff8aa8'), (880, 650, '#ffffff'), (990, 630, '#ff8a00'), (1160, 660, '#ff8aa8'), (1240, 640, '#ffffff'), (940, 700, '#ff8a00'),
                  (1080, 698, '#ffffff'), (700, 706, '#ffd43b')]:
    flower(x, y, c)

# --- падающая луна (серп с «хвостом» движения) ---
R_, r_, d_ = 50, 42, 24
xx = (R_ * R_ - r_ * r_ + d_ * d_) / (2 * d_)
yy = math.sqrt(R_ * R_ - xx * xx)
t_ = math.degrees(math.atan2(yy, xx))
ti = math.degrees(math.atan2(-yy, xx - d_)) % 360
mx, my = 120, 104
moon = ell(mx, my, R_, R_, 14, a0=t_, a1=360 - t_) + ell(mx + d_, my, r_, r_, 14, a0=ti, a1=360 - ti)
k.shape(moon, '#fff3a0', '#c9a800', w=5, gap=8, smooth=False, amp=1.2)
for (a, b) in [((60, 36), (28, 8)), ((112, 28), (92, -6)), ((22, 90), (-8, 70))]:
    k.line([a, b], '#fff3a0', w=5, amp=0.6, twice=False)

# --- метель: тучка, вихри, снежинки и воющий волк ---
k.cloud(250, 300, 1.5, '#6a7a9a', '#8a96b8')
k.line(spiral(190, 430, 64, 2.2, 26), '#dfeaff', w=6, amp=1.2)
k.line(spiral(350, 490, 48, 2.0, 22), '#dfeaff', w=6, amp=1.2)
for (fx, fy) in [(80, 330), (430, 350), (60, 520), (440, 420), (300, 392), (120, 600), (470, 540)]:
    sparkle(k, fx, fy, 12, '#ffffff', 5)
# волк
GR = '#9aa0aa'
for lx in (206, 238, 282, 312):
    k.line([(lx, 668), (lx + k.J(3), 706)], '#6a7078', w=11, amp=0.8, twice=False)
k.shape(ell(262, 652, 80, 36, 18), GR, '#4a5058', w=6, gap=9)
k.line([(336, 640), (386, 604), (398, 580)], GR, w=16, amp=1.2, twice=False)
k.shape(ell(190, 610, 36, 28, 14, rot=-35), GR, '#4a5058', w=6, gap=9)
k.shape([(172, 598), (134, 562), (156, 548), (200, 584)], GR, '#4a5058', w=5, gap=8, smooth=False)
k.shape([(150, 566), (128, 546), (140, 570)], '#a02a2a', None, gap=6)            # открытая пасть
k.shape([(196, 592), (198, 552), (224, 584)], '#6a7078', '#4a5058', w=4, gap=6, smooth=False)   # уши
k.shape([(214, 602), (238, 566), (246, 606)], '#6a7078', '#4a5058', w=4, gap=6, smooth=False)
k.dot(176, 604, 5)
for (a, b) in [((120, 536), (96, 512)), ((146, 528), (136, 496))]:
    k.line([a, b], '#dfeaff', w=5, amp=0.6, twice=False)

# --- хвост кометы ---
H0 = (860, 320)
E = (320, -30)
ux, uy = E[0] - H0[0], E[1] - H0[1]
L = math.hypot(ux, uy)
ux, uy = ux / L, uy / L
nx, ny = -uy, ux


def tail(width, ext, phase):
    top, bot = [], []
    n = 16
    for i in range(n + 1):
        t = i / n * ext
        cx_, cy_ = H0[0] + (E[0] - H0[0]) * t, H0[1] + (E[1] - H0[1]) * t
        hw = width * (1 - t) * (1 + 0.16 * math.sin(i * 1.7 + phase)) + 5
        top.append((cx_ + nx * hw, cy_ + ny * hw))
        bot.append((cx_ - nx * hw, cy_ - ny * hw))
    return top + bot[::-1]


k.shape(tail(78, 1.0, 0.0), '#ff7a1a', '#c0390b', w=6, gap=12, smooth=False, amp=1.5)
k.shape(tail(46, 0.8, 1.3), '#ffd43b', None, gap=10, smooth=False)

# --- голова кометы: огненный шар с «инь-ян» ---
CX, CY = H0
k.shape(ell(CX, CY, 82, 82, 22), '#ff9a1a', '#c0390b', w=7, gap=11)
YR = 60
k.shape(ell(CX, CY, YR, YR, 20), '#ffffff', '#222', w=5, gap=9)
k.shape(ell(CX, CY, YR, YR, 14, a0=90, a1=270), '#111111', '#222', w=4, gap=7)
k.shape(ell(CX, CY - YR / 2, YR / 2, YR / 2, 12), '#ffffff', None, gap=7)
k.shape(ell(CX, CY + YR / 2, YR / 2, YR / 2, 12), '#111111', None, gap=7)
k.line(ell(CX, CY, YR, YR, 20), '#222', w=5, closed=True, amp=1.0, twice=False)
k.dot(CX, CY - YR / 2, 7, '#111'); k.dot(CX, CY + YR / 2, 7, '#ffffff')

# --- мальчик на комете ---
px, py = CX + 6, CY - 80
person(k, px, py, 0.62, shirt='#ff5f5f', shirtd='#a02a2a', pants='#2b2f6b', armL=(58, -26), armR=(84, 6), mood='open', hair='#3a2410',
       legs=((-16, 0), (20, 0)), look=(3, 0))

# --- девочка на холме, ждёт ---
ghx, ghy, gR = person(k, 1096, 572, 0.64, dress='#ffd43b', hair='#b5651d', hair_style='long', armL=(-48, -76), armR=(52, -76), mood='smile', cheeks=True,
                      legs=((-17, 0), (19, 0)), shoes='#c0392b')
for sg in (-1, 1):
    k.shape([(ghx + sg * gR * 0.92, ghy - gR * 0.1), (ghx + sg * gR * 1.32, ghy + gR * 0.9), (ghx + sg * gR * 1.18, ghy + gR * 2.0),
             (ghx + sg * gR * 0.62, ghy + gR * 1.7), (ghx + sg * gR * 0.74, ghy + gR * 0.5)], '#b5651d', '#6a3a10', w=4, gap=8, smooth=False, amp=1.2)

# --- дядя в шляпе с водяным пистолетом ---
gx, gy = 470, 660
hx, hy, Rg = person(k, gx, gy, 0.52, shirt='#4a4a58', shirtd='#222', pants='#222', armL=(-26, 40), armR=(116, -66), mood='angry', hair='#222',
                    legs=((-16, 0), (16, 0)))
k.shape(ell(hx, hy - Rg * 0.9, Rg * 1.7, Rg * 0.34, 12), '#2a2a2a', '#000', w=4, gap=7)
k.shape(rect(hx - Rg * 0.85, hy - Rg * 1.85, Rg * 1.7, Rg * 1.0), '#2a2a2a', '#000', w=4, gap=7)
k.line([(hx - Rg * 0.85, hy - Rg * 1.0), (hx + Rg * 0.85, hy - Rg * 1.0)], '#c0392b', w=5, amp=0.4, twice=False)
hand = (gx + (28 + 116) * 0.52, gy + (-178 - 66) * 0.52)
ang = math.degrees(math.atan2(CY + 40 - hand[1], CX - 100 - hand[0]))
T = Xf(hand[0] - 6, hand[1] + 4, 0.62, rot=ang)
k.shape(T([(-6, -12), (78, -12), (78, 2), (30, 2), (26, 40), (4, 40), (6, 2), (-6, 2)]), '#2fc46b', '#0f6a30', w=5, gap=8, smooth=False, amp=1.2)
tipx, tipy = T.p((80, -5))
for (dx, dy) in [(22, -16), (38, -2), (30, 20), (52, -22)]:
    k.shape(drop(tipx + dx, tipy + dy, 7), '#4aa8ff', '#2a6ac0', w=2, gap=4)

k.save('/tmp/narisoval/2700', 'media/img/narisoval/r3_2700_kometa.webp')
