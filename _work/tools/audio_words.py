#!/usr/bin/env python3
"""Распознать слова песни с точным временем (Whisper medium, можно с отделением голоса Demucs).
/opt/aienv/bin/python audio_words.py SONG.mp3 [FROM_SEC=0] [TO_SEC=all] [--vocals] [--prompt "известный текст песни"]
Печатает строки «время_начала время_конца текст» и по каждому слову «слово@начало-конец» (секунды от начала ФАЙЛА).
--vocals — сначала отделить голос от музыки (медленнее, ~1 мин на минуту звука, но точнее).
--prompt — подскажи Whisper начало текста песни, это сильно повышает точность."""
import sys, os, subprocess, tempfile, wave, json, numpy as np
args = [a for a in sys.argv[1:]]
vocals = '--vocals' in args; args = [a for a in args if a != '--vocals']
prompt = None
if '--prompt' in args:
    i = args.index('--prompt'); prompt = args[i + 1]; del args[i:i + 2]
src = args[0]; fr = float(args[1]) if len(args) > 1 else 0.0; to = float(args[2]) if len(args) > 2 and args[2] != 'all' else None
tmp = tempfile.mkdtemp()
cut = os.path.join(tmp, 'cut.wav')
cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', str(fr)] + (['-t', str(to - fr)] if to else []) + ['-i', src, '-ac', '2', '-ar', '44100', cut]
subprocess.run(cmd, check=True)
wav = cut
if vocals:
    subprocess.run(['/opt/aienv/bin/python', '-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', tmp, cut], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for r, _, fs in os.walk(tmp):
        for f in fs:
            if f == 'vocals.wav': wav = os.path.join(r, f)
mono = os.path.join(tmp, 'mono.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '16000', mono], check=True)
w = wave.open(mono); a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
from faster_whisper import WhisperModel
m = WhisperModel('medium', device='cpu', compute_type='int8', cpu_threads=4, download_root='/opt/models/whisper')
segs, info = m.transcribe(a, language='ru' if '--en' not in sys.argv else 'en', word_timestamps=True, vad_filter=False, initial_prompt=prompt, condition_on_previous_text=False)
out = []
for s in segs:
    print(f'{s.start + fr:.2f} {s.end + fr:.2f} {s.text.strip()}')
    print('    ' + ' '.join(f'{x.word.strip()}@{x.start + fr:.2f}-{x.end + fr:.2f}' for x in (s.words or [])))
