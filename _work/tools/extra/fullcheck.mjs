// Итоговая проверка пака: node fullcheck.mjs SITE_DIR OUT_DIR
// SITE_DIR — копия сайта из ссылок, где media/music указывает на _private/media/music.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [, , site, out] = process.argv;
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [], miss = new Set();
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/WebSocket|mqtt|wss?:|net::ERR_(NAME|CONNECTION|INTERNET|TIMED)/i.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
p.on('requestfailed', r => { if (r.url().startsWith('file:')) miss.add(r.url().replace('file://' + site + '/', '')); });
const wait = ms => p.waitForTimeout(ms);
const shot = async n => { await p.screenshot({ path: `${out}/${n}.jpg`, quality: 65, type: 'jpeg' }); console.log('shot', n); };
const log = (...a) => console.log(...a);
const G = () => p.evaluate(() => window.GAME);
const cells = () => p.$$eval('.cell', cs => cs.length);
// найти клетку: тема по имени или первая клетка с нужным type
async function find(r, pred) {
  const g = await G();
  for (const [t, th] of g.rounds[r].themes.entries()) for (const [i, q] of th.questions.entries()) if (pred(th, q, i)) return { t, i, name: th.name, price: q.price };
  return null;
}
async function open(c, tag, ms = 3800) {
  await p.click(`.cell[data-t="${c.t}"][data-i="${c.i}"]`); await wait(ms); await shot(tag);
}
const undo = async () => { for (let k = 0; k < 8; k++) { await p.keyboard.press('Control+z'); await wait(1200); if (await cells()) return; } };
const menu = async act => { await p.click('[data-act=menu]'); await wait(500); await p.click(`[data-act=${act}]`); await wait(800); };

await p.goto('file://' + site + '/index.html?fx=full', { waitUntil: 'domcontentloaded', timeout: 90000 }); await wait(1500);
await p.keyboard.press('Space'); await wait(1000);
for (const name of ['Вася', 'Даша', 'Петя', 'Оля']) {
  await p.click('[data-act=add]'); await wait(250);
  await p.keyboard.press('Control+A'); await p.keyboard.type(name); await p.keyboard.press('Enter'); await wait(250);
}
await p.click('[data-act=start]'); await wait(26000);
log('Р1 клеток:', await cells()); await shot('r1_board');

// караоке с пропущенным словом
const kar = await find(0, (th, q) => th.name === 'Дырявый плейлист' && q.price === 200 && !q.type);
if (kar) { await open(kar, 'r1_karaoke_open', 9000); await p.keyboard.press('KeyA'); await wait(3000); await shot('r1_karaoke_answer'); await p.keyboard.press('Escape'); await wait(600); await p.keyboard.press('ArrowRight'); await wait(2500); log('после караоке клеток:', await cells()); }
// спецклетки: открыть, снять экран, отменить
for (const ty of ['trap', 'cat', 'auction', 'bonus']) {
  const c = await find(0, (th, q) => q.type === ty);
  if (!c) { log('нет клетки', ty); continue; }
  log(ty, '→', c.name, c.price); await open(c, 'r1_' + ty, 6500); if (ty === 'bonus') await wait(9000); await undo();
}
log('после отмен клеток:', await cells(), 'сыграно:', await p.$$eval('.cell.played', cs => cs.length));

// раунд 2: мешап
await menu('skipround'); await wait(4000); await shot('r1_results');
await p.keyboard.press('ArrowRight'); await wait(9000);
log('Р2 клеток:', await cells()); await shot('r2_board');
const mash = await find(1, (th, q) => q.type === 'mashup' && q.price === 200);
if (mash) { await open(mash, 'r2_mashup_q', 5000); await p.keyboard.press('KeyA'); await wait(3500); await shot('r2_mashup_answer'); await p.keyboard.press('Escape'); await wait(600); await p.keyboard.press('ArrowRight'); await wait(2500); }

// раунд 3 и финал
await menu('skipround'); await wait(4000); await p.keyboard.press('ArrowRight'); await wait(9000);
log('Р3 клеток:', await cells()); await shot('r3_board');
await menu('tofinal'); await wait(5000); await shot('final');

log('НЕ ЗАГРУЗИЛОСЬ:', miss.size ? '\n  ' + [...miss].slice(0, 30).join('\n  ') : 'нет');
log('ОШИБКИ:', errs.length ? '\n  ' + errs.slice(0, 20).join('\n  ') : 'нет');
await b.close();
