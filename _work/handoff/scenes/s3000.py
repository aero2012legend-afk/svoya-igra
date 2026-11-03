import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Юность» (Dabro, 2020): закат во дворе, колонка в распахнутом окне на всю громкость, сосед снизу со шваброй, костёр с искрами в небо,
# друзья с гитарой и девочка с двумя белыми косичками, которые «подлетают наверх». Надписей нет.
k = Kid(seed=3001)
SKY = [(-20, -20), (W + 20, -20), (W + 20, 440), (-20, 450)]
k.fill(SKY, '#27388f', gap=11, angle=8)
k.fill([(-20, 300), (W + 20, 290), (W + 20, 500), (-20, 510)], '#9b5fb8', gap=12, angle=-6, op=0.9)
k.fill([(-20, 440), (W + 20, 430), (W + 20, 650), (-20, 660)], '#ffa24a', gap=12, angle=5, op=0.95)
for (sx, sy, R) in [(560, 60, 12), (700, 130, 10), (860, 50, 13), (1010, 120, 11), (1170, 60, 12), (1240, 190, 10), (610, 220, 9), (940, 230, 9)]:
    star(k, sx, sy, R)

# закатное солнце на горизонте справа
SXc, SYc = 1190, 630
for a in range(200, 345, 18):
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    k.line([(SXc + 84 * ca, SYc + 84 * sa), (SXc + 128 * ca, SYc + 128 * sa)], '#ffd43b', w=7, amp=1.0, twice=False)
k.shape(ell(SXc, SYc, 68, 68, 20), '#ffd43b', '#e08a00', w=6, gap=9)

k.grass_band(636, '#3f9a4b', 12)

# --- дом ---
k.shape(rect(40, 56, 400, 592), '#cfc7b8', '#5e594e', w=9, gap=13)
window_grid(k, 72, 90, 3, 4, ww=84, wh=84, gx=38, gy=28, lit=0.55, on='#ffe27a', off='#4a5a8a', frame='#5e594e')
# подъезд с козырьком
k.shape(rect(186, 548, 108, 100), '#7a5a3a', '#3a2a1a', w=6, gap=10)
k.shape([(170, 548), (310, 548), (296, 524), (184, 524)], '#a02a2a', '#5a1010', w=5, gap=8, smooth=False)
k.dot(276, 604, 6, '#ffd43b')

# окно с колонкой: настежь, на всю громкость
WX, WY = 316, 202
k.shape(rect(WX, WY, 84, 84), '#ffe27a', '#5e594e', w=5, gap=9)
k.shape(rect(WX + 8, WY + 6, 68, 78), '#2e2e36', '#000', w=5, gap=8)
k.shape(ell(WX + 42, WY + 28, 11, 11, 10), '#888', '#222', w=3, gap=6)
k.shape(ell(WX + 42, WY + 60, 19, 19, 12), '#777', '#111', w=4, gap=7)
k.dot(WX + 42, WY + 60, 7, '#222')
for r_ in (44, 84, 124):
    k.line(ell(WX + 88, WY + 44, r_ * 0.6, r_, 10, a0=-60, a1=60), '#ff5fa2', w=7, amp=1.4, twice=False)
note(k, 540, 250, 1.0, '#ffd43b'); note(k, 586, 150, 0.85, '#ff8aa8'); note(k, 490, 130, 0.8, '#7bf0ff')

# окно этажом ниже: сосед в колпаке со шваброй
NX, NY = 316, 314
k.shape(rect(NX, NY, 84, 84), '#ffe27a', '#5e594e', w=5, gap=9)
k.shape(ell(NX + 42, NY + 52, 22, 24, 12), SKIN, SKIND, w=4, gap=7)
k.shape([(NX + 20, NY + 40), (NX + 62, NY + 40), (NX + 70, NY + 8)], '#c0392b', '#7a1a12', w=4, gap=7, smooth=False)
k.dot(NX + 72, NY + 6, 6, '#ffffff')
face(k, NX + 42, NY + 54, 24, 'angry')
k.line([(NX + 70, NY + 82), (NX + 18, NY + 6)], '#8a5a2a', w=6, amp=0.6, twice=False)
k.shape([(NX + 6, NY + 6), (NX + 30, NY + 0), (NX + 36, NY + 16), (NX + 14, NY + 24)], '#e6c24a', '#8a6a10', w=3, gap=5, smooth=False)
k.dot(NX + 66, NY + 74, 8, SKIN)

