// Stills of one fight at chosen moments, for comparing how the stage looks (the crowd, a venue) before and after a change.
// usage: node tools/clips/stills.mjs --seed 422 --at 176,179.5,182.6 [--venue stadium] [--size 540x960] [--out dist/stills/x]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEED = +arg('seed', 422), AT = arg('at', '176,179.5,182.6').split(',').map(Number), VENUE = arg('venue', ''), [W, H] = arg('size', '540x960').split('x').map(Number), OUT = arg('out', ROOT + 'dist/stills/shot');
mkdirSync(OUT.replace(/\/[^/]*$/, ''), {recursive: true});
const fonts = JSON.parse(readFileSync(ROOT + 'assets/fonts/fonts.json', 'utf8'));
const fontCss = fonts.map(f => `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};src:url(http://lab.test/fonts/${f.file}) format('woff2');unicode-range:${f.range}}`).join('\n');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const page = await (await browser.newContext({viewport: {width: W, height: H}})).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.route('**/three.min.js', r => r.fulfill({path: ROOT + 'node_modules/three/build/three.min.js', contentType: 'application/javascript'}));
await page.route('https://fonts.googleapis.com/**', r => r.fulfill({body: fontCss, contentType: 'text/css'}));
await page.route('http://lab.test/fonts/*', r => r.fulfill({path: ROOT + 'assets/fonts/' + r.request().url().split('/').pop(), contentType: 'font/woff2'}));
await page.route('http://lab.test/', r => r.fulfill({path: ROOT + 'dist/muay-fight-lab.html', contentType: 'text/html; charset=utf-8'}));
await page.goto('http://lab.test/', {timeout: 120000}); await page.waitForFunction('!!(window.LAB && LAB.fight)', null, {timeout: 120000});
if (VENUE) await page.evaluate(v => LAB.set({venue: v}), VENUE);
await page.evaluate(s => { LAB.newFight(s); document.getElementById('btnFull').click(); }, SEED); await page.waitForTimeout(1500);
for (const t of AT) {
  await page.evaluate(t => LAB.runTo(Math.max(0, t - 2.5), t), t); await page.waitForTimeout(900); // played up to t, so the crowd and the camera are as a viewer sees them
  await page.screenshot({path: `${OUT}-${t}.jpg`, type: 'jpeg', quality: 88});
}
console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'ok', AT.map(t => `${OUT}-${t}.jpg`).join(' '));
await browser.close();
