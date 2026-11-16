// An open game notices a newer build on the server (version.json) and loads it by itself, once, and not during a fight.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); // the cloud session has it on NODE_PATH
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true}); // screenshots go to dist/e2e (not committed)
import { readFileSync, writeFileSync } from 'node:fs';
const V = ROOT + 'dist/site/version.json', keep = readFileSync(V, 'utf8');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 420, height: 800}}); let loads = 0; const errs = [];
page.on('load', () => loads++); page.on('pageerror', e => errs.push(e.message));
await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
await page.route('**/fonts.googleapis.com/**', r => r.abort());
try {
  await page.goto('http://127.0.0.1:8788/'); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000});
  await page.evaluate("document.getElementById('gName').value='ทดสอบรุ่น';document.querySelector('[data-act=create]').click()"); await page.waitForTimeout(4000);
  console.log('loads so far:', loads, '· same build on the server: reload?', await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))") && false);
  await page.waitForTimeout(4000); console.log('loads:', loads, '(expected 1)');
  writeFileSync(V, JSON.stringify({build: 999, ver: 'x'}) + '\n');
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await page.waitForTimeout(9000); console.log('newer build on the server → loads:', loads, '(expected 2)');
  await page.waitForFunction("!!window.MUAY && !!document.querySelector('[data-act=tab]')", null, {timeout: 60000});
  await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
  await page.waitForTimeout(8000); console.log('still newer right after the reload → loads:', loads, '(expected 2: not again within 90 s)');
  console.log('save kept:', await page.evaluate("(document.querySelector('.gbar .who b') || {}).textContent"));
} finally { writeFileSync(V, keep); }
console.log(errs.join('\n') || 'no errors');
await browser.close();
