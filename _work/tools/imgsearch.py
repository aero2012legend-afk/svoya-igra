#!/usr/bin/env python3
"""Поиск картинок через Bing Images (запасной — Яндекс): скачивает кандидатов, приводит к JPEG и делает лист превью.
Использование: python3 imgsearch.py "запрос" OUTDIR [N=8] [PREFIX=img]
Результат: OUTDIR/PREFIX_1.jpg ... и OUTDIR/PREFIX_sheet.jpg (пронумерованные превью — посмотри его через Read и выбери номер)."""
import sys, os, re, io, html, json, urllib.request, urllib.parse, concurrent.futures as cf
from PIL import Image, ImageDraw, ImageFont, ImageOps
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

def get(url, timeout=20, ref=None):
    h = {'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8'}
    if ref: h['Referer'] = ref
    return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout).read()

def bing(q, n):
    out = []
    for first in (1, 36):
        try:
            t = get('https://www.bing.com/images/search?' + urllib.parse.urlencode({'q': q, 'form': 'HDRSC2', 'first': first})).decode('utf8', 'ignore')
        except Exception as e:
            print('bing error', e, file=sys.stderr); break
        for m in re.finditer(r'm="(\{[^"]+\})"', t):
            try:
                d = json.loads(html.unescape(m.group(1)))
                if d.get('murl'): out.append((d['murl'], d.get('turl')))
            except Exception: pass
        if len(out) >= n * 3: break
    return out

def yandex(q, n):
    out = []
    try:
        t = get('https://yandex.ru/images/search?' + urllib.parse.urlencode({'text': q})).decode('utf8', 'ignore')
        for u in re.findall(r'"origUrl":"(https?:[^"]+)"', t) + re.findall(r'img_url=(https?%3A[^&"]+)', t):
            out.append((urllib.parse.unquote(u.replace('\\u002F', '/')), None))
    except Exception as e:
        print('yandex error', e, file=sys.stderr)
    return out

def fetch(cand):
    u, tu = cand
    for url in (u, tu):
        if not url: continue
        try:
            b = get(url, 15)
            im = Image.open(io.BytesIO(b)); im.load()
            im = ImageOps.exif_transpose(im)
            if im.mode in ('RGBA', 'LA', 'P'):
                im = im.convert('RGBA'); bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[-1]); im = bg
            im = im.convert('RGB')
            if min(im.size) < 120: continue
            return im, url
        except Exception:
            continue
    return None

def main():
    q, outdir = sys.argv[1], sys.argv[2]
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    prefix = sys.argv[4] if len(sys.argv) > 4 else 'img'
    os.makedirs(outdir, exist_ok=True)
    cands = bing(q, n)
    if len(cands) < n: cands += yandex(q, n)
    seen, uniq = set(), []
    for c in cands:
        if c[0] not in seen: seen.add(c[0]); uniq.append(c)
    got = []
    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(fetch, uniq[: n * 3]):
            if r: got.append(r)
            if len(got) >= n: break
    got = got[:n]
    thumbs = []
    for i, (im, url) in enumerate(got, 1):
        im2 = im.copy(); im2.thumbnail((1600, 1600))
        p = os.path.join(outdir, f'{prefix}_{i}.jpg'); im2.save(p, 'JPEG', quality=88)
        print(f'{p}\t{im.size[0]}x{im.size[1]}\t{url}')
        t = im.copy(); t.thumbnail((360, 360)); thumbs.append(t)
    if thumbs:
        cols = 4; rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * 380, rows * 400), (30, 30, 30)); d = ImageDraw.Draw(sheet)
        try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
        except Exception: font = ImageFont.load_default()
        for i, t in enumerate(thumbs):
            x, y = (i % cols) * 380 + 10, (i // cols) * 400 + 40
            sheet.paste(t, (x, y)); d.text((x, y - 38), str(i + 1), fill=(255, 220, 0), font=font)
        sp = os.path.join(outdir, f'{prefix}_sheet.jpg'); sheet.save(sp, 'JPEG', quality=80); print('SHEET', sp)
    else:
        print('NOTHING FOUND')

if __name__ == '__main__':
    main()
