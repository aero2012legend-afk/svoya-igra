#!/usr/bin/env python3
"""Сборка questions.js из готовых тем.

python3 _work/tools/build.py [--partial] [--out questions.js]

Берёт темы из _work/content/*.json по раскладке LAYOUT, расставляет спецклетки
(аукционы, котов, ловушки, скрытые бонусы), добавляет финал, карточки и шутки
из extras.json и пишет questions.js с комментариями для ведущего.
Без --partial недоделанные темы (не 10 вопросов) в игру не попадают.
"""
import argparse, glob, json, os, random, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, '_work', 'content')

LAYOUT = {
    1: ['Кинчики', 'Мултяхи', 'Игрульки', 'Я не Алкаш', 'Ребусы', 'Еда и напитки', 'Животные',
        'Дворовые игры', 'Угадай актёра по части лица', 'Мемасики', 'Дырявый плейлист'],
    2: ['Кинчики', 'Мултяхи', 'Игрульки', 'Сериалы', 'Научная Духота', 'Мешап АГтёрский', 'Литература',
        'Технологии', 'Человек', 'Я так видел', 'Наш 2007'],
    3: ['Кинчики', 'Мултяхи', 'Игрульки', 'Космос', 'Взрослая жизнь', 'Я нарисовал песню', 'Базара нет...',
        'Цитаты для ОЛДОВ', 'Фразеологизмы', 'Я тупица', 'Чё думали не будет?'],
}
STEP = {1: 100, 2: 200, 3: 300}
PER_THEME = 10
# спецклетки на полный раунд (11 тем); если тем меньше — пропорционально меньше
SPECIALS = [('auction', 2), ('cat', 2), ('trap', 4), ('bonus', 6)]
# в каких позициях темы (0 — самый дешёвый вопрос) может стоять спецклетка; медали (три последних) не трогаем
SLOTS = {'auction': (3, 6), 'cat': (1, 6), 'trap': (0, 6), 'bonus': (0, 6)}
FXS = {'blur', 'deblur', 'pixel', 'zoom', 'crop', 'tiles', 'silhouette', 'negative', 'mirror'}
FIELD_ORDER = ['q', 'a', 'c', 'hint', 'img', 'fx', 'area', 'aimg', 'audio', 'video', 'start', 'end', 'aend',
               'kar', 'pics', 'names', 'catTheme', 'contest']
EXTRAS = [  # ключ в extras.json, комментарий в questions.js
    ('angelTruth', 'Ловушка «Ангел» → «Правда»: вопросы, на которые надо ответить честно'),
    ('angelDare', 'Ловушка «Ангел» → «Действие»: лёгкие задания'),
    ('devilTruth', 'Ловушка «Дьявол» → «Правда»: неудобные вопросы, за отказ — штраф'),
    ('devilDare', 'Ловушка «Дьявол» → «Действие»: смелые задания, за отказ — штраф'),
    ('poems', 'Стихи-поздравления для «Стиха на табуретке» (приходят на телефон жертве)'),
    ('croc', 'Слова для «Крокодила»'),
    ('redemption', 'Задания для отстающих после раунда («шанс на реабилитацию»): очки начисляет ведущий'),
    ('jokes', 'Шутки ведущего по поводам (start — начало игры, final — финал, winner — победитель и т. д.).\n'
              '     {name} заменяется на имя игрока'),
]
MEDAL = {PER_THEME - 3: '🥉 бронза', PER_THEME - 2: '🥈 серебро', PER_THEME - 1: '🥇 золото'}
SPECIAL_NOTE = {
    'auction': '🔨 Аукцион: игроки торгуются за этот вопрос',
    'cat': '🐱 Кот в мешке: вопрос отдают другому игроку',
    'trap': '⚠ Ловушка: монетка «ангел или дьявол», потом сам вопрос',
    'bonus': '🎁 Скрытый бонус: выглядит как обычная клетка, вместо вопроса — конкурс (убери type — вернётся вопрос)',
}

