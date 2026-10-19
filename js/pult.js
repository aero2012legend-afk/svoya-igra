/* pult.js — пульт и шпаргалка ведущего: текущий вопрос с ответом, кнопки управления, все вопросы. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TAG = { cat: '🐱 кот', auction: '🔨 аукцион', trap: '⚠ ловушка' };
  const prm = Net.params, room = (prm.get('r') || '').toUpperCase(), key = prm.get('k') || '', bi = +(prm.get('b') || 0);
  const live = !!(room && key);
  let pack = window.GAME ? { title: window.GAME.title, rounds: window.GAME.rounds, final: window.GAME.final } : null;
  let cur = null, client = null, online = false;
  const T = s => Net.PREFIX + room + '/' + s;

  if (live) {
    client = new Net.Client(Net.brokerUrl(bi));
    client.subscribe(T('h/' + key + '/pack')); client.subscribe(T('h/' + key + '/cur'));
    client.onMessage((t, d) => {
      if (!d) return;
      if (t === T('h/' + key + '/pack')) { pack = d; renderList(); }
      else if (t === T('h/' + key + '/cur')) { cur = d; renderCur(); renderList(); }
    });
    client.onStatus(on => { online = on; if (on) client.publish(T('c/' + key), { t: 'hello' }, false); renderCur(); });
  }
  function cmd(t) { if (!client) return; client.publish(T('c/' + key), { t, at: Date.now() }, false); try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* нет */ } }
  document.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) cmd(b.dataset.c); });

  function renderCur() {
    const box = $('#cur');
    if (!live) { box.innerHTML = '<div class="s">Это шпаргалка со всеми вопросами и ответами. Чтобы видеть текущий вопрос и управлять игрой с телефона, открой пульт по QR-коду: в игре нажми ☰ → «Пульт ведущего».</div>'; return; }
    const q = cur && cur.q, f = cur && cur.fin;
    let h = `<div class="st"><i class="net ${online ? 'on' : ''}"></i>${online ? 'На связи' : 'Подключаемся…'} · комната ${esc(room)}</div>`;
    if (cur && cur.phase === 'q' && q) {
      h += `<div class="qth">${esc(q.th)} · <b>${esc(q.stake || q.p)}</b> ${TAG[q.ty] ? `<span class="tag">${TAG[q.ty]}</span>` : ''}</div><div class="qq">${esc(q.text)}</div><div class="qa">${esc(q.a)}</div>`
        + (q.hint ? `<div class="qh">💡 ${esc(q.hint)}</div>` : '')
        + (q.ans ? `<div class="who">Отвечает: <b>${esc(q.ans)}</b></div>` : q.ow ? `<div class="who">Отвечает: <b>${esc(q.ow)}</b>${q.stake ? ' · ставка ' + esc(q.stake) : ''}</div>` : '')
        + (q.ev ? `<div class="who">Ловушка: <b>${esc(q.ev)}</b></div>` : '')
        + (q.bribes || []).map(b => `<div class="br">💰 ${esc(b.n)} подкупил судью — ${b.h ? 'подсказка ушла на телефон' : '<b>подскажи ему сам!</b>'}</div>`).join('');
    } else if (cur && cur.phase === 'final' && f) {
      h += `<div class="qth">Финал · ${esc(f.th)}</div><div class="qq">${esc(f.q)}</div><div class="qa">${esc(f.a)}</div>`
        + (f.answers || []).map(a => `<div class="br">${esc(a.n)}: «${esc(a.v)}» · ставка ${a.b == null ? '—' : esc(a.b)}</div>`).join('');
    } else {
      const ph = { lobby: 'Лобби — ждём игроков', board: 'Табло — выбирают вопрос', end: 'Игра окончена 🏆', trans: '…' };
      h += `<div class="qq">${cur ? (ph[cur.phase] || '') : 'Ждём, когда откроется игра на телевизоре…'}</div>`;
    }
    h += '<div class="ctl"><button class="ok" data-c="ok">✓ Верно</button><button class="bad" data-c="bad">✗ Неверно</button><button data-c="ans">👁 Ответ</button><button data-c="space">⏯ Таймер / монетка</button><button class="wide" data-c="next">→ Дальше</button></div>';
    box.innerHTML = h;
  }
  function renderList() {
    const box = $('#list'); if (!pack) { box.innerHTML = ''; return; }
    const played = new Set((cur && cur.played) || []), curKey = cur && cur.q && cur.q.key;
    let h = '';
    (pack.rounds || []).forEach((r, ri) => {
      h += `<h2>${esc(r.name || 'Раунд ' + (ri + 1))}</h2>`;
      (r.themes || []).forEach((th, ti) => {
        h += `<h3>${esc(th.name)}</h3>`;
        (th.questions || []).forEach((x, qi) => {
          const k = `${ri}-${ti}-${qi}`, tag = TAG[x.type] ? ` <span class="tag">${TAG[x.type]}${x.type === 'cat' && x.catTheme ? ': ' + esc(x.catTheme) : ''}</span>` : '';
          h += `<div class="it ${played.has(k) ? 'pl' : ''} ${k === curKey ? 'cu' : ''}"><div class="ip"><b>${esc(x.price)}</b>${tag}</div><div class="iq">${esc(x.q)}</div><div class="ia">${esc(x.a)}</div>${x.hint ? `<div class="ih">💡 ${esc(x.hint)}</div>` : ''}</div>`;
        });
      });
    });
    if (pack.final) h += `<h2>Финал · ${esc(pack.final.theme)}</h2><div class="it"><div class="iq">${esc(pack.final.q)}</div><div class="ia">${esc(pack.final.a)}</div></div>`;
    box.innerHTML = h;
  }
  renderCur(); renderList();
})();
