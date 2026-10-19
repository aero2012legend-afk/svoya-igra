#!/usr/bin/env python3
"""Нарисовать картинку нейросетью (SD-Turbo). Ставит задание в очередь общего сервера и ждёт результат.
python3 sd.py "english prompt" OUT_PREFIX [N=4] [W=512] [H=512] [SEED=random] [STEPS=2]
Получишь OUT_PREFIX_1.png ... и OUT_PREFIX_sheet.jpg (пронумерованные превью для просмотра через Read).
Промпт пиши по-английски. Генерация ~20 с на картинку, очередь общая на всех — не заказывай больше 6 за раз."""
import sys, json, os, time, random, uuid
from PIL import Image, ImageDraw, ImageFont
prompt, out = sys.argv[1], os.path.abspath(sys.argv[2])
n = int(sys.argv[3]) if len(sys.argv) > 3 else 4
w = int(sys.argv[4]) if len(sys.argv) > 4 else 512
h = int(sys.argv[5]) if len(sys.argv) > 5 else 512
seed = int(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] != 'random' else random.randint(1, 10**8)
steps = int(sys.argv[7]) if len(sys.argv) > 7 else 2
jid = '/opt/sdq/jobs/%d_%s' % (int(time.time() * 1000), uuid.uuid4().hex[:6])
json.dump({'prompt': prompt, 'out': out, 'n': n, 'w': w, 'h': h, 'seed': seed, 'steps': steps}, open(jid + '.json.tmp', 'w'))
os.rename(jid + '.json.tmp', jid + '.json')
t0 = time.time()
while not os.path.exists(jid + '.done'):
    time.sleep(2)
    if time.time() - t0 > 3600: print('TIMEOUT'); sys.exit(1)
r = json.load(open(jid + '.done')); os.remove(jid + '.done')
if not r.get('ok'): print(r.get('error')); sys.exit(1)
ims = [Image.open(f) for f in r['files']]
for f in r['files']: print(f)
cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 330, rows * 360), (30, 30, 30)); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
except Exception: font = ImageFont.load_default()
for i, im in enumerate(ims):
    t = im.copy(); t.thumbnail((320, 320)); x, y = (i % cols) * 330 + 5, (i // cols) * 360 + 36
    sheet.paste(t, (x, y)); d.text((x, y - 34), str(i + 1), fill=(255, 220, 0), font=font)
sheet.save(out + '_sheet.jpg', quality=80); print('SHEET', out + '_sheet.jpg', 'seed', seed)
