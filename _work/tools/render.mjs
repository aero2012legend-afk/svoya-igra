// Рендер HTML/SVG-файла в картинку через Chromium.
// node render.mjs input.(html|svg) output.(png|jpg|webp) [width=1280] [height=720]
// Для .webp сначала делается PNG, потом конвертация через python PIL.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [,, input, output, w = '1280', h = '720'] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve(input));
await p.waitForTimeout(400);
const ext = path.extname(output).toLowerCase();
const tmp = ext === '.png' ? output : output + '.tmp.png';
await p.screenshot({ path: tmp, omitBackground: false });
await b.close();
if (ext !== '.png') {
  execFileSync('python3', ['-c', `from PIL import Image; import os; im=Image.open('${tmp}').convert('RGB'); im.save('${output}', quality=85); os.remove('${tmp}')`]);
}
console.log('OK', output);
