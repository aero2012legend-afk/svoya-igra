#!/usr/bin/env python3
"""Заменяет фон на портрете (чтобы у пары не было двойного фона в мешапе).
/opt/aienv/bin/python clean.py IN.jpg OUT.jpg [--bg studio|none] [--debug]
Фон — синий «студийный» градиент в тон игре. Сегментация — mediapipe selfie_multiclass (0 фон, 1 волосы, 2 тело, 3 лицо, 4 одежда, 5 прочее),
маска уточняется guided filter по краям изображения."""
import sys, os, argparse
import numpy as np, cv2
sys.path.insert(0, '/home/user/svoya-igra/_work/tools')
import morph

SEG = '/tmp/mashup/models/selfie_multiclass_256x256.tflite'
EDGE_LO, EDGE_HI, ERODE = 0.40, 0.80, 1
_seg = None


def segmenter():
    global _seg
    if _seg is None:
        import mediapipe as mp
        from mediapipe.tasks.python import vision, BaseOptions
        opts = vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=SEG),
                                            running_mode=vision.RunningMode.IMAGE,
                                            output_category_mask=False, output_confidence_masks=True)
        _seg = (mp, vision.ImageSegmenter.create_from_options(opts))
    return _seg


NO_CLOTHES = True


def person_alpha(crop_bgr, clothes=False):
    mp, sg = segmenter()
    rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
    res = sg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
    bg = res.confidence_masks[0].numpy_view().astype(np.float32)
    a = np.clip(1.0 - bg, 0, 1)
    if NO_CLOTHES and not clothes:
        cl = res.confidence_masks[4].numpy_view().astype(np.float32)
        a = np.clip(a - cl, 0, 1)
    return a


def studio_bg(h, w, cx, cy, top=(168, 98, 52), bot=(86, 40, 20)):
    """Градиент BGR: сверху светлее, снизу темнее, пятно света за головой. top/bot — BGR."""
    ys = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    top = np.array(top, np.float32)[None, None, :]
    bot = np.array(bot, np.float32)[None, None, :]
    g = top * (1 - ys) + bot * ys
    g = np.broadcast_to(g, (h, w, 3)).copy()
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - cx) / (0.55 * w)) ** 2 + ((yy - cy) / (0.55 * h)) ** 2)
    glow = np.clip(1 - d, 0, 1)[..., None] ** 1.6
    g = g + glow * np.array([60, 42, 24], np.float32)[None, None, :]
    return np.clip(g, 0, 255)


def clean(img, pts, bgcolors=None):
    h, w = img.shape[:2]
    x0, x1 = pts[:, 0].min(), pts[:, 0].max()
    y0, y1 = pts[:, 1].min(), pts[:, 1].max()
    fw, fh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # рабочий кроп вокруг головы с запасом на волосы и плечи
    L, R = int(max(0, cx - 1.9 * fw)), int(min(w, cx + 1.9 * fw))
    T, B = int(max(0, cy - 1.7 * fh)), int(min(h, cy + 2.3 * fh))
    crop = img[T:B, L:R]
    ch, cw = crop.shape[:2]
    # масштаб для сегментации: не больше 1024 по длинной стороне
    s = min(1.0, 1024 / max(ch, cw))
    small = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else crop
    a = person_alpha(small)
    a = cv2.resize(a, (cw, ch), interpolation=cv2.INTER_CUBIC)
    # уточнение по краям
    guide = crop.astype(np.float32) / 255.0
    rad = max(4, int(cw / 90))
    a = cv2.ximgproc.guidedFilter(guide, a.astype(np.float32), rad, 2e-3)
    a = np.clip((a - 0.25) / 0.5, 0, 1)            # чуть резче
    a = cv2.GaussianBlur(a, (0, 0), 0.8)
    # убираем «каёмку» старого фона: цвет краёв берём из ближней глубины маски
    inner = (a > 0.97).astype(np.float32)
    k = max(3, rad)
    num = cv2.GaussianBlur(crop.astype(np.float32) * inner[..., None], (0, 0), k)
    den = cv2.GaussianBlur(inner, (0, 0), k)[..., None] + 1e-4
    fg_est = num / den
    edge = ((a > 0.02) & (a < 0.98)).astype(np.float32)
    edge = cv2.GaussianBlur(edge, (0, 0), 1.0)[..., None]
    fg = crop.astype(np.float32) * (1 - edge) + fg_est * edge
    # фон всей картинки
    kw = {} if bgcolors is None else dict(top=bgcolors[0], bot=bgcolors[1])
    bg = studio_bg(h, w, cx, cy - 0.2 * fh, **kw)
    out = bg.copy()
    sub = bg[T:B, L:R]
    out[T:B, L:R] = fg * a[..., None] + sub * (1 - a[..., None])
    return np.clip(out, 0, 255).astype(np.uint8), a


