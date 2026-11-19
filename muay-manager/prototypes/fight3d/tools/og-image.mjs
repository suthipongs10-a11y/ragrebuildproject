// Makes site/og.jpg, the picture shown when the game's link is posted in a chat or a feed (1200 x 630): one frame of a
// fight from the lab page (build first), the game's name and one line over it.
// usage: node tools/og-image.mjs [venue] [seed] [second of the fight] [out]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [venue = 'stadium', seed = '7', t = '6.48', out = 'site/og.jpg'] = process.argv.slice(2), S = 'dist/og/'; mkdirSync(S, {recursive: true});
writeFileSync(S + 'page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + readFileSync('dist/muay-fight-lab.html', 'utf8') + '</body></html>');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 1240, height: 1000}, deviceScaleFactor: 2});
await page.route('**/three.min.js', r => r.fulfill({path: 'node_modules/three/build/three.min.js', contentType: 'application/javascript'}));
await page.route('**/fonts.googleapis.com/**', r => r.abort());
await page.route('http://lab.test/', r => r.fulfill({path: S + 'page.html', contentType: 'text/html'}));
await page.goto('http://lab.test/'); await page.waitForFunction("!!window.LAB && !!LAB.fight", null, {timeout: 60000}); await page.waitForTimeout(1500);
await page.evaluate(([v, s]) => { LAB.set({venue: v}); LAB.newFight(+s); }, [venue, seed]); await page.waitForTimeout(2500);
// only the picture and the words that pop up over a hit: no badges, no buttons
console.log('over the stage:', await page.evaluate("[...document.querySelectorAll('#stage > *')].map(e => { const k = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ').join('.') : ''); if (e.id !== 'cv') e.style.visibility = 'hidden'; return k; }).join(' ')"));
await page.evaluate(t => LAB.seek(t - .12), +t); await page.waitForTimeout(1500);
const frame = await page.locator('#cv').screenshot({type: 'png'}); writeFileSync(S + 'frame.png', frame);
const card = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1});
await card.setContent(`<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0e0f14}
.bg{position:absolute;inset:0;background:url(data:image/png;base64,${frame.toString('base64')}) center 38%/cover}
.sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,15,20,0) 42%,rgba(14,15,20,.72) 70%,rgba(14,15,20,.96) 100%)}
.tx{position:absolute;left:56px;right:56px;bottom:44px;color:#fff;font-family:'DejaVu Sans','Loma',sans-serif}
h1{margin:0;font-size:92px;line-height:1;font-weight:800;letter-spacing:2px;color:#ffd35a;text-shadow:0 4px 18px rgba(0,0,0,.7)}
p{margin:14px 0 0;font:600 40px/1.25 'Loma',sans-serif;text-shadow:0 2px 10px rgba(0,0,0,.8)}
</style><div class="bg"></div><div class="sh"></div><div class="tx"><h1>MUAY MANAGER</h1><p>เกมผู้จัดการค่ายมวยไทย · ดูนักมวยของคุณชกแบบ 3D</p></div>`);
await card.waitForTimeout(600);
writeFileSync(out, await card.screenshot({type: 'jpeg', quality: 86}));
console.log('written', out);
await browser.close();
