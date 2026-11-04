#!/usr/bin/env python3
"""Голосовые представления раундов и финала + зловещий смех дьявола (нейроголос Microsoft через edge-tts).
/opt/aienv/bin/python _work/tools/voice.py [имя …]   — пересоздать media/voice/<имя>.mp3 (без имён — все).
Тексты — в _work/voice.json: {"r1": {"text": "...", "rate": "-8%", "pitch": "-6Hz", "style": "epic"}, ...}.
Стиль epic — голос с эхом зала поверх низкого гула и ударов; arena — как ведущий боёв (большое эхо и рёв зала);
laugh — смех ниже и с эхом. Нужен интернет (edge-tts идёт через $HTTPS_PROXY)."""
import json, os, subprocess, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'media', 'voice')
SR = 44100


def ff(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)


def tts(text, path, voice='ru-RU-DmitryNeural', rate='-6%', pitch='-4Hz'):
    """Сервис капризничает (через раз «No audio»), особенно на длинном тексте: синтезируем по фразам с повторами и склеиваем."""
    import re, time
    parts = [p.strip() for p in re.split(r'(?<=[.!?…])\s+', text) if p.strip()]
    tmp = tempfile.mkdtemp(); files = []
    for k, part in enumerate(parts):
        f = os.path.join(tmp, f'p{k}.mp3')
        for attempt in range(25):
            # темп и высоту меняем потом в ffmpeg: с параметрами rate/pitch сервис отказывает чаще
            r = subprocess.run(['/opt/aienv/bin/edge-tts', '--proxy', os.environ.get('HTTPS_PROXY', ''), '--voice', voice,
                                '--text', part, '--write-media', f], capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(f) and os.path.getsize(f) > 1000:
                break
            time.sleep(3)
        else:
            sys.exit(f'TTS не получился на фразе {k + 1}: {r.stderr[-200:]}')
        files.append(f)
    # склейка с паузой 0.25 с между фразами
    lst = os.path.join(tmp, 'list.txt'); sil = os.path.join(tmp, 'sil.mp3')
    ff(['-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.25', '-b:a', '48k', sil])
    with open(lst, 'w') as fh:
        for i, f in enumerate(files):
            fh.write(f"file '{f}'\n")
            if i + 1 < len(files): fh.write(f"file '{sil}'\n")
    tempo = 1 + float(rate.rstrip('%')) / 100
    semi = float(pitch.rstrip('Hz')) / 12            # «-6Hz» ≈ полтона вниз — грубо, но для окраски хватает
    k = 2 ** (semi / 12)
    ff(['-f', 'concat', '-safe', '0', '-i', lst, '-af', f'asetrate=24000*{k:.4f},aresample=24000,atempo={tempo / k:.4f}', '-ar', '24000', '-ac', '1', path])


def read(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def write(a, path):
    a = a / max(1e-9, np.abs(a).max()) * 0.89
    tmp = path + '.f32'
    a.astype(np.float32).tofile(tmp)
    ff(['-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', tmp, '-ac', '2', '-b:a', '128k', path])
    os.remove(tmp)


def boom(dur=2.5, f0=70, f1=32):
    t = np.arange(int(dur * SR)) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 3)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    n = np.random.default_rng(1).standard_normal(len(t)) * np.exp(-t * 9) * 0.25
    return (s + np.convolve(n, np.ones(40) / 40, 'same')) * 0.9


def drone(dur):
    t = np.arange(int(dur * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * t + p) * a for f, p, a in ((55, 0, 0.5), (82.4, 1, 0.3), (110, 2, 0.15), (164.8, .5, 0.06)))
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.25 * t)
    env = np.minimum(1, t / 1.5) * np.minimum(1, (dur - t) / 1.5)
    return s * lfo * env * 0.25


def hits(dur, every=4.0):
    out = np.zeros(int(dur * SR))
    for k in np.arange(0.0, dur - 1.0, every):
        b = boom(1.6, 90, 40) * 0.55; i = int(k * SR); out[i:i + len(b)] += b[:len(out) - i]
    return out


def crowd(dur, seed=2):
    rng = np.random.default_rng(seed)
    n = rng.standard_normal(int(dur * SR))
    k = np.ones(300) / 300
    lo = np.convolve(n, k, 'same') * 8                      # гул толпы
    sw = 0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * np.arange(len(n)) / SR + 1)
    env = np.minimum(1, np.arange(len(n)) / SR / 0.8) * np.minimum(1, (dur - np.arange(len(n)) / SR) / 1.2)
    return lo * sw * env * 0.18


def build(name, spec):
    tmp = tempfile.mkdtemp()
    v = os.path.join(tmp, 'v.mp3')
    tts(spec['text'], v, spec.get('voice', 'ru-RU-DmitryNeural'), spec.get('rate', '-6%'), spec.get('pitch', '-4Hz'))
    style = spec.get('style', 'epic')
    wet = os.path.join(tmp, 'w.wav')
    if style == 'laugh':
        ff(['-i', v, '-af', 'asetrate=44100*0.78,aresample=44100,atempo=1.12,bass=g=6,aecho=0.8:0.85:120|240:0.45|0.3,volume=2', wet])
        write(read(wet), os.path.join(OUT, name + '.mp3')); return
    echo = 'aecho=0.8:0.75:60|140:0.35|0.22' if style == 'epic' else 'aecho=0.8:0.8:90|220|400:0.45|0.32|0.2'
    ff(['-i', v, '-af', f'bass=g=4,{echo},volume=1.6', wet])
    voice = read(wet)
    lead = 1.6
    dur = lead + len(voice) / SR + 2.8
    bed = drone(dur) + hits(dur, 4.0) * (1.0 if style == 'epic' else 0.6)
    if style == 'arena':
        bed += crowd(dur)
    b0 = boom(3.0); bed[:len(b0)] += b0
    end = boom(3.0, 80, 30); i = int((lead + len(voice) / SR + 0.1) * SR); bed[i:i + len(end)] += end[:len(bed) - i]
    mix = bed * 0.55
    j = int(lead * SR); mix[j:j + len(voice)] += voice
    write(mix, os.path.join(OUT, name + '.mp3'))
    print(f'{name}: {dur:.1f} с')


def main():
    spec = json.load(open(os.path.join(ROOT, '_work', 'voice.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    for name, s in spec.items():
        if len(sys.argv) > 1 and name not in sys.argv[1:]:
            continue
        build(name, s)


if __name__ == '__main__':
    main()