HEADER = r"""/* =====================================================================
   ВОПРОСЫ ДЛЯ «СВОЕЙ ИГРЫ» — пак на день рождения Старого
   ---------------------------------------------------------------------
   Этот файл собран скриптом _work/tools/build.py из тем в _work/content/.
   Править можно прямо здесь: меняй тексты в кавычках, сохрани файл и обнови
   страницу игры. (Новая сборка перезапишет файл — тогда правь _work/content.)

   Устройство: rounds (раунды) → themes (темы) → questions (вопросы).
   В теме 10 вопросов, цена растёт. Три последних вопроса темы игра сама
   оформляет как 🥉 бронзу, 🥈 серебро и 🥇 золото.

   Поля вопроса:
     price  — цена
     q      — текст вопроса (видят все на экране)
     a      — правильный ответ (ведущий видит на пульте, все — после «Показать ответ»)
     c      — шутка или интересный факт под ответом (необязательно)
     hint   — подсказка за «подкуп судьи», уходит игроку на телефон
     img    — картинка: 'media/img/тема/файл.jpg'
     fx     — как показать картинку, пока идёт вопрос (к ответу эффект снимается):
              'blur' — размыто, 'deblur' — размытие уходит по таймеру, 'pixel' — крупные пиксели,
              'zoom' — крупно один кусочек, 'crop' — видно только окошко, 'tiles' — перемешанные
              квадраты, 'silhouette' — силуэт, 'negative' — негатив, 'mirror' — зеркально
     area   — для zoom и crop: [x, y, ширина, высота] в процентах от картинки
     aimg   — другая картинка, которую показывают вместе с ответом
     audio  — звук: 'media/music/тема/файл.mp3';  video — видео: 'media/video/тема/файл.mp4'
     start, end — с какой и по какую секунду играть файл (необязательно)
     aend   — после «Показать ответ» звук доиграет от end до aend (чтобы все услышали слово)
     kar    — караоке: [[секунда, 'строчка'], …]; строчки после end скрыты до ответа,
              пропущенное слово пишется как ___
     type   — особая клетка (необязательно):
              'cat'     — 🐱 Кот в мешке: вопрос отдают другому игроку (catTheme — своя тема)
              'auction' — 🔨 Аукцион: игроки торгуются за вопрос
              'trap'    — ⚠ Ловушка: монетка «ангел или дьявол», событие, потом сам вопрос
              'bonus'   — 🎁 Скрытый бонус: на табло как обычная клетка, вместо вопроса —
                          конкурс из рулетки (свой конкурс: contest: 'rps' | 'dance' | 'shot' |
                          'sing' | 'tap' | 'react' | 'croc')
              'mashup'  — 🎭 Мешап: pics — два исходных фото, names — два имени

   Музыки и видео нет на GitHub: положи их в папку media или выбери папку
   на компьютере в лобби игры.
   Апостроф (') внутри текста пиши как \', перенос строки — \n.
   ===================================================================== */
"""


def js_str(s):
    s = str(s).replace('\\', '\\\\').replace("'", "\\'").replace('\r', '').replace('\n', '\\n')
    return "'" + s.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029') + "'"


