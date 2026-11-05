"""Голос из файла (Demucs, с кэшем) → Whisper large-v3 со временем слов → JSON [[слово, начало, конец, уверенность], …].
/opt/aienv/bin/python asr_file.py AUDIO LANG OUT.json [prompt]"""
import json, os, sys, tempfile, wave
import numpy as np
sys.path.insert(0, '/home/user/svoya-igra/_work/tools')
import restore_audio as RA
src, lang, outp = sys.argv[1:4]
prompt = sys.argv[4] if len(sys.argv) > 4 else None
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
segs, _ = m.transcribe(a, language=lang, word_timestamps=True, vad_filter=False, initial_prompt=prompt, condition_on_previous_text=False, beam_size=5)
words = [[x.word.strip(), round(x.start, 2), round(x.end, 2), round(x.probability, 2)] for s in segs for x in (s.words or []) if x.word.strip()]
json.dump(words, open(outp, 'w'), ensure_ascii=False)
print(os.path.basename(src), 'слов', len(words))
