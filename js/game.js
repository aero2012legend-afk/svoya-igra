/* game.js — экран ведущего (телевизор): логика игры, отрисовка, управление. */
(() => {
  'use strict';
  const PACK = window.GAME || { title: 'Своя игра', rounds: [], final: null };
  PACK.rounds = PACK.rounds || [];

  /* ================= утилиты ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const r10 = v => Math.max(10, Math.round(v / 10) * 10);
  const fmt = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ru-RU');
  const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(Math.round(n)).toLocaleString('ru-RU');
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
  const COLORS = ['#ff4d5e', '#36e2ff', '#ffcc33', '#2ee59d', '#ff3fa4', '#a77bff', '#ff8a3d', '#5b8cff', '#c6ff3d', '#ff6fd8', '#3dffb5', '#ffd84d', '#9d7bff', '#ff5c8a', '#4dd2ff'];
  const SAVE = 'svoyaigra.v1';
  const PAGES = 'https://aero2012legend-afk.github.io/svoya-igra/';

  /* ================= состояние ================= */
  let G = null, undo = [], busy = false, curSig = null, boardIntro = false;
  let client = null, netOnline = false, everOnline = false, pubT = null, connT = null, packSent = false;
  let tInt = null, tLast = 0, lastSec = null, ovResolve = null, cvInt = null, lastBidShown = null, lastPop = null;

  function newState() {
    return {
      v: 1, room: Net.code(5), key: Net.code(10, 'abcdefghijkmnpqrstuvwxyz23456789'), broker: 0,
      mode: 'solo', ents: [], phones: {}, set: { timer: 20, bribe: 50, ftimer: 45 },
      started: false, resume: null, round: 0, played: {}, chooser: null, phase: 'lobby', q: null, fin: null, fz: {}, x2: {},
    };
  }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ G, undo: undo.slice(-12) })); } catch (e) { /* хранилище недоступно */ } }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE) || 'null');
      if (d && d.G && d.G.v === 1) { G = d.G; undo = d.undo || []; fixup(); return true; }
    } catch (e) { /* битое сохранение */ }
    return false;
  }
  function fixup() {
    if (G.q) {
      G.q.tr = false;
      if (G.q.stage === 'intro') G.q.stage = { cat: 'cat', auction: 'auction', trap: 'trap' }[G.q.type] || 'read';
      if (G.q.stage === 'auction' && !G.q.auc) G.q.auc = { bids: {}, passed: {}, allin: {} };
    }
    if (G.fin) G.fin.tr = false;
    if (G.phase === 'trans') G.phase = G.fin ? 'final' : G.q ? 'q' : 'board';
    if (G.phase === 'q' && !G.q) G.phase = 'board';
  }
  function snap() { undo.push(JSON.stringify(G)); if (undo.length > 40) undo.shift(); }
  function doUndo() {
    if (!undo.length) return toast('Отменять нечего');
    stopTimer(); Sound.think(false); stopConvince(); closeOverlay(); busy = false;
    const prev = JSON.parse(undo.pop());
    prev.phones = Object.assign({}, prev.phones, G.phones);
    prev.room = G.room; prev.key = G.key; prev.broker = G.broker;
    G = prev; fixup(); curSig = null; toast('↶ Отменено'); changed();
  }

  /* ================= данные ================= */
  const R = () => PACK.rounds[G.round] || { name: '', themes: [] };
  const qd = (r, t, i) => { const th = ((PACK.rounds[r] || {}).themes || [])[t]; return th && th.questions ? th.questions[i] : null; };
  const curD = () => (G.q ? qd(G.q.r, G.q.t, G.q.i) || {} : {});
  const themeOf = q => { const d = qd(q.r, q.t, q.i) || {}; const th = ((PACK.rounds[q.r] || {}).themes || [])[q.t] || {}; return (q.type === 'cat' && d.catTheme) || th.name || ''; };
  const roundName = () => G.phase === 'final' ? 'Финал' : G.phase === 'end' ? 'Итоги игры' : G.phase === 'lobby' ? (PACK.subtitle || '') : (R().name || `Раунд ${G.round + 1}`);
  const ent = id => G.ents.find(e => e.id === id);
  const entName = id => (ent(id) || {}).name || '—';
  const roundDone = () => R().themes.every((th, t) => (th.questions || []).every((x, i) => G.played[`${G.round}-${t}-${i}`]));
  const isOnline = eid => { const now = Date.now(); return Object.values(G.phones).some(p => p.ent === eid && now - p.seen < 35000); };
  const members = eid => Object.values(G.phones).filter(p => p.ent === eid).map(p => p.name);
  const bribeCost = q => r10((q.stake || q.price) * G.set.bribe / 100);
  const baseUrl = () => (/^https?:$/.test(location.protocol) ? new URL('.', location.href).href : (PACK.siteUrl || PAGES));
  function siteUrl(page, extra) {
    const u = new URL(baseUrl() + page);
    u.searchParams.set('r', G.room); u.searchParams.set('b', G.broker);
    if (extra) Object.keys(extra).forEach(k => u.searchParams.set(k, extra[k]));
    if (Net.override) u.searchParams.set('broker', Net.override);
    return u.href;
  }
  const playUrl = () => siteUrl('play.html');
  const pultUrl = () => siteUrl('pult.html', { k: G.key });
  function addEnt(name, id) {
    const used = new Set(G.ents.map(e => e.color));
    const e = { id: id || 'm' + Net.code(6), name, score: 0, color: COLORS.find(c => !used.has(c)) || pick(COLORS) };
    G.ents.push(e); return e;
  }
  const addScore = (id, d) => { const e = ent(id); if (e && d) e.score += d; };

  /* ================= связь ================= */
  const T = s => Net.PREFIX + G.room + '/' + s;
  function netStart() {
    if (client) client.close();
    everOnline = false; netOnline = false;
    const c = client = new Net.Client(Net.brokerUrl(G.broker));
    c.subscribe(T('i')); c.subscribe(T('c/' + G.key));
    c.onMessage(onNet);
    c.onStatus(on => {
      if (c !== client) return;
      netOnline = on; if (on) { everOnline = true; publishNow(); }
      renderTop(); if (G.phase === 'lobby') updLobby();
    });
    clearTimeout(connT);
    if (!Net.override) connT = setTimeout(() => {
      if (c === client && !everOnline) {
        G.broker = (G.broker + 1) % Net.BROKERS.length; save();
        toast('Пробую другой сервер связи: ' + Net.brokerName(G.broker));
        netStart(); render();
      }
    }, 9000);
  }
  function publish() { clearTimeout(pubT); pubT = setTimeout(publishNow, 50); }
  function publishNow() { clearTimeout(pubT); if (!client) return; client.publish(T('s'), pubState(), true); publishHost(false); }
  function phoneMap() { const m = {}; for (const pid in G.phones) { const p = G.phones[pid]; if (p.ent && ent(p.ent)) m[pid] = p.ent; } return m; }
  function pubState() {
    const q = G.q, f = G.fin;
    return {
      v: 1, t: Date.now(), title: PACK.title, mode: G.mode, phase: G.phase, round: roundName(), chooser: G.chooser,
      ents: G.ents.map(e => ({ id: e.id, n: e.name, s: e.score, c: e.color, fz: G.fz[e.id] || 0, x2: !!G.x2[e.id] })),
      pm: phoneMap(),
      q: q ? {
        k: q.key, th: themeOf(q), p: q.price, ty: q.type, st: q.stage, ow: q.owner, an: q.ans, tr: q.tried, bb: q.bribed, bc: bribeCost(q),
        stake: q.stake, vic: q.victim, tm: { l: Math.round(q.tl * 10) / 10, r: !!q.tr, tot: G.set.timer },
        au: q.auc ? { b: q.auc.bids, ps: q.auc.passed } : null,
        ev: q.trap && q.trap.ev ? { i: EV[q.trap.ev].icon, n: EV[q.trap.ev].name } : null,
      } : null,
      fin: f ? { st: f.stage, th: (PACK.final || {}).theme, pt: f.part, bt: Object.keys(f.bets), an: Object.keys(f.answers), tm: { l: Math.round(f.tl * 10) / 10, r: !!f.tr, tot: G.set.ftimer } } : null,
    };
  }
  function publishHost(withPack) {
    if (!client) return;
    const P = 'h/' + G.key + '/';
    if (withPack) { // все вопросы — только когда открыт пульт
      client.publish(T(P + 'pack'), {
        title: PACK.title, final: PACK.final || null,
        rounds: PACK.rounds.map(r => ({ name: r.name, themes: (r.themes || []).map(th => ({ name: th.name, questions: (th.questions || []).map(x => ({ price: x.price, q: x.q, a: x.a, hint: x.hint || '', type: x.type || '', catTheme: x.catTheme || '' })) })) })),
      }, true);
    }
    const q = G.q, d = curD(), f = G.fin, F = PACK.final || {};
    client.publish(T(P + 'cur'), {
      t: Date.now(), phase: G.phase, round: G.round, played: Object.keys(G.played),
      q: q ? {
        key: q.key, th: themeOf(q), p: q.price, ty: q.type, st: q.stage, text: d.q || '', a: d.a || '', hint: d.hint || '',
        ans: q.ans ? entName(q.ans) : '', ow: q.owner ? entName(q.owner) : '', stake: q.stake || 0,
        bribes: (q.blog || []).map(b => ({ n: entName(b.e), h: b.h })), ev: q.trap && q.trap.ev ? EV[q.trap.ev].name : '',
      } : null,
      fin: f ? { st: f.stage, th: F.theme, q: F.q, a: F.a, answers: Object.keys(f.answers).map(id => ({ n: entName(id), v: f.answers[id], b: f.bets[id] })) } : null,
    }, true);
  }
  function sendPrivate(eid, msg) { if (!client) return; for (const pid in G.phones) if (G.phones[pid].ent === eid) client.publish(T('p/' + pid), msg, true); }

  function onNet(topic, d) {
    if (!d || typeof d !== 'object') return;
    if (topic === T('c/' + G.key)) return onRemote(d);
    if (topic !== T('i')) return;
    const pid = clean(d.p, 24); if (!pid) return;
    if (d.t === 'join') return onJoin(pid, d);
    const ph = G.phones[pid]; if (!ph) return;
    const wasOff = Date.now() - ph.seen > 35000; ph.seen = Date.now();
    if (wasOff) { renderScores(); if (G.phase === 'lobby') updLobby(); }
    const eid = ph.ent; if (!eid || !ent(eid)) return;
    if (d.t === 'buzz') onBuzz(eid, d.k);
    else if (d.t === 'bribe') onBribe(eid, d.k);
    else if (d.t === 'bid') placeBid(eid, d.v, false, d.k);
    else if (d.t === 'bet') onBet(eid, d.v);
    else if (d.t === 'fans') onFinalAnswer(eid, d.v);
  }
  function onJoin(pid, d) {
    const name = clean(d.n, 20) || 'Игрок';
    const ph = G.phones[pid] || (G.phones[pid] = { name, ent: null, seen: 0 });
    ph.name = name; ph.seen = Date.now();
    if (G.mode === 'solo') {
      let e = ent(pid);
      if (!e) { e = addEnt(name, pid); Sound.play('join'); toast(`📱 ${name} в игре!`); }
      else if (!e.hn) e.name = name;
      ph.ent = pid;
    } else {
      const team = d.team && ent(d.team) ? d.team : null;
      if (team && ph.ent !== team) { ph.ent = team; Sound.play('join'); toast(`📱 ${name} → ${entName(team)}`); }
    }
    changed();
  }
  function onRemote(d) {
    if (d.t === 'ok') judge(true); else if (d.t === 'bad') judge(false); else if (d.t === 'ans') reveal();
    else if (d.t === 'space') spaceAction(); else if (d.t === 'next') nextAction(); else if (d.t === 'hello') publishHost(true);
  }

  /* ================= отрисовка ================= */
  function changed() { save(); publish(); render(); }
  function render() { renderTop(); renderStage(); renderScores(); }

  function renderTop() {
    let c = '';
    if (G.phase === 'board' && G.chooser && ent(G.chooser)) c = `Выбирает: <b>${esc(entName(G.chooser))}</b> ⭐`;
    else if (G.phase === 'q' && G.q) c = `<b>${esc(themeOf(G.q))}</b> · ${fmt(G.q.stake || G.q.price)}`;
    $('#top').innerHTML = `<div class="tl">${esc(roundName())}</div><div class="tc">${c}</div><div class="tr">`
      + `<span class="room">Код комнаты: <b>${esc(G.room)}</b></span><span class="net ${netOnline ? 'on' : ''}" title="${netOnline ? 'Связь с телефонами есть' : 'Нет связи с сервером'}">●</span>`
      + `<button class="ib" data-act="undo" title="Отменить (Ctrl+Z)">↶</button><button class="ib" data-act="mute" title="Звук (M)">${Sound.muted ? '🔇' : '🔊'}</button>`
      + `<button class="ib" data-act="fs" title="Полный экран (F)">⛶</button><button class="ib" data-act="help" title="Горячие клавиши (H)">?</button><button class="ib" data-act="menu" title="Меню">☰</button></div>`;
  }
  function stageSig() {
    if (G.phase === 'lobby') return 'lobby:' + G.mode;
    if (G.phase === 'board') return 'board:' + G.round;
    if (G.phase === 'q') { const q = G.q; return ['q', q.key, q.stage, q.ans, q.owner, q.victim, q.trap ? q.trap.step : ''].join(':'); }
    if (G.phase === 'final') return 'fin:' + G.fin.stage + ':' + (G.fin.showA ? 1 : 0);
    return G.phase;
  }
  function renderStage() {
    const st = $('#stage'), sig = stageSig();
    if (sig !== curSig) { curSig = sig; st.innerHTML = ''; const v = build(); if (v) st.appendChild(v); }
    if (G.phase === 'lobby') updLobby();
    else if (G.phase === 'board') updBoard();
    else if (G.phase === 'q') updQ();
    else if (G.phase === 'final') updFinal();
  }
  function build() {
    if (G.phase === 'lobby') return vLobby();
    if (G.phase === 'board') return vBoard();
    if (G.phase === 'q') return vQ();
    if (G.phase === 'final') return vFinal();
    if (G.phase === 'end') return vEnd();
    return el('<div></div>');
  }

  function renderScores() {
    const box = $('#scores'); if (!box) return;
    box.style.display = G.phase === 'lobby' ? 'none' : '';
    box.classList.toggle('many', G.ents.length > 8);
    const q = G.phase === 'q' ? G.q : null, ids = G.ents.map(e => e.id);
    Array.from(box.children).forEach(ch => { if (!ids.includes(ch.dataset.id)) ch.remove(); });
    G.ents.forEach((e, idx) => {
      let c = Array.from(box.children).find(ch => ch.dataset.id === e.id);
      if (!c) {
        c = el('<div class="ent"><span class="k"></span><span class="dot"></span><div class="bd"></div><div class="n"></div><div class="s"></div><div class="mem"></div></div>');
        c.dataset.id = e.id; c.dataset.sv = e.score; $('.s', c).textContent = fmt(e.score);
      }
      if (box.children[idx] !== c) box.insertBefore(c, box.children[idx] || null);
      c.style.setProperty('--c', e.color);
      $('.k', c).textContent = idx < 10 ? String((idx + 1) % 10) : '';
      $('.n', c).textContent = e.name;
      $('.dot', c).classList.toggle('on', isOnline(e.id));
      $('.mem', c).textContent = G.mode === 'teams' ? members(e.id).join(', ') : '';
      $('.bd', c).textContent = (G.chooser === e.id && G.phase !== 'lobby' ? '⭐' : '') + (G.fz[e.id] ? '❄️' : '') + (G.x2[e.id] ? '✖️2' : '');
      const old = +c.dataset.sv;
      if (old !== e.score) { c.dataset.sv = e.score; countTo($('.s', c), old, e.score); if (box.style.display !== 'none') floatNum(c, e.score - old); }
      $('.s', c).classList.toggle('neg', e.score < 0);
      c.classList.toggle('chooser', G.chooser === e.id && G.phase !== 'lobby');
      c.classList.toggle('answering', !!q && (q.ans === e.id || q.owner === e.id) && q.stage !== 'reveal');
      c.classList.toggle('tried', !!q && q.tried.includes(e.id) && q.stage !== 'reveal');
    });
  }
  function countTo(node, from, to) {
    const t0 = performance.now(), dur = 750;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function floatNum(card, d) {
    const r = card.getBoundingClientRect(), f = el(`<div class="floatnum ${d > 0 ? 'pos' : 'neg'}">${sgn(d)}</div>`);
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top - 10) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1600);
  }

  /* ----- лобби ----- */
  function vLobby() {
    const opt = (k, vals, f) => `<select data-set="${k}">${vals.map(v => `<option value="${v}">${f(v)}</option>`).join('')}</select>`;
    return el(`<div class="lobby"><div class="lb-left">
      <div class="lb-logo">${esc(PACK.title)}</div><div class="lb-sub">${esc(PACK.subtitle || '')}</div>
      <div class="qrbox"><canvas id="qr" width="8" height="8"></canvas></div>
      <div class="scan">📱 Наведи камеру телефона на код</div><div class="joinurl" id="joinurl"></div>
      <div class="roomcode">Код комнаты: <b id="roomcode"></b></div><div class="netstat" id="netstat"></div>
    </div><div class="lb-right">
      <div class="seg"><button data-act="mode" data-mode="solo">👤 Каждый за себя</button><button data-act="mode" data-mode="teams">👥 Команды</button></div>
      <div class="lbents" id="lbents"></div>
      <div class="lb-actions"><button class="btn" data-act="add">＋ ${G.mode === 'teams' ? 'Команда' : 'Игрок без телефона'}</button></div>
      <div class="settings">
        <label>Время на вопрос ${opt('timer', [10, 15, 20, 30, 45, 60], v => v + ' сек')}</label>
        <label>Подкуп судьи стоит ${opt('bribe', [25, 50, 75, 100], v => v + '% цены вопроса')}</label>
        <label>Время в финале ${opt('ftimer', [30, 45, 60, 90], v => v + ' сек')}</label>
      </div>
      <div class="lb-actions"><button class="btn" data-act="pult">🔑 Пульт ведущего</button><button class="btn gold big" data-act="start">${G.started ? '▶ Продолжить игру' : '▶ Начать игру'}</button></div>
    </div></div>`);
  }
  function updLobby() {
    $$('.seg [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === G.mode));
    const box = $('#lbents');
    if (box) {
      const html = G.ents.length ? G.ents.map(e => `<div class="le" style="--c:${e.color}"><b>${esc(e.name)}</b><small>${G.mode === 'teams'
        ? esc(members(e.id).join(', ') || 'ждём игроков')
        : (isOnline(e.id) ? 'телефон на связи' : G.phones[e.id] ? 'телефон не на связи' : 'без телефона')}</small><span class="dot ${isOnline(e.id) ? 'on' : ''}"></span>`
        + `<button class="x r" data-act="ren" data-id="${esc(e.id)}" title="Переименовать">✎</button><button class="x d" data-act="del" data-id="${esc(e.id)}" title="Удалить">✕</button></div>`).join('')
        : `<div class="empty">${G.mode === 'teams' ? 'Добавь команды — гости выберут свою на телефоне' : 'Гости сканируют QR-код и сразу появляются здесь'}</div>`;
      if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; }
    }
    const ns = $('#netstat');
    if (ns) ns.innerHTML = netOnline ? `<span class="on">●</span> Связь есть · сервер ${esc(Net.brokerName(G.broker))}` : `● Подключаемся к серверу ${esc(Net.brokerName(G.broker))}…`;
    $$('[data-set]').forEach(s => { if (document.activeElement !== s) s.value = String(G.set[s.dataset.set]); });
    const qr = $('#qr'), url = playUrl();
    if (qr && qr.dataset.url !== url) {
      drawQR(qr, url); qr.dataset.url = url;
      const u = new URL(url); $('#joinurl').textContent = u.host + u.pathname; $('#roomcode').textContent = G.room;
    }
  }
  function drawQR(cv, text) {
    if (typeof qrcode !== 'function') return;
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = Math.max(4, Math.floor(480 / (n + 2))), dim = cell * (n + 2);
    cv.width = cv.height = dim; const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, dim, dim); c.fillStyle = '#0a1240';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect((k + 1) * cell, (r + 1) * cell, cell, cell);
  }

  /* ----- табло ----- */
  function vBoard() {
    const r = R(), intro = boardIntro; boardIntro = false;
    const maxQ = Math.max(1, ...r.themes.map(th => (th.questions || []).length));
    const b = el(`<div class="boardwrap"><div class="board" style="grid-template-columns:minmax(15rem,1.55fr) repeat(${maxQ},1fr);grid-template-rows:repeat(${r.themes.length},1fr)"></div></div>`);
    const g = b.firstElementChild;
    r.themes.forEach((th, t) => {
      g.appendChild(el(`<div class="theme" style="animation-delay:${intro ? t * 0.09 : 0}s">${esc(th.name)}</div>`));
      for (let i = 0; i < maxQ; i++) {
        const x = (th.questions || [])[i];
        if (!x) { g.appendChild(el('<div class="cell blank"></div>')); continue; }
        const delay = intro ? 0.35 + t * 0.07 + i * 0.1 : (t + i) * 0.02;
        g.appendChild(el(`<div class="cell ${G.played[`${G.round}-${t}-${i}`] ? 'played' : ''}" data-act="cell" data-t="${t}" data-i="${i}" style="animation-delay:${delay.toFixed(2)}s">${esc(x.price)}</div>`));
      }
    });
    return b;
  }
  function updBoard() { $$('.cell[data-t]').forEach(c => c.classList.toggle('played', !!G.played[`${G.round}-${c.dataset.t}-${c.dataset.i}`])); }
  async function flipCell(cell) {
    if (!cell) return;
    const r = cell.getBoundingClientRect(), st = $('#stage').getBoundingClientRect();
    const f = el(`<div class="flipper"><div class="fl-in"><div class="fl-front">${esc(cell.textContent)}</div><div class="fl-back"></div></div></div>`);
    Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.appendChild(f); Sound.play('flip');
    const dx = st.left + st.width / 2 - (r.left + r.width / 2), dy = st.top + st.height / 2 - (r.top + r.height / 2);
    const sx = st.width / r.width * 0.94, sy = st.height / r.height * 0.9;
    const ease = { duration: 720, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' };
    const a = f.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }], ease);
    f.firstElementChild.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(180deg)' }], ease);
    await a.finished;
    f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }).finished.then(() => f.remove());
  }

  /* ----- вопрос ----- */
  const badge = q => q.type === 'cat' ? '<span class="badge cat">🐱 Кот в мешке</span>' : q.type === 'auction' ? '<span class="badge auction">🔨 Аукцион</span>' : q.type === 'trap' ? '<span class="badge trap">⚠ Ловушка</span>' : '';
  const qSize = s => { s = s || ''; if (/^[\p{Extended_Pictographic}\s‍️]+$/u.test(s)) return 10; const n = s.length; return n < 30 ? 5.4 : n < 60 ? 4.6 : n < 100 ? 3.9 : n < 160 ? 3.2 : n < 240 ? 2.7 : 2.2; };
  const pickerHTML = (list, act) => `<div class="picker">${list.map(e => `<button class="pk" style="--c:${e.color}" data-act="${act}" data-id="${esc(e.id)}">${esc(e.name)}</button>`).join('')}</div>`;

  function vQ() {
    const q = G.q, d = curD();
    if (q.stage === 'intro') return el('<div class="qscreen"></div>');
    if (q.stage === 'cat') {
      const list = G.ents.length > 1 ? G.ents.filter(e => e.id !== G.chooser) : G.ents;
      return el(`<div class="special"><div class="sp-icon">🐱</div><div class="sp-title">Кот в мешке</div><div class="sp-info">Тема: <b>${esc(themeOf(q))}</b> · Цена: <b>${fmt(q.price)}</b></div>
        <div class="sp-hint">${G.chooser && ent(G.chooser) ? `<b>${esc(entName(G.chooser))}</b>, кому отдаёшь кота?` : 'Кому достанется кот?'}</div>${pickerHTML(list, 'catgive')}</div>`);
    }
    if (q.stage === 'auction') {
      return el(`<div class="special"><div class="sp-title">🔨 Аукцион</div><div class="sp-info">Тема: <b>${esc(themeOf(q))}</b> · Старт: <b>${fmt(q.price)}</b></div>
        <div class="sp-hint">Ставки — с телефонов или кнопками здесь. Ва-банк — все свои очки.</div><div class="bids" id="bids"></div>
        <div class="hostbar"><button class="btn gold" data-act="aucclose">Закрыть торги ▶<kbd>→</kbd></button></div></div>`);
    }
    if (q.stage === 'trap') return vTrap(q);
    if (q.stage === 'trapev') return vTrapEv(q);
    const media = d.img ? `<img class="qimg" src="${esc(d.img)}" alt="">` : d.video ? `<video class="qimg" src="${esc(d.video)}" controls autoplay></video>` : d.audio ? `<audio src="${esc(d.audio)}" controls autoplay></audio>` : '';
    const own = q.owner && ent(q.owner) ? `<div class="qowner" style="--c:${ent(q.owner).color}">Отвечает только <b>${esc(entName(q.owner))}</b>${q.type === 'auction' ? ` · ставка ${fmt(q.stake)}` : ''}${G.x2[q.owner] ? ' · ×2' : ''}</div>` : '';
    const banner = q.stage === 'ans' && q.ans && ent(q.ans) ? `<div class="buzzer" style="--c:${ent(q.ans).color}"><div class="bz-l">Отвечает</div><div class="bz-n">${esc(entName(q.ans))}</div>${G.x2[q.ans] ? '<div class="bz-x">×2</div>' : ''}</div>` : '';
    const answer = q.stage === 'reveal' ? `<div class="answer"><div class="al">Правильный ответ</div><div class="at">${esc(d.a)}</div>${resultLine(q)}</div>` : '';
    return el(`<div class="qscreen st-${q.stage}"><div class="qhead"><span class="qth">${esc(themeOf(q))}</span><span class="qpr">${fmt(q.stake || q.price)}</span>${badge(q)}</div>${own}${media}
      <div class="qtext" style="font-size:${qSize(d.q)}rem">${esc(d.q)}</div><div class="timer" id="timer"><i></i><b></b></div><div class="qstatus" id="qstatus"></div>${banner}${answer}
      <div class="hostbar">${hostButtons(q)}</div></div>`);
  }
  function hostButtons(q) {
    const B = (a, label, cls, k) => `<button class="btn ${cls || ''}" data-act="${a}">${label}${k ? `<kbd>${k}</kbd>` : ''}</button>`;
    const J = B('ok', '✓ Верно', 'ok', 'Enter') + B('bad', '✗ Неверно', 'bad', '⌫');
    if (q.stage === 'read') return B('timer', '▶ Старт', 'gold', 'Пробел') + (q.owner ? J : '') + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'open') return B('timer', q.tr ? '⏸ Пауза' : '▶ Продолжить', '', 'Пробел') + (q.owner ? J : '') + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'ans' || q.stage === 'timeup') return J + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'reveal') return B('board', 'К табло ▶', 'gold', '→');
    return '';
  }
  function resultLine(q) {
    const r = q.result;
    if (!r) return `<div class="res none">${q.tried.length ? 'Верного ответа не было' : 'Никто не ответил'}</div>`;
    return `<div class="res ${r.ok ? 'ok' : 'bad'}">${esc(entName(r.who))}: ${sgn(r.ok ? r.val : -r.val)}${r.dbl ? ' (×2)' : ''}</div>`;
  }
  function qStatus(q) {
    if (q.stage === 'read') return q.owner ? '' : '<span class="mut">Приготовьтесь…</span>';
    if (q.stage === 'open' && !q.owner) {
      const fz = G.ents.filter(e => G.fz[e.id]);
      return '<span class="go">Жмите кнопку!</span>' + (q.tried.length ? `<span class="mut">Уже отвечали: ${esc(q.tried.map(entName).join(', '))}</span>` : '')
        + (fz.length ? `<span class="mut">❄️ Заморожены: ${esc(fz.map(e => e.name).join(', '))}</span>` : '');
    }
    if (q.stage === 'timeup') return '<span class="bad">Время вышло!</span>';
    return '';
  }
  function updQ() {
    const q = G.q; if (!q) return;
    updTimer();
    const s = $('#qstatus'); if (s) { const h = qStatus(q); if (s.dataset.h !== h) { s.innerHTML = h; s.dataset.h = h; } }
    const tb = $('.hostbar [data-act=timer]'); if (tb && q.stage === 'open') tb.innerHTML = (q.tr ? '⏸ Пауза' : '▶ Продолжить') + '<kbd>Пробел</kbd>';
    if (q.stage === 'auction') renderBids();
  }
  function updTimer() {
    const h = holder(), t = $('#timer');
    if (!t || !h) { document.body.classList.remove('danger'); return; }
    const tot = G.phase === 'final' ? G.set.ftimer : G.set.timer, frac = Math.max(0, Math.min(1, h.tl / tot));
    t.firstElementChild.style.width = (frac * 100) + '%';
    t.querySelector('b').textContent = Math.ceil(h.tl);
    t.classList.toggle('warn', h.tl <= tot * 0.5 && h.tl > 5); t.classList.toggle('danger', h.tl <= 5); t.classList.toggle('paused', !h.tr);
    document.body.classList.toggle('danger', !!h.tr && h.tl <= 5);
  }

  /* ----- таймер ----- */
  const holder = () => (G.phase === 'final' ? G.fin : G.phase === 'q' ? G.q : null);
  function startTimer() {
    const h = holder(); if (!h || h.tl <= 0) return;
    h.tr = true; tLast = performance.now(); lastSec = Math.ceil(h.tl);
    clearInterval(tInt); tInt = setInterval(tick, 100); publish(); updQorF();
  }
  function stopTimer() { const h = holder(); if (h) h.tr = false; clearInterval(tInt); tInt = null; document.body.classList.remove('danger'); }
  function updQorF() { if (G.phase === 'q') updQ(); else if (G.phase === 'final') updFinal(); }
  function tick() {
    const h = holder(); if (!h || !h.tr) { clearInterval(tInt); return; }
    const now = performance.now(); h.tl = Math.max(0, h.tl - (now - tLast) / 1000); tLast = now;
    const sec = Math.ceil(h.tl);
    if (sec !== lastSec) { lastSec = sec; if (sec > 0) Sound.play(sec <= 5 ? 'tickFast' : 'tick'); }
    updTimer();
    if (h.tl <= 0) { h.tr = false; clearInterval(tInt); document.body.classList.remove('danger'); onTimeout(); }
  }
  function toggleTimer() {
    const h = holder(); if (!h) return;
    if (G.phase === 'q' && G.q.stage === 'read') return openBuzz();
    if (h.tr) { stopTimer(); publish(); updQorF(); }
    else if (h.tl > 0 && ((G.phase === 'q' && G.q.stage === 'open') || (G.phase === 'final' && G.fin.stage === 'q'))) startTimer();
  }
  function onTimeout() {
    if (G.phase === 'final') return finalTimeUp();
    const q = G.q; if (!q) return;
    Sound.play('timeout');
    if (q.owner) { q.stage = 'timeup'; changed(); }
    else if (q.stage === 'open') reveal(true);
  }

  /* ================= ход игры ================= */
  async function startGame() {
    if (busy) return;
    if (!G.ents.length) return toast('Сначала добавь игроков или дождись, пока подключатся телефоны');
    if (!PACK.rounds.length) return toast('В questions.js нет раундов');
    if (G.started && G.resume) { G.phase = G.resume; G.resume = null; curSig = null; return changed(); }
    snap();
    Object.assign(G, { started: true, resume: null, round: 0, played: {}, chooser: null, q: null, fin: null, fz: {}, x2: {}, phase: 'trans' });
    G.ents.forEach(e => { e.score = 0; });
    changed();
    busy = true; await overlay('round', { title: R().name || 'Раунд 1', sub: 'Поехали!' }); busy = false;
    G.chooser = pick(G.ents).id; G.phase = 'board'; boardIntro = true; curSig = null; changed();
    toast(`Первым выбирает: ${entName(G.chooser)} ⭐`);
  }
  function toLobby() { if (!['board', 'end'].includes(G.phase)) return; G.resume = G.phase === 'end' ? null : G.phase; if (G.phase === 'end') G.started = false; G.phase = 'lobby'; curSig = null; changed(); }
  async function nextRound() {
    if (G.round + 1 >= PACK.rounds.length) return startFinal();
    G.round++; G.q = null; G.phase = 'trans'; changed();
    busy = true; await overlay('round', { title: R().name || `Раунд ${G.round + 1}`, sub: 'Цены выросли!' }); busy = false;
    G.phase = 'board'; boardIntro = true; curSig = null; changed();
  }
  function skipRound() { if (G.phase !== 'board') return; snap(); R().themes.forEach((th, t) => (th.questions || []).forEach((x, i) => { G.played[`${G.round}-${t}-${i}`] = true; })); nextRound(); }

  async function openCell(t, i, cellEl) {
    if (G.phase !== 'board' || busy) return;
    const key = `${G.round}-${t}-${i}`, d = qd(G.round, t, i);
    if (G.played[key] || !d) return;
    snap(); busy = true; Sound.play('select');
    G.played[key] = true;
    const type = ['cat', 'auction', 'trap'].includes(d.type) ? d.type : 'normal';
    G.q = { key, r: G.round, t, i, price: +d.price || 0, type, stage: 'intro', tried: [], bribed: [], blog: [], ans: null, owner: null, stake: null, tl: G.set.timer, tr: false, victim: null, auc: null, trap: null, result: null };
    G.phase = 'q'; curSig = null; save(); publish();
    await flipCell(cellEl);
    render();
    try {
      if (type === 'cat') { await overlay('cat'); G.q.stage = 'cat'; }
      else if (type === 'auction') { await overlay('auction'); G.q.stage = 'auction'; G.q.auc = { bids: {}, passed: {}, allin: {} }; }
      else if (type === 'trap') { await overlay('trap'); G.q.stage = 'trap'; G.q.victim = G.chooser && ent(G.chooser) ? G.chooser : null; }
      else G.q.stage = 'read';
    } finally { busy = false; }
    changed();
    if (G.q && G.q.stage === 'read') autoOpen();
  }
  function autoOpen() { const k = G.q && G.q.key; setTimeout(() => { if (G.phase === 'q' && G.q && G.q.key === k && G.q.stage === 'read') openBuzz(); }, 1400); }
  function openBuzz() {
    const q = G.q; if (!q || q.stage !== 'read') return;
    q.stage = 'open'; q.tl = q.tl > 0 ? q.tl : G.set.timer; Sound.play('open'); changed(); startTimer();
  }
  function onBuzz(eid, k) {
    const q = G.q;
    if (G.phase !== 'q' || !q || q.key !== k || q.stage !== 'open' || q.owner) return;
    if (q.tried.includes(eid) || G.fz[eid]) return;
    setAnswering(eid);
  }
  function manualAnswer(eid) {
    const q = G.q;
    if (G.phase !== 'q' || !q || q.owner || !['read', 'open', 'ans'].includes(q.stage) || q.ans === eid || !ent(eid)) return;
    setAnswering(eid);
  }
  function setAnswering(eid) {
    const q = G.q; snap(); stopTimer();
    q.ans = eid; q.stage = 'ans'; Sound.play('buzz'); changed();
    const c = $(`#scores .ent[data-id="${CSS.escape(eid)}"]`); if (c) { const r = c.getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top, ent(eid).color, 40); }
  }
  function judge(ok) {
    const q = G.q; if (G.phase !== 'q' || !q || busy) return;
    const who = q.owner || (q.stage === 'ans' ? q.ans : null);
    if (!who || !ent(who) || !['read', 'open', 'ans', 'timeup'].includes(q.stage)) return;
    snap(); stopTimer();
    let val = q.stake || q.price, dbl = false;
    if (G.x2[who]) { val *= 2; dbl = true; delete G.x2[who]; }
    if (ok) {
      addScore(who, val); G.chooser = who; q.result = { who, ok: true, val, dbl };
      Sound.play('correct'); flash('ok'); FX.confetti(150); reveal(true);
    } else {
      addScore(who, -val); Sound.play('wrong'); flash('bad'); shake();
      if (q.owner) { q.result = { who, ok: false, val, dbl }; reveal(true); }
      else {
        q.tried.push(who); q.ans = null;
        if (!G.ents.some(e => !q.tried.includes(e.id) && !G.fz[e.id])) reveal(true);
        else { q.stage = 'open'; changed(); setTimeout(() => { if (G.q === q && q.stage === 'open' && !q.tr) startTimer(); }, 700); }
      }
    }
  }
  function reveal(silent) {
    const q = G.q; if (G.phase !== 'q' || !q || !['read', 'open', 'ans', 'timeup'].includes(q.stage)) return;
    stopTimer(); q.stage = 'reveal'; if (silent !== true) Sound.play('flip'); changed();
  }
  function backToBoard() {
    if (G.phase !== 'q' || !G.q || busy) return;
    snap(); stopTimer(); stopConvince();
    Object.keys(G.fz).forEach(id => { G.fz[id]--; if (G.fz[id] <= 0) delete G.fz[id]; });
    G.q = null; G.phase = 'board'; curSig = null;
    if (roundDone()) { save(); nextRound(); } else changed();
  }

  /* ----- кот в мешке ----- */
  function catGive(eid) {
    const q = G.q; if (!q || q.stage !== 'cat' || !ent(eid)) return;
    snap(); q.owner = eid; q.stage = 'read'; Sound.play('whoosh'); changed(); autoOpen();
  }

  /* ----- аукцион ----- */
  function aucMax() { const b = G.q.auc.bids; let max = 0, lead = null; for (const id in b) if (b[id] > max) { max = b[id]; lead = id; } return { max, lead }; }
  function placeBid(eid, v, host, k) {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'auction' || !ent(eid) || (!host && k !== q.key)) return;
    const a = q.auc, e = ent(eid);
    if (v === 'pass') { a.passed[eid] = true; changed(); return; }
    const { max } = aucMax(), cap = Math.max(e.score, q.price);
    const bid = v === 'all' ? cap : host ? Math.max(q.price, max + (+v || 100)) : Math.floor(+v);
    if (!(bid >= q.price) || bid <= max || bid > cap) { if (host) toast(`${e.name}: можно поставить не больше ${fmt(cap)}`); return; }
    a.bids[eid] = bid; delete a.passed[eid];
    if (v === 'all') a.allin[eid] = true; else delete a.allin[eid];
    a.last = eid + ':' + bid; Sound.play('bid'); changed();
  }
  function renderBids() {
    const box = $('#bids'); if (!box) return;
    const q = G.q, a = q.auc, { lead } = aucMax();
    const html = G.ents.map(e => {
      const b = a.bids[e.id], ps = a.passed[e.id], isNew = a.last && a.last === e.id + ':' + b && lastBidShown !== a.last;
      return `<div class="bid ${e.id === lead ? 'lead' : ''} ${ps ? 'pass' : ''} ${isNew ? 'new' : ''}" style="--c:${e.color}"><span class="bn">${esc(e.name)}</span><span class="bs">счёт ${fmt(e.score)}</span>`
        + `<span class="bv">${b ? fmt(b) + (a.allin[e.id] ? '<small>ва-банк</small>' : '') : ps ? 'пас' : '—'}</span>`
        + `<span class="bb"><button data-act="bid" data-id="${esc(e.id)}" data-v="100">+100</button><button data-act="bid" data-id="${esc(e.id)}" data-v="500">+500</button><button data-act="bid" data-id="${esc(e.id)}" data-v="all">ва-банк</button></span></div>`;
    }).join('');
    if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; lastBidShown = a.last; }
  }
  function aucClose() {
    const q = G.q; if (!q || q.stage !== 'auction') return;
    const { max, lead } = aucMax();
    if (!lead && !(G.chooser && ent(G.chooser))) return toast('Ставок нет — выбери игрока (кнопки +100 у нужного игрока)');
    snap();
    if (lead) { q.owner = lead; q.stake = max; } else { q.owner = G.chooser; q.stake = q.price; }
    Sound.play('auction'); FX.confetti(70); q.stage = 'read'; changed(); autoOpen();
  }

  /* ----- подкуп судьи ----- */
  function canBribe(eid) {
    const q = G.q; if (G.phase !== 'q' || !q || q.bribed.includes(eid)) return false;
    if (q.owner) return q.owner === eid && ['read', 'open', 'timeup'].includes(q.stage);
    return ['read', 'open', 'ans'].includes(q.stage) && !q.tried.includes(eid);
  }
  async function onBribe(eid, k) {
    const q = G.q; if (!q || q.key !== k || !canBribe(eid)) return;
    snap();
    const cost = bribeCost(q), hint = curD().hint || '';
    q.bribed.push(eid); q.blog.push({ e: eid, h: !!hint }); addScore(eid, -cost);
    sendPrivate(eid, { k: q.key, hint, cost });
    const wasRun = q.tr; if (wasRun) stopTimer();
    changed();
    await overlay('bribe', { name: entName(eid), cost, hint: !!hint });
    if (wasRun && G.q === q && q.stage === 'open' && !q.tr) startTimer();
  }

  /* ----- ловушка ----- */
  const taxMax = p => Math.min(1000, Math.max(100, p * 2));
  const EVENTS = [
    { id: 'tax', w: 3, icon: '💸', name: 'Налоговая проверка', desc: p => `Налоговая нашла лишние очки! Спишем от 50 до ${taxMax(p)}.` },
    { id: 'convince', w: 2, icon: '🗣️', name: 'Уговори судью', desc: p => `30 секунд, чтобы убедить судью подкинуть очков. Судья решает: от 0 до ${fmt(p * 2)}.` },
    { id: 'td', w: 3, icon: '🎭', name: 'Правда или действие', desc: p => `Выполнил — ${sgn(r10(p / 2))}, отказался — ${sgn(-p)}.` },
    { id: 'freeze', w: 2, icon: '❄️', name: 'Заморозка', desc: () => 'Кнопка не работает в этом и следующем вопросе.' },
    { id: 'casino', w: 2, icon: '🎰', name: 'Казино', desc: () => 'Ставка на монетку: орёл — удваиваешь, решка — теряешь. Можно отказаться.' },
    { id: 'gift', w: 2, icon: '🎁', name: 'Щедрость', desc: p => `Подари ${fmt(p)} очков любому игроку.` },
    { id: 'x2', w: 2, icon: '✖️', name: 'Двойная ставка', desc: () => 'Следующий твой ответ считается ×2 — и плюс, и минус.' },
    { id: 'swap', w: 1, icon: '🔄', name: 'Рокировка', desc: () => 'Меняешься очками со случайным игроком!' },
    { id: 'thief', w: 1, icon: '🦹', name: 'Карманник', desc: p => `Повезло! Крадёшь ${fmt(p)} очков у лидера.` },
  ];
  const EV = Object.fromEntries(EVENTS.map(e => [e.id, e]));
  function pickW(list) { const tot = list.reduce((s, e) => s + e.w, 0); let r = Math.random() * tot; for (const e of list) { r -= e.w; if (r <= 0) return e; } return list[0]; }
  const FORCE = {}; // для проверки: заранее задать монетку и событие
  function pickEvent() {
    if (FORCE.ev && EV[FORCE.ev]) return EV[FORCE.ev];
    const multi = G.ents.length > 1, hasTD = (PACK.truth || []).length + (PACK.dare || []).length > 0;
    return pickW(EVENTS.filter(e => (multi || !['gift', 'swap', 'thief'].includes(e.id)) && (hasTD || e.id !== 'td')));
  }
  const coinHTML = () => '<div class="coinstage"><div class="toss"><div class="coin"><div class="face fr"><span>🦅</span><b>ОРЁЛ</b></div><div class="face bk"><span>🍀</span><b>РЕШКА</b></div></div></div></div>';
  function vTrap(q) {
    const v = q.victim && ent(q.victim);
    if (!v) return el(`<div class="special"><div class="sp-title warn">⚠ Ловушка!</div><div class="sp-hint">Кто выбрал этот вопрос?</div>${pickerHTML(G.ents, 'victim')}</div>`);
    return el(`<div class="special"><div class="sp-title warn">⚠ Ловушка!</div><div class="sp-info">Под угрозой: <b style="color:${v.color}">${esc(v.name)}</b></div>
      <div class="sp-hint">Орёл — ловушка срабатывает. Решка — пронесло.</div>${coinHTML()}
      <div class="hostbar"><button class="btn gold" data-act="flip">🪙 Бросить монетку<kbd>Пробел</kbd></button></div></div>`);
  }
  async function coinAnim(scope, heads) {
    const toss = $('.toss', scope), coin = $('.coin', scope); if (!toss || !coin) return;
    const end = 7 * 360 + (heads ? 0 : 180);
    Sound.play('coin'); Sound.play('whoosh');
    toss.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-15rem) scale(1.3)', offset: 0.45 }, { transform: 'translateY(0) scale(1)' }], { duration: 2100, easing: 'cubic-bezier(.3,0,.3,1)' });
    const a = coin.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${end}deg)` }], { duration: 2100, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
    await a.finished; Sound.play('land'); await sleep(450);
  }
  async function trapFlip() {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'trap' || !q.victim || busy) return;
    busy = true; snap();
    const hit = FORCE.coin != null ? FORCE.coin : Math.random() < 0.5; q.trap = { hit, step: 0 };
    const btn = $('[data-act=flip]'); if (btn) btn.disabled = true;
    await coinAnim($('#stage'), hit);
    if (!hit) {
      Sound.play('correct'); await overlay('safe');
      q.stage = 'read'; busy = false; changed(); autoOpen(); return;
    }
    Sound.play('trap'); flash('bad'); await sleep(500);
    const ev = pickEvent(); q.trap.ev = ev.id; prepEvent(ev, q); publish();
    await roulette(ev);
    busy = false; q.stage = 'trapev'; changed();
  }
  function prepEvent(ev, q) {
    const T = q.trap, others = G.ents.filter(e => e.id !== q.victim);
    if (ev.id === 'tax') T.amt = 50 * (1 + Math.floor(Math.random() * (taxMax(q.price) / 50)));
    if (ev.id === 'swap') T.target = others.length ? pick(others).id : null;
    if (ev.id === 'thief') T.target = others.length ? others.reduce((a, b) => (b.score > a.score ? b : a)).id : null;
  }
  async function roulette(ev) {
    const cs = $('#stage .coinstage'), hb = $('#stage .hostbar'); if (hb) hb.style.visibility = 'hidden';
    const box = el('<div class="roul"><div class="rframe"></div><div class="rstrip"></div></div>');
    if (cs) cs.replaceWith(box); else $('#stage').appendChild(box);
    const strip = $('.rstrip', box), N = 36, target = 30, cards = [];
    for (let i = 0; i < N; i++) cards.push(i === target ? ev : pickW(EVENTS));
    strip.innerHTML = cards.map(e => `<div class="rc"><span>${e.icon}</span><b>${esc(e.name)}</b></div>`).join('');
    await sleep(30);
    const cw = strip.children[0].getBoundingClientRect().width, gap = parseFloat(getComputedStyle(strip).columnGap) || 0, step = cw + gap;
    const center = box.clientWidth / 2 - cw / 2, endX = center - target * step + (Math.random() - 0.5) * cw * 0.5;
    const anim = strip.animate([{ transform: `translateX(${center}px)` }, { transform: `translateX(${endX}px)` }], { duration: 4300, easing: 'cubic-bezier(.08,.6,.1,1)', fill: 'forwards' });
    let last = -1;
    const tk = () => {
      if (anim.playState !== 'running') return;
      const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform), idx = Math.round((center - m.m41) / step);
      if (idx !== last) { last = idx; Sound.play('roul'); }
      requestAnimationFrame(tk);
    };
    requestAnimationFrame(tk);
    await anim.finished;
    strip.children[target].classList.add('win'); Sound.play('trap'); await sleep(1300);
  }
  function vTrapEv(q) {
    const ev = EV[q.trap.ev], v = ent(q.victim);
    return el(`<div class="special"><div class="evcard"><div class="evicon">${ev.icon}</div><div class="evname">${esc(ev.name)}</div><div class="evdesc">${esc(ev.desc(q.price))}</div></div>
      <div class="evvic">Жертва: <b style="color:${v ? v.color : '#fff'}">${esc(v ? v.name : '—')}</b></div><div class="evpanel" id="evpanel">${evPanel(ev, q)}</div></div>`);
  }
  function evPanel(ev, q) {
    const T = q.trap, p = q.price, v = q.victim;
    const btn = (val, label, cls, x, id) => `<button class="btn ${cls || ''}" data-act="ev" data-v="${val}"${x != null ? ` data-x="${x}"` : ''}${id ? ` data-id="${esc(id)}"` : ''}>${label}</button>`;
    if (T.done) return `<div class="evres">${T.res}</div><div class="hostbar"><button class="btn gold" data-act="trapdone">К вопросу ▶<kbd>→</kbd></button></div>`;
    switch (ev.id) {
      case 'tax': return `<div class="slot" id="slot">???</div><div class="hostbar">${btn('tax', '🎰 Крутить', 'gold')}</div>`;
      case 'convince': return `<div class="bigclock" id="cvclock">30</div><div class="hostbar">${btn('cvgo', '⏱ Старт 30 сек')}${[0, r10(p / 2), p, p * 2].map(x => btn('cv', x ? sgn(x) : '0 очков', x ? 'ok' : 'bad', x)).join('')}</div>`;
      case 'td':
        if (!T.card) return `<div class="hostbar">${btn('truth', '😇 Правда', 'huge')}${btn('dare', '😈 Действие', 'huge')}</div>`;
        return `<div class="tdcard ${T.kind}"><div class="tdk">${T.kind === 'truth' ? '😇 Правда' : '😈 Действие'}</div><div class="tdt">${esc(T.card)}</div></div>`
          + `<div class="hostbar">${btn('tdok', `✓ Выполнил ${sgn(r10(p / 2))}`, 'ok')}${btn('tdno', `✗ Отказался ${sgn(-p)}`, 'bad')}</div>`;
      case 'freeze': return `<div class="hostbar">${btn('freeze', '❄️ Заморозить', 'gold')}</div>`;
      case 'casino': {
        const cap = Math.max((ent(v) || {}).score || 0, p);
        if (T.bet == null) return `<div class="hostbar">${[p, p * 2].filter(x => x < cap).map(x => btn('bet', 'Ставка ' + fmt(x), '', x)).join('')}${btn('bet', 'Ва-банк ' + fmt(cap), 'gold', cap)}${btn('nobet', 'Отказаться', 'bad')}</div>`;
        return `${coinHTML()}<div class="hostbar">${btn('casflip', `🪙 Бросить · ставка ${fmt(T.bet)}`, 'gold')}</div>`;
      }
      case 'gift': return `<div class="sp-hint">Кому дарим?</div><div class="picker">${G.ents.filter(e => e.id !== v).map(e => `<button class="pk" style="--c:${e.color}" data-act="ev" data-v="gift" data-id="${esc(e.id)}">${esc(e.name)}</button>`).join('')}</div>`;
      case 'x2': return `<div class="hostbar">${btn('x2', '✖️2 Включить', 'gold')}</div>`;
      case 'swap': return `<div class="slot" id="slot">???</div><div class="hostbar">${btn('swap', '🎲 С кем меняемся?', 'gold')}</div>`;
      case 'thief': return `<div class="hostbar">${btn('thief', `🦹 Украсть у: ${esc(entName(T.target))}`, 'gold')}</div>`;
    }
    return '';
  }
  async function spinSlot(node, gen, final) {
    if (!node) return;
    const t0 = performance.now(); let delay = 45;
    while (performance.now() - t0 < 1900) { node.textContent = gen(); Sound.play('roul'); await sleep(delay); delay *= 1.12; }
    node.textContent = final; node.classList.add('hit'); Sound.play('land'); await sleep(800);
  }
  async function evAct(v, ds) {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'trapev' || busy) return;
    const T = q.trap, p = q.price, vic = q.victim, ve = ent(vic); if (!ve) return;
    const done = res => { T.done = true; T.res = res; T.step++; changed(); };
    const lock = b => { busy = b; $$('#evpanel button').forEach(x => { x.disabled = b; }); };
    switch (v) {
      case 'tax':
        lock(true); await spinSlot($('#slot'), () => fmt(50 * (1 + Math.floor(Math.random() * (taxMax(p) / 50)))), '−' + fmt(T.amt)); lock(false);
        snap(); addScore(vic, -T.amt); Sound.play('wrong'); FX.rain('💸', 30); done(`${esc(ve.name)}: −${fmt(T.amt)} 💸`); break;
      case 'cvgo': startConvince(); break;
      case 'cv': {
        stopConvince(); const x = +ds.x; snap();
        if (x) { addScore(vic, x); Sound.play('correct'); FX.confetti(70); } else Sound.play('wrong');
        done(x ? `Судья растаял: ${sgn(x)} 🥹` : 'Судья непреклонен: 0 😐'); break;
      }
      case 'truth': case 'dare': {
        const list = (v === 'truth' ? PACK.truth : PACK.dare) || [];
        T.kind = v; T.card = list.length ? pick(list) : (v === 'truth' ? 'Расскажи о себе то, чего никто не знает.' : 'Станцуй 10 секунд!');
        T.step++; Sound.play('flip'); changed(); break;
      }
      case 'tdok': { snap(); const x = r10(p / 2); addScore(vic, x); Sound.play('correct'); FX.confetti(80); done(`Красавчик! ${sgn(x)}`); break; }
      case 'tdno': snap(); addScore(vic, -p); Sound.play('wrong'); done(`Отказ: ${sgn(-p)}`); break;
      case 'freeze': snap(); G.fz[vic] = 2; Sound.play('freeze'); FX.rain('❄️', 45); done(`❄️ ${esc(ve.name)} заморожен на 2 вопроса`); break;
      case 'bet': T.bet = +ds.x; T.step++; changed(); break;
      case 'nobet': done('Отказ от казино. Осторожно!'); break;
      case 'casflip': {
        lock(true); const win = Math.random() < 0.5; await coinAnim($('#evpanel'), win); lock(false); snap();
        if (win) { addScore(vic, T.bet); Sound.play('correct'); FX.rain('🪙', 50); } else { addScore(vic, -T.bet); Sound.play('wrong'); }
        done(win ? `Орёл! ${sgn(T.bet)} 🤑` : `Решка… ${sgn(-T.bet)} 😭`); break;
      }
      case 'gift': {
        const to = ds.id; if (!ent(to)) return;
        snap(); addScore(vic, -p); addScore(to, p); Sound.play('bribe'); done(`${esc(ve.name)} дарит ${fmt(p)} → ${esc(entName(to))} 🎁`); break;
      }
      case 'x2': snap(); G.x2[vic] = true; Sound.play('select'); done('Следующий ответ — ×2!'); break;
      case 'swap': {
        const te = ent(T.target); if (!te) return done('Меняться не с кем');
        lock(true); await spinSlot($('#slot'), () => pick(G.ents.filter(e => e.id !== vic)).name, te.name); lock(false);
        snap(); const a = ve.score; ve.score = te.score; te.score = a; Sound.play('swap');
        done(`${esc(ve.name)} ⇄ ${esc(te.name)}`); break;
      }
      case 'thief': {
        const te = ent(T.target); if (!te) return done('Красть не у кого');
        snap(); addScore(T.target, -p); addScore(vic, p); Sound.play('bribe'); FX.rain('💰', 25); done(`${esc(ve.name)} крадёт ${fmt(p)} у ${esc(te.name)} 🦹`); break;
      }
    }
  }
  function startConvince() {
    stopConvince(); let left = 30; const c = $('#cvclock'); Sound.play('open');
    cvInt = setInterval(() => {
      left--; if (c) c.textContent = left;
      if (left > 0) Sound.play(left <= 5 ? 'tickFast' : 'tick'); else { stopConvince(); Sound.play('timeout'); }
    }, 1000);
  }
  function stopConvince() { clearInterval(cvInt); cvInt = null; }
  function setVictim(id) { const q = G.q; if (!q || q.stage !== 'trap' || !ent(id)) return; snap(); q.victim = id; changed(); }
  function trapDone() { const q = G.q; if (!q || q.stage !== 'trapev' || !q.trap.done || busy) return; stopConvince(); q.stage = 'read'; changed(); autoOpen(); }

  /* ----- финал ----- */
  async function startFinal() {
    stopTimer(); G.q = null;
    const F = PACK.final;
    if (!F || !F.q) return endGame();
    const part = G.ents.filter(e => e.score > 0).map(e => e.id);
    if (!part.length) { toast('В финал никто не прошёл — ни у кого нет очков в плюсе'); return endGame(); }
    G.phase = 'trans'; changed();
    busy = true; await overlay('final'); busy = false;
    G.fin = { stage: 'theme', part, bets: {}, answers: {}, judged: {}, opened: {}, order: null, tl: G.set.ftimer, tr: false, showA: false };
    G.phase = 'final'; curSig = null; changed();
  }
  function finNext() {
    const f = G.fin; if (G.phase !== 'final' || !f || busy) return;
    if (f.stage === 'theme') { f.stage = 'bet'; Sound.play('whoosh'); changed(); }
    else if (f.stage === 'bet') { snap(); f.stage = 'q'; f.tl = G.set.ftimer; Sound.play('open'); changed(); startTimer(); Sound.think(true); }
    else if (f.stage === 'q') { stopTimer(); Sound.think(false); toReveal(); }
    else if (f.stage === 'reveal') { if (!f.showA) { f.showA = true; Sound.play('flip'); FX.confetti(90); changed(); } else endGame(); }
  }
  function toReveal() { const f = G.fin; f.stage = 'reveal'; f.order = f.part.slice().sort((a, b) => ((ent(a) || {}).score || 0) - ((ent(b) || {}).score || 0)); changed(); }
  function finalTimeUp() { Sound.think(false); Sound.play('timeout'); if (G.fin && G.fin.stage === 'q') toReveal(); }
  function onBet(eid, v) {
    const f = G.fin; if (G.phase !== 'final' || !f || f.stage !== 'bet' || !f.part.includes(eid)) return;
    const x = Math.floor(Number(v)); if (!(x >= 0) || x > ent(eid).score) return;
    f.bets[eid] = x; Sound.play('bid'); changed();
  }
  function onFinalAnswer(eid, v) {
    const f = G.fin; if (G.phase !== 'final' || !f || f.stage !== 'q' || !f.part.includes(eid)) return;
    f.answers[eid] = clean(v, 140); Sound.play('select'); changed();
  }
  async function finManualBet(eid) {
    const f = G.fin, e = ent(eid); if (!f || f.stage !== 'bet' || !e || !f.part.includes(eid)) return;
    const v = await ask(`Ставка: ${e.name} (от 0 до ${fmt(e.score)})`, f.bets[eid] == null ? '' : f.bets[eid]);
    if (v == null) return;
    const x = Math.floor(+v); if (x >= 0 && x <= e.score) { f.bets[eid] = x; changed(); } else toast(`Ставка — от 0 до ${fmt(e.score)}`);
  }
  function finOpen(eid) { const f = G.fin; if (!f || f.stage !== 'reveal') return; f.opened[eid] = true; lastPop = eid; Sound.play('flip'); changed(); }
  function finJudge(eid, ok) {
    const f = G.fin; if (!f || f.stage !== 'reveal' || f.judged[eid] != null || !ent(eid)) return;
    snap(); f.opened[eid] = true; f.judged[eid] = ok; const bet = f.bets[eid] || 0;
    addScore(eid, ok ? bet : -bet); Sound.play(ok ? 'correct' : 'wrong'); if (ok) FX.confetti(90); else flash('bad');
    changed();
  }
  function vFinal() {
    const f = G.fin, F = PACK.final || {};
    if (f.stage === 'theme') return el(`<div class="final"><div class="fin-title">Финал</div><div class="fin-theme">Тема: <b>${esc(F.theme)}</b></div><div class="sp-hint">В финале играют все, у кого счёт больше нуля</div><div class="fin-part" id="finpart"></div><div class="hostbar"><button class="btn gold big" data-act="finnext">Принять ставки ▶<kbd>→</kbd></button></div></div>`);
    if (f.stage === 'bet') return el(`<div class="final"><div class="fin-sub">Финал · ${esc(F.theme)}</div><div class="fin-title sm">Делайте ставки!</div><div class="sp-hint">Ставка — с телефона (тайно). Без телефона — кликни по игроку и впиши ставку.</div><div class="fin-part" id="finpart"></div><div class="hostbar"><button class="btn gold" data-act="finnext">Показать вопрос ▶<kbd>→</kbd></button></div></div>`);
    if (f.stage === 'q') return el(`<div class="final"><div class="fin-sub">Финал · ${esc(F.theme)}</div><div class="qtext" style="font-size:${qSize(F.q)}rem">${esc(F.q)}</div><div class="timer" id="timer"><i></i><b></b></div><div class="sp-hint">Пишите ответ на телефоне</div><div class="fin-part" id="finpart"></div><div class="hostbar"><button class="btn" data-act="timer">⏯ Пауза<kbd>Пробел</kbd></button><button class="btn gold" data-act="finnext">Стоп — к ответам ▶<kbd>→</kbd></button></div></div>`);
    return el(`<div class="final"><div class="fin-sub">Финал · ${esc(F.theme)}</div><div class="fin-q">${esc(F.q)}</div><div class="fin-cards" id="fincards"></div><div id="finans"></div><div class="hostbar"><button class="btn gold" data-act="finnext" id="finbtn"></button></div></div>`);
  }
  function updFinal() {
    const f = G.fin; if (!f) return;
    updTimer();
    const pt = $('#finpart');
    if (pt) {
      const html = f.part.map(id => {
        const e = ent(id); if (!e) return '';
        const has = f.stage === 'bet' ? f.bets[id] != null : f.stage === 'q' ? f.answers[id] != null : false;
        const s = f.stage === 'bet' ? (has ? '✓ ставка сделана' : '…думает') : f.stage === 'q' ? (has ? '✓ ответ есть' : '…пишет') : 'счёт ' + fmt(e.score);
        return `<div class="fp ${has ? 'ok' : ''}" style="--c:${e.color}" ${f.stage === 'bet' ? `data-act="finbet" data-id="${esc(id)}"` : ''}><b>${esc(e.name)}</b><span>${s}</span></div>`;
      }).join('');
      if (pt.dataset.h !== html) { pt.innerHTML = html; pt.dataset.h = html; }
    }
    const fc = $('#fincards');
    if (fc) {
      fc.innerHTML = (f.order || f.part).map(id => {
        const e = ent(id); if (!e) return '';
        const op = f.opened[id], j = f.judged[id], bet = f.bets[id];
        const ans = f.answers[id] != null ? f.answers[id] : '— (без телефона)';
        const btns = j != null ? `<div class="fb">${j ? 'Верно' : 'Неверно'}: ${sgn(j ? (bet || 0) : -(bet || 0))}</div>`
          : `<div class="fbtn">${op ? '' : `<button class="btn" data-act="finopen" data-id="${esc(id)}">Открыть</button>`}<button class="btn ok" data-act="finok" data-id="${esc(id)}">✓</button><button class="btn bad" data-act="finbad" data-id="${esc(id)}">✗</button></div>`;
        return `<div class="fc ${j === true ? 'ok' : j === false ? 'bad' : ''} ${lastPop === id ? 'pop' : ''}" style="--c:${e.color}"><div class="fn">${esc(e.name)}</div>`
          + `<div class="fa">${op ? esc(ans) : '🔒 ответ скрыт'}</div><div class="fb">${op ? `Ставка: ${bet == null ? 'нет' : fmt(bet)}` : 'Ставка скрыта'}</div>${btns}</div>`;
      }).join('');
      lastPop = null;
    }
    const fa = $('#finans'); if (fa) fa.innerHTML = f.showA ? `<div class="answer"><div class="al">Правильный ответ</div><div class="at">${esc((PACK.final || {}).a)}</div></div>` : '';
    const fb = $('#finbtn'); if (fb) fb.innerHTML = (f.showA ? 'Итоги игры 🏆' : 'Показать правильный ответ') + '<kbd>→</kbd>';
  }

  /* ----- итоги ----- */
  function endGame() {
    stopTimer(); Sound.think(false); G.q = null; G.phase = 'end'; curSig = null; changed();
    Sound.play('fanfare'); FX.fireworks(10000); setTimeout(() => FX.confetti(240), 1700);
  }
  function vEnd() {
    const rank = G.ents.slice().sort((a, b) => b.score - a.score), top = rank.slice(0, 3), pos = [2, 1, 3], pod = [top[1], top[0], top[2]];
    return el(`<div class="end"><div class="end-title">🏆 ${rank[0] ? esc(rank[0].name) + ' — победитель!' : 'Итоги'}</div><div class="podium">${pod.map((e, i) => e
      ? `<div class="pd p${pos[i]}" style="--c:${e.color}"><div class="pd-name">${pos[i] === 1 ? '👑 ' : ''}${esc(e.name)}</div><div class="pd-score">${fmt(e.score)}</div><div class="pd-bar">${pos[i]}</div></div>`
      : '<div class="pd empty"></div>').join('')}</div><div class="rest">${rank.slice(3).map((e, i) => `<span>${i + 4}. ${esc(e.name)} — ${fmt(e.score)}</span>`).join('')}</div>
      <div class="hostbar"><button class="btn" data-act="fireworks">🎆 Ещё салют</button><button class="btn" data-act="newgame">↻ Новая игра</button></div></div>`);
  }
  async function newGame() {
    if (!(await confirmBox('Начать новую игру? Счёт обнулится, игроки и телефоны останутся.'))) return;
    snap(); stopTimer(); Sound.think(false); stopConvince(); FX.clear(); closeOverlay(); busy = false;
    G.ents.forEach(e => { e.score = 0; });
    Object.assign(G, { started: false, resume: null, round: 0, played: {}, chooser: null, phase: 'lobby', q: null, fin: null, fz: {}, x2: {} });
    curSig = null; changed();
  }

  /* ================= лобби: игроки ================= */
  function setMode(m) {
    if (G.mode === m || !['solo', 'teams'].includes(m)) return;
    snap(); G.mode = m; G.ents = []; G.chooser = null;
    for (const pid in G.phones) G.phones[pid].ent = null;
    if (m === 'teams') { addEnt('Команда 1').hn = 1; addEnt('Команда 2').hn = 1; }
    else for (const pid in G.phones) { const ph = G.phones[pid]; if (Date.now() - ph.seen < 180000) { addEnt(ph.name, pid); ph.ent = pid; } }
    curSig = null; changed();
  }
  async function addEntUI() {
    const def = G.mode === 'teams' ? `Команда ${G.ents.length + 1}` : `Игрок ${G.ents.length + 1}`;
    const v = await ask(G.mode === 'teams' ? 'Название команды' : 'Имя игрока', def); if (v == null) return;
    snap(); addEnt(clean(v, 20) || def).hn = 1; changed();
  }
  async function renameEnt(id) {
    const e = ent(id); if (!e) return;
    const v = await ask('Новое имя', e.name); if (v == null || !clean(v, 20)) return;
    snap(); e.name = clean(v, 20); e.hn = 1; changed();
  }
  async function editScore(id) {
    const e = ent(id); if (!e) return;
    const v = await ask(`Счёт: ${e.name}`, e.score); if (v == null) return;
    const n = Number(String(v).replace('−', '-').replace(/\s/g, ''));
    if (!isFinite(n) || String(v).trim() === '') return toast('Нужно число');
    snap(); e.score = Math.round(n); changed();
  }
  function adjScore(id, d) { if (!ent(id)) return; snap(); addScore(id, d); changed(); }
  function removeEnt(id) {
    if (!ent(id)) return;
    snap(); G.ents = G.ents.filter(e => e.id !== id);
    for (const pid in G.phones) if (G.phones[pid].ent === id) { if (G.mode === 'solo') delete G.phones[pid]; else G.phones[pid].ent = null; }
    if (G.chooser === id) G.chooser = null;
    changed();
  }
  function switchBroker() { G.broker = (G.broker + 1) % Net.BROKERS.length; save(); netStart(); toast(`Сервер связи: ${Net.brokerName(G.broker)}. Гостям нужно заново отсканировать QR`); if (G.phase !== 'lobby') toLobby(); render(); }
  function newRoom() { G.room = Net.code(5); G.phones = {}; save(); netStart(); toast(`Новый код комнаты: ${G.room}. Гостям нужно заново отсканировать QR`); if (G.phase !== 'lobby') toLobby(); render(); }

  /* ================= оверлеи и эффекты ================= */
  const letters = s => Array.from(String(s)).map((ch, i) => (ch === ' ' ? ' ' : `<span style="animation-delay:${(i * 0.05).toFixed(2)}s">${esc(ch)}</span>`)).join('');
  const OV = {
    cat: () => `<div class="ov-rays"></div><div class="ov-emoji bag">🎁</div><div class="ov-emoji cat">🐱</div><div class="ov-title">Кот в мешке!</div>`,
    auction: () => `<div class="ov-rays"></div><div class="ov-emoji hammer">🔨</div><div class="ov-title">${letters('Аукцион!')}</div><div class="ov-sub">Торгуемся за вопрос</div>`,
    trap: () => `<div class="ov-emoji">🚨</div><div class="ov-title">⚠ ЛОВУШКА ⚠</div><div class="ov-sub">Монетка решит судьбу…</div>`,
    bribe: d => `<div class="ov-rays"></div><div class="ov-emoji">💰</div><div class="ov-title">${esc(d.name)}<br>подкупает судью!</div><div class="ov-sub">−${fmt(d.cost)} очков · ${d.hint ? 'подсказка ушла на телефон 🤫' : 'судья, шепни подсказку на ушко 🤫'}</div>`,
    round: d => `<div class="ov-rays"></div><div class="ov-title">${letters(d.title)}</div>${d.sub ? `<div class="ov-sub">${esc(d.sub)}</div>` : ''}`,
    final: () => `<div class="ov-title">${letters('ФИНАЛ')}</div><div class="ov-sub">Тема: ${esc((PACK.final || {}).theme || '')}</div>`,
    safe: () => `<div class="ov-emoji">🍀</div><div class="ov-title">${letters('Пронесло!')}</div><div class="ov-sub">Решка — ловушка не сработала</div>`,
  };
  const OVDUR = { cat: 3400, auction: 3000, trap: 2600, bribe: 3000, round: 2600, final: 3400, safe: 2200 };
  const OVFX = {
    cat: () => { Sound.play('whoosh'); setTimeout(() => { Sound.play('cat'); FX.burst(innerWidth / 2, innerHeight * 0.4, '#ffcc33', 70); }, 1050); },
    auction: () => { Sound.play('auction'); [0, 380, 760].forEach(d => setTimeout(() => FX.burst(innerWidth * 0.53, innerHeight * 0.38, '#ffcc33', 45), d + 260)); },
    trap: () => Sound.play('trap'),
    bribe: () => { Sound.play('bribe'); FX.rain('🪙', 45); FX.rain('💵', 18); },
    round: () => Sound.play('round'),
    final: () => { Sound.play('final'); FX.burst(innerWidth / 2, innerHeight * 0.45, '#ffcc33', 90); },
    safe: () => FX.confetti(130),
  };
  function overlay(type, d) {
    d = d || {};
    return new Promise(res => {
      closeOverlay();
      const ov = $('#overlay'); ov.className = 'show ov-' + type; ov.innerHTML = OV[type](d);
      let done = false;
      const fin = () => {
        if (done) return; done = true; if (ovResolve === fin) ovResolve = null;
        ov.classList.add('hide');
        setTimeout(() => { if (!ovResolve) { ov.className = ''; ov.innerHTML = ''; } }, 340);
        res();
      };
      ovResolve = fin; if (OVFX[type]) OVFX[type](d);
      setTimeout(fin, OVDUR[type] || 2500);
    });
  }
  function closeOverlay() { if (ovResolve) ovResolve(); }
  function flash(kind) { const f = el(`<div class="flash ${kind}"></div>`); document.body.appendChild(f); setTimeout(() => f.remove(), 650); }
  function shake() { const s = $('#stage'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }
  function toast(msg) { const t = el(`<div class="tst">${esc(msg)}</div>`); $('#toast').appendChild(t); setTimeout(() => t.remove(), 3100); }

  /* ================= меню и окна ================= */
  function closeMenus() { $$('.emenu, .tmenu').forEach(m => m.remove()); }
  function entMenu(id, card) {
    closeMenus(); const e = ent(id); if (!e) return;
    const q = G.phase === 'q' ? G.q : null, items = [];
    if (q && !q.owner && ['read', 'open', 'ans'].includes(q.stage) && q.ans !== id) items.push(['🙋 Отвечает', 'm-ans']);
    if (q && q.stage === 'cat') items.push(['🐱 Отдать кота', 'catgive']);
    if (q && q.stage === 'trap' && !q.victim) items.push(['🎯 Жертва ловушки', 'victim']);
    if (G.phase === 'final' && G.fin && G.fin.stage === 'bet' && G.fin.part.includes(id)) items.push(['💰 Ставка в финале', 'finbet']);
    items.push(['⭐ Выбирает вопрос', 'm-chooser'], ['＋100', 'm-plus'], ['－100', 'm-minus'], ['✎ Изменить счёт', 'm-score'], ['✎ Переименовать', 'ren']);
    if (['lobby', 'board', 'end'].includes(G.phase)) items.push(['🗑 Удалить', 'del']);
    const m = el(`<div class="emenu"><div class="em-h" style="--c:${e.color}">${esc(e.name)}</div>${items.map(([t, a]) => `<button data-act="${a}" data-id="${esc(id)}">${t}</button>`).join('')}</div>`);
    document.body.appendChild(m);
    const r = card.getBoundingClientRect(), mr = m.getBoundingClientRect();
    m.style.left = Math.min(innerWidth - mr.width - 8, Math.max(8, r.left + r.width / 2 - mr.width / 2)) + 'px';
    m.style.top = Math.max(8, r.top - mr.height - 12) + 'px';
  }
  function topMenu() {
    if ($('.tmenu')) return closeMenus();
    const items = [];
    if (['board', 'end'].includes(G.phase)) items.push(['⚙ Игроки и настройки', 'lobby']);
    if (G.phase === 'board') items.push(['⏭ Следующий раунд', 'skipround'], ['🏁 Сразу к финалу', 'tofinal']);
    items.push(['🔑 Пульт ведущего', 'pult'], ['↻ Новая игра', 'newgame'], ['📡 Другой сервер связи', 'broker'], ['🎲 Новый код комнаты', 'newroom']);
    document.body.appendChild(el(`<div class="tmenu">${items.map(([t, a]) => `<button data-act="${a}">${t}</button>`).join('')}</div>`));
  }
  function modal(inner) {
    const m = el(`<div class="modal"><div class="mbox">${inner}</div></div>`);
    document.body.appendChild(m); return m;
  }
  function ask(title, value) {
    return new Promise(res => {
      const m = modal(`<div class="mt">${esc(title)}</div><input class="mi" value="${esc(value == null ? '' : value)}"><div class="mb"><button class="btn" data-m="no">Отмена</button><button class="btn gold" data-m="ok">OK</button></div>`);
      const inp = $('.mi', m); setTimeout(() => { inp.focus(); inp.select(); }, 30);
      const done = v => { m.remove(); res(v); };
      m.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'ok' ? inp.value : null); else if (e.target === m) done(null); });
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); });
    });
  }
  function confirmBox(title) {
    return new Promise(res => {
      const m = modal(`<div class="mt">${esc(title)}</div><div class="mb"><button class="btn" data-m="no">Отмена</button><button class="btn gold" data-m="ok">Да</button></div>`);
      m.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { m.remove(); res(b.dataset.m === 'ok'); } else if (e.target === m) { m.remove(); res(false); } });
    });
  }
  function showPult() {
    const m = modal(`<div class="mt">🔑 Пульт ведущего</div><div class="mtxt">Отсканируй своим телефоном. На пульте — ответ на текущий вопрос, подсказки и кнопки «Верно / Неверно». <b>Не показывай гостям!</b></div><canvas id="pultqr"></canvas><div class="mb"><button class="btn gold" data-m="ok">Готово</button></div>`);
    drawQR($('#pultqr', m), pultUrl());
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-m]')) m.remove(); });
  }
  function toggleHelp() {
    const ex = $('#helpm'); if (ex) return ex.remove();
    const rows = [['Пробел', 'старт / пауза таймера, бросить монетку, пропустить анимацию'], ['Enter', 'верно'], ['Backspace', 'неверно'], ['A', 'показать ответ'], ['→', 'дальше: к табло, закрыть торги, следующий шаг финала'], ['Esc', 'закрыть меню / к табло после ответа'], ['1 … 9, 0', 'назначить отвечающего вручную (номер на карточке)'], ['Ctrl + Z', 'отменить последнее действие'], ['F', 'полный экран'], ['M', 'звук вкл/выкл'], ['H', 'эта подсказка']];
    const m = modal(`<div class="mt">⌨ Горячие клавиши</div><div class="help">${rows.map(r => `<kbd>${r[0]}</kbd><span>${r[1]}</span>`).join('')}</div><div class="mtxt">Клик по карточке игрока внизу — меню: отвечает, выбирает, ±100, изменить счёт.</div><div class="mb"><button class="btn gold" data-m="ok">Понятно</button></div>`);
    m.id = 'helpm'; m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-m]')) m.remove(); });
  }
  function toggleFS() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
  function toggleMute() { Sound.toggleMute(); renderTop(); toast(Sound.muted ? '🔇 Звук выключен' : '🔊 Звук включён'); }

  /* ================= управление ================= */
  function spaceAction() {
    if (ovResolve) return closeOverlay();
    if (busy) return;
    if (G.phase === 'q' && G.q) { if (['read', 'open'].includes(G.q.stage)) return toggleTimer(); if (G.q.stage === 'trap') return trapFlip(); }
    if (G.phase === 'final' && G.fin && G.fin.stage === 'q') return toggleTimer();
  }
  function nextAction() {
    if (ovResolve) return closeOverlay();
    if (busy) return;
    if (G.phase === 'lobby') return startGame();
    if (G.phase === 'q' && G.q) {
      const st = G.q.stage;
      if (st === 'reveal') return backToBoard();
      if (['read', 'open', 'ans', 'timeup'].includes(st)) return reveal();
      if (st === 'trapev' && G.q.trap && G.q.trap.done) return trapDone();
      if (st === 'auction') return aucClose();
    }
    if (G.phase === 'final') return finNext();
  }
  function escAction() {
    if (ovResolve) return closeOverlay();
    if ($('.emenu, .tmenu')) return closeMenus();
    if (G.phase === 'q' && G.q && G.q.stage === 'reveal') backToBoard();
  }
  function act(a, ds) {
    Sound.init();
    switch (a) {
      case 'go': return goSplash(false);
      case 'fresh': return goSplash(true);
      case 'start': return startGame();
      case 'mode': return setMode(ds.mode);
      case 'add': return addEntUI();
      case 'del': return removeEnt(ds.id);
      case 'ren': return renameEnt(ds.id);
      case 'pult': return showPult();
      case 'cell': return openCell(+ds.t, +ds.i, $(`.cell[data-t="${ds.t}"][data-i="${ds.i}"]`));
      case 'timer': return toggleTimer();
      case 'ok': return judge(true);
      case 'bad': return judge(false);
      case 'reveal': return reveal();
      case 'board': return backToBoard();
      case 'catgive': return catGive(ds.id);
      case 'bid': return placeBid(ds.id, ds.v, true);
      case 'aucclose': return aucClose();
      case 'victim': return setVictim(ds.id);
      case 'flip': return trapFlip();
      case 'ev': return evAct(ds.v, ds);
      case 'trapdone': return trapDone();
      case 'finnext': return finNext();
      case 'finbet': return finManualBet(ds.id);
      case 'finopen': return finOpen(ds.id);
      case 'finok': return finJudge(ds.id, true);
      case 'finbad': return finJudge(ds.id, false);
      case 'fireworks': Sound.play('fanfare'); return FX.fireworks(6000);
      case 'newgame': return newGame();
      case 'undo': return doUndo();
      case 'mute': return toggleMute();
      case 'fs': return toggleFS();
      case 'help': return toggleHelp();
      case 'menu': return topMenu();
      case 'm-ans': return manualAnswer(ds.id);
      case 'm-chooser': if (!ent(ds.id)) return; snap(); G.chooser = ds.id; return changed();
      case 'm-plus': return adjScore(ds.id, 100);
      case 'm-minus': return adjScore(ds.id, -100);
      case 'm-score': return editScore(ds.id);
      case 'lobby': return toLobby();
      case 'skipround': return skipRound();
      case 'tofinal': if (G.phase === 'board' && !busy) { snap(); return startFinal(); } return;
      case 'broker': return switchBroker();
      case 'newroom': return newRoom();
    }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('.modal')) return;
    const card = e.target.closest('#scores .ent'), b = e.target.closest('[data-act]');
    if (!e.target.closest('.emenu, .tmenu') && !(b && b.dataset.act === 'menu')) closeMenus();
    if (card) return entMenu(card.dataset.id, card);
    if (b && !b.disabled) { if (b.closest('.emenu, .tmenu')) closeMenus(); if (b.blur) b.blur(); act(b.dataset.act, b.dataset); }
  });
  document.addEventListener('change', e => { const s = e.target.closest('[data-set]'); if (s) { G.set[s.dataset.set] = +s.value; changed(); } });
  $('#overlay').addEventListener('click', closeOverlay);
  document.addEventListener('keydown', e => {
    if ($('.modal')) { if (e.key === 'Escape') $$('.modal').forEach(m => m.remove()); return; }
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if ($('#splash')) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); goSplash(false); } return; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); return doUndo(); }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.code) {
      case 'Space': e.preventDefault(); return spaceAction();
      case 'Enter': case 'NumpadEnter': e.preventDefault(); return judge(true);
      case 'Backspace': case 'Delete': e.preventDefault(); return judge(false);
      case 'KeyA': return reveal();
      case 'ArrowRight': case 'PageDown': e.preventDefault(); return nextAction();
      case 'Escape': return escAction();
      case 'KeyF': return toggleFS();
      case 'KeyM': return toggleMute();
      case 'KeyH': case 'Slash': return toggleHelp();
    }
    const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
    if (m) { const n = +m[2], en = G.ents[n === 0 ? 9 : n - 1]; if (en) manualAnswer(en.id); }
  });

  /* ================= заставка и запуск ================= */
  const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 700;
  function splash() {
    const resume = G.started && G.phase !== 'lobby';
    document.body.appendChild(el(`<div id="splash"><div class="sp-logo">${letters(PACK.title || 'Своя игра')}</div><div class="sp-sub">${esc(PACK.subtitle || '')}</div>
      <div class="sp-btns">${resume ? '<button class="btn gold big" data-act="go">▶ Продолжить игру</button><button class="btn big" data-act="fresh">Начать заново</button>' : '<button class="btn gold big" data-act="go">▶ Начать</button>'}</div>
      <div class="sp-tip">F — полный экран · H — горячие клавиши</div>${isPhone() ? '<a class="sp-phone" href="play.html">📱 Ты игрок? Открой экран игрока →</a>' : ''}</div>`));
  }
  async function goSplash(fresh) {
    const s = $('#splash'); if (!s || s.classList.contains('out')) return;
    if (fresh) {
      if (!(await confirmBox('Начать всё заново? Игроки и счёт удалятся, гостям нужно будет снова отсканировать QR.'))) return;
      G = newState(); undo = []; save(); netStart();
    }
    Sound.init(); Sound.play('round');
    s.classList.add('out'); setTimeout(() => s.remove(), 650);
    curSig = null; render();
  }

  if (!load()) G = newState();
  render(); netStart(); splash();
  setInterval(() => { renderScores(); if (G.phase === 'lobby') updLobby(); }, 4000);
  setInterval(() => { if (client && client.online) publishNow(); }, 10000); // сердцебиение для телефонов
  window.__svi = { get G() { return G; }, act, judge, reveal, nextAction, spaceAction, force: FORCE };
})();
