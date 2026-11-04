# Записка: тема «Я нарисовал песню» — переделка на мега-хиты (narisoval2)
Задание: песни популярные (русские+зарубежные), рисунок по припеву без надписей, после ответа звучит отрывок (aaudio, 8-15 с, -15 LUFS) в _private/media/music/narisoval/, запись в _work/audio/narisoval.json. Старые картинки заменённых песен удалить в конце.
Рабочая папка /tmp/narisoval2 (src/*.mp3 — скачанное с SoundCloud; mk.py — нарезка+LUFS+запись в audio json: `python3 mk.py имя src/x.mp3 URL START END "title" "note" r3_<цена>_<имя>.mp3`; q<цена>.py — сохранение вопроса).
Whisper: только без --vocals (demucs слишком медленный), английский с флагом `--en` в конце, окна по 60 с.
Сцены: _work/handoff/scenes/n<цена>.py (запуск из корня репо) -> media/img/narisoval/r3_<цена>_<имя>.webp.

| цена | песня | рисунок | аудио | вопрос в JSON |
|---|---|---|---|---|
| 300 | Любэ — Конь (1994) | готов | готово 11.1-23.4 | ГОТОВО |
| 600 | Pharrell — Happy | готов | готово 24.1-36.5 | ГОТОВО |
| 900 | Shakira — Waka Waka | готов | готово 48.3-60.2 (src/waka2.mp3; waka.mp3 — НЕ ТА песня) | ГОТОВО |
| 1200 | Survivor — Eye of the Tiger | готов | готово 82.7-95 | ГОТОВО |
| 1500 | тАТу — Нас не догонят (2001) | готов (n1500) | src/tatu.mp3 (SC russian-top-music/tatu-nas-ne-dogonyat); припев ~27-45 с | нет |
| 1800 | Чайф — Аргентина-Ямайка 5:0 | НЕТ | src/chaif.mp3 (SC stanislav-kudriavtzev/argentina-yamayka-50), слова не распознаны | нет |
| 2100 | Scorpions — Wind of Change | готов | готово 20.9-33.3 | ГОТОВО |
| 2400 | Кино — Группа крови | готов (n2400) | src/kino.mp3 (SC kino-119988254/gruppa-krovi) | нет |
| 2700 | a-ha — Take On Me | готов (n2700) | src/aha.mp3 (SC rykumi/a-ha-take-on-me-official-video-2) | нет |
| 3000 | Eagles — Hotel California | готов (n3000) | src/hotel.mp3 (474 с, SC zlskftpbm4iv/the-eagles-hotel-california — проверить, что оригинал); припев «Welcome to the Hotel California» | нет |

В конце: удалить старые webp r3_300_pchelovod, 600_malinovaya, 900_provans, 1200_krossy, 1500_devyatka, 1800_tehno, 2100_eksponat, 2400_sinij, 2700_kometa, 3000_yunost; проверить, что в JSON нет ссылок на них; python3 _work/tools/build.py; review.py. Не использовать «Старый», работу, Касперского.
