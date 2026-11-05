#!/usr/bin/env python3
"""Эпичные представления раундов и финала + демонический смех дьявола.
python3 _work/tools/voice2.py [r1 r2 r3 final devillaugh]   (без имён — все)

Голос — нейроголос Microsoft (edge-tts, ru-RU-DmitryNeural) по фразам; ниже на ~2 полутона без «бурундучного» эффекта
(rubberband с сохранением формант), компрессия, тёплый EQ и реверберация зала (свёртка с синтетическим IR).
Под голосом — настоящая трейлерная музыка без авторских отчислений (SoundCloud, авторы — в _work/voice2.json),
голос «продавливает» музыку (sidechain), в конце — музыка раскрывается. Финал — как ведущий боёв: рёв трибун,
растянутое «Встреча-а-айте…». Смех — глубокий смех + тот же на квинту ниже + гул и огромный зал.
Нужен интернет (edge-tts, SoundCloud, myinstants) — через $HTTPS_PROXY. Готовое — media/voice/*.mp3 и media/sfx/devillaugh.mp3."""
import json, os, re, subprocess, sys, tempfile, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import restore_audio as RA  # noqa: E402

SR = 48000
CFG = json.load(open(os.path.join(ROOT, '_work', 'voice2.json'), encoding='utf-8'))
TMP = tempfile.mkdtemp(prefix='voice2_')


def ff(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True, env=RA.proxy_env())


def dur(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout)


