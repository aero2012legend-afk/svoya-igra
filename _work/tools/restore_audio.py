#!/usr/bin/env python3
"""Пересоздаёт музыкальные фрагменты пака по спискам _work/audio/*.json в папку _private/.
python3 _work/tools/restore_audio.py [--force] [имя_файла_или_тема ...]

Источник берётся из поля source (SoundCloud, Rutube, Dailymotion — через yt-dlp; прямые ссылки
archive.org — ffmpeg читает нужный кусок сам), вырезается cut, применяется цепочка фильтров из ffmpeg.
Готовые файлы пропускаются (если не --force)."""
import glob, hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = '/tmp/audio_src'
YTDLP = '/opt/aienv/bin/yt-dlp'
ENC = ['-ac', '2', '-ar', '44100', '-b:a', '128k']


def direct(url):
    return bool(re.search(r'\.(mp4|mp3|m4a|ogg|webm|mkv|avi|wav|flac)(\?|$)', url, re.I)) and 'archive.org/download' in url


def fetch(url):
    """Ссылка → путь к скачанному звуку (или сама ссылка, если ffmpeg прочитает её напрямую)."""
    if direct(url):
        return url
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.md5(url.encode()).hexdigest()[:12]
    have = glob.glob(os.path.join(CACHE, key + '.*'))
    if have:
        return have[0]
    subprocess.run([YTDLP, '-q', '--no-playlist', '-f', 'bestaudio/best', '-o', os.path.join(CACHE, key + '.%(ext)s'), url], check=True, env=proxy_env())
    return glob.glob(os.path.join(CACHE, key + '.*'))[0]


def chain(e):
    """Цепочка фильтров после вырезки: берём из поля ffmpeg, если там чистые фильтры."""
    f = (e.get('ffmpeg') or '').strip()
    if '→' in f:
        f = f.split('→')[-1]
    if 'затем' in f:
        f = f.split('затем')[-1]
    f = f.strip(' ;')
    if f and re.fullmatch(r'[a-z0-9_=:.,\-|]+', f, re.I):
        return f
    s, t = e['cut'][0] if isinstance(e['cut'][0], list) else e['cut']
    d = t - s
    return f'afade=t=in:d=0.4,afade=t=out:st={max(0, d - 1.2):.2f}:d=1.2'  # как cut_audio.sh


def proxy_env():
    env = dict(os.environ)
    if env.get('HTTPS_PROXY') and not env.get('http_proxy'):
        env['http_proxy'] = env['HTTPS_PROXY']  # ffmpeg сам не видит HTTPS_PROXY (archive.org, потоки Dailymotion через yt-dlp)
    return env


def ff(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True, env=proxy_env())


def separate(wav, tmp):
    """Demucs: wav → (голос, музыка без голоса). Примерно минута счёта на минуту звука."""
    import tempfile
    od = tempfile.mkdtemp(dir=tmp)
    subprocess.run(['/opt/aienv/bin/python', '-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', od, wav],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    found = {}
    for r, _, fs in os.walk(od):
        for f in fs:
            if f in ('vocals.wav', 'no_vocals.wav'):
                found[f] = os.path.join(r, f)
    return found['vocals.wav'], found['no_vocals.wav']


def make(e, out):
    src = fetch(e['source'])
    cut = e['cut']
    if e.get('demucs'):
        # минус: тот же кусок источника, голос убирает Demucs, потом обычная цепочка фильтров
        import tempfile
        tmp = tempfile.mkdtemp()
        raw = os.path.join(tmp, 'raw.wav')
        ff(['-ss', str(cut[0]), '-t', f'{cut[1] - cut[0]:.3f}', '-i', src, '-vn', '-ac', '2', '-ar', '44100', raw])
        voc, music = separate(raw, tmp)
        return ff(['-i', voc if e['demucs'] == 'vocals' else music, '-af', chain(e)] + ENC + [out])
    if 'source2' in e and 'mario' in e['file']:
        # три звука монетки со сдвигом 0 / 0.25 / 0.5 с (+6 дБ) и первая фраза темы со сдвигом 1.55 с
        coin = fetch(e['source2'])
        fc = ('[0:a]volume=6dB,asplit=3[c1][c2][c3];[c2]adelay=250|250[c2d];[c3]adelay=500|500[c3d];'
              '[1:a]atrim=0:9.6,asetpts=PTS-STARTPTS,adelay=1550|1550[t];'
              f'[c1][c2d][c3d][t]amix=inputs=4:normalize=0:duration=longest,atrim=0:{cut[1]},{chain(e)}')
        return ff(['-i', coin, '-i', src, '-filter_complex', fc] + ENC + [out])
    if isinstance(cut[0], list):
        # склейка нескольких кусков с короткими стыками
        s0, s1 = cut[0][0], cut[-1][1]
        parts, labels = [], []
        for k, (a, b) in enumerate(cut):
            d = b - a
            parts.append(f'[0:a]atrim={a - s0:.3f}:{b - s0:.3f},asetpts=PTS-STARTPTS,'
                         f'afade=t=in:d=0.02,afade=t=out:st={d - 0.02:.3f}:d=0.02[p{k}]')
            labels.append(f'[p{k}]')
        fc = ';'.join(parts) + ';' + ''.join(labels) + f'concat=n={len(cut)}:v=0:a=1,{chain(e)}'
        return ff(['-ss', str(s0), '-t', f'{s1 - s0:.3f}', '-i', src, '-vn', '-filter_complex', fc] + ENC + [out])
    s, t = cut
    ff(['-ss', str(s), '-t', f'{t - s:.3f}', '-i', src, '-vn', '-af', chain(e)] + ENC + [out])


def main():
    force = '--force' in sys.argv
    only = [a for a in sys.argv[1:] if a != '--force']
    ok = bad = skip = 0
    for jf in sorted(glob.glob(os.path.join(ROOT, '_work', 'audio', '*.json'))):
        for e in json.load(open(jf, encoding='utf-8')):
            if e.get('missing') or not e.get('source'):
                continue
            if only and not any(o in e['file'] or o in os.path.basename(jf) for o in only):
                continue
            out = os.path.join(ROOT, '_private', e['file'])
            if os.path.exists(out) and not force:
                skip += 1
                continue
            os.makedirs(os.path.dirname(out), exist_ok=True)
            try:
                make(e, out)
                dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out],
                                     capture_output=True, text=True).stdout.strip()
                print(f'OK   {e["file"]} ({float(dur):.1f} с)')
                ok += 1
            except Exception as ex:
                print(f'FAIL {e["file"]}: {ex}')
                bad += 1
    print(f'Готово: {ok}, пропущено (уже есть): {skip}, не вышло: {bad}')


if __name__ == '__main__':
    main()
