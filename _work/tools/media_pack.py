#!/usr/bin/env python3
"""Медиапак для ведущего: список файлов media/СПИСОК.md и архив с музыкой/видео.
python3 _work/tools/media_pack.py [--zip ПУТЬ.zip]

Список строится из собранного questions.js (что реально звучит в игре) и _work/audio/*.json (откуда взят звук).
Архив собирает файлы из _private/ в структуре media/…: распакуй его и выбери папку в лобби игры
(«📁 Папка с музыкой и видео»)."""
import glob, json, os, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JS = """const fs=require('fs'),vm=require('vm');const c={window:{}};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),c);
const G=c.window.GAME,out=[];G.rounds.forEach((r,ri)=>r.themes.forEach(t=>t.questions.forEach(q=>{for(const k of ['audio','video','minus'])if(q[k])out.push({r:ri+1,theme:t.name,price:q.price,file:q[k],a:q.a||'',k});})));
(G.danceSongs||[]).forEach(f=>out.push({r:0,theme:'Танцевальный баттл',price:'',file:f,a:'',k:'dance'}));
console.log(JSON.stringify(out));"""


def pack_media():
    raw = subprocess.run(['node', '-e', JS, os.path.join(ROOT, 'questions.js')], capture_output=True, text=True, check=True).stdout
    return json.loads(raw)


def main():
    items = pack_media()
    src = {}
    for f in glob.glob(os.path.join(ROOT, '_work', 'audio', '*.json')):
        for e in json.load(open(f, encoding='utf-8')):
            src[e.get('file')] = e
    miss = [x['file'] for x in items if not os.path.exists(os.path.join(ROOT, '_private', x['file']))]
    lines = ['# 🎵 Музыка и видео для игры', '',
             f'В игре {len(items)} звуковых файлов (вопросы, минусы для караоке, песни для танцевального баттла).',
             'Файлы защищены авторским правом, поэтому на GitHub их нет —',
             'они лежат в архиве, который присылает автор пака (`svoya-igra-media.zip`).', '',
             '**Как подключить:** распакуй архив в любую папку, в лобби игры нажми **«📁 Папка с музыкой и видео»**',
             'и выбери распакованную папку (ту, где лежит папка `media`). Chrome и Edge её запомнят; после перезапуска',
             'браузера нажми на надпись у кнопки один раз, чтобы разрешить доступ. Рядом видно, сколько файлов найдено.', '',
             'Нет файла — игра не сломается: ведущий может напеть мелодию или сразу показать ответ.', '',
             'Пересоздать все файлы по источникам: `python3 _work/tools/restore_audio.py` (нужен интернет и `bash _work/tools/setup_env.sh`).', '']
    for r in sorted({x['r'] for x in items}, key=lambda v: v or 99):
        lines += [f'## Раунд {r}' if r else '## Танцевальный баттл', '', '| Тема | Цена | Файл | Что звучит |', '|---|---|---|---|']
        for x in [y for y in items if y['r'] == r]:
            title = (src.get(x['file']) or {}).get('title', '').replace('|', '/')
            lines.append(f"| {x['theme']} | {x['price']} | `{x['file']}` | {title} |")
        lines.append('')
    open(os.path.join(ROOT, 'media', 'СПИСОК.md'), 'w', encoding='utf-8').write('\n'.join(lines))
    print(f'media/СПИСОК.md: {len(items)} файлов, нет на диске: {len(miss)}')
    for m in miss:
        print('  нет:', m)
    if '--zip' in sys.argv:
        out = sys.argv[sys.argv.index('--zip') + 1]
        with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as z:  # mp3 уже сжаты
            for x in items:
                p = os.path.join(ROOT, '_private', x['file'])
                if os.path.exists(p):
                    z.write(p, x['file'])
        print(f'архив: {out} ({os.path.getsize(out) // 1024 // 1024} МБ)')


if __name__ == '__main__':
    main()