def js_num(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return repr(v)


def js_key(k):
    return k if re.match(r'^[A-Za-z_$][\w$]*$', k) else js_str(k)


def js_val(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return js_num(v)
    if isinstance(v, str):
        return js_str(v)
    if isinstance(v, list):
        return '[' + ', '.join(js_val(x) for x in v) + ']'
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{js_key(k)}: {js_val(x)}' for k, x in v.items()) + ' }'
    if v is None:
        return 'null'
    raise TypeError(f'не умею записать {type(v)}')


def load_content():
    themes, final, extras = {}, None, {}
    for path in sorted(glob.glob(os.path.join(CONTENT, '*.json'))):
        d = json.load(open(path, encoding='utf-8'))
        name = os.path.basename(path)
        if name == 'extras.json':
            extras = d
            continue
        for th in d.get('themes', []):
            key = (th.get('round'), th.get('name'))
            if key in themes:
                sys.exit(f'Тема {key} есть в двух файлах: {themes[key][1]} и {name}')
            themes[key] = (th, name)
        if d.get('final'):
            final = d['final']
    return themes, final, extras


class Report:
    def __init__(self):
        self.errors, self.warnings, self.no_media = [], [], []

    def check_file(self, where, path, media=False):
        if os.path.exists(os.path.join(ROOT, path)):
            return
        if media and os.path.exists(os.path.join(ROOT, '_private', path)):
            return
        (self.no_media if media else self.errors).append(f'{where}: нет файла {path}')


def check_theme(rno, th, src, rep):
    qs = th['questions']
    want = [STEP[rno] * (k + 1) for k in range(PER_THEME)]
    got = [q.get('price') for q in qs]
    if got != want:
        rep.errors.append(f'Р{rno} «{th["name"]}» ({src}): цены {got}, нужно {want}')
    for q in qs:
        where = f'Р{rno} «{th["name"]}» {q.get("price")}'
        for k in ('q', 'a'):
            if not str(q.get(k, '')).strip() and q.get('type') != 'bonus':
                rep.errors.append(f'{where}: пустое поле {k}')
        if not q.get('hint'):
            rep.warnings.append(f'{where}: нет подсказки hint')
        if q.get('fx') and q['fx'] not in FXS:
            rep.errors.append(f'{where}: неизвестный эффект fx={q["fx"]}')
        if q.get('fx') in ('zoom', 'crop') and not (isinstance(q.get('area'), list) and len(q['area']) >= 4):
            rep.errors.append(f'{where}: для fx={q["fx"]} нужна area')
        if q.get('fx') and not q.get('img'):
            rep.errors.append(f'{where}: fx без картинки')
        for k in ('img', 'aimg'):
            if q.get(k):
                rep.check_file(where, q[k])
        for p in q.get('pics') or []:
            rep.check_file(where, p)
        for k in ('audio', 'video'):
            if q.get(k):
                rep.check_file(where, q[k], media=True)


def place_specials(rno, themes):
    """Расставляет спецклетки детерминированно: та же раскладка тем — те же клетки."""
    rng = random.Random(f'svoya-igra-{rno}')
    scale = len(themes) / len(LAYOUT[rno])
    used, per_theme, per_row = {}, [0] * len(themes), {}
    for kind, count in SPECIALS:
        for _ in range(max(1, round(count * scale)) if themes else 0):
            lo, hi = SLOTS[kind]
            cands = []
            for t, th in enumerate(themes):
                for i, q in enumerate(th['questions']):
                    if (t, i) in used or q.get('type') or not lo <= i <= min(hi, len(th['questions']) - 4):
                        continue
                    if kind == 'bonus' and (q.get('audio') or q.get('video')):
                        continue  # музыкальный вопрос жалко терять ради конкурса
                    if any(tt == t and (abs(ii - i) <= 1 or k == kind) for (tt, ii), k in used.items()):
                        continue  # две спецклетки подряд или две одинаковые в одной теме — перебор
                    cands.append((per_theme[t], per_row.get(i, 0), rng.random(), t, i))
            if not cands:
                break
            *_, t, i = min(cands)
            used[(t, i)] = kind
            per_theme[t] += 1
            per_row[i] = per_row.get(i, 0) + 1
    return used


def write_question(out, q, i, special):
    ind = ' ' * 10
    if special:
        out.append(f'{ind}// {SPECIAL_NOTE[special]}')
    elif i in MEDAL:
        out.append(f'{ind}// {MEDAL[i]}')
    head = f'price: {js_num(q["price"])}'
    typ = special or q.get('type')
    if typ:
        head += f", type: {js_str(typ)}"
    lines = [head]
    keys = [k for k in FIELD_ORDER if k in q] + [k for k in q if k not in FIELD_ORDER and k not in ('price', 'type')]
    groups = [('q',), ('a',), ('c',), ('hint',), ('img', 'fx', 'area', 'aimg'), ('audio', 'video', 'start', 'end', 'aend'),
              ('pics', 'names'), ('catTheme', 'contest')]
    done = set()
    for g in groups:
        part = [f'{k}: {js_val(q[k])}' for k in g if k in q]
        done.update(k for k in g if k in q)
        if part:
            lines.append(', '.join(part))
    for k in keys:
        if k in done:
            continue
        if k == 'kar':
            kar = ',\n'.join(f'{ind}    [{js_num(t)}, {js_str(s)}]' for t, s in q['kar'])
            lines.append(f'kar: [\n{kar},\n{ind}  ]')
        else:
            lines.append(f'{k}: {js_val(q[k])}')
    body = (',\n' + ind + '  ').join(lines)
    out.append(f'{ind}{{ {body} }},')


def build(partial):
    themes, final, extras = load_content()
    rep = Report()
    out = [HEADER, 'window.GAME = {', "  title: 'Своя игра',", "  subtitle: '🎂 День рождения Василия',", '',
           '  /* Свои звуки вместо встроенных (необязательно): correct, wrong, buzz, timeout, cat, auction,',
           '     trap, angel, devil, bonus, coin, bribe, round, final, fanfare, medal, mashup и другие */',
           '  sounds: {', "    // correct: 'media/correct.mp3',", '  },', '',
           '  /* Фоновая музыка (необязательно; по умолчанию играет media/bgm): lobby, board, think, results, end.',
           "     Пример: music: { board: ['media/bgm/моя.mp3'], think: false }, — false выключает музыку экрана */", '',
           '  /* Песни для танцевального баттла. Пусто — играет встроенный бит.',
           "     Пример: danceSongs: ['media/dance/song1.mp3', 'media/dance/song2.mp3'], */",
           '  danceSongs: [],', '', '  rounds: [']
    summary, missing = [], []
    for rno, names in LAYOUT.items():
        picked = []
        for name in names:
            entry = themes.get((rno, name))
            n = len(entry[0]['questions']) if entry else 0
            if entry and (n == PER_THEME or (partial and n)):
                picked.append(entry)
            else:
                missing.append(f'Р{rno} «{name}»' + (f' ({n}/{PER_THEME})' if n else ''))
        for th, src in picked:
            check_theme(rno, th, src, rep)
        specials = place_specials(rno, [th for th, _ in picked])
        out += [f'    /* ============================ РАУНД {rno} ============================ */',
                '    {', f"      name: 'Раунд {rno}',", '      themes: [']
        for t, (th, src) in enumerate(picked):
            out.append(f"        {{ name: {js_str(th['name'])}, questions: [")
            for i, q in enumerate(th['questions']):
                write_question(out, q, i, specials.get((t, i)))
            out.append('        ]},')
        out += ['      ],', '    },']
        kinds = {}
        for (t, i), kind in sorted(specials.items()):
            kinds.setdefault(kind, []).append(f"{picked[t][0]['name']} {picked[t][0]['questions'][i]['price']}")
        summary.append(f'Раунд {rno}: тем {len(picked)} из {len(names)}; '
                       + '; '.join(f'{k}: {", ".join(v)}' for k, v in kinds.items()))
    out += ['  ],', '']
    if final:
        out += ['  /* Финал: 10 тем. Финалисты по очереди вычёркивают темы, последняя остаётся. */',
                '  final: {', '    themes: [']
        for f in final:
            rep.check_file(f'Финал «{f.get("theme")}»', f['img']) if f.get('img') else None
            out.append('      { ' + ',\n        '.join(f'{js_key(k)}: {js_val(v)}' for k, v in f.items()) + ' },')
        out += ['    ],', '  },', '']
    else:
        missing.append('Финал')
    for key, note in EXTRAS:
        if key not in extras:
            rep.warnings.append(f'extras.json: нет {key}')
            continue
        out.append(f'  /* {note} */')
        v = extras[key]
        if isinstance(v, dict):
            out.append(f'  {key}: {{')
            for k, lst in v.items():
                out.append(f'    {js_key(k)}: [')
                out += [f'      {js_str(s)},' for s in lst]
                out.append('    ],')
            out.append('  },')
        else:
            out.append(f'  {key}: [')
            out += [f'    {js_str(s)},' for s in v]
            out.append('  ],')
        out.append('')
    out.append('};')
    return '\n'.join(out) + '\n', rep, summary, missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--partial', action='store_true', help='брать и недоделанные темы')
    ap.add_argument('--out', default=os.path.join(ROOT, 'questions.js'))
    args = ap.parse_args()
    js, rep, summary, missing = build(args.partial)
    for line in summary:
        print(line)
    if missing:
        print('Ещё нет:', ', '.join(missing))
    for w in rep.warnings:
        print('Внимание:', w)
    if rep.no_media:
        print(f'Нет звука/видео на диске: {len(rep.no_media)} (на GitHub их и не должно быть)')
    if rep.errors:
        print('ОШИБКИ:\n  ' + '\n  '.join(rep.errors))
        sys.exit(1)
    open(args.out, 'w', encoding='utf-8').write(js)
    print('Записано:', os.path.relpath(args.out, ROOT), f'({len(js) // 1024} КБ)')


if __name__ == '__main__':
    main()
