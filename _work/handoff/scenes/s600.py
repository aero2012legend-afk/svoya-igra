import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from narisoval_kid import *

k = Kid(seed=600)

# --- снежинки вокруг (мороз) ---
def flake(x, y, r=26, col='#6f9fd8'):
    for a in (0, 60, 120):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        k.line([(x - r * ca, y - r * sa), (x + r * ca, y + r * sa)], col, w=6, amp=1.2, twice=False)
for (x, y, r) in [(140, 110, 30), (300, 250, 22), (1010, 120, 32), (1140, 300, 24), (170, 430, 26), (1120, 520, 30), (330, 60, 20), (930, 40, 18), (80, 600, 24)]:
    flake(x, y, r)
for (x, y) in [(220, 180), (260, 360), (1060, 230), (1180, 120), (1010, 420), (230, 560)]:
    k.dot(x, y, 6, '#9cc3ee')

# --- земной шар ---
cx, cy, R = 640, 565, 215
k.shape(ell(cx, cy, R, R, 34), '#4a8fe0', '#1c4fa0', w=10, gap=12)
for blob in ([(520, 470), (580, 440), (640, 470), (620, 530), (560, 560), (505, 530)],
             [(700, 560), (770, 520), (820, 570), (790, 640), (720, 650)],
             [(545, 620), (600, 600), (630, 660), (580, 700), (530, 670)]):
    k.shape([(x, y + 20) for x, y in blob], '#4cae4f', '#2a7a2e', w=6, gap=10)

# --- «земная ось»: полосатый шест, насквозь через шар ---
A, B = (746, 8), (614, 705)
dx, dy = B[0] - A[0], B[1] - A[1]
L = math.hypot(dx, dy)
ux, uy = dx / L, dy / L
nx, ny = -uy, ux
hw = 19
nseg = 14
for i in range(nseg):
    s0, s1 = L * i / nseg, L * (i + 1) / nseg
    q = [(A[0] + ux * s0 + nx * hw, A[1] + uy * s0 + ny * hw), (A[0] + ux * s1 + nx * hw, A[1] + uy * s1 + ny * hw),
         (A[0] + ux * s1 - nx * hw, A[1] + uy * s1 - ny * hw), (A[0] + ux * s0 - nx * hw, A[1] + uy * s0 - ny * hw)]
    if i % 2:
        k.solid(q, '#ffffff')
    else:
        k.fill(q, '#e23b3b', gap=9, angle=80)
    k.line(q, '#7a1f1f', w=4, closed=True, amp=1.2, smooth=False, twice=False)
k.line([(A[0] + nx * hw, A[1] + ny * hw), (B[0] + nx * hw, B[1] + ny * hw)], '#7a1f1f', w=5, amp=1.5, twice=False)
k.line([(A[0] - nx * hw, A[1] - ny * hw), (B[0] - nx * hw, B[1] - ny * hw)], '#7a1f1f', w=5, amp=1.5, twice=False)

# --- медведь в профиль, стоит на задних лапах, спиной трётся о шест ---
BR, BRD = '#8b5a2b', '#47280e'
def bear(x, y, s, flip=False):
    T = Xf(x, y, s, 0, flip)
    k.shape(T(rect(6, -34, 38, 42)), BR, BRD, w=7, gap=11)                          # дальняя нога
    k.shape(T(ell(14, 8, 34, 13, 12)), BR, BRD, w=6, gap=10)
    k.shape(T(ell(0, -97, 58, 90, 24, rot=8)), BR, BRD, w=8, gap=11)               # тело (откинулось назад)
    k.shape(T(ell(-20, -92, 30, 54, 16, rot=8)), '#d8ad72', '#9b7340', w=4, gap=9)  # пузо
    k.shape(T(ell(64, -38, 14, 14, 10)), BR, BRD, w=5, gap=8)                       # хвостик
    k.shape(T(rect(-34, -34, 44, 42)), BR, BRD, w=7, gap=11)                        # ближняя нога
    k.shape(T(ell(-44, 8, 42, 14, 12)), BR, BRD, w=6, gap=10)
    k.line(T([(-26, -150), (-76, -122), (-94, -94)]), BR, w=30, amp=1.5)            # лапа
    k.shape(T(ell(-98, -90, 17, 17, 10)), BR, BRD, w=5, gap=8)
    k.shape(T(ell(-10, -243, 17, 17, 10)), BR, BRD, w=6, gap=9)                     # уши
    k.shape(T(ell(-52, -245, 17, 17, 10)), BR, BRD, w=6, gap=9)
    k.shape(T(ell(-32, -206, 46, 44, 20)), BR, BRD, w=8, gap=11)                    # голова
    k.shape(T(ell(-82, -197, 30, 21, 14, rot=8)), '#e2bd8a', '#9b7340', w=4, gap=8) # морда
    k.dot(*T([(-107, -202)])[0], 8 * s, '#111')                                      # нос
    k.line(T([(-96, -184), (-76, -178), (-58, -186)]), '#111', w=4, amp=0.8, twice=False)
    k.line(T([(-60, -214), (-48, -226), (-36, -214)]), '#111', w=5, amp=0.8, twice=False)   # жмурится
    k.dot(*T([(-38, -194)])[0], 6 * s, '#f08aa0')
bear(615, 343, 1.2)
bear(794, 343, 1.2, True)
# чешутся: волнистые каракули у шеста
for (x0, y0) in [(681, 150), (684, 200), (688, 250)]:
    k.line([(x0, y0), (x0 - 12, y0 + 10), (x0 + 2, y0 + 20), (x0 - 10, y0 + 30)], '#222', w=5, amp=0.8, twice=False)
for (x0, y0) in [(726, 142), (722, 192), (718, 242)]:
    k.line([(x0, y0), (x0 + 12, y0 + 10), (x0 - 2, y0 + 20), (x0 + 10, y0 + 30)], '#222', w=5, amp=0.8, twice=False)

k.save('/tmp/narisoval/600', 'media/img/narisoval/r3_600_medvedi.webp')
