// A normal fight of the game (a ranked opponent): is the ring the opponent's venue (not the camp), does the round break
// stop for the plan, does "continue" go on, and does it reach a result?
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); // the cloud session has it on NODE_PATH
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true}); // screenshots go to dist/e2e (not committed)
import { readFileSync, writeFileSync } from 'node:fs';
const frag = readFileSync(ROOT + 'dist/muay-manager.html', 'utf8');
writeFileSync(S + 'page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + frag + '</body></html>');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 420, height: 860}}); const errs = [];
await page.addInitScript({path: ROOT + 'tools/e2e/mockdb.js'});
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
await page.route('**/fonts.googleapis.com/**', r => r.abort());
await page.route('http://lab.test/', r => r.fulfill({path: S + 'page.html', contentType: 'text/html'}));
await page.goto('http://lab.test/'); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000});
const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms), until = (js, ms) => page.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
await ev("document.getElementById('gName').value='ทดสอบเวที';document.querySelector('[data-act=create]').click()"); await wait(2500);
console.log('at the camp:', await ev("MUAY.venueNow()"), '· banner element:', await ev("!!document.getElementById('gMatch')"), '· version:', await ev("(document.getElementById('ver') || {}).textContent"));
await ev("document.querySelector('[data-act=tab][data-v=fight]').click()"); await wait(800);
await ev("document.querySelector('[data-act=pick][data-v=r]').click()"); await wait(800);
await ev("document.querySelector('[data-act=startfight]').click()");
console.log('fight on:', await until("!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && LAB.t > .2)", 40000));
console.log('venue in the fight:', await ev("MUAY.venueNow()"), '· speed button shown:', await ev("getComputedStyle(document.getElementById('btnSpeed')).display !== 'none'"));
await page.locator('#stage').screenshot({path: S + 'single-venue.png'});
const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => +(e.t + 2.3).toFixed(2))");
await ev(`LAB.seek(${pa[0]} - .4)`);
console.log('break panel:', await until("!!document.querySelector('#gBody [data-act=resume]')", 30000), await ev("(document.querySelector('#gBody h2') || {}).textContent"));
await ev("document.querySelector('.plan [data-act=plan][data-g=ag][data-v=attack]').click()"); await wait(300);
await ev("[...document.querySelectorAll('#gBody [data-act=resume]')].pop().click()");
await wait(500); console.log("after continue:", await ev("JSON.stringify({cor: LAB.cor.on, ct: +LAB.cor.t.toFixed(2), up: LAB.cor.upAfter, t: +LAB.t.toFixed(2)})")); console.log('goes on:', await until(`LAB.t > ${pa[0]} + .3`, 150000), '· round 2 plan:', await ev("JSON.stringify(LAB.cfg.plans[0][1])"));
await ev("document.querySelector('[data-act=skip]').click()");
console.log('result:', await until("!!document.querySelector('#gBody [data-act=home]')", 60000), await ev("(document.querySelector('#gBody h2') || {}).textContent"));
await ev("document.querySelector('#gBody [data-act=home]').click()"); await wait(2500);
console.log('back at the camp:', await ev("MUAY.venueNow()"));
console.log(errs.join('\n') || 'no errors');
await browser.close();
