#!/usr/bin/env python3
"""Караоке для вопросов пака: время каждого слова (Whisper по голосу, отделённому Demucs) и минус.
Запуск: /opt/aienv/bin/python _work/tools/karaoke.py РЕЖИМ ТЕМА ЦЕНА [опции]
  ТЕМА — имя файла в _work/content без .json (dyryavy, nash2007, chyo…), ЦЕНА — цена вопроса.

Режимы:
  align  — строчки kar уже есть (текст не меняется): добавить к каждому слову время.
           Пропуск «___» / {слово} получает время end. Нужен файл audio в _private.
  full   — строчки kar сделать заново из распознанного текста (для песни целиком: караоке-клетки,
           «Наш 2007»). Текст песни пишет скрипт — его НЕ НАДО печатать/переписывать руками.
           --mask "слово,слово" — эти слова спрятать до ответа (например, название песни).
           --from S --to E — распознавать только кусок файла (секунды от начала файла).
  minus  — сделать минус (песня без голоса) на той же шкале времени, что и audio:
           --len N — длина минуса в секундах от начала файла (по умолчанию end + 45 или длина audio).
           Пишет файл рядом с audio (…_minus.mp3), запись в _work/audio/ТЕМА.json и поле minus в вопросе.
  check  — проверка без вывода текста песни: строчки, слова, времена, сомнительные места.

Опции: --lang ru|en (язык песни, по умолчанию ru), --prompt "…" (подсказка Whisper: начало текста).
Тексты песен в консоль не печатаются — только счётчики и время."""
import argparse, json, os, re, subprocess, sys, tempfile, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import restore_audio as RA  # noqa: E402

GAP = re.compile(r'_{2,}|\{[^}]*\}')


def content_path(slug):
    return os.path.join(ROOT, '_work', 'content', slug + '.json')


def load(slug, price):
    p = content_path(slug)
    d = json.load(open(p, encoding='utf-8'))
    themes = [d] if 'questions' in d else d.get('themes', [])
    for th in themes:
        for q in th.get('questions', []):
            if int(q.get('price', -1)) == int(price):
                return d, q, p
    sys.exit(f'Нет вопроса за {price} в {p}')


def save(d, p):
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
        f.write('\n')


def ff(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True, env=RA.proxy_env())


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout.strip()
    return float(out or 0)


def lufs(path):
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
    return float(m[-1]) if m else None


def private(path):
    return os.path.join(ROOT, '_private', path)


def norm(w):
    w = w.lower().replace('ё', 'е')
    return re.sub(r'[^\w]', '', w).replace('_', '')


# ---------- распознавание ----------
def vocals_of(audio, fr=0.0, to=None):
    """Отделить голос от куска файла; вернуть (моно 16 кГц как массив, сдвиг в секундах)."""
    tmp = tempfile.mkdtemp()
    cut = os.path.join(tmp, 'cut.wav')
    ff(['-ss', str(fr)] + (['-t', str(to - fr)] if to else []) + ['-i', audio, '-ac', '2', '-ar', '44100', cut])
    voc, _ = RA.separate(cut, tmp)
    mono = os.path.join(tmp, 'mono.wav')
    ff(['-i', voc, '-ac', '1', '-ar', '16000', mono])
    w = wave.open(mono)
    return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768, fr


def transcribe(audio, lang, prompt=None, fr=0.0, to=None):
    a, off = vocals_of(audio, fr, to)
    from faster_whisper import WhisperModel
    m = WhisperModel('medium', device='cpu', compute_type='int8', cpu_threads=4, download_root='/opt/models/whisper')
    segs, _ = m.transcribe(a, language=lang, word_timestamps=True, vad_filter=False, initial_prompt=prompt,
                           condition_on_previous_text=False)
    words = []
    for s in segs:
        for x in s.words or []:
            t = x.word.strip()
            if t:
                words.append({'w': t, 's': round(x.start + off, 2), 'e': round(x.end + off, 2), 'p': round(x.probability, 2)})
    return words


