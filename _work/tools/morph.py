#!/usr/bin/env python3
"""Морфинг двух лиц (мешап) для темы «Мешап АГтёрский».

Запуск (из корня репозитория, окружение с mediapipe/opencv/numpy):
  /opt/aienv/bin/python _work/tools/morph.py A.jpg B.jpg OUT_PREFIX [опции]

Результат:
  OUT_PREFIX_mix.jpg — смешанное лицо (форма и текстура, доля --alpha от B)
  OUT_PREFIX_a.jpg, OUT_PREFIX_b.jpg — исходные портреты, выровненные в тот же кадр
                                       (глаза на тех же местах, что и в мешапе)
  OUT_PREFIX_dbg.jpg (с --debug) — A | mix | B рядом для проверки

Как работает:
  1. mediapipe FaceLandmarker находит 478 точек лица на каждом фото.
  2. Каждое фото поворачивается/масштабируется (подобие) так, чтобы глаза
     встали в фиксированные точки кадра (портрет 4:5 или квадрат).
  3. Средняя форма = (1-alpha)*A + alpha*B; по ней — триангуляция Делоне
     (точки лица + точки рамки + опционально «ореол» вокруг головы).
  4. Оба фото кусочно-аффинно (плотная карта remap) деформируются в среднюю форму,
     текстуры смешиваются. Вне лица (волосы, фон) можно взять смесь (--outside mix)
     или одно из фото (--outside a|b), граница растушёвывается.
  5. Опционально --colormatch: тон кожи «внешнего» фото подгоняется к смеси,
     чтобы не было шва на шее/ушах.

Опции:
  --alpha 0.5          доля второго лица (0 — чистый A, 1 — чистый B)
  --size 900x1125      размер кадра (900x900 — квадрат)
  --eye-y 0.42         высота линии глаз (доля высоты кадра)
  --eye-dist 0.25      расстояние между зрачками (доля ширины кадра)
  --outside mix|a|b    что брать вне лица
  --face-grow 1.0      масштаб маски лица от её центра (>1 — шире, захватывает лоб/щёки)
  --feather 0.06       растушёвка маски (доля ширины кадра)
  --halo 0             >0 — добавить кольцо точек вокруг головы (масштаб от овала, напр. 1.35)
  --colormatch         подогнать цвет кожи вне лица под смесь
  --flip-a / --flip-b  зеркально отразить исходник
  --debug              сохранить лист сравнения
"""
import argparse, os, sys, urllib.request
import numpy as np
import cv2

MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
MODEL_PATH = os.environ.get('FACE_LANDMARKER', '/tmp/mashup/models/face_landmarker.task')

# Овал лица в FaceMesh (по часовой, от макушки лба)
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
             152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
LEFT_IRIS, RIGHT_IRIS = 468, 473  # центры радужек (на фото: левый — правый глаз человека)
LEFT_EYE = [33, 133, 159, 145, 160, 144, 158, 153]
RIGHT_EYE = [362, 263, 386, 374, 387, 373, 385, 380]

_landmarker = None


def ensure_egl():
    """mediapipe грузит libEGL.so.1 даже на CPU. Если в системе её нет — подкладываем libEGL из
    Chromium (Playwright) через симлинки и перезапускаемся с LD_LIBRARY_PATH."""
    import ctypes
    try:
        ctypes.CDLL('libEGL.so.1'); ctypes.CDLL('libGLESv2.so.2')
        return
    except OSError:
        pass
    if os.environ.get('MORPH_REEXEC'):
        return
    import glob
    cands = sorted(glob.glob('/opt/pw-browsers/chromium*/chrome-linux/libEGL.so'))
    if not cands:
        return
    d = os.path.dirname(cands[0])
    libdir = '/tmp/mashup/lib'
    os.makedirs(libdir, exist_ok=True)
    for src, dst in (('libEGL.so', 'libEGL.so.1'), ('libGLESv2.so', 'libGLESv2.so.2')):
        p = os.path.join(libdir, dst)
        if not os.path.exists(p):
            os.symlink(os.path.join(d, src), p)
    env = dict(os.environ, MORPH_REEXEC='1',
               LD_LIBRARY_PATH=libdir + ':' + os.environ.get('LD_LIBRARY_PATH', ''))
    os.execve(sys.executable, [sys.executable] + sys.argv, env)


