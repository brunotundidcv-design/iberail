// Zarping — PNG de cada SVG de zarping-marca/ (a 1x y @3x, fondo transparente). Uso: node tools/zarping/logos_png.mjs
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../zarping-marca');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const b = await chromium.launch();
for (const f of walk(dir).filter(f => f.endsWith('.svg'))) {
  const s = fs.readFileSync(f, 'utf8'), m = s.match(/width="(\d+)" height="(\d+)"/), w = +m[1], h = +m[2];
  const big = w < 400;   // los pequeños se sacan más grandes
  for (const [scale, suf] of [[big ? 4 : 1, ''], [big ? 12 : 3, '@3x']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
    await p.locator('svg').screenshot({ path: f.replace(/\.svg$/, suf + '.png'), omitBackground: true });
    await p.close();
  }
}
await b.close();
console.log('PNG listos en', dir);