# ---------- align: время для готовых строчек ----------
def align_line_words(tokens, words, lo, hi, gap_t):
    """tokens — слова строчки; words — распознанные слова между lo и hi. Вернуть время каждого токена."""
    import difflib
    a = [norm(t) for t in tokens]
    b = [norm(w['w']) for w in words]
    times = [None] * len(tokens)
    for k, t in enumerate(tokens):
        if GAP.search(t):
            times[k] = gap_t
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for blk in sm.get_matching_blocks():
        for j in range(blk.size):
            if times[blk.a + j] is None and a[blk.a + j]:
                times[blk.a + j] = words[blk.b + j]['s']
    # похожие, но не одинаковые слова (Whisper ошибся буквой) — по порядку между совпавшими
    for k, t in enumerate(times):
        if t is None and a[k]:
            best, bt = 0.0, None
            for w in words:
                r = difflib.SequenceMatcher(a=a[k], b=norm(w['w'])).ratio()
                prev = max([x for x in times[:k] if x is not None], default=lo - 1)
                nxt = min([x for x in times[k + 1:] if x is not None], default=hi + 1)
                if r > best and prev < w['s'] < nxt:
                    best, bt = r, w['s']
            if best >= 0.6:
                times[k] = bt
    return fill(tokens, times, lo, hi)


def fill(tokens, times, lo, hi):
    """Слова без времени — между соседями пропорционально длине; время только растёт."""
    n = len(tokens)
    for k in range(n):
        if times[k] is not None and (k and times[k - 1] is not None and times[k] < times[k - 1]):
            times[k] = None  # нарушен порядок — пересчитаем
    k = 0
    while k < n:
        if times[k] is not None:
            k += 1
            continue
        j = k
        while j < n and times[j] is None:
            j += 1
        left = times[k - 1] if k else lo
        right = times[j] if j < n else min(hi, left + 0.38 * (j - k + 1))
        lens = [len(tokens[x]) + 1 for x in range(k, j)]
        tot = sum(lens) + (len(tokens[k - 1]) + 1 if k else 0)
        acc = len(tokens[k - 1]) + 1 if k else 0
        for x in range(k, j):
            times[x] = round(left + (right - left) * acc / max(1, tot), 2)
            acc += len(tokens[x]) + 1
        k = j
    for k in range(1, n):
        times[k] = max(times[k], times[k - 1])
    return [round(t, 2) for t in times]


def cmd_align(a):
    d, q, p = load(a.theme, a.price)
    kar, audio = q.get('kar') or [], q.get('audio')
    if not kar or not audio:
        sys.exit('У вопроса нет kar или audio')
    words = transcribe(private(audio), a.lang, a.prompt)
    end = float(q.get('end') or 0)
    out = []
    for i, line in enumerate(kar):
        t0, text = float(line[0]), str(line[1])
        t1 = float(kar[i + 1][0]) if i + 1 < len(kar) else max(t0 + 6, end + 3 if end else t0 + 6)
        toks = text.split()
        ws = [w for w in words if t0 - 0.6 <= w['s'] < t1 + 0.2]
        times = align_line_words(toks, ws, t0, t1, round(end + 0.03, 2) if end else t1)
        out.append([line[0], text, times])
    q['kar'] = out
    save(d, p)
    report(q, words)


# ---------- full: строчки из распознанного текста ----------
def build_lines(words, mask, max_words=7, max_chars=38, pause=0.7):
    lines, cur = [], []
    for k, w in enumerate(words):
        if cur:
            ln = sum(len(x['w']) + 1 for x in cur)
            brk = w['s'] - cur[-1]['e'] > pause or len(cur) >= max_words or ln + len(w['w']) > max_chars \
                or (re.search(r'[.!?;]$', cur[-1]['w']) and len(cur) >= 2) or (re.search(r',$', cur[-1]['w']) and len(cur) >= 4)
            if brk:
                lines.append(cur)
                cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    out, prev_end = [], 0.0
    for L in lines:
        toks = []
        for w in L:
            t = w['w']
            if norm(t) and norm(t) in mask:
                m = re.match(r'^(\W*)(.*?)(\W*)$', t)
                t = f'{m.group(1)}{{{m.group(2)}}}{m.group(3)}'
            toks.append(t)
        start = round(max(L[0]['s'] - 0.4, prev_end, 0), 2)
        out.append([start, ' '.join(toks), [w['s'] for w in L]])
        prev_end = L[-1]['s']
    return out


def cmd_full(a):
    d, q, p = load(a.theme, a.price)
    audio = q.get('audio')
    if not audio:
        sys.exit('У вопроса нет audio (исходник с голосом)')
    words = transcribe(private(audio), a.lang, a.prompt, a.fr, a.to)
    mask = {norm(x) for x in (a.mask or '').split(',') if x.strip()}
    q['kar'] = build_lines(words, mask)
    save(d, p)
    report(q, words)


