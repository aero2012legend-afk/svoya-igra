/* sound.js — звук «Своей игры»: эффекты, фоновая музыка, громкость.

   ЭФФЕКТЫ   Sound.play('correct') — готовые файлы media/sfx/<имя>.mp3 (CC0, см. media/sfx/CREDITS.md).
             Порядок: свой файл из GAME.sounds → файл из media/sfx → встроенный синтез (если файла нет — ошибок нет).
             По http(s) звуки декодируются в AudioBuffer (мгновенный старт), на file:// играют через <audio>.
   МУЗЫКА    Sound.music('lobby'|'board'|'results'|'end'|null) — плавный кроссфейд ~1.5 с; null — тишина.
             Файлы media/bgm/*.mp3 — бесшовные петли (Kevin MacLeod, CC BY 4.0). Свои: GAME.music = { lobby: 'media/a.mp3',
             board: ['media/b1.mp3', 'media/b2.mp3'], results: false } (строка | массив — треки чередуются | функция | false — без музыки).
             Режим 'think' — музыка финального раунда; Sound.think(true/false) включает её (нет файла или think: false — синтез).
   ГРОМКОСТЬ Sound.setVolume(0..1) / Sound.volume — общая (хранится в localStorage 'svoyaigra.vol');
             Sound.setMusicVolume(0..1) / Sound.musicVolume — музыка, по умолчанию 0.3 ('svoyaigra.mvol');
             Sound.duck(true|false) — приглушить музыку (голос, видео); громкие эффекты приглушают её сами;
             Sound.toggleMute() / Sound.muted — выключить всё.
   ПРОЧЕЕ    Sound.init() (по клику), Sound.think(on), Sound.beat(on) — танцевальный бит,
             Sound.ctx() / Sound.out() — AudioContext и выходной узел (для анализаторов).
   Подмена звуков: GAME.sounds = { correct: 'media/my.mp3' } (строка или массив — случайный). */
