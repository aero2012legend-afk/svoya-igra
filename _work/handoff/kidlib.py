#!/usr/bin/env python3
"""Общие «детские» кусочки для сцен (поверх narisoval_kid.Kid): человечки, пчёлы, машины, ноты, капли, лампы...
Подключение:  import sys; sys.path.insert(0, '/home/user/svoya-igra/_work/handoff'); from kidlib import *
Все функции берут Kid `k` первым аргументом и рисуют сразу. Надписей нет и быть не должно."""
import math
from narisoval_kid import *

SKIN, SKIND = '#f6c9a4', '#9b6a40'


def night(k, color='#233a7a', gap=11, angle=-8):
    k.fill(rect(-20, -20, W + 40, H + 40), color, gap=gap, angle=angle)


def star(k, x, y, R=16, color='#ffd43b', line='#c79a00'):
    k.shape(star5(x, y, R), color, line, w=4, gap=6, smooth=False, amp=1.2)


def sparkle(k, x, y, r=14, color='#ffd43b', w=5):
    k.line([(x - r, y), (x + r, y)], color, w=w, amp=0.6, twice=False)
    k.line([(x, y - r), (x, y + r)], color, w=w, amp=0.6, twice=False)


def spiral(cx, cy, r, turns=2.2, n=26):
    pts = []
    for i in range(n + 1):
        t = i / n
        a = turns * 2 * math.pi * t
        pts.append((cx + r * t * math.cos(a), cy + r * t * math.sin(a)))
    return pts


def drop(cx, cy, r=14):
    """капля (острым концом вверх)"""
    return [(cx, cy - r * 1.7), (cx + r * 0.7, cy - r * 0.5), (cx + r, cy + r * 0.3), (cx + r * 0.5, cy + r * 0.9),
            (cx, cy + r), (cx - r * 0.5, cy + r * 0.9), (cx - r, cy + r * 0.3), (cx - r * 0.7, cy - r * 0.5)]


def note(k, x, y, s=1.0, color='#7a3fc0'):
    k.shape(ell(x, y, 15 * s, 11 * s, 10, rot=-20), color, color, w=3, gap=5)
    k.line([(x + 13 * s, y - 3 * s), (x + 13 * s, y - 58 * s), (x + 36 * s, y - 44 * s)], color, w=7 * s, amp=0.8, twice=False)


def face(k, x, y, r=32, mood='smile', look=(0, 0), cheeks=False):
    """лицо в координатах картинки: глаза + рот"""
    ex = r * 0.38
    ey = y - r * 0.1
    if mood == 'cry':
        for sx in (-1, 1):
            k.line([(x + sx * ex - 9, ey - 4), (x + sx * ex + 9, ey - 4)], '#222', w=4, amp=0.5, twice=False)
        k.line([(x - r * 0.4, y + r * 0.52), (x, y + r * 0.34), (x + r * 0.4, y + r * 0.52)], '#a02a2a', w=5, amp=0.8)
    elif mood == 'sad':
        k.dot(x - ex, ey, r * 0.13); k.dot(x + ex, ey, r * 0.13)
        k.line([(x - r * 0.35, y + r * 0.5), (x, y + r * 0.32), (x + r * 0.35, y + r * 0.5)], '#a02a2a', w=5, amp=0.8)
    elif mood == 'open':
        k.dot(x - ex, ey, r * 0.13); k.dot(x + ex, ey, r * 0.13)
        k.shape(ell(x, y + r * 0.42, r * 0.26, r * 0.22, 10), '#7a1a1a', '#3a0a0a', w=3, gap=5)
    elif mood == 'tongue':
        k.dot(x - ex, ey, r * 0.13); k.dot(x + ex, ey, r * 0.13)
        k.smile(x, y + r * 0.3, r * 0.9, r * 0.32, '#c0392b', 5)
        k.shape(ell(x + r * 0.18, y + r * 0.72, r * 0.15, r * 0.2, 8), '#ff6f91', '#c0392b', w=3, gap=5)
    elif mood == 'angry':
        k.dot(x - ex, ey, r * 0.13); k.dot(x + ex, ey, r * 0.13)
        k.line([(x - ex - 10, ey - 14), (x - ex + 10, ey - 6)], '#222', w=5, amp=0.5, twice=False)
        k.line([(x + ex + 10, ey - 14), (x + ex - 10, ey - 6)], '#222', w=5, amp=0.5, twice=False)
        k.line([(x - r * 0.3, y + r * 0.5), (x + r * 0.3, y + r * 0.5)], '#a02a2a', w=5, amp=0.8)
    else:
        k.dot(x - ex + look[0], ey + look[1], r * 0.13); k.dot(x + ex + look[0], ey + look[1], r * 0.13)
        k.smile(x, y + r * 0.22, r * 0.8, r * 0.3, '#c0392b', 5)
    if cheeks:
        k.dot(x - r * 0.6, y + r * 0.2, r * 0.17, '#ff8aa8'); k.dot(x + r * 0.6, y + r * 0.2, r * 0.17, '#ff8aa8')


