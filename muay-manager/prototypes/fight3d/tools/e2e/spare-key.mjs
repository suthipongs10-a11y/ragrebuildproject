// The player's key lost from the browser while the save is still there (seen on Safari, 26 Nov 2026): the game must
// carry on as the same player (the spare kept in the save), not sign up a new one; the spare never reaches the server.
// Also: where the player came from (?from=itch) lands in his private save.   needs server/server.mjs on 8788
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
let bad = 0, n = 0; const ok = (c, what, got) => { n++; if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + what + (got !== undefined ? ' → ' + got : '')); };
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await (await browser.newContext({viewport: {width: 390, height: 844}})).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const up = () => page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 120000});
await page.goto('http://127.0.0.1:8788/?from=itch'); await up();
await page.evaluate("document.getElementById('gName').value = 'กุญแจสำรอง'; document.querySelector('[data-act=create]').click()");
await page.waitForFunction('!!(GAME.save() && GAME.uid())', null, {timeout: 60000});
const uid = await page.evaluate('GAME.uid()');
await page.waitForFunction('!!GAME.save()._k', null, {timeout: 30000}).catch(() => {});
ok(await page.evaluate('GAME.save()._k && GAME.save()._k.id === GAME.uid()'), 'the save keeps a spare of the key on the device');
ok(await page.evaluate("GAME.save().use.src") === 'itch', 'the save knows the player came from itch.io', await page.evaluate("GAME.save().use.src"));
await page.waitForTimeout(4000);
const cloud = await (await fetch('http://127.0.0.1:8788/api/db/data/users/' + uid + '/save', {headers: {Authorization: 'Bearer ' + JSON.parse(await page.evaluate("localStorage.getItem('muaySitePlayer')")).id + '.' + JSON.parse(await page.evaluate("localStorage.getItem('muaySitePlayer')")).secret}})).json();
ok(cloud.data && !('_k' in cloud.data) && cloud.data.use && cloud.data.use.src === 'itch', 'the save on the server has the source but no key', cloud.data ? Object.keys(cloud.data).includes('_k') : 'no save');
// the key goes missing, the save stays
await page.evaluate("localStorage.removeItem('muaySitePlayer')"); await page.goto('http://127.0.0.1:8788/'); await page.waitForFunction('!!(window.MUAY && window.GAME && GAME.save())', null, {timeout: 120000});
await page.waitForFunction('!!(GAME.save() && GAME.uid())', null, {timeout: 60000});
ok(await page.evaluate('GAME.uid()') === uid, 'with the key gone from the browser, the game is still the same player', await page.evaluate('GAME.uid()'));
ok(await page.evaluate("JSON.parse(localStorage.getItem('muaySitePlayer')).id") === uid, 'and the key is back in its place');
ok(await page.evaluate("GAME.save().use.src") === 'itch', 'the source stays the first one (this visit came direct)');
ok(errs.length === 0, 'no script errors', errs.slice(0, 2).join(' | '));
await browser.close();
console.log(bad ? `${bad} of ${n} checks FAILED` : `all ${n} checks passed`); process.exit(bad ? 1 : 0);
