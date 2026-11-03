import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

# «Я так видел» 1600: Bacardi (чёрная летучая мышь с распахнутыми крыльями). Фон — бирюзовая страница; дополнения Васи — клыки, глазки,
# месяц, звёзды и мышата. Букв и названия бренда нет.
k = Kid(seed=16001)
k.fill(rect(-20, -20, W + 40, H + 40), '#9fe0dc', gap=11, angle=-8)
for (sx, sy, R) in [(110, 480, 14), (300, 640, 12), (1170, 600, 14), (950, 90, 12), (420, 90, 12), (1210, 280, 11), (90, 250, 11)]:
    star(k, sx, sy, R)
# месяц (серп) вверху справа
R_, r_, d_ = 56, 46, 26
xx = (R_ * R_ - r_ * r_ + d_ * d_) / (2 * d_)
yy = math.sqrt(R_ * R_ - xx * xx)
t_ = math.degrees(math.atan2(yy, xx))
ti = math.degrees(math.atan2(-yy, xx - d_)) % 360
moon = ell(1090, 130, R_, R_, 14, a0=t_, a1=360 - t_) + ell(1090 + d_, 130, r_, r_, 14, a0=ti, a1=360 - ti)
k.shape(moon, '#fff3a0', '#c9a800', w=5, gap=8, smooth=False, amp=1.2)
k.cloud(220, 140, 0.9, '#4a90d9', '#ffffff')
k.cloud(1060, 420, 0.7, '#4a90d9', '#ffffff')

WING = [(-28, -30), (-120, -122), (-210, -140), (-285, -135), (-236, -70), (-262, -2), (-206, -22), (-206, 50), (-148, 20), (-140, 80), (-88, 50), (-34, 60)]


def bat(x, y, s=1.0, face=True):
    T = Xf(x, y, s)
    BLK = '#141414'
    for sg in (-1, 1):
        w = [(sg * px, py) for px, py in WING]
        k.shape(T(w), '#1b1b22', '#000', w=7 * s + 1, gap=max(6, 10 * s), smooth=False, amp=1.8 * s + 0.4)
        # косточки крыла
        for tip in [(-262, -2), (-206, 50), (-140, 80)]:
            k.line(T([(sg * -120, -122), (sg * tip[0], tip[1])]), '#55556a', w=4 * s + 1, amp=0.6, twice=False)
    # тело и голова
    k.shape(T(ell(0, 12, 36, 64, 16)), BLK, '#000', w=6 * s + 1, gap=9)
    k.shape(T(ell(0, -60, 32, 28, 14)), BLK, '#000', w=6 * s + 1, gap=9)
    for sg in (-1, 1):
        k.shape(T([(sg * 22, -78), (sg * 38, -122), (sg * 6, -86)]), BLK, '#000', w=5 * s + 1, gap=8, smooth=False)
    # лапки
    for sg in (-1, 1):
        k.line(T([(sg * 12, 72), (sg * 18, 98)]), BLK, w=8 * s + 1, amp=0.6, twice=False)
    if face:
        for sg in (-1, 1):
            ex, ey = T.p((sg * 13, -66))
            k.shape(ell(ex, ey, 8 * s + 1, 8 * s + 1, 8), '#ffffff', None, gap=5)
            k.dot(ex, ey + 1, 3.5 * s + 1, '#e3242c')
        for sg in (-1, 1):
            k.shape(T([(sg * 12 - 5, -48), (sg * 12, -34), (sg * 12 + 5, -48)]), '#ffffff', '#ffffff', w=2, gap=5, smooth=False)


bat(640, 372, 1.35)
# мышата — дополнение Васи
for (x, y, s_) in [(210, 380, 0.34), (1070, 250, 0.3), (1090, 590, 0.38), (240, 600, 0.3)]:
    bat(x, y, s_, face=False)

signature(k, 1262, 704, 30, '#3a4a4a')
k.save('/tmp/takvidel/1600', 'media/img/takvidel/r2_1600_bacardi.webp')
