# Handoff: тема «Мултяхи», раунд 3 (slug multyahi_r3)

Файл темы: `_work/content/multyahi_r3.json` (одна тема, round 3, name «Мултяхи»). Цены 300…3000.
Аудио-реестр: `_work/audio/multyahi_r3.json` (для звука: file/source/title/cut/gain_db/ffmpeg). Звук лежит в `_private/media/music/multyahi/r3_*.mp3`.
Картинки: `media/img/multyahi/r3_<цена>_<что>.jpg`. Рабочая папка: `/tmp/multyahi_r3/` (может пропасть — тогда качать заново).
Помощники: /tmp/multyahi_r3/tools/mkaudio.py (SRC OUT S E [lufs fade_in fade_out] — режет как restore_audio.py и подбирает gain под −15 LUFS), /tmp/multyahi_r3/tools/regadd.py (add({...}) — запись в аудио-реестр). Помощник записи вопроса: `/tmp/multyahi_r3/tools/qstore.py` (`from qstore import put; put({...вопрос...})` — вставляет/заменяет вопрос по цене).

## ГОТОВО
- 300 — «Южный парк», реплика (аудио r3_300_southpark.mp3, ~3 с; img r3_300_southpark.jpg fx pixel px16). Запись в _work/audio/multyahi_r3.json есть, restore_audio.py проверен (файл воспроизводится идентично)
- 600 — «Том и Джерри», кадр, fx=tiles (media/img/multyahi/r3_600_tomjerry.jpg)
- 900 — «ВАЛЛ-И», описание, img r3_900_walle_q.jpg (fx deblur) + aimg r3_900_walle_a.jpg
- 1200 — «Бэтмен» (заставка, Dailymotion x7xik5b, нарезка 37.5–59.0 с; img r3_1200_batman_q.jpg = фон Готэма, fx negative; aimg r3_1200_batman_a.jpg). Запись в реестре есть, restore проверен
- 1500 — «Тайна третьей планеты», реплика (r3_1500_tayna.mp3 = archive.org 865.7–872.0 с, 2 реплики целиком; img r3_1500_tayna_q.jpg fx zoom [36,6,36,36] — голова птицы-продавца; aimg r3_1500_tayna_a.jpg). Запись в аудио-реестре есть
- 1800 — «Корова и Цыплёнок» (файлы r3_1800_cow_q/a.jpg), fx=crop area [38,0,18,84] (ноги отца; q-картинка почищена cv2.inpaint, aimg — оригинал кадра)

## ПЛАН НА ОСТАЛЬНЫЕ (порядок по сложности; цены пересчитаны: 1200 Бэтмен, 1500 Тайна, 1800 Корова, 2100 Гибли, 2400 Наруто, 2700 Колобки, 3000 Гаргульи)
- 2100 — кадр «Унесённые призраки» (Ghibli, 2001) с жёстким fx (tiles 6 / crop). Источник — Яндекс.
- 2400 (бронза) — тема аниме «Наруто» (опенинг 1, «R★O★C★K★S», Hound Dog): Dailymotion https://www.dailymotion.com/video/xbzkjs (84 с) или x9dqph. Без слов «Naruto» во фрагменте.
- 2700 (серебро) — реплика «Следствие ведут Колобки» (рисованный, 1986, Татарский и Ковалёв): «— Ой, шеф, а я вас вижу! — Аналогично.» Источник: Dailymotion https://www.dailymotion.com/video/x303v7y (в первых секундах слышно «Шеф. Аналогично.» 0.66–1.48 с). ВНИМАНИЕ: есть ещё кукольные «Колобки» 1983 (Зябликова, Dailymotion x303ije) — другой фильм.
- 3000 (золото) — тема «Гаргульи» (Disney, 1994): Dailymotion https://www.dailymotion.com/video/xpj9ti (62 с), fx deblur. Проверить, что в нарезке нет слова «Gargoyles».
Запасные: Pink Panther (Mancini official SoundCloud https://soundcloud.com/henry-mancini-official/the-pink-panther-theme-from-2), Evangelion OP (https://soundcloud.com/yokotakahashi/zankoku-na-tenshi-no-teeze), Howl (https://soundcloud.com/joe-hisaishi-official/merry-go-round-from-howls).

## ЗАМЕТКИ
- Wikipedia: ru.wikipedia через curl с браузерным UA работает (API — 429). Скрипты: /tmp/multyahi_r3/wp.py (wp.py ru "Название" N), wq.py (Викицитатник).
- Картинки: Яндекс по-русски даёт хорошие кадры: python3 /tmp/multyahi_r3/imgs.py "запрос" outdir 12 y yandex 640.
- Dailymotion: yt-dlp -f hls-380 (нужен http_proxy=$HTTPS_PROXY для ffmpeg), поиск: /tmp/multyahi_r3/dm.py "запрос".
- Whisper медленный (~1–1.6× длительности), запускать на коротких окнах: /tmp/multyahi_r3/scan2.py.
- Запреты: нет работы именинника (повар/кухня/кастрюли, досмотр), нет Касперского, «Старый» ≤ 2 раз на тему, Фанта нельзя.
