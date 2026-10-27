#!/usr/bin/env python3
"""kinchiki_r3_note.py ЦЕНА "строка для раздела ГОТОВО" — переносит пункт ЦЕНА из «ПЛАН» в «ГОТОВО» записки kinchiki_r3.md."""
import re, sys
P = '/home/user/svoya-igra/_work/handoff/kinchiki_r3.md'
price, line = sys.argv[1], sys.argv[2]
t = open(P, encoding='utf-8').read()
a = t.index('## ГОТОВО'); b = t.index('## ПЛАН НА ОСТАЛЬНЫЕ'); c = t.index('## Проверка в конце')
done, plan = t[a:b], t[b:c]
# убрать пункт плана с этой ценой (пункт — от «- ЦЕНА » до следующего «\n- » или конца раздела)
plan = re.sub(r'^- %s [^\n]*(?:\n(?!- )[^\n]*)*\n?' % re.escape(price), '', plan, flags=re.M)
done = re.sub(r'^- %s [^\n]*\n?' % re.escape(price), '', done, flags=re.M).rstrip('\n') + '\n- %s — %s\n\n' % (price, line)
open(P, 'w', encoding='utf-8').write(t[:a] + done + plan + t[c:])
print('ok')
