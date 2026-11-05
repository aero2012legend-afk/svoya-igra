"""Найти текст заставки на сайтах с текстами песен и сравнить с распознанным голосом. Текст НЕ печатается —
лучший вариант сохраняется в scratchpad/lyrics/<цена>.txt, на экран — только сайт и проценты совпадения.
python3 lyrics_find.py ЦЕНА "поисковый запрос" """
import urllib.request, urllib.parse, re, html, json, difflib, sys, subprocess
SP = '/tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad'
ROOT = '/home/user/svoya-igra'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
def get(url, t=20):
    r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8'}), timeout=t)
    raw = r.read(); enc = r.headers.get_content_charset() or 'utf-8'
    try: return raw.decode(enc, 'ignore')
    except LookupError: return raw.decode('utf-8', 'ignore')
def norm(w): return re.sub(r'[^\w]', '', w.lower().replace('ё', 'е')).replace('_', '')
def words_of(text): return [norm(w) for w in text.split() if norm(w)]
def links(q):
    import time
    for attempt in range(4):
        try:
            t = get('https://html.duckduckgo.com/html/?' + urllib.parse.urlencode({'q': q, 'kl': 'ru-ru'}), 25)
        except Exception:
            time.sleep(3); continue
        out = []
        for u in re.findall(r'class="result__a" href="([^"]+)"', t):
            u = html.unescape(u); m = re.search(r'uddg=([^&]+)', u)
            u = urllib.parse.unquote(m.group(1)) if m else u
            if not any(b in u for b in ('youtube.', 'vk.com', 'wikipedia', 'rutube', 'tiktok', 'dzen', 'ok.ru', 'duckduckgo')) and u not in out:
                out.append(u)
        if out: return out[:10]
        time.sleep(3)
    return []
def blocks(page):
    page = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', page)
    page = re.sub(r'(?i)<br\s*/?>', '\n', page)
    page = re.sub(r'(?i)</(p|div|li|h\d)>', '\n\n', page)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', page))
    lines = [re.sub(r'[ \t ]+', ' ', l).strip() for l in text.split('\n')]
    # непрерывные куски коротких строк с кириллицей — похоже на стихи
    out, cur = [], []
    for l in lines + ['']:
        ok = 0 < len(l) <= 70 and re.search(r'[а-яё]', l, re.I) and not re.search(r'(?i)http|©|войти|реклам|комментар|скачать|аккорд|просмотр', l)
        if ok: cur.append(l)
        elif l == '' and cur and len(cur) < 3: cur = []
        elif l != '' or not cur: 
            if len(cur) >= 4: out.append(cur)
            cur = []
    if len(cur) >= 4: out.append(cur)
    return out
def score(ref, hyp):
    if not ref or not hyp: return 0
    hit = sum(b.size for b in difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False).get_matching_blocks())
    return round(100 * hit / len(ref))
price = int(sys.argv[1]); q = sys.argv[2]
URLS = [u for u in sys.argv[3:]]  # готовые адреса страниц (из веб-поиска) — тогда поиск не нужен
old = json.loads(subprocess.run(['git', '-C', ROOT, 'show', '8ae0eb8:_work/content/chyo.json'], capture_output=True, text=True).stdout)
oldw = [norm(w) for x in [z for z in old['themes'][0]['questions'] if z['price'] == price][0].get('kar') or [] for w in str(x[1]).split() if norm(w)]
med = {z['price']: z for z in json.load(open(SP + '/chyo_medium.json'))['themes'][0]['questions']}
cur = {z['price']: z for z in json.load(open(ROOT + '/_work/content/chyo.json'))['themes'][0]['questions']}
asr = [norm(w) for z in (med[price], cur[price]) for x in z.get('kar') or [] for w in str(x[1]).split() if norm(w)]
asr_m = [norm(w) for x in med[price].get('kar') or [] for w in str(x[1]).split() if norm(w)]
if q == 'auto':  # запрос из начала проверенных строчек (сам текст на экран не выводим)
    first = [w for x in [z for z in old['themes'][0]['questions'] if z['price'] == price][0].get('kar') or [] for w in str(x[1]).split() if norm(w) and '_' not in w]
    q = '"' + ' '.join(first[:6]) + '" текст песни'
best = None
for u in (URLS or links(q)):
    try: page = get(u)
    except Exception as e: print('  ✗', urllib.parse.urlparse(u).netloc, type(e).__name__); continue
    for b in blocks(page):
        w = words_of(' '.join(b))
        s_old = score(oldw, w)                      # проверенные строчки должны найтись в тексте
        s_asr = score(w, asr_m) if w else 0         # доля слов текста, которые слышны в песне
        cand = (s_old, s_asr, -abs(len(w) - len(asr_m)), u, b)
        if best is None or cand[:3] > best[:3]: best = cand
    print('  ·', urllib.parse.urlparse(u).netloc, 'кусков', len(blocks(page)))
if best:
    s_old, s_asr, _, u, b = best
    open(f'{SP}/lyrics/{price}.txt', 'w').write('\n'.join(b) + '\n')
    print(f'ЛУЧШЕЕ: {urllib.parse.urlparse(u).netloc} — строк {len(b)}, слов {len(words_of(" ".join(b)))}; проверенные строчки найдены на {s_old}%, слов текста слышно в песне {s_asr}% (слов в распознанном {len(asr_m)})')
