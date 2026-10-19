/* pult.js — пульт и шпаргалка ведущего: текущий вопрос с ответом, кнопки управления, все вопросы. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TAG = { cat: '🐱 кот', auction: '🔨 аукцион', trap: '⚠ ловушка', bonus: '🎁 бонус-конкурс' };
  const MD = { a: '🎵 музыка', v: '🎬 видео' };
  const prm = Net.params, room = (prm.get('r') || '').toUpperCase(), key = prm.get('k') || '', bi = +(prm.get('b') || 0);
  const live = !!(room && key);
  let pack = window.GAME ? Net.stripPack(window.GAME) : null;
  let mySig = pack ? Net.hash(JSON.stringify(pack)) : '';
  let cur = null, client = null, online = false, chunks = null, chunkT = null;
  const T = s => Net.PREFIX + room + '/' + s;

  if (live) {
    client = new Net.Client(Net.brokerUrl(bi));
    client.subscribe(T('h/' + key + '/cur')); client.subscribe(T('h/' + key + '/pk'));
    client.onMessage((t, d) => {
      if (!d) return;
      if (t === T('h/' + key + '/cur')) { cur = d; renderCur(); renderList(); }
      else if (t === T('h/' + key + '/pk')) onChunk(d);
    });
    client.onStatus(on => { online = on; if (on) hello(); renderCur(); });
    setInterval(() => { if (online) hello(); }, 60000);
  }
  function hello() { client.publish(T('c/' + key), { t: 'hello', m: Net.id(), ps: mySig }, false); }
  // вопросы на компьютере отличаются от сайта — получаем их кусочками
  function onChunk(d) {
    if (!d || typeof d.d !== 'string' || !(d.n > 0) || d.n > 400 || d.s === mySig) return;
    if (!chunks || chunks.s !== d.s || chunks.n !== d.n) chunks = { s: d.s, n: d.n, parts: {} };
    chunks.parts[d.i] = d.d;
    const have = Object.keys(chunks.parts).length;
    renderCur();
    clearTimeout(chunkT);
    if (have >= chunks.n) {
      try {
        let txt = ''; for (let i = 0; i < chunks.n; i++) txt += chunks.parts[i];
        if (Net.hash(txt) === chunks.s) { pack = JSON.parse(txt); mySig = chunks.s; chunks = null; renderList(); renderCur(); return; }
      } catch (e) { /* соберём заново */ }
      chunks = null; return;
    }
    chunkT = setTimeout(() => { // часть кусочков потерялась — просим только их
      if (!chunks) return;
      const miss = []; for (let i = 0; i < chunks.n && miss.length < 60; i++) if (chunks.parts[i] == null) miss.push(i);
      if (miss.length) client.publish(T('c/' + key), { t: 'pk', m: Net.id(), miss }, false);
    }, 6000);
  }
  function cmd(t) { if (!client) return; client.publish(T('c/' + key), { t, m: Net.id() }, false); try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* нет */ } }
  document.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) cmd(b.dataset.c); });

  function renderCur() {
    const box = $('#cur');
    if (!live) { box.innerHTML = '<div class="s">Это шпаргалка со всеми вопросами и ответами. Чтобы видеть текущий вопрос и управлять игрой с телефона, открой пульт по QR-коду: в игре нажми ☰ → «Пульт ведущего».</div>'; return; }
    const q = cur && cur.q, f = cur && cur.fin;
    let h = `<div class="st"><i class="net ${online ? 'on' : ''}"></i>${online ? 'На связи' : 'Подключаемся…'} · комната ${esc(room)}${chunks ? ` · загружаю вопросы ${Object.keys(chunks.parts).length}/${chunks.n}` : ''}</div>`;
    if (cur && cur.phase === 'q' && q) {
      const c = q.con;
      h += `<div class="qth">${esc(q.th)} · <b>${esc(q.stake || q.p)}</b> ${TAG[q.ty] ? `<span class="tag">${TAG[q.ty]}</span>` : ''} ${MD[q.md] ? `<span class="tag md">${MD[q.md]}</span>` : ''}</div>`;
      if (c) {
        h += `<div class="qq">🎁 ${esc(c.n)}${c.a ? ` · ${esc(c.a)}${c.b ? ' против ' + esc(c.b) : ''}` : ''}${c.stake ? ` · ставка ${esc(c.stake)}` : ''}</div>`;
        if (c.word) h += `<div class="qa">🐊 Слово: ${esc(c.word)}</div>`;
      } else {
        h += `<div class="qq">${esc(q.text)}</div><div class="qa">${esc(q.a)}</div>` + (q.hint ? `<div class="qh">💡 ${esc(q.hint)}</div>` : '');
      }
      h += (q.ans ? `<div class="who">Отвечает: <b>${esc(q.ans)}</b></div>` : q.ow ? `<div class="who">Отвечает: <b>${esc(q.ow)}</b>${q.stake ? ' · ставка ' + esc(q.stake) : ''}</div>` : '')
        + (q.ev ? `<div class="who">Ловушка (${esc(q.vic)}): <b>${esc(q.ev)}</b></div>` : '')
        + (q.card ? `<div class="br">Задание: ${esc(q.card)}</div>` : '')
        + (q.bribes || []).map(b => `<div class="br">${b.f ? '👀' : '💰'} ${esc(b.n)} ${b.f ? 'получил подсказку от ангела' : 'подкупил судью'} — ${b.h ? 'подсказка ушла на телефон' : '<b>подскажи ему сам!</b>'}</div>`).join('');
    } else if (cur && cur.phase === 'final' && f) {
      if (f.st === 'strike') h += '<div class="qth">Финал · вычёркивают темы</div><div class="qq">Ответы ко всем темам — в списке ниже</div>';
      else h += `<div class="qth">Финал · ${esc(f.th)}</div><div class="qq">${esc(f.q)}</div><div class="qa">${esc(f.a)}</div>`
        + (f.answers || []).map(a => `<div class="br">${esc(a.n)}: «${esc(a.v)}» · ставка ${a.b == null ? '—' : esc(a.b)}</div>`).join('');
    } else {
      const ph = { lobby: 'Лобби — ждём игроков', board: 'Табло — выбирают вопрос', end: 'Игра окончена 🏆', trans: '…' };
      h += `<div class="qq">${cur ? (ph[cur.phase] || '') : 'Ждём, когда откроется игра на телевизоре…'}</div>`;
    }
    h += '<div class="ctl"><button class="ok" data-c="ok">✓ Верно</button><button class="bad" data-c="bad">✗ Неверно</button><button data-c="ans">👁 Ответ</button><button data-c="space">⏯ Таймер / старт</button>'
      + (cur && cur.q && cur.q.md ? '<button data-c="media">⏯ Музыка / видео</button>' : '') + '<button class="wide" data-c="next">→ Дальше</button></div>';
    box.innerHTML = h;
  }
  function renderList() {
    const box = $('#list'); if (!pack) { box.innerHTML = ''; return; }
    const curKey = cur && cur.q && cur.q.key, pl = (cur && cur.pl) || [];
    let h = '';
    (pack.rounds || []).forEach((r, ri) => {
      h += `<h2>${esc(r.name || 'Раунд ' + (ri + 1))}</h2>`;
      const bits = String(pl[ri] || '').split('.');
      (r.themes || []).forEach((th, ti) => {
        h += `<h3>${esc(th.name)}</h3>`;
        (th.questions || []).forEach((x, qi) => {
          const k = `${ri}-${ti}-${qi}`, played = (bits[ti] || '')[qi] === '1';
          const tag = (TAG[x.type] ? ` <span class="tag">${TAG[x.type]}${x.type === 'cat' && x.catTheme ? ': ' + esc(x.catTheme) : ''}</span>` : '') + (MD[x.md] ? ` <span class="tag md">${MD[x.md]}</span>` : '');
          h += x.type === 'bonus'
            ? `<div class="it ${played ? 'pl' : ''} ${k === curKey ? 'cu' : ''}"><div class="ip"><b>${esc(x.price)}</b>${tag}</div><div class="iq">Конкурс выберет рулетка</div></div>`
            : `<div class="it ${played ? 'pl' : ''} ${k === curKey ? 'cu' : ''}"><div class="ip"><b>${esc(x.price)}</b>${tag}</div><div class="iq">${esc(x.q)}</div><div class="ia">${esc(x.a)}</div>${x.hint ? `<div class="ih">💡 ${esc(x.hint)}</div>` : ''}</div>`;
        });
      });
    });
    const fin = pack.final || [];
    if (fin.length) h += `<h2>Финал</h2>` + fin.map(x => `<div class="it"><div class="ip"><b>${esc(x.theme)}</b></div><div class="iq">${esc(x.q)}</div><div class="ia">${esc(x.a)}</div></div>`).join('');
    box.innerHTML = h;
  }
  renderCur(); renderList();
})();
