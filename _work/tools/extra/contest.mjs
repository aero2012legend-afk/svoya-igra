// Проверка конкурсов: караоке-клетка и новые бонусы. node contest.mjs SITE OUT
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [, , site, out] = process.argv;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/WebSocket|mqtt|wss?:|net::ERR_/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
const wait = ms => p.waitForTimeout(ms);
const shot = async n => { await p.screenshot({ path: `${out}/${n}.jpg`, quality: 60, type: 'jpeg' }); };
const con = () => p.evaluate(() => { const q = window.__svi.G.q; return q && q.con ? { step: q.con.step, id: q.con.id, a: q.con.a, b: q.con.b, g: q.con.g, stake: q.con.stake, res: q.con.res && q.con.res.text, tl: q.con.tl && +q.con.tl.toFixed(1), word: q.con.word, pr: q.con.pr } : null; });
const scores = () => p.evaluate(() => window.__svi.G.ents.map(e => e.name + ':' + e.score).join(' '));
await p.goto('file://' + site + '/index.html?fx=full'); await wait(1500);
// караоке-клетка на месте «Дырявый плейлист» 200: минус и слова от песни за 100
await p.evaluate(() => { const th = window.GAME.rounds[0].themes.find(t => t.name === 'Дырявый плейлист'), a = th.questions[0], k = th.questions[1];
  Object.assign(k, { type: 'karaoke', q: 'Тестовая песня', minus: a.minus, kar: a.kar, kdur: 26 }); });
await p.keyboard.press('Space'); await wait(1000);
for (const name of ['Вася', 'Петя', 'Оля']) { await p.click('[data-act=add]'); await wait(250); await p.keyboard.press('Control+A'); await p.keyboard.type(name); await p.keyboard.press('Enter'); await wait(250); }
await p.click('[data-act=start]'); await wait(26000);
const cellOf = (name, i) => p.evaluate(([name, i]) => { const g = window.GAME; for (const [t, th] of g.rounds[0].themes.entries()) if (th.name === name) return { t, i }; }, [name, i]);
let c = await cellOf('Дырявый плейлист', 1);
await p.click(`.cell[data-t="${c.t}"][data-i="${c.i}"]`); await wait(4500);
console.log('kar pick', JSON.stringify(await con())); await shot('kar_pick');
await p.click('.picker .pk >> nth=0'); await wait(800);
console.log('kar ready', JSON.stringify(await con())); await shot('kar_ready');
await p.keyboard.press('Space'); await wait(6000);
const kst = await p.evaluate(() => { const A = window.__svi.karA, k1 = document.querySelector('#kar .k1'); return { playing: A && A.el ? !A.el.paused : null, t: A && A.el ? +A.el.currentTime.toFixed(2) : null, on: k1 ? k1.querySelectorAll('.w.on').length : -1, words: k1 ? k1.querySelectorAll('.w').length : -1 }; });
console.log('kar play', JSON.stringify(await con()), JSON.stringify(kst)); await shot('kar_play');
await p.keyboard.press('Space'); await wait(800); console.log('kar paused', await p.evaluate(() => window.__svi.karA && window.__svi.karA.el.paused));
await p.keyboard.press('Space'); await wait(800); console.log('kar resumed', await p.evaluate(() => window.__svi.karA && !window.__svi.karA.el.paused));
await p.keyboard.press('ArrowRight'); await wait(1200);
console.log('kar vote', JSON.stringify(await con())); await shot('kar_vote');
await p.click('[data-act=cwin][data-v=h]'); await wait(1500);
console.log('kar result', JSON.stringify(await con()), await scores()); await shot('kar_result');
await p.keyboard.press('ArrowRight'); await wait(1500);
// новые бонусы — на бонусных клетках раунда 1
const bonusCells = await p.evaluate(() => { const out = []; window.GAME.rounds[0].themes.forEach((th, t) => th.questions.forEach((q, i) => { if (q.type === 'bonus') out.push({ t, i }); })); return out; });
const list = ['tongue', 'laugh', 'arm', 'chain', 'toast', 'balance'];
for (const [n, id] of list.entries()) {
  const cc = bonusCells[n]; if (!cc) break;
  await p.evaluate(id => { window.__svi.force.con = id; }, id);
  await p.click(`.cell[data-t="${cc.t}"][data-i="${cc.i}"]`); await wait(3500);
  for (let k = 0; k < 20; k++) { const x = await con(); if (x && x.step !== 'spin') break; await wait(500); }
  let x = await con();
  if (x.step === 'pick') { await p.click('.picker .pk >> nth=0'); await wait(600); }
  for (let k = 0; k < 20; k++) { x = await con(); if (x.step === 'ready') break; await wait(500); }
  await shot(`b_${id}_ready`);
  await p.keyboard.press('Space'); await wait(1500);
  x = await con(); console.log(id, 'play', JSON.stringify(x)); await shot(`b_${id}_play`);
  if (id === 'tongue') await p.click('[data-act=csolo][data-v="1"]');
  else if (id === 'laugh') await p.click('[data-act=cstare][data-v=b]');
  else if (id === 'arm' || id === 'chain' || id === 'balance') await p.click('[data-act=cstare] >> nth=0');
  else if (id === 'toast') { await p.keyboard.press('ArrowRight'); await wait(800); console.log('toast turn b', JSON.stringify(await con())); await shot('b_toast_b'); await p.keyboard.press('ArrowRight'); await wait(800); console.log('toast vote', JSON.stringify(await con())); await p.click('[data-act=cwin][data-v=a]'); }
  await wait(1500); x = await con(); console.log(id, 'result', JSON.stringify(x), await scores()); await shot(`b_${id}_res`);
  await p.keyboard.press('ArrowRight'); await wait(1500);
}
console.log('ОШИБКИ:', errs.length ? errs.join('\n') : 'нет');
await b.close();