def extend_fg(cf, inner, rad):
    """Продление цветов переднего плана наружу: многомасштабная нормированная свёртка (большие сигмы — на уменьшенной копии)."""
    h, w = inner.shape
    est = np.zeros_like(cf); got = np.zeros((h, w), np.float32)
    for k, sg in ((1, rad * 0.8), (4, rad * 2.5), (8, rad * 7), (16, rad * 20)):
        if k == 1:
            num = cv2.GaussianBlur(cf * inner[..., None], (0, 0), sg)
            den = cv2.GaussianBlur(inner, (0, 0), sg)
        else:
            sw, sh = max(2, w // k), max(2, h // k)
            ci = cv2.resize(cf * inner[..., None], (sw, sh), interpolation=cv2.INTER_AREA)
            ii = cv2.resize(inner, (sw, sh), interpolation=cv2.INTER_AREA)
            num = cv2.GaussianBlur(ci, (0, 0), sg / k)
            den = cv2.GaussianBlur(ii, (0, 0), sg / k)
            num = cv2.resize(num, (w, h), interpolation=cv2.INTER_LINEAR)
            den = cv2.resize(den, (w, h), interpolation=cv2.INTER_LINEAR)
        e = num / (den[..., None] + 1e-6)
        use = ((den > 0.03) & (got == 0)).astype(np.float32)
        est = est * (1 - use[..., None]) + e * use[..., None]
        got = np.maximum(got, use)
    return est, got


def fg_layers(img, pts, clothes=False):
    """Возвращает (F, A): F — цвета переднего плана, продлённые наружу за край силуэта (float32 HxWx3, BGR),
    A — альфа силуэта человека (float32 HxW, 0..1)."""
    h, w = img.shape[:2]
    x0, x1 = pts[:, 0].min(), pts[:, 0].max()
    y0, y1 = pts[:, 1].min(), pts[:, 1].max()
    fw, fh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    L, R = int(max(0, cx - 1.9 * fw)), int(min(w, cx + 1.9 * fw))
    T, B = int(max(0, cy - 1.7 * fh)), int(min(h, cy + 2.3 * fh))
    crop = img[T:B, L:R]
    ch, cw = crop.shape[:2]
    s = min(1.0, 1024 / max(ch, cw))
    small = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else crop
    a = person_alpha(small, clothes)
    a = cv2.resize(a, (cw, ch), interpolation=cv2.INTER_CUBIC)
    guide = crop.astype(np.float32) / 255.0
    rad = max(4, int(cw / 90))
    a = cv2.ximgproc.guidedFilter(guide, a.astype(np.float32), rad, 2e-3)
    a = np.clip((a - EDGE_LO) / (EDGE_HI - EDGE_LO), 0, 1)
    if ERODE > 0:
        a = cv2.erode(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * ERODE + 1, 2 * ERODE + 1)))
    a = cv2.GaussianBlur(a, (0, 0), 1.0)
    # продление цвета переднего плана наружу (многомасштабная нормированная свёртка)
    inner = (a > 0.9).astype(np.float32)
    cf = crop.astype(np.float32)
    est, got = extend_fg(cf, inner, rad)
    est = np.where(got[..., None] > 0, est, cf)
    t = np.clip((a - 0.55) / 0.4, 0, 1)[..., None]
    Fc = cf * t + est * (1 - t)
    F = img.astype(np.float32).copy()
    F[T:B, L:R] = Fc
    # вне кропа — продлим тем, что есть (повтор краёв)
    A = np.zeros((h, w), np.float32)
    A[T:B, L:R] = a
    return F, A


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inp'); ap.add_argument('out')
    ap.add_argument('--debug', action='store_true')
    o = ap.parse_args()
    img = cv2.imread(o.inp, cv2.IMREAD_COLOR)
    pts = morph.detect(img)
    out, a = clean(img, pts)
    cv2.imwrite(o.out, out, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print('saved', o.out)


if __name__ == '__main__':
    morph.ensure_egl()
    main()