def read(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def write_wav(a, p, ch=1):
    t = p + '.f32'
    a.astype(np.float32).tofile(t)
    ff(['-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', t, p])
    os.remove(t)


def ir(seconds, dark=0.5, seed=1):
    """Синтетический импульсный отклик зала: шум с экспоненциальным спадом, стерео, «тёмный»."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    env = np.exp(-t / (seconds / 5.5))
    out = []
    for c in range(2):
        x = rng.standard_normal(n) * env
        k = max(1, int(dark * 40))
        x = np.convolve(x, np.ones(k) / k, 'same')
        x[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))  # предзадержка
        out.append(x / np.abs(x).max())
    p = os.path.join(TMP, f'ir_{seconds}_{dark}.wav')
    write_wav(np.stack(out, 1).reshape(-1), p, 2)
    return p


def tts_phrase(text, path):
    for attempt in range(25):
        r = subprocess.run(['/opt/aienv/bin/edge-tts', '--proxy', os.environ.get('HTTPS_PROXY', ''), '--voice', 'ru-RU-DmitryNeural',
                            '--text', text, '--write-media', path], capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 1000:
            return
        time.sleep(3)
    sys.exit(f'TTS не получился: {text[:40]}… {r.stderr[-200:]}')


def voice(spec, name):
    """Фразы по отдельности → обработка → склейка с паузами. '|' в тексте — длинная пауза, '~' в начале фразы — растянуть (как ведущий боёв)."""
    chunks, out = [p.strip() for p in spec['text'].split('|') if p.strip()], []
    pitch = 2 ** (spec.get('semi', -2) / 12)
    tempo = spec.get('tempo', 0.95)
    for i, ch in enumerate(chunks):
        stretch = ch.startswith('~')
        ch = ch.lstrip('~').strip()
        raw = os.path.join(TMP, f'{name}_{i}.mp3')
        tts_phrase(ch, raw)
        wav = os.path.join(TMP, f'{name}_{i}.wav')
        t = tempo * (0.62 if stretch else 1.0)
        ff(['-i', raw, '-af', f'aresample={SR},silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
            f'rubberband=pitch={pitch:.4f}:tempo={t:.4f}:formant=preserved:transients=smooth', '-ac', '1', wav])
        out.append(wav)
    lst = os.path.join(TMP, f'{name}_list.txt')
    with open(lst, 'w') as fh:
        for i, w in enumerate(out):
            fh.write(f"file '{w}'\n")
            if i + 1 < len(out):
                gap = os.path.join(TMP, f'gap_{i}.wav')
                g = spec.get('gap', 0.45) * (1.6 if i == len(out) - 2 else 1)
                ff(['-f', 'lavfi', '-i', f'anullsrc=r={SR}:cl=mono', '-t', f'{g:.2f}', gap])
                fh.write(f"file '{gap}'\n")
    dry = os.path.join(TMP, f'{name}_dry.wav')
    ff(['-f', 'concat', '-safe', '0', '-i', lst, '-af',
        'highpass=f=70,equalizer=f=140:t=q:w=1:g=4,equalizer=f=320:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.4:g=3,'
        'acompressor=threshold=-20dB:ratio=4:attack=4:release=140:makeup=5,alimiter=limit=0.9', '-ac', '1', dry])
    # зал: свёртка с синтетическим откликом, смешиваем с сухим
    room = ir(spec.get('room', 1.6), spec.get('dark', 0.5))
    wet = os.path.join(TMP, f'{name}_wet.wav')
    ff(['-i', dry, '-i', room, '-filter_complex', '[0:a]aformat=channel_layouts=stereo[d];[d][1:a]afir=dry=10:wet=10', '-ac', '2', wet])
    v = os.path.join(TMP, f'{name}_voice.wav')
    wm = spec.get('wet', 0.22)
    ff(['-i', dry, '-i', wet, '-filter_complex',
        f'[0:a]aformat=channel_layouts=stereo,volume=1[a];[1:a]volume={wm}[b];[a][b]amix=inputs=2:normalize=0,alimiter=limit=0.95', '-ac', '2', v])
    return v


def music_bed(spec, length):
    src = RA.fetch(spec['music'])
    a = read(src)
    hop = SR // 4
    rms = np.array([np.sqrt(np.mean(a[i:i + hop] ** 2)) for i in range(0, len(a) - hop, hop)])
    if spec.get('mstart') is not None:
        s0 = float(spec['mstart'])
    else:
        s0 = max(0.0, (int(np.argmax(rms > 0.45 * rms.max())) * hop) / SR - 1.5)
    s0 = min(s0, max(0, len(a) / SR - length - 1))
    bed = os.path.join(TMP, 'bed.wav')
    ff(['-ss', f'{s0:.2f}', '-t', f'{length:.2f}', '-i', src, '-af',
        f'aresample={SR},afade=t=in:d=0.6,afade=t=out:st={length - 3:.2f}:d=3', '-ac', '2', bed])
    return bed, s0


def epic(name, spec):
    v = voice(spec, name)
    lv = dur(v)
    lead, tail = spec.get('lead', 2.2), spec.get('tail', 4.0)
    length = lead + lv + tail
    bed, s0 = music_bed(spec, length)
    layers = ['[0:a]volume=1[m]']
    inputs = ['-i', bed, '-i', v]
    extra = ''
    if spec.get('crowd'):
        inputs += ['-i', RA.fetch(spec['crowd'])]
        extra = f';[2:a]aresample={SR},aformat=channel_layouts=stereo,volume={spec.get("crowd_vol", 0.5)},adelay=0|0,afade=t=out:st=3:d=3[c]'
    d = int(lead * 1000)
    fc = (f'[1:a]adelay={d}|{d},apad=pad_dur={tail}[v];[v]asplit=2[v1][v2];'
          f'[0:a]volume={spec.get("mvol", 0.55)}[m0];[m0][v1]sidechaincompress=threshold=0.04:ratio=7:attack=20:release=450:makeup=1[md]{extra};'
          + ('[md][v2][c]amix=inputs=3:normalize=0' if extra else '[md][v2]amix=inputs=2:normalize=0')
          + ',loudnorm=I=-14:TP=-1.2:LRA=11')
    out = os.path.join(ROOT, 'media', 'voice', f'{name}.mp3')
    ff(inputs + ['-filter_complex', fc, '-ar', '44100', '-ac', '2', '-b:a', '160k', out])
    print(f'{name}: голос {lv:.1f} с, всего {dur(out):.1f} с (музыка с {s0:.1f} с)')


def laugh(spec):
    srcs = [RA.fetch(u) for u in spec['laughs']]
    a = read(srcs[0])
    b = read(os.path.join(TMP, 'l1.wav')) if False else None
    deep = os.path.join(TMP, 'deep.wav')
    ff(['-i', srcs[0], '-af', f'aresample={SR},rubberband=pitch={2 ** (-7 / 12):.4f}:formant=shifted', '-ac', '1', deep])
    mid = os.path.join(TMP, 'mid.wav')
    ff(['-i', srcs[0], '-af', f'aresample={SR},rubberband=pitch={2 ** (-3 / 12):.4f}', '-ac', '1', mid])
    sec = os.path.join(TMP, 'sec.wav')
    ff(['-i', srcs[1], '-af', f'aresample={SR},rubberband=pitch={2 ** (-5 / 12):.4f}:formant=shifted,adelay=350', '-ac', '1', sec])
    L = min(7.0, max(dur(deep), dur(sec)) + 1.5)
    rumble = os.path.join(TMP, 'rumble.wav')
    t = np.arange(int(L * SR)) / SR
    r = np.sin(2 * np.pi * 38 * t) * np.minimum(1, t / 0.6) * np.exp(-t / 2.2) * 0.5 + np.sin(2 * np.pi * 57 * t) * np.exp(-t / 1.2) * 0.2
    write_wav(r, rumble)
    room = ir(3.2, 0.9, seed=7)
    dry = os.path.join(TMP, 'laugh_dry.wav')
    ff(['-i', deep, '-i', mid, '-i', sec, '-i', rumble, '-filter_complex',
        '[0:a]volume=1.0[a];[1:a]volume=0.45[b];[2:a]volume=0.55[c];[3:a]volume=0.9[d];[a][b][c][d]amix=inputs=4:normalize=0:duration=longest,'
        'equalizer=f=90:t=q:w=1:g=5,asoftclip=type=tanh,acompressor=threshold=-18dB:ratio=3:makeup=3', '-ac', '1', dry])
    out = os.path.join(ROOT, 'media', 'sfx', 'devillaugh.mp3')
    ff(['-i', dry, '-i', room, '-filter_complex',
        '[0:a]aformat=channel_layouts=stereo[d];[d]asplit=2[d1][d2];[d2][1:a]afir=dry=10:wet=10[w];[w]volume=0.5[w2];[d1][w2]amix=inputs=2:normalize=0,'
        f'afade=t=out:st={L - 1.2:.2f}:d=1.2,loudnorm=I=-13:TP=-1', '-ar', '44100', '-ac', '2', '-b:a', '160k', out])
    print(f'devillaugh: {dur(out):.1f} с')


def main():
    names = sys.argv[1:] or list(CFG)
    for n in names:
        spec = CFG[n]
        if n == 'devillaugh':
            laugh(spec)
        else:
            epic(n, spec)


if __name__ == '__main__':
    main()
