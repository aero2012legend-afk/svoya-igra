/* sound.js — все звуки синтезируются прямо в браузере (Web Audio).
   Любой звук можно заменить своим файлом: см. sounds в questions.js */
(function () {
  'use strict';
  var ctx = null, master = null, vol = 0.85, muted = false, noiseBuf = null, custom = {};
  var N = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    var map = (window.GAME && window.GAME.sounds) || {};
    Object.keys(map).forEach(function (k) { if (map[k]) { var a = new Audio(map[k]); a.preload = 'auto'; custom[k] = a; } });
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
  };
  // танцевальный бит 124 BPM: бочка в каждую долю, тарелки, хлопки, бас на слабую долю, аккорды Am–F–C–G
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

  function play(name) {
    if (muted) return; init(); if (!ctx) return;
    if (custom[name]) { try { var a = custom[name].cloneNode(); a.volume = vol; a.play(); } catch (e) {} return; }
    var f = S[name]; if (f) { try { f(ctx.currentTime + 0.01); } catch (e) { console.warn(e); } }
  }
  var thinkT = null;
  function think(on) {
    clearInterval(thinkT); thinkT = null; if (!on || muted) return; init(); if (!ctx) return;
    var seq = [60, 64, 67, 71, 72, 71, 67, 64], i = 0;
    thinkT = setInterval(function () {
      var t = ctx.currentTime + 0.01;
      osc('triangle', N(seq[i % 8] + (i % 32 < 16 ? 0 : -3)), null, t, 0.28, 0.07);
      if (i % 4 === 0) osc('sine', N(i % 32 < 16 ? 36 : 33), null, t, 1, 0.2);
      i++;
    }, 300);
  }
  window.Sound = {
    init: init, play: play, think: think, beat: beat,
    toggleMute: function () { muted = !muted; if (muted) think(false); if (master) master.gain.value = muted ? 0 : vol; return muted; },
    get muted() { return muted; },
    ctx: function () { init(); return ctx; }, out: function () { init(); return master; },
  };
})();
