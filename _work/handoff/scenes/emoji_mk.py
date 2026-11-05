"""«Эмодзи-шифровка»: строка эмодзи + тип (фильм/песня/мультфильм) → webp."""
import subprocess
OUT = '/home/user/svoya-igra/media/img/emoji'
E = [(300, 'frozen', 'МУЛЬТФИЛЬМ', '❄️👸⛄'), (600, 'charlie', 'ФИЛЬМ', '🍫🏭🎫🎩'), (900, 'vino', 'ПЕСНЯ', '🌸🍷'),
     (1200, 'milya', 'ФИЛЬМ', '🟢🛣️🐁⚡️🪑'), (1500, 'element', 'ФИЛЬМ', '🔥💧🌍💨👩‍🦰'),
     (1800, 'rozy', 'ПЕСНЯ', '🌹🌹🌹👨‍🎨🏠'), (2100, 'yabloki', 'ПЕСНЯ', '🍎🍎❄️'), (2400, 'golubi', 'ФИЛЬМ', '❤️🕊️🕊️🌴'),
     (2700, 'kukla', 'ПЕСНЯ', '🪆🧙‍♂️🔮🌲'), (3000, 'pyos', 'МУЛЬТФИЛЬМ', '🐶🐺🍗🎤')]
CSS = """html,body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:'DejaVu Sans',sans-serif}
body{background:radial-gradient(circle at 50% 45%,#fff6d8,#ffd9a8 70%,#f7b98b);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px}
.tag{font-weight:900;font-size:44px;letter-spacing:.12em;color:#fff;background:#3a2b7a;padding:10px 34px;border-radius:999px;box-shadow:0 6px 0 rgba(0,0,0,.18)}
.em{font-size:SIZEpx;white-space:nowrap;line-height:1.1;filter:drop-shadow(0 10px 8px rgba(0,0,0,.18))}"""
for pr, name, tag, em in E:
    n = len([c for c in em if ord(c) > 0x2000 and c not in '‍️'])
    size = 230 if n <= 3 else (190 if n <= 4 else 150)
    page = f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS.replace("SIZE", str(size))}</style></head><body><div class="tag">{tag}</div><div class="em">{em}</div></body></html>'
    open(f'emoji_{name}.html', 'w').write(page)
    subprocess.run(['node', '/home/user/svoya-igra/_work/tools/render.mjs', f'emoji_{name}.html', f'{OUT}/r3_{pr}_{name}.webp', '1280', '720'], check=True, capture_output=True)
print('ok')
