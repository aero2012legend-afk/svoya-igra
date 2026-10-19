#!/usr/bin/env python3
"""Сервер генерации картинок (SD-Turbo на CPU). Держит модель в памяти и берёт задания из /opt/sdq/jobs/*.json.
Запуск: /opt/aienv/bin/python _work/tools/sd_server.py  (в фоне)"""
import json, os, time, glob, traceback, torch
from diffusers import AutoPipelineForText2Image
torch.set_num_threads(4)
pipe = AutoPipelineForText2Image.from_pretrained('stabilityai/sd-turbo', cache_dir='/opt/models', torch_dtype=torch.float32)
pipe.set_progress_bar_config(disable=True)
print('SD ready', flush=True)
while True:
    jobs = sorted(glob.glob('/opt/sdq/jobs/*.json'), key=os.path.getmtime)
    if not jobs:
        time.sleep(1); continue
    j = jobs[0]
    try:
        d = json.load(open(j))
        outs = []
        for k in range(int(d.get('n', 1))):
            seed = int(d.get('seed', 0)) + k
            g = torch.Generator().manual_seed(seed)
            im = pipe(prompt=d['prompt'], negative_prompt=d.get('neg') or None, num_inference_steps=int(d.get('steps', 2)), guidance_scale=0.0,
                      width=int(d.get('w', 512)), height=int(d.get('h', 512)), generator=g).images[0]
            p = f"{d['out']}_{k + 1}.png"; os.makedirs(os.path.dirname(p) or '.', exist_ok=True); im.save(p); outs.append(p)
        json.dump({'ok': True, 'files': outs}, open(j[:-5] + '.done', 'w'))
    except Exception as e:
        json.dump({'ok': False, 'error': traceback.format_exc()}, open(j[:-5] + '.done', 'w'))
    os.remove(j)
