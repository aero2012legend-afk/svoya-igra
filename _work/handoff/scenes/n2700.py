import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=42701)
# кафе: стена и стол
k.fill(rect(-20, -20, W + 40, H + 40), '#f2d9b0', gap=12, angle=3)
k.fill([(-20, 520), (W + 20, 512), (W + 20, H + 20), (-20, H + 20)], '#b07a4a', gap=11, angle=-3)
# окно с занавеской слева
k.shape(rect(30, 60, 220, 300), '#bfe3ff', '#6a4a2a', w=9, gap=11)
k.line([(140, 60), (140, 360)], '#6a4a2a', w=7, amp=1, twice=False)
k.shape([(30, 60), (90, 60), (60, 260), (30, 260)], '#e83e8c', '#8a1050', w=5, gap=9, smooth=False)
# огромная раскрытая книга-комикс в центре: рамки-кадры
BX0, BY0 = 480, 90
k.shape([(BX0, BY0), (BX0 + 740, BY0 - 10), (BX0 + 750, BY0 + 450), (BX0 - 10, BY0 + 460)], '#ffffff', '#555', w=9, gap=14, smooth=False, amp=2)
k.line([(BX0 + 375, BY0 - 5), (BX0 + 380, BY0 + 455)], '#555', w=7, amp=1.5, twice=False)
# кадр 1: мотоцикл на гонке (карандашом: серым, без заливки)
k.shape(rect(BX0 + 30, BY0 + 30, 320, 190), '#ffffff', '#888', w=5, gap=14, smooth=False)
k.line(ell(BX0 + 130, BY0 + 180, 40, 40, 16), '#555', w=7, closed=True, amp=1)
k.line(ell(BX0 + 290, BY0 + 180, 40, 40, 16), '#555', w=7, closed=True, amp=1)
k.line([(BX0 + 130, BY0 + 180), (BX0 + 180, BY0 + 120), (BX0 + 260, BY0 + 120), (BX0 + 290, BY0 + 180)], '#555', w=7, amp=1, twice=False)
k.line([(BX0 + 170, BY0 + 120), (BX0 + 200, BY0 + 80), (BX0 + 240, BY0 + 80)], '#555', w=7, amp=1, twice=False)
k.line(ell(BX0 + 200, BY0 + 66, 14, 14, 10), '#555', w=6, closed=True, amp=0.6, twice=False)
for y in (90, 130, 170):
    k.line([(BX0 + 40, BY0 + y), (BX0 + 100, BY0 + y)], '#aaa', w=5, amp=0.5, twice=False)
# кадр 2: парень-карандашный набросок тянется рукой наружу
k.shape(rect(BX0 + 390, BY0 + 30, 320, 190), '#ffffff', '#888', w=5, gap=14, smooth=False)
k.line(ell(BX0 + 480, BY0 + 110, 30, 32, 14), '#555', w=7, closed=True, amp=1)
k.line([(BX0 + 480, BY0 + 142), (BX0 + 480, BY0 + 215)], '#555', w=7, amp=1, twice=False)
k.line([(BX0 + 480, BY0 + 160), (BX0 + 600, BY0 + 140), (BX0 + 700, BY0 + 150)], '#555', w=7, amp=1, twice=False)
# кадр 3 (внизу): карандашный парень тянет руку наружу — за пределами страницы рука цветная
k.shape(rect(BX0 + 30, BY0 + 250, 680, 180), '#ffffff', '#888', w=5, gap=14, smooth=False)
k.line(ell(BX0 + 120, BY0 + 320, 32, 34, 14), '#555', w=7, closed=True, amp=1)
k.line([(BX0 + 120, BY0 + 354), (BX0 + 120, BY0 + 425)], '#555', w=7, amp=1, twice=False)
k.line([(BX0 + 120, BY0 + 375), (BX0 + 40, BY0 + 360)], '#555', w=7, amp=1, twice=False)
k.line([(BX0 + 40, BY0 + 360), (BX0 - 60, BY0 + 345), (340, 400)], '#f6c9a4', w=22, amp=2, twice=False)
k.dot(340, 400, 18, '#f6c9a4')
k.line([(BX0 + 10, BY0 + 356), (BX0 - 40, BY0 + 350)], '#3a6fd8', w=24, amp=1, twice=False)
# девушка в кафе слева за столом держит чашку, удивлённая
hx, hy, R = person(k, 140, 640, 1.2, dress='#e83e8c', armL=(-30, 20), armR=(110, -30), mood='open', hair='#7a4a1a', hair_style='short', look=(1, 0), cheeks=True)
# чашка
note(k, 1220, 600, 0.9, '#7a3fc0'); note(k, 1170, 660, 0.8, '#e83e8c')
k.save('/tmp/narisoval2/2700', 'media/img/narisoval/r3_2700_aha.webp')
