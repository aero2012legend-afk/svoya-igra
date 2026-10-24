#!/usr/bin/env python3
"""Проверка темы: печатает вопросы компактно и делает один лист превью всех картинок.
python3 _work/tools/review.py _work/content/x.json [номер_темы_в_файле|all] [out.jpg]"""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); sel = sys.argv[2] if len(sys.argv) > 2 else 'all'
out = sys.argv[3] if len(sys.argv) > 3 else '/tmp/review_' + os.path.basename(sys.argv[1]).replace('.json', '.jpg')
ths = d.get('themes', []); ths = ths if sel == 'all' else [ths[int(sel)]]
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception: F = ImageFont.load_default()
cells = []; qmap = {}
key_of = lambda lbl: lbl.split(' ')[1] if ' ' in lbl else ''
for th in ths:
    print(f"== Р{th.get('round')} {th.get('name')} ({len(th.get('questions', []))})")
    for q in th.get('questions', []):
        extra = ' '.join(f'{k}={q[k]}' for k in ('type', 'fx', 'area', 'audio', 'start', 'end', 'aend') if k in q)
        print(f"{q.get('price')}: {q.get('q')}\n    → {q.get('a')} | c: {q.get('c', '')} | hint: {q.get('hint', '')} {extra}")
        if q.get('kar'): print('    kar:', ' / '.join(str(x[1]) for x in q['kar'])[:200])
        for key in ('img', 'aimg') + (('pics',) if q.get('pics') else ()):
            vals = q.get(key) if isinstance(q.get(key), list) else [q.get(key)]
            for v in vals:
                if not v: continue
                p = v if os.path.exists(v) else None
                lbl = f"{th.get('round')}/{q.get('price')} {key}{' ' + q['fx'] if key == 'img' and q.get('fx') else ''}"
                cells.append((lbl, p, v)); qmap[(lbl, v)] = q
if cells:
    W, H, cols = 300, 230, 6
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * W, rows * H), (25, 25, 35)); dr = ImageDraw.Draw(sheet)
    for i, (lbl, p, v) in enumerate(cells):
        x, y = (i % cols) * W, (i // cols) * H
        if p:
            try:
                im = Image.open(p).convert('RGB')
                q = qmap.get((lbl, v))
                if q and key_of(lbl) == 'img' and q.get('fx') in ('zoom', 'crop') and isinstance(q.get('area'), list) and len(q['area']) >= 4:
                    ax, ay, aw, ah = [float(t) for t in q['area'][:4]]; Wd, Hd = im.size
                    if q['fx'] == 'crop': box = (ax, ay, ax + aw, ay + ah)
                    else:  # как в игре: окно в пропорциях картинки, сторона max(w,h)%
                        sc = max(1, min(14, min(100 / max(1, aw), 100 / max(1, ah)))); win = 100 / sc
                        cx, cy = ax + aw / 2, ay + ah / 2; x0 = min(max(cx - win / 2, 0), 100 - win); y0 = min(max(cy - win / 2, 0), 100 - win)
                        box = (x0, y0, x0 + win, y0 + win)
                    im = im.crop((int(box[0] * Wd / 100), int(box[1] * Hd / 100), int(box[2] * Wd / 100), int(box[3] * Hd / 100)))
                im.thumbnail((W - 10, H - 34)); sheet.paste(im, (x + 5, y + 28))
            except Exception as e: dr.text((x + 5, y + 60), 'ERR ' + str(e)[:30], fill=(255, 80, 80), font=F)
        else: dr.text((x + 5, y + 60), 'НЕТ ФАЙЛА', fill=(255, 80, 80), font=F)
        dr.text((x + 5, y + 4), lbl, fill=(255, 220, 0), font=F)
    sheet.save(out, quality=78); print('SHEET', out, len(cells), 'картинок')