def person(k, x, y, s=1.0, shirt='#3a6fd8', shirtd='#1c3f94', pants='#2b2f6b', skin=SKIN, hair='#5a3a1c',
           hair_style='short', armL=(-58, 58), armR=(58, 58), mood='smile', shoes='#222', dress=None, legs=((-22, 0), (22, 0)),
           hat=None, look=(0, 0), cheeks=False, tears=False):
    """человечек: (x, y) — точка между ступнями. Высота ≈ 262*s. armL/armR — куда тянутся руки (смещение кисти от плеча).
    dress — цвет платья (треугольник вместо штанов)."""
    T = Xf(x, y, s)
    hip, sh = -100, -188
    (lx, ly), (rx, ry) = legs
    if not dress:
        for (fx, fy) in ((lx, ly), (rx, ry)):
            k.line(T([(fx * 0.5, hip), (fx, fy - 6)]), pants, w=16 * s, amp=1.4, twice=False)
        for (fx, fy) in ((lx, ly), (rx, ry)):
            k.shape(T(ell(fx + (6 if fx > 0 else -6), fy, 17, 8, 10)), shoes, shoes, w=3, gap=5)
    else:
        for (fx, fy) in ((lx, ly), (rx, ry)):
            k.line(T([(fx * 0.4, -78), (fx, fy - 6)]), skin, w=10 * s, amp=1.2, twice=False)
            k.shape(T(ell(fx + (6 if fx > 0 else -6), fy, 16, 7, 10)), shoes, shoes, w=3, gap=5)
    # руки (рисуем до торса, чтобы плечо накрывало)
    for sx, (dx, dy) in ((-1, armL), (1, armR)):
        k.line(T([(sx * 28, sh + 10), (sx * 28 + dx * 0.55, sh + 10 + dy * 0.45), (sx * 28 + dx, sh + 10 + dy)]),
               shirt if not dress else dress, w=14 * s, amp=1.5, twice=False)
        k.dot(*T.p((sx * 28 + dx, sh + 10 + dy)), 9 * s, skin)
    if dress:
        k.shape(T([(-26, sh), (26, sh), (60, -76), (-60, -76)]), dress, shade(dress, -0.4), w=6 * s, gap=10, smooth=False, amp=1.6)
    else:
        k.shape(T([(-30, sh), (30, sh), (38, hip), (-38, hip)]), shirt, shirtd, w=6 * s, gap=10, smooth=False, amp=1.6)
    # шея, голова
    k.line(T([(0, sh), (0, sh - 14)]), skin, w=14 * s, amp=0.5, twice=False)
    hx, hy = T.p((0, -226))
    R = 34 * s
    if hair_style == 'long':
        k.shape(T(ell(0, -216, 44, 52, 16)), hair, shade(hair, -0.4), w=4 * s, gap=8)
    k.shape(ell(hx, hy, R, R * 1.06, 18), skin, SKIND, w=5 * s, gap=9)
    if hair_style in ('short', 'long'):
        k.shape([(hx - R * 1.0, hy - R * 0.1), (hx - R * 0.9, hy - R * 0.85), (hx, hy - R * 1.25), (hx + R * 0.9, hy - R * 0.85), (hx + R * 1.0, hy - R * 0.1),
                 (hx + R * 0.5, hy - R * 0.55), (hx - R * 0.5, hy - R * 0.55)], hair, shade(hair, -0.4), w=4 * s, gap=8, smooth=False, amp=1.2)
    face(k, hx, hy, R, mood, look, cheeks)
    if tears:
        for sx in (-1, 1):
            k.line([(hx + sx * R * 0.38, hy + R * 0.05), (hx + sx * R * 0.46, hy + R * 0.9)], '#4aa8ff', w=7 * s, amp=0.6, twice=False)
    return (hx, hy, R)


def bee(k, x, y, s=1.0, flip=False, wings=True):
    T = Xf(x, y, s, flip=flip)
    if wings:
        k.shape(T(ell(-4, -34, 16, 26, 12, rot=-25)), '#cfeaff', '#4a7fb0', w=4 * s, gap=7)
        k.shape(T(ell(18, -32, 14, 24, 12, rot=20)), '#cfeaff', '#4a7fb0', w=4 * s, gap=7)
    k.shape(T(ell(0, 0, 40, 27, 16)), '#ffd43b', '#6a4a00', w=5 * s, gap=8)
    for dx in (-10, 8):
        k.line(T([(dx, -24), (dx + 3, 24)]), '#1a1a1a', w=9 * s, amp=0.8, twice=False)
    k.line(T([(40, 0), (58, 4)]), '#1a1a1a', w=6 * s, amp=0.5, twice=False)       # жало
    k.shape(T(ell(-36, -2, 16, 15, 12)), '#1a1a1a', '#000', w=3 * s, gap=6)
    k.dot(*T.p((-40, -6)), 4.5 * s, '#fff')
    k.line(T([(-46, -14), (-56, -32)]), '#1a1a1a', w=3 * s, amp=0.4, twice=False)  # усики
    k.dot(*T.p((-57, -34)), 3.5 * s, '#1a1a1a')