# --- костёр ---
FX, FY = 770, 690
k.line([(FX - 62, FY + 12), (FX + 62, FY - 26)], '#6b4423', w=15, amp=1.2, twice=False)
k.line([(FX - 62, FY - 26), (FX + 62, FY + 12)], '#6b4423', w=15, amp=1.2, twice=False)
k.shape([(FX - 4, FY - 8), (FX - 48, FY - 24), (FX - 30, FY - 76), (FX - 2, FY - 126), (FX + 20, FY - 80), (FX + 50, FY - 26)], '#ff7a1a', '#c0390b', w=6, gap=10, smooth=False, amp=1.5)
k.shape([(FX, FY - 10), (FX - 22, FY - 22), (FX - 8, FY - 62), (FX + 4, FY - 90), (FX + 16, FY - 50), (FX + 28, FY - 24)], '#ffd43b', None, gap=9, smooth=False)
for (dx, dy, r_) in [(-30, -170, 10), (26, -210, 12), (-6, -260, 9), (60, -300, 12), (-46, -320, 10), (14, -360, 9), (96, -390, 10), (-90, -250, 9)]:
    sparkle(k, FX + dx, FY + dy, r_, '#ffd43b', 5)
for (dx, dy) in [(40, -150), (-20, -230), (30, -280), (-70, -190), (80, -340), (-30, -400)]:
    k.dot(FX + dx, FY + dy, 4, '#ff9a1a')

# --- друзья вокруг костра ---
# парень с гитарой
gx_, gy_ = 610, 694
person(k, gx_, gy_, 0.58, shirt='#3a6fd8', shirtd='#1c3f94', pants='#2b2f6b', armL=(-6, 46), armR=(40, 56), mood='smile', hair='#3a2410', legs=((-16, 0), (18, 0)))
k.line([(gx_ + 4, gy_ - 82), (gx_ - 56, gy_ - 148)], '#8a5a2a', w=8, amp=0.8, twice=False)
k.shape(ell(gx_ + 18, gy_ - 74, 34, 26, 14, rot=-20), '#c0702a', '#6a3a10', w=5, gap=8)
k.shape(ell(gx_ - 8, gy_ - 94, 22, 18, 12, rot=-20), '#c0702a', '#6a3a10', w=5, gap=8)
k.dot(gx_ + 14, gy_ - 74, 8, '#3a2410')
# девочка с двумя белыми косичками (подлетают наверх)
bx_, by_ = 930, 664
k.shape(ell(bx_, 696, 46, 9, 12), '#2f7a3a', None, gap=6)
hx, hy, R = person(k, bx_, by_, 0.58, dress='#ff5f8a', hair='#f5f0e0', hair_style='short', armL=(-50, -74), armR=(50, -74), mood='open',
                   legs=((-14, -20), (18, -12)), cheeks=True, shoes='#c0392b')
for sg in (-1, 1):
    k.line([(hx + sg * R * 0.9, hy - R * 0.2), (hx + sg * R * 1.7, hy - R * 1.1), (hx + sg * R * 2.1, hy - R * 2.1)], '#ffffff', w=12, amp=0.9, twice=False)
    k.line([(hx + sg * R * 0.9, hy - R * 0.2), (hx + sg * R * 1.7, hy - R * 1.1), (hx + sg * R * 2.1, hy - R * 2.1)], '#c9c2ae', w=3, amp=0.6, twice=False)
    k.dot(hx + sg * R * 2.1, hy - R * 2.1, 6, '#e3242c')
# третий друг, поёт
person(k, 1080, 694, 0.58, shirt='#e6a82a', shirtd='#8a5a00', pants='#2b2f6b', armL=(-46, -70), armR=(46, -50), mood='open', hair='#222',
       legs=((-16, 0), (18, 0)))

k.save('/tmp/narisoval/3000', 'media/img/narisoval/r3_3000_yunost.webp')
