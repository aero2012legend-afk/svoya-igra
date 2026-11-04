"""Ребусы: emoji-картинки с запятыми, заменой букв и буквами → HTML → webp через render.mjs."""
import json, subprocess, sys, html
OUT = '/home/user/svoya-igra/media/img/rebusy'
R = {
 'pivas':   [{'e': '🍺', 'post': 1}, {'t': 'АС'}],
 'tormoz':  [{'e': '🎂', 'post': 1}, {'e': '🧠', 'post': 1}],
 'popa':    [{'e': '🦜', 'post': 4}, {'t': 'А'}],
 'trusy':   [{'e': '🎺', 'post': 2}, {'e': '🧀', 'post': 1}],
 'durdom':  [{'e': '🚿', 'sub': 'Ш=Р'}, {'e': '🏠'}],
 'zhiza':   [{'e': '🦒', 'post': 3}, {'e': '🔒', 'post': 3}],
 'boltun':  [{'e': '🔩'}, {'e': '🚽', 'post': 4}],
 'dushnila':[{'e': '🚿'}, {'t': 'НИ'}, {'e': '🦙', 'post': 2}],
 'lopuh':   [{'e': '🪏', 'post': 3}, {'e': '👂', 'post': 1}],
 'elki':    [{'e': '🎄', 'sub': 'А=И'}, {'t': '—'}, {'e': '🌴', 'post': 3}, {'e': '🐋', 'post': 1}],
}
CSS = """html,body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:'DejaVu Sans',sans-serif}
body{background:#fffdf6;display:flex;align-items:center;justify-content:center}
.f{position:absolute;inset:18px;border:4px dashed #e8dfc0;border-radius:28px}
.row{display:flex;align-items:center;justify-content:center;gap:34px;position:relative}
.it{display:flex;align-items:center;gap:4px}
.pic{position:relative;display:flex;flex-direction:column;align-items:center}
.em{font-size:SIZEpx;line-height:1.05;white-space:nowrap}
.sub{font-weight:900;font-size:64px;color:#1d2a4a;letter-spacing:.06em;margin-bottom:6px}
.c{font-weight:900;color:#d62f2f;font-size:150px;line-height:.5;align-self:flex-end;margin-bottom:40px;letter-spacing:-6px}
.t{font-weight:900;font-size:150px;color:#1d2a4a}
"""
def item(x):
    if 't' in x:
        return f'<div class="it"><div class="t">{html.escape(x["t"])}</div></div>'
    pre = '<div class="c">' + '’' * x.get('pre', 0) + '</div>' if x.get('pre') else ''
    post = '<div class="c">' + '’' * x.get('post', 0) + '</div>' if x.get('post') else ''
    sub = f'<div class="sub">{x["sub"]}</div>' if x.get('sub') else ''
    return f'<div class="it">{pre}<div class="pic">{sub}<div class="em">{x["e"]}</div></div>{post}</div>'
for name, items in R.items():
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    n = sum(len(x.get('e', '')) // 2 + (1 if 't' in x else 0) for x in items)
    size = 260 if len(items) <= 2 else (210 if len(items) == 3 else 170)
    page = f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS.replace("SIZE", str(size))}</style></head><body><div class="f"></div><div class="row">{"".join(item(x) for x in items)}</div></body></html>'
    open(f'{name}.html', 'w').write(page)
    subprocess.run(['node', '/home/user/svoya-igra/_work/tools/render.mjs', f'{name}.html', f'{OUT}/rebus_{name}.webp', '1280', '720'], check=True, capture_output=True)
    print('ok', name)
