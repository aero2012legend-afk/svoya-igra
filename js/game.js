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
  let client = null, netOnline = false, everOnline = false, pubT = null, connT = null, pultSeen = 0;
  let tInt = null, tLast = 0, lastSec = null, ovResolve = null, cvInt = null, lastBidShown = null, lastPop = null;
  let aInt = null, aLast = 0, aSec = null, cInt = null, cLast = 0, cSec = null, reactT = null, tapEndT = null, heartT = null;
  let discoOn = false, MP = null; // танцпол включён; текущая музыка/видео вопроса

  function newState() {
    return {
      v: 1, room: Net.code(5), key: Net.code(10, 'abcdefghijkmnpqrstuvwxyz23456789'), broker: 0,
      mode: 'solo', ents: [], phones: {}, set: { timer: 20, atime: 15, bribe: 50, ftimer: 45 },
      started: false, resume: null, round: 0, played: {}, chooser: null, phase: 'lobby', q: null, fin: null, fz: {}, x2: {}, sh: {}, bo: {},
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
    G.set = Object.assign({ timer: 20, atime: 15, bribe: 50, ftimer: 45 }, G.set);
    G.fz = G.fz || {}; G.x2 = G.x2 || {}; G.sh = G.sh || {}; G.bo = G.bo || {};
    const q = G.q;
    if (q) {
      q.tr = false; q.ar = false; if (q.tot == null) q.tot = G.set.timer;
      if (q.stage === 'intro') q.stage = { cat: 'cat', auction: 'auction', trap: 'trap', bonus: 'bonus' }[q.type] || 'read';
      if (q.stage === 'auction' && !q.auc) q.auc = { bids: {}, passed: {}, allin: {} };
      if (q.stage === 'trap' && q.trap && q.trap.side) q.stage = 'trapspin'; // монетка уже упала
      if (q.stage === 'trapspin' && q.trap && q.trap.ev) q.stage = 'trapev'; // рулетка уже выбрала
      if (q.stage === 'bonus' && !q.con) q.con = { step: 'spin', a: G.chooser };
      if (q.con) {
        const c = q.con; c.tr = false; c.go = false; c.cd = 0;
        if (c.step === 'spin' && c.id) c.step = conAfterSpin(c);
        if (c.step === 'stake' && c.stake) c.step = 'ready';
        if (c.step === 'play' && ['tap', 'react'].includes(c.id)) c.step = 'ready';
      }
    }
    if (G.fin) { // сохранение от прошлой версии игры
      const f = G.fin; f.tr = false; f.so = f.so || f.part.slice(); f.turn = f.turn || 0;
      if (!f.left) f.left = Net.finThemes(PACK).map((x, i) => i);
      if (f.ti == null && f.stage !== 'strike') f.ti = 0;
    }
    if (G.phase === 'trans') G.phase = G.fin ? 'final' : G.q ? 'q' : 'board';
    if (G.phase === 'q' && !G.q) G.phase = 'board';
    if (G.phase === 'results' && !G.res) G.phase = 'board';
  }
  function snap() { undo.push(JSON.stringify(G)); if (undo.length > 40) undo.shift(); }
  function doUndo() {
    if (!undo.length) return toast('Отменять нечего');
    stopTimer(); stopAT(); Sound.think(false); stopConvince(); conHalt(); closeOverlay(); busy = false;
    const prev = JSON.parse(undo.pop());
    prev.phones = Object.assign({}, prev.phones, G.phones);
    prev.room = G.room; prev.key = G.key; prev.broker = G.broker;
    G = prev; fixup();
    if (!G.q || !MP || MP.key !== G.q.key) mediaStop(); else mediaPause();
    curSig = null; toast('↶ Отменено'); changed();
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
  // анкета «На что ты готов ради победы»: ведущий может поправить вручную (e.pr), иначе — ответы телефонов игрока/команды
  const PREFS = [['drink', '🥃', 'Пить'], ['dance', '💃', 'Танцевать'], ['sing', '🎤', 'Петь'], ['act', '🎭', 'Изображать']];
  function entPref(eid, k) {
    const e = ent(eid); if (!e) return false;
    if (e.pr && k in e.pr) return !!e.pr[k];
    return Object.values(G.phones).some(p => p.ent === eid && p.pr && p.pr[k]);
  }
  const prefIcons = eid => PREFS.filter(([k]) => entPref(eid, k)).map(p => p[1]).join('');
  const hasPhone = eid => isOnline(eid);
  const isMediaQ = d => !!(d && (d.audio || d.video));
  // последние три вопроса темы — бронза, серебро и золото
  const MEDALS = { 1: ['🥉', 'Бронза', 'bronze'], 2: ['🥈', 'Серебро', 'silver'], 3: ['🥇', 'Золото', 'gold'] };
  function medalOf(r, t, i) {
    const th = ((r && r.themes) || [])[t], n = th && th.questions ? th.questions.length : 0;
    if (n < 6) return 0;
    const k = i - (n - 3); return k >= 0 ? k + 1 : 0;
  }
  const qMedal = q => (q ? medalOf(PACK.rounds[q.r], q.t, q.i) : 0);

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
  function publishNow() {
    clearTimeout(pubT); if (!client) return;
    const st = pubState(); client.publish(T('s'), st, true);
    const msg = JSON.stringify({ s: st }); for (const pid in peers) dcRaw(pid, msg);
    publishHost(false);
  }
  function phoneMap() { const m = {}; for (const pid in G.phones) { const p = G.phones[pid]; if (p.ent && ent(p.ent) && p.ent !== pid) m[pid] = p.ent; } return m; }
  const r1 = x => Math.round(x * 10) / 10;
  function pubState() {
    const q = G.q, f = G.fin;
    const st = {
      v: 1, t: Date.now(), title: PACK.title, mode: G.mode, phase: G.phase, round: roundName(), chooser: G.chooser,
      ents: G.ents.map(e => {
        const o = { id: e.id, n: e.name, s: e.score, c: e.color };
        if (G.fz[e.id]) o.fz = G.fz[e.id]; if (G.x2[e.id]) o.x2 = 1; if (G.sh[e.id]) o.sh = 1; if (G.bo[e.id]) o.bo = 1;
        return o;
      }),
      pm: phoneMap(), q: q ? pubQ(q) : null, fin: f ? pubFin(f) : null,
      res: G.phase === 'results' && G.res ? { lo: G.res.losers, a: G.res.acts } : null,
    };
    if (discoOn) st.dj = 1;
    return st;
  }
  function pubQ(q) {
    const o = {
      k: q.key, th: themeOf(q), p: q.price, ty: q.type, st: q.stage, ow: q.owner, an: q.ans, tr: q.tried, bb: q.bribed, bc: bribeCost(q),
      stake: q.stake, vic: q.victim, tm: { l: r1(q.tl), r: !!q.tr, tot: q.tot || G.set.timer },
      au: q.auc ? { b: q.auc.bids, ps: q.auc.passed } : null,
    };
    if (q.stage === 'ans' && G.set.atime && q.al != null) o.at = { l: r1(q.al), r: !!q.ar, tot: G.set.atime, up: q.aup ? 1 : 0 };
    const d = curD(); if (d.audio) o.md = 'a'; else if (d.video) o.md = 'v';
    if (q.trap) {
      const T = q.trap, ev = T.ev && EVX[T.ev];
      o.side = T.side || null;
      if (ev) o.ev = { id: ev.id, i: ev.icon, n: ev.name, d: ev.desc(q.price) };
      if (T.card) o.card = T.card;
      if (T.ask) o.ask = T.ask;
      if (T.done) o.res = T.res;
      if (ev && ev.id === 'give' && !T.done) o.el = G.ents.filter(e => e.id !== q.victim).map(e => e.id);
    }
    if (q.con) o.con = pubCon(q.con);
    return o;
  }
  function pubFin(f) {
    const FT = finThemes(), o = { st: f.stage, th: f.ti != null && FT[f.ti] ? FT[f.ti].theme : '', pt: f.part, bt: Object.keys(f.bets), an: Object.keys(f.answers), tm: { l: r1(f.tl), r: !!f.tr, tot: G.set.ftimer } };
    if (f.stage === 'strike') { o.ths = FT.map(x => x.theme); o.left = f.left; o.turn = finTurn(f); }
    return o;
  }
  // всё для пульта ведущего; вопросы пульт берёт из своего questions.js, а если они отличаются — получает кусочками
  const PSIG = Net.hash(JSON.stringify(Net.stripPack(PACK)));
  let pkT = null;
  function sendPack(miss) {
    if (!client) return;
    const txt = JSON.stringify(Net.stripPack(PACK)), CH = 1000, n = Math.ceil(txt.length / CH);
    const idx = Array.isArray(miss) && miss.length ? miss.map(Number).filter(i => i >= 0 && i < n).slice(0, 80) : Array.from({ length: n }, (_, i) => i);
    clearTimeout(pkT); let j = 0;
    const step = () => { if (j >= idx.length || !client) return; const i = idx[j++]; client.publish(T('h/' + G.key + '/pk'), { s: PSIG, i, n, d: txt.slice(i * CH, (i + 1) * CH) }, false); pkT = setTimeout(step, 600); };
    step();
  }
  function playedBits() { return PACK.rounds.map((r, ri) => (r.themes || []).map((th, t) => (th.questions || []).map((x, i) => (G.played[`${ri}-${t}-${i}`] ? 1 : 0)).join('')).join('.')); }
  function publishHost(force) {
    if (!client || (!force && Date.now() - pultSeen > 180000)) return; // пульт не открыт — не тратим трафик
    const q = G.q, d = curD(), f = G.fin, FT = finThemes(), T0 = q && q.trap, c = q && q.con;
    client.publish(T('h/' + G.key + '/cur'), {
      t: Date.now(), ps: PSIG, phase: G.phase, round: G.round, pl: playedBits(),
      q: q ? {
        key: q.key, th: themeOf(q), p: q.price, ty: q.type, st: q.stage, text: d.q || '', a: d.a || '', hint: d.hint || '', md: d.audio ? 'a' : d.video ? 'v' : '',
        ans: q.ans ? entName(q.ans) : '', ow: q.owner ? entName(q.owner) : '', stake: q.stake || 0,
        bribes: (q.blog || []).map(b => ({ n: entName(b.e), h: b.h, f: b.f ? 1 : 0 })),
        ev: T0 ? (T0.side === 'a' ? '😇 Ангел' : T0.side === 'd' ? '😈 Дьявол' : '') + (T0.ev && EVX[T0.ev] ? ': ' + EVX[T0.ev].name : '') : '',
        card: (T0 && (T0.card || T0.poem)) || '', c: d.c || '', names: d.names || null, mp: q.mp ? q.mp.n : null, vic: q.victim ? entName(q.victim) : '',
        con: c ? { n: (CX[c.id] || {}).name || 'Бонус', st: c.step, a: c.a ? entName(c.a) : '', b: c.b ? entName(c.b) : '', stake: c.stake || 0, word: c.word || '' } : null,
      } : null,
      fin: f ? { st: f.stage, th: f.ti != null && FT[f.ti] ? FT[f.ti].theme : '', q: f.ti != null && FT[f.ti] ? FT[f.ti].q : '', a: f.ti != null && FT[f.ti] ? FT[f.ti].a : '', answers: Object.keys(f.answers).map(id => ({ n: entName(id), v: f.answers[id], b: f.bets[id] })) } : null,
    }, true);
  }
  function sendPrivate(eid, msg) {
    if (!client) return;
    for (const pid in G.phones) if (G.phones[pid].ent === eid) { client.publish(T('p/' + pid), msg, true); dcRaw(pid, JSON.stringify({ p: msg })); }
  }

  /* ----- прямое соединение с телефонами (WebRTC по Wi-Fi) ----- */
  const peers = {};
  const p2p = eid => Object.keys(G.phones).some(pid => G.phones[pid].ent === eid && peers[pid] && peers[pid].dc && peers[pid].dc.readyState === 'open');
  function dcRaw(pid, text) { const P = peers[pid]; if (!P || !P.dc || P.dc.readyState !== 'open') return false; try { P.dc.send(text); return true; } catch (e) { return false; } }
  function peersChanged() { if (!G) return; renderScores(); if (G.phase === 'lobby') updLobby(); }
  function closePeer(pid) {
    const P = peers[pid]; if (!P) return; delete peers[pid];
    try { if (P.dc) P.dc.close(); } catch (e) { /* уже закрыт */ }
    try { P.pc.close(); } catch (e) { /* уже закрыт */ }
    peersChanged();
  }
  async function onRtc(pid, sdp) {
    if (!Net.rtc || typeof sdp !== 'string' || sdp.length > 30000) return;
    closePeer(pid);
    let pc; try { pc = new RTCPeerConnection({ iceServers: Net.ICE }); } catch (e) { return; }
    const P = peers[pid] = { pc, dc: null };
    pc.ondatachannel = e => {
      const dc = e.channel; P.dc = dc;
      dc.onopen = () => { dcRaw(pid, JSON.stringify({ s: pubState() })); peersChanged(); };
      dc.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (err) { return; } if (d && typeof d === 'object') { d.p = pid; onNet(T('i'), d); } };
      dc.onclose = () => { if (peers[pid] === P) closePeer(pid); };
    };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState) && peers[pid] === P) closePeer(pid); };
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await Net.iceDone(pc, 2000);
      if (peers[pid] === P && client) client.publish(T('r/' + pid), { sdp: pc.localDescription.sdp }, false);
    } catch (e) { if (peers[pid] === P) closePeer(pid); }
  }
  const seenIds = new Set();
  function dup(id) { if (!id) return false; id = String(id); if (seenIds.has(id)) return true; seenIds.add(id); if (seenIds.size > 500) seenIds.delete(seenIds.values().next().value); return false; }

  function onNet(topic, d) {
    if (!d || typeof d !== 'object' || dup(d.m)) return;
    if (topic === T('c/' + G.key)) return onRemote(d);
    if (topic !== T('i')) return;
    const pid = clean(d.p, 24); if (!pid) return;
    if (d.t === 'rtc') { if (G.phones[pid]) onRtc(pid, d.sdp); return; }
    if (d.t === 'join') return onJoin(pid, d);
    const ph = G.phones[pid]; if (!ph) return;
    const wasOff = Date.now() - ph.seen > 35000; ph.seen = Date.now();
    if (wasOff) { renderScores(); if (G.phase === 'lobby') updLobby(); }
    if (d.t === 'prefs') { if (setPrefs(ph, d.v)) changed(); return; }
    const eid = ph.ent; if (!eid || !ent(eid)) return;
    switch (d.t) {
      case 'buzz': return onBuzz(eid, d.k);
      case 'bribe': return onBribe(eid, d.k);
      case 'bid': return placeBid(eid, d.v, false, d.k);
      case 'bet': return onBet(eid, d.v);
      case 'fans': return onFinalAnswer(eid, d.v);
      case 'coin': return phoneCoin(eid, d.k);
      case 'spin': return phoneSpin(eid, d.k);
      case 'pick': return phonePick(eid, d.k, d.v);
      case 'ask': return phoneAsk(eid, d.k, d.v);
      case 'rps': return conRps(eid, d.k, d.v);
      case 'vote': return conVote(pid, eid, d.k, d.v);
      case 'tap': return conTap(eid, d.k, d.n, d.g, d.fin);
      case 'react': return conReact(eid, d.k, d.ms, d.g);
      case 'strike': return finStrike(eid, d.v);
    }
  }
  function setPrefs(ph, v) {
    if (!v || typeof v !== 'object') return false;
    const pr = {}; PREFS.forEach(([k]) => { if (v[k]) pr[k] = 1; });
    if (ph.pr && JSON.stringify(pr) === JSON.stringify(ph.pr)) return false;
    ph.pr = pr; return true;
  }
  function onJoin(pid, d) {
    const name = clean(d.n, 20) || 'Игрок';
    const ph = G.phones[pid] || (G.phones[pid] = { name, ent: null, seen: 0 });
    ph.name = name; ph.seen = Date.now();
    if (d.pr) setPrefs(ph, d.pr);
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
    if (d.t === 'hello') { pultSeen = Date.now(); publishHost(true); if (d.ps !== PSIG) sendPack(); return; }
    if (d.t === 'pk') { pultSeen = Date.now(); sendPack(d.miss); return; }
    if (d.t === 'ok') judge(true); else if (d.t === 'bad') judge(false); else if (d.t === 'ans') reveal();
    else if (d.t === 'mp1' || d.t === 'mp2') mashPartial(d.t === 'mp2' ? 2 : 1);
    else if (d.t === 'space') spaceAction(); else if (d.t === 'next') nextAction(); else if (d.t === 'media') mediaToggle();
  }

  /* ================= отрисовка ================= */
  function changed() { save(); publish(); render(); }
  function render() { renderTop(); renderStage(); renderScores(); musicSync(); }
  // фоновая музыка: в лобби, на табло и в итогах; во время вопроса — тишина, чтобы слышать игроков
  let musicMode;
  function musicSync() {
    if (!Sound.music || $('#splash')) return;
    const f = G.fin, m = G.phase === 'lobby' ? 'lobby' : G.phase === 'board' ? 'board' : G.phase === 'results' ? 'results' : G.phase === 'end' ? 'end'
      : G.phase === 'final' && f && ['strike', 'theme', 'bet'].includes(f.stage) ? 'board' : null;
    if (m === musicMode) return;
    musicMode = m; try { Sound.music(m); } catch (e) { /* музыка не обязательна */ }
  }

  function renderTop() {
    let c = '';
    if (G.phase === 'board' && G.chooser && ent(G.chooser)) c = `Выбирает: <b>${esc(entName(G.chooser))}</b> ⭐`;
    else if (G.phase === 'q' && G.q) c = `<b>${esc(themeOf(G.q))}</b> · ${G.q.type === 'bonus' ? '🎁 бонус' : fmt(G.q.stake || G.q.price)}`;
    $('#top').innerHTML = `<div class="tl">${esc(roundName())}</div><div class="tc">${c}</div><div class="tr">`
      + `<span class="room">Код комнаты: <b>${esc(G.room)}</b></span><span class="net ${netOnline ? 'on' : ''}" title="${netOnline ? 'Связь с телефонами есть' : 'Нет связи с сервером'}">●</span>`
      + `<button class="ib" data-act="undo" title="Отменить (Ctrl+Z)">↶</button><button class="ib" data-act="mute" title="Звук (M)">${Sound.muted ? '🔇' : '🔊'}</button>`
      + `<button class="ib" data-act="fs" title="Полный экран (F)">⛶</button><button class="ib" data-act="help" title="Горячие клавиши (H)">?</button><button class="ib" data-act="menu" title="Меню">☰</button></div>`;
  }
  function stageSig() {
    if (G.phase === 'lobby') return 'lobby:' + G.mode;
    if (G.phase === 'board') return 'board:' + G.round;
    if (G.phase === 'q') {
      const q = G.q, c = q.con || {};
      return ['q', q.key, q.stage, q.ans, q.owner, q.victim, q.trap ? q.trap.step + (q.trap.side || '') + '/' + (q.trap.ask || '') : '', c.step, c.id, c.b, c.rnd, c.turn].join(':');
    }
    if (G.phase === 'final') return 'fin:' + G.fin.stage + ':' + (G.fin.showA ? 1 : 0);
    if (G.phase === 'results') return 'res:' + G.round;
    return G.phase;
  }
  function renderStage() {
    const st = $('#stage'), sig = stageSig();
    if (sig !== curSig) { curSig = sig; st.innerHTML = ''; const v = build(); if (v) st.appendChild(v); if (G.phase === 'q') { mediaAttach(); picAttach(); karLoop(); fitQ(); } else if (G.phase === 'board') fitThemes(); }
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
    if (G.phase === 'results' && G.res) return vResults();
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
      $('.dot', c).classList.toggle('on', isOnline(e.id)); $('.dot', c).classList.toggle('p2p', p2p(e.id));
      $('.mem', c).textContent = G.mode === 'teams' ? members(e.id).join(', ') : '';
      $('.bd', c).textContent = (G.chooser === e.id && G.phase !== 'lobby' ? '⭐' : '') + (G.fz[e.id] ? '❄️' : '') + (G.x2[e.id] ? '✖️2' : '') + (G.sh[e.id] ? '🛡️' : '') + (G.bo[e.id] ? '✨' : '');
      const old = +c.dataset.sv;
      if (old !== e.score) { c.dataset.sv = e.score; countTo($('.s', c), old, e.score); if (box.style.display !== 'none') floatNum(c, e.score - old); }
      $('.s', c).classList.toggle('neg', e.score < 0);
      c.classList.toggle('chooser', G.chooser === e.id && G.phase !== 'lobby');
      c.classList.toggle('answering', !!q && (((q.ans === e.id || q.owner === e.id) && q.stage !== 'reveal')
        || (!!q.con && ['pick', 'ready', 'play', 'vote'].includes(q.con.step) && (q.con.a === e.id || q.con.b === e.id))
        || (/^trap/.test(q.stage) && q.victim === e.id)));
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
        <label>Время на ответ ${opt('atime', [10, 15, 20, 30, 0], v => (v ? v + ' сек' : 'без ограничения'))}</label>
        <label>Подкуп судьи стоит ${opt('bribe', [25, 50, 75, 100], v => v + '% цены вопроса')}</label>
        <label>Время в финале ${opt('ftimer', [30, 45, 60, 90], v => v + ' сек')}</label>
      </div>
      <div class="mrow"><button class="btn" data-act="mdir">📁 Папка с музыкой и видео</button><span id="mstat"></span></div>
      <div class="lb-actions"><button class="btn" data-act="pult">🔑 Пульт ведущего</button><button class="btn gold big" data-act="start">${G.started ? '▶ Продолжить игру' : '▶ Начать игру'}</button></div>
    </div></div>`);
  }
  function updLobby() {
    $$('.seg [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === G.mode));
    const box = $('#lbents');
    if (box) {
      const html = G.ents.length ? G.ents.map(e => `<div class="le" style="--c:${e.color}"><b>${esc(e.name)}</b><small>${G.mode === 'teams'
        ? esc(members(e.id).join(', ') || 'ждём игроков')
        : (isOnline(e.id) ? (p2p(e.id) ? 'на связи · напрямую по Wi-Fi 📶' : 'на связи · через интернет') : G.phones[e.id] ? 'телефон не на связи' : 'без телефона')}</small>`
        + `<small class="pf">${prefIcons(e.id) ? 'Готов: ' + prefIcons(e.id) : G.mode === 'solo' && G.phones[e.id] && !G.phones[e.id].pr ? 'проходит тест…' : 'Готов: только к вопросам'}</small><span class="dot ${isOnline(e.id) ? 'on' : ''} ${p2p(e.id) ? 'p2p' : ''}"></span>`
        + `<button class="x r" data-act="ren" data-id="${esc(e.id)}" title="Переименовать">✎</button><button class="x d" data-act="del" data-id="${esc(e.id)}" title="Удалить">✕</button></div>`).join('')
        : `<div class="empty">${G.mode === 'teams' ? 'Добавь команды — гости выберут свою на телефоне' : 'Гости сканируют QR-код и сразу появляются здесь'}</div>`;
      if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; }
    }
    const ns = $('#netstat');
    if (ns) ns.innerHTML = netOnline ? `<span class="on">●</span> Связь есть · сервер ${esc(Net.brokerName(G.broker))}` : `● Подключаемся к серверу ${esc(Net.brokerName(G.broker))}…`;
    $$('[data-set]').forEach(s => { if (document.activeElement !== s) s.value = String(G.set[s.dataset.set]); });
    const ms = $('#mstat'); if (ms) { const h = mediaStatus(); if (ms.dataset.h !== h) { ms.innerHTML = h; ms.dataset.h = h; } }
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
    const maxQ = Math.max(1, ...r.themes.map(th => (th.questions || []).length)), big = maxQ > 6 || r.themes.length > 6;
    const b = el(`<div class="boardwrap"><div class="board ${big ? 'big' : ''}" style="grid-template-columns:minmax(${big ? 13 : 15}rem,1.55fr) repeat(${maxQ},1fr);grid-template-rows:repeat(${r.themes.length},1fr)"></div></div>`);
    const g = b.firstElementChild, html = [];
    r.themes.forEach((th, t) => {
      html.push(`<div class="theme" style="animation-delay:${intro ? t * 0.06 : 0}s">${esc(th.name)}</div>`);
      for (let i = 0; i < maxQ; i++) {
        const x = (th.questions || [])[i];
        if (!x) { html.push('<div class="cell blank"></div>'); continue; }
        const delay = intro ? 0.3 + t * 0.05 + i * 0.07 : (t + i) * 0.015, md = medalOf(r, t, i); // бонус спрятан: выглядит как обычная клетка
        html.push(`<div class="cell ${md ? 'medal m' + md : ''} ${G.played[`${G.round}-${t}-${i}`] ? 'played' : ''}" data-act="cell" data-t="${t}" data-i="${i}" style="animation-delay:${delay.toFixed(2)}s">${md ? `<i>${MEDALS[md][0]}</i>` : ''}<span>${esc(x.price)}</span></div>`);
      }
    });
    g.innerHTML = html.join('');
    return b;
  }
  // названия тем на плотном табло: как можно крупнее, но так, чтобы каждое влезло в свою плашку (длинные ужимаются)
  function fitThemes() {
    if (!$('#stage .board.big')) return;
    $$('#stage .theme').forEach(t => {
      let fs = 1.55; t.style.fontSize = fs + 'rem';
      for (let k = 0; k < 16 && fs > 0.95 && (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1); k++) { fs -= 0.05; t.style.fontSize = fs.toFixed(2) + 'rem'; }
    });
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
  const badge = q => (q.type === 'cat' ? '<span class="badge cat">🐱 Кот в мешке</span>' : q.type === 'auction' ? '<span class="badge auction">🔨 Аукцион</span>'
    : q.type === 'trap' ? `<span class="badge trap ${q.trap && q.trap.side === 'a' ? 'angel' : ''}">${q.trap && q.trap.side === 'a' ? '😇 Ангел' : q.trap && q.trap.side === 'd' ? '😈 Дьявол' : '⚠ Ловушка'}</span>` : '')
    + (qMedal(q) ? `<span class="badge medal m${qMedal(q)}">${MEDALS[qMedal(q)][0]} ${MEDALS[qMedal(q)][1]}</span>` : '');

  /* ----- картинка вопроса с эффектами: размытие, кусочек, пазл, силуэт… При ответе эффект снимается ----- */
  const FXS = ['blur', 'deblur', 'pixel', 'zoom', 'crop', 'tiles', 'silhouette', 'negative', 'mirror'];
  let PIC = null; // картинка текущего вопроса живёт между перерисовками, чтобы эффекты снимались плавно
  function picDrop() { if (PIC && PIC.ro) PIC.ro.disconnect(); PIC = null; }
  // область [x, y, w, h] в процентах от картинки; приводим к безопасному виду
  function picRect(a) {
    if (!Array.isArray(a) || a.length < 4 || a.slice(0, 4).some(v => !isFinite(+v))) a = [35, 35, 30, 30];
    const c = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), w = c(+a[2], 4, 100), h = c(+a[3], 4, 100);
    return [c(+a[0], 0, 100 - w), c(+a[1], 0, 100 - h), w, h];
  }
  function picBuild(d, q) {
    const P = { key: q.key, w: 4, h: 3, ok: false, fitted: false, area: null, clip: '', mash: d.type === 'mashup' && Array.isArray(d.pics) };
    if (P.mash) {
      const nm = Array.isArray(d.names) ? d.names : [];
      P.node = el(`<div class="qpic mash"><div class="mp a"><img alt="" draggable="false"><b>${esc(nm[0] || '')}</b></div><div class="mp b"><img alt="" draggable="false"><b>${esc(nm[1] || '')}</b></div><img class="pi" alt="" draggable="false"></div>`);
      const ims = $$('.mp img', P.node); setSrc(ims[0], d.pics[0]); setSrc(ims[1], d.pics[1]);
    } else {
      P.fx = FXS.includes(d.fx) ? d.fx : '';
      if (P.fx === 'zoom' || P.fx === 'crop') P.area = picRect(d.area);
      P.node = el(`<div class="qpic ${P.fx ? 'fx fx-' + P.fx : ''}"><img class="pi" alt="" draggable="false">${d.aimg ? '<img class="pa" alt="" draggable="false">' : ''}</div>`);
      if (d.aimg) { const pa = $('.pa', P.node); setSrc(pa, d.aimg); pa.addEventListener('error', () => pa.remove()); } // нет картинки-ответа — остаётся исходная
    }
    // вылет картинки — один раз, а не при каждой перерисовке экрана
    P.node.addEventListener('animationend', e => { if (e.target === P.node) P.node.classList.add('in'); });
    const img = $('.pi', P.node);
    img.addEventListener('load', () => {
      P.w = img.naturalWidth || 4; P.h = img.naturalHeight || 3; P.ok = true;
      if (P.fx === 'crop') picCrop(P, img);
      if (P.fx === 'tiles') picTiles(P, img, Math.max(2, Math.min(8, +d.tiles || 4)));
      if (P.fx === 'pixel') picPixel(P, img, Math.max(8, Math.min(80, +d.px || 28)));
      if (P.fx === 'silhouette' && picOpaque(img)) P.node.classList.add('opaque');
      P.node.classList.add('ok'); picFit(true); picState();
    }, { once: true });
    img.addEventListener('error', () => { P.node.classList.add('err'); P.node.setAttribute('data-err', '⚠ Нет картинки: ' + d.img); });
    setSrc(img, d.img);
    return P;
  }
  function setSrc(node, path) { mediaUrl(path).then(u => { node.src = u || path; }); }
  // crop: видно только окошко, остальное чёрное
  function picCrop(P, img) {
    const [x, y, w, h] = P.area;
    P.clip = img.style.clipPath = `inset(${y}% ${100 - x - w}% ${100 - y - h}% ${x}% round 1rem)`;
  }
  function picTiles(P, img, n) {
    let seed = 0; for (const ch of P.key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
    const idx = Array.from({ length: n * n }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.every((v, i) => v === i)) idx.reverse();
    const wrap = el('<div class="tiles"></div>'), u = img.currentSrc || img.src;
    for (let i = 0; i < n * n; i++) {
      const c = i % n, r = Math.floor(i / n), s = idx[i], sc = s % n, sr = Math.floor(s / n);
      const t = el('<i></i>');
      Object.assign(t.style, { width: 100 / n + '%', height: 100 / n + '%', left: sc * 100 / n + '%', top: sr * 100 / n + '%', backgroundImage: `url("${u}")`,
        backgroundSize: `${n * 100}% ${n * 100}%`, backgroundPosition: `${n > 1 ? c / (n - 1) * 100 : 0}% ${n > 1 ? r / (n - 1) * 100 : 0}%`, transitionDelay: (i * 0.03).toFixed(2) + 's' });
      t.dataset.l = c * 100 / n; t.dataset.t = r * 100 / n; t.dataset.sl = sc * 100 / n; t.dataset.st = sr * 100 / n; wrap.appendChild(t);
    }
    P.node.appendChild(wrap);
  }
  // силуэт делается из прозрачного фона; если картинка сплошная (без прозрачности), чёрный квадрат бесполезен — тогда картинка просто сильно затемняется
  function picOpaque(img) {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 24;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return false;
      return true;
    } catch (e) { return false; } // файл открыт с диска (file://) — пиксели прочитать нельзя
  }
  function picPixel(P, img, px) {
    const cv = document.createElement('canvas'); cv.className = 'pix';
    cv.width = px; cv.height = Math.max(4, Math.round(px * P.h / P.w));
    try { cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); } catch (e) { return; }
    P.node.appendChild(cv);
  }
  function picAttach() {
    const q = G.q, slot = $('#picslot'); if (!slot || !q) return;
    const d = curD(); if (!d.img) return;
    if (!PIC || PIC.key !== q.key) { picDrop(); PIC = picBuild(d, q); }
    if (PIC.node.parentNode !== slot) { slot.appendChild(PIC.node); void PIC.node.offsetWidth; } // прежние размеры «закрепляем» — тогда смена размера при ответе пойдёт плавно
    if (PIC.ro) PIC.ro.disconnect();
    if (window.ResizeObserver) { // свободное место меняется (строки статуса, кнопки, окно) — картинка подстраивается сама
      const qs = slot.parentNode; PIC.ro = new ResizeObserver(() => picFit());
      PIC.ro.observe(qs); Array.from(qs.children).forEach(c => { if (c !== slot) PIC.ro.observe(c); });
    }
    picFit(!PIC.ok); picState();
  }
  // кадр занимает всё свободное место экрана вопроса: высоту считаем по остальным блокам; размеры — в rem, чтобы на 4K всё просто становилось чётче
  function picFit(instant) {
    const P = PIC, q = G.q; if (!P || !q || !P.node.isConnected) return;
    const n = P.node, slot = n.parentNode, qs = slot && slot.parentNode; if (!qs) return;
    const rv = q.stage === 'reveal', rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, px = (e, k) => parseFloat(getComputedStyle(e)[k]) || 0;
    let used = px(qs, 'paddingTop') + px(qs, 'paddingBottom') + px(slot, 'marginTop') + px(slot, 'marginBottom');
    for (const c of qs.children) {
      if (c === slot) continue;
      const s = getComputedStyle(c); if (s.position === 'absolute' || s.display === 'none') continue;
      used += c.offsetHeight + (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0);
    }
    const maxH = Math.max(9, Math.min(P.mash ? 31 : 36, (qs.clientHeight - used) / rem)), maxW = P.mash ? 34 : 78; // у мешапа по бокам разлетаются фото — им нужно место
    const fit = ar => { const h = Math.min(maxH, maxW / ar); return [h * ar, h]; }, rm = v => v.toFixed(2) + 'rem';
    const img = $('.pi', n); let [W, H] = fit(P.w / P.h);
    if (instant) { n.style.transition = 'none'; img.style.transition = 'none'; }
    if (P.fx === 'zoom' && P.area) {
      const [x, y, w, h] = P.area;
      if (rv) Object.assign(img.style, { width: rm(W), height: rm(H), left: '0rem', top: '0rem' });
      else { // до ответа кадр имеет форму области, а картинка внутри увеличена так, что область занимает весь кадр; при ответе кадр и картинка плавно становятся обычными
        [W, H] = fit((w * P.w) / (h * P.h));
        Object.assign(img.style, { width: rm(100 * W / w), height: rm(100 * H / h), left: rm(-x * W / w), top: rm(-y * H / h) });
      }
    }
    slot.style.height = rm(H); // место под кадр отдаём сразу, а сам кадр меняет размер плавно — остальной экран не прыгает
    n.style.width = rm(W); n.style.height = rm(H);
    if (instant) { void n.offsetWidth; n.style.transition = ''; img.style.transition = ''; }
  }
  function picState() {
    const P = PIC, q = G.q; if (!P || !q || !P.ok) return;
    const n = P.node, rv = q.stage === 'reveal';
    if (P.mash) { const m = q.mp ? q.mp.n : 0; n.classList.toggle('out-a', rv || m === 1); n.classList.toggle('out-b', rv || m === 2); n.classList.toggle('done', rv); return; }
    if (P.fx === 'deblur') { const tot = q.tot || G.set.timer, k = rv ? 0 : ['open', 'ans', 'timeup'].includes(q.stage) ? Math.max(0, Math.min(1, q.tl / tot)) : 1; n.style.setProperty('--blur', (k * 2.6).toFixed(3) + 'rem'); }
    const on = n.classList.contains('shown'), im = $('.pi', n);
    if (rv && !on) requestAnimationFrame(() => requestAnimationFrame(() => {
      if (PIC !== P || G.q !== q || q.stage !== 'reveal') return;
      n.classList.add('shown');
      if (P.fx === 'crop' && im) im.style.clipPath = ''; // инлайн-стиль сильнее класса — снимаем его, чтобы окошко плавно раскрылось
      $$('.tiles i', n).forEach(t => { t.style.left = t.dataset.l + '%'; t.style.top = t.dataset.t + '%'; });
    }));
    else if (!rv && on) { // ответ отменили (Ctrl+Z) — прячем картинку обратно
      n.classList.remove('shown');
      if (P.fx === 'crop' && im) im.style.clipPath = P.clip;
      $$('.tiles i', n).forEach(t => { t.style.left = t.dataset.sl + '%'; t.style.top = t.dataset.st + '%'; });
    }
  }

  /* ----- караоке: строчки текста синхронно с музыкой; что после остановки — прячем до ответа ----- */
  function karHTML(d) { return Array.isArray(d.kar) && d.kar.length ? '<div class="kar" id="kar"><div class="kl k0"></div><div class="kl k1"></div><div class="kl k2"></div></div>' : ''; }
  let karRaf = 0;
  function karLoop() {
    cancelAnimationFrame(karRaf);
    const box = $('#kar'), q = G.q, d = curD(); if (!box || !q || !Array.isArray(d.kar)) return;
    karRaf = requestAnimationFrame(karLoop);
    const L = d.kar.filter(x => Array.isArray(x) && x.length >= 2), m = MP && MP.key === q.key ? MP : null;
    if (!L.length) return; // строчки записаны неверно — не падаем
    const t = m && m.el ? m.el.currentTime : 0, rv = q.stage === 'reveal', cut = +d.end || 0;
    let i = -1; for (let k = 0; k < L.length; k++) if (t + 0.05 >= +L[k][0]) i = k;
    const hide = k => !rv && cut && +L[k][0] >= cut - 0.05;
    const txt = k => (k < 0 || k >= L.length ? '' : hide(k) ? '♪ ♪ ♪  ?' : String(L[k][1]));
    const lines = $$('.kl', box), cur = Math.max(0, i), sig = cur + ':' + rv;
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      lines[0].textContent = i > 0 ? txt(i - 1) : ''; lines[1].textContent = txt(cur); lines[2].textContent = txt(cur + 1);
      lines[1].classList.toggle('hid', hide(cur)); lines[2].classList.toggle('hid', cur + 1 < L.length && hide(cur + 1));
    }
    const st = i >= 0 ? +L[i][0] : 0, en = i >= 0 && i + 1 < L.length ? +L[i + 1][0] : st + 4, k = i < 0 ? 0 : Math.max(0, Math.min(1, (t - st) / Math.max(0.3, en - st)));
    lines[1].style.setProperty('--k', (k * 100).toFixed(1) + '%');
  }

  /* ----- шутки и подколы ----- */
  const JDEF = {
    correct: ['{name}, красавчик! Мама гордится.', 'Вот это мозг! {name}, ты что, гуглил?', '{name} знает! Подозрительно…', 'Верно! {name}, проверь карманы — там шпаргалка?'],
    wrong: ['{name}, мимо. Как Старый мимо спортзала.', 'Нет! {name}, но звучало уверенно.', '{name}, это был смелый ход. Глупый, но смелый.', 'Минус! {name}, не расстраивайся, у тебя есть другие таланты. Наверное.'],
    timeout: ['Тишина… Слышно, как думает Старый.', 'Никто не знает? Значит, вопрос был отличный.', 'Мозги загружаются… 3%…'],
    bribe: ['Коррупция на марше!', 'Судья делает вид, что не видел.'],
    medal: ['Дорогой вопрос — дорогие нервы.', 'Сейчас станет жарко.', 'Это вопрос для настоящих олдов.'],
    leader: ['{name} рвёт всех. Подозрительно — телефон на шпаргалки проверили?', '{name} лидирует. Остальные — на позитиве.'],
    loser: ['{name}, главное — не победа, а участие. Так говорят те, кто проиграл.', '{name}, дно ещё не пробито — копай аккуратнее.'],
    winner: ['{name} — легенда вечера!', 'Поздравляем, {name}! Теперь с тебя тост.'],
  };
  function joke(kind, name) {
    const J = PACK.jokes || {}, list = (Array.isArray(J[kind]) && J[kind].length ? J[kind] : JDEF[kind]) || [];
    if (!list.length) return '';
    G.uj = G.uj || {}; const used = G.uj[kind] || [];
    let free = list.map((x, i) => i).filter(i => !used.includes(i)); if (!free.length) free = list.map((x, i) => i).filter(i => i !== used[used.length - 1]);
    const i = pick(free.length ? free : [0]); G.uj[kind] = used.concat(i).slice(-Math.max(1, list.length - 1));
    return String(list[i]).replace(/\{name\}/g, name || '');
  }
  let quipT = null;
  function quip(text, kind) {
    if (!text) return;
    let box = $('#quip'); if (!box) { box = el('<div id="quip"></div>'); document.body.appendChild(box); }
    box.innerHTML = ''; box.appendChild(el(`<div class="qp ${kind || ''}">${esc(text)}</div>`));
    clearTimeout(quipT); quipT = setTimeout(() => { const q = $('.qp', box); if (q) q.classList.add('out'); }, 5200);
  }
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
        <div class="sp-hint">Ставки — с телефонов (можно вписать любую сумму) или кнопками здесь. Ва-банк — все свои очки.</div><div class="bids" id="bids"></div>
        <div class="hostbar"><button class="btn gold" data-act="aucclose">Закрыть торги ▶<kbd>→</kbd></button></div></div>`);
    }
    if (q.stage === 'trap') return vTrap(q);
    if (q.stage === 'trapspin') return vTrapSpin(q);
    if (q.stage === 'trapev') return vTrapEv(q);
    if (q.stage === 'bonus') return vCon(q);
    const md = d.audio ? 'audio' : d.video ? 'video' : '';
    const media = (md === 'video' ? '<div class="vslot" id="vslot"></div>' : '') + (d.img ? '<div class="picslot" id="picslot"></div>' : '')
      + (md === 'audio' ? `<div class="viz ${d.img ? 'mini' : ''}"><canvas id="viz" width="960" height="${d.img ? 90 : 220}"></canvas><div class="vizlbl" id="vizlbl"></div></div>` : '') + karHTML(d);
    const own = q.owner && ent(q.owner) ? `<div class="qowner" style="--c:${ent(q.owner).color}">Отвечает только <b>${esc(entName(q.owner))}</b>${q.type === 'auction' ? ` · ставка ${fmt(q.stake)}` : ''}${G.x2[q.owner] ? ' · ×2' : ''}</div>` : '';
    const ring = G.set.atime ? '<div class="bz-t" id="anst"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" cx="50" cy="50" r="44"/></svg><b></b></div>' : '';
    const banner = q.stage === 'ans' && q.ans && ent(q.ans) ? `<div class="buzzer" id="buzzer" style="--c:${ent(q.ans).color}"><div class="bz-l">Отвечает</div><div class="bz-n">${esc(entName(q.ans))}</div>${G.x2[q.ans] ? '<div class="bz-x">×2</div>' : ''}${ring}</div>` : '';
    const answer = q.stage === 'reveal' ? `<div class="answer"><div class="al">Правильный ответ</div><div class="at">${esc(d.a)}</div>${d.c ? `<div class="acom">${esc(d.c)}</div>` : ''}${resultLine(q)}</div>` : '';
    const mp = q.mp && q.stage !== 'reveal' ? `<div class="mpart">Угадан один: <b>${esc((d.names || [])[q.mp.n - 1] || '№' + q.mp.n)}</b> · ${esc(entName(q.mp.who))} ${sgn(q.mp.val)} · кто назовёт второго?</div>` : '';
    const pic = !!d.img, fs = pic || md ? Math.min(pic ? (q.stage === 'reveal' ? 2.2 : 2.6) : 3, qSize(d.q)) : qSize(d.q), mdl = qMedal(q);
    return el(`<div class="qscreen st-${q.stage} ${md ? 'md md-' + md : ''} ${pic ? 'haspic' : ''} ${d.kar ? 'haskar' : ''}"><div class="qhead"><span class="qth">${esc(themeOf(q))}</span><span class="qpr ${mdl ? 'medal m' + mdl : ''}">${fmt(q.stake || q.price)}</span>${badge(q)}</div>${own}${media}${mp}
      <div class="qtext" style="font-size:${fs}rem">${esc(d.q)}</div><div class="timer" id="timer"><i></i><b></b></div><div class="qstatus" id="qstatus"></div>${banner}${answer}
      <div class="hostbar">${hostButtons(q)}</div></div>`);
  }
  // длинный вопрос + длинный ответ с комментарием не помещаются на экран — ужимаем текст вопроса, пока кнопки ведущего не окажутся на виду
  function fitQ() {
    const qs = $('#stage .qscreen'), qt = qs && $('.qtext', qs), hb = qs && $('.hostbar', qs); if (!qt || !hb) return;
    const pb = parseFloat(getComputedStyle(qs).paddingBottom) || 0, over = () => hb.offsetTop + hb.offsetHeight + pb - qs.clientHeight;
    let fs = parseFloat(qt.style.fontSize) || 3;
    for (let k = 0; k < 10 && over() > 1 && fs > 1.7; k++) { fs = Math.max(1.7, fs * 0.92); qt.style.fontSize = fs.toFixed(2) + 'rem'; }
  }
  function hostButtons(q) {
    const B = (a, label, cls, k) => `<button class="btn ${cls || ''}" data-act="${a}">${label}${k ? `<kbd>${k}</kbd>` : ''}</button>`;
    const J = B('ok', '✓ Верно', 'ok', 'Enter') + B('bad', '✗ Неверно', 'bad', '⌫'), d = curD();
    const M = isMediaQ(d) ? B('media', d.video ? '⏯ Видео' : '⏯ Музыка', '', 'P') : '';
    const P = d.type === 'mashup' && !q.mp && (q.owner ? ['read', 'open', 'timeup'].includes(q.stage) : q.stage === 'ans') ? B('mp1', '¼ Угадан №1', 'half') + B('mp2', '¼ Угадан №2', 'half') : '';
    if (q.stage === 'read') return B('timer', '▶ Старт', 'gold', 'Пробел') + (q.owner ? J + P : '') + M + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'open') return B('timer', q.tr ? '⏸ Пауза' : '▶ Продолжить', '', 'Пробел') + (q.owner ? J + P : '') + M + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'ans') return J + P + (G.set.atime ? B('atimer', '⏯ Время ответа', '', 'Пробел') : '') + M + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'timeup') return J + P + M + B('reveal', '👁 Ответ', '', 'A');
    if (q.stage === 'reveal') return M + B('board', 'К табло ▶', 'gold', '→');
    return '';
  }
  function resultLine(q) {
    const r = q.result, p = q.mp ? `<div class="res ok">${esc(entName(q.mp.who))}: ${sgn(q.mp.val)} (угадан один из двух)</div>` : '';
    if (!r) return p + `<div class="res none">${q.tried.length ? (q.mp ? 'Второго так никто и не назвал' : 'Верного ответа не было') : 'Никто не ответил'}</div>`;
    return p + `<div class="res ${r.ok ? 'ok' : 'bad'}">${esc(entName(r.who))}: ${r.val ? sgn(r.ok ? r.val : -r.val) : '0'}${r.note ? ' ' + esc(r.note) : ''}</div>`;
  }
  // мешап: назвали одного из двух — четверть цены, второго может добрать следующий
  function mashPartial(n) {
    const q = G.q, d = curD(); if (G.phase !== 'q' || !q || busy || d.type !== 'mashup' || q.mp) return;
    const who = q.owner || (q.stage === 'ans' ? q.ans : null);
    if (!who || !ent(who) || !['read', 'open', 'ans', 'timeup'].includes(q.stage)) return;
    snap(); stopTimer(); stopAT();
    const val = r10((q.stake || q.price) * 0.25);
    addScore(who, val); q.mp = { who, n: +n === 2 ? 2 : 1, val }; Sound.play('partial'); flash('ok');
    quip(`${entName(who)}: один есть! Кто назовёт второго — заберёт ${fmt(q.stake || q.price)}`, 'ok');
    q.tried.push(who);
    if (q.owner) return reveal(true);
    q.ans = null; q.al = null; q.aup = false;
    if (!G.ents.some(e => !q.tried.includes(e.id) && !G.fz[e.id])) return reveal(true);
    q.stage = 'open'; changed(); setTimeout(() => { if (G.q === q && q.stage === 'open' && !q.tr) startTimer(); }, 700);
  }
  function qStatus(q) {
    if (q.stage === 'read') return q.owner ? '' : '<span class="mut">Приготовьтесь…</span>';
    if (q.stage === 'open' && !q.owner) {
      const fz = G.ents.filter(e => G.fz[e.id]);
      return '<span class="go">Жмите кнопку!</span>' + (q.tried.length ? `<span class="mut">Уже отвечали: ${esc(q.tried.map(entName).join(', '))}</span>` : '')
        + (fz.length ? `<span class="mut">❄️ Заморожены: ${esc(fz.map(e => e.name).join(', '))}</span>` : '');
    }
    if (q.stage === 'timeup') return '<span class="bad">Время вышло!</span>';
    if (q.stage === 'ans' && q.aup) return '<span class="bad">Время на ответ вышло — решай, ведущий!</span>';
    return '';
  }
  function updQ() {
    const q = G.q; if (!q) return;
    updTimer(); updAT();
    const s = $('#qstatus'); if (s) { const h = qStatus(q); if (s.dataset.h !== h) { s.innerHTML = h; s.dataset.h = h; } }
    const tb = $('.hostbar [data-act=timer]'); if (tb && q.stage === 'open') tb.innerHTML = (q.tr ? '⏸ Пауза' : '▶ Продолжить') + '<kbd>Пробел</kbd>';
    if (q.stage === 'auction') renderBids();
    if (q.stage === 'bonus') updCon();
  }
  function updAT() {
    const q = G.q, box = $('#anst'); if (!box || !q) return;
    const tot = G.set.atime || 1, l = q.al == null ? tot : q.al, fg = box.querySelector('.fg');
    fg.style.strokeDashoffset = String(276.5 * (1 - Math.max(0, Math.min(1, l / tot))));
    box.querySelector('b').textContent = q.aup ? '!' : Math.ceil(l);
    box.classList.toggle('low', l <= 5); box.classList.toggle('paused', !q.ar && !q.aup);
    const bz = $('#buzzer'); if (bz) bz.classList.toggle('up', !!q.aup);
  }
  function updTimer() {
    const h = holder(), t = $('#timer');
    if (!t || !h) { document.body.classList.remove('danger'); return; }
    const tot = G.phase === 'final' ? G.set.ftimer : (h.tot || G.set.timer), frac = Math.max(0, Math.min(1, h.tl / tot));
    t.firstElementChild.style.transform = `scaleX(${frac.toFixed(4)})`;
    t.querySelector('b').textContent = Math.ceil(h.tl);
    t.classList.toggle('warn', h.tl <= tot * 0.5 && h.tl > 5); t.classList.toggle('danger', h.tl <= 5); t.classList.toggle('paused', !h.tr);
    document.body.classList.toggle('danger', !!h.tr && h.tl <= 5);
    if (G.phase === 'q') picState();
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
    if (G.phase === 'q' && G.q.stage === 'ans') return toggleAT();
    if (h.tr) { stopTimer(); if (G.phase === 'q') mediaPause(); publish(); updQorF(); }
    else if (h.tl > 0 && ((G.phase === 'q' && G.q.stage === 'open') || (G.phase === 'final' && G.fin.stage === 'q'))) { startTimer(); if (G.phase === 'q') mediaPlay(); }
  }
  /* ----- время на ответ: после нажатия кнопки; когда вышло — только сигнал, решает ведущий ----- */
  function startAT() {
    const q = G.q; if (!q || q.stage !== 'ans' || !G.set.atime || q.aup) return;
    if (q.al == null) q.al = G.set.atime;
    q.ar = true; aLast = performance.now(); aSec = Math.ceil(q.al);
    clearInterval(aInt); aInt = setInterval(aTick, 100); updAT();
  }
  function stopAT() { const q = G.q; if (q) q.ar = false; clearInterval(aInt); aInt = null; }
  function toggleAT() { const q = G.q; if (!q || q.stage !== 'ans' || q.aup || !G.set.atime) return; if (q.ar) stopAT(); else startAT(); publish(); updAT(); }
  function aTick() {
    const q = G.q; if (!q || !q.ar || q.stage !== 'ans') { clearInterval(aInt); aInt = null; return; }
    const now = performance.now(); q.al = Math.max(0, q.al - (now - aLast) / 1000); aLast = now;
    const s = Math.ceil(q.al);
    if (s !== aSec) { aSec = s; if (s > 0 && s <= 5) Sound.play('tickFast'); }
    updAT();
    if (q.al <= 0) { q.ar = false; q.aup = true; clearInterval(aInt); aInt = null; Sound.play('horn'); flash('bad'); save(); publish(); updQ(); }
  }
  function onTimeout() {
    if (G.phase === 'final') return finalTimeUp();
    const q = G.q; if (!q) return;
    Sound.play('timeout');
    if (q.owner) { q.stage = 'timeup'; changed(); }
    else if (q.stage === 'open') { reveal(true); if (!q.mp) quip(joke('timeout'), 'mut'); }
  }

  /* ================= ход игры ================= */
  async function startGame() {
    if (busy) return;
    if (!G.ents.length) return toast('Сначала добавь игроков или дождись, пока подключатся телефоны');
    if (!PACK.rounds.length) return toast('В questions.js нет раундов');
    if (G.started && G.resume) { G.phase = G.resume; G.resume = null; curSig = null; return changed(); }
    snap();
    Object.assign(G, { started: true, resume: null, round: 0, played: {}, chooser: null, q: null, fin: null, fz: {}, x2: {}, sh: {}, bo: {}, phase: 'trans' });
    G.ents.forEach(e => { e.score = 0; });
    changed();
    busy = true;
    try {
      await flyby(PACK.rounds.map((r, i) => ({ label: r.name || `Раунд ${i + 1}`, themes: (r.themes || []).map(th => th.name) })).concat(finThemes().length ? [{ label: 'Финал', themes: ['???'] }] : []));
      await overlay('round', { title: R().name || 'Раунд 1', sub: joke('start') || 'Поехали!' });
    } finally { busy = false; }
    G.chooser = pick(G.ents).id; G.phase = 'board'; boardIntro = true; curSig = null; changed();
    toast(`Первым выбирает: ${entName(G.chooser)} ⭐`);
  }
  function toLobby() { if (!['board', 'end'].includes(G.phase)) return; G.resume = G.phase === 'end' ? null : G.phase; if (G.phase === 'end') G.started = false; G.phase = 'lobby'; curSig = null; changed(); }
  // раунд закончился — сначала промежуточные итоги, потом следующий раунд или финал
  function nextRound() { showResults(); }
  async function afterResults() {
    if (G.phase !== 'results' || busy) return;
    G.res = null;
    if (G.round + 1 >= PACK.rounds.length) return startFinal();
    G.round++; G.q = null; G.phase = 'trans'; changed();
    busy = true;
    try {
      await overlay('round', { title: R().name || `Раунд ${G.round + 1}`, sub: 'Цены выросли!' });
      await flyby([{ label: R().name || `Раунд ${G.round + 1}`, themes: R().themes.map(th => th.name) }]);
    } finally { busy = false; }
    G.phase = 'board'; boardIntro = true; curSig = null; changed();
  }

  /* ----- промежуточные итоги раунда: кто ведёт, подколы и шанс на реабилитацию для отстающих ----- */
  const REDEEM = ['Поздравь Старого как следует — с выражением и стоя', 'Скажи тост за Старого, в котором нет слов «здоровья» и «счастья»', 'Сделай Старому массаж плеч 30 секунд', 'Спой Старому «С днём рождения» голосом Шнура', 'Сделай Старому три комплимента подряд — без повторов', 'Изобрази, как Старый просыпается после своего дня рождения'];
  function showResults() {
    stopTimer(); stopAT(); conHalt(); mediaStop(); picDrop();
    const rank = G.ents.slice().sort((a, b) => b.score - a.score), lead = rank[0];
    const nl = G.ents.length >= 7 ? 2 : G.ents.length >= 2 ? 1 : 0, losers = nl ? rank.slice(-nl).filter(e => e !== lead).map(e => e.id) : [];
    const acts = {}, tj = {}; losers.forEach(id => { acts[id] = drawCard('redeem'); tj[id] = joke('loser', entName(id)); });
    G.res = { r: G.round, lead: lead ? lead.id : null, lj: lead ? joke('leader', lead.name) : '', losers, acts, tj, done: {} };
    G.q = null; G.phase = 'results'; curSig = null; changed();
    Sound.play('drumroll'); setTimeout(() => { if (G.phase === 'results') { Sound.play('results'); FX.confetti(80); } }, 1600);
  }
  function vResults() {
    const R0 = G.res, rank = G.ents.slice().sort((a, b) => b.score - a.score), max = Math.max(1, ...rank.map(e => Math.abs(e.score)));
    const rn = (PACK.rounds[R0.r] || {}).name || `Раунд ${R0.r + 1}`, last = R0.r + 1 >= PACK.rounds.length, step = 100 * (R0.r + 1);
    const bars = rank.map((e, i) => `<div class="rb ${e.id === R0.lead ? 'lead' : ''} ${R0.losers.includes(e.id) ? 'lose' : ''}" style="--c:${e.color};--w:${Math.max(3, Math.abs(e.score) / max * 100).toFixed(1)}%;animation-delay:${(0.25 + (rank.length - i) * 0.12).toFixed(2)}s">`
      + `<span class="rp">${i + 1}</span><span class="rn">${e.id === R0.lead ? '👑 ' : ''}${esc(e.name)}</span><span class="rbar"><i></i></span><span class="rs ${e.score < 0 ? 'neg' : ''}">${fmt(e.score)}</span></div>`).join('');
    const red = R0.losers.map(id => {
      const e = ent(id); if (!e) return '';
      const dn = R0.done[id];
      return `<div class="redeem" style="--c:${e.color}"><div class="rd-h">🆘 Шанс на реабилитацию: <b>${esc(e.name)}</b></div><div class="rd-j">${esc(R0.tj[id] || '')}</div><div class="rd-t">${esc(R0.acts[id] || '')}</div>`
        + (dn != null ? `<div class="rd-r ${dn > 0 ? 'ok' : ''}">${dn > 0 ? `Засчитано: ${sgn(dn)} 🎉` : 'Не засчитано 😐'}</div>`
          : `<div class="rd-b">${[step, step * 2, step * 3].map(x => `<button class="btn ok" data-act="redeem" data-id="${esc(id)}" data-v="${x}">${sgn(x)}</button>`).join('')}<button class="btn bad" data-act="redeem" data-id="${esc(id)}" data-v="0">✗ Не засчитано</button><button class="btn" data-act="reroll" data-id="${esc(id)}">🎲 Другое задание</button></div>`)
        + '</div>';
    }).join('');
    // чем больше игроков, тем мельче строки; с 7 игроков рейтинг и задания для отстающих встают в две колонки — всё помещается на экран
    const n = rank.length, two = n >= 7, f = n <= 4 ? 2.6 : n <= 5 ? 2.4 : n <= 6 ? 2.2 : n <= 8 ? 2.4 : n <= 10 ? 2.1 : n <= 12 ? 1.9 : 1.5;
    return el(`<div class="results ${two ? 'two' : ''}"><div class="rs-sub">${esc(rn)} позади</div><div class="rs-title">${letters('Промежуточные итоги')}</div>
      ${R0.lead && R0.lj ? `<div class="rs-lead">👑 ${esc(R0.lj)}</div>` : ''}<div class="rs-body"><div class="rbars" style="--f:${f}rem">${bars}</div>${red ? `<div class="rs-side">${red}</div>` : ''}</div>
      <div class="hostbar"><button class="btn gold" data-act="resnext">${last ? 'К финалу ▶' : 'Следующий раунд ▶'}<kbd>→</kbd></button></div></div>`);
  }
  function redeem(id, v) {
    const R0 = G.res; if (G.phase !== 'results' || !R0 || !R0.losers.includes(id) || R0.done[id] != null) return;
    snap(); const x = Math.max(0, +v || 0); R0.done[id] = x;
    if (x) { addScore(id, x); Sound.play('applause'); FX.confetti(90); } else Sound.play('sad');
    curSig = null; changed();
  }
  function reroll(id) { const R0 = G.res; if (!R0 || !R0.losers.includes(id) || R0.done[id] != null) return; R0.acts[id] = drawCard('redeem'); Sound.play('roll'); curSig = null; changed(); }

  /* ----- пролёт тем: названия тем вылетают из глубины экрана ----- */
  function flyby(groups) {
    return new Promise(res => {
      closeOverlay();
      const ov = $('#overlay'); ov.className = 'show ov-flyby'; ov.innerHTML = '<div class="fly"><div class="fly-lbl"></div></div>';
      const box = $('.fly', ov), lbl = $('.fly-lbl', ov), timers = []; let t = 250, n = 0;
      groups.forEach(g => {
        timers.push(setTimeout(() => { lbl.textContent = g.label; lbl.classList.remove('in'); void lbl.offsetWidth; lbl.classList.add('in'); Sound.play('whoosh'); }, t)); t += 700;
        g.themes.forEach(name => {
          const k = n++;
          timers.push(setTimeout(() => {
            const c = el(`<div class="fl">${esc(name)}</div>`), a = (k * 137.5) % 360 * Math.PI / 180, rr = 6 + (k % 3) * 5;
            c.style.setProperty('--x', (Math.cos(a) * rr).toFixed(1) + 'rem'); c.style.setProperty('--y', (Math.sin(a) * rr * 0.55).toFixed(1) + 'rem'); c.style.setProperty('--r', ((k % 2 ? 1 : -1) * (3 + k % 5)) + 'deg');
            box.appendChild(c); Sound.play('flyby'); setTimeout(() => c.remove(), 1500);
          }, t)); t += 230;
        });
        t += 900; // слова прошлой группы ещё пролетают — не наезжаем названием следующего раунда
      });
      let done = false;
      const fin = () => {
        if (done) return; done = true; timers.forEach(clearTimeout); if (ovResolve === fin) ovResolve = null;
        ov.classList.add('hide'); setTimeout(() => { if (!ovResolve) { ov.className = ''; ov.innerHTML = ''; } }, 340); res();
      };
      ovResolve = fin; timers.push(setTimeout(fin, t + 1300));
    });
  }
  function skipRound() { if (G.phase !== 'board') return; snap(); R().themes.forEach((th, t) => (th.questions || []).forEach((x, i) => { G.played[`${G.round}-${t}-${i}`] = true; })); nextRound(); }

  async function openCell(t, i, cellEl) {
    if (G.phase !== 'board' || busy) return;
    const key = `${G.round}-${t}-${i}`, d = qd(G.round, t, i);
    if (G.played[key] || !d) return;
    snap(); busy = true; Sound.play('select');
    G.played[key] = true;
    const type = ['cat', 'auction', 'trap', 'bonus'].includes(d.type) ? d.type : 'normal';
    const tot = isMediaQ(d) ? Math.max(G.set.timer, 30) : G.set.timer; // на музыку и видео — не меньше 30 секунд
    G.q = { key, r: G.round, t, i, price: +d.price || 0, type, stage: 'intro', tried: [], bribed: [], blog: [], ans: null, owner: null, stake: null, tl: tot, tot, tr: false, victim: null, auc: null, trap: null, con: null, result: null, al: null, ar: false, aup: false };
    G.phase = 'q'; curSig = null; save(); publish();
    if (isMediaQ(d)) mediaPrep(G.q, d); // файл начинает грузиться заранее
    await flipCell(cellEl);
    render();
    try {
      if (type === 'cat') { await overlay('cat'); G.q.stage = 'cat'; }
      else if (type === 'auction') { await overlay('auction'); G.q.stage = 'auction'; G.q.auc = { bids: {}, passed: {}, allin: {} }; }
      else if (type === 'trap') { await overlay('trap'); G.q.stage = 'trap'; G.q.trap = { side: null, ev: null, step: 0 }; G.q.victim = G.chooser && ent(G.chooser) ? G.chooser : null; }
      else if (type === 'bonus') { await overlay('bonus'); conInit(G.q, d); }
      else {
        const mdl = medalOf(PACK.rounds[G.round], t, i);
        if (mdl) await overlay('medal', { md: mdl });
        if (d.type === 'mashup') await overlay('mashup'); else if (d.audio && !mdl) await overlay('music'); else if (d.video && !mdl) await overlay('video');
        G.q.stage = 'read';
      }
    } finally { busy = false; }
    changed();
    if (G.q && G.q.stage === 'read') autoOpen();
    if (G.q && G.q.stage === 'bonus') conAuto();
  }
  function autoOpen() { const k = G.q && G.q.key; setTimeout(() => { if (G.phase === 'q' && G.q && G.q.key === k && G.q.stage === 'read') openBuzz(); }, 1400); }
  function openBuzz() {
    const q = G.q; if (!q || q.stage !== 'read') return;
    q.stage = 'open'; q.tl = q.tl > 0 ? q.tl : (q.tot || G.set.timer); Sound.play('open'); changed(); startTimer(); mediaPlay();
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
    const q = G.q; snap(); stopTimer(); mediaPause();
    q.ans = eid; q.stage = 'ans'; q.al = G.set.atime || null; q.aup = false; Sound.play('buzz'); changed(); startAT();
    const c = $(`#scores .ent[data-id="${CSS.escape(eid)}"]`); if (c) { const r = c.getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top, ent(eid).color, 40); }
  }
  function judge(ok) {
    const q = G.q; if (G.phase !== 'q' || !q || busy) return;
    const who = q.owner || (q.stage === 'ans' ? q.ans : null);
    if (!who || !ent(who) || !['read', 'open', 'ans', 'timeup'].includes(q.stage)) return;
    snap(); stopTimer(); stopAT();
    let val = q.stake || q.price, note = '';
    if (ok) {
      if (G.x2[who]) { val *= 2; note = '(×2)'; delete G.x2[who]; } else if (G.bo[who]) { val *= 2; note = '(✨ ×2)'; delete G.bo[who]; }
      addScore(who, val); G.chooser = who; q.result = { who, ok: true, val, note };
      Sound.play('correct'); flash('ok'); FX.confetti(150); if (val >= 1000) FX.fireworks(1600); reveal(true); quip(joke('correct', entName(who)), 'ok');
    } else {
      if (G.sh[who]) { val = 0; note = '(🛡️ щит спас)'; delete G.sh[who]; delete G.x2[who]; toast(`🛡️ Щит спас ${entName(who)} от штрафа!`); }
      else if (G.x2[who]) { val *= 2; note = '(×2)'; delete G.x2[who]; }
      addScore(who, -val); Sound.play('wrong'); flash('bad'); shake(); quip(joke('wrong', entName(who)), 'bad');
      if (q.owner) { q.result = { who, ok: false, val, note }; reveal(true); }
      else {
        q.tried.push(who); q.ans = null; q.al = null; q.aup = false;
        if (!G.ents.some(e => !q.tried.includes(e.id) && !G.fz[e.id])) reveal(true);
        else { q.stage = 'open'; changed(); setTimeout(() => { if (G.q === q && q.stage === 'open' && !q.tr) { startTimer(); mediaPlay(); } }, 700); }
      }
    }
  }
  function reveal(silent) {
    const q = G.q; if (G.phase !== 'q' || !q || !['read', 'open', 'ans', 'timeup'].includes(q.stage)) return;
    stopTimer(); stopAT(); q.stage = 'reveal'; if (silent !== true) Sound.play('flip'); changed();
    const d = curD();
    if (MP && MP.el && MP.key === q.key && +d.aend > +d.end) { MP.stopAt = +d.aend; try { MP.el.currentTime = +d.end || 0; } catch (e) { /* ещё не загрузилось */ } mediaPlay(); } // песня продолжается — все слышат пропущенное
    else if (MP && MP.started) mediaPlay(); // после ответа пусть доиграет
  }
  function backToBoard() {
    if (G.phase !== 'q' || !G.q || busy) return;
    snap(); stopTimer(); stopAT(); stopConvince(); conHalt(); mediaStop();
    Object.keys(G.fz).forEach(id => { G.fz[id]--; if (G.fz[id] <= 0) delete G.fz[id]; });
    G.q = null; G.phase = 'board'; curSig = null; picDrop();
    if (roundDone()) { save(); nextRound(); } else changed();
  }

  /* ----- кот в мешке ----- */
  function catGive(eid) {
    const q = G.q; if (!q || q.stage !== 'cat' || !ent(eid)) return;
    snap(); q.owner = eid; q.stage = 'read'; Sound.play('whoosh'); changed(); autoOpen();
  }

  /* ----- аукцион ----- */
  function aucMax() { const b = G.q.auc.bids; let max = 0, lead = null; for (const id in b) if (b[id] > max) { max = b[id]; lead = id; } return { max, lead }; }
  async function bidCustom(eid) {
    const q = G.q, e = ent(eid); if (!q || q.stage !== 'auction' || !e) return;
    const v = await ask(`Ставка: ${e.name} (от ${fmt(Math.max(q.price, aucMax().max + 1))} до ${fmt(Math.max(e.score, q.price))})`, '');
    if (v == null) return;
    const n = parseInt(String(v).replace(/[\s−-]/g, ''), 10); if (!isFinite(n)) return toast('Нужно число');
    placeBid(eid, n, true, null, true);
  }
  function placeBid(eid, v, host, k, exact) {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'auction' || !ent(eid) || (!host && k !== q.key)) return;
    const a = q.auc, e = ent(eid);
    if (v === 'pass') { a.passed[eid] = true; changed(); return; }
    const { max } = aucMax(), cap = Math.max(e.score, q.price);
    const bid = v === 'all' ? cap : host && !exact ? Math.max(q.price, max + (+v || 100)) : Math.floor(+v);
    if (!(bid >= q.price) || bid <= max || bid > cap) { if (host) toast(bid > cap ? `${e.name}: можно поставить не больше ${fmt(cap)}` : `Ставка должна быть больше ${fmt(Math.max(max, q.price - 1))}`); return; }
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
        + `<span class="bb"><button data-act="bid" data-id="${esc(e.id)}" data-v="100">+100</button><button data-act="bid" data-id="${esc(e.id)}" data-v="500">+500</button><button data-act="bidc" data-id="${esc(e.id)}" title="Вписать сумму">✎</button><button data-act="bid" data-id="${esc(e.id)}" data-v="all">ва-банк</button></span></div>`;
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

  /* ----- ловушка: ангел или дьявол ----- */
  const taxMax = p => Math.min(1000, Math.max(100, p * 2));
  const jackMax = p => Math.min(2000, Math.max(200, Math.round(p * 1.5 / 50) * 50));
  const half = p => r10(p / 2);
  // у всех событий равные шансы
  const ANGEL = [
    { id: 'jackpot', icon: '💰', name: 'Джекпот', desc: p => `Бесплатные очки! Крутим барабан: от 100 до ${fmt(jackMax(p))}.` },
    { id: 'convince', icon: '🗣️', name: 'Уговори судью', desc: () => 'Назови сумму (на телефоне) и уговаривай судью 30 секунд. Даст или не даст — решает судья.' },
    { id: 'ltruth', icon: '😇', name: 'Лёгкая правда', desc: p => `Честно ответь на вопрос — ${sgn(half(p))}. Отказ без штрафа.` },
    { id: 'ldare', icon: '🙂', name: 'Лёгкое задание', desc: p => `Выполни простое задание — ${sgn(half(p))}. Отказ без штрафа.` },
    { id: 'shield', icon: '🛡️', name: 'Щит', desc: () => 'Следующий неверный ответ — без штрафа.' },
    { id: 'boost', icon: '✨', name: 'Благословение', desc: () => 'Следующий верный ответ принесёт ×2.' },
    { id: 'peek', icon: '👀', name: 'Подсказка свыше', desc: () => 'Подсказка к этому вопросу бесплатно придёт на телефон.' },
    { id: 'robin', icon: '🏹', name: 'Робин Гуд', multi: true, desc: p => `Забираешь ${fmt(half(p))} очков у лидера.` },
  ];
  const DEVIL = [
    { id: 'tax', icon: '💸', name: 'Налоговая', desc: p => `Налоговая нашла лишние очки! Спишем от 50 до ${fmt(taxMax(p))}.` },
    { id: 'btruth', icon: '😈', name: 'Неудобная правда', desc: p => `Ответь честно — и штрафа не будет. Отказ: ${sgn(-p)}.` },
    { id: 'bdare', icon: '🔥', name: 'Смелое задание', desc: p => `Выполни — и штрафа не будет. Отказ: ${sgn(-p)}.` },
    { id: 'poem', icon: '📜', name: 'Стих на табуретке', desc: p => `Встань на стул и с выражением зачитай поздравление Старому — текст на телефоне. Отказ: ${sgn(-p)}.` },
    { id: 'dshot', icon: '🥃', name: 'Штрафная стопка', need: 'drink', desc: p => `Выпей стопку до дна! Отказ: ${sgn(-p)}.` },
    { id: 'dsing', icon: '🎤', name: 'Спой!', need: 'sing', desc: p => `Остальные выбирают песню — ты поёшь без музыки 10 секунд. Отказ: ${sgn(-p)}.` },
    { id: 'ddance', icon: '💃', name: 'Танец позора', need: 'dance', desc: p => `20 секунд танца под музыку в центре комнаты. Отказ: ${sgn(-p)}.` },
    { id: 'freeze', icon: '❄️', name: 'Заморозка', desc: () => 'Кнопка не работает в этом и следующем вопросе.' },
    { id: 'casino', icon: '🎰', name: 'Казино', desc: p => `Ставка на монетку: удвоишь или потеряешь. Струсил — штраф ${sgn(-p)}.` },
    { id: 'give', icon: '🎁', name: 'Щедрость поневоле', multi: true, desc: p => `Подари ${fmt(p)} очков любому игроку. Выбирай на телефоне.` },
    { id: 'swap', icon: '🔄', name: 'Рокировка', multi: true, desc: () => 'Меняешься очками со случайным игроком!' },
    { id: 'x2', icon: '✖️', name: 'Двойная ставка', desc: () => 'Следующий твой ответ считается ×2 — и плюс, и минус.' },
  ];
  const EVX = Object.fromEntries(ANGEL.concat(DEVIL).map(e => [e.id, e]));
  const CARDS = {
    ltruth: () => PACK.angelTruth || PACK.truth || ['Кем ты мечтал стать в детстве?'],
    ldare: () => PACK.angelDare || PACK.dare || ['Сделай комплимент имениннику.'],
    btruth: () => PACK.devilTruth || PACK.truth || ['Какой твой самый неловкий момент?'],
    bdare: () => PACK.devilDare || PACK.dare || ['Спой куплет любой песни.'],
    redeem: () => PACK.redemption || REDEEM,
    poem: () => PACK.poems || ['Старый, с днём рождения!\nТы не стареешь — ты выдерживаешься,\nкак сыр, вино и шутки про тебя.'],
    croc: () => PACK.croc || ['Вертолёт', 'Жираф', 'Пингвин', 'Холодильник', 'Свадьба', 'Рыбалка'],
  };
  function drawCard(kind) {
    const list = (CARDS[kind] ? CARDS[kind]() : []).filter(Boolean); if (!list.length) return '…';
    G.uc = G.uc || [];
    const fresh = list.filter(x => !G.uc.includes(x)), c = pick(fresh.length ? fresh : list);
    G.uc.push(c); if (G.uc.length > 80) G.uc.shift();
    return c;
  }
  function pickW(list) { const tot = list.reduce((s, e) => s + (e.w || 1), 0); let r = Math.random() * tot; for (const e of list) { r -= e.w || 1; if (r <= 0) return e; } return list[0]; }
  const FORCE = {}; // для проверки: coin (true — ангел), ev, con, stake
  function pickEvent(side, vic) {
    const list = side === 'a' ? ANGEL : DEVIL;
    if (FORCE.ev && list.some(e => e.id === FORCE.ev)) return EVX[FORCE.ev];
    const multi = G.ents.length > 1;
    return pickW(list.filter(e => (multi || !e.multi) && (!e.need || entPref(vic, e.need))));
  }
  const coinHTML = kind => kind === 'casino'
    ? '<div class="coinstage"><div class="toss"><div class="coin"><div class="face fr win"><span>🤑</span><b>×2</b></div><div class="face bk lose"><span>💀</span><b>МИМО</b></div></div></div></div>'
    : '<div class="coinstage"><div class="toss"><div class="coin"><div class="face fr angel"><span>😇</span><b>АНГЕЛ</b></div><div class="face bk devil"><span>😈</span><b>ДЬЯВОЛ</b></div></div></div></div>';
  const cardsHTML = (list, n) => { const out = []; for (let i = 0; i < n; i++) { const e = list[(i * 5 + 3) % list.length]; out.push(`<div class="rc"><span>${e.icon}</span><b>${esc(e.name)}</b></div>`); } return out.join(''); };
  function vTrap(q) {
    const v = q.victim && ent(q.victim);
    if (!v) return el(`<div class="special"><div class="sp-title warn">⚠ Ловушка!</div><div class="sp-hint">Кто выбрал этот вопрос?</div>${pickerHTML(G.ents, 'victim')}</div>`);
    const ph = hasPhone(v.id);
    return el(`<div class="special trapc"><div class="sp-title warn">⚠ Ловушка!</div><div class="sp-info">Судьбу <b style="color:${v.color}">${esc(v.name)}</b> решает монетка</div>
      <div class="sp-hint">😇 Ангел — лёгкие задания и подарки · 😈 Дьявол — смелые задания и штрафы</div>${coinHTML()}
      <div class="sp-call">${ph ? '📱 Подбрось монетку на телефоне!' : ''}</div>
      <div class="hostbar"><button class="btn gold" data-act="flip">Бросить монетку${ph ? ' за игрока' : ''}<kbd>Пробел</kbd></button></div></div>`);
  }
  async function coinAnim(scope, front) {
    const toss = $('.toss', scope), coin = $('.coin', scope); if (!toss || !coin) return;
    const end = 7 * 360 + (front ? 0 : 180);
    Sound.play('coin'); Sound.play('whoosh');
    toss.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-15rem) scale(1.3)', offset: 0.45 }, { transform: 'translateY(0) scale(1)' }], { duration: 2100, easing: 'cubic-bezier(.3,0,.3,1)' });
    const a = coin.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${end}deg)` }], { duration: 2100, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
    await a.finished; Sound.play('land'); await sleep(450);
  }
  function phoneCoin(eid, k) { const q = G.q; if (G.phase === 'q' && q && q.key === k && q.stage === 'trap' && q.victim === eid) trapFlip(); }
  function phoneSpin(eid, k) { const q = G.q; if (G.phase === 'q' && q && q.key === k && q.stage === 'trapspin' && q.victim === eid) trapSpin(); }
  async function trapFlip() {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'trap' || !q.victim || busy) return;
    busy = true; snap();
    const angel = FORCE.coin != null ? !!FORCE.coin : Math.random() < 0.5;
    q.trap = { side: angel ? 'a' : 'd', ev: null, step: 0 }; publish();
    $$('#stage .hostbar button').forEach(b => { b.disabled = true; }); const call = $('#stage .sp-call'); if (call) call.textContent = '';
    try { await coinAnim($('#stage'), angel); await overlay(angel ? 'angel' : 'devil'); } finally { busy = false; }
    if (G.q !== q) return;
    q.stage = 'trapspin'; changed();
  }
  function vTrapSpin(q) {
    const v = ent(q.victim), A = q.trap.side === 'a', ph = v && hasPhone(v.id);
    return el(`<div class="special trapc ${A ? 'angel' : 'devil'}"><div class="sp-title ${A ? 'angel' : 'devil'}">${A ? '😇 Ангел' : '😈 Дьявол'}</div>
      <div class="sp-info">${A ? 'Рулетка подарков' : 'Рулетка испытаний'} для <b style="color:${v ? v.color : '#fff'}">${esc(v ? v.name : '—')}</b></div>
      <div class="roul ${A ? 'angel' : 'devil'}" id="roul"><div class="rframe"></div><div class="rstrip" style="transform:translateX(-28rem)">${cardsHTML(A ? ANGEL : DEVIL, 9)}</div></div>
      <div class="sp-call">${ph ? '📱 Крути рулетку на телефоне!' : ''}</div>
      <div class="hostbar"><button class="btn gold" data-act="spin">🎰 Крутить${ph ? ' за игрока' : ''}<kbd>Пробел</kbd></button></div></div>`);
  }
  async function trapSpin() {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'trapspin' || busy) return;
    busy = true; snap();
    const A = q.trap.side === 'a', ev = pickEvent(q.trap.side, q.victim);
    q.trap.ev = ev.id; prepEvent(ev, q); publish();
    $$('#stage .hostbar button').forEach(b => { b.disabled = true; }); const call = $('#stage .sp-call'); if (call) call.textContent = '';
    try { const box = $('#roul'); if (box) await roulette(box, A ? ANGEL : DEVIL, ev, A ? 'angel' : 'devil'); } finally { busy = false; }
    if (G.q !== q) return;
    q.stage = 'trapev'; changed();
    if (A) { FX.rain('✨', 26); Sound.play('angel'); } else { FX.rise('🔥', 30); Sound.play('devil'); }
  }
  // рулетка: лента карточек прокручивается и останавливается на выбранной
  async function roulette(box, list, target, kind) {
    const strip = $('.rstrip', box), N = 40, T = 33, cards = [];
    for (let i = 0; i < N; i++) cards.push(i === T ? target : pickW(list));
    strip.innerHTML = cards.map(e => `<div class="rc"><span>${e.icon}</span><b>${esc(e.name)}</b></div>`).join('');
    await sleep(30);
    const cw = strip.children[0].getBoundingClientRect().width, gap = parseFloat(getComputedStyle(strip).columnGap) || 0, step = cw + gap;
    const center = box.clientWidth / 2 - cw / 2, endX = center - T * step + (Math.random() - 0.5) * cw * 0.5;
    const anim = strip.animate([{ transform: `translateX(${center}px)` }, { transform: `translateX(${endX}px)` }], { duration: 4600, easing: 'cubic-bezier(.08,.6,.1,1)', fill: 'forwards' });
    let last = -1;
    const tk = () => {
      if (anim.playState !== 'running') return;
      const m = new DOMMatrixReadOnly(getComputedStyle(strip).transform), idx = Math.round((center - m.m41) / step);
      if (idx !== last) { last = idx; Sound.play('roul'); }
      requestAnimationFrame(tk);
    };
    requestAnimationFrame(tk);
    await anim.finished;
    strip.children[T].classList.add('win'); Sound.play(kind === 'devil' ? 'trap' : 'bonus');
    const r = strip.children[T].getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, kind === 'devil' ? '#ff4d5e' : '#ffcc33', 60);
    await sleep(1300);
  }
  function prepEvent(ev, q) {
    const T = q.trap, others = G.ents.filter(e => e.id !== q.victim), p = q.price;
    if (ev.id === 'tax') T.amt = 50 * (1 + Math.floor(Math.random() * (taxMax(p) / 50)));
    if (ev.id === 'jackpot') T.amt = 50 * (2 + Math.floor(Math.random() * (jackMax(p) / 50 - 1)));
    if (ev.id === 'swap') T.target = others.length ? pick(others).id : null;
    if (ev.id === 'robin') { const lead = others.length ? others.reduce((a, b) => (b.score > a.score ? b : a)) : null; T.target = lead && lead.score > ((ent(q.victim) || {}).score || 0) ? lead.id : null; }
    if (['ltruth', 'ldare', 'btruth', 'bdare'].includes(ev.id)) T.card = drawCard(ev.id);
    if (ev.id === 'poem') { T.poem = drawCard('poem'); sendPrivate(q.victim, { k: q.key, poem: T.poem }); }
  }
  // уговори судью: игрок сам называет сумму (с телефона или ведущий вписывает)
  function phoneAsk(eid, k, v) {
    const q = G.q; if (G.phase !== 'q' || !q || q.key !== k || q.stage !== 'trapev' || q.victim !== eid || !q.trap || q.trap.ev !== 'convince' || q.trap.done) return;
    const x = Math.floor(Math.abs(+v)); if (!(x > 0) || x > 1e6) return;
    q.trap.ask = x; Sound.play('bid'); changed();
  }
  function vTrapEv(q) {
    const ev = EVX[q.trap.ev], v = ent(q.victim), A = q.trap.side === 'a';
    return el(`<div class="special trapc ${A ? 'angel' : 'devil'}"><div class="evcard ${A ? 'angel' : 'devil'}"><div class="evicon">${ev.icon}</div><div class="evname">${esc(ev.name)}</div><div class="evdesc">${esc(ev.desc(q.price))}</div></div>
      <div class="evvic">${A ? '😇 Счастливчик' : '😈 Жертва'}: <b style="color:${v ? v.color : '#fff'}">${esc(v ? v.name : '—')}</b></div><div class="evpanel" id="evpanel">${evPanel(ev, q)}</div></div>`);
  }
  function evPanel(ev, q) {
    const T = q.trap, p = q.price, v = q.victim;
    const btn = (val, label, cls, x, id) => `<button class="btn ${cls || ''}" data-act="ev" data-v="${val}"${x != null ? ` data-x="${x}"` : ''}${id ? ` data-id="${esc(id)}"` : ''}>${label}</button>`;
    if (T.done) return `<div class="evres">${esc(T.res)}</div><div class="hostbar"><button class="btn gold" data-act="trapdone">К вопросу ▶<kbd>→</kbd></button></div>`;
    const card = T.card ? `<div class="tdcard ${['btruth', 'bdare'].includes(ev.id) ? 'dare' : ''}"><div class="tdk">${ev.icon} ${esc(ev.name)}</div><div class="tdt">${esc(T.card)}</div></div>` : '';
    const task = t => `<div class="tdcard dare"><div class="tdt">${t}</div></div>`;
    const yesno = (y, n) => `<div class="hostbar">${btn('yes', y, 'ok')}${btn('no', n, 'bad')}</div>`;
    switch (ev.id) {
      case 'jackpot': return `<div class="slot" id="slot">???</div><div class="hostbar">${btn('jackpot', '🎰 Крутить барабан', 'gold')}</div>`;
      case 'convince': return `<div class="askrow"><div class="asklbl">${T.ask ? 'Просит у судьи' : hasPhone(v) ? '📱 Называй сумму на телефоне' : 'Сколько просишь?'}</div><div class="slot ${T.ask ? 'hit' : ''}" id="slot">${T.ask ? sgn(T.ask) : '???'}</div></div>`
        + `<div class="bigclock" id="cvclock">30</div><div class="hostbar">${btn('cvgo', '⏱ Старт 30 сек')}${btn('cvc', '✎ Вписать сумму')}${T.ask ? btn('cvyes', `✓ Дать ${sgn(T.ask)}`, 'ok') : ''}${btn('cvno', '✗ Не давать', 'bad')}</div>`;
      case 'poem': {
        const own = hasPhone(v);
        return `<div class="tdcard dare poem">${own ? `<div class="tdt">📜 Стих — на телефоне.<br><b>${esc(entName(v))}</b>, встаём на табуретку и зачитываем!</div>` : `<div class="tdt">${esc(T.poem || '')}</div>`}</div>` + yesno('✓ Зачитал · без штрафа', `✗ Отказался ${sgn(-p)}`);
      }
      case 'ltruth': return card + yesno(`✓ Ответил ${sgn(half(p))}`, '✗ Отказался · 0');
      case 'ldare': return card + yesno(`✓ Выполнил ${sgn(half(p))}`, '✗ Отказался · 0');
      case 'shield': return `<div class="hostbar">${btn('shield', '🛡️ Получить щит', 'gold')}</div>`;
      case 'boost': return `<div class="hostbar">${btn('boost', '✨ Принять благословение', 'gold')}</div>`;
      case 'peek': return `<div class="hostbar">${btn('peek', '👀 Отправить подсказку', 'gold')}</div>`;
      case 'robin': return `<div class="hostbar">${btn('robin', T.target ? `🏹 Забрать у: ${esc(entName(T.target))}` : '🏹 Ты и так лидер — очки из банка', 'gold')}</div>`;
      case 'tax': return `<div class="slot" id="slot">???</div><div class="hostbar">${btn('tax', '🎰 Крутить', 'gold')}</div>`;
      case 'btruth': return card + yesno('✓ Ответил · без штрафа', `✗ Отказался ${sgn(-p)}`);
      case 'bdare': return card + yesno('✓ Выполнил · без штрафа', `✗ Отказался ${sgn(-p)}`);
      case 'dshot': return task('🥃 Стопку — до дна!') + yesno('✓ Выпил · без штрафа', `✗ Отказался ${sgn(-p)}`);
      case 'dsing': return task('🎤 Остальные выбирают песню — поёшь без музыки!') + `<div class="bigclock" id="cvclock">10</div><div class="hostbar">${btn('sggo', '🎤 Старт 10 сек', 'gold')}</div>` + yesno('✓ Спел · без штрафа', `✗ Отказался ${sgn(-p)}`);
      case 'ddance': return `<div class="bigclock" id="cvclock">20</div><div class="hostbar">${btn('ddgo', '💃 Музыка! 20 секунд', 'gold')}</div>` + yesno('✓ Станцевал · без штрафа', `✗ Отказался ${sgn(-p)}`);
      case 'freeze': return `<div class="hostbar">${btn('freeze', '❄️ Заморозить', 'gold')}</div>`;
      case 'casino': {
        const cap = Math.max((ent(v) || {}).score || 0, p);
        if (T.bet == null) return `<div class="hostbar">${[p, p * 2].filter(x => x < cap).map(x => btn('bet', 'Ставка ' + fmt(x), '', x)).join('')}${btn('bet', 'Ва-банк ' + fmt(cap), 'gold', cap)}${btn('nobet', `Струсить ${sgn(-p)}`, 'bad')}</div>`;
        return `${coinHTML('casino')}<div class="hostbar">${btn('casflip', `Бросить монетку · ставка ${fmt(T.bet)}`, 'gold')}</div>`;
      }
      case 'give': return `<div class="sp-hint">${hasPhone(v) ? '📱 Выбирай на телефоне, кому подарить. Или здесь:' : 'Кому дарим?'}</div><div class="picker">${G.ents.filter(e => e.id !== v).map(e => `<button class="pk" style="--c:${e.color}" data-act="ev" data-v="give" data-id="${esc(e.id)}">${esc(e.name)}</button>`).join('')}</div>`;
      case 'x2': return `<div class="hostbar">${btn('x2', '✖️2 Включить', 'gold')}</div>`;
      case 'swap': return `<div class="slot" id="slot">???</div><div class="hostbar">${btn('swap', '🎲 С кем меняемся?', 'gold')}</div>`;
    }
    return '';
  }
  async function spinSlot(node, gen, final) {
    if (!node) return;
    const t0 = performance.now(); let delay = 45;
    while (performance.now() - t0 < 1900) { node.textContent = gen(); Sound.play('roul'); await sleep(delay); delay *= 1.12; }
    node.textContent = final; node.classList.add('hit'); Sound.play('land'); await sleep(800);
  }
  function trapRes(res, good) {
    const q = G.q, T = q.trap; stopConvince(); discoOff();
    T.done = true; T.res = res; T.step++; changed();
    if (good === true) { Sound.play('correct'); FX.confetti(90); } else if (good === false) { Sound.play('wrong'); flash('bad'); }
  }
  async function evAct(v, ds) {
    const q = G.q; if (G.phase !== 'q' || !q || q.stage !== 'trapev' || busy || !q.trap || q.trap.done) return;
    const T = q.trap, p = q.price, vic = q.victim, ve = ent(vic), ev = T.ev; if (!ve) return;
    const lock = b => { busy = b; $$('#evpanel button').forEach(x => { x.disabled = b; }); };
    const isAngelTask = ['ltruth', 'ldare'].includes(ev);
    switch (v) {
      case 'jackpot':
        lock(true); await spinSlot($('#slot'), () => '+' + fmt(50 * (2 + Math.floor(Math.random() * (jackMax(p) / 50 - 1)))), '+' + fmt(T.amt)); lock(false);
        snap(); addScore(vic, T.amt); FX.rain('💰', 30); return trapRes(`${ve.name}: +${fmt(T.amt)} 💰`, true);
      case 'cvgo': return startConvince(30, false);
      case 'cvc': {
        const s = await ask(`Сколько просит ${ve.name}?`, T.ask || ''); if (s == null) return;
        const x = Math.abs(parseInt(String(s).replace(/[\s−-]/g, ''), 10)); if (!(x > 0)) return toast('Нужно число больше нуля');
        if (G.q !== q || T.done) return;
        T.ask = x; Sound.play('bid'); return changed();
      }
      case 'cvyes': { if (!T.ask) return; snap(); addScore(vic, T.ask); Sound.play('tada'); return trapRes(`Судья растаял: ${sgn(T.ask)} 🥹`, true); }
      case 'cvno': snap(); return trapRes(T.ask ? `Судья непреклонен: ${sgn(T.ask)} не будет 😐` : 'Судья непреклонен 😐');
      case 'sggo': Sound.play('sing'); return startConvince(10, false);
      case 'yes':
        snap(); if (isAngelTask) { addScore(vic, half(p)); return trapRes(`Молодец! ${sgn(half(p))}`, true); }
        return trapRes('Смело! Штрафа нет 😎', true);
      case 'no':
        snap(); if (isAngelTask) return trapRes('Отказ — без штрафа');
        addScore(vic, -p); return trapRes(`Отказ: ${sgn(-p)} 😈`, false);
      case 'shield': snap(); G.sh[vic] = true; Sound.play('angel'); return trapRes(`🛡️ ${ve.name} под защитой`);
      case 'boost': snap(); G.bo[vic] = true; FX.rain('✨', 30); Sound.play('angel'); return trapRes('✨ Следующий верный ответ — ×2');
      case 'peek': {
        snap(); const hint = curD().hint || '';
        if (!q.bribed.includes(vic)) q.bribed.push(vic); q.blog.push({ e: vic, h: !!hint, f: 1 });
        sendPrivate(vic, { k: q.key, hint, cost: 0 }); Sound.play('bribe');
        return trapRes(hint ? '👀 Подсказка ушла на телефон' : '👀 Подсказки нет — судья шепнёт её на ушко');
      }
      case 'robin': {
        snap(); const x = half(p), te = T.target && ent(T.target); if (te) addScore(te.id, -x); addScore(vic, x); Sound.play('bribe'); FX.rain('💰', 20);
        return trapRes(te ? `${ve.name} забирает ${fmt(x)} у ${te.name} 🏹` : `${ve.name}: +${fmt(x)} 🏹`, true);
      }
      case 'tax':
        lock(true); await spinSlot($('#slot'), () => '−' + fmt(50 * (1 + Math.floor(Math.random() * (taxMax(p) / 50)))), '−' + fmt(T.amt)); lock(false);
        snap(); addScore(vic, -T.amt); FX.rain('💸', 30); return trapRes(`${ve.name}: −${fmt(T.amt)} 💸`, false);
      case 'ddgo': discoStart(); return startConvince(20, true, () => discoOff());
      case 'freeze': snap(); G.fz[vic] = 2; Sound.play('freeze'); FX.rain('❄️', 45); return trapRes(`❄️ ${ve.name} заморожен на 2 вопроса`);
      case 'bet': T.bet = +ds.x; T.step++; return changed();
      case 'nobet': snap(); addScore(vic, -p); Sound.play('sad'); return trapRes(`Струсил в казино: ${sgn(-p)} 🐔`, false);
      case 'casflip': {
        lock(true); const win = Math.random() < 0.5; await coinAnim($('#evpanel'), win); lock(false); snap();
        if (win) { addScore(vic, T.bet); FX.rain('💰', 40); } else addScore(vic, -T.bet);
        return trapRes(win ? `Повезло! ${sgn(T.bet)} 🤑` : `Мимо… ${sgn(-T.bet)} 😭`, win);
      }
      case 'give': return giveTo(ds.id);
      case 'x2': snap(); G.x2[vic] = true; Sound.play('select'); return trapRes('Следующий ответ — ×2!');
      case 'swap': {
        const te = ent(T.target); if (!te) return trapRes('Меняться не с кем');
        lock(true); await spinSlot($('#slot'), () => pick(G.ents.filter(e => e.id !== vic)).name, te.name); lock(false);
        snap(); const a = ve.score; ve.score = te.score; te.score = a; Sound.play('swap');
        return trapRes(`${ve.name} ⇄ ${te.name}`);
      }
    }
  }
  function giveTo(to) {
    const q = G.q; if (!q || q.stage !== 'trapev' || !q.trap || q.trap.ev !== 'give' || q.trap.done || busy || !ent(to) || to === q.victim) return;
    snap(); addScore(q.victim, -q.price); addScore(to, q.price); Sound.play('bribe');
    trapRes(`${entName(q.victim)} дарит ${fmt(q.price)} → ${entName(to)} 🎁`);
  }
  function startConvince(sec, quiet, onEnd) {
    stopConvince(); let left = sec; const c0 = $('#cvclock'); if (c0) c0.textContent = left; Sound.play('open');
    cvInt = setInterval(() => {
      left--; const c = $('#cvclock'); if (c) c.textContent = Math.max(0, left);
      if (left > 0) { if (!quiet || left <= 5) Sound.play(left <= 5 ? 'tickFast' : 'tick'); } else { stopConvince(); Sound.play('horn'); if (onEnd) onEnd(); }
    }, 1000);
  }
  function stopConvince() { clearInterval(cvInt); cvInt = null; }
  function setVictim(id) { const q = G.q; if (!q || q.stage !== 'trap' || !ent(id)) return; snap(); q.victim = id; changed(); }
  function trapDone() { const q = G.q; if (!q || q.stage !== 'trapev' || !q.trap.done || busy) return; stopConvince(); discoOff(); q.stage = 'read'; changed(); autoOpen(); }
  function phonePick(eid, k, v) {
    const q = G.q; if (G.phase !== 'q' || !q || q.key !== k) return;
    if (q.stage === 'trapev' && q.trap && q.trap.ev === 'give' && eid === q.victim) return giveTo(v);
    if (q.stage === 'bonus' && q.con && q.con.step === 'pick' && eid === q.con.a) return conPick(v);
  }

  /* ----- бонус-конкурсы (клетки «?») ----- */
  const CONTESTS = [
    { id: 'rps', icon: '✊', name: 'Камень-ножницы-бумага', stake: true, rules: 'Выбор — тайно на телефоне. Победитель получает ставку, проигравший теряет 300. Ничья — переигровка.' },
    { id: 'dance', icon: '💃', name: 'Танцевальный баттл', need: 'dance', pickWord: 'партнёра по баттлу', rules: '30 секунд танцуете вдвоём под музыку, потом остальные голосуют на телефонах. Победителю — по 100 очков за каждый голос.' },
    { id: 'shot', icon: '🥃', name: 'Стопка без рук', need: 'drink', stake: true, rules: 'Руки за спину! Выпить стопку, не касаясь её руками. Каждый, кто справился, получает ставку.' },
    { id: 'sing', icon: '🎤', name: 'Караоке-баттл', need: 'sing', pickWord: 'соперника по караоке', rules: 'Каждый поёт по 20 секунд на заданную тему, потом голосование. Победителю — по 100 очков за голос.' },
    { id: 'tap', icon: '👆', name: 'Тап-баттл', phone: true, stake: true, rules: '10 секунд жмите на кнопку телефона как можно быстрее. Кто больше нажал — получает ставку.' },
    { id: 'react', icon: '⚡', name: 'Дуэль реакции', phone: true, stake: true, rules: 'Экран телефона красный — ждём. Стал зелёным — жми! Кто быстрее, получает ставку. Нажал раньше времени — проиграл.' },
    { id: 'croc', icon: '🐊', name: 'Крокодил', needA: 'act', phoneA: true, solo: true, stake: true, rules: 'Слово пришло тебе на телефон. Покажи его без слов и звуков за 60 секунд! Ставку получат показывающий и тот, кто угадал первым.' },
    { id: 'stare', icon: '👁️', name: 'Гляделки', stake: true, rules: 'Смотрите друг другу в глаза. Кто первым моргнул, засмеялся или отвёл взгляд — проиграл. Победитель получает ставку.' },
  ];
  const CX = Object.fromEntries(CONTESTS.map(c => [c.id, c]));
  const RPS = { r: ['✊', 'Камень'], s: ['✌️', 'Ножницы'], p: ['✋', 'Бумага'] };
  const beats = (x, y) => (x === 'r' && y === 's') || (x === 's' && y === 'p') || (x === 'p' && y === 'r');
  const SING = ['про любовь', 'про лето', 'из мультфильма', 'новогоднюю', 'на английском', 'из 90-х', 'про дружбу', 'про море', 'из кино', 'про город', 'про день рождения', 'про весну', 'со словом «ночь»', 'со словом «небо»'];
  const prefName = k => (PREFS.find(p => p[0] === k) || [])[2] || k;
  const conA = (C, eid) => !!ent(eid) && (!C.need || entPref(eid, C.need)) && (!C.needA || entPref(eid, C.needA)) && (!(C.phone || C.phoneA) || hasPhone(eid));
  const conB = (C, a, eid) => eid !== a && !!ent(eid) && (!C.need || entPref(eid, C.need)) && (!C.phone || hasPhone(eid));
  const conOk = (C, a) => conA(C, a) && (C.solo ? G.ents.length > 1 : G.ents.some(e => conB(C, a, e.id)));
  function conEligibleB(c) { const C = CX[c.id]; return C ? G.ents.filter(e => conB(C, c.a, e.id)) : []; }
  function conAfterSpin(c) { const C = CX[c.id]; return !C ? 'spin' : C.solo ? (C.stake ? 'stake' : 'ready') : 'pick'; }
  function pubCon(c) {
    const C = CX[c.id] || {};
    const o = { id: c.id || null, i: C.icon || '🎁', n: C.name || 'Бонус-конкурс', st: c.step, a: c.a, b: c.b, stake: c.stake || 0 };
    if (c.step === 'pick') { o.el = conEligibleB(c).map(e => e.id); o.pw = C.pickWord || 'соперника'; }
    if (c.step === 'ready' || c.step === 'play') {
      if (c.id === 'rps' && c.ch) { o.ch = { a: c.ch.a ? 1 : 0, b: c.ch.b ? 1 : 0 }; o.rnd = c.rnd || 1; }
      if (c.tot) o.tm = { l: r1(c.tl), r: !!c.tr, tot: c.tot };
      if (c.id === 'sing') { o.turn = c.turn || null; o.theme = c.theme; }
      if (c.id === 'tap' || c.id === 'react') { o.cd = c.cd || 0; o.go = c.go ? 1 : 0; o.gid = c.gid || ''; }
    }
    if (c.step === 'vote') { o.vd = Object.keys(c.votes || {}); o.vs = c.voters || []; }
    if (c.step === 'result' && c.res) { o.res = c.res.text; o.win = c.res.win || null; }
    return o;
  }
  function conInit(q, d) {
    q.stage = 'bonus';
    const a = G.chooser && ent(G.chooser) ? G.chooser : null;
    q.con = { step: a ? 'spin' : 'who', id: null, a, b: null, stake: 0, fixed: d && d.contest && CX[d.contest] ? d.contest : null };
    if (G.ents.length < 2) {
      const w = a || (G.ents[0] && G.ents[0].id);
      q.con.a = w; q.con.step = 'result'; q.con.res = { text: `Бонус для ${entName(w)}!`, win: w, pts: { [w]: q.price } }; addScore(w, q.price);
    }
  }
  function conAuto() {
    const q = G.q, c = q && q.con; if (!c) return; const k = q.key;
    if (c.step === 'spin') setTimeout(() => { if (G.q && G.q.key === k && G.q.con && G.q.con.step === 'spin') conSpin(); }, 900);
    if (c.step === 'stake') setTimeout(() => { if (G.q && G.q.key === k && G.q.con && G.q.con.step === 'stake') conStake(); }, 600);
  }
  function conGo(c, step) {
    c.step = step;
    if (step === 'ready' && c.id === 'croc' && !c.word) { c.word = drawCard('croc'); sendPrivate(c.a, { k: G.q.key, word: c.word }); }
    if (step === 'ready' && c.id === 'sing' && !c.theme) c.theme = pick(SING);
  }
  function conWho(eid) { const q = G.q, c = q && q.con; if (!c || c.step !== 'who' || !ent(eid)) return; snap(); c.a = eid; c.step = 'spin'; changed(); conAuto(); }
  async function conSpin() {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'spin' || busy) return;
    const list = CONTESTS.filter(x => conOk(x, c.a));
    if (!list.length) { // никому не подходит ни один конкурс — просто дарим очки
      snap(); return conFinish({ [c.a]: q.price }, c.a, `Бонус для ${entName(c.a)}!`);
    }
    // все конкурсы по кругу с равными шансами: сначала те, что ещё не выпадали, и никогда — тот же два раза подряд
    const used = G.cu || [], fresh = list.filter(x => !used.includes(x.id)), notLast = list.filter(x => x.id !== used[used.length - 1]);
    const C = list.find(x => x.id === FORCE.con) || list.find(x => x.id === c.fixed) || pick(fresh.length ? fresh : notLast.length ? notLast : list);
    busy = true; snap(); c.id = C.id; G.cu = (fresh.length ? used : []).concat(C.id); publish();
    $$('#stage .hostbar button').forEach(b => { b.disabled = true; });
    try { const box = $('#roul'); if (box) await roulette(box, list, C, 'bonus'); } finally { busy = false; }
    if (G.q !== q) return;
    conGo(c, conAfterSpin(c)); changed(); conAuto();
  }
  function conPick(eid) {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'pick' || busy) return;
    const C = CX[c.id]; if (!C || !conB(C, c.a, eid)) return;
    snap(); c.b = eid; Sound.play('whoosh'); conGo(c, C.stake ? 'stake' : 'ready'); changed(); conAuto();
  }
  async function conStake() {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'stake' || busy) return;
    busy = true; snap();
    const gen = () => 100 * (2 + Math.floor(Math.random() * 9)); // от 200 до 1000
    c.stake = FORCE.stake || gen(); publish();
    try { await spinSlot($('#slot'), () => fmt(gen()), fmt(c.stake)); } finally { busy = false; }
    if (G.q !== q) return;
    conGo(c, 'ready'); changed();
  }
  function conStart() {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'ready' || busy) return;
    snap(); c.step = 'play'; c.tot = 0; c.tl = 0; c.tr = false;
    switch (c.id) {
      case 'rps': c.ch = { a: null, b: null }; c.rnd = c.rnd || 1; Sound.play('open'); break;
      case 'dance': conTimer(30, () => conToVote()); discoStart(); break;
      case 'sing': c.turn = 'a'; conTimer(20, () => conSingNext()); Sound.play('open'); break;
      case 'shot': c.ok = { a: null, b: null }; conTimer(30, null); Sound.play('roll'); break;
      case 'tap': c.taps = { a: 0, b: 0 }; c.fin = { a: false, b: false }; c.go = false; c.gid = Net.id(); changed(); return conCountdown(() => conTapGo());
      case 'react': return conReactRound();
      case 'croc': c.guess = null; conTimer(60, null); Sound.play('open'); break;
      case 'stare': c.t0 = Date.now(); heartOn(); Sound.play('open'); break;
    }
    changed();
  }
  let conOnEnd = null;
  function conTimer(sec, onEnd) {
    const c = G.q.con; c.tot = sec; c.tl = sec; c.tr = true; conOnEnd = onEnd;
    cLast = performance.now(); cSec = sec; clearInterval(cInt); cInt = setInterval(cTick, 100);
  }
  function cTick() {
    const q = G.q, c = q && q.con; if (!c || !c.tr) { clearInterval(cInt); cInt = null; return; }
    const now = performance.now(); c.tl = Math.max(0, c.tl - (now - cLast) / 1000); cLast = now;
    const s = Math.ceil(c.tl); if (s !== cSec) { cSec = s; if (s > 0 && s <= 5 && !discoOn) Sound.play('tickFast'); }
    updCon();
    if (c.tl <= 0) { c.tr = false; clearInterval(cInt); cInt = null; const f = conOnEnd; conOnEnd = null; if (f) f(); else { Sound.play('horn'); save(); publish(); updCon(); } }
  }
  function conPause() {
    const c = G.q && G.q.con; if (!c || c.step !== 'play' || !c.tot || c.tl <= 0) return;
    if (c.tr) { c.tr = false; clearInterval(cInt); cInt = null; if (discoOn) discoMusic(false); }
    else { c.tr = true; cLast = performance.now(); clearInterval(cInt); cInt = setInterval(cTick, 100); if (discoOn) discoMusic(true); else if (c.id === 'dance') discoStart(); }
    publish(); updCon();
  }
  function conHalt() {
    clearInterval(cInt); cInt = null; conOnEnd = null; clearTimeout(reactT); clearTimeout(tapEndT); heartOff(); discoOff();
    const c = G && G.q && G.q.con; if (c) c.tr = false;
  }
  function conFinish(pts, win, text) {
    const q = G.q, c = q && q.con; if (!c) return;
    conHalt();
    for (const id in pts) if (pts[id] && ent(id)) addScore(id, pts[id]);
    c.res = { text, win: win || null, pts }; c.step = 'result';
    if (win && ent(win)) G.chooser = win;
    Sound.play('win'); FX.confetti(170);
    changed();
    const card = win && $(`#scores .ent[data-id="${CSS.escape(win)}"]`); if (card) { const r = card.getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top, ent(win).color, 60); }
  }
  function conToVote() {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'play') return;
    conHalt(); c.step = 'vote'; c.votes = {};
    c.voters = Object.keys(G.phones).filter(pid => { const p = G.phones[pid]; return p.ent && ent(p.ent) && p.ent !== c.a && p.ent !== c.b && Date.now() - p.seen < 35000; });
    Sound.play('round'); changed();
  }
  function conSingNext() {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'play' || c.id !== 'sing') return;
    if (c.turn === 'a') { c.turn = 'b'; Sound.play('whoosh'); conTimer(20, () => conSingNext()); changed(); } else conToVote();
  }
  function conVote(pid, eid, k, v) {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'vote' || q.key !== k || !['a', 'b'].includes(v) || !(c.voters || []).includes(pid) || c.votes[pid]) return;
    c.votes[pid] = v; Sound.play('vote'); save(); publish(); updCon();
    if (Object.keys(c.votes).length >= c.voters.length) setTimeout(() => { if (G.q === q && c.step === 'vote') conCount(); }, 700);
  }
  function conCount(manual) {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'vote' || busy) return;
    snap();
    if (manual) { // голосовать некому — решает ведущий
      if (manual === 'tie') return conFinish({ [c.a]: 300, [c.b]: 300 }, null, 'Ничья! Каждому по 300');
      const w = manual === 'a' ? c.a : c.b; return conFinish({ [w]: 300 }, w, `${entName(w)} побеждает!`);
    }
    const vals = Object.values(c.votes), va = vals.filter(x => x === 'a').length, vb = vals.length - va;
    if (va === vb) return conFinish({ [c.a]: 100 * va, [c.b]: 100 * vb }, null, va ? `Ничья ${va} : ${vb}! Каждому по ${fmt(100 * va)}` : 'Голосов нет — ничья, без очков');
    const w = va > vb ? c.a : c.b, n = Math.max(va, vb);
    conFinish({ [w]: 100 * n }, w, `${entName(w)} побеждает со счётом ${n} : ${Math.min(va, vb)}!`);
  }
  function conRps(eid, k, v, host) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'rps' || c.step !== 'play' || busy || !c.ch || (!host && q.key !== k) || !RPS[v]) return;
    const s = eid === c.a ? 'a' : eid === c.b ? 'b' : null; if (!s || c.ch[s]) return;
    c.ch[s] = v; Sound.play('bid');
    if (c.ch.a && c.ch.b) rpsReveal(); else { save(); publish(); updCon(); }
  }
  async function rpsReveal() {
    const q = G.q, c = q.con; busy = true; save(); publish();
    try {
      for (const w of ['Камень…', 'Ножницы…', 'Бумага…', 'Раз-два-три!']) {
        const t = $('#rpscall'); if (t) { t.textContent = w; t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); }
        Sound.play('clap'); await sleep(520);
      }
      ['a', 'b'].forEach(s => { const card = $(`#rps-${s}`); if (card) { card.innerHTML = `<span>${RPS[c.ch[s]][0]}</span><b>${RPS[c.ch[s]][1]}</b>`; card.classList.add('show'); } });
      Sound.play('land'); await sleep(1300);
    } finally { busy = false; }
    if (G.q !== q || c.step !== 'play') return;
    const A = c.ch.a, B = c.ch.b;
    if (A === B) { toast('Ничья! Переигровка'); Sound.play('swap'); c.rnd = (c.rnd || 1) + 1; c.ch = { a: null, b: null }; return changed(); }
    const aw = beats(A, B), w = aw ? c.a : c.b, l = aw ? c.b : c.a, wv = aw ? A : B, lv = aw ? B : A;
    snap(); conFinish({ [w]: c.stake, [l]: -300 }, w, `${entName(w)} побеждает: ${RPS[wv][1].toLowerCase()} бьёт ${RPS[lv][1].toLowerCase()}!`);
  }
  function conShot(side, ok) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'shot' || c.step !== 'play' || !c.ok || !['a', 'b'].includes(side)) return;
    c.ok[side] = !!ok; Sound.play(ok ? 'correct' : 'wrong');
    if (c.ok.a == null || c.ok.b == null) { save(); publish(); updCon(); return; }
    snap();
    const pts = {}; if (c.ok.a) pts[c.a] = c.stake; if (c.ok.b) pts[c.b] = c.stake;
    const both = c.ok.a && c.ok.b, one = c.ok.a ? c.a : c.ok.b ? c.b : null;
    conFinish(pts, both ? null : one, both ? 'Оба справились! 🥃' : one ? `${entName(one)} справляется! 🥃` : 'Никто не справился — без очков');
  }
  function conCountdown(then) {
    const q = G.q, c = q.con, k = q.key; let n = 3;
    const stepF = () => {
      if (!G.q || G.q.key !== k || c.step !== 'play') return;
      if (n > 0) { c.cd = n; Sound.play('beep'); publishNow(); updCon(); n--; reactT = setTimeout(stepF, 900); } else { c.cd = 0; then(); }
    };
    stepF();
  }
  function conTapGo() {
    const q = G.q, c = q.con, k = q.key; c.go = true; Sound.play('go'); publishNow(); updCon();
    tapEndT = setTimeout(() => { if (G.q && G.q.key === k) conTapEnd(); }, 15000); // запас: телефоны сами считают 10 секунд
  }
  function conTap(eid, k, n, g, fin) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'tap' || c.step !== 'play' || !c.go || q.key !== k || g !== c.gid) return;
    const s = eid === c.a ? 'a' : eid === c.b ? 'b' : null; if (!s || c.fin[s]) return;
    c.taps[s] = Math.max(c.taps[s], Math.min(300, Math.floor(+n) || 0));
    if (fin) c.fin[s] = true;
    updCon();
    if (c.fin.a && c.fin.b) conTapEnd();
  }
  function conTapEnd() {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'tap' || c.step !== 'play' || !c.go) return;
    clearTimeout(tapEndT); c.go = false; snap();
    const A = c.taps.a, B = c.taps.b;
    if (A === B) return conFinish({ [c.a]: half(c.stake), [c.b]: half(c.stake) }, null, `Ничья ${A} : ${B}! Каждому по ${fmt(half(c.stake))}`);
    const w = A > B ? c.a : c.b;
    conFinish({ [w]: c.stake }, w, `${entName(w)} быстрее: ${Math.max(A, B)} : ${Math.min(A, B)} нажатий!`);
  }
  function conReactRound() {
    const q = G.q, c = q.con, k = q.key;
    c.go = false; c.gid = Net.id(); c.rt = { a: null, b: null }; changed(); publishNow();
    clearTimeout(reactT);
    reactT = setTimeout(() => {
      if (!G.q || G.q.key !== k || c.step !== 'play') return;
      c.go = true; Sound.play('go'); publishNow(); updCon();
      reactT = setTimeout(() => { if (G.q && G.q.key === k) conReactEnd(); }, 7000);
    }, 2600 + Math.random() * 3000);
  }
  function conReact(eid, k, ms, g) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'react' || c.step !== 'play' || q.key !== k || g !== c.gid || !c.rt) return;
    const s = eid === c.a ? 'a' : eid === c.b ? 'b' : null; if (!s || c.rt[s] != null) return;
    ms = Math.round(+ms); c.rt[s] = ms >= 0 && ms < 10000 && c.go ? ms : -1;
    Sound.play(c.rt[s] < 0 ? 'wrong' : 'bid'); updCon();
    const o = s === 'a' ? 'b' : 'a';
    if (c.rt[s] < 0 && c.rt[o] == null) return conReactEnd(); // фальстарт — соперник побеждает сразу
    if (c.rt.a != null && c.rt.b != null) conReactEnd();
  }
  function conReactEnd(force) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'react' || c.step !== 'play' || !c.rt) return;
    clearTimeout(reactT);
    const A = c.rt.a, B = c.rt.b, fa = A != null && A < 0, fb = B != null && B < 0;
    if (force && ((fa && fb) || (A == null && B == null))) { snap(); return conFinish({}, null, 'Дуэль не состоялась — без очков'); }
    if ((fa && fb) || (A == null && B == null)) { toast(fa ? 'Оба нажали раньше времени — ещё раз!' : 'Никто не нажал — ещё раз!'); return conReactRound(); }
    const ws = (fa || A == null) ? 'b' : (fb || B == null) ? 'a' : (A <= B ? 'a' : 'b');
    const w = c[ws], wt = c.rt[ws], other = ws === 'a' ? fb : fa;
    snap(); conFinish({ [w]: c.stake }, w, `${entName(w)} быстрее${wt > 0 ? `: ${wt} мс` : ''}${other ? ' — соперник нажал раньше времени' : ''}!`);
  }
  function conGuess(eid) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'croc' || c.step !== 'play' || !ent(eid) || eid === c.a) return;
    snap(); conFinish({ [c.a]: c.stake, [eid]: c.stake }, eid, `${entName(eid)} угадывает «${c.word}»! Очки — обоим`);
  }
  function conNone() {
    const q = G.q, c = q && q.con; if (!c || c.step !== 'play' || !['croc', 'shot'].includes(c.id)) return;
    snap(); conFinish({}, null, c.id === 'croc' ? `Никто не угадал. Слово было: «${c.word}»` : 'Без очков');
  }
  function conWord() {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'croc' || !['ready', 'play'].includes(c.step)) return;
    c.word = drawCard('croc'); sendPrivate(c.a, { k: q.key, word: c.word }); save(); publishHost(false); toast('🔄 Новое слово ушло на телефон');
  }
  function conStare(loser) {
    const q = G.q, c = q && q.con; if (!c || c.id !== 'stare' || c.step !== 'play' || !['a', 'b'].includes(loser)) return;
    const w = loser === 'a' ? c.b : c.a; snap();
    conFinish({ [w]: c.stake }, w, `${entName(loser === 'a' ? c.a : c.b)} моргает — ${entName(w)} побеждает!`);
  }
  function conSpace() {
    const c = G.q && G.q.con; if (!c) return;
    if (c.step === 'spin') return conSpin();
    if (c.step === 'stake') return conStake();
    if (c.step === 'ready') return conStart();
    if (c.step === 'play') return conPause();
  }
  function conNext() {
    const c = G.q && G.q.con; if (!c) return;
    if (['spin', 'stake', 'ready'].includes(c.step)) return conSpace();
    if (c.step === 'play') {
      if (c.id === 'dance') return conToVote(); if (c.id === 'sing') return conSingNext(); if (c.id === 'tap') return conTapEnd();
      if (c.id === 'react') return conReactEnd(true);
      if (c.id === 'rps' && !c.mini) { c.mini = true; curSig = null; return render(); } // телефон отвалился — ведущий вводит выбор сам
    }
    if (c.step === 'vote') { if (c.voters && c.voters.length) conCount(); return; }
    if (c.step === 'result') return backToBoard();
  }
  // экран конкурса
  const nmB = e => (e ? `<b style="color:${e.color}">${esc(e.name)}</b>` : '—');
  function vsHTML(c, extra) {
    const A = ent(c.a), B = ent(c.b), C = CX[c.id] || {};
    const card = (e, s) => `<div class="vp" style="--c:${e ? e.color : '#888'}"><div class="vn">${esc(e ? e.name : '—')}</div>${extra ? extra(s) : ''}</div>`;
    if (C.solo || !c.b) return `<div class="vs solo">${card(A, 'a')}</div>`;
    return `<div class="vs">${card(A, 'a')}<div class="vx">VS</div>${card(B, 'b')}</div>`;
  }
  function vCon(q) {
    const c = q.con, C = CX[c.id] || {}, A = ent(c.a);
    const head = `<div class="con-head"><span class="con-ic">${C.icon || '🎁'}</span><span class="con-n">${esc(C.name || 'Бонус-конкурс')}</span>${c.stake ? `<span class="con-st">ставка ${fmt(c.stake)}</span>` : ''}</div>`;
    const B2 = (a, label, cls, k, extra) => `<button class="btn ${cls || ''}" data-act="${a}"${extra || ''}>${label}${k ? `<kbd>${k}</kbd>` : ''}</button>`;
    switch (c.step) {
      case 'who': return el(`<div class="special con"><div class="sp-title bonus">🎁 Бонус!</div><div class="sp-hint">Кто открыл эту клетку?</div>${pickerHTML(G.ents, 'cwho')}</div>`);
      case 'spin': {
        const list = CONTESTS.filter(x => conOk(x, c.a));
        return el(`<div class="special con"><div class="sp-title bonus">🎁 Бонус-конкурс</div><div class="sp-info">Играет ${nmB(A)}</div>
          <div class="roul bonus" id="roul"><div class="rframe"></div><div class="rstrip" style="transform:translateX(-28rem)">${cardsHTML(list.length ? list : CONTESTS, 9)}</div></div>
          <div class="hostbar">${B2('cspin', '🎰 Крутить', 'gold', 'Пробел')}</div></div>`);
      }
      case 'pick': {
        const list = conEligibleB(c), ph = hasPhone(c.a);
        return el(`<div class="special con">${head}<div class="sp-info">${nmB(A)}, выбери ${esc(C.pickWord || 'соперника')}${ph ? ' на телефоне 📱' : ''}</div>
          <div class="sp-hint">${C.need ? `Выбрать можно только тех, кто в тесте отметил «${prefName(C.need)}»` : C.phone ? 'Только те, у кого телефон на связи' : 'Выбирай любого'}</div>${pickerHTML(list, 'cpick')}</div>`);
      }
      case 'stake': return el(`<div class="special con">${head}${vsHTML(c)}<div class="sp-hint">Разыгрываем ставку…</div><div class="slot" id="slot">???</div></div>`);
      case 'ready': return el(`<div class="special con">${head}${vsHTML(c)}<div class="con-rules">${esc(C.rules || '')}</div>
        ${c.id === 'sing' ? `<div class="sp-info">Тема песни: <b>${esc(c.theme || '')}</b></div>` : ''}${c.id === 'croc' ? '<div class="sp-hint">🤫 Слово пришло на телефон показывающему и на пульт ведущего</div>' : ''}
        <div class="hostbar">${c.id === 'croc' ? B2('cword', '🔄 Другое слово') : ''}${B2('cstart', '▶ Начать', 'gold big', 'Пробел')}</div></div>`);
      case 'play': return vConPlay(q, c, C, head, B2);
      case 'vote': {
        const n = (c.voters || []).length;
        return el(`<div class="special con">${head}${vsHTML(c)}<div class="sp-title sm">🗳 Голосуем!</div>
          ${n ? '<div class="sp-hint">Кто был лучше? Голосуйте на телефонах</div><div class="votes" id="vcount"></div>' : '<div class="sp-hint">Голосовать некому — решает ведущий</div>'}
          <div class="hostbar">${n ? B2('ccount', 'Подсчитать голоса ▶', 'gold', '→') : B2('cwin', `Победил(а) ${esc(entName(c.a))}`, 'ok', '', ' data-v="a"') + B2('cwin', 'Ничья', '', '', ' data-v="tie"') + B2('cwin', `Победил(а) ${esc(entName(c.b))}`, 'ok', '', ' data-v="b"')}</div></div>`);
      }
      case 'result': {
        const pts = (c.res && c.res.pts) || {};
        const rows = Object.keys(pts).filter(id => pts[id] && ent(id)).map(id => `<div class="cp ${pts[id] > 0 ? 'pos' : 'neg'}" style="--c:${ent(id).color}">${esc(entName(id))} <b>${sgn(pts[id])}</b></div>`).join('');
        return el(`<div class="special con">${head}<div class="con-res">🏆 ${esc(c.res ? c.res.text : '')}</div><div class="con-pts">${rows}</div><div class="hostbar">${B2('board', 'К табло ▶', 'gold', '→')}</div></div>`);
      }
    }
    return el('<div></div>');
  }
  function vConPlay(q, c, C, head, B2) {
    const A = ent(c.a), B = ent(c.b), clock = '<div class="bigclock" id="ctime"></div>';
    const pause = B2('cpause', '⏯ Пауза', '', 'Пробел');
    switch (c.id) {
      case 'rps': {
        const side = s => { const e = s === 'a' ? A : B, mini = e && (c.mini || !hasPhone(e.id)) && !(c.ch && c.ch[s]) ? `<div class="mini">${Object.keys(RPS).map(k => `<button data-act="crps" data-side="${s}" data-v="${k}">${RPS[k][0]}</button>`).join('')}</div>` : '';
          return `<div class="rpsp" style="--c:${e ? e.color : '#888'}"><div class="vn">${esc(e ? e.name : '—')}</div><div class="rpscard" id="rps-${s}"><span>?</span></div><div class="rpsst" id="rpsst-${s}"></div>${mini}</div>`; };
        return el(`<div class="special con">${head}${c.rnd > 1 ? `<div class="sp-hint">Переигровка №${c.rnd - 1}</div>` : ''}<div class="rps" id="rpsbox">${side('a')}<div class="rpscall" id="rpscall">Выбирайте на телефонах!</div>${side('b')}</div>
          ${c.mini ? '' : `<div class="hostbar">${B2('cnext', 'Ввести выбор за игрока', '', '→')}</div>`}</div>`);
      }
      case 'dance': return el(`<div class="special con dance">${head}${vsHTML(c)}<div class="sp-title sm glow">💃 ТАНЦУЮТ! 🕺</div>${clock}<div class="hostbar">${pause}${B2('cnext', 'Стоп — к голосованию ▶', 'gold', '→')}</div></div>`);
      case 'sing': {
        const e = c.turn === 'b' ? B : A;
        return el(`<div class="special con sing">${head}<div class="mic">🎤</div><div class="sp-info">Поёт: ${nmB(e)}</div><div class="sp-hint">Тема: <b>${esc(c.theme || '')}</b></div>${clock}
          <div class="hostbar">${pause}${B2('cnext', c.turn === 'b' ? 'К голосованию ▶' : `Поёт ${esc(B ? B.name : '')} ▶`, 'gold', '→')}</div></div>`);
      }
      case 'shot': {
        const ex = s => `<div class="shotb" id="shot-${s}"><button class="btn ok" data-act="cshot" data-side="${s}" data-v="1">✓ Выпил</button><button class="btn bad" data-act="cshot" data-side="${s}" data-v="0">✗ Не смог</button></div>`;
        return el(`<div class="special con">${head}<div class="sp-title sm">🙌 Руки за спину!</div>${vsHTML(c, ex)}${clock}</div>`);
      }
      case 'tap': {
        const bar = s => `<div class="tapb"><div class="tapf" id="tapf-${s}"></div><div class="tapn" id="tapn-${s}">0</div></div>`;
        return el(`<div class="special con">${head}<div class="cd" id="ccd"></div>${vsHTML(c, bar)}<div class="hostbar">${B2('cnext', 'Закончить ▶', '', '→')}</div></div>`);
      }
      case 'react': {
        const st = s => `<div class="rst" id="rst-${s}">ждёт…</div>`;
        return el(`<div class="special con">${head}<div class="react-call" id="rcall">Смотрите на телефоны! Ждите зелёного…</div>${vsHTML(c, st)}<div class="hostbar">${B2('cnext', 'Закончить ▶', '', '→')}</div></div>`);
      }
      case 'croc': {
        const others = G.ents.filter(e => e.id !== c.a);
        return el(`<div class="special con">${head}<div class="sp-info">${nmB(A)} показывает слово без слов</div>${clock}<div class="sp-hint">Кто угадал первым?</div>${pickerHTML(others, 'cguess')}
          <div class="hostbar">${pause}${B2('cword', '🔄 Другое слово')}${B2('cnone', 'Никто не угадал', 'bad')}</div></div>`);
      }
      case 'stare': {
        const eye = s => `<div class="eyes">👁️👁️</div><button class="btn bad" data-act="cstare" data-v="${s}">😑 Моргнул(а)</button>`;
        return el(`<div class="special con stare">${head}<div class="sp-title sm">👀 Не моргать!</div>${vsHTML(c, eye)}<div class="bigclock up" id="ctime"></div></div>`);
      }
    }
    return el('<div></div>');
  }
  function updCon() {
    const q = G.q, c = q && q.con; if (!c) return;
    const t = $('#ctime');
    if (t) {
      if (c.id === 'stare' && c.step === 'play') { const s = Math.floor((Date.now() - (c.t0 || Date.now())) / 1000); t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
      else if (c.tot) { t.textContent = Math.ceil(c.tl); t.classList.toggle('low', c.tl <= 5); t.classList.toggle('paused', !c.tr && c.tl > 0); }
      else t.textContent = '';
    }
    if (c.step === 'play' && c.id === 'rps' && c.ch) ['a', 'b'].forEach(s => { const n = $(`#rpsst-${s}`); if (n) n.textContent = c.ch[s] ? '✔ выбор сделан' : '…думает'; });
    if (c.step === 'play' && c.id === 'shot' && c.ok) ['a', 'b'].forEach(s => { const n = $(`#shot-${s}`); if (n && c.ok[s] != null && !n.dataset.done) { n.dataset.done = 1; n.innerHTML = `<div class="evres sm">${c.ok[s] ? '✓ Выпил!' : '✗ Не смог'}</div>`; } });
    if (c.step === 'play' && c.id === 'tap' && c.taps) {
      const mx = Math.max(30, c.taps.a, c.taps.b);
      ['a', 'b'].forEach(s => { const f = $(`#tapf-${s}`), n = $(`#tapn-${s}`); if (f) f.style.transform = `scaleY(${c.taps[s] / mx})`; if (n) n.textContent = c.taps[s]; });
      const cd = $('#ccd'); if (cd) { const h = c.cd ? String(c.cd) : c.go ? 'ЖМИ!' : ''; if (cd.dataset.h !== h) { cd.dataset.h = h; cd.textContent = h; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop'); } }
    }
    if (c.step === 'play' && c.id === 'react' && c.rt) {
      ['a', 'b'].forEach(s => { const n = $(`#rst-${s}`); if (n) { const v = c.rt[s]; n.textContent = v == null ? (c.go ? '…' : 'ждёт…') : v < 0 ? '❌ рано!' : `⚡ ${v} мс`; } });
      const rc = $('#rcall'); if (rc) { rc.textContent = c.go ? 'ЖМИ!' : 'Смотрите на телефоны! Ждите зелёного…'; rc.classList.toggle('go', !!c.go); }
    }
    if (c.step === 'vote') { const v = $('#vcount'); if (v) v.textContent = `Проголосовали: ${Object.keys(c.votes || {}).length} из ${(c.voters || []).length}`; }
  }
  setInterval(() => { const c = G && G.phase === 'q' && G.q && G.q.con; if (c && c.id === 'stare' && c.step === 'play') updCon(); }, 500);
  function heartOn() { heartOff(); heartT = setInterval(() => Sound.play('heart'), 860); }
  function heartOff() { clearInterval(heartT); heartT = null; }

  /* ----- танцпол: огни на экране и на телефонах, музыка ----- */
  let djEl = null;
  function discoStart() {
    discoOn = true; document.body.classList.add('disco');
    if (!$('#disco')) document.body.insertBefore(el(`<div id="disco">${[1, 2, 3, 4, 5].map(i => `<div class="dz-beam c${i}"></div>`).join('')}<div class="dz-spot s1"></div><div class="dz-spot s2"></div><div class="dz-spot s3"></div><div class="dz-ball"></div><div class="dz-floor">${'<i></i>'.repeat(24)}</div></div>`), $('#app'));
    discoMusic(true); publishNow();
  }
  function discoOff() {
    if (!discoOn) return;
    discoOn = false; document.body.classList.remove('disco');
    const d = $('#disco'); if (d) d.remove();
    discoMusic(false); publish();
  }
  async function discoMusic(on) {
    if (!on) { Sound.beat(false); if (djEl) { djEl.pause(); djEl = null; } return; }
    const songs = (PACK.danceSongs || []).filter(Boolean);
    if (!songs.length) return Sound.beat(true);
    const url = await mediaUrl(pick(songs)); if (!discoOn) return;
    if (djEl) djEl.pause();
    const a = djEl = new Audio(url); a.loop = true; a.muted = Sound.muted;
    const fallback = () => { if (djEl === a) { djEl = null; if (discoOn) Sound.beat(true); } };
    a.addEventListener('error', fallback);
    a.play().catch(fallback);
  }

  /* ----- музыка и видео в вопросах ----- */
  const MEDIA = { dir: null, perm: '', files: null, urls: {}, check: null, tok: null };
  function idb(mode, f) {
    return new Promise(res => {
      try {
        const r = indexedDB.open('svoyaigra', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { try { const tx = r.result.transaction('kv', mode), rq = f(tx.objectStore('kv')); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } };
        r.onerror = () => res(null);
      } catch (e) { res(null); }
    });
  }
  async function mediaInit() {
    const h = await idb('readonly', s => s.get('mdir'));
    if (h && h.queryPermission) { MEDIA.dir = h; try { MEDIA.perm = await h.queryPermission({ mode: 'read' }); } catch (e) { MEDIA.perm = 'denied'; } }
    mediaCheck();
  }
  async function mediaPermit() {
    if (!MEDIA.dir) return false;
    if (MEDIA.perm !== 'granted') { try { MEDIA.perm = await MEDIA.dir.requestPermission({ mode: 'read' }); } catch (e) { /* без нажатия не спросить */ } }
    return MEDIA.perm === 'granted';
  }
  async function pickMediaDir() {
    if (window.showDirectoryPicker) {
      try {
        const h = await window.showDirectoryPicker({ id: 'svoyaigra-media', mode: 'read' });
        MEDIA.dir = h; MEDIA.perm = 'granted'; MEDIA.files = null; MEDIA.urls = {};
        idb('readwrite', s => s.put(h, 'mdir')); toast(`📁 Папка «${h.name}» подключена`); mediaCheck();
      } catch (e) { if (!e || e.name !== 'AbortError') toast('Не получилось открыть папку'); }
      return;
    }
    const inp = el('<input type="file" webkitdirectory multiple style="display:none">');
    inp.addEventListener('change', () => {
      const m = new Map();
      Array.from(inp.files).forEach(f => { const parts = (f.webkitRelativePath || f.name).split('/'); m.set(parts.join('/'), f); if (parts.length > 1) m.set(parts.slice(1).join('/'), f); if (!m.has(f.name)) m.set(f.name, f); });
      MEDIA.files = m; MEDIA.dir = null; MEDIA.urls = {}; toast(`📁 Подключено файлов: ${inp.files.length}`); inp.remove(); mediaCheck();
    });
    document.body.appendChild(inp); inp.click();
  }
  async function fileFor(rel) {
    const parts = rel.split('/').filter(Boolean), base = parts[parts.length - 1];
    if (MEDIA.files) return MEDIA.files.get(rel) || MEDIA.files.get(parts.slice(1).join('/')) || MEDIA.files.get(base) || null;
    if (!MEDIA.dir || MEDIA.perm !== 'granted') return null;
    const seen = new Set(), tries = [parts, parts.slice(1), parts.slice(2), [base]].filter(p => p.length && !seen.has(p.join('/')) && seen.add(p.join('/')));
    for (const p of tries) {
      try { let d = MEDIA.dir; for (const seg of p.slice(0, -1)) d = await d.getDirectoryHandle(seg); return await (await d.getFileHandle(p[p.length - 1])).getFile(); } catch (e) { /* пробуем дальше */ }
    }
    return null;
  }
  async function mediaUrl(path) {
    if (!path) return '';
    if (/^(https?:|blob:|data:)/i.test(path)) return path;
    const rel = String(path).replace(/^\.?\//, '');
    if (MEDIA.urls[rel]) return MEDIA.urls[rel];
    const f = await fileFor(rel);
    return f ? (MEDIA.urls[rel] = URL.createObjectURL(f)) : rel;
  }
  const mediaList = () => {
    const s = new Set();
    PACK.rounds.forEach(r => (r.themes || []).forEach(th => (th.questions || []).forEach(x => { if (x.audio) s.add(x.audio); if (x.video) s.add(x.video); })));
    (PACK.danceSongs || []).forEach(x => { if (x) s.add(x); });
    return Array.from(s);
  };
  async function mediaCheck() {
    const list = mediaList(), tok = MEDIA.tok = {};
    if (!list.length) { MEDIA.check = null; return; }
    const local = MEDIA.files || (MEDIA.dir && MEDIA.perm === 'granted'), web = /^https?:$/.test(location.protocol);
    if (!local && !web) { MEDIA.check = null; if (G.phase === 'lobby') updLobby(); return; }
    MEDIA.check = { busy: true }; if (G.phase === 'lobby') updLobby();
    const res = { busy: false, found: 0, total: list.length, miss: [] };
    for (const p of list) {
      const rel = String(p).replace(/^\.?\//, '');
      let ok = local ? !!(await fileFor(rel)) : false;
      if (!ok && web) { try { const r = await fetch(rel, { method: 'HEAD', cache: 'no-store' }); ok = r.ok; } catch (e) { ok = false; } }
      if (MEDIA.tok !== tok) return;
      if (ok) res.found++; else res.miss.push(p);
    }
    MEDIA.check = res; if (G.phase === 'lobby') updLobby();
  }
  function mediaStatus() {
    if (!mediaList().length) return '';
    if (MEDIA.dir && MEDIA.perm !== 'granted') return `📁 «${esc(MEDIA.dir.name)}» — <a data-act="mperm">нажми, чтобы разрешить доступ</a>`;
    const src = MEDIA.files ? 'из выбранной папки' : MEDIA.dir ? `из папки «${esc(MEDIA.dir.name)}»` : 'с сайта (папка media)';
    const c = MEDIA.check;
    if (!c) return 'Файлы берутся из папки media рядом с игрой';
    if (c.busy) return 'Проверяю файлы…';
    return `${c.found === c.total ? '✅' : '⚠️'} Музыка и видео: найдено ${c.found} из ${c.total} ${src}${c.miss.length ? ' · <a data-act="mmiss">каких нет?</a>' : ''}`;
  }
  function showMissing() {
    const c = MEDIA.check; if (!c || !c.miss) return;
    const m = modal(`<div class="mt">Не хватает файлов: ${c.miss.length}</div><div class="mtxt">Положи их в папку media (на сайте или у себя на компьютере) и нажми «📁 Папка с музыкой и видео». Полный список с подсказками — в файле media/СПИСОК.md.</div><div class="mlist">${c.miss.map(x => `<div>${esc(x)}</div>`).join('')}</div><div class="mb"><button class="btn gold" data-m="ok">Понятно</button></div>`);
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-m]')) m.remove(); });
  }
  async function mediaPrep(q, d) {
    mediaStop();
    const kind = d.video ? 'video' : 'audio', path = d.video || d.audio;
    const m = MP = { key: q.key, kind, path, el: null, err: false, started: false, an: null, buf: null, raf: 0 };
    await mediaPermit();
    const url = await mediaUrl(path);
    if (MP !== m) return;
    const e = document.createElement(kind);
    e.preload = 'auto'; e.playsInline = true; e.muted = Sound.muted;
    if (kind === 'video') e.className = 'qvideo';
    e.addEventListener('error', () => { if (MP === m) { m.err = true; mediaUI(); } });
    e.addEventListener('play', () => { if (MP === m) mediaUI(); });
    e.addEventListener('pause', () => { if (MP === m) mediaUI(); });
    const st = +d.start || 0, en = +d.end || 0;
    if (st) e.addEventListener('loadedmetadata', () => { try { e.currentTime = st; } catch (err) { /* ничего */ } }, { once: true });
    m.stopAt = en || 0;
    e.addEventListener('timeupdate', () => { if (m.stopAt && e.currentTime >= m.stopAt) e.pause(); });
    e.src = url; m.el = e;
    if (kind === 'audio' && (url.startsWith('blob:') || /^https?:$/.test(location.protocol))) {
      try { const ctx = Sound.ctx(); if (ctx) { const s = ctx.createMediaElementSource(e), an = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.6; s.connect(an); an.connect(Sound.out()); m.src = s; m.an = an; m.buf = new Uint8Array(an.frequencyBinCount); } } catch (err) { m.an = null; }
    }
    if (q.stage === 'open' && q.tr) mediaPlay(); // файл догрузился, когда таймер уже идёт
    mediaAttach();
  }
  function mediaAttach() {
    const m = MP; if (!m || !G.q || G.q.key !== m.key) return;
    m.idle = false;
    if (m.kind === 'video') { const slot = $('#vslot'); if (slot && m.el && m.el.parentNode !== slot) slot.insertBefore(m.el, slot.firstChild); }
    mediaUI();
    if (m.kind === 'audio' && $('#viz') && !m.raf) m.raf = requestAnimationFrame(vizLoop);
  }
  function mediaUI() {
    const m = MP; if (!m) return;
    const msg = m.err ? `⚠ Нет файла: ${esc(m.path)}<small>Положи его в папку media или выбери папку в лобби. Можно просто напеть 🙂</small>` : '';
    const lbl = $('#vizlbl'); if (lbl) lbl.innerHTML = msg || (m.el && !m.el.paused ? '' : m.started ? '⏸ пауза' : '🎵 музыка начнётся вместе с таймером');
    const slot = $('#vslot'); if (slot) { const w = $('.merr', slot); if (msg && !w) slot.appendChild(el(`<div class="merr">${msg}</div>`)); }
  }
  function mediaPlay() {
    const m = MP; if (!m || !m.el || m.err || !G.q || G.q.key !== m.key) return;
    if (m.stopAt && m.el.currentTime >= m.stopAt - 0.05) { // дошли до места остановки — играем фрагмент заново
      const d = curD(); try { m.el.currentTime = G.q.stage === 'reveal' && +d.aend > +d.end ? +d.end : (+d.start || 0); } catch (e) { /* ещё не загрузилось */ }
    }
    m.started = true; const p = m.el.play(); if (p && p.catch) p.catch(() => {});
    mediaWatch(m);
  }
  // точная остановка на отметке end/aend: событие timeupdate приходит раз в 0.25 с, и первый звук пропущенного слова успел бы вылететь
  function mediaWatch(m) {
    clearInterval(m.wt);
    if (!m.stopAt) return;
    m.wt = setInterval(() => {
      if (MP !== m || !m.el || m.el.paused || !m.stopAt) { clearInterval(m.wt); return; }
      if (m.el.currentTime >= m.stopAt - 0.04) { m.el.pause(); try { m.el.currentTime = m.stopAt; } catch (e) { /* ещё не загрузилось */ } clearInterval(m.wt); }
    }, 15);
  }
  function mediaPause() { const m = MP; if (m && m.el && !m.el.paused) m.el.pause(); }
  function mediaToggle() { const m = MP; if (!m || !m.el) return; if (m.el.paused) mediaPlay(); else mediaPause(); }
  function mediaStop() {
    const m = MP; if (!m) return; MP = null; cancelAnimationFrame(m.raf); clearInterval(m.wt);
    try { if (m.src) m.src.disconnect(); if (m.an) m.an.disconnect(); } catch (e) { /* уже отключено */ }
    if (m.el) { try { m.el.pause(); m.el.removeAttribute('src'); m.el.load(); } catch (e) { /* ничего */ } if (m.el.parentNode) m.el.remove(); }
  }
  function vizLoop() {
    const m = MP, cv = $('#viz');
    if (!m || m.kind !== 'audio' || !cv) { if (m) m.raf = 0; return; }
    m.raf = requestAnimationFrame(vizLoop);
    const playing = m.el && !m.el.paused && !m.err;
    if (!playing && m.idle) return; // на паузе рисуем один раз
    m.idle = !playing;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, half = 22, n = half * 2, bw = W / n, t = performance.now() / 1000;
    if (!m.lv) m.lv = new Float32Array(half);
    let data = null; if (m.an && playing) { m.an.getByteFrequencyData(m.buf); data = m.buf; }
    const L = data ? data.length * 0.75 : 0;
    for (let i = 0; i < half; i++) {
      let v;
      if (data) { // полосы по логарифмической шкале: в центре басы, по краям высокие
        const a = Math.max(1, Math.floor(Math.pow(L, i / half))), b = Math.max(a + 1, Math.floor(Math.pow(L, (i + 1) / half)));
        let mx = 0; for (let k = a; k < b; k++) mx = Math.max(mx, data[k] || 0);
        v = Math.min(1, mx / 255 * (0.8 + 0.9 * i / half));
      } else v = playing ? 0.32 + 0.26 * Math.sin(t * 5 + i * 0.55) * Math.sin(t * 1.7 + i * 0.9) + 0.12 * Math.sin(t * 13 + i) : 0.05;
      m.lv[i] = playing ? Math.max(v, m.lv[i] * 0.86) : v;
    }
    c.clearRect(0, 0, W, H);
    for (let j = 0; j < n; j++) {
      const i = j < half ? half - 1 - j : j - half, v = m.lv[i], h = Math.max(6, v * H * 0.95);
      c.fillStyle = `hsl(${48 - v * 50 + i * 6},100%,${52 + v * 18}%)`;
      c.fillRect(j * bw + bw * 0.18, (H - h) / 2, bw * 0.64, h);
    }
  }


  /* ----- финал: финалисты по очереди вычёркивают темы, остаётся одна ----- */
  const finThemes = () => Net.finThemes(PACK);
  const finTurn = f => (f.so && f.so.length ? f.so[f.turn % f.so.length] : null);
  const finT = () => { const f = G.fin, FT = finThemes(); return (f && f.ti != null && FT[f.ti]) || {}; };
  async function startFinal() {
    stopTimer(); stopAT(); conHalt(); mediaStop(); G.q = null;
    const FT = finThemes();
    if (!FT.length) return endGame();
    const part = G.ents.filter(e => e.score > 0).map(e => e.id);
    if (!part.length) { toast('В финал никто не прошёл — ни у кого нет очков в плюсе'); return endGame(); }
    G.phase = 'trans'; changed();
    busy = true; await overlay('final'); busy = false;
    const so = part.slice().sort((a, b) => ((ent(a) || {}).score || 0) - ((ent(b) || {}).score || 0));
    G.fin = { stage: FT.length > 1 ? 'strike' : 'theme', part, so, turn: 0, left: FT.map((x, i) => i), ti: FT.length > 1 ? null : 0, bets: {}, answers: {}, judged: {}, opened: {}, order: null, tl: G.set.ftimer, tr: false, showA: false };
    G.phase = 'final'; curSig = null; changed();
  }
  function finStrike(eid, idx, host) {
    const f = G.fin; if (G.phase !== 'final' || !f || f.stage !== 'strike' || busy) return;
    idx = +idx; if (!f.left.includes(idx) || f.left.length <= 1) return;
    if (!host && eid !== finTurn(f)) return;
    snap(); f.left = f.left.filter(i => i !== idx); f.turn++; Sound.play('strike');
    if (f.left.length === 1) {
      f.ti = f.left[0]; busy = true; save(); publish(); updFinal();
      setTimeout(() => {
        busy = false;
        if (G.fin === f && f.stage === 'strike') { f.stage = 'theme'; Sound.play('final'); FX.burst(innerWidth / 2, innerHeight * 0.45, '#ffcc33', 90); changed(); }
      }, 1700);
    } else changed();
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
    const f = G.fin, FT = finThemes(), t = finT();
    if (f.stage === 'strike') return el(`<div class="final"><div class="fin-sub">Финал · выбираем тему</div><div class="fin-title sm">Вычёркиваем темы</div><div class="sp-info" id="fturn"></div>
      <div class="ftiles" id="ftiles">${FT.map((x, i) => `<button class="ftile" data-act="fstrike" data-i="${i}" style="animation-delay:${(i * 0.06).toFixed(2)}s"><span>${esc(x.theme)}</span></button>`).join('')}</div>
      <div class="sp-hint">Первым вычёркивает тот, у кого меньше очков. Выбор — на телефоне или кликом здесь.</div></div>`);
    if (f.stage === 'theme') return el(`<div class="final"><div class="fin-title">Финал</div><div class="fin-theme">Тема: <b>${esc(t.theme)}</b></div><div class="sp-hint">В финале играют все, у кого счёт больше нуля</div><div class="fin-part" id="finpart"></div><div class="hostbar"><button class="btn gold big" data-act="finnext">Принять ставки ▶<kbd>→</kbd></button></div></div>`);
    if (f.stage === 'bet') return el(`<div class="final"><div class="fin-sub">Финал · ${esc(t.theme)}</div><div class="fin-title sm">Делайте ставки!</div><div class="sp-hint">Ставка — с телефона (тайно). Без телефона — кликни по игроку и впиши ставку.</div><div class="fin-part" id="finpart"></div><div class="hostbar"><button class="btn gold" data-act="finnext">Показать вопрос ▶<kbd>→</kbd></button></div></div>`);
    if (f.stage === 'q') return el(`<div class="final"><div class="fin-sub">Финал · ${esc(t.theme)}</div>${t.img ? `<img class="fimg" src="${esc(t.img)}" alt="">` : ''}<div class="qtext" style="font-size:${t.img ? Math.min(3, qSize(t.q)) : qSize(t.q)}rem">${esc(t.q)}</div><div class="timer" id="timer"><i></i><b></b></div><div class="sp-hint">Пишите ответ на телефоне</div><div class="fin-part" id="finpart"></div><div class="hostbar"><button class="btn" data-act="timer">⏯ Пауза<kbd>Пробел</kbd></button><button class="btn gold" data-act="finnext">Стоп — к ответам ▶<kbd>→</kbd></button></div></div>`);
    return el(`<div class="final"><div class="fin-sub">Финал · ${esc(t.theme)}</div><div class="fin-q">${esc(t.q)}</div><div class="fin-cards" id="fincards"></div><div id="finans"></div><div class="hostbar"><button class="btn gold" data-act="finnext" id="finbtn"></button></div></div>`);
  }
  function updFinal() {
    const f = G.fin; if (!f) return;
    updTimer();
    if (f.stage === 'strike') {
      const left = new Set(f.left), FT = finThemes(), one = f.left.length === 1;
      $$('.ftile').forEach(b => { const i = +b.dataset.i; b.classList.toggle('gone', !left.has(i)); b.classList.toggle('win', one && left.has(i)); b.disabled = !left.has(i) || one; });
      const ft = $('#fturn');
      if (ft) {
        const cur = ent(finTurn(f));
        ft.innerHTML = one ? `Тема финала: <b>${esc((FT[f.left[0]] || {}).theme)}</b>` : `Вычёркивает: <b style="color:${cur ? cur.color : '#fff'}">${esc(cur ? cur.name : '—')}</b>${cur && hasPhone(cur.id) ? ' · выбор на телефоне 📱' : ''}`;
      }
      return;
    }
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
    const fa = $('#finans'); if (fa) fa.innerHTML = f.showA ? `<div class="answer"><div class="al">Правильный ответ</div><div class="at">${esc(finT().a)}</div>${finT().c ? `<div class="acom">${esc(finT().c)}</div>` : ''}</div>` : '';
    const fb = $('#finbtn'); if (fb) fb.innerHTML = (f.showA ? 'Итоги игры 🏆' : 'Показать правильный ответ') + '<kbd>→</kbd>';
  }

  /* ----- итоги ----- */
  function endGame() {
    stopTimer(); stopAT(); conHalt(); mediaStop(); Sound.think(false); G.q = null; G.phase = 'end'; curSig = null;
    const w = G.ents.slice().sort((a, b) => b.score - a.score)[0]; G.wj = w ? joke('winner', w.name) : ''; changed();
    Sound.play('fanfare'); setTimeout(() => Sound.play('applause'), 1200); FX.fireworks(10000); setTimeout(() => FX.confetti(240), 1700);
  }
  function vEnd() {
    const rank = G.ents.slice().sort((a, b) => b.score - a.score), top = rank.slice(0, 3), pos = [2, 1, 3], pod = [top[1], top[0], top[2]];
    return el(`<div class="end"><div class="end-title">🏆 ${rank[0] ? esc(rank[0].name) + ' — победитель!' : 'Итоги'}</div>${G.wj ? `<div class="end-sub">${esc(G.wj)}</div>` : ''}<div class="podium">${pod.map((e, i) => e
      ? `<div class="pd p${pos[i]}" style="--c:${e.color}"><div class="pd-name">${pos[i] === 1 ? '👑 ' : ''}${esc(e.name)}</div><div class="pd-score">${fmt(e.score)}</div><div class="pd-bar">${pos[i]}</div></div>`
      : '<div class="pd empty"></div>').join('')}</div><div class="rest">${rank.slice(3).map((e, i) => `<span>${i + 4}. ${esc(e.name)} — ${fmt(e.score)}</span>`).join('')}</div>
      <div class="hostbar"><button class="btn" data-act="fireworks">🎆 Ещё салют</button><button class="btn" data-act="newgame">↻ Новая игра</button></div></div>`);
  }
  async function newGame() {
    if (!(await confirmBox('Начать новую игру? Счёт обнулится, игроки и телефоны останутся.'))) return;
    snap(); stopTimer(); stopAT(); Sound.think(false); stopConvince(); conHalt(); mediaStop(); FX.clear(); closeOverlay(); busy = false;
    G.ents.forEach(e => { e.score = 0; });
    Object.assign(G, { started: false, resume: null, round: 0, played: {}, chooser: null, phase: 'lobby', q: null, fin: null, fz: {}, x2: {}, sh: {}, bo: {} });
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
    for (const pid in G.phones) if (G.phones[pid].ent === id) { if (G.mode === 'solo') { delete G.phones[pid]; closePeer(pid); } else G.phones[pid].ent = null; }
    if (G.chooser === id) G.chooser = null;
    changed();
  }
  function switchBroker() { G.broker = (G.broker + 1) % Net.BROKERS.length; save(); netStart(); toast(`Сервер связи: ${Net.brokerName(G.broker)}. Гостям нужно заново отсканировать QR`); if (G.phase !== 'lobby') toLobby(); render(); }
  function newRoom() { Object.keys(peers).forEach(closePeer); G.room = Net.code(5); G.phones = {}; save(); netStart(); toast(`Новый код комнаты: ${G.room}. Гостям нужно заново отсканировать QR`); if (G.phase !== 'lobby') toLobby(); render(); }

  /* ================= оверлеи и эффекты ================= */
  const letters = s => Array.from(String(s)).map((ch, i) => (ch === ' ' ? ' ' : `<span style="animation-delay:${(i * 0.05).toFixed(2)}s">${esc(ch)}</span>`)).join('');
  const OV = {
    cat: () => `<div class="ov-rays"></div><div class="ov-emoji bag">🎁</div><div class="ov-emoji cat">🐱</div><div class="ov-title">Кот в мешке!</div><div class="ov-sub">${esc(joke('cat'))}</div>`,
    auction: () => `<div class="ov-rays"></div><div class="ov-emoji hammer">🔨</div><div class="ov-title">${letters('Аукцион!')}</div><div class="ov-sub">${esc(joke('auction') || 'Торгуемся за вопрос')}</div>`,
    trap: () => `<div class="ov-emoji">🚨</div><div class="ov-title">⚠ ЛОВУШКА ⚠</div><div class="ov-sub">Ангел или дьявол? Решит монетка…</div>${PACK.jokes && PACK.jokes.trap ? `<div class="ov-sub sm">${esc(joke('trap'))}</div>` : ''}`,
    angel: () => `<div class="ov-halo"></div><div class="ov-emoji angel">😇</div><div class="ov-title">${letters('АНГЕЛ')}</div><div class="ov-sub">Небеса сегодня добры</div>`,
    devil: () => `<div class="ov-flames"></div><div class="ov-emoji devil">😈</div><div class="ov-title">${letters('ДЬЯВОЛ')}</div><div class="ov-sub">Сейчас будет жарко…</div>`,
    bonus: () => `<div class="ov-rays bonus"></div><div class="ov-qs"><span>?</span><span>?</span><span>?</span></div><div class="ov-title">${letters('БОНУС!')}</div><div class="ov-sub">Вместо вопроса — конкурс</div>`,
    music: () => `<div class="ov-eq">${'<i></i>'.repeat(9)}</div><div class="ov-title">${letters('Угадай мелодию')}</div><div class="ov-sub">🎵 Слушаем внимательно</div>`,
    video: () => `<div class="ov-film"></div><div class="ov-emoji clap">🎬</div><div class="ov-title">${letters('Видеовопрос')}</div><div class="ov-sub">Смотрим внимательно!</div>`,
    bribe: d => `<div class="ov-rays"></div><div class="ov-emoji">💰</div><div class="ov-title">${esc(d.name)}<br>подкупает судью!</div><div class="ov-sub">−${fmt(d.cost)} очков · ${d.hint ? 'подсказка ушла на телефон 🤫' : 'судья, шепни подсказку на ушко 🤫'}</div><div class="ov-sub sm">${esc(joke('bribe', d.name))}</div>`,
    round: d => `<div class="ov-rays"></div><div class="ov-title">${letters(d.title)}</div>${d.sub ? `<div class="ov-sub">${esc(d.sub)}</div>` : ''}`,
    medal: d => `<div class="ov-rays medal m${d.md}"></div><div class="ov-medalbox m${d.md}"><span>${MEDALS[d.md][0]}</span></div><div class="ov-title medal m${d.md}">${letters(MEDALS[d.md][1] + '!')}</div><div class="ov-sub">${esc(joke('medal'))}</div>`,
    mashup: () => `<div class="ov-mash"><span>🧑</span><span>👩</span></div><div class="ov-title">${letters('Мешап!')}</div><div class="ov-sub">Два лица в одном. Назови обоих!</div>`,
    final: () => { const FT = finThemes(); return `<div class="ov-title">${letters('ФИНАЛ')}</div><div class="ov-sub">${FT.length > 1 ? `${FT.length} тем — по очереди вычёркиваем, пока не останется одна` : 'Тема: ' + esc((FT[0] || {}).theme || '')}</div>`; },
  };
  const OVDUR = { cat: 3400, auction: 3000, trap: 2600, angel: 2700, devil: 2700, bonus: 2600, music: 2100, video: 2000, bribe: 3000, round: 2600, final: 3400, medal: 2600, mashup: 2200 };
  const OVFX = {
    cat: () => { Sound.play('whoosh'); setTimeout(() => { Sound.play('cat'); FX.burst(innerWidth / 2, innerHeight * 0.4, '#ffcc33', 70); }, 1050); },
    auction: () => { Sound.play('auction'); [0, 380, 760].forEach(d => setTimeout(() => FX.burst(innerWidth * 0.53, innerHeight * 0.38, '#ffcc33', 45), d + 260)); },
    trap: () => Sound.play('trap'),
    angel: () => { Sound.play('angel'); FX.rain('✨', 36); setTimeout(() => FX.burst(innerWidth / 2, innerHeight * 0.36, '#fff3b0', 80), 300); },
    devil: () => { Sound.play('devil'); FX.rise('🔥', 36); setTimeout(() => FX.burst(innerWidth / 2, innerHeight * 0.36, '#ff4d5e', 80), 300); },
    bonus: () => { Sound.play('bonus'); [0, 300, 600].forEach(d => setTimeout(() => FX.burst(innerWidth * (0.3 + d / 1500), innerHeight * 0.4, '#c58bff', 50), d + 200)); },
    music: () => Sound.play('open'),
    video: () => Sound.play('whoosh'),
    bribe: () => { Sound.play('bribe'); FX.rain('💰', 40); FX.rain('💵', 18); },
    round: () => Sound.play('round'),
    medal: d => { Sound.play('medal'); const col = { 1: '#e08a4c', 2: '#e6eefc', 3: '#ffd34d' }[d.md]; [0, 250, 500].forEach(t => setTimeout(() => FX.burst(innerWidth * (0.35 + t / 1700), innerHeight * 0.4, col, 55), t + 300)); },
    mashup: () => { Sound.play('mashup'); FX.burst(innerWidth / 2, innerHeight * 0.4, '#36e2ff', 60); },
    final: () => { Sound.play('final'); FX.burst(innerWidth / 2, innerHeight * 0.45, '#ffcc33', 90); },
  };
  function overlay(type, d) {
    d = d || {};
    return new Promise(res => {
      closeOverlay();
      const ov = $('#overlay'); ov.className = 'show ov-' + type; ov.innerHTML = OV[type](d);
      const rays = $('.ov-rays', ov); if (rays) rays.style.backgroundImage = `url(${raysImg(rays.classList.contains('bonus') ? 'bonus' : rays.classList.contains('m2') ? 'silver' : rays.classList.contains('m1') ? 'bronze' : 'gold')})`;
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
  // лучи для заставок рисуем один раз в картинку: крутить готовую картинку видеокарте почти ничего не стоит
  const RAYS = {};
  function raysImg(kind) {
    if (RAYS[kind]) return RAYS[kind];
    const n = 1280, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), col = { bonus: '220,150,255', silver: '220,232,255', bronze: '230,140,80' }[kind] || '255,204,51';
    g.translate(n / 2, n / 2);
    for (let i = 0; i < 24; i++) { g.rotate(Math.PI * 2 / 24); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, n / 2, -0.07, 0.07); g.closePath(); g.fillStyle = `rgba(${col},.2)`; g.fill(); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in';
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.3, 'rgba(0,0,0,1)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, n, n);
    try { RAYS[kind] = c.toDataURL('image/png'); } catch (e) { RAYS[kind] = ''; }
    return RAYS[kind];
  }
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
    if (q && q.stage === 'bonus' && q.con && q.con.step === 'who') items.push(['🎁 Играет в конкурсе', 'cwho']);
    if (q && q.stage === 'bonus' && q.con && q.con.step === 'pick' && conEligibleB(q.con).some(x => x.id === id)) items.push(['⚔ Соперник в конкурсе', 'cpick']);
    items.push(['⭐ Выбирает вопрос', 'm-chooser'], ['＋100', 'm-plus'], ['－100', 'm-minus'], ['✎ Изменить счёт', 'm-score'], ['✎ Переименовать', 'ren']);
    PREFS.forEach(([k, ic, nm]) => items.push([`${ic} ${nm}: ${entPref(id, k) ? '✓ да' : '— нет'}`, 'm-pr', k]));
    if (['lobby', 'board', 'end'].includes(G.phase)) items.push(['🗑 Удалить', 'del']);
    const m = el(`<div class="emenu"><div class="em-h" style="--c:${e.color}">${esc(e.name)}</div>${items.map(([t, a, k]) => `<button data-act="${a}" data-id="${esc(id)}"${k ? ` data-k="${k}"` : ''}>${t}</button>`).join('')}</div>`);
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
    items.push(['🔑 Пульт ведущего', 'pult'], ['↻ Новая игра', 'newgame'], ['📡 Другой сервер связи', 'broker'], ['🎲 Новый код комнаты', 'newroom'], [document.body.classList.contains('lite') ? '✨ Эффекты: включить полные' : '🍃 Эффекты: облегчить (если тормозит)', 'fxmode']);
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
    const rows = [['Пробел', 'старт / пауза таймера и времени на ответ, бросить монетку, крутить рулетку, начать конкурс, пропустить анимацию'], ['Enter', 'верно'], ['Backspace', 'неверно'], ['A', 'показать ответ'], ['→', 'дальше: к табло, закрыть торги, следующий шаг конкурса и финала'], ['P', 'музыка / видео: пауза и продолжить'], ['Esc', 'закрыть меню / к табло после ответа'], ['1 … 9, 0', 'назначить отвечающего вручную (номер на карточке)'], ['Ctrl + Z', 'отменить последнее действие'], ['F', 'полный экран'], ['M', 'звук вкл/выкл'], ['H', 'эта подсказка']];
    const m = modal(`<div class="mt">⌨ Горячие клавиши</div><div class="help">${rows.map(r => `<kbd>${r[0]}</kbd><span>${r[1]}</span>`).join('')}</div><div class="mtxt">Клик по карточке игрока внизу — меню: отвечает, выбирает, ±100, изменить счёт, ответы теста («пить», «танцевать»…).</div><div class="mb"><button class="btn gold" data-m="ok">Понятно</button></div>`);
    m.id = 'helpm'; m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-m]')) m.remove(); });
  }
  function toggleFS() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
  function toggleMute() {
    Sound.toggleMute(); if (MP && MP.el) MP.el.muted = Sound.muted; if (djEl) djEl.muted = Sound.muted;
    renderTop(); toast(Sound.muted ? '🔇 Звук выключен' : '🔊 Звук включён');
  }

  /* ================= управление ================= */
  function spaceAction() {
    if (ovResolve) return closeOverlay();
    if (busy) return;
    if (G.phase === 'q' && G.q) {
      const st = G.q.stage;
      if (['read', 'open', 'ans'].includes(st)) return toggleTimer();
      if (st === 'trap') return trapFlip();
      if (st === 'trapspin') return trapSpin();
      if (st === 'bonus') return conSpace();
    }
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
      if (st === 'bonus') return conNext();
    }
    if (G.phase === 'final') return finNext();
    if (G.phase === 'results') return afterResults();
  }
  function escAction() {
    if (ovResolve) return closeOverlay();
    if ($('.emenu, .tmenu')) return closeMenus();
    if (G.phase === 'q' && G.q && (G.q.stage === 'reveal' || (G.q.con && G.q.con.step === 'result'))) backToBoard();
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
      case 'mp1': case 'mp2': return mashPartial(a === 'mp2' ? 2 : 1);
      case 'board': return backToBoard();
      case 'catgive': return catGive(ds.id);
      case 'bid': return placeBid(ds.id, ds.v, true);
      case 'bidc': return bidCustom(ds.id);
      case 'spin': return trapSpin();
      case 'atimer': return toggleAT();
      case 'media': return mediaToggle();
      case 'mdir': return pickMediaDir();
      case 'mperm': return mediaPermit().then(ok => { if (ok) mediaCheck(); updLobby(); });
      case 'mmiss': return showMissing();
      case 'cwho': return conWho(ds.id);
      case 'cspin': return conSpin();
      case 'cpick': return conPick(ds.id);
      case 'cstart': return conStart();
      case 'cpause': return conPause();
      case 'cnext': return conNext();
      case 'ccount': return conCount();
      case 'cwin': return conCount(ds.v);
      case 'crps': { const c = G.q && G.q.con; if (c) conRps(ds.side === 'a' ? c.a : c.b, null, ds.v, true); return; }
      case 'cshot': return conShot(ds.side, ds.v === '1');
      case 'cguess': return conGuess(ds.id);
      case 'cnone': return conNone();
      case 'cword': return conWord();
      case 'cstare': return conStare(ds.v);
      case 'fstrike': return finStrike(null, ds.i, true);
      case 'aucclose': return aucClose();
      case 'redeem': return redeem(ds.id, ds.v);
      case 'reroll': return reroll(ds.id);
      case 'resnext': return afterResults();
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
      case 'm-pr': { const e = ent(ds.id); if (!e || !ds.k) return; snap(); const v = !entPref(e.id, ds.k); e.pr = Object.assign({}, e.pr, { [ds.k]: v ? 1 : 0 }); return changed(); }
      case 'lobby': return toLobby();
      case 'skipround': return skipRound();
      case 'tofinal': if (G.phase === 'board' && !busy) { snap(); return startFinal(); } return;
      case 'broker': return switchBroker();
      case 'newroom': return newRoom();
      case 'fxmode': return toggleFx();
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
      case 'KeyP': return mediaToggle();
    }
    const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
    if (m) { const n = +m[2], en = G.ents[n === 0 ? 9 : n - 1]; if (en) manualAnswer(en.id); }
  });

  /* ================= облегчённые эффекты ================= */
  // без видеоускорения (или на слабом компьютере) большие анимации тормозят — включаем лёгкий режим сами
  const FXKEY = 'svoyaigra.fx';
  function softwareGPU() {
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info'), r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);
    } catch (e) { return false; }
  }
  let fxMode = Net.params.get('fx') || (() => { try { return localStorage.getItem(FXKEY); } catch (e) { return null; } })() || 'auto';
  function applyFx() {
    const lite = fxMode === 'lite' || (fxMode === 'auto' && softwareGPU());
    document.body.classList.toggle('lite', lite); FX.lite = lite;
  }
  function toggleFx() {
    const lite = document.body.classList.contains('lite');
    fxMode = lite ? 'full' : 'lite'; try { localStorage.setItem(FXKEY, fxMode); } catch (e) { /* ничего */ }
    applyFx(); toast(lite ? '✨ Полные эффекты' : '🍃 Облегчённые эффекты — для слабого компьютера');
  }

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
    s.classList.add('out'); setTimeout(() => { s.remove(); musicSync(); }, 650);
    curSig = null; render();
  }

  if (!load()) G = newState();
  applyFx(); render(); netStart(); splash();
  setInterval(() => { renderScores(); if (G.phase === 'lobby') updLobby(); }, 4000);
  setInterval(() => { if (client) client.publish(T('hb'), 1, false); const hb = JSON.stringify({ hb: 1 }); for (const pid in peers) dcRaw(pid, hb); }, 10000); // сердцебиение для телефонов
  mediaInit();
  window.__svi = { get G() { return G; }, get MP() { return MP; }, get disco() { return discoOn; }, act, judge, reveal, nextAction, spaceAction, force: FORCE, pubState, pickEvent, conOk: (id, a) => conOk(CX[id], a) };
})();
