/* play.js — экран игрока на телефоне: кнопка «отвечаю», подкуп судьи, ставки и ответы. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n || 0)).toLocaleString('ru-RU');
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } return null; };
  const vib = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* нет вибрации */ } };

  const prm = Net.params;
  let room = (prm.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bi = +(prm.get('b') || 0);
  // #2, #3… в конце ссылки — отдельный игрок в той же вкладке браузера (удобно проверять на одном компьютере)
  const PKEY = 'sviq.pid' + location.hash.replace(/[^a-z0-9]/gi, '');
  let pid = ls(PKEY);
  if (!pid) { pid = 'p' + Net.code(9, 'abcdefghijkmnpqrstuvwxyz23456789'); ls(PKEY, pid); }
  let myName = ls('sviq.name') || '';
  let lastMsg = 0, offSince = 0;
  let S = null, sAt = 0, priv = null, client = null, online = false, sig = '', lockUntil = 0, pressed = '', armUntil = 0, joinSent = 0, wl = null, prevSt = '', prevAns = '', myBet = null, started = false;
  const app = $('#app');
  const T = s => Net.PREFIX + room + '/' + s;

  function send(m, viaServer) {
    if (!client) return; m.p = pid; m.m = Net.id();
    if (!viaServer && rtcOpen && dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(m)); return; } catch (e) { /* запасной путь ниже */ } }
    client.publish(T('i'), m, false);
  }
  /* ----- прямое соединение с экраном игры по Wi-Fi (WebRTC) ----- */
  let pc = null, dc = null, rtcOpen = false, rtcT = null, rtcTries = 0, rtcNext = 0;
  function rtcStart() {
    clearTimeout(rtcT); rtcT = null;
    if (!Net.rtc || pc || !client || !myEnt()) return;
    let my; try { my = pc = new RTCPeerConnection({ iceServers: Net.ICE }); } catch (e) { return; }
    const ch = dc = my.createDataChannel('g', { ordered: true });
    ch.onopen = () => { if (pc !== my) return; rtcOpen = true; rtcTries = 0; lastMsg = Date.now(); client.unsubscribe(T('s')); sig = ''; render(); netbar(); };
    ch.onmessage = ev => {
      if (pc !== my) return;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      lastMsg = Date.now();
      if (m.s && typeof m.s === 'object') { S = m.s; sAt = Date.now(); onState(); }
      if (m.p) { priv = m.p; sig = ''; render(); }
      netbar();
    };
    ch.onclose = () => { if (pc === my) rtcReset(); };
    my.onconnectionstatechange = () => { if (pc === my && ['failed', 'closed'].includes(my.connectionState)) rtcReset(); };
    (async () => {
      try {
        await my.setLocalDescription(await my.createOffer());
        await Net.iceDone(my, 2000);
        if (pc !== my) return;
        send({ t: 'rtc', sdp: my.localDescription.sdp }, true);
        rtcT = setTimeout(() => { if (pc === my && !rtcOpen) rtcReset(); }, 12000);
      } catch (e) { if (pc === my) rtcReset(); }
    })();
  }
  function rtcReset() {
    clearTimeout(rtcT);
    const was = rtcOpen, ch = dc, my = pc; rtcOpen = false; pc = dc = null;
    if (ch) { ch.onopen = ch.onmessage = ch.onclose = null; try { ch.close(); } catch (e) { /* уже */ } }
    if (my) { my.onconnectionstatechange = null; try { my.close(); } catch (e) { /* уже */ } }
    if (client) client.subscribe(T('s'));
    if (was) { sig = ''; render(); netbar(); }
    rtcTries++; const wait = Math.min(30000, 2500 * rtcTries); rtcNext = Date.now() + wait;
    rtcT = setTimeout(rtcStart, wait);
  }
  const linked = () => online || rtcOpen;
  function start() {
    if (started) return; started = true;
    client = new Net.Client(Net.brokerUrl(bi));
    client.subscribe(T('s')); client.subscribe(T('p/' + pid)); client.subscribe(T('r/' + pid)); client.subscribe(T('hb'));
    client.onMessage((t, d) => {
      if (t === T('s')) { if (d && typeof d === 'object') { S = d; sAt = lastMsg = Date.now(); onState(); netbar(); } }
      else if (t === T('hb')) { lastMsg = Date.now(); netbar(); }
      else if (t === T('p/' + pid)) { priv = d; sig = ''; render(); }
      else if (t === T('r/' + pid)) { if (pc && !rtcOpen && pc.signalingState === 'have-local-offer' && d && typeof d.sdp === 'string') pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }).catch(() => rtcReset()); }
    });
    client.onStatus(on => { online = on; if (!on) offSince = Date.now(); if (on && myEnt()) send({ t: 'hb' }); render(); netbar(); });
    setInterval(() => { if (linked() && myEnt()) send({ t: 'hb' }); }, 12000);
    setInterval(tickUI, 250);
    // экран игры подаёт сигнал каждые 10 секунд; если тишина — переподключаемся сами
    setInterval(() => {
      netbar(); if (!S) return;
      const quiet = Date.now() - lastMsg;
      if (rtcOpen && quiet > 22000) { lastMsg = Date.now(); rtcReset(); }
      else if (!rtcOpen && online && quiet > 22000) { lastMsg = Date.now(); client.drop(); }
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) return; wake(); if (rtcOpen && Date.now() - lastMsg > 12000) rtcReset(); });
    render();
  }
  function netbar() {
    const nb = $('#netbar'); if (!nb) return;
    let txt = '';
    if (client && !linked() && Date.now() - offSince > 1500) txt = '📡 Нет связи — переподключаемся… Нажми, чтобы обновить';
    else if (linked() && S && Date.now() - lastMsg > 20000) txt = '⏳ Экран игры не отвечает… Нажми, чтобы обновить';
    if (nb.textContent !== txt) nb.textContent = txt;
    nb.style.display = txt ? 'block' : 'none';
  }
  window.__play = { get client() { return client; }, get S() { return S; }, get rtc() { return rtcOpen; } };
  async function wake() {
    try { if ('wakeLock' in navigator && !document.hidden && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* не поддерживается */ }
  }
  const myEnt = () => { if (!S || !S.ents) return null; const id = (S.pm && S.pm[pid]) || pid; return S.ents.some(e => e.id === id) ? id : null; };
  const myMe = () => { const id = myEnt(); return id ? S.ents.find(e => e.id === id) : null; };
  const entN = id => esc((S.ents.find(e => e.id === id) || {}).n || '—');
  const fzMe = eid => { const e = S.ents.find(x => x.id === eid); return !!(e && e.fz > 0); };
  const canPress = eid => { const q = S && S.q; return !!q && q.st === 'open' && !q.ow && !(q.tr || []).includes(eid) && !fzMe(eid); };

  function onState() {
    const eid = myEnt(), q = S.q;
    if (q && eid && S.phase === 'q') {
      const sk = q.k + q.st + (q.tr || []).length;
      if (sk !== prevSt) { prevSt = sk; if (canPress(eid)) vib(80); }
      const ak = q.k + (q.an || '') + (q.ow || '');
      if (ak !== prevAns) { prevAns = ak; if (q.an === eid || q.ow === eid) vib([150, 80, 150]); }
    }
    if (Net.rtc && !pc && Date.now() >= rtcNext && eid) rtcStart();
    render();
  }

  /* ---------- отрисовка ---------- */
  function setScreen(s, html) { if (sig === s) return false; sig = s; app.innerHTML = html; return true; }
  const center = (ic, t, s) => `<div class="center"><div class="big">${ic}</div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  function render() {
    if (!room) return setScreen('code', `<div class="center"><div class="logo">Своя игра</div><div class="t">Код комнаты</div><input id="rc" maxlength="6" placeholder="КОД" autocomplete="off" autocapitalize="characters"><button class="go" id="rcgo">Дальше</button><div class="s">Код написан на экране телевизора</div></div>`);
    if (!S) return setScreen('wait' + linked(), center(linked() ? '⏳' : '📡', linked() ? 'Ждём ведущего…' : 'Подключаемся…', `Комната <b>${esc(room)}</b>${linked() ? '<br>Экран игры на телевизоре должен быть открыт' : ''}`));
    const eid = myEnt();
    if (!eid) return renderJoin();
    renderGame(eid);
  }
  function renderJoin() {
    const teams = S.mode === 'teams';
    const s = 'join:' + (teams ? S.ents.map(e => e.id + e.n).join(',') : 'solo');
    const fresh = setScreen(s, `<div class="center"><div class="logo">${esc(S.title || 'Своя игра')}</div><div class="t">Как тебя зовут?</div><input id="nm" maxlength="20" placeholder="Твоё имя" value="${esc(myName)}" autocomplete="off">`
      + (teams ? `<div class="t sm">Выбери свою команду</div><div class="teams">${S.ents.map(e => `<button class="tm" data-team="${esc(e.id)}" style="--c:${e.c}">${esc(e.n)}</button>`).join('')}</div>` : '<button class="go" id="joinbtn">Играть! 🎮</button>')
      + '<div class="s" id="jnote"></div></div>');
    if (fresh && !myName) setTimeout(() => { const nm = $('#nm'); if (nm) nm.focus(); }, 150);
    const n = $('#jnote'); if (n) n.textContent = joinSent && Date.now() - joinSent < 8000 ? 'Подключаемся к игре…' : '';
  }
  function doJoin(team) {
    const nm = $('#nm'), name = (nm ? nm.value : myName).trim().slice(0, 20);
    if (!name) { if (nm) { nm.classList.add('err'); nm.focus(); } return; }
    myName = name; ls('sviq.name', name); joinSent = Date.now();
    send({ t: 'join', n: name, team: team || null }, true); vib(20); wake();
    const n = $('#jnote'); if (n) n.textContent = 'Подключаемся к игре…';
    setTimeout(() => { if (!myEnt()) send({ t: 'join', n: name, team: team || null }, true); }, 4000);
  }
  function gameSig(eid) {
    const q = S.q, f = S.fin;
    if (S.phase === 'q' && q) return ['q', q.k, q.st, q.an === eid ? 'me' : q.an, q.ow === eid ? 'own' : q.ow, (q.tr || []).length, (q.tr || []).includes(eid) ? 't' : '', fzMe(eid) ? 'f' : '', (q.bb || []).includes(eid) ? 'b' : '', priv && priv.k === q.k ? 'h' : '', q.ev ? q.ev.n : '', q.vic].join('|');
    if (S.phase === 'final' && f) return ['f', f.st, (f.pt || []).includes(eid) ? 'p' : 'n'].join('|');
    if (S.phase === 'board') return 'b|' + (S.chooser === eid ? 'me' : S.chooser);
    if (S.phase === 'end') return 'end|' + S.ents.map(e => e.s).join(',');
    return S.phase + '|' + S.ents.length;
  }
  function renderGame(eid) {
    const me = myMe(), s = gameSig(eid);
    if (sig !== s) { sig = s; app.innerHTML = `<div class="hd" id="hd"></div><div class="main" id="main">${mainHTML(eid, me)}</div>`; }
    renderHead(me);
    if (S.phase === 'q' && S.q && S.q.st === 'auction') aucUpd(eid, me);
    if (S.phase === 'final') finUpd(eid, me);
    tickUI();
  }
  function renderHead(me) {
    const hd = $('#hd'); if (!hd) return;
    const rank = S.ents.slice().sort((a, b) => b.s - a.s).findIndex(e => e.id === me.id) + 1;
    const h = `<div class="hn" style="--c:${me.c}"><b>${esc(me.n)}</b>${S.mode === 'teams' ? `<small>${esc(myName)}</small>` : ''}</div><div class="hs ${me.s < 0 ? 'neg' : ''}">${fmt(me.s)}</div>`
      + `<div class="hr">${rank}-е место из ${S.ents.length}${me.fz ? ' · ❄️ заморожен' : ''}${me.x2 ? ' · ×2' : ''}${rtcOpen ? ' · 📶 напрямую' : ''}</div><i class="net ${rtcOpen ? 'p2p' : online ? 'on' : ''}"></i>`;
    if (hd.dataset.h !== h) { hd.innerHTML = h; hd.dataset.h = h; }
  }
  function mainHTML(eid, me) {
    const ch = S.ents.find(e => e.id === S.chooser);
    switch (S.phase) {
      case 'lobby': return center('🎮', 'Ты в игре!', `Ждём, когда ведущий начнёт.<br>Игроков: ${S.ents.length}`);
      case 'trans': return center('✨', esc(S.round || '…'), 'Смотри на экран');
      case 'board': return S.chooser === eid ? center('⭐', 'Твой выбор!', 'Скажи ведущему тему и цену') : center('🎯', 'Выбирает вопрос', ch ? esc(ch.n) : '');
      case 'end': {
        const rank = S.ents.slice().sort((a, b) => b.s - a.s), pos = rank.findIndex(e => e.id === eid) + 1;
        return center(pos === 1 ? '🏆' : '🎉', pos === 1 ? 'Ты победил!' : `Победил ${esc(rank[0].n)}`, `Твоё место: <b>${pos}</b> из ${rank.length}<br>Счёт: ${fmt(me.s)}`);
      }
      case 'final': return finalHTML(eid, me);
      case 'q': return S.q ? qHTML(eid) : '';
    }
    return center('⏳', '…', '');
  }
  function qHTML(eid) {
    const q = S.q;
    const top = `<div class="qtop"><span>${esc(q.th)}</span><b>${fmt(q.stake || q.p)}</b></div><div class="tbar"><i id="tbar"></i></div>`;
    if (q.st === 'intro') return top + center('👀', 'Внимание на экран', '');
    if (q.st === 'cat') return top + center('🐱', 'Кот в мешке!', S.chooser === eid ? 'Скажи ведущему, кому отдаёшь кота' : 'Сейчас решат, кому достанется кот');
    if (q.st === 'auction') return top + '<div class="auc" id="auc"></div>';
    if (q.st === 'trap') return top + center('⚠️', 'Ловушка!', q.vic === eid ? 'Монетка решает <b>твою</b> судьбу…' : `Под угрозой: ${entN(q.vic)}`);
    if (q.st === 'trapev') return top + center(q.ev ? q.ev.i : '⚠️', q.ev ? esc(q.ev.n) : 'Ловушка!', q.vic === eid ? 'Это про тебя! Смотри на экран' : `Жертва: ${entN(q.vic)}`);
    let cls = 'off', label = '';
    if (q.ow) { if (q.ow === eid) { cls = 'me'; label = q.st === 'reveal' ? 'Ответ на экране' : 'Отвечаешь ты!'; } else label = `Отвечает<br>${entN(q.ow)}`; }
    else if (q.st === 'read') { cls = 'wait'; label = 'Приготовься…'; }
    else if (q.st === 'open') {
      if ((q.tr || []).includes(eid)) label = 'Ты уже отвечал';
      else if (fzMe(eid)) { cls = 'ice'; label = '❄️ Ты заморожен'; }
      else if (pressed === q.k + ':' + (q.tr || []).length) { cls = 'pressed'; label = 'Нажато!'; }
      else { cls = 'go'; label = 'ЖМИ!'; }
    }
    else if (q.st === 'ans') { if (q.an === eid) { cls = 'me'; label = 'ТЫ ОТВЕЧАЕШЬ!'; } else label = `Отвечает<br>${entN(q.an)}`; }
    else if (q.st === 'timeup') label = 'Время вышло';
    else if (q.st === 'reveal') label = 'Ответ на экране';
    return top + `<div class="bzwrap"><button class="buzz ${cls}" id="buzz"><span id="bzl">${label}</span></button></div>` + bribeHTML(eid) + hintHTML(q);
  }
  function hintHTML(q) {
    if (!priv || priv.k !== q.k) return '';
    return `<div class="hint">🤫 ${priv.hint ? `Подсказка: <b>${esc(priv.hint)}</b>` : 'Подсказки нет — судья шепнёт её лично'}</div>`;
  }
  function bribeOK(eid) {
    const q = S && S.q; if (!q || (q.bb || []).includes(eid)) return false;
    if (q.ow) return q.ow === eid && ['read', 'open', 'timeup'].includes(q.st);
    return ['read', 'open', 'ans'].includes(q.st) && !(q.tr || []).includes(eid);
  }
  function bribeHTML(eid) {
    const q = S.q;
    if (!bribeOK(eid)) return (q.bb || []).includes(eid) ? '<div class="bribe done">💰 Судья подкуплен</div>' : '';
    return `<button class="bribe" id="bribe">💰 Подкупить судью · −${fmt(q.bc)}</button>`;
  }
  function aucUpd(eid, me) {
    const box = $('#auc'); if (!box) return;
    const q = S.q, bids = (q.au && q.au.b) || {}, passed = (q.au && q.au.ps) || {};
    let max = 0, lead = null; for (const id in bids) if (bids[id] > max) { max = bids[id]; lead = id; }
    const cap = Math.max(me.s, q.p), next = Math.max(q.p, max + 100), opts = [];
    if (lead !== eid) { if (next <= cap) opts.push(next); if (next + 400 <= cap) opts.push(next + 400); }
    const canAll = cap > max && lead !== eid;
    const h = `<div class="t">🔨 Аукцион</div><div class="s">Старт: ${fmt(q.p)} · у тебя ${fmt(me.s)}</div>`
      + `<div class="lead">${lead ? `Лидер: <b>${entN(lead)}</b> — ${fmt(max)}` : 'Ставок пока нет'}</div>`
      + (lead === eid ? '<div class="mine">Ты лидируешь! 🔥</div>' : '') + (passed[eid] ? '<div class="s">Ты спасовал</div>' : '')
      + `<div class="abtns">${opts.map(v => `<button data-bid="${v}">Ставка ${fmt(v)}</button>`).join('')}${canAll ? `<button class="all" data-bid="all">Ва-банк · ${fmt(cap)}</button>` : ''}${!passed[eid] && lead !== eid ? '<button class="pass" data-bid="pass">Пас</button>' : ''}</div>`
      + (!opts.length && !canAll && lead !== eid ? '<div class="s">Не хватает очков, чтобы перебить ставку</div>' : '');
    if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
  }
  function finalHTML(eid, me) {
    const f = S.fin, inF = (f.pt || []).includes(eid);
    if (f.st === 'theme') return center('🏁', 'Финал!', `Тема: <b>${esc(f.th)}</b><br>${inF ? 'Ты в финале! Скоро ставки.' : 'Ты не прошёл в финал (нужен счёт больше нуля). Болей за остальных!'}`);
    if (!inF) return center('🍿', 'Финал', 'Ты не в финале — болей за остальных!');
    if (f.st === 'bet') return `<div class="center"><div class="t">💰 Твоя ставка</div><div class="s">Тема: <b>${esc(f.th)}</b><br>от 0 до ${fmt(me.s)}. Ставку никто не видит.</div>`
      + `<input id="bet" type="number" inputmode="numeric" min="0" max="${me.s}" placeholder="Ставка"><div class="qb"><button data-q="0">0</button><button data-q="h">Половина</button><button data-q="a">Всё</button></div>`
      + '<button class="go" id="betgo">Поставить</button><div class="s" id="fnote"></div></div>';
    if (f.st === 'q') return '<div class="tbar"><i id="tbar"></i></div><div class="center"><div class="t">✍️ Твой ответ</div><div class="s">Вопрос на экране</div><textarea id="fans" maxlength="140" placeholder="Напиши ответ"></textarea><button class="go" id="ansgo">Отправить</button><div class="s" id="fnote"></div></div>';
    return center('🥁', 'Открываем ответы…', 'Смотри на экран');
  }
  function finUpd(eid) {
    const f = S.fin, n = $('#fnote'); if (!n || !f) return;
    if (f.st === 'bet') n.innerHTML = (f.bt || []).includes(eid) ? `✓ Ставка принята${myBet != null ? ': ' + fmt(myBet) : ''}. Можно изменить.` : '';
    if (f.st === 'q') n.innerHTML = (f.an || []).includes(eid) ? '✓ Ответ отправлен. Можно исправить.' : '';
  }
  function tickUI() {
    const bar = $('#tbar'); if (!bar || !S) return;
    const tm = S.phase === 'final' ? S.fin && S.fin.tm : S.q && S.q.tm; if (!tm || !tm.tot) return;
    const left = tm.r ? Math.max(0, tm.l - (Date.now() - sAt) / 1000) : tm.l;
    bar.style.width = Math.max(0, Math.min(100, left / tm.tot * 100)) + '%';
    bar.className = left <= 5 ? 'danger' : '';
  }

  /* ---------- действия ---------- */
  function onBuzz() {
    const q = S && S.q, eid = myEnt(); if (!q || !eid || S.phase !== 'q') return;
    const now = Date.now();
    if (q.st === 'read' && !q.ow) { lockUntil = now + 1500; vib([40, 40, 40]); flashLabel('Рано! Фальстарт ✋', 1500); return; }
    if (!canPress(eid)) return;
    if (now < lockUntil) { flashLabel('Подожди…', 600); return; }
    const key = q.k + ':' + (q.tr || []).length;
    if (pressed === key) return;
    pressed = key; send({ t: 'buzz', k: q.k }); vib(35);
    const b = $('#buzz'); if (b) { b.className = 'buzz pressed'; $('#bzl').textContent = 'Нажато!'; }
    setTimeout(() => { if (pressed === key && S.q && S.q.k === q.k && S.q.st === 'open') { pressed = ''; sig = ''; render(); } }, 3000);
  }
  function flashLabel(txt, ms) {
    const l = $('#bzl'), b = $('#buzz'); if (!l || !b) return;
    const old = l.innerHTML, oc = b.className; l.textContent = txt; b.className = 'buzz warn';
    setTimeout(() => { if ($('#bzl') === l) { l.innerHTML = old; b.className = oc; } }, ms);
  }
  function doBribe() {
    const q = S && S.q, eid = myEnt(), b = $('#bribe'); if (!q || !b || !bribeOK(eid)) return;
    const now = Date.now();
    if (now > armUntil) {
      armUntil = now + 3000; b.classList.add('arm'); b.textContent = `Точно? −${fmt(q.bc)} · нажми ещё раз`; vib(20);
      setTimeout(() => { if (Date.now() >= armUntil && $('#bribe') === b) { b.classList.remove('arm'); b.textContent = `💰 Подкупить судью · −${fmt(q.bc)}`; } }, 3100);
      return;
    }
    armUntil = 0; send({ t: 'bribe', k: q.k }); vib([30, 30, 60]); b.disabled = true; b.textContent = 'Отправлено…';
  }
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#netbar')) { location.reload(); return; }
    if (t.closest('#rcgo')) {
      const v = (($('#rc') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length < 4) return;
      room = v;
      try { history.replaceState(null, '', '?r=' + room + '&b=' + bi + (Net.override ? '&broker=' + encodeURIComponent(Net.override) : '')); } catch (err) { /* ничего */ }
      sig = ''; start(); return;
    }
    if (t.closest('#joinbtn')) return doJoin(null);
    const tm = t.closest('[data-team]'); if (tm) return doJoin(tm.dataset.team);
    if (t.closest('#bribe')) return doBribe();
    const b = t.closest('[data-bid]');
    if (b && S && S.q) { const v = b.dataset.bid; send({ t: 'bid', k: S.q.k, v: v === 'all' || v === 'pass' ? v : +v }); vib(25); return; }
    const qb = t.closest('[data-q]');
    if (qb) { const me = myMe(), inp = $('#bet'); if (inp && me) inp.value = qb.dataset.q === '0' ? 0 : qb.dataset.q === 'h' ? Math.floor(me.s / 2) : me.s; return; }
    if (t.closest('#betgo')) {
      const me = myMe(), inp = $('#bet'); if (!me || !inp) return;
      const v = Math.floor(+inp.value);
      if (inp.value === '' || !(v >= 0) || v > me.s) { inp.classList.add('err'); return; }
      inp.classList.remove('err'); myBet = v; send({ t: 'bet', v }); vib(30); return;
    }
    if (t.closest('#ansgo')) { const a = (($('#fans') || {}).value || '').trim(); if (!a) return; send({ t: 'fans', v: a.slice(0, 140) }); vib(30); }
  });
  app.addEventListener('pointerdown', e => { if (e.target.closest('#buzz')) { e.preventDefault(); onBuzz(); } });
  app.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'nm' && S && S.mode !== 'teams') doJoin(null); if (e.key === 'Enter' && e.target.id === 'rc') { const g = $('#rcgo'); if (g) g.click(); } });

  if (room) start(); else render();
})();
