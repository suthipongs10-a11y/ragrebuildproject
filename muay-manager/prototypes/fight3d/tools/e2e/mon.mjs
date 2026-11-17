// Adverts and the one-time pack in test mode (?mon=test): the bonus after a win, the massage, the comeback after a loss,
// the daily caps, a closed advert gives nothing, the pack gives the bonuses without watching, and on the plain page
// (no ?mon) none of it is offered. Runs on the artifact build with an in-memory store; no server needed.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
writeFileSync(S + 'page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + readFileSync(ROOT + 'dist/muay-manager.html', 'utf8') + '</body></html>');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
let bad = 0; const ok = (c, what, got) => { console.log((c ? 'ok   ' : 'FAIL ') + what + (got !== undefined ? ' → ' + got : '')); if (!c) bad++; };
async function open(query) {
  const page = await (await browser.newContext({viewport: {width: 420, height: 860}})).newPage(); const errs = [];
  await page.addInitScript({path: ROOT + 'tools/e2e/mockdb.js'});
  page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('http://lab.test/**', r => r.fulfill({path: S + 'page.html', contentType: 'text/html'}));
  await page.goto('http://lab.test/' + query); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000}); await page.waitForTimeout(2000);
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  await ev("document.getElementById('gName').value='ทดสอบร้าน';document.querySelector('[data-act=create]').click()"); await wait(2500);
  return {page, ev, wait, errs, until: (js, ms) => page.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false)};
}
// one fight against a local opponent (0 easy, 2 hard), skipped to its result; returns the result card's state
async function fight(P, which) {
  await P.ev("document.querySelector('[data-act=tab][data-v=fight]').click()"); await P.wait(600);
  await P.ev(`document.querySelector('[data-act=pick][data-v=l${which}]').click()`); await P.wait(600);
  await P.ev("document.querySelector('[data-act=startfight]').click()");
  await P.until("!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && LAB.t > .2)", 60000);
  await P.ev("document.querySelector('[data-act=skip]').click()");
  await P.until("!!document.querySelector('#gBody [data-act=home]')", 60000);
  return P.ev("({win: /ชนะ/.test(document.querySelector('#gBody h2').textContent), money: GAME.save().money, fat: Math.round(GAME.save().fatigue), ad: (document.querySelector('#gBody [data-act=adr]') || {dataset: {}}).dataset.v || '', adText: (document.querySelector('#gBody [data-act=adr]') || {}).textContent || ''})");
}
const home = async P => { await P.ev("document.querySelector('#gBody [data-act=home]').click()"); await P.wait(1500); };
const ad = async (P, finish) => { await P.ev("document.querySelector('[data-act=adr]').click()"); await P.until("!!document.getElementById('monCard')", 5000); if (!finish) await P.ev("document.getElementById('monX').click()"); await P.until("!document.getElementById('monCard')", 8000); await P.wait(400); };

// ---- the plain page: nothing offered, the pack only says it is coming
{ const P = await open('');
  const r = await fight(P, 0);
  ok(r.ad === '', 'plain page: no advert button on the result card', r.ad || 'none'); await home(P);
  ok(await P.ev("!document.querySelector('[data-act=adr]') && !!document.querySelector('[data-act=vipsoon]') && !document.querySelector('[data-act=vipbuy]')"), 'plain page: no advert buttons at the camp, the pack says "coming to the app"');
  await P.ev("document.querySelector('[data-act=vipsoon]').click()"); await P.wait(400);
  ok(await P.ev("GAME.save().vipAsk === true && GAME.save().vip === false"), 'plain page: pressing the offer is noted, nothing is given');
  ok(!P.errs.length, 'plain page: no errors', P.errs.join(' | ')); await P.page.context().close(); }

