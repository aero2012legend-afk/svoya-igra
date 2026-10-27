#!/usr/bin/env python3
"""Музыка для танцевального баттла: находит песни на SoundCloud, вырезает самый энергичный кусок
(по громкости, 40 с), выравнивает громкость и пишет в _private/media/dance/ + список _work/audio/dance.json.
/opt/aienv/bin/python _work/tools/dance.py [номер …]   — без номеров делает все песни из SONGS.
Сами файлы в git не попадают; пересоздать: python3 _work/tools/restore_audio.py dance"""
import json, os, re, subprocess, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import restore_audio as RA  # noqa: E402

LEN = 40.0
# (имя файла, запрос, слова, которые должны быть в названии[, проверенные ссылки — их пробуем первыми])
SONGS = [
    ('rasputin', 'Boney M Rasputin', ['rasputin']),
    ('taet_led', 'Грибы Тает лёд', ['тает', 'taet']),
    ('dragostea', 'O-Zone Dragostea Din Tei', ['dragostea'], ['https://soundcloud.com/ozoneofficial/dragostea-din-tei-1',
                                                              'https://soundcloud.com/gabriele-mueller-986230065/dragostea-din-tei']),
    ('mambo', 'Lou Bega Mambo No 5', ['mambo'], ['https://soundcloud.com/lou-bega-official/mambo-no-5-a-little-861194798',
                                                  'https://soundcloud.com/cleopatra-recs/lou-bega-mambo-no-5-a-little']),
    ('cotton_eye_joe', 'Rednex Cotton Eye Joe', ['cotton']),
    ('uptown_funk', 'Mark Ronson Uptown Funk Bruno Mars', ['uptown']),
    ('party_rock', 'LMFAO Party Rock Anthem', ['party rock']),
    ('saxobeat', 'Alexandra Stan Mr Saxobeat', ['saxobeat']),
    ('skibidi', 'Little Big Skibidi', ['skibidi']),
    ('rozovoe_vino', 'Элджей Feduk Розовое вино', ['розовое', 'rozovoe']),
    ('we_like_to_party', 'Vengaboys We like to party', ['party']),
    ('blue', 'Eiffel 65 Blue Da Ba Dee', ['blue']),
]
BAD = re.compile(r'remix|(?<!original )\bmix\b|edit(?!ion)|cover|karaoke|instrumental|acapella|slowed|speed|sped|nightcore|минус|кавер|ремикс|bass boost|8d|mashup|live|version|rework|bootleg|vip', re.I)


def search(query):
    out = subprocess.run([RA.YTDLP, '--flat-playlist', '--print', '%(title)s\t%(uploader)s\t%(duration)s\t%(webpage_url)s',
                          f'scsearch12:{query}'], capture_output=True, text=True, env=RA.proxy_env()).stdout
    rows = []
    for line in out.splitlines():
        p = line.split('\t')
        if len(p) == 4:
            try:
                rows.append((p[0], p[1], float(p[2]), p[3]))
            except ValueError:
                pass
    return rows


def energy_window(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '11025', '-f', 's16le', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    hop = 5512  # полсекунды
    n = len(a) // hop
    rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    dur = n / 2
    w = int(LEN * 2)
    lo, hi = int(15 * 2), max(int(15 * 2), n - w - 16)  # без тихого вступления и концовки
    best, bi = -1, lo
    for i in range(lo, hi + 1):
        m = rms[i:i + w].mean()
        if m > best:
            best, bi = m, i
    return bi / 2, dur


def lufs(path):
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr)
    return float(m[-1]) if m else -14.0


def main():
    only = [int(x) for x in sys.argv[1:]]
    reg_p = os.path.join(ROOT, '_work', 'audio', 'dance.json')
    reg = json.load(open(reg_p, encoding='utf-8')) if os.path.exists(reg_p) else []
    for k, (name, query, words, *urls) in enumerate(SONGS, 1):
        if only and k not in only:
            continue
        rows = [(name, '', 0, u) for u in (urls[0] if urls else [])]
        rows += [r for r in search(query) if r[2] >= 140 and not BAD.search(r[0]) and any(w in r[0].lower() for w in words)]
        if not rows:
            print(f'{k:2d} {name}: не нашлось полной версии')
            continue
        src = None
        for title, up, dur, url in rows[:6]:
            try:
                src = RA.fetch(url)
                break
            except Exception:
                continue  # трек под DRM или недоступен — следующий
        if not src:
            print(f'{k:2d} {name}: не скачалось')
            continue
        start, real = energy_window(src)
        tmp = tempfile.mkdtemp()
        cut = os.path.join(tmp, 'cut.wav')
        RA.ff(['-ss', f'{start:.2f}', '-t', str(LEN), '-i', src, '-vn', '-ac', '2', '-ar', '44100', cut])
        gain = round(max(-12.0, min(12.0, -14.0 - lufs(cut))), 1)
        chain = f'volume={gain}dB,afade=t=in:d=0.4,afade=t=out:st={LEN - 1.5:.1f}:d=1.5,alimiter=limit=0.9:attack=3:release=40'
        rel = f'media/dance/{k:02d}_{name}.mp3'
        out = os.path.join(ROOT, '_private', rel)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        RA.ff(['-i', cut, '-af', chain] + RA.ENC + [out])
        reg = [e for e in reg if e['file'] != rel] + [{'file': rel, 'source': url, 'title': f'{title} ({up})',
                                                       'cut': [round(start, 2), round(start + LEN, 2)], 'gain_db': gain, 'ffmpeg': chain}]
        reg.sort(key=lambda e: e['file'])
        with open(reg_p, 'w', encoding='utf-8') as f:
            json.dump(reg, f, ensure_ascii=False, indent=1)
            f.write('\n')
        print(f'{k:2d} {name}: «{title}» — {up}, {real:.0f} с, кусок с {start:.0f} с, громкость {gain:+} дБ')


if __name__ == '__main__':
    main()
