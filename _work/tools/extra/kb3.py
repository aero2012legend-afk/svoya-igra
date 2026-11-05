"""Караоке-баттл, финал: окно с разгоном ~2 с перед первой строчкой, строчки — настоящий текст припева,
время каждого слова — медиана трёх распознаваний (быстрая модель по всей песне, точная кусками, точная с подсказкой-текстом).
python3 kb3.py [slug …]   (Whisper/Demucs — через /opt/aienv)"""
import json, os, re, subprocess, sys, statistics
ROOT = '/home/user/svoya-igra'
SP = '/tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad'
sys.path.insert(0, ROOT + '/_work/tools')
sys.path.insert(0, SP + '/tools')
import restore_audio as RA  # noqa: E402
import kb_align as KA  # noqa: E402

AP = ROOT + '/_work/audio/karbattle.json'
CP = ROOT + '/_work/content/karbattle.json'
SONGS = [  # slug, артист, песня, soundcloud id, начало, длина, строчки
    ('batareyka', 'Жуки', 'Батарейка', '255564238', 65.4, 27.0,
     ['Но несмотря ни на что,', 'Пришла судьба-злодейка,', 'И у любви у нашей', 'Села батарейка.',
      'О-уо-ри-я-ри-ё, батарейка,', 'О-уо-ри-я-ри-ё, батарейка.']),
    ('polkovnik', 'Би-2', 'Полковнику никто не пишет', '540584586', 60.48, 23.0,
     ['Полковнику никто не пишет,', 'Полковника никто не ждёт.']),
    ('lesnik', 'Король и Шут', 'Лесник', '501572934', 111.84, 23.0,
     ['Будь как дома, путник,', 'я ни в чём не откажу,', 'Я ни в чём не откажу,', 'я ни в чём не откажу!',
      'Множество историй,', 'коль желаешь, расскажу,', 'Коль желаешь, расскажу,', 'коль желаешь, расскажу!']),
    ('hophey', 'Леонид Агутин', 'Хоп хей лала лей', '369087485', 181.5, 23.0,
     ['Хоп, хэй, лай-ла-лэй,', 'где вопросы, где ответ?', 'Хоп, хэй, лай-ла-лэй,', 'что ни говори.',
      'Хоп, хэй, лай-ла-лэй,', 'то ли верить, то ли нет,', 'Хоп, хэй, лай-ла-лэй,', 'но Бог тебя хранит.',
      'Хоп, хэй, лай-ла-лэй!', 'Хоп, хэй, лай-ла-лэй!']),
    ('vladivostok', 'Мумий Тролль', 'Владивосток 2000', '8333036', 78.0, 23.0,
     ['Где рельсы вылезали из кармана страны.', 'Уходим, уходим, уходим,', 'Наступят времена почище.',
      'Бьётся родная, в экстазе пылая,', 'Владивосток две тыщи.', 'Уходим, уходим, уходим,', 'Наступят времена почище.']),
    ('vyhoda', 'Сплин', 'Выхода нет', '693332587', 99.76, 23.0,
     ['Лишь бы мы проснулись в одной постели.', 'Скоро рассвет, выхода нет,', 'Ключ поверни — и полетели.',
      'Нужно писать в чью-то тетрадь', 'Кровью, как в метрополитене:', '«Выхода нет».']),
    ('kroshka', 'Руки Вверх', 'Крошка моя', '713643979', 58.0, 23.0,
     ['Крошка моя, я по тебе скучаю,', 'Я от тебя письма не получаю,', 'Ты далеко и даже не скучаешь,',
      'Но я вернусь, вернусь, и ты узнаешь…', 'Что я далеко, я по тебе скучаю,', 'Я от тебя письма не получаю,',
      'Ты далеко и даже не скучала,']),
]


def whisper_prompt(voc, text, out):
    code = f"""
import json, wave, subprocess, numpy as np
from faster_whisper import WhisperModel
subprocess.run(['ffmpeg','-v','error','-y','-i',{voc!r},'-ac','1','-ar','16000',{out + '.wav'!r}],check=True)
w=wave.open({out + '.wav'!r}); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(np.float32)/32768
m=WhisperModel('large-v3',device='cpu',compute_type='int8',cpu_threads=4,download_root='/opt/models/whisper')
segs,_=m.transcribe(a,language='ru',word_timestamps=True,vad_filter=False,condition_on_previous_text=False,initial_prompt={text!r},
    beam_size=5,no_speech_threshold=0.95,log_prob_threshold=-3.0,compression_ratio_threshold=3.0)
json.dump([[x.word.strip(),round(x.start,2),round(x.end,2),round(x.probability,2)] for s in segs for x in (s.words or []) if x.word.strip()],open({out!r},'w'),ensure_ascii=False)
"""
    subprocess.run(['/opt/aienv/bin/python', '-c', code], check=True, stderr=subprocess.DEVNULL)


