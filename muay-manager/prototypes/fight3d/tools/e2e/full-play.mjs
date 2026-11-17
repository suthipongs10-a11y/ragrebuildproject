// A full play-through of the game's features on a phone-sized screen, by a bot: creation, every training activity,
// staff, camp upgrade, outfits, signature moves, every kind of fight (local, ranked, rope-fist, rival, title, defence),
// a tournament to its final, the days in between, the trophy room, exhibitions, settings, and starting over.
// After every step: no script errors, no sideways scrolling, and a save that makes sense (no NaN, nothing negative).
// Runs on the artifact build with an in-memory store; no server needed.   usage: node tools/e2e/full-play.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/', THREE = ROOT + 'node_modules/three/build/three.min.js'; mkdirSync(S, {recursive: true});
writeFileSync(S + 'page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>' + readFileSync(ROOT + 'dist/muay-manager.html', 'utf8') + '</body></html>');
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await (await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 1, hasTouch: true})).newPage();
const errs = []; let bad = 0, steps = 0;
page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
await page.addInitScript({path: ROOT + 'tools/e2e/mockdb.js'});
await page.addInitScript(() => { const st = window.__mock.store; delete st['challenges/other1']; }); // no challenge banner over the screens being checked
await page.route('**/three.min.js', r => r.fulfill({path: THREE, contentType: 'application/javascript'}));
await page.route('**/fonts.googleapis.com/**', r => r.abort());
await page.route('http://lab.test/**', r => r.fulfill({path: S + 'page.html', contentType: 'text/html'}));
await page.goto('http://lab.test/'); await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 60000}); await page.waitForTimeout(2000);
const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
const until = (js, ms) => page.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(4) + 's';
const ok = (c, what, got) => { steps++; if (!c) bad++; console.log(T(), (c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
const has = sel => ev(`!!document.querySelector(${JSON.stringify(sel)})`);
const click = async (sel, pause) => { const done = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); await wait(pause == null ? 500 : pause); return done; };
const tab = async t => { await click(`[data-act=tab][data-v=${t}]`, 600); };
const save = js => ev(`(() => { const S = GAME.save(); ${js} })()`);
// what must hold after every step
async function sane(where) {
  const r = await ev(`(() => { const S = GAME.save(), out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 2) out.push('page is wider than the screen by ' + (document.documentElement.scrollWidth - window.innerWidth) + 'px');
    if (!S) return out;
    const num = (k, v, lo, hi) => { if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) out.push(k + ' = ' + v); };
    num('money', S.money, 0, 1e9); num('fame', S.fame, 0, 1e7); num('rp', S.rp, 0, 5000); num('fatigue', S.fatigue, 0, 100); num('day', S.day, 1, 1e5); num('slots', S.slots, 0, 3); num('mood', S.mood, 0, 4); num('gym', S.gym, 1, 5);
    for (const k in S.stats) num('stat ' + k, S.stats[k], 20, 100);
    num('wins', S.rec.w, 0, 1e5); num('losses', S.rec.l, 0, 1e5);
    if (/NaN|undefined|\\[object/.test(document.getElementById('gBody').innerText + document.getElementById('gTop').innerText)) out.push('the screen shows NaN / undefined: ' + (document.getElementById('gBody').innerText.match(/.{0,30}(NaN|undefined|\\[object).{0,20}/) || [''])[0].replace(/\\s+/g, ' '));
    return out; })()`);
  const e = errs.splice(0);
  ok(!r.length && !e.length, where, r.concat(e).join(' | '));
}
// one fight from the plan screen on: a plan, into the ring, a round break when it comes, then skipped to the result
async function fight(pick, opt = {}) {
  await tab('fight');
  if (!await click(`[data-act=pick][data-v=${pick}]`, 800)) return null;
  if (!await has('[data-act=startfight]')) return null;
  if (opt.plan) await click(`.plan [data-act=plan][data-g=${opt.plan[0]}][data-v=${opt.plan[1]}]`, 300);
  if (opt.backout) { await click('[data-act=backout]', 600); return 'backed out'; }
  if (opt.before) await opt.before();
  const seen = await ev('window.LAB && LAB.fight ? LAB.cfg.seed : null'); // the fight before this one is still in LAB until the new one starts
  await click('[data-act=startfight]', 0);
  if (!await until(`!!(window.LAB && LAB.fight && LAB.cfg.seed !== ${seen} && document.querySelector('.app.g-fight') && LAB.t > .2)`, 60000)) return null;
  const venue = await ev('MUAY.venueNow()'), specs = await ev("LAB.cfg.specs.map(s => Object.values(s.stats).join('/')).join(' v ')");
  if (opt.round) { // to the first round break: a quick order, then on
    const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => e.t + 2.3)");
    if (pa.length) { await ev(`LAB.seek(${pa[0]} - .4)`); if (await until("!!document.querySelector('#gBody [data-act=resume]')", 40000)) { await click('[data-act=quick][data-v=press]', 300); await click('#gBody .btn.go.wide[data-act=resume]', 300); } }
  }
  await click('[data-act=skip]', 0);
  if (!await until("!!document.querySelector('#gBody [data-act=home]')", 90000)) return null;
  const r = await ev("({win: /ชนะ/.test(document.querySelector('#gBody h2').textContent), head: document.querySelector('#gBody h2').textContent, venue: '" + venue + "', specs: '" + specs + "'})");
  if (opt.ceremony) { await wait(opt.ceremony); await page.locator('#stage').screenshot({path: S + 'full-' + opt.shot + '.png'}); }
  await click('#gBody [data-act=home]', 1500);
  return r;
}
const strong = () => save("for (const k in S.stats) S.stats[k] = 96; S.fatigue = 0; S.mood = 4;");
const weak = () => save("for (const k in S.stats) S.stats[k] = 22; S.fatigue = 0;");

// ---- 1. creation
await ev("document.getElementById('gName').value = 'บอทเล่นครบ'");
await click('[data-act=body][data-v=f]'); await click('[data-act=style][data-v=kicker]');
for (const [f, v] of [['skin', 'tan'], ['hair', 'red'], ['shorts', 'purple'], ['pattern', 'split'], ['trim', 'gold'], ['gloves', 'black'], ['band', 'gold'], ['beard', 'goatee']]) await click(`[data-act=dlook][data-f=${f}][data-v=${v}]`, 400);
await wait(1200); await page.locator('#stage').screenshot({path: S + 'full-create.png'});
// the body that comes with a beard is offered none; the choice is back with another body
await click('[data-act=body][data-v=l]', 500); ok(!await has('[data-act=dlook][data-f=beard]') && !await has('[data-act=dlook][data-f=hair]'), 'the bearded, bald body is offered neither facial hair nor hair colour');
await click('[data-act=body][data-v=f]', 500); await click('[data-act=dlook][data-f=beard][data-v=goatee]', 400);
await click('[data-act=create]', 2500);
ok(await ev("GAME.save().name === 'บอทเล่นครบ' && GAME.save().style === 'kicker' && GAME.save().look.skin === 'tan' && GAME.save().look.beard === 'goatee'"), 'a fighter is created with the chosen body, style and look');
await sane('home screen');
for (const t of ['train', 'dress', 'fight', 'rank', 'home']) { await tab(t); ok(await ev("document.getElementById('gBody').innerText.length > 80"), 'tab ' + t + ' shows its screen'); await sane('tab ' + t); }

// ---- 2. training: every activity once
const acts = await (async () => { await tab('train'); return ev("[...document.querySelectorAll('[data-act=train]')].map(b => b.dataset.v)"); })();
ok(acts.length === 8, 'eight training activities are offered', acts.join(','));
let drillShot = false;
for (const a of acts) {
  await save('S.slots = 3; S.fatigue = 10;'); await tab('home'); await tab('train');
  const before = await ev('GAME.save().slots'), st0 = await ev('JSON.stringify(GAME.save().stats)');
  await click(`[data-act=train][data-v=${a}]`, 1200);
  let how = '';
  if (await ev('!!GAME.drill()')) { // a drill in 3D: press a few of the trainer's calls, then let it run out
    how = 'drill'; await until('GAME.drill() && GAME.drill().ready', 30000);
    for (let i = 0; i < 6; i++) { await ev("(() => { const d = GAME.drill(); if (!d) return; const n = d.notes.find(x => !x.res); if (n) GAME.press(n.kind); })()"); await wait(700); }
    if (!drillShot) { drillShot = true; await page.screenshot({path: S + 'full-drill.png'}); }
    if (a === 'spar') await click('[data-act=drillquit]', 1200); else await until('!GAME.drill()', 120000);
  } else if (await ev('!!GAME.scene()')) { how = 'scene'; await wait(1500); for (let i = 0; i < 4; i++) { await ev("GAME.scenePress('pull')"); await wait(300); } await click('[data-act=sceneskip]', 1200); await until('!GAME.scene()', 20000); }
  else if (await has('[data-act=hit]')) { how = 'timing bar'; await wait(500); await click('[data-act=hit]', 800); }
  else how = 'instant (or failed)';
  await wait(600);
  const after = await ev('GAME.save().slots'), msg = await ev("((document.querySelector('#gBody .gain') || document.querySelector('#gBody .warn') || {}).textContent || '').slice(0, 70)");
  ok(a === 'spar' ? true : after === before - 1, 'training ' + a + ' (' + how + ') uses one slot and reports', msg || '(no message)');
  await sane('after training ' + a);
  void st0;
}
// the coach trains instead: one activity, then the rest of the day
await save('S.slots = 3; S.money = 5000; S.fatigue = 0;'); await tab('home'); await tab('train');
const m0 = await ev('GAME.save().money'); await click('[data-act=autotrain]', 700);
ok(await ev('GAME.save().slots') === 2, 'the coach runs one session', 'money ' + m0 + ' → ' + await ev('GAME.save().money'));
await click('[data-act=autoday]', 700); ok(await ev('GAME.save().slots') === 0, 'the coach runs the rest of the day'); await sane('after coached training');

// ---- 3. the camp: staff, upgrade, sleep
await save('S.money = 60000;'); await tab('home');
const staff = await ev("[...document.querySelectorAll('[data-act=staff]')].map(b => b.dataset.v)");
for (const id of staff) await click(`[data-act=staff][data-v=${id}]`, 400);
ok(await ev('GAME.save().staff.length') === staff.length && staff.length > 0, 'every staff member can be hired', staff.join(','));
await click(`[data-act=staff][data-v=${staff[0]}]`, 400); ok(await ev('GAME.save().staff.length') === staff.length - 1, 'and let go again');
for (let i = 0; i < 4; i++) await click('[data-act=gym]', 500);
ok(await ev('GAME.save().gym') === 5 && !await has('[data-act=gym]'), 'the camp is upgraded to level 5', 'money left ' + await ev('GAME.save().money')); await sane('camp level 5');
await page.screenshot({path: S + 'full-camp5.png'});
const d0 = await ev('GAME.save().day'); await click('[data-act=sleep]', 900);
ok(await ev('GAME.save().day') === d0 + 1 && await ev('GAME.save().slots') === 3, 'a night\'s sleep starts the next day with three sessions'); await sane('after sleeping');

// ---- 4. outfits and signature moves
await tab('dress');
await click('[data-act=look][data-f=shorts][data-v=orange]', 500);
ok(await has('[data-act=buy]'), 'a colour he does not own asks to be bought'); await click('[data-act=buy]', 600);
ok(await ev("GAME.save().look.shorts === 'orange' && GAME.save().own.colors.includes('orange')"), 'bought and worn');
await click('[data-act=look][data-f=head][data-v=mongkol]', 500); await click('[data-act=buy]', 600); await click('[data-act=look][data-f=skin][data-v=dark]', 500);
await ev("document.getElementById('gdname').value = 'บอทเปลี่ยนชื่อ'; document.getElementById('gdname').dispatchEvent(new Event('change', {bubbles: true}))"); await wait(400);
ok(await ev("GAME.save().look.head === 'mongkol' && GAME.save().look.skin === 'dark' && GAME.save().name === 'บอทเปลี่ยนชื่อ'"), 'headpiece, skin tone and a new name are kept', await ev('GAME.save().name')); await sane('dressing room');
await tab('home');
const learn = await ev("(document.querySelector('[data-act=splearn]') || {dataset: {}}).dataset.v || ''");
if (learn) { await click(`[data-act=splearn][data-v=${learn}]`, 600); ok(await ev(`GAME.save().spOwn.includes('${learn}')`), 'a signature move is learned', learn); }
const up = await ev("(document.querySelector('[data-act=spup]') || {dataset: {}}).dataset.v || ''");
if (up) { await click(`[data-act=spup][data-v=${up}]`, 600); ok(await ev(`(GAME.save().spLv['${up}'] || 1) >= 2`), 'and trained to the next level', up); }
await click('[data-act=sp]', 500); await sane('signature moves');

// ---- 5. fights of every kind
await strong();
const venues = new Set();
let r = await fight('l0', {backout: true}); ok(r === 'backed out' && await ev('!document.querySelector(".app.g-fight")'), 'stepping back from the plan screen returns to the menu');
r = await fight('l0', {plan: ['ag', 'attack'], round: true}); ok(!!r, 'local fight (easy) with a round break and a quick order', r && r.head); // an easy opponent still wins now and then: the result is not part of the check if (r) venues.add(r.venue); await sane('after a local fight');
r = await fight('l1'); ok(!!r, 'local fight (even)', r && r.head); await sane('after local fight 2');
await save('S.noBreak = true;'); r = await fight('l2', {plan: ['range', 'out']}); ok(!!r, 'local fight (hard), no stopping between rounds', r && r.head); await save('S.noBreak = false;'); await sane('after local fight 3');
await save('S.fatigue = 0;'); r = await fight('c'); ok(!!r && r.venue === 'chuek', 'rope-fist bout at the old ground', r && r.head + ' @' + r.venue); if (r) venues.add(r.venue); await sane('after the rope-fist bout');
await save('S.fatigue = 0;'); const rp0 = await ev('GAME.save().rp'); r = await fight('r'); ok(!!r && await ev('GAME.save().rp') !== rp0, 'ranked fight moves the ranking points', rp0 + ' → ' + await ev('GAME.save().rp')); if (r) venues.add(r.venue); await sane('after a ranked fight');
// a loss makes a rival; the rematch is on the menu and winning it clears him
await save('S.rivals = [];'); await strong(); r = await fight('l2', {before: weak});
const foe = await ev("(GAME.save().rivals[0] || {}).name || ''");
ok(r && !r.win && !!foe && await ev('GAME.save().rivals.length') === 1, 'a loss puts the opponent on the rivals list', r && r.head + ' · ' + r.specs + ' · rival: ' + foe); await sane('after a loss');
await strong(); await save('S.rematch = 1; for (const k in S.rivals[0].stats) S.rivals[0].stats[k] = 40;'); await tab('fight'); ok(await ev(`document.querySelector('#gBody').innerText.includes(${JSON.stringify('ไฟต์ล้างตา')})`) && await has('[data-act=pick][data-v=v]'), 'the rematch is offered on the fight menu');
r = await fight('v'); ok(r && r.win && await ev('GAME.save().rivals.length') === 0 && await ev('GAME.save().rematch') === 0, 'the rematch is won and the rival is cleared', r && r.head + ' · ' + r.specs); await sane('after the rematch');
// the title of his league, then its defence
await save("S.rp = 1045; S.title = 1; S.fatigue = 0; S.ranked = 2;"); await strong();
r = await fight('t', {ceremony: 24000, shot: 'belt'}); ok(r && r.win && await ev('GAME.save().belts.length') === 1, 'a title fight is won: the belt is his', r && r.head); if (r) venues.add(r.venue); await sane('after the title fight');
await tab('home'); await click('[data-act=hall]', 700); ok(await ev("document.querySelectorAll('#gBody .hitem, #gBody .hshelf *').length > 0"), 'the trophy room shows the belt'); await page.screenshot({path: S + 'full-hall.png'}); await sane('trophy room'); await click('[data-act=hall]', 500);
await save('S.day = S.defendDue; S.fatigue = 0;'); await strong(); await tab('home');
await weak(); r = await fight('d', {before: strong}); ok(r && r.win && await ev('GAME.save().belts.length') === 1 && await ev('GAME.save().defends') === 1, 'the title is defended: the belt stays', r && r.head + ' · ' + r.specs); await sane('after the defence');
// the next challenger wins: the belt is gone, and no defence is owed any more
await save('S.day = S.defendDue; S.fatigue = 0;'); await strong(); await tab('home');
r = await fight('d', {before: weak}); ok(r && !r.win && await ev('GAME.save().belts.length') === 0, 'a lost defence takes the belt away', r && r.head + ' · ' + r.specs);
await tab('fight'); ok(!await has('[data-act=pick][data-v=d]'), 'no defence is on the menu without a belt'); await sane('after the lost defence');

// the barber is free: facial hair changes at once, with nothing to buy
{ const m0 = await ev('GAME.save().money'); await tab('dress'); await click('[data-act=look][data-f=beard][data-v=full]', 900);
  ok(await ev("GAME.save().look.beard === 'full'") && await ev('GAME.save().money') === m0 && !await has('[data-act=buy]'), 'facial hair is changed in the dressing room for free'); await page.locator('#stage').screenshot({path: S + 'full-beard.png'}); await sane('dressing room after the barber'); }

// ---- 6. a tournament to the cup
await save('S.fatigue = 0; S.money = 20000;'); await strong(); await tab('fight');
ok(await click('[data-act=tourjoin][data-v="0"]', 800) && await ev('!!GAME.save().tour'), 'the temple-fair tournament is entered');
let rounds = 0, champ = false;
for (let i = 0; i < 6 && !champ; i++) {
  await save('S.fatigue = 0;'); await strong(); await tab('fight');
  if (await has('[data-act=pick][data-v=u]')) {
    const final = await ev("(() => { const t = GAME.save().tour; return t.rounds[t.res.length].length === 2; })()");
    r = await fight('u', final ? {ceremony: 24000, shot: 'cup'} : {}); rounds++; ok(r && r.win, 'tournament round ' + rounds + (final ? ' (the final)' : ''), r && r.head); await sane('after tournament round ' + rounds);
    await tab('fight'); if (await has('[data-act=tourwatch]')) { await click('[data-act=tourwatch]', 0); if (await until("!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && LAB.t > .2)", 60000)) { await wait(1500); await click('[data-act=skip]', 0); await until("!!document.querySelector('#gBody [data-act=home], #gBody [data-act=watchmore]')", 60000); await click('#gBody [data-act=home]', 1200); } await sane('watching another bout of the tournament'); }
  }
  champ = await ev("(() => { const t = GAME.save().tour; return !!t && t.champ != null && t.ents[t.champ].me === true; })()");
  if (!champ) { await tab('home'); await click('[data-act=sleep]', 900); }
}
ok(champ && rounds === 3, 'three rounds won: champion of the tournament', rounds + ' rounds');
ok(await ev("GAME.save().honors.some(h => h.k === 'cup')"), 'the cup is in the trophy room');
await tab('fight'); await click('[data-act=tourclose]', 600); ok(await ev('GAME.save().tour === null'), 'the finished bracket can be closed'); await sane('after the tournament');

// ---- 6b. every league has its own ring
for (const [rp, want] of [[1150, 'temple'], [1300, 'province'], [1450, 'stadium'], [1650, 'champ']]) {
  await save(`S.rp = ${rp}; S.ranked = 2; S.fatigue = 0;`); await strong();
  r = await fight('r'); ok(!!r && r.venue === want, 'ranked fight at RP ' + rp + ' is held at: ' + want, r && r.head + ' @' + r.venue); if (r) venues.add(r.venue); await sane('after the ranked fight at RP ' + rp);
}

// ---- 7. days go by: wages, sponsors, missions; an exhibition; settings
for (let i = 0; i < 3; i++) { await tab('home'); await click('[data-act=sleep]', 700); await sane('day ' + await ev('GAME.save().day')); }
ok(await ev("document.querySelectorAll('#gBody .mis').length") > 0, 'the day\'s missions are listed');
await click('[data-act=watch]', 800); ok(await has('[data-act=exh]'), 'the "watch fights" screen offers an exhibition');
await click('[data-act=exh]', 0); ok(await until("!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && LAB.t > .2)", 60000), 'an exhibition between two ranked fighters starts');
await wait(1500); await click('[data-act=skip]', 0); await until("!!document.querySelector('#gBody [data-act=home]')", 60000); await sane('exhibition result'); await click('#gBody [data-act=home]', 1200);
await click('[data-act=settings]', 700); ok(await has('[data-act=soundon]') && await has('[data-vol]') && await has('[data-bright]'), 'settings: sound, volumes and brightness'); await sane('settings'); await click('[data-act=setback]', 500);
ok(venues.size === 5, 'all five venues were seen', [...venues].join(', '));
console.log(T(), 'the save at the end:', await ev("JSON.stringify((S => ({day: S.day, money: S.money, fame: S.fame, rp: S.rp, rec: S.rec, belts: S.belts, gym: S.gym, staff: S.staff.length, honors: S.honors.length}))(GAME.save()))"));

// ---- 7b. challenge matches: every result is recorded, the purse is paid three times a day and once per opponent
if (await ev('!!GAME.uid()')) {
  const pay = await ev(`(() => { const S = GAME.save(), me = GAME.uid(), out = []; S.chDay = null;
    for (const [i, opp] of ['x1', 'x1', 'x2', 'x3', 'x4'].entries()) { const m0 = S.money, r0 = S.rec.w + S.rec.l; const note = GAME.match({from: me, to: opp, fromName: S.name, toName: 'คู่ ' + opp, key: 'bot-' + i}, {w: i === 2 ? 1 : 0, how: 'คะแนน', round: 3}); out.push([S.money - m0, S.rec.w + S.rec.l - r0, /ไม่มีรางวัล/.test(note)]); }
    return out; })()`);
  ok(pay.every(p => p[1] === 1), 'five challenge results are all recorded', JSON.stringify(pay));
  ok(pay[0][0] > 0 && pay[1][0] === 0 && pay[1][2] && pay[2][0] > 0 && pay[2][0] < pay[0][0] && pay[3][0] > 0 && pay[4][0] === 0 && pay[4][2], 'paid: first opponent once, a loss less than a win, three a day at most');
  await tab('fight'); ok(await ev(`document.getElementById('gBody').innerText.includes('วันนี้เหลือ 0')`), 'the challenge card says none are left today'); await sane('after the challenge results');
} else ok(false, 'the online store is connected (needed for the challenge reward check)');

// ---- 8. starting over
await tab('home'); await click('[data-act=reset]', 400); await click('[data-act=reset]', 1200);
ok(await has('#gName') && await ev('GAME.save() === null'), 'starting over returns to the creation screen');
const e = errs.splice(0); ok(!e.length, 'no script errors at the end', e.join(' | '));
console.log(bad ? `${bad} of ${steps} checks FAILED` : `PASS: ${steps} checks`);
await browser.close(); process.exit(bad ? 1 : 0);
