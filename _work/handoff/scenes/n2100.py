import sys, math
sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
from kidlib import *

k = Kid(seed=42101)
night(k, '#2a3a7a')
for (sx, sy, R) in [(80, 60, 13), (330, 120, 11), (520, 50, 14), (760, 100, 12), (1000, 60, 13), (1220, 140, 11)]:
    star(k, sx, sy, R)
k.shape(ell(200, 200, 70, 70, 22), '#fff3a8', '#c79a00', w=7, gap=10)
# река с волнами
k.fill([(-20, 470), (W + 20, 462), (W + 20, H + 20), (-20, H + 20)], '#3a86d8', gap=11, angle=-3)
for (x, y) in [(120, 540), (420, 590), (760, 560), (1100, 610), (300, 650), (900, 660)]:
    k.line([(x - 60, y), (x - 30, y - 14), (x, y), (x + 30, y - 14), (x + 60, y)], '#bfe0ff', w=7, amp=1, twice=False)
# кирпичная стена и башня со звездой на другом берегу
k.shape(rect(-20, 400, 780, 80), '#b5382a', '#5a1810', w=7, gap=10)
for x in range(0, 760, 56):
    k.shape(rect(x, 376, 36, 28), '#b5382a', '#5a1810', w=5, gap=8)
k.shape(rect(840, 270, 110, 210), '#b5382a', '#5a1810', w=7, gap=10)
k.shape([(830, 270), (895, 120), (960, 270)], '#2f8f4a', '#12482a', w=7, gap=9, smooth=False, amp=1.5)
k.shape(star5(895, 100, 26), '#e63946', '#8a1018', w=4, gap=6, smooth=False)
k.shape(ell(895, 330, 30, 30, 14), '#ffffff', '#5a1810', w=5, gap=8)
k.line([(895, 330), (895, 312)], '#222', w=5, amp=0.3, twice=False)
k.line([(895, 330), (908, 336)], '#222', w=5, amp=0.3, twice=False)
# парк: деревья на берегу
for (tx, ty) in ((1060, 470), (1170, 475)):
    k.line([(tx, ty), (tx, ty - 110)], '#5a3a1c', w=18, amp=2, twice=False)
    k.shape(ell(tx, ty - 150, 70, 60, 16), '#3c9a3c', '#1f5a1f', w=6, gap=9)
# человек-рокер на набережной слушает ветер (волосы развеваются)
hx, hy, R = person(k, 520, 640, 1.2, shirt='#222222', shirtd='#000', pants='#2b3a8a', armL=(-40, 60), armR=(40, 60), mood='open', hair='#c9a050', hair_style='long', look=(1, 0))
for (dy) in (-30, 0, 30):
    k.line([(hx - R * 0.9, hy + dy * 0.6), (hx - R * 2.6, hy + dy + 16)], '#c9a050', w=9, amp=2, twice=False)
# рот-свистулька и ноты
for (nx, ny, s) in ((hx + 60, hy - 40, 0.9), (hx + 120, hy - 90, 0.8), (hx + 190, hy - 120, 0.7)):
    note(k, nx, ny, s, '#ffd43b')
# ветер: воздушные спирали
for (cx, cy, sc) in ((300, 300, 60), (1000, 220, 70), (640, 200, 50)):
    k.line(spiral(cx, cy, sc, 1.6), '#e8f2ff', w=7, amp=0.8, twice=False)
    k.line([(cx + sc, cy), (cx + sc * 2.6, cy + 8)], '#e8f2ff', w=7, amp=0.8, twice=False)
# двое детей мечтают на скамейке
person(k, 760, 640, 0.7, shirt='#e83e8c', shirtd='#8a1050', pants='#2b2f6b', armL=(-30, 50), armR=(30, 50), mood='smile', look=(0, -1))
person(k, 880, 640, 0.7, shirt='#2fa84f', shirtd='#145a28', pants='#2b2f6b', armL=(-30, 50), armR=(30, 50), mood='smile', look=(0, -1))
bubble(k, 820, 330, 90, 50, tail_to=(820, 440))
star(k, 790, 330, 18); star(k, 850, 322, 14)
k.save('/tmp/narisoval2/2100', 'media/img/narisoval/r3_2100_veter.webp')
