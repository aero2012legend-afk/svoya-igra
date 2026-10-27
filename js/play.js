/* play.js — экран игрока на телефоне: кнопка «отвечаю», подкуп судьи, ставки, монетка и рулетка ловушки,
   конкурсы (выбор соперника, камень-ножницы-бумага, тап-баттл, реакция, голосование), финал. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n || 0)).toLocaleString('ru-RU');
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } return null; };
  const vib = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* нет вибрации */ } };
  const PREFS = [['drink', '🥃', 'Пить', 'стопки и штрафные'], ['dance', '💃', 'Танцевать', 'танцевальный баттл'], ['sing', '🎤', 'Петь', 'караоке-баттл'], ['act', '🎭', 'Изображать', 'крокодил, пантомима']];
  const RPS = { r: ['✊', 'Камень'], s: ['✌️', 'Ножницы'], p: ['✋', 'Бумага'] };

  const prm = Net.params;
  let room = (prm.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bi = +(prm.get('b') || 0);
  // #2, #3… в конце ссылки — отдельный игрок в той же вкладке браузера (удобно проверять на одном компьютере)
  const SFX = location.hash.replace(/[^a-z0-9]/gi, '');
  const PKEY = 'sviq.pid' + SFX, PRKEY = 'sviq.pr' + SFX;
  let pid = ls(PKEY);
  if (!pid) { pid = 'p' + Net.code(9, 'abcdefghijkmnpqrstuvwxyz23456789'); ls(PKEY, pid); }
  let myName = ls('sviq.name') || '';
  let lastMsg = 0, offSince = 0;
  let S = null, sAt = 0, priv = null, client = null, online = false, sig = '', lockUntil = 0, pressed = '', armUntil = 0, joinSent = 0, wl = null, prevSt = '', prevAns = '', myBet = null, started = false;
  let surveyOpen = false, draftPr = null;
  const done = {}; // что уже нажато на этом экране (монетка, рулетка, выбор, голос)
  const app = $('#app');
  const T = s => Net.PREFIX + room + '/' + s;
  const myPrefs = () => { try { return JSON.parse(ls(PRKEY) || 'null'); } catch (e) { return null; } };

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
    setInterval(tickUI, 200);
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
  window.__play = { get client() { return client; }, get S() { return S; }, get rtc() { return rtcOpen; }, get pid() { return pid; } };
  async function wake() {
    try { if ('wakeLock' in navigator && !document.hidden && !wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { /* не поддерживается */ }
  }
  const myEnt = () => { if (!S || !S.ents) return null; const id = (S.pm && S.pm[pid]) || pid; return S.ents.some(e => e.id === id) ? id : null; };
  const myMe = () => { const id = myEnt(); return id ? S.ents.find(e => e.id === id) : null; };
  const entO = id => S.ents.find(e => e.id === id);
  const entN = id => esc((entO(id) || {}).n || '—');
  const entB = id => { const e = entO(id); return e ? `<b style="color:${e.c}">${esc(e.n)}</b>` : '—'; };
  const fzMe = eid => { const e = entO(eid); return !!(e && e.fz > 0); };
  const canPress = eid => { const q = S && S.q; return !!q && q.st === 'open' && !q.ow && !(q.tr || []).includes(eid) && !fzMe(eid); };
  const side = (c, eid) => (c && c.a === eid ? 'a' : c && c.b === eid ? 'b' : null);

  function onState() {
    const eid = myEnt(), q = S.q;
    if (q && eid && S.phase === 'q') {
      const sk = q.k + q.st + (q.tr || []).length;
      if (sk !== prevSt) {
        prevSt = sk;
        if (canPress(eid)) vib(80);
        if ((q.st === 'trap' || q.st === 'trapspin') && q.vic === eid) vib([60, 60, 60]);
      }
      const ak = q.k + (q.an || '') + (q.ow || '');
      if (ak !== prevAns) { prevAns = ak; if (q.an === eid || q.ow === eid) vib([150, 80, 150]); }
      const c = q.con;
      if (c && c.st === 'play' && side(c, eid)) {
        if (c.id === 'tap' && c.go && c.gid && c.gid !== tap.g) tapStart(c.gid);
        if (c.id === 'react' && c.gid !== rx.g) { rx.g = c.gid; rx.at = 0; rx.sent = false; rx.res = ''; }
      }
      if (c && c.st === 'pick' && c.a === eid) { const k = 'pick' + q.k; if (!done[k + 'v']) { done[k + 'v'] = 1; vib([80, 50, 80]); } }
    }
    if (S.phase === 'final' && S.fin && S.fin.st === 'strike' && S.fin.turn === eid) { const k = 'strk' + (S.fin.left || []).length; if (!done[k]) { done[k] = 1; vib([80, 50, 80]); } }
    document.body.classList.toggle('disco', !!S.dj);
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
    if (!eid) { document.body.className = ''; return renderJoin(); }
    if (!myPrefs() || surveyOpen) return renderSurvey();
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
    const msg = () => ({ t: 'join', n: name, team: team || null, pr: myPrefs() });
    send(msg(), true); vib(20); wake();
    const n = $('#jnote'); if (n) n.textContent = 'Подключаемся к игре…';
    setTimeout(() => { if (!myEnt()) send(msg(), true); }, 4000);
  }
  function renderSurvey() {
    if (!draftPr) draftPr = Object.assign({}, myPrefs() || {});
    const fresh = setScreen('survey', `<div class="center sv"><div class="t">На что ты готов(а) ради победы? 🏆</div>
      <div class="s">Отметь всё, что тебе ок. От этого зависит, в какие конкурсы тебя смогут позвать соперником.</div>
      <div class="prefs">${PREFS.map(([k, ic, nm, sub]) => `<button class="pf" data-pf="${k}"><span>${ic}</span><b>${nm}</b><small>${sub}</small></button>`).join('')}</div>
      <button class="go" id="prgo">Готово ✓</button><div class="s">Можно ничего не отмечать — тогда только вопросы и безопасные конкурсы</div></div>`);
    if (fresh) PREFS.forEach(([k]) => { const b = $(`[data-pf="${k}"]`); if (b) b.classList.toggle('on', !!draftPr[k]); });
  }
  function savePrefs() {
    const v = {}; PREFS.forEach(([k]) => { if (draftPr && draftPr[k]) v[k] = 1; });
    ls(PRKEY, JSON.stringify(v)); draftPr = null; surveyOpen = false;
    send({ t: 'prefs', v }); vib(30); sig = ''; render();
  }
  function gameSig(eid) {
    const q = S.q, f = S.fin;
    if (S.phase === 'q' && q) {
      const c = q.con, a = [
        'q', q.k, q.st, q.an === eid ? 'me' : q.an, q.ow === eid ? 'own' : q.ow, (q.tr || []).length, (q.tr || []).includes(eid) ? 't' : '', fzMe(eid) ? 'f' : '',
        (q.bb || []).includes(eid) ? 'b' : '', priv && priv.k === q.k ? 'h' + (priv.word || '') + (priv.poem ? 'p' : '') : '', q.side || '', q.ev ? q.ev.id : '', q.res || '', q.card || '', q.vic, q.at && q.at.up ? 'up' : '', q.ask || '',
      ];
      if (c) a.push(c.st, c.id, c.a, c.b, c.g, c.stake, c.rnd, c.turn, c.theme, c.word, c.go, c.cd, c.gid, (c.vd || []).includes(pid) ? 'v' : '', (c.el || []).join(','), c.ch ? c.ch.a + '' + c.ch.b : '', c.res || '');
      return a.join('|');
    }
    if (S.phase === 'final' && f) return ['f', f.st, (f.pt || []).includes(eid) ? 'p' : 'n', f.turn, (f.left || []).join(','), f.th].join('|');
    if (S.phase === 'board') return 'b|' + (S.chooser === eid ? 'me' : S.chooser);
    if (S.phase === 'end') return 'end|' + S.ents.map(e => e.s).join(',');
    if (S.phase === 'results') return 'res|' + JSON.stringify(S.res || {}) + '|' + S.ents.map(e => e.s).join(',');
    if (S.phase === 'lobby') return 'lobby|' + S.ents.length + '|' + JSON.stringify(myPrefs());
    return S.phase + '|' + S.ents.length;
  }
  function renderGame(eid) {
    const me = myMe(), s = gameSig(eid);
    if (sig !== s) { sig = s; app.innerHTML = `<div class="hd" id="hd"></div><div class="main" id="main">${mainHTML(eid, me)}</div>`; afterBuild(eid); }
    renderHead(me);
    if (S.phase === 'q' && S.q && S.q.st === 'auction') aucUpd(eid, me);
    if (S.phase === 'final') finUpd(eid, me);
    tickUI();
  }
  function renderHead(me) {
    const hd = $('#hd'); if (!hd) return;
    const rank = S.ents.slice().sort((a, b) => b.s - a.s).findIndex(e => e.id === me.id) + 1;
    const fx = (me.fz ? ' · ❄️' : '') + (me.x2 ? ' · ×2' : '') + (me.sh ? ' · 🛡️' : '') + (me.bo ? ' · ✨' : '');
    const h = `<div class="hn" style="--c:${me.c}"><b>${esc(me.n)}</b>${S.mode === 'teams' ? `<small>${esc(myName)}</small>` : ''}</div><div class="hs ${me.s < 0 ? 'neg' : ''}">${fmt(me.s)}</div>`
      + `<div class="hr">${rank}-е место из ${S.ents.length}${fx}${rtcOpen ? ' · 📶 напрямую' : ''}</div><i class="net ${rtcOpen ? 'p2p' : online ? 'on' : ''}"></i>`;
    if (hd.dataset.h !== h) { hd.innerHTML = h; hd.dataset.h = h; }
  }
  function mainHTML(eid, me) {
    const ch = entO(S.chooser);
    document.body.classList.remove('rwait', 'rgo');
    switch (S.phase) {
      case 'lobby': {
        const pr = myPrefs() || {}, list = PREFS.filter(p => pr[p[0]]).map(p => p[1] + ' ' + p[2]).join(' · ');
        return center('🎮', 'Ты в игре!', `Ждём, когда ведущий начнёт.<br>Игроков: ${S.ents.length}`) + `<div class="mypr">Готов(а): ${list || 'только к вопросам'} · <button class="lnk" id="prchg">изменить</button></div>`;
      }
      case 'trans': return center('✨', esc(S.round || '…'), 'Смотри на экран');
      case 'board': return S.chooser === eid ? center('⭐', 'Твой выбор!', 'Скажи ведущему тему и цену') : center('🎯', 'Выбирает вопрос', ch ? esc(ch.n) : '');
      case 'end': {
        const rank = S.ents.slice().sort((a, b) => b.s - a.s), pos = rank.findIndex(e => e.id === eid) + 1;
        return center(pos === 1 ? '🏆' : '🎉', pos === 1 ? 'Ты победил!' : `Победил ${esc(rank[0].n)}`, `Твоё место: <b>${pos}</b> из ${rank.length}<br>Счёт: ${fmt(me.s)}`);
      }
      case 'final': return finalHTML(eid, me);
      case 'q': return S.q ? qHTML(eid, me) : '';
      case 'results': {
        const rank = S.ents.slice().sort((a, b) => b.s - a.s), pos = rank.findIndex(e => e.id === eid) + 1, R = S.res || {};
        if ((R.lo || []).includes(eid)) return center('🆘', 'Шанс на реабилитацию!', `Ты в отстающих, но Старый добрый.<br>Задание: <b>${esc((R.a || {})[eid] || 'смотри на экран')}</b>`);
        return center(pos === 1 ? '👑' : '📊', 'Промежуточные итоги', `Ты на <b>${pos}</b>-м месте из ${rank.length}<br>Счёт: ${fmt(me.s)}`);
      }
    }
    return center('⏳', '…', '');
  }
  function qHTML(eid, me) {
    const q = S.q;
    const top = `<div class="qtop"><span>${esc(q.th)}</span><b>${q.ty === 'bonus' ? '🎁' : fmt(q.stake || q.p)}</b></div><div class="tbar"><i id="tbar"></i></div>`;
    if (q.st === 'intro') return top + center('👀', 'Внимание на экран', '');
    if (q.st === 'cat') return top + center('🐱', 'Кот в мешке!', S.chooser === eid ? 'Скажи ведущему, кому отдаёшь кота' : 'Сейчас решат, кому достанется кот');
    if (q.st === 'auction') return top + `<div class="auc"><div id="aucinfo"></div><div class="bidrow" id="bidrow"><input id="bidv" type="number" inputmode="numeric" placeholder="Своя ставка"><button id="bidgo">Поставить</button></div><div class="s" id="bidnote"></div></div>`;
    if (q.st === 'trap') {
      if (q.vic !== eid) return top + center('⚠️', 'Ловушка!', `Монетка решает судьбу: ${entB(q.vic)}`);
      return top + `<div class="center"><div class="big">⚠️</div><div class="t">Ловушка!</div><div class="s">Твою судьбу решит монетка:<br>😇 ангел или 😈 дьявол</div>${done['coin' + q.k] ? '<div class="t sm">Монетка летит… 👀</div>' : '<button class="act gold" id="coinbtn">Подбросить монетку</button>'}</div>`;
    }
    if (q.st === 'trapspin') {
      const A = q.side === 'a';
      if (q.vic !== eid) return top + center(A ? '😇' : '😈', A ? 'Ангел' : 'Дьявол', `Рулетка для ${entB(q.vic)}…`);
      return top + `<div class="center"><div class="big">${A ? '😇' : '😈'}</div><div class="t">${A ? 'Ангел! Повезло' : 'Дьявол… Держись'}</div><div class="s">${A ? 'Крути рулетку подарков' : 'Крути рулетку испытаний'}</div>${done['spin' + q.k] ? '<div class="t sm">Крутится… 🎰</div>' : `<button class="act ${A ? 'gold' : 'red'}" id="spinbtn">🎰 Крутить рулетку</button>`}</div>`;
    }
    if (q.st === 'trapev') {
      const ev = q.ev || {}, mine = q.vic === eid;
      let h = `<div class="center"><div class="big">${ev.i || '⚠️'}</div><div class="t">${esc(ev.n || '')}</div><div class="s">${esc(ev.d || '')}</div>`;
      if (q.card) h += `<div class="card">${esc(q.card)}</div>`;
      if (ev.id === 'poem' && mine && priv && priv.k === q.k && priv.poem && !q.res) h += `<div class="poem">${esc(priv.poem)}</div><div class="s">📜 Встань на стул и читай с выражением!</div>`;
      if (ev.id === 'convince' && !q.res) h += q.ask ? `<div class="askv">Просит: <b>${fmt(q.ask)}</b></div>` : '';
      if (ev.id === 'convince' && mine && !q.res) h += `<div class="bidrow"><input id="askv" type="number" inputmode="numeric" placeholder="Сколько просишь?"><button id="askgo">Попросить</button></div>`;
      if (q.res) h += `<div class="res">${esc(q.res)}</div>`;
      else if (ev.id === 'give' && mine && q.el) h += `<div class="t sm">Кому подарить?</div>${picks(q.el, 'give')}`;
      h += `<div class="s">${mine ? 'Это про тебя! 👀' : `${q.side === 'a' ? '😇' : '😈'} ${entB(q.vic)}`}</div></div>`;
      return top + h;
    }
    if (q.st === 'bonus') return top + conHTML(eid, q, q.con || {});
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
    const acd = q.st === 'ans' && q.at ? '<span class="acd" id="acd"></span>' : '';
    const md = q.md === 'a' ? '<div class="mdn">🎵 Слушай музыку</div>' : q.md === 'v' ? '<div class="mdn">🎬 Смотри на экран</div>' : '';
    return top + md + `<div class="bzwrap"><button class="buzz ${cls}" id="buzz"><span id="bzl">${label}</span>${acd}</button></div>` + bribeHTML(eid) + hintHTML(q);
  }
  const picks = (ids, kind) => `<div class="picks">${ids.map(id => { const e = entO(id); return e ? `<button class="pick" data-pick="${esc(id)}" data-kind="${kind}" style="--c:${e.c}">${esc(e.n)}</button>` : ''; }).join('')}</div>`;
  function conHTML(eid, q, c) {
    const s = side(c, eid), head = `<div class="ch"><span>${c.i || '🎁'}</span><b>${esc(c.n || 'Бонус-конкурс')}</b>${c.stake ? `<em>ставка ${fmt(c.stake)}</em>` : ''}</div>`;
    const vs = c.b ? `${entB(c.a)} <span class="vsx">VS</span> ${entB(c.b)}` : entB(c.a);
    const tbar = c.tm ? '<div class="tbar"><i id="cbar"></i></div>' : '';
    switch (c.st) {
      case 'who': return center('🎁', 'Бонус!', 'Ведущий выбирает, кто играет');
      case 'spin': return center('🎰', 'Бонус-конкурс!', 'Крутим рулетку конкурсов — смотри на экран');
      case 'pick': {
        const pk = c.g || c.a, kar = c.id === 'kar';
        if (pk !== eid) return head + center(c.i, kar ? 'Кому достанется микрофон?' : 'Выбор соперника', pk ? `${entB(pk)} ${kar ? 'решает, кто будет петь' : 'выбирает ' + esc(c.pw || 'соперника')}…` : 'Решает ведущий');
        if (done['pick' + q.k]) return head + center(kar ? '🎤' : '⚔️', 'Выбор сделан', 'Смотри на экран');
        return head + `<div class="center"><div class="t">${kar ? 'Кому отдаёшь микрофон?' : 'Выбери ' + esc(c.pw || 'соперника')}</div>${(c.el || []).length ? picks(c.el, 'con') : '<div class="s">Некого выбрать — ведущий решит сам</div>'}</div>`;
      }
      case 'stake': return head + center('🎰', vs, 'Разыгрываем ставку…');
      case 'ready': {
        if (c.id === 'kar') return head + (s ? center('🎤', 'Поёшь ты!', 'Песня и слова — на экране. Ведущий запустит минус') : center('🎤', `Поёт ${entN(c.a)}`, 'Слушай внимательно — потом оценишь 👍 или 👎'));
        if (c.sh && s === 'a') return head + wordCard(q, c) + '<div class="s ctr">Как будешь готов(а), ведущий запустит таймер</div>';
        const mine = s && c.pr ? `<br>${esc(c.pl || 'Тема')}: <b>${esc(c.pr[s])}</b>` : s && c.theme ? `<br>${esc(c.pl || 'Тема')}: <b>${esc(c.theme)}</b>` : '';
        if (s) return head + center(c.i, 'Ты участвуешь!', `${vs}<br>Правила — на экране.${mine}`);
        return head + center(c.i, esc(c.n), vs);
      }
      case 'play': return head + tbar + conPlay(eid, q, c, s, vs);
      case 'vote': {
        if (s) return head + center('🗳', 'Идёт голосование', 'Скрести пальцы 🤞');
        const can = (c.vs || []).includes(pid), voted = (c.vd || []).includes(pid) || done['vote' + q.k];
        if (!can) return head + center('🗳', 'Голосование', vs);
        if (voted) return head + center('✅', 'Голос принят', 'Ждём остальных');
        if (c.id === 'kar') return head + `<div class="center"><div class="t">Как спел(а) ${entB(c.a)}?</div><div class="picks"><button class="pick big" data-vote="y" style="--c:#2ecc71">👍 Круто!</button><button class="pick big" data-vote="n" style="--c:#e74c3c">👎 Мимо</button></div><div class="s">Голос тайный</div></div>`;
        return head + `<div class="center"><div class="t">Кто был лучше?</div><div class="picks">${['a', 'b'].map(x => { const e = entO(c[x]); return e ? `<button class="pick big" data-vote="${x}" style="--c:${e.c}">${esc(e.n)}</button>` : ''; }).join('')}</div></div>`;
      }
      case 'result': return head + center(c.win === eid ? '🏆' : '🎉', c.win === eid ? 'Ты победил(а)!' : 'Итог', esc(c.res || ''));
    }
    return head;
  }
  function wordCard(q, c) {
    const w = priv && priv.k === q.k && priv.word, hum = c && c.id === 'hum';
    return `<div class="center"><div class="s">🤫 ${hum ? 'Твоя песня' : 'Твоё слово'} — никому не показывай!</div><div class="word">${w ? esc(w) : '…'}</div><div class="t sm">${esc((c && c.sh) || 'Покажи его без слов и звуков')}</div></div>`;
  }
  function conPlay(eid, q, c, s, vs) {
    switch (c.id) {
      case 'rps': {
        if (!s) return center('✊✌️✋', 'Камень-ножницы-бумага', vs);
        const mine = done['rps' + q.k + (c.rnd || 1)] || (c.ch && c.ch[s]);
        if (mine) return center(RPS[done['rps' + q.k + (c.rnd || 1)]] ? RPS[done['rps' + q.k + (c.rnd || 1)]][0] : '✔', 'Выбор сделан', 'Ждём соперника… Смотри на экран');
        return `<div class="center"><div class="t">${c.rnd > 1 ? 'Переигровка! ' : ''}Твой выбор</div><div class="rpsb">${Object.keys(RPS).map(k => `<button data-rps="${k}"><span>${RPS[k][0]}</span><b>${RPS[k][1]}</b></button>`).join('')}</div><div class="s">Соперник не увидит, пока не выберете оба</div></div>`;
      }
      case 'dance': return s ? center('💃', 'ТАНЦУЙ!', 'Покажи всё, на что способен(на)! 🔥') : center('🕺', 'Танцевальный баттл', `${vs}<br>Смотри внимательно — потом голосование`);
      case 'sing': case 'toast': case 'parody': {
        const cur = c.turn === 'b' ? c.b : c.a, pr = `${esc(c.pl || 'Тема')}: <b>${esc(c.theme || '')}</b>`;
        const now = c.id === 'sing' ? 'ПОЁШЬ ТЫ!' : c.id === 'toast' ? 'ТВОЙ ТОСТ!' : 'ТВОЙ ВЫХОД!';
        if (cur === eid) return center(c.i, now, pr);
        if (s) return center('⏳', c.turn === 'a' ? 'Ты следующий(ая)' : 'Ты уже выступил(а)', `Сейчас — ${entB(cur)}`);
        return center(c.i, `Выступает ${entN(cur)}`, pr);
      }
      case 'kar': return s ? center('🎤', 'ПОЙ!', 'Слова — на экране. Жги! 🔥') : center('🎤', `Поёт ${entN(c.a)}`, 'Слушай — потом оценишь 👍 или 👎');
      case 'hum': case 'draw': return c.a === eid ? wordCard(q, c) : center(c.i, esc(c.n), `${entB(c.a)} ${c.id === 'hum' ? 'мычит песню' : 'рисует'} — угадывай вслух!`);
      case 'arm': return s ? center('💪', 'ДАВИ!', 'Локоть не отрывать!') : center('💪', 'Армрестлинг', vs);
      case 'balance': return s ? center('🦩', 'Стой на одной ноге!', 'Глаза закрыты, руками ни за что не держаться') : center('🦩', 'Цапля', vs);
      case 'chain': return center('🔗', esc(c.word || 'Цепочка'), s ? 'Называй по очереди — 5 секунд на слово, без повторов' : vs);
      case 'laugh': return s === 'a' ? center('🤪', 'СМЕШИ!', `Рассмеши ${entB(c.b)} — только без рук`) : s === 'b' ? center('😐', 'НЕ СМЕЙСЯ!', 'Держи лицо 30 секунд') : center('😂', 'Не засмейся', vs);
      case 'tongue': return s ? center('👅', 'Три раза подряд!', esc(c.word || '')) : center('👅', 'Скороговорка', `${entB(c.a)} читает с экрана`);
      case 'shot': return s ? center('🥃', 'Руки за спину!', 'Стопку — только без рук!') : center('🥃', 'Стопка без рук', vs);
      case 'tap': {
        if (!s) return center('👆', 'Тап-баттл', vs);
        return `<div class="center"><div class="cdn" id="tcd">${c.cd ? c.cd : c.go ? '' : 'Приготовься…'}</div><button class="tapbtn ${c.go ? 'on' : ''}" id="tapbtn"><b id="tapn">${tap.g === c.gid ? tap.n : 0}</b><small id="tapl">${c.go ? 'ЖМИ!' : 'ждём старта'}</small></button></div>`;
      }
      case 'react': {
        if (!s) return center('⚡', 'Дуэль реакции', vs);
        if (rx.g === c.gid && rx.sent) return `<div class="rzone done"><b>${esc(rx.res)}</b><small>Смотри на экран</small></div>`;
        document.body.classList.add(c.go ? 'rgo' : 'rwait');
        return `<button class="rzone ${c.go ? 'go' : 'wait'}" id="rzone"><b>${c.go ? 'ЖМИ!' : 'Жди зелёного…'}</b><small>${c.go ? '' : 'Нажмёшь раньше — проиграешь'}</small></button>`;
      }
      case 'croc': return c.a === eid ? wordCard(q, c) : center('🐊', 'Крокодил', `${entB(c.a)} показывает слово — угадывай вслух!`);
      case 'stare': return s ? center('👁️', 'Не моргай!', 'Смотри сопернику в глаза и держись') : center('👀', 'Гляделки', vs);
    }
    return center(c.i || '🎁', esc(c.n || ''), vs);
  }
  function afterBuild(eid) {
    const q = S.q, c = q && q.con;
    if (S.phase === 'q' && c && c.id === 'react' && c.st === 'play' && c.go && side(c, eid) && rx.g === c.gid && !rx.at && !rx.sent) {
      requestAnimationFrame(() => requestAnimationFrame(() => { if (rx.g === c.gid && !rx.at) rx.at = performance.now(); }));
    }
  }
  function hintHTML(q) {
    if (!priv || priv.k !== q.k || priv.word !== undefined || priv.poem !== undefined) return '';
    return `<div class="hint">🤫 ${priv.hint ? `Подсказка: <b>${esc(priv.hint)}</b>` : 'Подсказки нет — судья шепнёт её лично'}</div>`;
  }
  function bribeOK(eid) {
    const q = S && S.q; if (!q || (q.bb || []).includes(eid)) return false;
    if (q.ow) return q.ow === eid && ['read', 'open', 'timeup'].includes(q.st);
    return ['read', 'open', 'ans'].includes(q.st) && !(q.tr || []).includes(eid);
  }
  function bribeHTML(eid) {
    const q = S.q;
    if (!bribeOK(eid)) return (q.bb || []).includes(eid) ? '<div class="bribe done">🤫 Подсказка получена</div>' : '';
    return `<button class="bribe" id="bribe">💰 Подкупить судью · −${fmt(q.bc)}</button>`;
  }
  function aucState(me) {
    const q = S.q, bids = (q.au && q.au.b) || {};
    let max = 0, lead = null; for (const id in bids) if (bids[id] > max) { max = bids[id]; lead = id; }
    return { max, lead, cap: Math.max(me.s, q.p), min: Math.max(q.p, max + 1) };
  }
  function aucUpd(eid, me) {
    const box = $('#aucinfo'); if (!box) return;
    const q = S.q, passed = (q.au && q.au.ps) || {}, { max, lead, cap } = aucState(me);
    const next = Math.max(q.p, max + 100), opts = [];
    if (lead !== eid) { if (next <= cap) opts.push(next); if (next + 400 <= cap) opts.push(next + 400); }
    const canAll = cap > max && lead !== eid;
    const h = `<div class="t">🔨 Аукцион</div><div class="s">Старт: ${fmt(q.p)} · у тебя ${fmt(me.s)}</div>`
      + `<div class="lead">${lead ? `Лидер: <b>${entN(lead)}</b> — ${fmt(max)}` : 'Ставок пока нет'}</div>`
      + (lead === eid ? '<div class="mine">Ты лидируешь! 🔥</div>' : '') + (passed[eid] ? '<div class="s">Ты спасовал</div>' : '')
      + `<div class="abtns">${opts.map(v => `<button data-bid="${v}">Ставка ${fmt(v)}</button>`).join('')}${canAll ? `<button class="all" data-bid="all">Ва-банк · ${fmt(cap)}</button>` : ''}${!passed[eid] && lead !== eid ? '<button class="pass" data-bid="pass">Пас</button>' : ''}</div>`
      + (!opts.length && !canAll && lead !== eid ? '<div class="s">Не хватает очков, чтобы перебить ставку</div>' : '');
    if (box.dataset.h !== h) { box.innerHTML = h; box.dataset.h = h; }
    const row = $('#bidrow'); if (row) row.style.display = lead !== eid && canAll ? '' : 'none';
    const inp = $('#bidv'); if (inp && document.activeElement !== inp) inp.placeholder = `Своя ставка: ${fmt(Math.max(q.p, max + 1))}…${fmt(cap)}`;
  }
  function finalHTML(eid, me) {
    const f = S.fin, inF = (f.pt || []).includes(eid);
    if (f.st === 'strike') {
      const left = f.left || [], ths = f.ths || [];
      if (left.length <= 1) return center('🎯', 'Тема финала', `<b>${esc(ths[left[0]] || f.th || '')}</b>`);
      if (f.turn === eid) return `<div class="center"><div class="t">✂️ Твоя очередь!</div><div class="s">Вычеркни тему, которую не хочешь в финале</div><div class="strike">${left.map(i => `<button data-strike="${i}">✕ ${esc(ths[i])}</button>`).join('')}</div></div>`;
      return `<div class="center"><div class="big">✂️</div><div class="t">Вычёркиваем темы</div><div class="s">Сейчас вычёркивает: ${entB(f.turn)}</div><div class="strike ro">${left.map(i => `<span>${esc(ths[i])}</span>`).join('')}</div></div>`;
    }
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
  const left = (tm, now) => (tm.r ? Math.max(0, tm.l - (now - sAt) / 1000) : tm.l);
  function tickUI() {
    if (!S) return;
    const now = Date.now(), q = S.q;
    const bar = $('#tbar');
    if (bar) {
      const tm = S.phase === 'final' ? S.fin && S.fin.tm : q && q.tm;
      if (tm && tm.tot) { const l = left(tm, now); bar.style.width = Math.max(0, Math.min(100, l / tm.tot * 100)) + '%'; bar.className = l <= 5 ? 'danger' : ''; }
    }
    const acd = $('#acd');
    if (acd && q && q.at) { const l = left(q.at, now); acd.textContent = q.at.up || l <= 0 ? '⏰ время!' : Math.ceil(l) + ' сек'; acd.classList.toggle('low', l <= 5); }
    const cb = $('#cbar'), c = q && q.con;
    if (cb && c && c.tm) { const l = left(c.tm, now); cb.style.width = Math.max(0, Math.min(100, l / c.tm.tot * 100)) + '%'; cb.className = l <= 5 ? 'danger' : ''; }
    if (tap.g && !tap.fin && now >= tap.end) tapFinish();
  }

  /* ---------- тап-баттл и реакция: время считает сам телефон, поэтому задержка связи не мешает ---------- */
  const tap = { g: '', n: 0, end: 0, fin: false, t: null };
  const rx = { g: '', at: 0, sent: false, res: '' };
  function tapStart(g) { clearInterval(tap.t); Object.assign(tap, { g, n: 0, end: Date.now() + 10000, fin: false }); tap.t = setInterval(() => tapSend(false), 300); vib(120); }
  function tapSend(fin) { const q = S && S.q; if (!q || !tap.g) return; send({ t: 'tap', k: q.k, n: tap.n, g: tap.g, fin: fin ? 1 : 0 }); }
  function tapFinish() {
    tap.fin = true; clearInterval(tap.t); tapSend(true); setTimeout(() => tapSend(true), 700); vib([100, 50, 100]);
    const b = $('#tapbtn'); if (b) { b.classList.remove('on'); b.classList.add('fin'); } const l = $('#tapl'); if (l) l.textContent = 'Готово!';
  }
  function onTap() {
    if (!tap.g || tap.fin || Date.now() >= tap.end) return;
    tap.n++; const n = $('#tapn'); if (n) n.textContent = tap.n;
    const b = $('#tapbtn'); if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
  }
  function onReact() {
    const q = S && S.q, c = q && q.con; if (!c || c.id !== 'react' || rx.sent || rx.g !== c.gid) return;
    let ms = -1;
    if (c.go && rx.at) ms = Math.max(1, Math.round(performance.now() - rx.at));
    rx.sent = true; rx.res = ms < 0 ? '❌ Рано!' : `⚡ ${ms} мс`;
    send({ t: 'react', k: q.k, ms, g: c.gid }); vib(ms < 0 ? [200] : 40);
    document.body.classList.remove('rwait', 'rgo'); sig = ''; render();
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
  function bidCustom() {
    const q = S && S.q, me = myMe(), inp = $('#bidv'), note = $('#bidnote'); if (!q || !me || !inp) return;
    const v = Math.floor(+String(inp.value).replace(/\s/g, '')), { min, cap } = aucState(me);
    if (!(v >= min) || v > cap) { inp.classList.add('err'); if (note) note.textContent = v > cap ? `Максимум — ${fmt(cap)} (ва-банк)` : `Ставка должна быть не меньше ${fmt(min)}`; vib(60); return; }
    inp.classList.remove('err'); inp.value = ''; inp.blur(); if (note) note.textContent = `Ставка ${fmt(v)} отправлена`;
    send({ t: 'bid', k: q.k, v }); vib(25);
  }
  const press = (key, msg) => { if (done[key]) return false; done[key] = 1; send(msg); vib(40); sig = ''; render(); return true; };
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#netbar')) { location.reload(); return; }
    if (t.closest('#rcgo')) {
      const v = (($('#rc') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (v.length < 4) return;
      room = v;
      try { history.replaceState(null, '', '?r=' + room + '&b=' + bi + (Net.override ? '&broker=' + encodeURIComponent(Net.override) : '') + location.hash); } catch (err) { /* ничего */ }
      sig = ''; start(); return;
    }
    if (t.closest('#joinbtn')) return doJoin(null);
    const tm = t.closest('[data-team]'); if (tm) return doJoin(tm.dataset.team);
    const pf = t.closest('[data-pf]'); if (pf) { draftPr = draftPr || {}; draftPr[pf.dataset.pf] = !draftPr[pf.dataset.pf]; pf.classList.toggle('on', !!draftPr[pf.dataset.pf]); vib(15); return; }
    if (t.closest('#prgo')) return savePrefs();
    if (t.closest('#prchg')) { surveyOpen = true; draftPr = null; sig = ''; render(); return; }
    if (t.closest('#bribe')) return doBribe();
    const q = S && S.q;
    if (t.closest('#coinbtn') && q) return press('coin' + q.k, { t: 'coin', k: q.k });
    if (t.closest('#spinbtn') && q) return press('spin' + q.k, { t: 'spin', k: q.k });
    const pk = t.closest('[data-pick]');
    if (pk && q) return press((pk.dataset.kind === 'give' ? 'give' : 'pick') + q.k, { t: 'pick', k: q.k, v: pk.dataset.pick });
    const rp = t.closest('[data-rps]');
    if (rp && q && q.con) { const key = 'rps' + q.k + (q.con.rnd || 1); if (done[key]) return; done[key] = rp.dataset.rps; send({ t: 'rps', k: q.k, v: rp.dataset.rps }); vib(40); sig = ''; render(); return; }
    const vt = t.closest('[data-vote]');
    if (vt && q) return press('vote' + q.k, { t: 'vote', k: q.k, v: vt.dataset.vote });
    const sk = t.closest('[data-strike]');
    if (sk && S && S.fin) { const key = 'strike' + (S.fin.left || []).length; if (done[key + 's']) return; done[key + 's'] = 1; send({ t: 'strike', v: +sk.dataset.strike }); vib(40); sk.disabled = true; sk.classList.add('gone'); return; }
    if (t.closest('#bidgo')) return bidCustom();
    if (t.closest('#askgo') && q) { const inp = $('#askv'), v = Math.floor(Math.abs(+String((inp || {}).value || '').replace(/\s/g, ''))); if (!(v > 0)) { if (inp) inp.classList.add('err'); return; } send({ t: 'ask', k: q.k, v }); if (inp) { inp.value = ''; inp.blur(); } vib(30); return; }
    const b = t.closest('[data-bid]');
    if (b && q) { const v = b.dataset.bid; send({ t: 'bid', k: q.k, v: v === 'all' || v === 'pass' ? v : +v }); vib(25); return; }
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
  app.addEventListener('pointerdown', e => {
    if (e.target.closest('#buzz')) { e.preventDefault(); onBuzz(); }
    else if (e.target.closest('#tapbtn')) { e.preventDefault(); onTap(); }
    else if (e.target.closest('#rzone')) { e.preventDefault(); onReact(); }
  });
  app.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'nm' && S && S.mode !== 'teams') doJoin(null);
    if (e.key === 'Enter' && e.target.id === 'rc') { const g = $('#rcgo'); if (g) g.click(); }
    if (e.key === 'Enter' && e.target.id === 'bidv') bidCustom();
  });

  if (room) start(); else render();
})();