def car(k, x, y, s=1.0, body='#d6336c', bodyd='#7a1236', flip=False, roof_row=True, windows=True):
    """машинка сбоку, коробочка-хэтчбек. (x, y) — точка на земле между колёсами."""
    T = Xf(x, y, s, flip=flip)
    k.shape(T([(-170, -34), (-176, -84), (-120, -96), (-84, -150), (46, -150), (96, -96), (160, -88), (176, -46), (168, -34)]),
            body, bodyd, w=8 * s, gap=11, smooth=False, amp=2.2)
    if windows:
        k.shape(T([(-72, -140), (-100, -98), (-6, -98), (-6, -140)]), '#d6efff', '#456', w=5 * s, gap=9, smooth=False, amp=1)
        k.shape(T([(8, -140), (8, -98), (88, -98), (44, -140)]), '#d6efff', '#456', w=5 * s, gap=9, smooth=False, amp=1)
    for wx in (-110, 100):
        k.shape(T(ell(wx, -30, 36, 36, 14)), '#2a2a2a', '#000', w=5 * s, gap=8)
        k.shape(T(ell(wx, -30, 15, 15, 10)), '#c7ccd6', '#666', w=3 * s, gap=6)
    k.shape(T([(160, -88), (176, -80), (172, -66), (156, -68)]), '#fff6a8', '#a38a00', w=3 * s, gap=5, smooth=False)   # фара


def sneaker(k, x, y, s=1.0, color='#ffffff', line='#556', flip=False, stripes=None):
    T = Xf(x, y, s, flip=flip)
    k.shape(T([(-70, 0), (-70, -44), (-40, -50), (-10, -64), (22, -42), (66, -28), (74, -8), (66, 0)]), color, line, w=6 * s, gap=9, smooth=False, amp=1.6)
    k.shape(T([(-72, 0), (72, 0), (72, 12), (-72, 12)]), '#e8e8ee', line, w=4 * s, gap=7, smooth=False)
    if stripes:
        for dx in (-26, -8, 10):
            k.line(T([(dx, -26), (dx + 14, -8)]), stripes, w=7 * s, amp=0.5, twice=False)
    k.line(T([(-8, -62), (6, -50)]), line, w=4 * s, amp=0.5, twice=False)       # шнурки
    k.line(T([(2, -56), (16, -44)]), line, w=4 * s, amp=0.5, twice=False)


def lamp(k, x, y, h=240, s=1.0, glow=True):
    if glow:
        k.shape(ell(x + 34 * s, y - h + 6, 56 * s, 56 * s, 14), '#fff3b0', None, gap=9)
    k.line([(x, y), (x, y - h), (x + 34 * s, y - h)], '#444', w=10 * s, amp=1.2, twice=False)
    k.shape(ell(x + 34 * s, y - h + 14, 22 * s, 12 * s, 10), '#ffe566', '#8a6a00', w=4 * s, gap=6)


def speaker(k, x, y, w=170, h=230, waves=True):
    k.shape(rect(x, y, w, h), '#2e2e36', '#000', w=8, gap=10)
    k.shape(ell(x + w / 2, y + h * 0.3, w * 0.2, w * 0.2, 12), '#888', '#222', w=5, gap=8)
    k.shape(ell(x + w / 2, y + h * 0.68, w * 0.34, w * 0.34, 14), '#777', '#111', w=6, gap=8)
    k.dot(x + w / 2, y + h * 0.68, 14, '#222')
    if waves:
        for i, r in enumerate((60, 100, 140)):
            k.line(ell(x + w + 4, y + h * 0.5, r * 0.6, r, 10, a0=-55, a1=55), '#7a3fc0', w=7, amp=1.4, twice=False)


def bubble(k, x, y, rx, ry, tail_to=None, fillc='#ffffff', line='#555'):
    """облачко-мысль: эллипс + 3 кружочка к tail_to"""
    k.shape(ell(x, y, rx, ry, 20), fillc, line, w=6, gap=10)
    if tail_to:
        tx, ty = tail_to
        for i, r in enumerate((16, 11, 7)):
            t = (i + 1) / 4.0
            k.shape(ell(x + (tx - x) * t, y + ry + (ty - y - ry) * t, r, r, 8), fillc, line, w=4, gap=7)


