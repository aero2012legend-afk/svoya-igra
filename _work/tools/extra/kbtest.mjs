import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const out = process.argv[2];
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error' && !/WebSocket|mqtt|wss?:|net::ERR_/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const con = () => p.evaluate(() => { const q = window.__svi.G.q; const c = q && q.con; return c ? { step: c.step, id: c.id, turn: c.turn, songs: c.songs, tot: c.tot, tl: c.tl && +c.tl.toFixed(1) } : null; });
await p.goto('http://localhost:8080/index.html', { waitUntil: 'domcontentloaded' }); await wait(2500);
await p.keyboard.press('Space'); await wait(800);
for (const name of ['Вася', 'Петя']) { await p.click('[data-act=add]'); await wait(250); await p.keyboard.press('Control+A'); await p.keyboard.type(name); await p.keyboard.press('Enter'); await wait(250); }
await p.click('[data-act=start]'); await wait(40000);
const cc = await p.evaluate(() => { for (const [t, th] of window.GAME.rounds[0].themes.entries()) for (const [i, q] of th.questions.entries()) if (q.type === 'bonus') return { t, i }; });
await p.evaluate(() => { window.__svi.force.con = 'sing'; window.__svi.G.ents.forEach(e => { e.pr = Object.assign({}, e.pr, { sing: true }); }); });
await p.click(`.cell[data-t="${cc.t}"][data-i="${cc.i}"]`); await wait(3500);
for (let k = 0; k < 30; k++) { const x = await con(); if (x && !['spin', 'who'].includes(x.step)) break; if (x && x.step === 'who') { await p.click('.picker .pk >> nth=0').catch(() => {}); } await wait(500); }
let x = await con(); console.log('after spin', JSON.stringify(x));
if (x.step === 'pick') { await p.click('.picker .pk >> nth=0'); await wait(800); }
for (let k = 0; k < 20; k++) { x = await con(); if (x.step === 'ready') break; await wait(500); }
console.log('ready', JSON.stringify(x), await p.evaluate(() => (document.querySelector('#stage .sp-info') || {}).textContent));
await p.screenshot({ path: out + '/kb_ready.jpg', quality: 60, type: 'jpeg' });
await p.keyboard.press('Space'); await wait(7000);
const st = () => p.evaluate(() => { const A = window.__svi.karA, k = document.querySelector('#stage .kar'); return { song: A && A.kb && A.kb.title, playing: A && A.el ? !A.el.paused : null, t: A && A.el ? +A.el.currentTime.toFixed(2) : null, dur: A && A.el ? +A.el.duration.toFixed(1) : null, lines: k ? [...k.querySelectorAll('.kl, .k1, .k2, div')].slice(0, 3).map(d => d.textContent.trim()).filter(Boolean).slice(0,2) : null, on: k ? k.querySelectorAll('.w.on').length : -1 }; });
console.log('play a', JSON.stringify(await con()), JSON.stringify(await st()));
await p.screenshot({ path: out + '/kb_play_a.jpg', quality: 60, type: 'jpeg' });
await wait(9000); console.log('play a +9s', JSON.stringify(await st()));
await p.keyboard.press('ArrowRight'); await wait(6000);
console.log('play b', JSON.stringify(await con()), JSON.stringify(await st()));
await p.screenshot({ path: out + '/kb_play_b.jpg', quality: 60, type: 'jpeg' });
console.log('ОШИБКИ:', errs.length ? errs.join('\n') : 'нет'); await b.close();
