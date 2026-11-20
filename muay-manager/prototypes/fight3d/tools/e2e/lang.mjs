// The game in another language (default English): walks the screens a player sees and lists every Thai text still on
// them (src/i18n.js counts each text it had no line for). Writes dist/e2e/lang-miss-<lang>.json (text -> times seen,
// and the screen it was first seen on) and prints how many are left; with --list it prints them too.
// usage: node tools/e2e/lang.mjs [en] [--list]     (build first)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
const LANG = process.argv.slice(2).find(a => !a.startsWith('--')) || 'en', LIST = process.argv.includes('--list'), SHOTS = process.argv.includes('--shots'); let shot = 0;
writeFileSync(S + 'page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + readFileSync(ROOT + 'dist/muay-manager.html', 'utf8') + '</body></html>');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await (await browser.newContext({viewport: {width: 390, height: 844}})).newPage(), errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.addInitScript({path: ROOT + 'tools/e2e/mockdb.js'});
await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
await page.route('**/fonts.googleapis.com/**', r => r.abort());
await page.route('http://lab.test/**', r => r.fulfill({path: S + 'page.html', contentType: 'text/html'}));
await page.goto('http://lab.test/?lang=' + LANG); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000}); await page.waitForTimeout(1500);
const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
const until = (js, ms) => page.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
const click = async (sel, pause) => { const ok = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); await wait(pause == null ? 500 : pause); return ok; };
const where = {}, over = {}; let screen = 'creation';
// Text that does not fit at phone width (English runs longer than Thai): the page scrolling sideways, an element reaching
// past the screen's edge, or text cut off inside its box. The news strip moves past the edge on purpose and is left out.
const OVER = `(() => { const vw = innerWidth, out = []; if (document.documentElement.scrollWidth > vw + 1) out.push('the page scrolls sideways (' + document.documentElement.scrollWidth + ' px)');
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('script,style,canvas,#gNews,.news,.ticker') || !el.getClientRects().length || el.children.length > 2) continue;
    const t = el.textContent.trim(); if (!t) continue; const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || r.width < 2) continue;
    const cut = el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && (cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis');
    if (r.right > vw + 1 || cut) out.push((r.right > vw + 1 ? 'past the edge ' : 'cut off ') + el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/ +/).join('.') : '') + ': ' + t.replace(/\\s+/g, ' ').slice(0, 60));
  } return [...new Set(out)]; })()`;
const mark = async name => { const m = await ev('JSON.stringify([...((window.__i18n && window.__i18n.miss) || new Map()).keys()])'); for (const k of JSON.parse(m)) if (!where[k]) where[k] = screen; for (const o of await ev(OVER)) if (!over[o]) over[o] = screen; if (SHOTS) await page.screenshot({path: S + 'lang-' + LANG + '-' + String(++shot).padStart(2, '0') + '-' + name.replace(/[^a-z]+/gi, '-').slice(0, 30) + '.png'}); screen = name; };
// what the player sees, screen by screen
await mark('creation (body, style, looks)'); for (const b of ['f', 'l']) await click(`[data-act=body][data-v=${b}]`, 400); await click('[data-act=create]', 300); // an empty name: the warning
await ev("document.getElementById('gName').value = 'Tester'"); await click('[data-act=create]', 2500);
await mark('camp'); for (const t of ['train', 'dress', 'fight', 'rank', 'home']) { await click(`[data-act=tab][data-v=${t}]`, 900); await mark(t); }
for (const v of ['settings', 'watch', 'hall', 'news']) { await click(`[data-act=${v}]`, 700); await mark(v); await click(`[data-act=${v}]`, 400); }
await click('[data-act=tab][data-v=train]', 700); if (await click('[data-act=train][data-v=bag]', 2500)) { await mark('drill: heavy bag'); await click('[data-act=drillend]', 800); await click('[data-act=drillquit]', 800); }
await click('[data-act=tab][data-v=home]', 700); await click('[data-act=sleep]', 900); await mark('a new day');
await click('[data-act=tab][data-v=fight]', 700); await click('[data-act=pick][data-v=l0]', 900); await mark('before the bell');
const seen = await ev('window.LAB && LAB.fight ? LAB.cfg.seed : null'); await click('[data-act=startfight]', 0);
if (await until(`!!(window.LAB && LAB.fight && LAB.cfg.seed !== ${seen} && document.querySelector('.app.g-fight') && LAB.t > .2)`, 60000)) {
  await wait(3000); await mark('in the fight');
  const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => e.t + 2.3)");
  if (pa.length) { await ev(`LAB.seek(${pa[0]} - .4)`); await until("!!document.querySelector('#gBody [data-act=resume]')", 40000); await wait(1500); await mark('the round break'); await click('#gBody .btn.go.wide[data-act=resume]', 600); }
  await ev('GAME.save().skip = null'); await click('#gBody [data-act=skip]', 0); await until("!!document.querySelector('#gBody [data-act=home]')", 90000); await wait(2500); await mark('the result');
  await click('#gBody [data-act=home]', 1500);
}
await click('[data-act=tab][data-v=fight]', 700); await mark('fight menu after a fight'); await click('[data-act=tab][data-v=home]', 700); await mark('end');
const m = JSON.parse(await ev('JSON.stringify([...window.__i18n.miss.entries()])')).sort((a, b) => b[1] - a[1]);
const thaiLeft = await ev("(() => { const out = []; const w = document.createTreeWalker(document.body, 4); for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (!p || p.closest('script,style')) continue; if (/[\\u0e01-\\u0e3a\\u0e40-\\u0e5b]]/.test(n.nodeValue)) out.push(n.nodeValue.trim().slice(0, 60)); } return out.length; })()");
writeFileSync(S + 'lang-miss-' + LANG + '.json', JSON.stringify(m.map(([k, n]) => ({text: k, n, screen: where[k] || screen})), null, 1));
console.log(LANG + ': ' + m.length + ' texts without a line · Thai text nodes on the last screen: ' + thaiLeft + (errs.length ? ' · script errors: ' + errs.slice(0, 3).join(' | ') : ''));
writeFileSync(S + 'lang-over-' + LANG + '.json', JSON.stringify(Object.entries(over).map(([what, scr]) => ({what, screen: scr})), null, 1));
console.log(LANG + ': ' + Object.keys(over).length + ' places where text does not fit at 390 px (dist/e2e/lang-over-' + LANG + '.json)');
if (LIST) m.forEach(([k, n]) => console.log(String(n).padStart(4), (where[k] || '').padEnd(28), k));
await browser.close();