def window_grid(k, x0, y0, cols, rows, ww=54, wh=62, gx=22, gy=22, lit=0.7, on='#ffe27a', off='#3a4a6a', frame='#4a4a5a'):
    for r in range(rows):
        for c in range(cols):
            wx, wy = x0 + c * (ww + gx), y0 + r * (wh + gy)
            col = on if k.r.random() < lit else off
            k.shape(rect(wx, wy, ww, wh), col, frame, w=5, gap=9)
            k.line([(wx + ww / 2, wy), (wx + ww / 2, wy + wh)], frame, w=3, amp=0.5, twice=False)


def heart(cx, cy, r=40):
    pts = []
    for i in range(24):
        t = 2 * math.pi * i / 24
        pts.append((cx + r * 0.062 * 16 * math.sin(t) ** 3,
                    cy - r * 0.062 * (13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))))
    return pts


def zigzag_path(k, pts, color='#ffd43b', w=5):
    """пунктир-след полёта"""
    for i in range(len(pts) - 1):
        if i % 2 == 0:
            k.line([pts[i], pts[i + 1]], color, w=w, amp=0.8, twice=False, smooth=False)


# ---------- «Я так видел» (risunki): подпись «ВАСЯ 6 ЛЕТ» и тетрадная клетка ----------
_GLYPHS = {
    'В': [[(0, 0), (0, 1)], [(0, 0), (0.45, 0.03), (0.56, 0.2), (0.46, 0.46), (0, 0.5)], [(0, 0.5), (0.5, 0.54), (0.62, 0.76), (0.5, 0.97), (0, 1)]],
    'А': [[(0, 1), (0.3, 0), (0.6, 1)], [(0.12, 0.66), (0.48, 0.66)]],
    'С': [[(0.56, 0.16), (0.36, 0.0), (0.12, 0.12), (0.0, 0.5), (0.12, 0.88), (0.36, 1.0), (0.56, 0.84)]],
    'Я': [[(0.56, 0), (0.56, 1)], [(0.56, 0.0), (0.16, 0.0), (0.02, 0.24), (0.16, 0.48), (0.56, 0.52)], [(0.36, 0.5), (0.0, 1)]],
    '6': [[(0.52, 0.06), (0.22, 0.2), (0.06, 0.55), (0.1, 0.9), (0.3, 1.0), (0.5, 0.86), (0.46, 0.62), (0.26, 0.5), (0.08, 0.62)]],
    'Л': [[(0.0, 1.0), (0.24, 0.0), (0.56, 0.0), (0.56, 1.0)]],
    'Е': [[(0.5, 0.0), (0.0, 0.0), (0.0, 1.0), (0.5, 1.0)], [(0.0, 0.5), (0.4, 0.5)]],
    'Т': [[(0.0, 0.0), (0.6, 0.0)], [(0.3, 0.0), (0.3, 1.0)]],
}


def signature(k, x, base, h=30, color='#767676', text='ВАСЯ 6 ЛЕТ', align='right'):
    """Детская подпись «ВАСЯ 6 ЛЕТ» дрожащими штрихами. align='right': x — правый край, 'left': x — левый. base — нижняя линия букв."""
    adv, sp = 0.9 * h, 0.7 * h
    width = sum(sp if ch == ' ' else adv for ch in text) - (adv - 0.6 * h)
    x0 = x - width if align == 'right' else x
    for ch in text:
        if ch == ' ':
            x0 += sp
            continue
        for stroke in _GLYPHS[ch]:
            pts = [(x0 + px * h + k.J(0.8), base - h + py * h + k.J(0.8)) for px, py in stroke]
            k.line(pts, color, w=max(3.0, h * 0.11), amp=0.7, step=8, twice=False)
        x0 += adv


def grid_paper(k, step=40, color='#c3d5ee', margin_x=1170, margin_color='#e9a3a3'):
    """Тетрадная клетка (тонкие ровные линии БЕЗ восковой фактуры) под всем рисунком + красное поле. Вызывать один раз, до или после рисования."""
    segs = ''.join(f'M{x},0V{H}' for x in range(step // 2, W, step)) + ''.join(f'M0,{y}H{W}' for y in range(step // 2, H, step))
    g = f'<path d="{segs}" stroke="{color}" stroke-width="2" fill="none"/>'
    if margin_x:
        g += f'<path d="M{margin_x},0V{H}" stroke="{margin_color}" stroke-width="3" fill="none"/>'
    orig = k.svg

    def svg():
        return orig().replace('<g filter="url(#crayon)">', g + '<g filter="url(#crayon)">', 1)
    k.svg = svg
