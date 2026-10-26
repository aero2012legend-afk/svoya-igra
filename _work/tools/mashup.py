#!/usr/bin/env python3
"""Мешап двух лиц с чистым фоном (надстройка над _work/tools/morph.py).
Отличия от morph.py: фон каждого портрета заменяется на общий «студийный» синий (сегментация mediapipe),
вне лица берётся ОБЪЕДИНЕНИЕ силуэтов (там, где есть только один человек, — он без полупрозрачности, где оба — смесь),
низ кадра (плечи/одежда) плавно уходит в фон, лицо смешивается как в morph.py (кусочно-аффинный морфинг по 478 точкам).
Исходные фото a/b — настоящие снимки (с родным фоном), выровненные по глазам в тот же кадр.

/opt/aienv/bin/python _work/tools/mashup.py A.jpg B.jpg OUT_PREFIX [--alpha 0.5] [--halo 1.4] [--fade 1] [--size 900x1125] [--debug]"""
import sys, os, argparse, hashlib
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import morph, mashup_clean as clean


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def cached_layers(path, flip, img, pts, clothes=False):
    st = os.stat(path)
    key = hashlib.md5(f'{os.path.abspath(path)}|{st.st_mtime}|{st.st_size}|{flip}|v4|{int(clothes)}'.encode()).hexdigest()
    cp = f'/tmp/mashup/cache/{key}_layers.npz'
    if os.path.exists(cp):
        d = np.load(cp)
        return d['F'], d['A']
    F, A = clean.fg_layers(img, pts, clothes)
    os.makedirs('/tmp/mashup/cache', exist_ok=True)
    np.savez_compressed(cp, F=F.astype(np.uint8), A=(A * 255).astype(np.uint8))
    return F.astype(np.uint8), (A * 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('a'); ap.add_argument('b'); ap.add_argument('out')
    ap.add_argument('--alpha', type=float, default=0.5)
    ap.add_argument('--size', default='900x1125')
    ap.add_argument('--eye-y', type=float, default=0.42)
    ap.add_argument('--eye-dist', type=float, default=0.27)
    ap.add_argument('--halo', type=float, default=0.0)
    ap.add_argument('--fade', type=float, default=0.0, help='1 — низ кадра уходит в фон; 0 — без затухания')
    ap.add_argument('--fade-start', type=float, default=0.03, help='от подбородка, доля высоты')
    ap.add_argument('--fade-len', type=float, default=0.17)
    ap.add_argument('--sharpen', type=float, default=0.5)
    ap.add_argument('--outside', default='mix', choices=['mix', 'a', 'b'], help='волосы/уши/шея: смесь (объединение силуэтов) или только A/B')
    ap.add_argument('--face-grow', type=float, default=1.0)
    ap.add_argument('--colormatch', type=int, default=1)
    ap.add_argument('--feather', type=float, default=0.06)
    ap.add_argument('--open', type=int, default=0, help='убрать тонкие «хвосты» силуэта (волосы-призраки), размер ядра в px')
    ap.add_argument('--vig', type=float, default=1.0, help='овальная виньетка вокруг головы (0 — выкл.)')
    ap.add_argument('--vx', type=float, default=1.65)
    ap.add_argument('--vt', type=float, default=1.75)
    ap.add_argument('--vb', type=float, default=1.25)
    ap.add_argument('--vsoft', type=float, default=0.35)
    ap.add_argument('--neck-from', type=float, default=0.08)
    ap.add_argument('--neck-len', type=float, default=0.10)
    ap.add_argument('--flip-a', action='store_true'); ap.add_argument('--flip-b', action='store_true')
    ap.add_argument('--quality', type=int, default=88)
    ap.add_argument('--debug', action='store_true')
    ap.add_argument('--bg', default='')
    ap.add_argument('--clean-pic', default='', help='a, b или ab: исходник выдать на чистом фоне (с одеждой) — когда на родном фоне есть надписи')
    o = ap.parse_args()
    W, H = map(int, o.size.lower().split('x'))

    raw = []
    for path, flip in ((o.a, o.flip_a), (o.b, o.flip_b)):
        im = cv2.imread(path, cv2.IMREAD_COLOR)
        if im is None: raise SystemExit('не читается ' + path)
        if flip: im = cv2.flip(im, 1)
        pts = morph.cached_detect(path, flip, im)
        F, A = cached_layers(path, flip, im, pts)
        raw.append((im, pts, F, A))
    s_each = [morph.fit_scale(im, p, W, H, o.eye_y, o.eye_dist) for im, p, _, _ in raw]
    s = min(s_each)
    eye_dist = o.eye_dist / s
    if s < 0.999: print(f'кадр приближен: eye-dist {o.eye_dist:.3f} -> {eye_dist:.3f}', file=sys.stderr)
    Fs, As, pts_l, pics, Ms = [], [], [], [], []
    for i, (im, p, F, A) in enumerate(raw):
        al, p2, M = morph.align(im, p, W, H, o.eye_y, eye_dist)
        zoom = np.sqrt(M[0, 0] ** 2 + M[1, 0] ** 2)
        if zoom > 1.3: print(f'внимание: фото {"AB"[i]} увеличено в {zoom:.2f} раза', file=sys.stderr)
        Fw = cv2.warpAffine(F, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
        Aw = cv2.warpAffine(A, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        Fs.append(Fw.astype(np.float32)); As.append(Aw.astype(np.float32) / 255.0); pts_l.append(p2); Ms.append(M)
        ed_i = max(eye_dist, o.eye_dist / s_each[i])
        pics.append(al if abs(ed_i - eye_dist) < 1e-6 else morph.align(im, p, W, H, o.eye_y, ed_i)[0])
    pa, pb = pts_l
    extra_a, extra_b = [], []
    if o.halo > 0:
        extra_a.append(morph.halo_points(pa, o.halo)); extra_b.append(morph.halo_points(pb, o.halo))
    bp = morph.border_points(W, H)
    PA = np.vstack([pa] + extra_a + [bp]); PB = np.vstack([pb] + extra_b + [bp])
    al_ = o.alpha
    PM = (1 - al_) * PA + al_ * PB
    tris = morph.triangulate(PM, W, H)
    WFa = morph.piecewise_warp(Fs[0], PA, PM, tris, W, H)
    WFb = morph.piecewise_warp(Fs[1], PB, PM, tris, W, H)
    WAa = np.clip(morph.piecewise_warp(As[0], PA, PM, tris, W, H), 0, 1)
    WAb = np.clip(morph.piecewise_warp(As[1], PB, PM, tris, W, H), 0, 1)

    mixF = (1 - al_) * WFa + al_ * WFb
    fm = None
    if o.outside != 'mix':
        n_face = len(pa)
        fm = morph.face_mask(PM[:n_face], W, H, o.face_grow, o.feather * W)[..., None]
        ow = 0.0 if o.outside == 'a' else 1.0
        base_out = WFa if o.outside == 'a' else WFb
        if o.colormatch:
            core = morph.face_mask(PM[:n_face], W, H, 0.85, o.feather * W)
            base_out = morph.skin_color_match(np.clip(base_out, 0, 255).astype(np.uint8), np.clip(mixF, 0, 255).astype(np.uint8), core).astype(np.float32)
        mixF = fm * mixF + (1 - fm) * base_out
    cov_u = 1 - (1 - WAa) * (1 - WAb)          # объединение силуэтов
    if o.open > 0:
        k_ = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (o.open, o.open))
        cov_u = cv2.GaussianBlur(cv2.morphologyEx(cov_u, cv2.MORPH_OPEN, k_), (0, 0), 1.2)
    cov_m = 0.5 * (WAa + WAb)                    # среднее (для шеи — без «ступенек» от разной ширины)
    chin_y0 = PM[152][1]
    yy = np.arange(H, dtype=np.float32)[:, None]
    wn = smoothstep((yy - (chin_y0 - o.neck_from * H)) / (o.neck_len * H))
    cov = cov_u * (1 - wn) + cov_m * wn
    if fm is not None:
        cov_out = WAa if o.outside == 'a' else WAb
        cov = fm[..., 0] * cov + (1 - fm[..., 0]) * cov_out
    # фон — тот же студийный градиент; центр света — над переносицей
    eyes_c = (pa[[morph.LEFT_IRIS, morph.RIGHT_IRIS]].mean(0) + pb[[morph.LEFT_IRIS, morph.RIGHT_IRIS]].mean(0)) / 2
    bgc = None
    bg = clean.studio_bg(H, W, W / 2, eyes_c[1] - 0.12 * H, **({} if bgc is None else dict(top=bgc[0], bot=bgc[1])))
    for i, key in enumerate('ab'):
        if key in o.clean_pic:
            F2, A2 = cached_layers((o.a, o.b)[i], (o.flip_a, o.flip_b)[i], raw[i][0], raw[i][1], clothes=True)
            F2w = cv2.warpAffine(F2, Ms[i], (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
            A2w = cv2.warpAffine(A2, Ms[i], (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0).astype(np.float32)[..., None] / 255.0
            pics[i] = np.clip(F2w * A2w + bg * (1 - A2w) + 0.5, 0, 255).astype(np.uint8)
    chin_y = PM[152][1]
    if o.fade > 0:
        y = np.arange(H, dtype=np.float32)[:, None]
        f = 1 - smoothstep((y - (chin_y + o.fade_start * H)) / (o.fade_len * H))
        cov = cov * (1 - o.fade * (1 - f))
    if o.vig > 0:
        oval = PM[morph.FACE_OVAL]
        cx_, cy_ = oval[:, 0].mean(), oval[:, 1].mean()
        hw_, hh_ = np.ptp(oval[:, 0]) / 2, np.ptp(oval[:, 1]) / 2
        yy2, xx2 = np.mgrid[0:H, 0:W].astype(np.float32)
        ry = np.where(yy2 < cy_, hh_ * o.vt, hh_ * o.vb)
        r = np.sqrt(((xx2 - cx_) / (hw_ * o.vx)) ** 2 + ((yy2 - cy_) / ry) ** 2)
        vg = 1 - smoothstep((r - (1 - o.vsoft)) / o.vsoft)
        cov = cov * (1 - o.vig * (1 - vg))
    out = mixF * cov[..., None] + bg * (1 - cov[..., None])
    if o.sharpen > 0:
        bl = cv2.GaussianBlur(out, (0, 0), 1.6)
        out = out + o.sharpen * (out - bl)
    out = np.clip(out + 0.5, 0, 255).astype(np.uint8)

    q = [cv2.IMWRITE_JPEG_QUALITY, o.quality]
    cv2.imwrite(o.out + '_mix.jpg', out, q)
    cv2.imwrite(o.out + '_a.jpg', pics[0], q)
    cv2.imwrite(o.out + '_b.jpg', pics[1], q)
    if o.debug:
        sheet = np.hstack([pics[0], out, pics[1]])
        sheet = cv2.resize(sheet, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        cv2.imwrite(o.out + '_dbg.jpg', sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(o.out + '_mix.jpg', f'{W}x{H}', 'triangles', len(tris))


if __name__ == '__main__':
    morph.ensure_egl()
    main()
