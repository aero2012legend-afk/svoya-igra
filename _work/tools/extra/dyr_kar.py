"""«Дырявый плейлист»: караоке на весь (удлинённый) фрагмент.
- строчки ДО первой проверенной строчки — из распознавания (раньше караоке начиналось не сразу);
- проверенные строчки до пропуска — как были;
- строчки ПОСЛЕ пропуска (песня теперь идёт дальше) — из распознавания, слово-ответ спрятано {…};
- повторы слова-ответа после пропуска → поле mute (на них звучит минус).
Текст песен не печатается. python3 dyr_kar.py [--dry] [цена …]"""
import json, re, sys
sys.path.insert(0, '/home/user/svoya-igra/_work/tools')
import karaoke as K
SP = '/tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad'
CP = '/home/user/svoya-igra/_work/content/dyryavy.json'
HALLU = re.compile(r'(?i)субтитр|корректор|редактор|продолжение следует|спасибо за просмотр|подпис|amara|thank you for watching|subtitles')
GAP = re.compile(r'_{2,}|\{[^}]*\}')


def norm(w):
    return re.sub(r'[^\w]', '', w.lower().replace('ё', 'е')).replace('_', '')


def target_of(q):
    if q.get('gw'):
        return norm(q['gw'])
    return norm(re.split(r'\s+[(«]', str(q.get('a', '')))[0].split()[0])


def match(a, tgt):
    return similar(a, tgt) or (len(a) >= 3 and tgt.startswith(a) and len(tgt) - len(a) <= 2)


def occurrences(asr, tgt):
    out = []
    for k, w in enumerate(asr):
        a = norm(w[0])
        if match(a, tgt):
            out.append((w[1], w[2], k, k))
        elif k + 1 < len(asr) and similar(a + norm(asr[k + 1][0]), tgt):
            out.append((w[1], asr[k + 1][2], k, k + 1))
    return out


def similar(a, b):
    import difflib
    return a == b or a + 's' == b or b + 's' == a or (len(a) > 3 and len(a) == len(b) and difflib.SequenceMatcher(None, a, b).ratio() >= 0.75)


