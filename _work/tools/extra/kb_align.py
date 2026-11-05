"""Караоке-баттл: настоящий текст (scratchpad/lyrics/kb_SLUG.txt) + время слов из распознавания.
Каждый кусок распознанного голоса сопоставляется с подходящей строчкой текста (повторы припева — тоже),
слова строчки получают время распознанных слов, пропущенные — по соседям. Текст на экран не печатается.
python3 kb_align.py [--dry] [slug …]"""
import difflib, json, re, sys
ROOT = '/home/user/svoya-igra'
SP = '/tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad'
AP = ROOT + '/_work/audio/karbattle.json'
CP = ROOT + '/_work/content/karbattle.json'
LEN = 22.0
HALLU = re.compile(r'(?i)субтитр|корректор|редактор|продолжение следует|спасибо за просмотр|подпис|amara|thank you|subtitles')


def norm(w):
    return re.sub(r'[^\w]', '', w.lower().replace('ё', 'е')).replace('_', '')


def sim(a, b):
    if a == b:
        return True
    if len(a) >= 3 and len(b) >= 3 and difflib.SequenceMatcher(None, a, b).ratio() >= 0.7:
        return True
    return False


def lcs(A, B):
    """нечёткое LCS по словам: список пар (i в A, j в B)"""
    n, m = len(A), len(B)
    D = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            D[i][j] = max(D[i + 1][j], D[i][j + 1], D[i + 1][j + 1] + 1 if sim(A[i], B[j]) else 0)
    out, i, j = [], 0, 0
    while i < n and j < m:
        if sim(A[i], B[j]) and D[i][j] == D[i + 1][j + 1] + 1:
            out.append((i, j)); i += 1; j += 1
        elif D[i + 1][j] >= D[i][j + 1]:
            i += 1
        else:
            j += 1
    return out


def lyric_lines(slug):
    ls = []
    for l in open(f'{SP}/lyrics/kb_{slug}.txt', encoding='utf-8'):
        l = re.sub(r'\s+', ' ', l).strip()
        l = re.sub(r'^\d+\.\s*', '', l)
        if not l or not re.search(r'[а-яё]', l, re.I):
            continue
        toks = l.split()
        # длинные строки — пополам (на экране ~38 знаков)
        ls.append(l)
    return ls


def asr_words(slug, s0):
    fine = [w for w in json.load(open(f'{SP}/kb/{slug}_cut2_chunks.json')) if norm(w[0]) and not HALLU.search(w[0]) and w[3] >= 0.2]
    mix = [[w[0], round(w[1] - s0, 2), round(w[2] - s0, 2), w[3]] for w in json.load(open(f'{SP}/kb/{slug}_mix.json'))
           if norm(w[0]) and not HALLU.search(w[0]) and w[3] >= 0.2 and s0 - 0.3 <= w[1] < s0 + LEN]
    res = {'точная': [w for w in fine if w[2] <= LEN - 0.6], 'быстрая': [w for w in mix if w[2] <= LEN - 0.6]}
    try:
        pr = [w for w in json.load(open(f'{SP}/kb/{slug}_prompt.json')) if norm(w[0]) and not HALLU.search(w[0]) and w[3] >= 0.2]
        res['подсказка'] = [w for w in pr if w[2] <= LEN - 0.3]
    except FileNotFoundError:
        pass
    return res


def letters(w):
    return re.sub(r'[^a-zа-я]', '', w.lower().replace('ё', 'е'))


