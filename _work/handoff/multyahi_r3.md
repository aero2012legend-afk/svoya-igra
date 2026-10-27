# Handoff: тема «Мултяхи», раунд 3 (slug multyahi_r3)

Файл темы: `_work/content/multyahi_r3.json` (одна тема, round 3, name «Мултяхи»). Цены 300…3000.
Аудио-реестр: `_work/audio/multyahi_r3.json` (для звука: file/source/title/cut/gain_db/ffmpeg). Звук лежит в `_private/media/music/multyahi/r3_*.mp3`.
Картинки: `media/img/multyahi/r3_<цена>_<что>.jpg`. Рабочая папка: `/tmp/multyahi_r3/` (может пропасть — тогда качать заново).
Помощник записи: `/tmp/multyahi_r3/tools/qstore.py` (`from qstore import put; put({...вопрос...})` — вставляет/заменяет вопрос по цене).

## ГОТОВО
- 600 — «Том и Джерри», кадр, fx=tiles (media/img/multyahi/r3_600_tomjerry.jpg)

## ПЛАН НА ОСТАЛЬНЫЕ (порядок по сложности)
- 300 — реплика EN «Южный парк»: «Oh my God, they killed Kenny! You bastards!» Источник: SoundCloud https://soundcloud.com/user-962234403/south-park-oh-my-god-they-killed-kenny-you-bastards-wwwmp3freexbiz (9 с; файл скачан /tmp/multyahi_r3/sc/southpark.m4a). Картинка: кадр с четырьмя мальчиками (найти Яндексом по-русски), fx pixel.
- 900 — описание «ВАЛЛ-И» (2008, Pixar): img = /tmp/multyahi_r3/s_wall/y_10.jpg (крупный план, fx deblur), aimg = /tmp/multyahi_r3/s_wall/y_1.jpg (WALL-E и EVE на фоне луны).
- 1200 — реплика RU «Тайна третьей планеты» (1981): диалог «— Скажите, пожалуйста, сколько стоит эта птица? — Нахал! Это я его продаю!» (Селезнёв и птица Говорун) = 866.09–871.37 с в файле archive.org (URL в /tmp/multyahi_r3/tayna_url.txt: «1981 Тайна третьей планеты [viju TV1000 HD].mp4» из коллекции 1982-1_202606). Whisper-разбор: /tmp/multyahi_r3/tayna_scan_a.txt. Картинку-кадр взять ffmpeg -ss из того же mp4 (http_proxy=$HTTPS_PROXY) или Яндексом.
- 1500 — «Корова и Цыплёнок» (CN, 1997): zoom на ноги отца — кадр /tmp/multyahi_r3/s_cow/y_4.jpg (1200x960; ноги в зелёных брюках по центру, ботинки жёлтые). Подкол: родителей показывают только ниже пояса.
- 1800 — тема «Бэтмен» (Batman: The Animated Series, 1992, Дэнни Элфман): Dailymotion https://www.dailymotion.com/video/x2wdftt (61 с). Официальная загрузка Элфмана на SoundCloud защищена DRM — не качается.
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