(function () {
  'use strict';
  var ROOT = (function () {
    try { var m = /^(.*\/)js\/sound\.js(?:[?#].*)?$/.exec(document.currentScript.src); if (m) return m[1]; } catch (e) { /* ничего */ }
    return '';
  })();
  var IS_FILE = /^file:/i.test(location.protocol);
  var SFX_DIR = ROOT + 'media/sfx/', BGM_DIR = ROOT + 'media/bgm/';
  var REF = 0.85;                       // внутренний коэффициент: Sound.volume = 1 — прежняя громкость игры
  var XFADE = 1.5;                      // кроссфейд музыки, с
  var DUCK_MANUAL = 0.22, DUCK_AUTO = 0.4;

  var ctx = null, master = null, vol = 1, muted = false, noiseBuf = null, musicVol = 0.3, custom = {};
  var N = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  var noop = function () {};
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, String(v)); } catch (e) { /* приватный режим */ } }
  musicVol = clamp(num(lsGet('svoyaigra.mvol'), 0.3), 0, 1);
  vol = clamp(num(lsGet('svoyaigra.vol'), 1), 0, 1);

  /* ======================= каталог звуков ======================= */
  var SFX_NAMES = ('select flip whoosh open tick tickFast buzz correct wrong timeout cat auction trap coin land bribe roul round final fanfare ' +
    'join pop swap freeze bid angel devil bonus horn strike roll vote heart clap beep go win ' +
    'applause drumroll flyby mashup medal partial results sad sing tada rimshot laugh boo').split(' ');
  // длинные эффекты приглушают музыку на столько секунд
  var DUCK_SEC = { fanfare: 3.2, win: 2.8, applause: 3.6, results: 2.4, tada: 2.0, medal: 2.0, round: 2.8, final: 4.0, timeout: 2.6, sad: 3.4,
    rimshot: 1.5, laugh: 2.4, boo: 2.6, angel: 3.4, devil: 3.4, bonus: 2.4, trap: 2.4, auction: 2.4, mashup: 1.8, sing: 2.4, cat: 1.4, horn: 1.3,
    drumroll: 1.8, correct: 2.0, wrong: 1.4, partial: 1.4, bribe: 1.6, coin: 1.2, roll: 1.6, freeze: 1.8 };
  // музыка по режимам: [файл, усиление]
  var TRACKS = {
    lobby: [['lobby-carefree.mp3', 1]],
    board: [['board-easy-lemon.mp3', 1], ['board-miami-viceroy.mp3', 1]],
    results: [['results-funky-chunk.mp3', 1]],
    end: [['end-disco-con-tutti.mp3', 1]],
    think: [['think-thinking-music.mp3', 1.4]]
  };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') { try { var p = ctx.resume(); if (p && p.catch) p.catch(noop); } catch (e) { /* ничего */ } } resumeMusic(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { resumeMusic(); return; }
    try { ctx = new AC(); } catch (e) { ctx = null; resumeMusic(); return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : vol * REF;
    // файлы уже выровнены по громкости (пик ≤ −1 дБ), поэтому компрессор — лишь страховка от перегруза при наложении звуков
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -3; comp.knee.value = 6; comp.ratio.value = 10; comp.attack.value = 0.002; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ctx.destination);
    var map = (window.GAME && window.GAME.sounds) || {};
    Object.keys(map).forEach(function (k) {
      var v = map[k]; if (!v) return;
      var list = Array.isArray(v) ? v : [v];
      custom[k] = list.map(function (u) { var o = { url: u, bad: false }; probe(o); return o; });
    });
    decodeAll();
    resumeMusic();
  }
  function probe(o) {            // проверка своего файла: битый/отсутствующий — молча уходим на встроенный звук
    try {
      var a = new Audio(); a.preload = 'auto';
      a.addEventListener('error', function () { o.bad = true; });
      a.src = o.url; o.el = a;
    } catch (e) { o.bad = true; }
  }
  function osc(type, f0, f1, t, dur, v, a) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, v, ft, f0, f1, q) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = ft || 'bandpass'; f.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }
  // голос/медь через резонансный фильтр: нота [midi, начало, длительность]
  function wah(type, notes, v, f0, f1, q, slide) {
    return function (t) {
      notes.forEach(function (s, i) {
        var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = t + s[1], d = s[2];
        o.type = type; f.type = 'bandpass'; f.Q.value = q;
        o.frequency.setValueAtTime(N(s[0]), t0);
        if (slide && i === notes.length - 1) { o.frequency.setValueAtTime(N(s[0]), t0 + d * 0.4); o.frequency.exponentialRampToValueAtTime(N(s[0] - slide), t0 + d); }
        f.frequency.setValueAtTime(f0, t0); f.frequency.linearRampToValueAtTime(f1, t0 + d * 0.4); f.frequency.linearRampToValueAtTime((f0 + f1) / 2, t0 + d);
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.04); g.gain.setValueAtTime(v, t0 + d * 0.75); g.gain.linearRampToValueAtTime(0.0001, t0 + d);
        o.connect(f); f.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.05);
      });
    };
  }

  /* ---- встроенный синтез: запасной вариант, если файла нет ---- */
  var S = {
    select: function (t) { osc('triangle', 600, 1300, t, 0.12, 0.25); },
    flip: function (t) { noise(t, 0.45, 0.35, 'bandpass', 400, 3200, 0.8); osc('sine', 300, 900, t, 0.4, 0.1); },
    whoosh: function (t) { noise(t, 0.6, 0.35, 'bandpass', 200, 2600, 1.4); },
    open: function (t) { osc('sine', N(84), null, t, 0.5, 0.25); osc('sine', N(91), null, t + 0.07, 0.6, 0.18); },
    tick: function (t) { osc('square', 1800, null, t, 0.03, 0.05); },
    tickFast: function (t) { osc('square', 2400, null, t, 0.04, 0.08); osc('sine', 70, 40, t, 0.2, 0.55); },
    buzz: function (t) { [N(52), N(56), N(59)].forEach(function (f) { osc('square', f, null, t, 0.55, 0.12); }); osc('sawtooth', N(40), null, t, 0.55, 0.15); },
    correct: function (t) {
      [72, 76, 79, 84].forEach(function (n, i) { osc('triangle', N(n), null, t + i * 0.09, 0.35, 0.22); });
      [84, 88, 91].forEach(function (n) { osc('sine', N(n), null, t + 0.36, 0.9, 0.12); });
    },
    wrong: function (t) { osc('sawtooth', 220, 90, t, 0.6, 0.22); osc('square', 180, 70, t + 0.05, 0.6, 0.12); },
    timeout: function (t) { osc('sine', 110, 100, t, 1.6, 0.4); osc('triangle', 220, 210, t, 1.2, 0.15); noise(t, 0.6, 0.12, 'lowpass', 600, 200); },
    cat: function (t) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.Q.value = 5;
      o.frequency.setValueAtTime(480, t); o.frequency.linearRampToValueAtTime(880, t + 0.25); o.frequency.linearRampToValueAtTime(560, t + 0.75);
      f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1900, t + 0.3); f.frequency.linearRampToValueAtTime(1000, t + 0.75);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.85);
      osc('sine', N(84), null, t + 0.9, 0.2, 0.12); osc('sine', N(88), null, t + 1.02, 0.3, 0.12);
    },
    auction: function (t) {
      [0, 0.38, 0.76].forEach(function (d) { noise(t + d, 0.14, 0.9, 'lowpass', 900, 200); osc('sine', 160, 55, t + d, 0.18, 0.7); });
      [67, 72, 76, 79].forEach(function (n) { osc('sawtooth', N(n), null, t + 1.1, 1, 0.07); });
    },
    trap: function (t) { for (var i = 0; i < 4; i++) { osc('square', 650, 1100, t + i * 0.38, 0.19, 0.12); osc('square', 1100, 650, t + i * 0.38 + 0.19, 0.19, 0.12); } },
    coin: function (t) { [0, 0.08, 0.16, 0.3, 0.5].forEach(function (d, i) { osc('sine', 2600 + i * 350, null, t + d, 0.4, 0.1); }); },
    land: function (t) { osc('sine', 3200, 3000, t, 0.6, 0.15); osc('sine', 4800, null, t + 0.02, 0.4, 0.06); noise(t, 0.05, 0.3, 'highpass', 4000); },
    bribe: function (t) {
      noise(t, 0.08, 0.5, 'highpass', 3000); osc('sine', N(96), null, t + 0.06, 0.9, 0.25); osc('sine', N(100), null, t + 0.06, 0.9, 0.15);
      [0.3, 0.42, 0.54, 0.66, 0.8].forEach(function (d) { osc('sine', 2800 + Math.random() * 1600, null, t + d, 0.15, 0.06); });
    },
    roul: function (t) { osc('square', 1500, null, t, 0.02, 0.07); },
    round: function (t) {
      for (var i = 0; i < 12; i++) noise(t + i * 0.05, 0.05, 0.25 + i * 0.03, 'bandpass', 200, 150, 1);
      [60, 64, 67, 72].forEach(function (n) { osc('sawtooth', N(n), null, t + 0.62, 1.2, 0.07); });
      osc('sine', N(48), null, t + 0.62, 1.4, 0.3);
    },
    final: function (t) { [48, 55, 60, 63].forEach(function (n, i) { osc('sawtooth', N(n), null, t + i * 0.03, 2.4, 0.08); }); noise(t, 2, 0.08, 'lowpass', 300, 100); osc('sine', N(36), null, t, 2.6, 0.35); },
    fanfare: function (t) {
      [[67, 0], [67, 0.15], [67, 0.3], [72, 0.45], [76, 0.9], [79, 1.2], [84, 1.5]].forEach(function (s) {
        osc('sawtooth', N(s[0]), null, t + s[1], 0.4, 0.09); osc('square', N(s[0] - 12), null, t + s[1], 0.4, 0.05);
      });
      [72, 76, 79, 84].forEach(function (n) { osc('sawtooth', N(n), null, t + 1.9, 1.8, 0.06); });
    },
    join: function (t) { osc('sine', N(76), null, t, 0.25, 0.15); osc('sine', N(83), null, t + 0.1, 0.35, 0.15); },
    pop: function (t) { noise(t, 0.3, 0.35, 'lowpass', 2200, 300); osc('sine', 180, 60, t, 0.25, 0.22); },
    swap: function (t) { osc('triangle', 300, 1200, t, 0.3, 0.2); osc('triangle', 1200, 300, t + 0.3, 0.3, 0.2); },
    freeze: function (t) { [96, 91, 98, 93, 100].forEach(function (n, i) { osc('sine', N(n), null, t + i * 0.07, 0.6, 0.08); }); noise(t, 0.8, 0.15, 'highpass', 5000); },
    bid: function (t) { osc('triangle', N(79), null, t, 0.15, 0.15); osc('triangle', N(86), null, t + 0.06, 0.2, 0.12); },
    angel: function (t) {
      [60, 64, 67, 72, 76, 79, 84, 88, 91, 96].forEach(function (n, i) { osc('sine', N(n), null, t + i * 0.055, 1.3, 0.09); osc('triangle', N(n + 12), null, t + i * 0.055, 0.5, 0.025); });
      [84, 88, 91].forEach(function (n) { osc('sine', N(n), null, t + 0.6, 1.6, 0.05); }); noise(t + 0.4, 1.4, 0.04, 'highpass', 8000);
    },
    devil: function (t) {
      osc('sawtooth', N(38), N(26), t, 1.7, 0.2); osc('sawtooth', N(39), N(27), t, 1.7, 0.13); noise(t, 1.5, 0.35, 'lowpass', 420, 60);
      [62, 56, 50].forEach(function (n, i) { osc('square', N(n), null, t + 0.25 + i * 0.32, 0.38, 0.06); });
    },
    bonus: function (t) {
      [72, 76, 79, 84, 88, 91, 96].forEach(function (n, i) { osc('triangle', N(n), null, t + i * 0.05, 0.3, 0.13); });
      [84, 88, 91, 96].forEach(function (n) { osc('sine', N(n), null, t + 0.4, 1.1, 0.08); }); noise(t + 0.35, 0.8, 0.05, 'highpass', 7000);
    },
    horn: function (t) { osc('square', 150, null, t, 0.95, 0.2, 0.02); osc('sawtooth', 155, null, t, 0.95, 0.13, 0.02); },
    strike: function (t) { noise(t, 0.28, 0.45, 'bandpass', 3200, 1100, 2); osc('sawtooth', 900, 180, t, 0.26, 0.07); },
    roll: function (t) { for (var i = 0; i < 26; i++) noise(t + i * 0.055, 0.06, 0.12 + i * 0.012, 'bandpass', 260, 200, 1); osc('sine', 85, 45, t + 1.45, 0.45, 0.45); noise(t + 1.45, 0.5, 0.35, 'highpass', 5000); },
    vote: function (t) { osc('sine', N(84), N(91), t, 0.14, 0.16); },
    heart: function (t) { osc('sine', 72, 42, t, 0.18, 0.55); osc('sine', 66, 38, t + 0.24, 0.2, 0.42); },
    clap: function (t) { noise(t, 0.13, 0.55, 'bandpass', 1500, 900, 1.4); osc('sine', 200, 90, t, 0.1, 0.15); },
    beep: function (t) { osc('square', 880, null, t, 0.14, 0.12); },
    go: function (t) { osc('square', 1320, null, t, 0.32, 0.13); [72, 79, 84].forEach(function (n) { osc('sawtooth', N(n), null, t, 0.5, 0.06); }); },
    win: function (t) {
      [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]].forEach(function (s) { osc('sawtooth', N(s[0]), null, t + s[1], 0.3, 0.08); osc('square', N(s[0] - 12), null, t + s[1], 0.3, 0.04); });
      [72, 76, 79, 84].forEach(function (n) { osc('triangle', N(n), null, t + 0.45, 1.2, 0.09); });
    },
    // --- новые имена ---
    applause: function (t) {
      for (var i = 0; i < 6; i++) noise(t + i * 0.55, 0.9, 0.07, 'bandpass', 2200, 1800, 0.5);
      for (var j = 0; j < 90; j++) noise(t + 0.05 + Math.random() * 3.1, 0.035, 0.1 * (0.4 + Math.random()), 'bandpass', 1200 + Math.random() * 2400, 900, 1.2);
    },
    drumroll: function (t) { for (var i = 0; i < 52; i++) noise(t + i * 0.031, 0.05, 0.05 + i * 0.006, 'bandpass', 240, 200, 1); noise(t, 1.6, 0.04, 'highpass', 5000, 8000); },
    flyby: function (t) { noise(t, 0.8, 0.35, 'bandpass', 250, 4200, 1.2); },
    mashup: function (t) {
      for (var i = 0; i < 6; i++) noise(t + i * 0.07, 0.07, 0.4, 'bandpass', 600 + (i % 2) * 1800, 900 + (i % 3) * 700, 3);
      [[0.5, 0.25], [0.8, 0.25], [1.1, 0.7]].forEach(function (s, k) { [60 + k * 2, 63 + k * 2, 67 + k * 2, 70 + k * 2].forEach(function (n) { osc('sawtooth', N(n), null, t + s[0], s[1], 0.06); }); });
      noise(t + 1.1, 0.8, 0.25, 'highpass', 5000, 7000);
    },
    medal: function (t) {
      osc('sine', 110, 50, t, 0.5, 0.4); noise(t, 0.6, 0.12, 'highpass', 5000, 8000);
      [84, 88, 91, 96].forEach(function (n, i) { osc('sine', N(n), null, t + 0.3 + i * 0.075, 1.2, 0.1); osc('triangle', N(n - 12), null, t + 0.3 + i * 0.075, 0.6, 0.05); });
      [72, 76, 79].forEach(function (n) { osc('sawtooth', N(n), null, t + 0.62, 0.7, 0.05); });
    },
    partial: function (t) { osc('triangle', N(79), null, t, 0.5, 0.18); osc('triangle', N(84), null, t + 0.12, 0.6, 0.18); osc('sine', N(98), null, t + 0.26, 0.8, 0.08); },
    results: function (t) {
      [48, 55, 60, 64, 67, 72].forEach(function (n) { osc('sawtooth', N(n), null, t, 1.8, 0.05); osc('triangle', N(n + 12), null, t, 1.2, 0.04); });
      osc('sine', 82, 40, t, 0.7, 0.5); noise(t, 1.8, 0.2, 'highpass', 4000, 6000);
      [84, 88, 91, 96].forEach(function (n, i) { osc('sine', N(n), null, t + 0.1 + i * 0.07, 1.2, 0.08); });
    },
    sad: wah('sawtooth', [[58, 0, 0.32], [57, 0.38, 0.32], [56, 0.76, 0.32], [55, 1.14, 1.4]], 0.4, 450, 1300, 3, 3),
    sing: wah('sawtooth', [[72, 0, 0.26], [76, 0.3, 0.26], [79, 0.6, 0.26], [84, 0.9, 0.9]], 0.3, 700, 1100, 4, 0),
    tada: function (t) {
      osc('sawtooth', N(67), null, t, 0.16, 0.1); osc('sawtooth', N(72), null, t, 0.16, 0.08);
      [60, 64, 67, 72, 76].forEach(function (n) { osc('sawtooth', N(n), null, t + 0.2, 1.2, 0.06); });
      osc('sine', 98, 50, t + 0.2, 0.6, 0.4); noise(t + 0.2, 1.4, 0.15, 'highpass', 4500, 7000);
      [72, 76, 79, 84, 88, 91, 96, 100].forEach(function (n, i) { osc('sine', N(n), null, t + 0.2 + i * 0.045, 1, 0.05); });
    },
    rimshot: function (t) {
      noise(t, 0.12, 0.6, 'bandpass', 1800, 900, 1); osc('sine', 200, 90, t, 0.1, 0.4);
      osc('sine', 130, 70, t + 0.14, 0.3, 0.55); noise(t + 0.44, 1.1, 0.3, 'highpass', 5000, 7000);
    },
    laugh: function (t) {
      for (var i = 0; i < 9; i++) { var t0 = t + i * 0.17, f = 260 + Math.random() * 120 - i * 8; osc('sawtooth', f, f * 0.9, t0, 0.12, 0.07); noise(t0, 0.1, 0.12, 'bandpass', 1200, 900, 2); }
    },
    boo: function (t) {
      [98, 110, 123, 131].forEach(function (f, i) { osc('sawtooth', f, f * 0.84, t + i * 0.03, 1.8, 0.05, 0.15); });
      noise(t, 1.8, 0.2, 'bandpass', 320, 270, 4); noise(t, 1.5, 0.1, 'bandpass', 870, 760, 5);
    }
  };

  /* ======================= файлы эффектов ======================= */
  var raw = {}, bufs = {}, st = {}, waiters = {}, pools = {}, started = false;
  function sfxUrl(n) { return SFX_DIR + n + '.mp3'; }
  function canFetch() { return !IS_FILE && typeof fetch === 'function'; }
  function startLoading() {                 // по http(s) качаем все эффекты сразу (≈1.6 МБ), декодируем после init()
    if (started) return; started = true;
    if (canFetch()) {
      var q = SFX_NAMES.slice(), active = 0;
      q.forEach(function (n) { st[n] = 'loading'; });
      var pump = function () {
        while (active < 4 && q.length) {
          (function (n) {
            active++;
            var fin = function () { active--; pump(); };
            try {
              fetch(sfxUrl(n)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
                .then(function (ab) { raw[n] = ab; st[n] = 'raw'; if (ctx) decode(n); fin(); }, function () { st[n] = 'failed'; flush(n, null); fin(); });
            } catch (e) { st[n] = 'failed'; flush(n, null); fin(); }
          })(q.shift());
        }
      };
      pump();
    } else {
      SFX_NAMES.forEach(function (n) { fileEl(n, true); });   // file://: <audio>-элементы (fetch там запрещён)
    }
  }
  function flush(n, b) { var w = waiters[n]; if (!w) return; waiters[n] = null; w.forEach(function (fn) { try { fn(b); } catch (e) { /* ничего */ } }); }
  function decode(n) {
    if (!ctx || !raw[n] || st[n] === 'decoding') return;
    st[n] = 'decoding'; var ab = raw[n]; delete raw[n]; var done = false;
    var ok = function (b) { if (done) return; done = true; bufs[n] = b; st[n] = 'ready'; flush(n, b); };
    var bad = function () { if (done) return; done = true; st[n] = 'failed'; flush(n, null); };
    try { var p = ctx.decodeAudioData(ab, ok, bad); if (p && p.then) p.then(ok, bad); } catch (e) { bad(); }
  }
  function decodeAll() {
    startLoading();
    SFX_NAMES.forEach(function (n) { if (st[n] === 'raw') decode(n); });
  }
  function whenReady(n, cb) {               // cb(buffer|null)
    if (bufs[n]) return cb(bufs[n]);
    var s = st[n];
    if (s === 'loading' || s === 'raw' || s === 'decoding') { (waiters[n] = waiters[n] || []).push(cb); if (s === 'raw') decode(n); return; }
    cb(null);
  }
  function fileEl(n, create) {              // <audio> для режима file:// и запасной вариант
    var p = pools[n];
    if (!p && create) {
      var a = new Audio(); a.preload = 'auto';
      p = pools[n] = { els: [a], bad: false };
      a.addEventListener('error', function () { p.bad = true; });
      a.src = sfxUrl(n);
    }
    return p;
  }
  function playEl(p, url, gain) {           // проигрывание из пула <audio> (до 4 одновременно)
    var el = null, i;
    for (i = 0; i < p.els.length; i++) if (p.els[i].paused || p.els[i].ended) { el = p.els[i]; break; }
    if (!el) {
      if (p.els.length < 4) {
        el = new Audio(); el.preload = 'auto'; el.addEventListener('error', function () { p.bad = true; }); el.src = url; p.els.push(el);
      } else el = p.els[0];
    }
    try { el.currentTime = 0; } catch (e) { /* ещё не загружен */ }
    el.volume = clamp(vol * REF * (gain || 1), 0, 1); el.muted = muted;
    var pr; try { pr = el.play(); } catch (e) { pr = null; }
    if (pr && pr.catch) pr.catch(noop);
  }
  function playBuf(n, b) {
    var s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start(ctx.currentTime + 0.005);
  }
  function autoDuck(n) { var d = DUCK_SEC[n]; if (d) autoUntil = Math.max(autoUntil, nowMs() + d * 1000); kick(); }

  function play(name) {
    if (muted) return; init();
    // пока пользователь не нажал ничего на странице, контекст «спит»: не копим звуки, чтобы они не выстрелили пачкой после первого клика
    if (ctx && ctx.state === 'suspended') { try { var ua = navigator.userActivation; if (ua && !ua.isActive) return; } catch (e) { /* старый браузер */ } }
    // 1) свой файл из GAME.sounds
    var c = custom[name];
    if (c) {
      var ok = c.filter(function (o) { return !o.bad; });
      if (ok.length) {
        var o = ok[(Math.random() * ok.length) | 0];
        var p = pools['c:' + o.url] || (pools['c:' + o.url] = { els: [], bad: false });
        playEl(p, o.url, 1); autoDuck(name); return;
      }
    }
    // 2) файл из media/sfx
    if (SFX_NAMES.indexOf(name) >= 0) {
      if (canFetch() && ctx) {
        startLoading();
        var t0 = nowMs();
        whenReady(name, function (b) {
          if (b) { if (nowMs() - t0 < 1200) { try { playBuf(name, b); autoDuck(name); } catch (e) { synth(name); } } return; }
          synth(name);
        });
        return;
      }
      var p2 = fileEl(name, true);
      if (p2 && !p2.bad) { playEl(p2, sfxUrl(name), 1); autoDuck(name); return; }
    }
    // 3) синтез
    synth(name);
  }
  function synth(name) {
    if (!ctx || muted) return;
    var f = S[name]; if (f) { try { f(ctx.currentTime + 0.01); autoDuck(name); } catch (e) { console.warn(e); } }
  }

  /* ======================= танцевальный бит (как раньше) ======================= */
  var beatT = null;
  function beat(on) {
    clearInterval(beatT); beatT = null; if (!on) return; init(); if (!ctx) return;
    var step = 0, dt = 60 / 124 / 4, next = ctx.currentTime + 0.06;
    var BASS = [45, 41, 48, 43], PADS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
    beatT = setInterval(function () {
      while (next < ctx.currentTime + 0.25) {
        var s = step % 16, bar = Math.floor(step / 16) % 4, t = next;
        if (s % 4 === 0) osc('sine', 160, 45, t, 0.26, 0.9, 0.003);
        if (s % 4 === 2) { noise(t, 0.09, 0.16, 'highpass', 7000); osc('triangle', N(BASS[bar]), null, t, 0.2, 0.28); }
        if (s % 2 === 1) noise(t, 0.035, 0.05, 'highpass', 9000);
        if (s === 4 || s === 12) noise(t, 0.14, 0.38, 'bandpass', 1300, 900, 1.2);
        if (s === 0) PADS[bar].forEach(function (n) { osc('triangle', N(n), null, t, 1.85, 0.035, 0.08); });
        if (s === 14 && bar === 3) osc('sawtooth', N(76), N(88), t, 0.2, 0.05);
        next += dt; step++;
      }
    }, 60);
  }

  /* ======================= фоновая музыка ======================= */
  var tracks = [];                  // играющие и затухающие треки
  var elCache = {};                 // url -> <audio> (на паузе хранит позицию)
  var bad = {};                     // url -> true, если файл не открылся
  var mode = null;                  // запрошенный режим музыки
  var rot = {};                     // режим -> индекс последнего трека
  var think_ = null;                // трек «think» (отдельный слой)
  var duckOn = false, duckF = 1, autoUntil = 0, loopT = null, lastT = 0, armed = false, genId = 0;
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function modeList(m) {            // -> [{src: url|function, g}]
    var g = window.GAME && window.GAME.music, v = g ? g[m] : undefined;
    if (v === false || v === null || v === '') return [];
    if (v !== undefined) return (Array.isArray(v) ? v : [v]).filter(Boolean).map(function (x) { return { src: x, g: 1 }; });
    return (TRACKS[m] || []).map(function (x) { return { src: BGM_DIR + x[0], g: x[1] }; });
  }
  function getEl(url) {
    var el = elCache[url];
    if (el) return el;
    el = new Audio(); el.preload = 'auto'; el.loop = true;
    el.addEventListener('error', function () { bad[url] = true; onBad(url); });
    el.src = url; elCache[url] = el;
    return el;
  }
  function onBad(url) {             // файл не открылся: убираем трек; если нужен — пробуем следующий из списка
    var wasCur = false;
    tracks = tracks.filter(function (t) { if (t.url === url) { if (t.ft > 0) wasCur = true; return false; } return true; });
    if (think_ && think_.url === url) { think_ = null; if (thinkT_wanted()) thinkSynth(); }
    if (wasCur && mode) { var m = mode; mode = null; music(m, true); }
  }
  function playTrackEl(t) {
    var pr; try { pr = t.el.play(); } catch (e) { pr = null; }
    if (pr && pr.catch) pr.catch(function (e) { if (e && e.name === 'NotAllowedError') { t.blocked = true; arm(); } });
  }
  function arm() {                  // автозапуск звука запрещён — повторим после первого действия пользователя
    if (armed) return; armed = true;
    var ev = ['pointerdown', 'keydown', 'touchstart', 'click'];
    var h = function () { ev.forEach(function (e) { document.removeEventListener(e, h, true); }); armed = false; init(); resumeMusic(); };
    ev.forEach(function (e) { document.addEventListener(e, h, true); });
  }
  function resumeMusic() {
    tracks.forEach(function (t) { if (t.ft > 0 && t.el.paused) { if (t.blocked) { t.blocked = false; t.f = 0; } playTrackEl(t); } });
  }
  function trackVol(t) { return clamp(musicVol * vol * duckF * t.g * Math.sin(clamp(t.f, 0, 1) * Math.PI / 2), 0, 1); }
  function kick() { if (!loopT && tracks.length) { lastT = nowMs(); loopT = setInterval(tick, 40); } }
  function tick() {
    var now = nowMs(), dt = Math.min(0.3, (now - lastT) / 1000); lastT = now;
    var target = Math.min(duckOn ? DUCK_MANUAL : 1, now < autoUntil ? DUCK_AUTO : 1);
    duckF += (target - duckF) * (1 - Math.exp(-dt / (target < duckF ? 0.12 : 0.45)));
    tracks = tracks.filter(function (t) {
      if (t.f < t.ft) t.f = Math.min(t.ft, t.f + dt / t.fd); else if (t.f > t.ft) t.f = Math.max(t.ft, t.f - dt / t.fd);
      if (t.ft === 0 && t.f <= 0) { try { t.el.pause(); } catch (e) { /* ничего */ } if (think_ === t) think_ = null; return false; }
      try { t.el.volume = trackVol(t); t.el.muted = muted; } catch (e) { /* ничего */ }
      return true;
    });
    if (!tracks.length && Math.abs(duckF - 1) < 0.01 && now >= autoUntil) { clearInterval(loopT); loopT = null; }
  }
  function addTrack(url, g, fd, fromStart) {
    var el = getEl(url), t = null;
    for (var i = 0; i < tracks.length; i++) if (tracks[i].el === el) { t = tracks[i]; break; }
    if (t) { t.ft = 1; t.fd = fd; t.g = g; }
    else {
      if (fromStart) { try { el.currentTime = 0; } catch (e) { /* ещё не загружен */ } }
      t = { el: el, url: url, g: g, f: 0, ft: 1, fd: fd };
      tracks.push(t);
    }
    el.loop = true; el.muted = muted; el.volume = trackVol(t);
    if (el.paused) playTrackEl(t);
    kick();
    return t;
  }
  function fadeOut(t, fd) { t.ft = 0; t.fd = fd || XFADE; kick(); }
  function resolve(src, cb) {       // строка | функция (может вернуть промис) -> url
    if (typeof src === 'function') {
      try { var r = src(); if (r && r.then) r.then(cb, noop); else cb(r); } catch (e) { /* ничего */ }
    } else cb(src);
  }

  function music(m, retry) {
    if (m === undefined) m = null;
    if (m === mode && !retry) return;
    var id = ++genId;
    mode = m || null;
    tracks.forEach(function (t) { if (t !== think_ && t.ft > 0) fadeOut(t); });
    if (!mode) return;
    init();
    var list = modeList(mode).filter(function (x) { return typeof x.src === 'function' || !bad[x.src]; });
    if (!list.length) return;
    var i = rot[mode] === undefined ? (Math.random() * list.length) | 0 : (rot[mode] + 1) % list.length;
    if (retry && rot[mode] !== undefined) i = (rot[mode] + 1) % list.length;
    rot[mode] = i;
    var pick = list[i];
    resolve(pick.src, function (url) {
      if (!url || id !== genId || mode === null) return;
      addTrack(url, pick.g, XFADE, false);
    });
  }
  function setMusicVolume(v) { musicVol = clamp(num(v, musicVol), 0, 1); lsSet('svoyaigra.mvol', musicVol); kick(); tick(); return musicVol; }
  function setVolume(v) {
    vol = clamp(num(v, vol), 0, 1); lsSet('svoyaigra.vol', vol);
    if (master) master.gain.value = muted ? 0 : vol * REF;
    kick(); tick(); return vol;
  }
  function duck(on) { duckOn = !!on; kick(); }

  /* ======================= «думай!» — музыка финала ======================= */
  var thinkT = null, thinkWanted = false;
  function thinkT_wanted() { return thinkWanted && !muted; }
  function thinkSynth() {
    clearInterval(thinkT); thinkT = null; init(); if (!ctx) return;
    var seq = [60, 64, 67, 71, 72, 71, 67, 64], i = 0;
    thinkT = setInterval(function () {
      var t = ctx.currentTime + 0.01;
      osc('triangle', N(seq[i % 8] + (i % 32 < 16 ? 0 : -3)), null, t, 0.28, 0.07);
      if (i % 4 === 0) osc('sine', N(i % 32 < 16 ? 36 : 33), null, t, 1, 0.2);
      i++;
    }, 300);
  }
  function think(on) {
    clearInterval(thinkT); thinkT = null; thinkWanted = !!on;
    if (think_) { fadeOut(think_, 0.5); think_ = null; }
    if (!on || muted) return;
    init();
    var list = modeList('think').filter(function (x) { return typeof x.src === 'function' || !bad[x.src]; });
    if (!list.length) return thinkSynth();
    var pick = list[(Math.random() * list.length) | 0];
    resolve(pick.src, function (url) {
      if (!url || !thinkWanted) return;
      var tr = addTrack(url, pick.g, 0.6, true); think_ = tr;
    });
  }

  window.Sound = {
    init: init, play: play, think: think, beat: beat,
    toggleMute: function () {
      muted = !muted; if (muted) { clearInterval(thinkT); thinkT = null; }
      if (master) master.gain.value = muted ? 0 : vol * REF;
      tracks.forEach(function (t) { try { t.el.muted = muted; } catch (e) { /* ничего */ } });
      if (!muted && thinkWanted && !think_ && !thinkT) think(true);
      return muted;
    },
    get muted() { return muted; },
    ctx: function () { init(); return ctx; }, out: function () { init(); return master; },
    music: music, duck: duck,
    setMusicVolume: setMusicVolume, get musicVolume() { return musicVol; },
    setVolume: setVolume, get volume() { return vol; },
    get musicMode() { return mode; }
  };
  // эффекты начинают скачиваться сразу после загрузки страницы (по http(s)); на file:// — <audio>
  try { startLoading(); } catch (e) { /* без звука игра работает */ }
})();
