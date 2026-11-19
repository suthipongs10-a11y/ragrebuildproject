// A device that will not open the 3D context asked for first: the game asks again for a plainer one and runs; a device
// that opens none is told what to try, not left with an empty page.
// usage: node tools/e2e/no-webgl.mjs      (build first)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
writeFileSync(S + 'page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + readFileSync(ROOT + 'dist/muay-manager.html', 'utf8') + '</body></html>');
let bad = 0, steps = 0; const ok = (c, what, got) => { steps++; if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); };
async function open(refuse) { // refuse(attributes) -> true when this device will not open such a context
  const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const page = await (await browser.newContext({viewport: {width: 390, height: 844}})).newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript({path: ROOT + 'tools/e2e/mockdb.js'});
  await page.addInitScript(`(() => { const real = HTMLCanvasElement.prototype.getContext, refuse = ${refuse}; window.__asked = [];
    HTMLCanvasElement.prototype.getContext = function (type, at) { if (/webgl/.test(type) && this.id === 'cv') { window.__asked.push(JSON.stringify(at || {})); if (refuse(at || {})) return null; } return real.call(this, type, at); }; })()`);
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('http://lab.test/**', r => r.fulfill({path: S + 'page.html', contentType: 'text/html'}));
  await page.goto('http://lab.test/'); await page.waitForTimeout(6000);
  return {browser, page, errs};
}
{ // the first kind (smoothed, fast chip) is refused; a plainer one opens
  const {browser, page, errs} = await open('at => at.antialias === true');
  const up = await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000}).then(() => true, () => false);
  ok(up && await page.evaluate('window.MUAY_GL_TRY') === 2 && !await page.evaluate("!!document.getElementById('noGl')"), 'the first context is refused: the game opens on the second try', JSON.stringify({try: await page.evaluate('window.MUAY_GL_TRY'), asked: (await page.evaluate('window.__asked')).length, errs: errs.slice(0, 2)}));
  await browser.close();
}
{ // none opens: the page says what to do
  const {browser, page, errs} = await open('at => true');
  const said = await page.evaluate("(e => !!e && e.getBoundingClientRect().height > 300 && /เปิดภาพ 3D ของเกมไม่ได้/.test(e.innerText) && /เปิดในเบราว์เซอร์/.test(e.innerText) && !!e.querySelector('button'))(document.getElementById('noGl'))");
  ok(said, 'no context at all: the page says so and what to try', errs.slice(0, 1).join(''));
  ok(errs.some(e => /WebGL|context/i.test(e)), 'and the error still reaches the error log (it is thrown on)');
  await page.screenshot({path: S + 'no-webgl.png'}).catch(() => {});
  await browser.close();
}
console.log(bad ? bad + ' of ' + steps + ' checks FAILED' : 'all ' + steps + ' checks passed'); process.exit(bad ? 1 : 0);
