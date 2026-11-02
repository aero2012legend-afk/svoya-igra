import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=3001)
night(k, '#2a3f86')
for (sx, sy, R) in [(90, 60, 14), (300, 120, 12), (520, 52, 15), (770, 100, 12), (930, 40, 13), (1210, 330, 14), (640, 190, 11), (60, 190, 12)]:
    star(k, sx, sy, R)

# --- луна, которую «опьянила» сама себя: спиральки вместо глаз, щёки, кривая улыбка ---
MX, MY, MR = 1090, 160, 98
k.shape(ell(MX, MY, MR, MR, 24), '#ffe97a', '#c79a00', w=8, gap=11)
for ex in (-34, 34):
    k.line(spiral(MX + ex, MY - 14, 20, 2.0), '#7a5a00', w=5, amp=0.5, twice=False)
k.dot(MX - 58, MY + 22, 13, '#ff8aa8'); k.dot(MX + 58, MY + 22, 13, '#ff8aa8')
k.line([(MX - 38, MY + 44), (MX - 14, MY + 58), (MX + 8, MY + 42), (MX + 34, MY + 60)], '#a02a2a', w=6, amp=1.2)

# --- многоэтажка, над которой летают ---
k.shape(rect(30, 170, 410, 470), '#c4bcae', '#6a6458', w=9, gap=12)
k.shape(rect(18, 150, 434, 34), '#8a8478', '#4a463e', w=7, gap=10)
window_grid(k, 86, 212, 4, 4, ww=56, wh=62, gx=26, gy=26, lit=0.72)
k.shape(rect(210, 560, 58, 80), '#6a4a2a', '#3a2410', w=5, gap=9)

# --- пчеловод: белый комбинезон, шляпа с сеткой, банка мёда ---
bx, by = 700, 650
hx, hy, R = person(k, bx, by, 1.15, shirt='#f7f7f7', shirtd='#8a8a96', pants='#ececf2', armL=(-78, -78), armR=(76, -4),
                   mood='smile', hair='#5a3a1c', look=(0, 0))
k.shape(ell(hx, hy - R * 0.55, R * 1.9, R * 0.42, 16), '#f1e4b8', '#8a7a3a', w=6, gap=10)
k.shape([(hx - R * 1.05, hy - R * 0.55), (hx - R * 0.9, hy - R * 1.65), (hx, hy - R * 1.95), (hx + R * 0.9, hy - R * 1.65), (hx + R * 1.05, hy - R * 0.55)],
        '#f1e4b8', '#8a7a3a', w=6, gap=10)
veil = [(hx - R * 1.75, hy - R * 0.5), (hx + R * 1.75, hy - R * 0.5), (hx + R * 1.25, hy + R * 1.5), (hx - R * 1.25, hy + R * 1.5)]
k.fill(veil, '#c9ced8', gap=17, op=0.55)
k.line(veil, '#7a8090', w=4, closed=True, amp=1.4, twice=False, smooth=False)
# перчатки
k.dot(bx - 90, by - 266 + 25, 13, '#ffd43b')
# банка мёда в правой руке
jx, jy = bx + 98, by - 238
k.shape(rect(jx - 34, jy - 54, 68, 78), '#e8a417', '#7a4a00', w=6, gap=8)
k.shape(rect(jx - 38, jy - 70, 76, 20), '#8a5a2b', '#47280e', w=5, gap=9)
k.line([(jx - 20, jy - 30), (jx + 18, jy - 40)], '#fff0b0', w=6, amp=0.8, twice=False)
k.line([(jx - 8, jy + 24), (jx - 8, jy + 44)], '#e8a417', w=9, amp=0.6, twice=False)          # капля стекает

# --- пчела-девочка: платье в полоску, крылышки, антенны ---
gx, gy = 930, 650
k.shape(ell(gx - 66, gy - 262, 26, 52, 14, rot=-28), '#cfeaff', '#4a7fb0', w=5, gap=8)
k.shape(ell(gx + 66, gy - 262, 26, 52, 14, rot=28), '#cfeaff', '#4a7fb0', w=5, gap=8)
hx2, hy2, R2 = person(k, gx, gy, 1.05, dress='#ffd43b', armL=(-64, -70), armR=(64, -70), mood='open', hair='#222', hair_style='long',
                      legs=((-20, 0), (30, -14)), cheeks=True)
for yy in (-150, -118, -86):
    k.line([(gx - 40 + (yy + 188) * 0.12, gy + yy * 1.05), (gx + 40 - (yy + 188) * 0.12, gy + yy * 1.05)], '#1a1a1a', w=11, amp=1, twice=False)
for sx in (-1, 1):
    k.line([(hx2 + sx * 14, hy2 - R2 * 1.1), (hx2 + sx * 34, hy2 - R2 * 1.8)], '#1a1a1a', w=5, amp=0.5, twice=False)
    k.dot(hx2 + sx * 36, hy2 - R2 * 1.86, 8, '#1a1a1a')

# --- сердце, в которое влетела пчела ---
k.shape(heart(815, 215, 68), '#ff5f8a', '#a02050', w=7, gap=9)
bee(k, 815, 150, 0.55)

# --- стая пчёл над этажами + пунктиры полёта ---
for (x, y, s, f) in [(520, 300, 0.95, False), (330, 100, 0.8, True), (600, 470, 0.7, False), (545, 130, 0.65, False), (470, 560, 0.6, True)]:
    bee(k, x, y, s, f)
zigzag_path(k, [(470, 330), (440, 360), (470, 392), (430, 420)], '#ffd43b', 5)
zigzag_path(k, [(400, 140), (430, 120), (410, 90), (440, 70)], '#ffd43b', 5)
zigzag_path(k, [(640, 470), (610, 500), (640, 530), (600, 560)], '#ffd43b', 5)

# --- земля ---
k.grass_band(640, '#46a84f')
# нотки (музыка двигает тела)
note(k, 1010, 430, 0.9, '#ffd43b'); note(k, 1130, 470, 0.8, '#ff8aa8'); note(k, 560, 600, 0.7, '#ffd43b')

k.save('/tmp/narisoval/300', 'media/img/narisoval/r3_300_pchelovod.webp')
