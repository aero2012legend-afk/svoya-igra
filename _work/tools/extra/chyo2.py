"""«Чё думали не будет?» — караоке-строчки заново: текст с сайта песен + время слов из распознавания голоса.
Текст песен на экран НЕ печатается — только счётчики.
/opt/aienv/bin/python chyo2.py asr SLUG [--force]       — голос (Demucs) → Whisper large-v3 → scratchpad/asr/SLUG.json
/opt/aienv/bin/python chyo2.py find SLUG "запрос" [url…] — текст с сайтов, лучший по совпадению с распознанным → lyrics/SLUG.txt
/opt/aienv/bin/python chyo2.py align SLUG [--dry]        — строчки kar в chyo.json (вопрос, у которого audio содержит SLUG)
SLUG — кусок имени файла: chip, pokemon, chernyplash, catdog, kim, shaman, jimmy, bob, duck, tmnt …"""
import difflib, json, os, re, subprocess, sys, tempfile, wave
import numpy as np

SP = '/tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad'
ROOT = '/home/user/svoya-igra'
sys.path.insert(0, ROOT + '/_work/tools')
sys.path.insert(0, SP + '/tools')
import restore_audio as RA  # noqa: E402

CP = ROOT + '/_work/content/chyo.json'
OLD = {'chip': 300, 'pokemon': 600, 'chernyplash': 900, 'catdog': 1200, 'ben10': 1500, 'shaman': 2100, 'jimmy': 2400, 'gummi': 2700}
JUNK = re.compile(r'(?i)похож|написал|послуша|скача|mp3|kbps|понравил|текст песни|автор|исполн|http|www|\.ru\b|\.com\b|слова:|музыка:|перевод|аккорд|видео|клип|lyrics|©')


def norm(w):
    return re.sub(r'[^\w]', '', w.lower().replace('ё', 'е')).replace('_', '')


def question(slug):
    d = json.load(open(CP, encoding='utf-8'))
    for q in d['themes'][0]['questions']:
        if slug in q.get('audio', ''):
            return d, q
    sys.exit('нет вопроса с audio ~ ' + slug)


def lyr_path(slug):
    p = f'{SP}/lyrics/{slug}.txt'
    if not os.path.exists(p) and slug in OLD and os.path.exists(f'{SP}/lyrics/{OLD[slug]}.txt'):
        return f'{SP}/lyrics/{OLD[slug]}.txt'
    return p


def lyric_lines(slug):
    p = lyr_path(slug)
    if not os.path.exists(p):
        return []
    out = []
    for l in open(p, encoding='utf-8'):
        l = l.strip().strip('"«»').strip()
        if not l or JUNK.search(l) or re.match(r'(?i)^(припев|куплет|проигрыш|\d+\s*раз|x\d|\(.*\)$|\[.*\]$)', l):
            continue
        l = re.sub(r'\s*\((?:\d+\s*раза?|x\d|×\d)\)\s*$', '', l)
        l = re.sub(r'\s+', ' ', l).replace(' ,', ',')
        if sum(1 for w in l.split() if norm(w)) >= 1:
            out.append(l)
    return out


# ---------- распознавание ----------
def cmd_asr(slug, force=False):
    os.makedirs(SP + '/asr', exist_ok=True)
    outp = f'{SP}/asr/{slug}.json'
    if os.path.exists(outp) and not force:
        print('уже есть', outp)
        return
    _, q = question(slug)
    src = ROOT + '/_private/' + q['audio']
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, 'full.wav')
    RA.ff(['-i', src, '-ac', '2', '-ar', '44100', wav])
    voc, _ = RA.separate(wav, tmp)
    mono = os.path.join(tmp, 'mono.wav')
    RA.ff(['-i', voc, '-ac', '1', '-ar', '16000', mono])
    w = wave.open(mono)
    a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    lines = lyric_lines(slug)
    prompt = ' '.join(lines[:2]) if lines else None
    from faster_whisper import WhisperModel
    m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4, download_root='/opt/models/whisper')
    segs, _ = m.transcribe(a, language='ru', word_timestamps=True, vad_filter=False, initial_prompt=prompt,
                           condition_on_previous_text=False, beam_size=5)
    words = [[x.word.strip(), round(x.start, 2), round(x.end, 2), round(x.probability, 2)] for s in segs for x in (s.words or []) if x.word.strip()]
    json.dump(words, open(outp, 'w'), ensure_ascii=False)
    print(f'{slug}: распознано слов {len(words)}, голос до {words[-1][2] if words else 0:.1f} с')


