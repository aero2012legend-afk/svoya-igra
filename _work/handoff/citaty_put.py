#!/usr/bin/env python3
"""citaty_put.py — записать готовый вопрос темы «Цитаты для ОЛДОВ» (раунд 3) в _work/content/citaty.json.
Из python:  sys.path.insert(0, '/home/user/svoya-igra/_work/handoff'); from citaty_put import put; put({...вопрос...})
Из консоли: python3 /home/user/svoya-igra/_work/handoff/citaty_put.py вопрос.json
Вопрос с той же ценой заменяется, список сортируется по цене."""
import json, os, sys
P = '/home/user/svoya-igra/_work/content/citaty.json'
NAME = 'Цитаты для ОЛДОВ'
def put(q):
    d = json.load(open(P, encoding='utf-8')) if os.path.exists(P) else {'themes': [{'round': 3, 'name': NAME, 'questions': []}]}
    t = d['themes'][0]
    t['questions'] = [x for x in t['questions'] if x['price'] != q['price']] + [q]
    t['questions'].sort(key=lambda x: x['price'])
    tmp = P + '.tmp'
    json.dump(d, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.replace(tmp, P)
    print('saved', [x['price'] for x in t['questions']])
if __name__ == '__main__':
    put(json.load(open(sys.argv[1], encoding='utf-8')))
