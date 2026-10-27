# Записка: Игрульки, раунд 3 (slug igrulki_r3) — для передачи работы другому агенту

Файл результата: _work/content/igrulki_r3.json (одна тема, round 3, name «Игрульки»). СОСТОЯНИЕ: все 10 вопросов (300…3000) готовы и записаны.
Звук: _private/media/music/igrulki/r3_*.mp3 (6 файлов), записи для пересоздания — _work/audio/igrulki_r3.json (python3 _work/tools/restore_audio.py igrulki_r3). Картинки: media/img/igrulki/r3_*.
Временные файлы: /tmp/igrulki_r3/ (сырой звук с myinstants — raw/, SoundCloud — raw2/, листы поиска — s_*/).
Занятые игры (повторять нельзя): R1 — Mario, Minecraft, Angry Birds, Sims, Counter-Strike, GTA SA, S.T.A.L.K.E.R., DuckTales, Dota 2, Heroes 3; R2 — Tetris, Mortal Kombat, PvZ, Skyrim, Battle City, Sonic, Worms, Portal, Resident Evil, Papers Please. Табу: работа именинника (повар, транспортная безопасность, досмотр, документы), Касперский, Фанта; «Старый» не больше 2 раз на тему (сейчас 1 раз — в c на 3000).

## Готово (цена — игра — формат — файлы)
- 300  Flappy Bird — кусочек экрана (zoom, area [14.4,41.7,45,45]) — r3_300_flappy.jpg; звука нет.
- 600  Duck Hunt — звук смеха собаки + pixel (px 24) — r3_600_duckhunt.jpg, r3_600_duckhunt.mp3 (myinstants 07-laugh).
- 900  «Ну, погоди!» (Электроника ИМ-02; вторая часть вопроса — Nintendo Game & Watch «Egg») — zoom на LCD, area [19.5,25.5,61,61] — r3_900_nupogodi.jpg.
- 1200 Leeroy Jenkins / World of Warcraft — крик + tiles 3 + aimg (павший Лирой) — r3_1200_leeroy_q.jpg, r3_1200_leeroy_a.jpg, r3_1200_leeroy.mp3 (myinstants leeroy-jenkins-full, сильно снижена громкость).
- 1500 Command & Conquer: Red Alert 2 — «Hell March 2» + deblur (дирижабль «Киров») — r3_1500_kirov.jpg, r3_1500_hellmarch.mp3 (SoundCloud VideoGameScores, cut 24–46 с).
- 1800 Half-Life 2, Джи-Мэн («Rise and shine, Mr. Freeman») — zoom на галстук, area [35,66,34,34] — r3_1800_gman.jpg, r3_1800_gman.mp3 (myinstants).
- 2100 Fallout 3 — песня The Ink Spots + silhouette Vault Boy — r3_2100_vaultboy.png (прозрачный фон), r3_2100_fallout.mp3 (SoundCloud plus-cloud, cut 0–26 с).
- 2400 (бронза) TMNT (NES, Konami, 1989), уровень «Плотина» — tiles 4 — r3_2400_tmnt.jpg; звука нет.
- 2700 (серебро) Final Fantasy VII — «One-Winged Angel» + silhouette Сефирота — r3_2700_sephiroth.webp (прозрачный фон), r3_2700_ff7.mp3 (SoundCloud Final Fantasy Soundtracks, cut 62–86 с).
- 3000 (золото) Zero Wing («All your base are belong to us») — zoom на глаза злодея (area [36,20,22,22]) + aimg с кадром заставки — r3_3000_zerowing_q.jpg, r3_3000_zerowing_a.jpg.

Порядок (сложность растёт): прикидка доли угадавших 90→65→60→55→50→45→35→30→15 %.

## Осталось (если работу подхватывает другой агент)
1. python3 _work/tools/review.py _work/content/igrulki_r3.json — просмотр листа картинок (один раз).
2. Проверка: JSON валиден, все img/aimg/audio существуют (звук — в _private/media/music/igrulki/).
3. Мелочи на усмотрение: размер q ≤ ~160 знаков (сейчас 129–164).

## Инструменты (если нужно что-то заменить)
- Поиск картинок: Bing даёт мусор, используй Яндекс: python3 /tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad/ys.py "запрос" /tmp/igrulki_r3/s_xxx 8 префикс (лист — префикс_sheet.jpg); для прозрачного фона (fx silhouette): тот же каталог, ysa.py (помечает ALPHA). Большие PNG с альфой сохранять в WebP (quality 88, ≤ 400 КБ).
- Запись вопроса: scratchpad/addq.py вопрос.json (добавляет/заменяет по цене и сортирует). Поиск звуков myinstants: scratchpad/mi.py "запрос".
- В игре fx zoom показывает ровно прямоугольник area (js/game.js, picFit), а review.py и AGENT_RULES считают окно со стороной max(w,h)% — делай w=h, тогда одинаково.
- Заметка для координатора: в igrulki_r2 (2000) вопрос про Papers, Please — «пограничный инспектор/документы» — может попадать под запрет именинника (проверка документов); я его не трогал.
