#!/usr/bin/env python3
"""Генератор «детских рисунков» (как у шестилетки) для темы «Я нарисовал песню».
Рисуем толстыми дрожащими «восковыми» штрихами + закрашивание зигзагами (с вылезанием за контур).
Использование:
    import sys; sys.path.insert(0, '/home/user/svoya-igra/_work/handoff')
    from narisoval_kid import *
    k = Kid(seed=1)
    k.shape(ell(300, 300, 80, 60), fillc='#3dae4c', linec='#1e7a34')
    k.save('/tmp/narisoval/300', 'media/img/narisoval/r3_300_gena.webp')   # html -> png -> webp
Надписей на картинке нет и быть не должно.
"""
import math, random, os, subprocess

W, H = 1280, 720
ROOT = '/home/user/svoya-igra'


def _hex(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(h, k):
    r, g, b = _hex(h)
    if k >= 0:
        r, g, b = [int(c + (255 - c) * k) for c in (r, g, b)]
    else:
        r, g, b = [int(c * (1 + k)) for c in (r, g, b)]
    return '#%02x%02x%02x' % tuple(max(0, min(255, c)) for c in (r, g, b))


def resample(pts, step, closed=False):
    out = []
    n = len(pts)
    segs = n if closed else n - 1
    for i in range(segs):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        d = math.hypot(x1 - x0, y1 - y0)
        k = max(1, int(d // step))
        for j in range(k):
            t = j / k
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    if not closed:
        out.append(pts[-1])
    return out


def spline_path(pts, closed=False):
    n = len(pts)
    if n < 2:
        return ''
    if n == 2:
        return f'M{pts[0][0]:.1f},{pts[0][1]:.1f} L{pts[1][0]:.1f},{pts[1][1]:.1f}'
    P = pts

    def g(i):
        return P[i % n] if closed else P[max(0, min(n - 1, i))]
    d = f'M{P[0][0]:.1f},{P[0][1]:.1f}'
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = g(i - 1), g(i), g(i + 1), g(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d + (' Z' if closed else '')


def poly_path(pts, closed=False):
    return 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + (' Z' if closed else '')


# ---------- фигуры ----------
def ell(cx, cy, rx, ry, n=22, rot=0, a0=0, a1=360):
    pts = []
    full = (a1 - a0) >= 360
    for i in range(n if full else n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        x, y = rx * math.cos(a), ry * math.sin(a)
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return pts


def rect(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def star5(cx, cy, R, r=None, rot=-90):
    r = r or R * 0.45
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36)
        rr = R if i % 2 == 0 else r
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


class Xf:
    """Перенос/масштаб/поворот/зеркало для объектов, нарисованных в локальных координатах."""

    def __init__(self, x=0, y=0, s=1.0, rot=0.0, flip=False):
        self.x, self.y, self.s, self.flip = x, y, s, flip
        self.c, self.sn = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def p(self, pt):
        px, py = pt
        if self.flip:
            px = -px
        px, py = px * self.s, py * self.s
        return (self.x + px * self.c - py * self.sn, self.y + px * self.sn + py * self.c)

    def __call__(self, pts):
        return [self.p(q) for q in pts]


class Kid:
    def __init__(self, seed=1, paper='#fffdf5'):
        self.r = random.Random(seed)
        self.items, self.defs, self.n, self.paper = [], [], 0, paper

    def J(self, a):
        return self.r.uniform(-a, a)

    def jit(self, pts, amp):
        return [(x + self.J(amp), y + self.J(amp)) for x, y in pts]

    # --- контур: два прохода (основной + тонкий со сдвигом), как нажим мелка ---
    def line(self, pts, color='#222', w=9, closed=False, amp=2.2, step=34, op=0.95, twice=True, smooth=True):
        base = resample(pts, step, closed) if smooth else list(pts)
        for k in range(2 if twice else 1):
            p = self.jit(base, amp * (1 if k == 0 else 1.7))
            d = spline_path(p, closed) if smooth else poly_path(p, closed)
            ww = w if k == 0 else w * 0.5
            oo = op if k == 0 else op * 0.55
            col = shade(color, self.r.uniform(-0.07, 0.07))
            self.items.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{ww:.1f}" '
                              f'stroke-linecap="round" stroke-linejoin="round" opacity="{oo:.2f}"/>')

    # --- закрашивание зигзагами внутри контура (клип чуть сдвинут: вылезает за линии) ---
    def fill(self, poly, color, gap=12.0, w=None, angle=None, shift=(3, -2), op=0.9):
        w = w or gap * 1.08
        cid = f'k{self.n}'
        self.n += 1
        base = resample(poly, 30, True)
        cp = [(x + shift[0] + self.J(2.5), y + shift[1] + self.J(2.5)) for x, y in base]
        self.defs.append(f'<clipPath id="{cid}"><path d="{spline_path(cp, True)}"/></clipPath>')
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        R = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) / 2 + 26
        ang = self.r.choice([-62, -48, -35, 35, 48, 62, 78, 100, 12, -12]) if angle is None else angle
        pts, t, flip = [], -R, False
        while t <= R:
            a = (-R - self.J(10), t + self.J(3))
            b = (R + self.J(10), t + self.J(3))
            pts += [b, a] if flip else [a, b]
            flip = not flip
            t += gap * self.r.uniform(0.8, 1.15)
        col = shade(color, self.r.uniform(-0.05, 0.05))
        self.items.append(
            f'<g clip-path="url(#{cid})"><path transform="translate({cx:.1f} {cy:.1f}) rotate({ang})" '
            f'd="{poly_path(pts)}" fill="none" stroke="{col}" stroke-width="{w:.1f}" '
            f'stroke-linecap="round" stroke-linejoin="round" opacity="{op}"/></g>')

    def shape(self, poly, fillc=None, linec='#222', w=8, gap=12, closed=True, angle=None, smooth=True, amp=2.4):
        if fillc:
            self.fill(poly, fillc, gap=gap, angle=angle)
        if linec:
            self.line(poly, linec, w=w, closed=closed, amp=amp, smooth=smooth)

    def solid(self, poly, color, op=1.0, smooth=False):
        """Сплошная заливка без штриховки (например белые полоски шеста поверх синего шара)."""
        d = spline_path(resample(poly, 30, True), True) if smooth else poly_path(poly, True)
        self.items.append(f'<path d="{d}" fill="{color}" opacity="{op}"/>')

    def dot(self, x, y, r=6, color='#111'):
        self.line([(x, y), (x + 0.6, y + 0.4)], color, w=2 * r, twice=False, smooth=False, amp=0.3)

    def eye(self, x, y, r=14, look=(1, 0), color='#111'):
        self.line(ell(x, y, r, r, 14), '#222', w=5, closed=True, amp=1.2)
        self.dot(x + look[0] * r * 0.35, y + look[1] * r * 0.35, r * 0.45, color)

    def smile(self, x, y, w=60, h=20, color='#c0392b', lw=6):
        pts = [(x - w / 2 + w * i / 6, y + h * math.sin(math.pi * i / 6)) for i in range(7)]
        self.line(pts, color, w=lw, amp=1.4)

    def scribble(self, pts, color, w=8, amp=3.0):
        """Просто волнистая линия-каракуля."""
        self.line(pts, color, w=w, amp=amp, twice=True)

    # --- готовые каракули ---
    def grass_band(self, y0=640, color='#46a84f', gap=11):
        poly = [(-20, y0), (W + 20, y0 + self.J(6)), (W + 20, H + 20), (-20, H + 20)]
        self.fill(poly, color, gap=gap, angle=-8)
        for x in range(10, W, 46):
            h = self.r.uniform(18, 40)
            self.line([(x, y0 + 8), (x + self.J(8), y0 - h)], shade(color, -0.15), w=7, amp=1.5, twice=False)

    def sky_band(self, y1=58, color='#7cc8f2', gap=11):
        poly = [(-20, -20), (W + 20, -20), (W + 20, y1), (-20, y1 + self.J(6))]
        self.fill(poly, color, gap=gap, angle=6)

    def cloud(self, cx, cy, s=1.0, color='#4a90d9', fillc=None):
        pts = []
        for (dx, dy, r) in [(-70, 8, 38), (-30, -22, 46), (25, -26, 48), (68, 6, 40)]:
            pts += ell(cx + dx * s, cy + dy * s, r * s, r * s, 10, a0=180 + (0 if dx < 0 else -40), a1=360 + (40 if dx > 0 else 0))
        pts += [(cx + 70 * s, cy + 40 * s), (cx - 70 * s, cy + 40 * s)]
        self.shape(pts, fillc, color, w=7, amp=2.0)

    # --- сборка ---
    def svg(self):
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            f'<defs>{"".join(self.defs)}'
            f'<filter id="crayon" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}" color-interpolation-filters="sRGB">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="warp"/>'
            f'<feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="9" result="grain"/>'
            f'<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5.5 0 0 0 -1.35" result="mask"/>'
            f'<feComposite in="d" in2="mask" operator="in"/></filter>'
            f'<filter id="paper" filterUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="2"/>'
            f'<feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.46  0 0 0 0 0.38  0 0 0 0.5 -0.12"/></filter>'
            f'</defs>'
            f'<rect width="{W}" height="{H}" fill="{self.paper}"/>'
            f'<rect width="{W}" height="{H}" filter="url(#paper)" opacity="0.35"/>'
            f'<g filter="url(#crayon)">{"".join(self.items)}</g></svg>')

    def save(self, base, webp=None, quality=80):
        """base — путь без расширения (/tmp/narisoval/300): пишет .html, .png и (если задан webp) WebP в репозиторий."""
        os.makedirs(os.path.dirname(base), exist_ok=True)
        html = ('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}'
                'svg{display:block}</style></head><body>' + self.svg() + '</body></html>')
        open(base + '.html', 'w', encoding='utf-8').write(html)
        subprocess.run(['node', f'{ROOT}/_work/tools/render.mjs', base + '.html', base + '.png', str(W), str(H)], check=True)
        if webp:
            from PIL import Image
            out = webp if webp.startswith('/') else f'{ROOT}/{webp}'
            os.makedirs(os.path.dirname(out), exist_ok=True)
            im = Image.open(base + '.png').convert('RGB')
            q = quality
            while True:
                im.save(out, 'WEBP', quality=q, method=6)
                if os.path.getsize(out) <= 380 * 1024 or q <= 40:
                    break
                q -= 8
            print('WEBP', out, os.path.getsize(out) // 1024, 'KB q=', q)