def align(lines, words):
    """посимвольное выравнивание: весь распознанный кусок ↔ участок текста песни (начало/конец текста — свободно)"""
    # текст песни: буквы + к какому слову какой строчки относятся
    L, Lw, wl = [], [], []          # буква, номер слова; слово → (строчка, токен)
    for li, l in enumerate(lines):
        for ti, t in enumerate(l.split()):
            for ch in letters(t):
                L.append(ch); Lw.append(len(wl))
            wl.append((li, ti))
    A, At = [], []                  # буква распознанного, её время
    for w in words:
        ls = letters(w[0])
        for k, ch in enumerate(ls):
            A.append(ch); At.append(w[1] + (w[2] - w[1]) * k / max(1, len(ls)))
    n, m = len(A), len(L)
    if not n or not m:
        return [], 0
    MT, MM, G, GA = 2, -1, -1, -1
    NEG = -10 ** 9
    # H[i][j]: лучший счёт для A[:i] и L[:j]; начало текста — свободно (H[0][j] = 0)
    H = [[0] * (m + 1)] + [[0] * (m + 1) for _ in range(n)]
    T = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        H[i][0] = H[i - 1][0] + GA; T[i][0] = 1
        ai = A[i - 1]; Hi, Hp, Ti = H[i], H[i - 1], T[i]
        for j in range(1, m + 1):
            d = Hp[j - 1] + (MT if ai == L[j - 1] else MM)
            u = Hp[j] + GA          # буква распознанного без пары
            l_ = Hi[j - 1] + G      # буква текста без пары
            if d >= u and d >= l_:
                Hi[j] = d; Ti[j] = 0
            elif u >= l_:
                Hi[j] = u; Ti[j] = 1
            else:
                Hi[j] = l_; Ti[j] = 2
    # конец текста — свободно
    j = max(range(m + 1), key=lambda x: H[n][x]); i = n
    match = {}                      # буква текста → время
    while i > 0 and j > 0:
        t = T[i][j]
        if t == 0:
            if A[i - 1] == L[j - 1]:
                match[j - 1] = At[i - 1]
            i -= 1; j -= 1
        elif t == 1:
            i -= 1
        else:
            j -= 1
    if not match:
        return [], 0
    lo, hi = min(match), max(match)
    # слова участка: время первой совпавшей буквы
    wt = {}
    for k in range(lo, hi + 1):
        if k in match and Lw[k] not in wt:
            wt[Lw[k]] = match[k]
    w0, w1 = Lw[lo], Lw[hi]
    ids = list(range(w0, w1 + 1))
    known = [x for x in ids if x in wt]
    for x in ids:
        if x not in wt:
            a_ = max([y for y in known if y < x], default=None)
            b_ = min([y for y in known if y > x], default=None)
            if a_ is not None and b_ is not None:
                wt[x] = wt[a_] + (wt[b_] - wt[a_]) * (x - a_) / (b_ - a_)
            elif a_ is not None:
                wt[x] = wt[a_] + 0.3 * (x - a_)
            else:
                wt[x] = wt[b_] - 0.25 * (b_ - x)
    out, cur, cl = [], [], None
    for x in ids:
        li, ti = wl[x]
        if li != cl and cur:
            out.append(cur); cur = []
        cl = li
        cur.append((lines[li].split()[ti], round(max(0, wt[x]), 2)))
    if cur:
        out.append(cur)
    res = []
    for ln in out:
        toks = [t for t, _ in ln]; ts = [x for _, x in ln]
        # длинная строчка — пополам (по запятой поближе к середине)
        if len(' '.join(toks)) > 40 and len(toks) >= 5:
            cut = [k for k in range(2, len(toks) - 1) if re.search(r'[,;:!?.-]$', toks[k - 1])]
            h = min(cut, key=lambda k: abs(k - len(toks) / 2)) if cut else len(toks) // 2
            res += [(toks[:h], ts[:h]), (toks[h:], ts[h:])]
        else:
            res.append((toks, ts))
    return res, len(match)


def main():
    dry = '--dry' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    reg = {x['file']: x for x in json.load(open(AP))}
    songs = json.load(open(CP))
    for s in songs:
        slug = s['audio'].split('/')[-1][:-4]
        if only and slug not in only:
            continue
        try:
            lines = lyric_lines(slug)
        except FileNotFoundError:
            print(slug, 'нет текста'); continue
        s0 = reg[s['audio']]['cut'][0]
        res = {}
        for how, ws in asr_words(slug, s0).items():
            res[how] = align(lines, ws) + (len(ws),)
        how = max(res, key=lambda h: res[h][1])
        out, matched, total = res[how]
        kar, prev_end = [], 0.0
        for toks, ts in out:
            # время слов строго по возрастанию
            for x in range(1, len(ts)):
                ts[x] = max(ts[x], ts[x - 1] + 0.08)
            st = round(max(ts[0] - 0.4, prev_end, 0), 2)
            kar.append([st, ' '.join(toks), [round(t, 2) for t in ts]])
            prev_end = ts[-1]
        print(f'{slug}: {how} распознавание, совпало букв {matched}, слов в распознанном {total}, строчек {len(kar)} (было {len(s["kar"])}), '
              f'первая {kar[0][0] if kar else None} с, последняя {kar[-1][2][-1] if kar else None} с')
        if not dry and kar:
            s['kar'] = kar
    if not dry:
        json.dump(songs, open(CP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
