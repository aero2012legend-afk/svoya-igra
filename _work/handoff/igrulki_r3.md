# Записка: Игрульки, раунд 3 (slug igrulki_r3) — для передачи работы другому агенту

Файл результата: _work/content/igrulki_r3.json (одна тема, round 3, name «Игрульки»; в questions — только готовые вопросы).
Звук: готовые mp3 — в _private/media/music/igrulki/r3_*.mp3, записи — в _work/audio/igrulki_r3.json. Картинки: media/img/igrulki/r3_<цена>_<что>.jpg.
Временные файлы: /tmp/igrulki_r3/ (сырой звук с myinstants — /tmp/igrulki_r3/raw/). Помощник поиска myinstants: /tmp/claude-0/-home-user-svoya-igra/795d83a0-58df-5c31-a907-79cf2837bdab/scratchpad/mi.py "запрос" (если пропал — страница https://www.myinstants.com/en/search/?name=запрос, mp3 в onclick="play('/media/sounds/...')").
Уже занятые игры (повторять нельзя): R1 — Mario, Minecraft, Angry Birds, Sims, Counter-Strike, GTA SA, S.T.A.L.K.E.R., DuckTales, Dota 2, Heroes 3; R2 — Tetris, Mortal Kombat, PvZ, Skyrim, Battle City, Sonic, Worms, Portal, Resident Evil, Papers Please. Табу: работа именинника (повар, транспортная безопасность, досмотр, документы), Касперский, Фанта; «Старый» не больше 2 раз на тему.

## Готово (цены)
- 600 Duck Hunt — в JSON, звук _private/media/music/igrulki/r3_600_duckhunt.mp3 (запись в _work/audio/igrulki_r3.json, пересоздаётся restore_audio.py), картинка media/img/igrulki/r3_600_duckhunt.jpg (fx pixel, px 24).
- 1200 Leeroy Jenkins / WoW — в JSON; звук r3_1200_leeroy.mp3 (в _work/audio/igrulki_r3.json), картинки r3_1200_leeroy_q.jpg (tiles 3) + r3_1200_leeroy_a.jpg (aimg).
- 1500 Half-Life 2, Джи-Мэн — в JSON; звук r3_1500_gman.mp3, картинка r3_1500_gman.jpg (zoom на галстук, area [35,66,34,34]).
- 300 Flappy Bird — в JSON; картинка r3_300_flappy.jpg (zoom на трубу, area [14.4,41.7,45,45]), звука нет.
- 900 «Ну, погоди!» — в JSON; картинка r3_900_nupogodi.jpg (zoom на LCD, area [19.5,25.5,61,61]); звука нет. NB: в игре zoom показывает ровно прямоугольник area, поэтому делай w=h (тогда и review.py, и игра показывают одно и то же).
- 1800 TMNT (NES) — в JSON; картинка r3_1800_tmnt.jpg (zoom на розовые водоросли, area [28,20,40,40]); звука нет.
- 2100 Fallout 3 (Ink Spots) — в JSON; звук r3_2100_fallout.mp3 (SoundCloud plus-cloud, cut 0–26 с), картинка r3_2100_vaultboy.png (Vault Boy с прозрачным фоном, fx silhouette).
- 2400 Red Alert 2 «Hell March 2» (бронза) — в JSON; звук r3_2400_hellmarch.mp3 (SoundCloud VideoGameScores, cut 24–46 с), картинка r3_2400_kirov.webp (дирижабль «Киров», прозрачный фон, fx silhouette).
- 2700 (серебро) FF7 — ГОТОВО.
- 3000 (золото) Zero Wing (Toaplan; аркада 1989, порт на Mega Drive в Европе 1991) — «All your base are belong to us». Описание про «самый знаменитый кривой перевод» + кадр заставки (без текста) через crop/pixel. Фразу лучше дать только в подсказке.
Запасные идеи, если что-то не найдётся: Metal Gear Solid «!» (raw/mgs1.mp3), Wololo (raw/wololo1.mp3), Deckard Cain (raw/cain1.mp3, Diablo), Star Fox 64 «Do a barrel roll» (raw/barrel.mp3), Crysis «Maximum armor» (raw/crysis_armor.mp3).
