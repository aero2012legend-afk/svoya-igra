#!/usr/bin/env python3
"""Мягкие звуки интерфейса — свой тембр в каждом раунде — и смягчение остальных эффектов.
python3 _work/tools/sfx.py synth   — пересоздать media/sfx/{select,open,buzz,correct,wrong,flip}.mp3 (раунд 1)
                                     и варианты *_r2.mp3 / *_r3.mp3 (раунды 2 и 3)
python3 _work/tools/sfx.py soften  — пропустить яркие эффекты через мягкий фильтр (оригиналы — в git-истории)
Раунд 1 — тёплая маримба, раунд 2 — стеклянный вибрафон, раунд 3 — глубокие синтезаторные «колокола»."""
import os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SFX = os.path.join(ROOT, 'media', 'sfx')
SR = 44100
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, a=0.004, d=0.5):
    t = t_(dur)
    return np.minimum(1, t / max(1e-4, a)) * np.exp(-t / d)


def tone(f, dur, kind, a=0.004, d=0.45):
    t = t_(dur)
    if kind == 'marimba':      # основной тон + 4-й и 10-й обертоны, быстро гаснут
        s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05) + 0.05 * np.sin(2 * np.pi * 9.9 * f * t) * np.exp(-t / 0.02)
    elif kind == 'vibes':      # вибрафон: чистый тон с тремоло
        s = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 3.9 * f * t) * np.exp(-t / 0.12)) * (0.8 + 0.2 * np.sin(2 * np.pi * 5.5 * t))
    elif kind == 'bell':       # мягкий «колокол»: негармонические обертоны, медленная атака
        s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.25) + 0.15 * np.sin(2 * np.pi * 5.4 * f * t) * np.exp(-t / 0.1)
        a = max(a, 0.012)
    else:
        s = np.sin(2 * np.pi * f * t)
    return s * env(dur, a, d)


def seq(notes, kind, step, dur=0.9, d=0.45, gains=None):
    total = step * (len(notes) - 1) + dur
    out = np.zeros(int(total * SR) + 1)
    for k, f in enumerate(notes):
        x = tone(f, dur, kind, d=d) * (gains[k] if gains else 1)
        i = int(k * step * SR); out[i:i + len(x)] += x
    return out


def sweep(f0, f1, dur, kind='sine', d=0.25):
    t = t_(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + (0.2 * np.sin(2 * ph) if kind != 'sine' else 0)
    return s * env(dur, 0.008, d)


def reverb(x, size=0.6, mix=0.22):
    n = int(size * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (size / 4))
    ir = np.convolve(ir, np.ones(30) / 30, 'same')          # тёмный хвост (короткое ядро — быстро)
    L = len(x) + n; nfft = 1 << (L - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:L]   # свёртка через FFT — в сотни раз быстрее
    wet = wet / max(1e-9, np.abs(wet).max()) * np.abs(x).max()
    out = np.zeros(len(wet)); out[:len(x)] += x
    return out * (1 - mix) + wet * mix


def soft_click(dur=0.05, f=900):
    t = t_(dur)
    n = np.convolve(rng.standard_normal(len(t)), np.ones(12) / 12, 'same')
    return (n * 0.5 + np.sin(2 * np.pi * f * t)) * np.exp(-t / 0.012)


def swell(b, dur=1.3):
    t = t_(dur)
    ch = sum(np.sin(2 * np.pi * n(b + d) * t) * w for d, w in ((0, 1.0), (4, 0.7), (7, 0.8), (12, 0.45))) / 3
    env_ = (1 - np.exp(-t / 0.18)) * np.exp(-t / 0.42)
    air = np.convolve(rng.standard_normal(len(t)), np.ones(40) / 40, 'same') * (1 - np.exp(-t / 0.25)) * np.exp(-t / 0.3) * 0.35
    return ch * env_ + air


def mix(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[:len(x)] += x
    return out


def save(x, name, peak_db=-6.0):
    x = x / max(1e-9, np.abs(x).max()) * 10 ** (peak_db / 20)
    fade = int(0.03 * SR)
    if len(x) > fade * 2:
        x[-fade:] *= np.linspace(1, 0, fade)
    tmp = os.path.join(SFX, name + '.f32')
    x.astype(np.float32).tofile(tmp)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', tmp,
                    '-af', 'lowpass=f=7000', '-ac', '2', '-b:a', '128k', os.path.join(SFX, name + '.mp3')], check=True)
    os.remove(tmp)
    print('  ', name)