// ---- test mode
const P = await open('?mon=test');
let wins = 0, losses = 0, purse = 0, massage = false;
for (let i = 0; i < 18 && (wins < 4 || !losses || !massage); i++) { // fights are not fixed: keep going until there were four wins, a loss and a tired evening
  const before = await P.ev("GAME.save().money"), r = await fight(P, wins < 4 ? 0 : 2);
  if (r.win) {
    wins++;
    if (wins === 1) { // close the advert early: nothing; then watch it: the purse again
      ok(r.ad === 'purse', 'after a win the purse advert is offered', r.adText.replace(/\s+/g, ' ').trim());
      await ad(P, false); ok(await P.ev("GAME.save().money") === r.money && await P.ev("!!document.querySelector('[data-act=adr]')"), 'advert closed early: no money, the offer stays');
      const sum = +((/฿\s*([\d,]+)/.exec(r.adText) || [])[1] || '0').replace(/,/g, '');
      await ad(P, true); const m2 = await P.ev("GAME.save().money"); ok(sum > 0 && m2 - r.money === sum && !await P.ev("!!document.querySelector('[data-act=adr]')"), 'advert watched: the sum on the button is paid, once', `${before} → ${r.money} → ${m2} (button said ฿${sum})`); purse++;
      await P.page.screenshot({path: S + 'mon-purse.png'});
    } else if (purse < 3) { await ad(P, true); purse++; }
    else ok(r.ad === '' && await P.ev("/ครบ 3 ครั้ง/.test(document.querySelector('#gBody').textContent)"), 'fourth win of the day: the cap of 3 is reached', 'no button');
  } else if (!losses) {
    losses++; ok(r.ad === 'revenge', 'after a loss the comeback advert is offered', r.adText.replace(/\s+/g, ' ').trim());
    const f0 = r.fat; await ad(P, true); const s2 = await P.ev("({fat: Math.round(GAME.save().fatigue), rematch: GAME.save().rematch})");
    ok(s2.fat < f0 && s2.rematch === 1, 'comeback: this fight\'s fatigue is taken off and the rematch is his', `${f0}% → ${s2.fat}%`);
  }
  await home(P);
  if (!massage) { // tired after a fight: the massage at the camp
    const f0 = await P.ev("Math.round(GAME.save().fatigue)");
    if (f0 >= 30) { massage = true; ok(await P.ev("(document.querySelector('[data-act=adr]') || {dataset: {}}).dataset.v") === 'massage', 'tired at the camp: the massage advert is offered'); await ad(P, true); ok(await P.ev("Math.round(GAME.save().fatigue)") === Math.max(0, f0 - 25), 'massage: fatigue down by 25', `${f0}% → ${await P.ev("Math.round(GAME.save().fatigue)")}%`); }
  }
  await P.ev("document.querySelector('[data-act=sleep]') && GAME.save().fatigue > 35 && document.querySelector('[data-act=sleep]').click()"); await P.wait(500); // a night's sleep keeps him fit to win; the caps count real days, so they stay
}
ok(wins >= 4 && losses >= 1 && massage, 'enough fights for the checks', `${wins} wins, ${losses} losses, massage tried: ${massage}`);
// ---- the pack
await P.ev("window.scrollTo(0, 0)");
ok(await P.ev("!!document.querySelector('[data-act=vipbuy]') && /฿99/.test(document.querySelector('[data-act=vipbuy]').textContent)"), 'the pack is offered with its price');
await P.ev("document.querySelector('[data-act=vipbuy]').click()"); await P.until("!!document.getElementById('monY')", 5000); await P.ev("document.getElementById('monX').click()"); await P.wait(500);
ok(await P.ev("GAME.save().vip") === false, 'purchase cancelled: nothing given');
await P.ev("document.querySelector('[data-act=vipbuy]').click()"); await P.until("!!document.getElementById('monY')", 5000); await P.ev("document.getElementById('monY').click()"); await P.wait(800);
ok(await P.ev("GAME.save().vip === true && GAME.save().own.colors.length === Object.keys(MUAY.COLORS).length && !document.querySelector('[data-act=vipbuy]')"), 'purchase confirmed: owner of the pack, every colour his, no more offer');
await P.ev("GAME.save().fatigue = 50; document.querySelector('[data-act=tab][data-v=train]').click()"); await P.wait(300); await P.ev("document.querySelector('[data-act=tab][data-v=home]').click()"); await P.wait(500);
const mb = await P.ev("(document.querySelector('[data-act=adr][data-v=massage]') || {}).textContent || ''");
if (mb) { await P.ev("document.querySelector('[data-act=adr][data-v=massage]').click()"); await P.wait(500); ok(/รับเลย/.test(mb) && !await P.ev("!!document.getElementById('monCard')") && await P.ev("Math.round(GAME.save().fatigue)") === 25, 'owner: the massage is taken at once, no advert', mb.replace(/\s+/g, ' ').trim()); }
else ok(await P.ev("/ครบ 2 ครั้ง/.test(document.querySelector('#gBody').textContent)"), 'owner: massage cap already reached today');
await P.ev("document.querySelector('[data-act=tab][data-v=rank]').click()"); await P.wait(600);
ok(await P.ev("!!document.querySelector('.rk.me .star')"), 'ranking: the gold star by his name');
await P.page.screenshot({path: S + 'mon-rank.png'});
await P.ev("document.querySelector('[data-act=tab][data-v=home]').click()"); await P.wait(500); await P.ev("document.querySelector('.gcard.vip').scrollIntoView()"); await P.page.screenshot({path: S + 'mon-owner.png'});
ok(!P.errs.length, 'test mode: no errors', P.errs.join(' | '));
console.log(bad ? bad + ' check(s) FAILED' : 'PASS');
await browser.close(); process.exit(bad ? 1 : 0);
