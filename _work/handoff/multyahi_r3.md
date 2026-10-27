# Handoff: тема «Мултяхи», раунд 3 (slug multyahi_r3)

Файл темы: `_work/content/multyahi_r3.json` (одна тема, round 3, name «Мултяхи»). Цены 300…3000.
Аудио-реестр: `_work/audio/multyahi_r3.json` (для звука: file/source/title/cut/gain_db/ffmpeg). Звук лежит в `_private/media/music/multyahi/r3_*.mp3`.
Картинки: `media/img/multyahi/r3_<цена>_<что>.jpg`. Рабочая папка: `/tmp/multyahi_r3/` (может пропасть — тогда качать заново).
Помощники: /tmp/multyahi_r3/tools/ (mkaudio.py — нарезка под −15 LUFS; regadd.py — запись в реестр; qstore.py/putq.py — запись вопроса в JSON; scanw.py — Whisper окном; env.py — огибающая громкости; vsheet.py — лист кадров из видео).

## СТАТУС: ТЕМА ГОТОВА — 10 из 10, цены 300…3000, все вопросы записаны в JSON
- 300 — «Южный парк», реплика (r3_300_southpark.mp3, ~3 с; img r3_300_southpark.jpg fx pixel px16). Реестр есть, restore проверен
- 600 — «Том и Джерри», кадр, fx=tiles (r3_600_tomjerry.jpg)
- 900 — «ВАЛЛ-И», описание, img r3_900_walle_q.jpg (fx deblur) + aimg r3_900_walle_a.jpg
- 1200 — «Бэтмен» (заставка, Dailymotion x7xik5b, 37.5–59.0 с; img r3_1200_batman_q.jpg fx negative; aimg r3_1200_batman_a.jpg). Реестр есть, restore проверен
- 1500 — «Тайна третьей планеты», реплика (r3_1500_tayna.mp3 = archive.org 865.7–872.0 с; img r3_1500_tayna_q.jpg fx zoom; aimg r3_1500_tayna_a.jpg). Реестр есть
- 1800 — «Корова и Цыплёнок» (r3_1800_cow_q/a.jpg), fx=crop [38,0,18,84] (ноги отца; q почищена cv2.inpaint, aimg — оригинал)
- 2100 — «Унесённые призраками» (img r3_2100_spirited.jpg, fx tiles 5; кадр с речным духом проверен — надписей нет; факты в c перепроверены)
- 2400 (бронза) — «Наруто», опенинг 1 «R★O★C★K★S» (Hound Dog). Звук r3_2400_naruto.mp3 = Dailymotion xbzkjs 1.9–22.7 с (−15.0 LUFS; restore проверен: md5 совпал; слова «Naruto» в TV-версии нет — Whisper). img r3_2400_naruto_q.jpg (кадр опенинга: три силуэта на фоне солнца, fx blur), aimg r3_2400_naruto_a.jpg (арт команды №7)
- 2700 (серебро) — «Следствие ведут Колобки» (рисованный, 1986–1987, Татарский и Ковалёв, «Экран»): реплика «Ой, шеф, а я вас вижу! — Аналогично.» Звук r3_2700_kolobki.mp3 = Dailymotion x303v7y (весь фильм, 20:38) 229.45–233.95 с (4.5 с, −15.2 LUFS; restore проверен: md5 совпал; Whisper на нарезке: ровно две реплики). ВАЖНО: пометка прежнего автора «в первых секундах слышно “Шеф. Аналогично.” 0.66–1.48 с» — галлюцинация Whisper (первая секунда файла — цифровая тишина); настоящая реплика на 229.8–233.3 с. img r3_2700_kolobki_q.jpg (кадр с крышей и четырьмя дырами, fx pixel px22), aimg r3_2700_kolobki_a.jpg (тот же кадр с титром). Кукольные «Колобки» 1983 (Зябликова, x303ije) — другой фильм, не брать.
- 3000 (золото) — «Гаргульи» (Disney, 1994–1997), заглавная тема. Звук r3_3000_gargoyles.mp3 = Dailymotion xpj9ti (S1 Intro) 0–24 с (−15.0 LUFS; restore проверен: md5 совпал; голоса в заставке нет — Whisper + Demucs). img r3_3000_gargoyles_q.jpg (кадр заставки: Голиаф на башне на фоне луны, fx deblur), aimg r3_3000_gargoyles_a.jpg (клан).

Запасные (не понадобились): Pink Panther (Mancini official SoundCloud https://soundcloud.com/henry-mancini-official/the-pink-panther-theme-from-2), Evangelion OP (https://soundcloud.com/yokotakahashi/zankoku-na-tenshi-no-teeze), Howl (https://soundcloud.com/joe-hisaishi-official/merry-go-round-from-howls).

## ЗАМЕТКИ
- restore_audio.py фильтрует по подстроке: `--force r3_3000` заодно пересоздал kinchiki/r3_3000_bladerunner.mp3 (по его записи; −15.0 LUFS и 25.5 с как положено). Для своих файлов давай `multyahi_r3` или полное имя файла.
- Whisper на музыке/заставках галлюцинирует («СПОКОЙНАЯ МУЗЫКА», «Thanks for watching»); реплики проверять огибающей громкости и узкими окнами (BEAM=1 python scanw.py ... 30-секундное окно).
- ru.wikipedia через urllib/curl с браузерным UA работает (wptxt.py / wpdump.py); en.wikipedia даёт 429. Яндекс-картинки: imgs.py "запрос" outdir 12 y yandex 700.
- Запреты: нет работы именинника (повар/кухня/кастрюли, досмотр), нет Касперского, «Старый» ≤ 2 раз на тему (в теме пока 0), Фанта нельзя.
