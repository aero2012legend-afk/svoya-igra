# Звуки и музыка — авторы и лицензии

Здесь собрано всё, что лежит в `media/sfx/` (эффекты) и `media/bgm/` (фоновая музыка).
Почти всё — CC0 (можно свободно использовать и менять). **Два пункта требуют указания автора**: музыка Kevin MacLeod (CC BY 4.0) и звук `sad.mp3` (CC BY 3.0) — их тексты для титров в конце файла.

## Эффекты (`media/sfx/*.mp3`)

Все файлы обрезаны, выровнены по громкости (пик не выше −1 дБ, «звучность» стингов ≈ −15 LUFS, мелких щелчков — тише), mp3 128 кбит/с. Общий размер ≈ 1,5 МБ.
Если какого-то файла нет, `js/sound.js` играет встроенный синтез — игра продолжает работать.

### На основе записей (CC0, кроме `sad.mp3`)

| Файл | Источник | Лицензия |
|---|---|---|
| `fanfare.mp3` | OpenGameArt «Classic fanfare lick» (автор на странице: fvcalderan) + синтез: литавры, тарелка, колокольчики — https://opengameart.org/content/classic-fanfare-lick | CC0 |
| `win.mp3` | OpenGameArt «Trumpet Fanfare» (gchoc) + синтез: тарелка, глокеншпиль — https://opengameart.org/content/trumpet-fanfare | CC0 |
| `applause.mp3` | OpenGameArt «Applause in a large hall or church» (eXpl0it3r) — https://opengameart.org/content/applause-in-a-large-hall-or-church | CC0 |
| `laugh.mp3` | OpenGameArt «Group giggling» (озвучка AuraVoice, загрузил Nocturnal_Vanguard) — https://opengameart.org/content/group-giggling | CC0 |
| `cat.mp3` | OpenGameArt «Cat Purr & Meow» (Kerzoven) + синтез: звоночек — https://opengameart.org/content/cat-purr-meow | CC0 |
| `heart.mp3` | OpenGameArt «Heartbeat (single sound)» (Independent.nu / supergamez2014) — https://opengameart.org/content/heartbeat-single-sound | CC0 |
| `roll.mp3`, `flip.mp3`, `bid.mp3` | Kenney, «Casino Audio» (кубики, карта, фишка) — https://kenney.nl/assets/casino-audio | CC0 |
| `auction.mp3` | Kenney, «Impact Sounds» (дерево — молоток) + синтез: звонок — https://kenney.nl/assets/impact-sounds | CC0 |
| `freeze.mp3` | Kenney, «Impact Sounds» (стекло) + синтез: колокольчики | CC0 |
| `coin.mp3`, `bribe.mp3` | Kenney, «RPG Audio» (монеты, защёлка кассы) + синтез: звонки — https://kenney.nl/assets/rpg-audio | CC0 |
| `strike.mp3` | Kenney, «RPG Audio» (нож) + «Impact Sounds» (металл) | CC0 |
| `sad.mp3` | «Sad Trombone» — Joe Lamb (SoundBible.com), через Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Sad_Trombone-Joe_Lamb-665429450.ogg (оригинал: http://soundbible.com/1830-Sad-Trombone.html). Обрезан, выровнен по громкости, перекодирован в mp3 | **CC BY 3.0** |

### Синтез (создано для этого проекта, CC0)

Собрано программно (аддитивный/FM-синтез, формантный «хор», Karplus-Strong «арфа», барабаны, реверберация) — без чужих записей:
`select`, `vote`, `tick`, `tickFast`, `roul`, `beep`, `join`, `open`, `land`, `pop`, `swap`, `clap`, `correct`, `wrong`, `buzz`, `timeout`, `horn`,
`tada`, `results`, `medal`, `partial`, `bonus`, `round`, `final`, `go`, `drumroll`, `rimshot`, `flyby`, `whoosh`, `mashup`, `trap`, `angel`, `devil`, `sing`, `boo`.

## Фоновая музыка (`media/bgm/*.mp3`) — CC BY 4.0

Музыка: Kevin MacLeod (incompetech.com)
Лицензия: Creative Commons: By Attribution 4.0 — http://creativecommons.org/licenses/by/4.0/
Треки перемонтированы в бесшовные петли (фрагмент вырезан по сетке тактов, хвост подмешан в начало), выровнены по громкости (≈ −19 LUFS), mp3 128 кбит/с. Общий размер ≈ 10,8 МБ.
В файлах прописаны ID3-теги с автором и лицензией.

| Файл | Режим | Трек | Ссылка |
|---|---|---|---|
| `lobby-carefree.mp3` | lobby (ожидание гостей) | «Carefree» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037 |
| `board-easy-lemon.mp3` | board (табло) | «Easy Lemon» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200076 |
| `board-miami-viceroy.mp3` | board (табло) | «Miami Viceroy» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1700019 |
| `results-funky-chunk.mp3` | results (итоги раунда) | «Funky Chunk» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500054 |
| `results-enter-the-party.mp3` | results (итоги раунда) | «Enter the Party» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100240 |
| `end-disco-con-tutti.mp3` | end (победитель) | «Disco con Tutti» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1200091 |
| `think-thinking-music.mp3` | think (финальный раунд) | «Thinking Music» | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1600060 |

Если для режима несколько треков (табло, итоги), они чередуются при каждом новом входе в режим и продолжаются с того места, где остановились.

## Тексты для титров (если показываете авторов)

> Музыка: «Carefree», «Easy Lemon», «Miami Viceroy», «Funky Chunk», «Enter the Party», «Disco con Tutti», «Thinking Music» — Kevin MacLeod (incompetech.com).
> Licensed under Creative Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/

> Звук «Sad Trombone» — Joe Lamb (soundbible.com). Licensed under Creative Commons: By Attribution 3.0 — https://creativecommons.org/licenses/by/3.0/

Остальные звуки — CC0 (Kenney — kenney.nl, авторы с OpenGameArt — opengameart.org); упоминать их не обязательно, но будет приятно.