def main():
    dry = '--dry' in sys.argv
    only = [int(x) for x in sys.argv[1:] if x.isdigit()]
    d = json.load(open(CP, encoding='utf-8'))
    th = [d] if 'questions' in d else d['themes']
    for q in th[0]['questions']:
        p = q['price']
        if only and p not in only:
            continue
        try:
            asr = [w for w in json.load(open(f'{SP}/asr/dyr_{p}.json')) if norm(w[0]) and not HALLU.search(w[0]) and w[3] >= 0.2]
        except FileNotFoundError:
            print(p, 'нет распознавания'); continue
        kar = [x for x in q.get('kar') or [] if len(x) >= 2]
        real = [x for x in kar if '♪' not in str(x[1])]
        gi = next((i for i, x in enumerate(real) if GAP.search(str(x[1]))), None)
        if not real or gi is None:
            print(p, 'нет строчки с пропуском'); continue
        end, aend = float(q['end']), float(q['aend'])
        tgt = target_of(q)
        occ = occurrences(asr, tgt)
        cand = [o for o in occ if end - 2.0 <= o[0] <= end + 0.3]
        fix = ''
        if cand:
            o = min(cand, key=lambda o: abs(o[0] - end))
            ne = round(min(end, o[0] - 0.25), 2)
            na = round(max(o[1] + 0.12, ne + 0.3), 2)
            if abs(ne - end) > 0.01 or abs(na - aend) > 0.01:
                fix = f'пропуск {end}→{ne}, конец слова {aend}→{na}'
            end, aend = ne, na
            gap_idx = set(range(o[2], o[3] + 1))
        else:
            gap_idx = set()
            fix = 'СЛОВО НЕ НАЙДЕНО В РАСПОЗНАВАНИИ'
        first = float(real[0][2][0] if len(real[0]) > 2 and real[0][2] else real[0][0])
        st = float(q.get('start') or 0)
        early = [asr[o[2]] for o in occ if o[0] >= st and o[1] < end - 0.1 and o[2] not in gap_idx]
        pre = [{'w': w[0], 's': w[1], 'e': w[2]} for w in asr if w[1] >= (st + 0.03 if st > 0 else 0) and w[2] < first - 0.25]
        post_w = [w for w in asr if w[1] >= aend + 0.05]
        mute, post = [], []
        # Whisper иногда режет слово на два («и» + «юль»): склеиваем соседей
        hit = [False] * len(post_w)
        for o in occurrences(post_w, tgt):
            for k in range(o[2], o[3] + 1):
                hit[k] = True
        for k, w in enumerate(post_w):
            if hit[k]:
                mute.append([round(w[1] - 0.18, 2), round(w[2] + 0.15, 2)])
                m = re.match(r'^(\W*)(.*?)(\W*)$', w[0])
                post.append({'w': f'{m.group(1)}{{{m.group(2)}}}{m.group(3)}', 's': w[1], 'e': w[2]})
            else:
                post.append({'w': w[0], 's': w[1], 'e': w[2]})
        g = real[gi]
        if len(g) > 2 and g[2]:
            toks, ts = str(g[1]).split(), list(g[2])
            gk = next((k for k, t in enumerate(toks) if GAP.search(t)), len(toks) - 1)
            if gk < len(ts):
                ts[gk] = end
                for k in range(gk - 1, -1, -1):
                    ts[k] = min(ts[k], ts[k + 1] - 0.08)
                real[gi] = [round(min(float(g[0]), ts[0] - 0.3), 2), g[1], [round(t, 2) for t in ts]]
        L_pre = K.build_lines(pre, set()) if pre else []
        L_post = K.build_lines(post, set()) if post else []
        head = [[st, '♪ ♪ ♪', [st, st + 0.51, st + 1.01]]] if (not pre or pre[0]['s'] > st + 2.5) else []
        real = [x for x in real if float(x[0]) >= st - 0.5]
        # строчка после пропуска не должна начинаться раньше конца пропущенного слова
        L_post = [[max(round(aend, 2), x[0])] + x[1:] for x in L_post]
        # дыры между проверенными строчками (там тоже поют) — заполняем строчками из распознавания
        mid, holes = [], 0
        for k in range(gi + 1):
            mid.append(real[k])
            if k == gi:
                break
            a_end = float(real[k][2][-1] if len(real[k]) > 2 and real[k][2] else real[k][0]) + 0.35
            b_st = float(real[k + 1][2][0] if len(real[k + 1]) > 2 and real[k + 1][2] else real[k + 1][0]) - 0.2
            ws = [{'w': w[0], 's': w[1], 'e': w[2]} for w in asr if w[1] >= a_end and w[2] <= b_st]
            if len(ws) >= 2:
                mid += K.build_lines(ws, set()); holes += 1
        new = head + L_pre + mid + L_post
        print(f'{p}: {fix}; слово-ответ «…» {"ВСТРЕЧАЕТСЯ ДО ПРОПУСКА ×" + str(len(early)) + " @" + ",".join(str(w[1]) for w in early) if early else "до пропуска не звучит"}; '
              f'строчек до {len(L_pre)}, проверенных {gi + 1}, дыр заполнено {holes}, после {len(L_post)}; повторов после пропуска (mute) {len(mute)}; '
              f'первое слово голоса {asr[0][1] if asr else None} с, первая проверенная строчка {first} с')
        if not dry:
            q['kar'] = new
            q['end'], q['aend'] = end, aend
            if mute:
                q['mute'] = mute
            else:
                q.pop('mute', None)
    if not dry:
        json.dump(d, open(CP, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        open(CP, 'a').write('\n')


if __name__ == '__main__':
    main()