def asr_sources(slug):
    out = {}
    for suf in ('', '_large', '_medium', '_chunks'):
        f = f'{SP}/asr/{slug}{suf}.json'
        if os.path.exists(f):
            out[suf.strip('_') or 'new'] = [w for w in json.load(open(f)) if norm(w[0])]
    return out


def asr_words(slug):
    src = asr_sources(slug)
    return max(src.values(), key=len) if src else []


# ---------- текст с сайтов ----------
def cmd_find(slug, q, urls):
    src = open(SP + '/tools/lyrics_find.py', encoding='utf-8').read()
    ns = {}
    exec(src[:src.index('price = int(')], ns)  # только функции get/links/blocks/words_of/score
    asr = [norm(w[0]) for w in asr_words(slug)]
    best = None
    for u in (urls or ns['links'](q)):
        try:
            page = ns['get'](u)
        except Exception as e:
            print('  ✗', u[:60], type(e).__name__)
            continue
        bl = ns['blocks'](page)
        for b in bl:
            b = [l for l in b if not JUNK.search(l)]
            w = ns['words_of'](' '.join(b))
            if not w:
                continue
            heard = ns['score'](w, asr)        # доля слов текста, которые слышны в песне
            cover = ns['score'](asr, w)        # доля распознанного, которое есть в тексте
            cand = (min(heard, cover), heard, cover, u, b)
            if best is None or cand[:3] > best[:3]:
                best = cand
        print('  ·', u[:70], 'кусков', len(bl))
    if best:
        _, heard, cover, u, b = best
        open(f'{SP}/lyrics/{slug}.txt', 'w').write('\n'.join(b) + '\n')
        print(f'ЛУЧШЕЕ: {u[:70]} — строк {len(b)}; слов текста слышно {heard}%, распознанного есть в тексте {cover}%')


# ---------- привязка ----------
def ratio(a, b):
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def best_at(i, asr, L, last):
    best = None
    for li, (raw, nw) in enumerate(L):
        ref = ' '.join(nw)
        n = len(nw)
        for m in range(max(1, n - 3), n + 4):
            if i + m > len(asr):
                break
            if asr[i + m - 1][1] - asr[i][1] > 4.5 * max(2, n):   # слишком растянуто
                break
            hyp = ' '.join(norm(a[0]) for a in asr[i:i + m])
            r = ratio(ref, hyp)
            sc = r + (0.06 if li == last + 1 else 0) + (0.03 if li == last + 2 else 0)
            if best is None or sc > best[0]:
                best = (sc, r, li, m)
    return best


def map_times(raw_words, win):
    """Слова строчки текста ↔ окно распознанных слов: время каждого слова строчки."""
    rn = [norm(w) for w in raw_words]
    an = [norm(a[0]) for a in win]
    t = [None] * len(rn)
    used = set()
    for b in difflib.SequenceMatcher(a=rn, b=an, autojunk=False).get_matching_blocks():
        for j in range(b.size):
            t[b.a + j] = win[b.b + j][1]
            used.add(b.b + j)
    # похожие слова между найденными соседями
    for k in range(len(rn)):
        if t[k] is not None or not rn[k]:
            continue
        lo = max([j for j in range(len(an)) if j in used and any(t[x] == win[j][1] for x in range(k))], default=-1)
        cands = [(ratio(rn[k], an[j]), j) for j in range(lo + 1, len(an)) if j not in used]
        cands = [c for c in cands if c[0] >= 0.5]
        if cands:
            r, j = max(cands)
            later = [t[x] for x in range(k + 1, len(rn)) if t[x] is not None]
            if not later or win[j][1] <= min(later):
                t[k] = win[j][1]
                used.add(j)
    exact = sum(1 for x in t if x is not None)
    s0, s1 = win[0][1], win[-1][2]
    known = [k for k in range(len(t)) if t[k] is not None]
    for k in range(len(t)):
        if t[k] is not None:
            continue
        lo = max([j for j in known if j < k], default=None)
        hi = min([j for j in known if j > k], default=None)
        ta = t[lo] if lo is not None else s0
        tb = t[hi] if hi is not None else s1
        a0 = lo if lo is not None else -1
        b0 = hi if hi is not None else len(t)
        L = sum(len(raw_words[j]) + 1 for j in range(a0 + 1 if lo is None else a0, b0)) or 1
        acc = sum(len(raw_words[j]) + 1 for j in range(a0 + 1 if lo is None else a0, k))
        t[k] = ta + (tb - ta) * acc / L
    for k in range(1, len(t)):
        t[k] = max(t[k], t[k - 1] + 0.05)
    return [round(x, 2) for x in t], exact