def report(q, words=None):
    kar = q.get('kar') or []
    print(f'Строчек: {len(kar)}; слов: {sum(len(str(x[1]).split()) for x in kar)}')
    for i, x in enumerate(kar):
        n = len(str(x[1]).split())
        ws = x[2] if len(x) > 2 else []
        gaps = sum(1 for t in str(x[1]).split() if GAP.search(t))
        span = f'{ws[0]:.2f}…{ws[-1]:.2f}' if ws else '—'
        bad = '' if len(ws) == n else f'  ⚠ времён {len(ws)} ≠ слов {n}'
        print(f'  {i + 1:2d}. с {float(x[0]):6.2f}: слов {n}, слова {span}' + (f', спрятано {gaps}' if gaps else '') + bad)
    if words:
        low = [w for w in words if w['p'] < 0.5]
        print(f'Whisper: слов {len(words)}, неуверенных (<50%) {len(low)}' + (': на ' + ', '.join(f"{w['s']:.1f}с" for w in low[:15]) if low else ''))


def cmd_check(a):
    d, q, p = load(a.theme, a.price)
    report(q)
    for k in ('audio', 'minus'):
        if q.get(k):
            f = private(q[k])
            print(f'{k}: {q[k]} — ' + (f'{duration(f):.1f} с' if os.path.exists(f) else 'НЕТ ФАЙЛА'))


# ---------- минус ----------
def cmd_minus(a):
    d, q, p = load(a.theme, a.price)
    audio = q.get('audio')
    reg_p = os.path.join(ROOT, '_work', 'audio', a.theme + '.json')
    reg = json.load(open(reg_p, encoding='utf-8')) if os.path.exists(reg_p) else []
    e = next((x for x in reg if x.get('file') == audio), None)
    if not e or not e.get('source'):
        sys.exit(f'Нет записи об источнике {audio} в {reg_p}')
    if isinstance(e['cut'][0], list):
        sys.exit('Фрагмент склеен из кусков — минус так не сделать')
    s = float(e['cut'][0])
    have = float(e['cut'][1]) - s
    end = float(q.get('end') or 0)
    want = a.len or max(have, end + 45 if end else have)
    src = RA.fetch(e['source'])
    tmp = tempfile.mkdtemp()
    raw = os.path.join(tmp, 'raw.wav')
    ff(['-ss', str(s), '-t', f'{want:.3f}', '-i', src, '-vn', '-ac', '2', '-ar', '44100', raw])
    L = duration(raw)
    voc, music = RA.separate(raw, tmp)
    # громкость минуса подгоняем под оригинальный фрагмент
    ref = lufs(private(audio)) or -16.0
    cur = lufs(music) or ref
    gain = round(max(-20.0, min(12.0, ref - cur)), 1)
    chain = f'volume={gain}dB,afade=t=in:d=0.2,afade=t=out:st={max(0, L - 1.5):.2f}:d=1.5,alimiter=limit=0.89:attack=3:release=40'
    out_rel = re.sub(r'\.(mp3|m4a|ogg|wav)$', '', audio) + '_minus.mp3'
    os.makedirs(os.path.dirname(private(out_rel)), exist_ok=True)
    ff(['-i', music, '-af', chain] + RA.ENC + [private(out_rel)])
    entry = {'file': out_rel, 'source': e['source'], 'title': (e.get('title') or '') + ' — минус (без голоса)',
             'cut': [round(s, 3), round(s + L, 3)], 'demucs': 'no_vocals', 'ffmpeg': chain}
    reg = [x for x in reg if x.get('file') != out_rel] + [entry]
    with open(reg_p, 'w', encoding='utf-8') as f:
        json.dump(reg, f, ensure_ascii=False, indent=1)
        f.write('\n')
    q['minus'] = out_rel
    save(d, p)
    print(f'Минус: {out_rel} — {L:.1f} с (громкость {gain:+} дБ), записан в {os.path.relpath(reg_p, ROOT)}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['align', 'full', 'minus', 'check'])
    ap.add_argument('theme')
    ap.add_argument('price', type=int)
    ap.add_argument('--lang', default='ru')
    ap.add_argument('--prompt')
    ap.add_argument('--mask')
    ap.add_argument('--from', dest='fr', type=float, default=0.0)
    ap.add_argument('--to', type=float)
    ap.add_argument('--len', type=float)
    a = ap.parse_args()
    {'align': cmd_align, 'full': cmd_full, 'minus': cmd_minus, 'check': cmd_check}[a.mode](a)


if __name__ == '__main__':
    main()
