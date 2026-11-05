"""Текст песни со страницы → scratchpad/lyrics/kb_SLUG.txt (на экран — только совпадение с распознанным).
python3 kb_lyr.py SLUG URL [URL…]"""
import sys, json, re, urllib.parse
sys.argv_saved = sys.argv[:]
SP = '/tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad'
src = open(SP + '/tools/lyrics_find.py', encoding='utf-8').read().split('price = int(sys.argv[1])')[0]
exec(src)
slug, urls = sys.argv[1], sys.argv[2:]
asr = [norm(w[0]) for w in json.load(open(f'{SP}/kb/{slug}_mix.json')) if norm(w[0])]
best = None
for u in urls:
    try: page = get(u)
    except Exception as e: print('  ✗', urllib.parse.urlparse(u).netloc, type(e).__name__, e); continue
    bl = blocks(page)
    # amdm.ru: текст с аккордами в <pre>; строки аккордов и пометки убираем
    for pre in re.findall(r'(?s)<pre[^>]*>(.*?)</pre>', page):
        t = html.unescape(re.sub(r'<[^>]+>', '', pre))
        ls = [l.strip() for l in t.split('\n')]
        ls = [l for l in ls if re.search(r'[а-яё]{2}', l, re.I) and not re.match(r'(?i)^(припев|куплет|бридж|проигрыш|вступление|кода|соло)\b', l)]
        if len(ls) >= 4: bl.append(ls)
    # weekend.rambler.ru: каждая строчка — отдельный <p>
    ps = [html.unescape(re.sub(r'<[^>]+>', '', x)).strip() for x in re.findall(r'(?s)<p[^>]*>(.*?)</p>', page)]
    cur = []
    for l in ps + ['']:
        if 0 < len(l) <= 70 and re.search(r'[а-яё]', l, re.I):
            if not re.match(r'(?i)^(припев|куплет)', l): cur.append(l)
        else:
            if len(cur) >= 4: bl.append(cur)
            cur = []
    # куски подряд склеиваем — куплеты часто разбиты на абзацы
    cands = bl + ([sum(bl, [])] if len(bl) > 1 else [])
    for b in cands:
        w = words_of(' '.join(b))
        cand = (score(w, asr), -abs(len(w) - len(asr)), u, b)
        if best is None or cand[:2] > best[:2]: best = cand
    print('  ·', urllib.parse.urlparse(u).netloc, 'кусков', len(bl))
if best:
    s, _, u, b = best
    open(f'{SP}/lyrics/kb_{slug}.txt', 'w').write('\n'.join(b) + '\n')
    print(f'{slug}: {urllib.parse.urlparse(u).netloc} — строк {len(b)}, слов {len(words_of(" ".join(b)))}, слышно в песне {s}% (распознано слов {len(asr)})')