# ноты
def n(midi):
    return 440 * 2 ** ((midi - 69) / 12)


SETS = {
    '': {'kind': 'marimba', 'base': 72},     # раунд 1 — до мажор, маримба
    '_r2': {'kind': 'vibes', 'base': 69},    # раунд 2 — ля, вибрафон
    '_r3': {'kind': 'bell', 'base': 64},     # раунд 3 — ми, «колокола» ниже
}


def synth(only=None):
    for suf, S in SETS.items():
        k, b = S['kind'], S['base']
        # выбор клетки — короткое мягкое «ток»
        save(reverb(mix(tone(n(b + 7), 0.35, k, d=0.08) * 0.8, soft_click() * 0.15), 0.4, 0.15), 'select' + suf, -9)
        # вопрос открыт, можно жать — мягкий «вдох»: аккорд плавно нарастает и тает, без ударной атаки (не «звонок в дверь»)
        save(reverb(swell(b), 0.8, 0.3), 'open' + suf, -12)
        # кто-то нажал кнопку — мягкое «буп» вверх
        save(reverb(mix(sweep(n(b - 5), n(b + 4), 0.32, 'tri', 0.18), tone(n(b + 4), 0.5, k, d=0.15) * 0.5), 0.5, 0.18), 'buzz' + suf, -7)
        # верно — мажорное арпеджио
        save(reverb(seq([n(b), n(b + 4), n(b + 7), n(b + 12)], k, 0.09, 1.4, 0.5, [0.8, 0.85, 0.9, 1.0]), 0.9, 0.28), 'correct' + suf, -6)
        # неверно — две низкие ноты вниз, без «зуммера»
        save(reverb(seq([n(b - 8), n(b - 13)], 'marimba' if k == 'marimba' else k, 0.22, 0.8, 0.35), 0.6, 0.2), 'wrong' + suf, -6)
        # переворот клетки — мягкий «шорох» + низкий стук
        t = t_(0.35)
        sh = np.convolve(rng.standard_normal(len(t)), np.ones(60) / 60, 'same') * np.sin(np.pi * t / 0.35) ** 2
        save(mix(sh * 0.6, tone(n(b - 24), 0.35, 'sine', a=0.01, d=0.07) * 0.8), 'flip' + suf, -14)


# яркие файлы, которые смягчаем фильтром (центр спектра выше ~3 кГц)
SOFTEN = ['rimshot', 'coin', 'strike', 'bribe', 'pop', 'drumroll', 'bid', 'roll', 'land', 'fanfare', 'auction', 'freeze',
          'go', 'applause', 'medal', 'bonus', 'tada', 'results', 'round', 'win', 'beep', 'horn', 'timeout', 'join', 'whoosh', 'tick']


def soften():
    for name in SOFTEN:
        f = os.path.join(SFX, name + '.mp3')
        if not os.path.exists(f):
            continue
        tmp = f + '.tmp.mp3'
        # срезаем верх (звон и шипение), чуть смягчаем атаку, громкость — на 3 дБ ниже
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-af',
                        'highshelf=f=3000:g=-6,lowpass=f=6500,afade=t=in:d=0.006,volume=-3dB,alimiter=limit=0.8',
                        '-ac', '2', '-b:a', '128k', tmp], check=True)
        os.replace(tmp, f)
        print('  смягчён', name)


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    if what == 'synth':
        synth()
    elif what == 'soften':
        soften()
    else:
        print(__doc__)