def cmd_align(slug, dry=False):
    best = None
    only = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--src=')), None)
    for name, asr in asr_sources(slug).items():
        if only and name != only:
            continue
        r = align_with(slug, asr)
        print(f'  источник {name}: строчек {len(r[0])}, точно {r[1]}/{r[2]}, пропущено {r[3]}/{len(asr)}')
        key = (r[1] - 0.5 * r[3], len(r[0]))
        if best is None or key > best[0]:
            best = (key, name, r)
    _, name, (kar, ex, tot, skipped, n_asr_lines, tight) = best
    print(f'{slug}: ВЫБРАН {name}; строчек {len(kar)} (из распознавания {n_asr_lines}); слов текста по времени точно {ex}/{tot}; '
          f'пропущено распознанных {skipped}; слишком близких слов {tight}; конец {kar[-1][2][-1] if kar else 0:.1f} с')
    if not dry:
        d, q = question(slug)
        q['kar'] = kar
        json.dump(d, open(CP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        open(CP, 'a').write('\n')


HALLU = re.compile(r'(?i)субтитр|корректор|редактор|продолжение следует|спасибо за просмотр|подпис|dimatorzok|amara|похожие песни|понравил')


def asr_only(asr):
    """Текста с сайта нет — строчки из распознанного голоса (паузы режут строки), без «галлюцинаций» Whisper."""
    import karaoke as K
    ws = [{'w': a[0], 's': a[1], 'e': a[2]} for a in asr if not HALLU.search(a[0]) and a[3] >= 0.25]
    # выкидываем подряд идущие слова из фраз-галлюцинаций целиком (Whisper пишет их несколькими «словами»)
    kar = K.build_lines(ws, set())
    kar = [x for x in kar if not HALLU.search(x[1])]
    gaps = [b - a for x in kar for a, b in zip(x[2], x[2][1:])]
    return kar, len(ws), len(ws), len(asr) - len(ws), len(kar), sum(1 for g in gaps if g < 0.1)


def align_with(slug, asr):
    lines = lyric_lines(slug)
    if not lines:
        return asr_only(asr)
    L = [(l, [norm(w) for w in l.split() if norm(w)]) for l in lines]
    L = [(raw, nw) for raw, nw in L if nw]
    out, i, last, skipped, run = [], 0, -1, 0, []
    exact_total = words_total = 0

    def flush_run():
        nonlocal run
        # несколько подряд распознанных слов, которых нет в тексте с сайта: если уверенно — оставляем строчкой
        if len(run) >= 3 and sum(a[3] for a in run) / len(run) >= 0.6:
            out.append(('asr', [a[0] for a in run], [a[1] for a in run]))
        run = []

    while i < len(asr):
        b = best_at(i, asr, L, last) if L else None
        if b and b[1] >= 0.5:
            b2 = best_at(i + 1, asr, L, last) if i + 1 < len(asr) else None
            if b2 and b2[1] > b[1] + 0.08:
                run.append(asr[i]); skipped += 1; i += 1
                continue
            flush_run()
            _, r, li, m = b
            raw_words = L[li][0].split()
            ts, ex = map_times(raw_words, asr[i:i + m])
            exact_total += ex; words_total += len(raw_words)
            out.append(('lyr', raw_words, ts))
            i += m; last = li
        else:
            run.append(asr[i]); skipped += 1; i += 1
    flush_run()
    kar, prev = [], 0.0
    for kind, ws, ts in out:
        # длинную строчку из распознавания режем по 6 слов
        chunks = [(ws, ts)] if kind == 'lyr' or len(ws) <= 7 else [(ws[k:k + 6], ts[k:k + 6]) for k in range(0, len(ws), 6)]
        for cw, ct in chunks:
            st = round(max(prev, ct[0] - 0.4, 0), 2)
            kar.append([st, ' '.join(cw), ct])
            prev = ct[-1]
    n_asr_lines = sum(1 for k, _, _ in out if k == 'asr')
    gaps = [b - a for x in kar for a, b in zip(x[2], x[2][1:])]
    tight = sum(1 for g in gaps if g < 0.1)
    return kar, exact_total, words_total, skipped, n_asr_lines, tight


if __name__ == '__main__':
    cmd, slug = sys.argv[1], sys.argv[2]
    if cmd == 'asr':
        cmd_asr(slug, '--force' in sys.argv)
    elif cmd == 'find':
        cmd_find(slug, sys.argv[3], sys.argv[4:])
    elif cmd == 'align':
        cmd_align(slug, '--dry' in sys.argv)