def landmarker():
    global _landmarker
    if _landmarker is None:
        if not os.path.exists(MODEL_PATH):
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            print('скачиваю модель', MODEL_URL, file=sys.stderr)
            urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        import mediapipe as mp
        from mediapipe.tasks.python import vision, BaseOptions
        opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL_PATH),
                                            num_faces=3, min_face_detection_confidence=0.3)
        _landmarker = (mp, vision.FaceLandmarker.create_from_options(opts))
    return _landmarker


def detect(img_bgr):
    """478 точек лица (самого крупного) в пикселях, shape (478, 2)."""
    mp, lm = landmarker()
    h, w = img_bgr.shape[:2]
    # маленькие картинки — увеличим для детектора
    scale = 1.0
    if max(h, w) < 640:
        scale = 640 / max(h, w)
        img_bgr = cv2.resize(img_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
    if not res.face_landmarks:
        raise SystemExit('лицо не найдено')
    H, W = img_bgr.shape[:2]
    best = None
    for f in res.face_landmarks:
        p = np.array([[q.x * W, q.y * H] for q in f], np.float64)
        area = np.ptp(p[:, 0]) * np.ptp(p[:, 1])
        if best is None or area > best[0]:
            best = (area, p)
    return best[1] / scale


def eye_centers(p):
    if len(p) > RIGHT_IRIS:
        l, r = p[LEFT_IRIS], p[RIGHT_IRIS]
    else:
        l, r = p[LEFT_EYE].mean(0), p[RIGHT_EYE].mean(0)
    return (l, r) if l[0] < r[0] else (r, l)


def similarity(src_pts, dst_pts):
    """Подобие по двум точкам: 2x3 матрица."""
    (x1, y1), (x2, y2) = src_pts
    (u1, v1), (u2, v2) = dst_pts
    a = complex(x2 - x1, y2 - y1)
    b = complex(u2 - u1, v2 - v1)
    s = b / a
    t = complex(u1, v1) - s * complex(x1, y1)
    return np.array([[s.real, -s.imag, t.real], [s.imag, s.real, t.imag]], np.float64)


def align(img, pts, W, H, eye_y, eye_dist):
    l, r = eye_centers(pts)
    d = eye_dist * W
    dst = [(W / 2 - d / 2, eye_y * H), (W / 2 + d / 2, eye_y * H)]
    M = similarity([l, r], dst)
    out = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    p2 = np.hstack([pts, np.ones((len(pts), 1))]) @ M.T
    return out, p2, M


def border_points(W, H, n=6):
    pts = []
    for i in range(n + 1):
        x = (W - 1) * i / n
        y = (H - 1) * i / n
        pts += [(x, 0), (x, H - 1), (0, y), (W - 1, y)]
    return np.unique(np.array(pts, np.float64), axis=0)


def halo_points(p, k):
    oval = p[FACE_OVAL]
    c = oval.mean(0)
    return c + (oval - c) * k


def triangulate(pts, W, H):
    """Делоне через cv2.Subdiv2D, возвращает индексы треугольников."""
    sub = cv2.Subdiv2D((-10, -10, W + 20, H + 20))
    P = pts.copy()
    P[:, 0] = np.clip(P[:, 0], -5, W + 5)
    P[:, 1] = np.clip(P[:, 1], -5, H + 5)
    for x, y in P:
        sub.insert((float(x), float(y)))
    tris = []
    for t in sub.getTriangleList():
        tri = t.reshape(3, 2)
        idx = []
        for v in tri:
            dd = np.abs(P - v).sum(1)
            j = int(dd.argmin())
            if dd[j] > 1.0:
                break
            idx.append(j)
        if len(idx) == 3 and len(set(idx)) == 3:
            tris.append(idx)
    return np.array(tris, np.int32)


def piecewise_warp(img, src_pts, dst_pts, tris, W, H):
    """Деформирует img так, что src_pts переходят в dst_pts (плотная карта, без швов)."""
    tid = np.full((H, W), -1, np.int32)
    # растеризуем номера треугольников в целевой форме
    lab = np.zeros((H, W), np.int32)
    for k, t in enumerate(tris):
        poly = np.round(dst_pts[t] * 16).astype(np.int32)
        cv2.fillConvexPoly(lab, poly, k + 1, lineType=cv2.LINE_8, shift=4)
    tid = lab - 1
    # пиксели без треугольника (края) — ближайший треугольник через dilate
    if (tid < 0).any():
        m = (tid < 0).astype(np.uint8)
        fill = lab.copy().astype(np.float32)
        for _ in range(8):
            dil = cv2.dilate(fill, np.ones((3, 3), np.uint8))
            fill = np.where(fill > 0, fill, dil)
            if (fill > 0).all():
                break
        tid = fill.astype(np.int32) - 1
        tid[tid < 0] = 0
    # аффинные матрицы dst->src для каждого треугольника
    A = np.zeros((len(tris), 2, 3), np.float64)
    for k, t in enumerate(tris):
        A[k] = cv2.getAffineTransform(dst_pts[t].astype(np.float32), src_pts[t].astype(np.float32))
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
    M = A[tid]
    mx = M[..., 0, 0] * xs + M[..., 0, 1] * ys + M[..., 0, 2]
    my = M[..., 1, 0] * xs + M[..., 1, 1] * ys + M[..., 1, 2]
    return cv2.remap(img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_CUBIC,
                     borderMode=cv2.BORDER_REPLICATE)


def face_mask(p, W, H, grow, feather_px):
    oval = p[FACE_OVAL]
    c = oval.mean(0)
    oval = c + (oval - c) * grow
    m = np.zeros((H, W), np.float32)
    cv2.fillPoly(m, [np.round(oval).astype(np.int32)], 1.0, lineType=cv2.LINE_AA)
    if feather_px > 0:
        # сначала немного сужаем, потом размываем — чтобы растушёвка шла внутрь
        k = max(1, int(feather_px * 0.5))
        m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
        s = feather_px / 2.0
        m = cv2.GaussianBlur(m, (0, 0), s)
    return np.clip(m, 0, 1)


def skin_color_match(base, target_face, mask):
    """Сдвиг цвета base (в Lab) так, чтобы средний цвет кожи в маске совпал с target_face."""
    b = cv2.cvtColor(base, cv2.COLOR_BGR2LAB).astype(np.float32)
    t = cv2.cvtColor(target_face, cv2.COLOR_BGR2LAB).astype(np.float32)
    w = mask[..., None]
    mb = (b * w).sum((0, 1)) / w.sum()
    mt = (t * w).sum((0, 1)) / w.sum()
    # маска «похоже на кожу»: близость к среднему цвету кожи base
    dist = np.linalg.norm((b - mb)[..., 1:], axis=2)  # по a,b каналам
    skin = np.clip(1 - dist / 18.0, 0, 1)
    dl = np.linalg.norm(b[..., 0:1] - mb[0], axis=2)
    skin *= np.clip(1 - dl / 90.0, 0, 1)
    skin = cv2.GaussianBlur(skin, (0, 0), 3)[..., None]
    out = b + (mt - mb) * skin
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def cached_detect(path, flip, im):
    """Точки лица с кешем в /tmp/mashup/cache (чтобы не грузить mediapipe при каждой пробе)."""
    import hashlib
    st = os.stat(path)
    key = hashlib.md5(f'{os.path.abspath(path)}|{st.st_mtime}|{st.st_size}|{flip}'.encode()).hexdigest()
    cp = f'/tmp/mashup/cache/{key}.npy'
    if os.path.exists(cp):
        return np.load(cp)
    p = detect(im)
    os.makedirs('/tmp/mashup/cache', exist_ok=True)
    np.save(cp, p)
    return p


def fit_scale(img, pts, W, H, eye_y, eye_dist, margin=1.06):
    """Во сколько раз надо сузить кадр (s<=1, вокруг глаз), чтобы он с запасом margin
    целиком лежал внутри фото (иначе по краям будут полосы)."""
    _, _, M = align(img, pts, W, H, eye_y, eye_dist)
    h, w = img.shape[:2]
    pad = int(0.1 * max(W, H))          # холст с полями — запас может выходить за кадр
    M2 = M.copy(); M2[:, 2] += pad
    valid = cv2.warpAffine(np.ones((h, w), np.uint8), M2, (W + 2 * pad, H + 2 * pad),
                           flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    valid = cv2.erode(valid, np.ones((5, 5), np.uint8))
    cx, cy = W / 2 + pad, eye_y * H + pad

    def ok(s):
        s *= margin
        x0, x1 = int(cx - s * W / 2), int(np.ceil(cx + s * W / 2))
        y0, y1 = int(cy - s * eye_y * H), int(np.ceil(cy + s * (1 - eye_y) * H))
        if x0 < 0 or y0 < 0 or x1 > valid.shape[1] or y1 > valid.shape[0]:
            return False
        return bool(valid[y0:y1, x0:x1].all())
    if ok(1.0):
        return 1.0
    lo, hi = 0.2, 1.0
    for _ in range(20):
        mid = (lo + hi) / 2
        if ok(mid):
            lo = mid
        else:
            hi = mid
    return lo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('a'); ap.add_argument('b'); ap.add_argument('out')
    ap.add_argument('--alpha', type=float, default=0.5)
    ap.add_argument('--size', default='900x1125')
    ap.add_argument('--eye-y', type=float, default=0.42)
    ap.add_argument('--eye-dist', type=float, default=0.27)
    ap.add_argument('--outside', default='mix', choices=['mix', 'a', 'b'])
    ap.add_argument('--face-grow', type=float, default=1.0)
    ap.add_argument('--feather', type=float, default=0.06)
    ap.add_argument('--halo', type=float, default=0.0)
    ap.add_argument('--colormatch', action='store_true')
    ap.add_argument('--flip-a', action='store_true')
    ap.add_argument('--flip-b', action='store_true')
    ap.add_argument('--quality', type=int, default=88)
    ap.add_argument('--debug', action='store_true')
    ap.add_argument('--no-fit', action='store_true', help='не приближать кадр, края заполнить повтором')
    o = ap.parse_args()
    W, H = map(int, o.size.lower().split('x'))

    raw = []
    for path, flip in ((o.a, o.flip_a), (o.b, o.flip_b)):
        im = cv2.imread(path, cv2.IMREAD_COLOR)
        if im is None:
            raise SystemExit('не читается ' + path)
        if flip:
            im = cv2.flip(im, 1)
        raw.append((im, cached_detect(path, flip, im)))
    eye_dist = o.eye_dist
    if not o.no_fit:
        # если фото не покрывает кадр целиком — приближаем, пока не покроет (без полос по краям)
        s = 1.0
        for im, p in raw:
            s = min(s, fit_scale(im, p, W, H, o.eye_y, eye_dist))
        if s < 0.999:
            eye_dist = eye_dist / s
            print(f'кадр приближен: eye-dist {o.eye_dist:.3f} -> {eye_dist:.3f}', file=sys.stderr)
    imgs, pts = [], []
    for im, p in raw:
        al, p2, M = align(im, p, W, H, o.eye_y, eye_dist)
        if M[0, 0] ** 2 + M[1, 0] ** 2 > 1.44:
            print(f'внимание: фото увеличено в {np.sqrt(M[0, 0] ** 2 + M[1, 0] ** 2):.1f} раза — может быть мыльным', file=sys.stderr)
        imgs.append(al); pts.append(p2)
    (A, B), (pa, pb) = imgs, pts
    n_face = len(pa)
    extra_a, extra_b = [], []
    if o.halo > 0:
        extra_a.append(halo_points(pa, o.halo)); extra_b.append(halo_points(pb, o.halo))
    bp = border_points(W, H)
    PA = np.vstack([pa] + extra_a + [bp])
    PB = np.vstack([pb] + extra_b + [bp])
    al = o.alpha
    PM = (1 - al) * PA + al * PB
    tris = triangulate(PM, W, H)
    WA = piecewise_warp(A, PA, PM, tris, W, H)
    WB = piecewise_warp(B, PB, PM, tris, W, H)

    feather_px = o.feather * W
    fm = face_mask(PM[:n_face], W, H, o.face_grow, feather_px)
    mix_face = cv2.addWeighted(WA, 1 - al, WB, al, 0)
    if o.outside == 'mix':
        w_out = al
    elif o.outside == 'a':
        w_out = 0.0
        if o.colormatch:
            WA = skin_color_match(WA, mix_face, face_mask(PM[:n_face], W, H, 0.85, feather_px))
    else:
        w_out = 1.0
        if o.colormatch:
            WB = skin_color_match(WB, mix_face, face_mask(PM[:n_face], W, H, 0.85, feather_px))
    wmap = (al * fm + w_out * (1 - fm))[..., None]
    out = (WA.astype(np.float32) * (1 - wmap) + WB.astype(np.float32) * wmap)
    out = np.clip(out + 0.5, 0, 255).astype(np.uint8)

    q = [cv2.IMWRITE_JPEG_QUALITY, o.quality]
    cv2.imwrite(o.out + '_mix.jpg', out, q)
    cv2.imwrite(o.out + '_a.jpg', A, q)
    cv2.imwrite(o.out + '_b.jpg', B, q)
    if o.debug:
        sheet = np.hstack([A, out, B])
        sheet = cv2.resize(sheet, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        cv2.imwrite(o.out + '_dbg.jpg', sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(o.out + '_mix.jpg', f'{W}x{H}', 'triangles', len(tris))


if __name__ == '__main__':
    ensure_egl()
    main()
