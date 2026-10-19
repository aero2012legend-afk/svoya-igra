/* fx.js — конфетти, монеты, искры и салют на холсте поверх игры. */
(function () {
  'use strict';
  var cv = document.getElementById('fx'), c = cv.getContext('2d');
  var W = 0, H = 0, parts = [], rockets = [], running = false;
  var COLORS = ['#ffcc33', '#36e2ff', '#ff3fa4', '#2ee59d', '#ffffff', '#a77bff', '#ff7a3d'];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  function explode(x, y, col) {
    var k = H / 900, n = 110;
    for (var i = 0; i < n; i++) {
      var a = Math.PI * 2 * i / n + rnd(-0.05, 0.05), sp = rnd(2, 7) * k;
      parts.push({ k: 's', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(55, 95) | 0, max: 95, col: Math.random() < 0.2 ? '#fff' : col, s: rnd(1.6, 3.4) * k, g: 0.05, drag: 0.975 });
    }
  }
  function loop() {
    c.clearRect(0, 0, W, H);
    var k = H / 900;
    for (var r = rockets.length - 1; r >= 0; r--) {
      var R = rockets[r]; R.x += R.vx; R.y += R.vy; R.vy += 0.16 * k;
      parts.push({ k: 's', x: R.x, y: R.y, vx: rnd(-0.3, 0.3), vy: rnd(0, 0.6), life: 22, max: 22, col: '#ffd9a0', s: 1.8 * k, g: 0.02, drag: 0.98 });
      if (R.vy >= -0.6 * k) { explode(R.x, R.y, R.col); rockets.splice(r, 1); if (window.Sound) Sound.play('pop'); }
    }
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.life--;
      if (p.life <= 0 || p.y > H + 80) { parts.splice(i, 1); continue; }
      p.vy += (p.g == null ? 0.12 : p.g) * k; p.vx *= p.drag || 0.99; p.vy *= p.drag || 0.99; p.x += p.vx; p.y += p.vy;
      c.globalAlpha = Math.min(1, p.life / p.max * 1.6);
      if (p.k === 'c') {
        p.rot += p.vr; var w = Math.abs(Math.cos(p.rot * 2));
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col;
        c.fillRect(-p.s, -p.s * 0.4 * w, p.s * 2, p.s * 0.8 * w + 0.6); c.restore();
      } else if (p.k === 't') {
        c.font = p.s + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; c.fillText(p.t, p.x, p.y);
      } else {
        c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.283); c.fill();
      }
    }
    c.globalAlpha = 1;
    if (parts.length || rockets.length) requestAnimationFrame(loop);
    else { running = false; c.clearRect(0, 0, W, H); }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function cap() { if (parts.length > 1400) parts.splice(0, parts.length - 1400); }

  window.FX = {
    confetti: function (n, x, y) {
      n = n || 160; var k = H / 900, cx = x == null ? W / 2 : x, cy = y == null ? H * 0.2 : y, spread = x == null ? W * 0.35 : 40;
      for (var i = 0; i < n; i++) parts.push({ k: 'c', x: cx + rnd(-spread, spread), y: cy + rnd(-40, 20), vx: rnd(-7, 7) * k, vy: rnd(-13, -3) * k, life: rnd(130, 220) | 0, max: 220, col: COLORS[i % COLORS.length], s: rnd(5, 10) * k, rot: rnd(0, 6), vr: rnd(-0.3, 0.3), g: 0.2, drag: 0.985 });
      cap(); kick();
    },
    rain: function (glyph, n) {
      n = n || 50; var k = H / 900;
      for (var i = 0; i < n; i++) parts.push({ k: 't', t: glyph, x: rnd(0, W), y: rnd(-H * 0.7, -30), vx: rnd(-1, 1), vy: rnd(4, 9) * k, life: 300, max: 300, s: rnd(30, 70) * k, g: 0.14, drag: 0.995 });
      cap(); kick();
    },
    burst: function (x, y, col, n) {
      n = n || 50; var k = H / 900;
      for (var i = 0; i < n; i++) { var a = rnd(0, 6.283), sp = rnd(2, 10) * k; parts.push({ k: 's', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(30, 65) | 0, max: 65, col: col || COLORS[i % COLORS.length], s: rnd(2, 4.5) * k, g: 0.1, drag: 0.96 }); }
      cap(); kick();
    },
    fireworks: function (dur) {
      var end = Date.now() + (dur || 6000), k = H / 900;
      (function launch() {
        if (Date.now() > end) return;
        rockets.push({ x: rnd(W * 0.12, W * 0.88), y: H + 10, vx: rnd(-1.5, 1.5) * k, vy: -rnd(12, 15) * k, col: COLORS[(Math.random() * COLORS.length) | 0] });
        kick(); setTimeout(launch, rnd(220, 560));
      })();
    },
    clear: function () { parts = []; rockets = []; },
  };
})();
