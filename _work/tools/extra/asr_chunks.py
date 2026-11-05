"""Распознавание голоса кусками (12 с с перекрытием 4 с) — Whisper не «проглатывает» половину песни.
/opt/aienv/bin/python asr_chunks.py AUDIO LANG OUT.json"""
import json, os, sys, tempfile, wave
import numpy as np
sys.path.insert(0, '/home/user/svoya-igra/_work/tools')
import restore_audio as RA
src, lang, outp = sys.argv[1:4]
tmp = tempfile.mkdtemp()
wav = os.path.join(tmp, 'full.wav')
RA.ff(['-i', src, '-ac', '2', '-ar', '44100', wav])
voc, _ = RA.separate(wav, tmp)
mono = os.path.join(tmp, 'mono.wav')
RA.ff(['-i', voc, '-ac', '1', '-ar', '16000', mono])
w = wave.open(mono)
a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
from faster_whisper import WhisperModel
m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4, download_root='/opt/models/whisper')
SR, WIN, HOP = 16000, 12.0, 8.0
words, prompt = [], None
t0 = 0.0
total = len(a) / SR
while t0 < total - 1:
    seg = a[int(t0 * SR):int(min(total, t0 + WIN) * SR)]
    segs, _ = m.transcribe(seg, language=lang, word_timestamps=True, vad_filter=False, condition_on_previous_text=False,
                           initial_prompt=prompt, beam_size=5, no_speech_threshold=0.9, log_prob_threshold=-2.0)
    got = [[x.word.strip(), round(x.start + t0, 2), round(x.end + t0, 2), round(x.probability, 2)] for s in segs for x in (s.words or []) if x.word.strip()]
    lo = t0 + (2.0 if t0 > 0 else 0)            # левый край окна — уже взят из прошлого окна
    hi = t0 + WIN - 2.0 if t0 + WIN < total else total + 1
    keep = [g for g in got if lo <= g[1] < hi]
    words += keep
    if keep:
        prompt = ' '.join(g[0] for g in keep[-12:])
    t0 += HOP
words.sort(key=lambda g: g[1])
json.dump(words, open(outp, 'w'), ensure_ascii=False)
print(os.path.basename(src), 'слов', len(words), 'до', words[-1][2] if words else 0)
