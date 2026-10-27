#!/usr/bin/env python3
"""Дописывает/заменяет вопрос в _work/content/narisoval.json (одна тема, round 3). Использование:
    import sys; sys.path.insert(0, '/home/user/svoya-igra/_work/handoff'); from narisoval_save import save_q
    save_q({'price': 300, 'q': ..., 'a': ..., 'c': ..., 'hint': ..., 'img': 'media/img/narisoval/r3_300_gena.webp'})"""
import json, os
PATH = '/home/user/svoya-igra/_work/content/narisoval.json'

def save_q(q):
    if os.path.exists(PATH):
        d = json.load(open(PATH, encoding='utf-8'))
    else:
        d = {'themes': [{'round': 3, 'name': 'Я нарисовал песню', 'questions': []}]}
    th = d['themes'][0]
    th['questions'] = [x for x in th['questions'] if x['price'] != q['price']] + [q]
    th['questions'].sort(key=lambda x: x['price'])
    json.dump(d, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('saved', q['price'], '| всего вопросов:', len(th['questions']))
