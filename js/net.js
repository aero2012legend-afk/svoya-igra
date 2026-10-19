/* net.js — связь телевизора с телефонами.
   1) Прямое соединение WebRTC по Wi-Fi (телефон ↔ компьютер), когда получается.
   2) Запасной путь — MQTT 3.1.1 поверх WebSocket через бесплатные открытые серверы.
      Из России соединения с зарубежными серверами «замерзают» примерно после 16 КБ данных,
      поэтому клиент заранее открывает новое соединение и бесшовно переключается на него. */
(function () {
  'use strict';
  var BROKERS = [
    { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
    { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
    { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
    { name: 'Eclipse', url: 'wss://mqtt.eclipseprojects.io:443/mqtt' },
  ];
  var RX_LIMIT = 4500, TX_LIMIT = 9000; // после стольких байт — новое соединение
  var params = new URLSearchParams(location.search);
  var override = params.get('broker'); // для проверки: ?broker=ws://localhost:8888/mqtt
  var PREFIX = 'sviq1/';
  var PING = new Uint8Array([0xC0, 0]);
  var te = new TextEncoder(), td = new TextDecoder();

  function str(s) { var b = te.encode(s), o = new Uint8Array(b.length + 2); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
  function pkt(first, parts) {
    var len = 0; parts.forEach(function (p) { len += p.length; });
    var rl = [], n = len;
    do { var d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; rl.push(d); } while (n > 0);
    var o = new Uint8Array(1 + rl.length + len); o[0] = first; o.set(rl, 1);
    var i = 1 + rl.length; parts.forEach(function (p) { o.set(p, i); i += p.length; });
    return o;
  }

  function Client(url) {
    var self = this;
    this.url = url; this.subs = new Set(); this.msgL = []; this.stL = [];
    this.online = false; this.c = null; this.nx = null; this.mid = 1; this.rots = 0; this.rotAt = 0;
    this.pendR = new Map(); this.queue = []; this.closed = false; this.backoff = 700;
    this.open(false);
    this.pingT = setInterval(function () { self.check(); }, 5000);
    var wake = function () { if (!document.hidden) self.kick(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
  }
  var P = Client.prototype;
  P.setStatus = function (on) {
    if (this.online === on) return; this.online = on;
    this.stL.forEach(function (f) { try { f(on); } catch (e) { console.error(e); } });
  };
  P.onStatus = function (f) { this.stL.push(f); };
  P.onMessage = function (f) { this.msgL.push(f); };

  // открыть соединение; rot = true — запасное, пока старое ещё работает
  P.open = function (rot) {
    var self = this; if (this.closed) return;
    var ws;
    try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { if (!rot) this.retry(); return; }
    var c = { ws: ws, buf: new Uint8Array(0), rx: 0, tx: 0, ready: false, wait: 0, at: Date.now(), last: Date.now(), dead: false };
    ws.binaryType = 'arraybuffer';
    if (rot) { this.nx = c; this.rotAt = Date.now(); } else this.c = c;
    c.to = setTimeout(function () { self.kill(c); }, 7000);
    ws.onopen = function () { self.raw(c, pkt(0x10, [str('MQTT'), new Uint8Array([4, 2, 0, 90]), str('sv' + Math.random().toString(36).slice(2, 12))])); };
    ws.onmessage = function (ev) {
      var d = new Uint8Array(ev.data); c.rx += d.length; c.last = Date.now();
      self.feed(c, d);
      if (c === self.c) self.maybeRotate();
    };
    ws.onclose = function () { self.kill(c); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  };
  P.raw = function (c, bytes) {
    if (!c || c.dead || c.ws.readyState !== 1) return false;
    try { c.ws.send(bytes); } catch (e) { return false; }
    c.tx += bytes.length;
    if (c === this.c) this.maybeRotate();
    return true;
  };
  P.maybeRotate = function () {
    var c = this.c;
    if (!c || !c.ready || this.nx || this.closed) return;
    if ((c.rx > RX_LIMIT || c.tx > TX_LIMIT) && Date.now() - this.rotAt > 2500) this.open(true);
  };
  P.kill = function (c) {
    if (!c || c.dead) return;
    c.dead = true; clearTimeout(c.to);
    var ws = c.ws; ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) {}
    if (c === this.nx) { this.nx = null; return; }
    if (c !== this.c) return;
    this.c = null;
    if (this.nx) { // запасное соединение становится основным
      var n = this.nx; this.nx = null; this.c = n;
      if (n.ready) this.goOnline(n); else this.setStatus(false);
      return;
    }
    this.setStatus(false); this.retry();
  };
  P.retry = function () {
    var self = this; if (this.closed) return;
    clearTimeout(this.rt);
    this.rt = setTimeout(function () { if (!self.c) self.open(false); }, this.backoff);
    this.backoff = Math.min(this.backoff * 1.6, 6000);
  };
  P.goOnline = function (c) {
    var self = this;
    this.backoff = 700; this.setStatus(true);
    this.pendR.forEach(function (p, t) { self.raw(c, pkt(0x31, [str(t), p])); }); this.pendR.clear();
    var now = Date.now();
    this.queue.forEach(function (q) { if (now - q.at < 8000) self.raw(c, pkt(0x30, [str(q.t), q.p])); }); this.queue = [];
  };
  P.promote = function (c) {
    var self = this, old = this.c;
    this.c = c; this.nx = null; this.rots++;
    if (!this.online) this.goOnline(c);
    if (old) setTimeout(function () { self.kill(old); }, 400); // старое ещё чуть-чуть дослушиваем
  };
  // оборвать всё и сразу подключиться заново
  P.drop = function () {
    var c = this.c, n = this.nx; this.c = null; this.nx = null;
    if (n) this.kill(n); if (c) this.kill(c);
    this.setStatus(false); clearTimeout(this.rt); this.backoff = 700;
    if (!this.closed) this.open(false);
  };
  // живо ли соединение: сервер отвечает на пинг; тишина 15 секунд — переподключаемся
  P.check = function () {
    var c = this.c; if (!c || !c.ready) return;
    if (Date.now() - c.last > 15000) return this.drop();
    this.raw(c, PING);
  };
  // телефон снова включили / вернулись во вкладку: не доверяем старому соединению
  P.kick = function () {
    if (this.closed) return;
    var c = this.c;
    if (c && !c.ready && Date.now() - c.at < 4000) return; // уже подключаемся
    if (c && c.ready && Date.now() - c.last < 8000) { this.raw(c, PING); return; }
    this.drop();
  };
  P.feed = function (c, chunk) {
    var b = new Uint8Array(c.buf.length + chunk.length); b.set(c.buf); b.set(chunk, c.buf.length); c.buf = b;
    for (;;) {
      var buf = c.buf; if (buf.length < 2) return;
      var mul = 1, len = 0, i = 1, d;
      do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (buf.length < i + len) return;
      var first = buf[0], body = buf.slice(i, i + len);
      c.buf = buf.slice(i + len);
      this.handle(c, first, body);
      if (c.dead) return;
    }
  };
  P.handle = function (c, first, body) {
    var self = this, type = first >> 4;
    if (type === 2) { // CONNACK
      clearTimeout(c.to);
      if (body[1] !== 0) { this.kill(c); return; }
      c.ready = true; c.wait = 0;
      this.subs.forEach(function (t) { self.sendSub(c, t); });
      if (c === this.c) this.goOnline(c);
      else if (c === this.nx && c.wait === 0) this.promote(c);
    } else if (type === 9) { // SUBACK
      if (c.wait > 0) c.wait--;
      if (c.wait === 0 && c === this.nx) this.promote(c);
    } else if (type === 3) { // PUBLISH
      var tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl));
      var off = 2 + tl; if ((first >> 1) & 3) off += 2;
      var text = td.decode(body.subarray(off)), data = null;
      if (text) { try { data = JSON.parse(text); } catch (e) { return; } }
      this.msgL.forEach(function (f) { try { f(topic, data); } catch (e) { console.error(e); } });
    }
  };
  P.sendSub = function (c, t) {
    this.mid = (this.mid % 65000) + 1; c.wait++;
    this.raw(c, pkt(0x82, [new Uint8Array([this.mid >> 8, this.mid & 255]), str(t), new Uint8Array([0])]));
  };
  P.subscribe = function (t) {
    if (this.subs.has(t)) return; this.subs.add(t);
    var self = this; [this.c, this.nx].forEach(function (c) { if (c && c.ready) self.sendSub(c, t); });
  };
  P.unsubscribe = function (t) {
    if (!this.subs.has(t)) return; this.subs.delete(t);
    var self = this;
    [this.c, this.nx].forEach(function (c) {
      if (!c || !c.ready) return;
      self.mid = (self.mid % 65000) + 1;
      self.raw(c, pkt(0xA2, [new Uint8Array([self.mid >> 8, self.mid & 255]), str(t)]));
    });
  };
  P.publish = function (t, data, retain) {
    var payload = te.encode(data === null || data === undefined ? '' : JSON.stringify(data));
    if (this.online && this.c && this.raw(this.c, pkt(0x30 | (retain ? 1 : 0), [str(t), payload]))) return;
    if (retain) this.pendR.set(t, payload);
    else { this.queue.push({ t: t, p: payload, at: Date.now() }); if (this.queue.length > 30) this.queue.shift(); }
  };
  P.close = function () {
    this.closed = true; clearInterval(this.pingT); clearTimeout(this.rt);
    var c = this.c, n = this.nx; this.c = this.nx = null;
    if (n) this.kill(n); if (c) this.kill(c);
  };

  function code(n, alphabet) {
    var a = alphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    var r = crypto.getRandomValues(new Uint32Array(n));
    for (var i = 0; i < n; i++) s += a[r[i] % a.length];
    return s;
  }
  function brokerUrl(i) { return override || (BROKERS[i] || BROKERS[0]).url; }
  function brokerName(i) { return override ? 'локальный' : (BROKERS[i] || BROKERS[0]).name; }
  // WebRTC: ждём, пока соберутся адреса (но не дольше ms)
  function iceDone(pc, ms) {
    return new Promise(function (res) {
      if (pc.iceGatheringState === 'complete') return res();
      var t = setTimeout(res, ms);
      pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }

  // общие для экрана игры и пульта: короткий отпечаток текста и вопросы без лишнего
  function hash(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function finThemes(P) {
    var F = P && P.final; if (!F) return [];
    if (Array.isArray(F.themes)) return F.themes.filter(function (x) { return x && x.q; });
    return F.q ? [{ theme: F.theme || 'Финал', q: F.q, a: F.a }] : [];
  }
  function stripPack(P) {
    P = P || {};
    return {
      title: P.title || '', final: finThemes(P).map(function (x) { return { theme: x.theme || '', q: x.q || '', a: x.a || '' }; }),
      rounds: (P.rounds || []).map(function (r) {
        return { name: r.name || '', themes: (r.themes || []).map(function (th) {
          return { name: th.name || '', questions: (th.questions || []).map(function (x) {
            return { price: x.price || 0, q: x.q || '', a: x.a || '', hint: x.hint || '', type: x.type || '', catTheme: x.catTheme || '', md: x.audio ? 'a' : x.video ? 'v' : '' };
          }) };
        }) };
      }),
    };
  }

  window.Net = {
    BROKERS: BROKERS, PREFIX: PREFIX, Client: Client, code: code, brokerUrl: brokerUrl, brokerName: brokerName, override: override, params: params,
    rtc: typeof RTCPeerConnection === 'function' && !params.get('nortc'),
    ICE: [{ urls: 'stun:stun.l.google.com:19302' }], iceDone: iceDone,
    id: function () { return Math.random().toString(36).slice(2, 10); },
    hash: hash, finThemes: finThemes, stripPack: stripPack,
  };
})();