def times_by_source(lines, words):
    """{(строчка, слово): время} по одному распознаванию"""
    res, _ = KA.align(lines, words)
    out = {}
    # KA.align режет длинные строчки — восстанавливаем номера по порядку слов
    flat = [(li, ti) for li, l in enumerate(lines) for ti in range(len(l.split()))]
    toks = [t for toks, _ in res for t in toks]
    ts = [x for _, tt in res for x in tt]
    if not toks:
        return out
    # первый токен результата — ищем его место в тексте (результат — подряд идущий кусок)
    allt = [t for l in lines for t in l.split()]
    for st in range(len(allt) - len(toks) + 1):
        if allt[st:st + len(toks)] == toks:
            for k, x in enumerate(ts):
                out[flat[st + k]] = x
            break
    return out


def main():
    only = [a for a in sys.argv[1:] if not a.startswith('-')]
    reg = json.load(open(AP)) if os.path.exists(AP) else []
    songs = json.load(open(CP)) if os.path.exists(CP) else []
    for slug, artist, title, tid, s0, LEN, lines in SONGS:
        if only and slug not in only:
            continue
        f = f'media/music/karbattle/{slug}.mp3'
        url = f'https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A{tid}'
        src = RA.fetch(url)
        raw = f'{SP}/kb/{slug}_cut3.wav'
        RA.ff(['-ss', str(s0), '-t', str(LEN), '-i', src, '-vn', '-ac', '2', '-ar', '44100', raw])
        lufs = subprocess.run(['ffmpeg', '-v', 'info', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True).stderr.decode('utf-8', 'ignore')
        m = re.findall(r'I:\s+(-?[\d.]+) LUFS', lufs)
        g = round(max(-12, min(12, -15 - float(m[-1]))), 1) if m else 0
        e = {'file': f, 'source': url, 'title': f'{artist} — «{title}», припев для караоке-баттла (музыка + тихий голос)', 'cut': [s0, round(s0 + LEN, 2)],
             'demucs': 'guide', 'guide_db': -13, 'ffmpeg': f'volume={g}dB,afade=t=in:d=0.4,afade=t=out:st={LEN - 1.0:.2f}:d=1.0,alimiter=limit=0.89:attack=3:release=40'}
        out = ROOT + '/_private/' + f
        os.makedirs(os.path.dirname(out), exist_ok=True)
        RA.make(e, out)
        import tempfile
        voc, _ = RA.separate(raw, tempfile.mkdtemp())
        # три распознавания
        fine_p = f'{SP}/kb/{slug}_cut3_chunks.json'
        if not os.path.exists(fine_p):
            subprocess.run(['/opt/aienv/bin/python', SP + '/tools/asr_chunks.py', raw, 'ru', fine_p], check=True, capture_output=True)
        pr_p = f'{SP}/kb/{slug}_cut3_prompt.json'
        if not os.path.exists(pr_p):
            whisper_prompt(voc, ' '.join(lines), pr_p)
        ok = lambda w: KA.norm(w[0]) and not KA.HALLU.search(w[0]) and w[3] >= 0.2 and w[2] <= LEN - 0.3
        src_words = {
            'быстрая': [[w[0], round(w[1] - s0, 2), round(w[2] - s0, 2), w[3]] for w in json.load(open(f'{SP}/kb/{slug}_mix.json')) if s0 - 0.3 <= w[1] < s0 + LEN and ok([w[0], 0, w[2] - s0, w[3]])],
            'точная': [w for w in json.load(open(fine_p)) if ok(w)],
            'подсказка': [w for w in json.load(open(pr_p)) if ok(w)],
        }
        per = {k: times_by_source(lines, ws) for k, ws in src_words.items()}
        kar, prev_end, stat = [], 0.0, {k: len(v) for k, v in per.items()}
        allw = [(li, ti) for li, l in enumerate(lines) for ti in range(len(l.split()))]
        T = {}
        for key in allw:
            vals = {k: v[key] for k, v in per.items() if key in v and v[key] > 0.15}   # 0.0 — «прилипание» к началу куска
            if len(vals) >= 3:
                T[key] = statistics.median(vals.values())
            elif len(vals) == 2:
                a_, b_ = vals.values()
                T[key] = (a_ + b_) / 2 if abs(a_ - b_) <= 0.7 else next(v for k, v in vals.items() if k != 'быстрая')
            elif vals:
                T[key] = next(iter(vals.values()))
        known = [k for k in allw if k in T]
        if not known:
            print(slug, 'ничего не совпало'); continue
        first, last = allw.index(known[0]), allw.index(known[-1])
        # строчки, начатые до окна, и хвост после последнего спетого слова — убираем
        if allw[first][1] != 0:
            first = next((k for k in range(first, len(allw)) if allw[k][1] == 0), first)
        keep = allw[first:last + 1]
        for k, key in enumerate(keep):
            if key not in T:
                lo = next((T[keep[j]] for j in range(k - 1, -1, -1) if keep[j] in T), None)
                hi_j = next((j for j in range(k + 1, len(keep)) if keep[j] in T), None)
                if lo is not None and hi_j is not None:
                    lo_j = max(j for j in range(k) if keep[j] in T)
                    T[key] = T[keep[lo_j]] + (T[keep[hi_j]] - T[keep[lo_j]]) * (k - lo_j) / (hi_j - lo_j)
                elif lo is not None:
                    T[key] = lo + 0.3
                else:
                    T[key] = T[keep[hi_j]] - 0.25 * (hi_j - k)
        # обрезанная последняя строчка: досчитываем по такой же строчке выше (или по шагу слов), пока не кончилось окно
        lastl = keep[-1][0]; ntok = len(lines[lastl].split()); have = [k for k in keep if k[0] == lastl]
        if len(have) < ntok:
            same = next((li for li in range(lastl) if KA.letters(lines[li]) == KA.letters(lines[lastl]) and all((li, t) in T for t in range(ntok))), None)
            t0 = T[have[0]]
            for t in range(len(have), ntok):
                if same is not None:
                    tt = t0 + T[(same, t)] - T[(same, 0)]
                else:
                    tt = T[(lastl, t - 1)] + 0.5
                if tt >= LEN - 1.0:
                    break
                T[(lastl, t)] = tt; keep.append((lastl, t))
        # строчка, которая начинается в последние 1,5 с, — уже не успеть
        while keep and (keep[-1][0], 0) in T and T[(keep[-1][0], 0)] >= LEN - 1.5:
            li = keep[-1][0]; keep = [k for k in keep if k[0] != li]
        # время слов — строго по порядку по всей песне
        for k in range(1, len(keep)):
            T[keep[k]] = max(T[keep[k]], T[keep[k - 1]] + 0.1)
        cur = None
        for key in keep:
            li, ti = key
            if cur is None or cur[0] != li:
                if cur:
                    kar.append(cur)
                cur = [li, [], []]
            cur[1].append(lines[li].split()[ti]); cur[2].append(T[key])
        kar.append(cur)
        res = []
        for li, toks, ts in kar:
            st = round(max(ts[0] - 0.5, prev_end, 0), 2)
            res.append([st, ' '.join(toks), [round(t, 2) for t in ts]])
            prev_end = ts[-1]
        reg = [x for x in reg if x['file'] != f] + [e]
        songs = [x for x in songs if x['audio'] != f] + [{'artist': artist, 'title': title, 'audio': f, 'len': LEN, 'kar': res}]
        order = [s[0] for s in SONGS]
        key_of = lambda p: order.index(p.split('/')[-1][:-4]) if p.split('/')[-1][:-4] in order else 99
        songs.sort(key=lambda x: key_of(x['audio'])); reg.sort(key=lambda x: key_of(x['file']))
        json.dump(reg, open(AP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(songs, open(CP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(f'{slug}: окно {s0}–{s0 + LEN:.1f}, слов по источникам {stat}, строчек {len(res)}/{len(lines)}, '
              f'первое слово {res[0][2][0]} с, последнее {res[-1][2][-1]} с', flush=True)


if __name__ == '__main__':
    main()
