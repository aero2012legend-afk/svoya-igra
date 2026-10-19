/* net.js — связь телевизора с телефонами.
   Маленький MQTT-клиент (MQTT 3.1.1 поверх WebSocket) и список бесплатных открытых серверов.
   Сообщения короткие и ничего секретного в них нет. */
(function () {
  'use strict';
  var BROKERS = [
    { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
    { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
    { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' },
    { name: 'Eclipse', url: 'wss://mqtt.eclipseprojects.io:443/mqtt' },
  ];
  var params = new URLSearchParams(location.search);
  var override = params.get('broker'); // для проверки: ?broker=ws://localhost:8888/mqtt
  var PREFIX = 'sviq1/';
  var te = new TextEncoder(), td = new TextDecoder();

  function str(s) {
    var b = te.encode(s), o = new Uint8Array(b.length + 2);
    o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o;
  }
  function pkt(first, parts) {
    var len = 0; parts.forEach(function (p) { len += p.length; });
    var rl = [], n = len;
    do { var d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; rl.push(d); } while (n > 0);
    var o = new Uint8Array(1 + rl.length + len); o[0] = first; o.set(rl, 1);
    var i = 1 + rl.length; parts.forEach(function (p) { o.set(p, i); i += p.length; });
    return o;
  }

  function Client(url) {
    this.url = url; this.subs = new Set(); this.msgL = []; this.stL = [];
    this.online = false; this.ws = null; this.buf = new Uint8Array(0); this.mid = 1;
    this.pendR = new Map(); this.queue = []; this.closed = false; this.backoff = 700; this.lastRx = 0;
    this.connect();
    var self = this, wake = function () { if (!document.hidden) self.kick(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
  }
  Client.prototype.setStatus = function (on) {
    if (this.online === on) return; this.online = on;
    this.stL.forEach(function (f) { try { f(on); } catch (e) { console.error(e); } });
  };
  Client.prototype.onStatus = function (f) { this.stL.push(f); };
  Client.prototype.onMessage = function (f) { this.msgL.push(f); };
  Client.prototype.connect = function () {
    var self = this; if (this.closed) return;
    var ws;
    try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { return this.retry(); }
    this.ws = ws; ws.binaryType = 'arraybuffer'; this.buf = new Uint8Array(0); this.connAt = Date.now();
    var to = setTimeout(function () { try { ws.close(); } catch (e) {} }, 7000);
    ws.onopen = function () {
      var id = 'sv' + Math.random().toString(36).slice(2, 12);
      ws.send(pkt(0x10, [str('MQTT'), new Uint8Array([4, 2, 0, 90]), str(id)]));
    };
    ws.onmessage = function (ev) { if (self.ws === ws) { self.lastRx = Date.now(); self.feed(new Uint8Array(ev.data), to); } };
    ws.onclose = function () {
      clearTimeout(to);
      if (self.ws === ws) { clearInterval(self.ping); self.ws = null; self.setStatus(false); self.retry(); }
    };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  };
  Client.prototype.retry = function () {
    var self = this; if (this.closed) return;
    clearTimeout(this.rt);
    this.rt = setTimeout(function () { self.connect(); }, this.backoff);
    this.backoff = Math.min(this.backoff * 1.6, 6000);
  };
  // оборвать соединение и сразу подключиться заново (зависшее соединение после сна телефона)
  Client.prototype.drop = function () {
    var ws = this.ws; this.ws = null; clearInterval(this.ping); clearTimeout(this.rt);
    if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(); } catch (e) {} }
    this.setStatus(false); this.backoff = 700;
    if (!this.closed) this.connect();
  };
  // проверка, живо ли соединение: сервер отвечает на пинг; тишина 15 секунд — переподключаемся
  Client.prototype.check = function () {
    if (!this.ws || !this.online) return;
    if (Date.now() - this.lastRx > 15000) return this.drop();
    this.send(new Uint8Array([0xC0, 0]));
  };
  // телефон снова включили / вернулись во вкладку: не доверяем старому соединению
  Client.prototype.kick = function () {
    if (this.closed) return;
    if (this.ws && !this.online && Date.now() - this.connAt < 4000) return; // уже подключаемся
    if (this.ws && this.online && Date.now() - this.lastRx < 8000) { this.send(new Uint8Array([0xC0, 0])); return; }
    this.drop();
  };
  Client.prototype.feed = function (chunk, to) {
    var b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    for (;;) {
      var buf = this.buf; if (buf.length < 2) return;
      var mul = 1, len = 0, i = 1, d;
      do { if (i >= buf.length) return; d = buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (buf.length < i + len) return;
      var first = buf[0], body = buf.slice(i, i + len);
      this.buf = buf.slice(i + len);
      this.handle(first, body, to);
    }
  };
  Client.prototype.handle = function (first, body, to) {
    var self = this, type = first >> 4;
    if (type === 2) { // CONNACK
      clearTimeout(to);
      if (body[1] !== 0) { try { this.ws.close(); } catch (e) {} return; }
      this.backoff = 700; this.setStatus(true);
      this.subs.forEach(function (t) { self.sendSub(t); });
      this.pendR.forEach(function (p, t) { self.raw(t, p, true); }); this.pendR.clear();
      var now = Date.now();
      this.queue.forEach(function (q) { if (now - q.at < 8000) self.raw(q.t, q.p, false); }); this.queue = [];
      clearInterval(this.ping);
      this.ping = setInterval(function () { self.check(); }, 5000);
    } else if (type === 3) { // PUBLISH
      var tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl));
      var off = 2 + tl; if ((first >> 1) & 3) off += 2;
      var text = td.decode(body.subarray(off)), data = null;
      if (text) { try { data = JSON.parse(text); } catch (e) { return; } }
      this.msgL.forEach(function (f) { try { f(topic, data); } catch (e) { console.error(e); } });
    }
  };
  Client.prototype.send = function (bytes) {
    if (this.ws && this.ws.readyState === 1) { try { this.ws.send(bytes); return true; } catch (e) {} }
    return false;
  };
  Client.prototype.sendSub = function (t) {
    this.mid = (this.mid % 65000) + 1;
    this.send(pkt(0x82, [new Uint8Array([this.mid >> 8, this.mid & 255]), str(t), new Uint8Array([0])]));
  };
  Client.prototype.subscribe = function (t) { this.subs.add(t); if (this.online) this.sendSub(t); };
  Client.prototype.raw = function (t, payload, retain) { return this.send(pkt(0x30 | (retain ? 1 : 0), [str(t), payload])); };
  Client.prototype.publish = function (t, data, retain) {
    var payload = te.encode(data === null || data === undefined ? '' : JSON.stringify(data));
    if (this.online && this.raw(t, payload, retain)) return;
    if (retain) this.pendR.set(t, payload);
    else { this.queue.push({ t: t, p: payload, at: Date.now() }); if (this.queue.length > 30) this.queue.shift(); }
  };
  Client.prototype.close = function () {
    this.closed = true; clearInterval(this.ping); clearTimeout(this.rt);
    try { if (this.ws) this.ws.close(); } catch (e) {}
  };

  function code(n, alphabet) {
    var a = alphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    var r = crypto.getRandomValues(new Uint32Array(n));
    for (var i = 0; i < n; i++) s += a[r[i] % a.length];
    return s;
  }
  function brokerUrl(i) { return override || (BROKERS[i] || BROKERS[0]).url; }
  function brokerName(i) { return override ? 'локальный' : (BROKERS[i] || BROKERS[0]).name; }

  window.Net = { BROKERS: BROKERS, PREFIX: PREFIX, Client: Client, code: code, brokerUrl: brokerUrl, brokerName: brokerName, override: override, params: params };
})();
