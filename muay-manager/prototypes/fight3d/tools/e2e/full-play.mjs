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
  const venue = await ev('MUAY.venueNow()'), specs = await ev("LAB.cfg.specs.map(s => Object.values(s.stats).join('/')).join(' v ')"), newsOff = await ev("document.getElementById('gNews').hidden");
  let rest = null, girl = null, noGirl = null;
  if (opt.round) { // to the first round break: a quick order, then on
    const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => e.t + 2.3)");
    if (pa.length) { await ev(`LAB.seek(${pa[0]} - .4)`); if (await until("!!document.querySelector('#gBody [data-act=resume]')", 40000)) { noGirl = await ev("!LAB.girlReady && !(LAB.girl && LAB.girl.root.visible)"); await click('[data-act=quick][data-v=press]', 300); await click('#gBody .btn.go.wide[data-act=resume]', 300); } }
  }
  if (opt.girl) { // a big hall: between rounds the ring-card girl walks her lap with the number of the round to come
    const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => e.t + 2.3)");
    if (pa.length) {
      await ev(`LAB.seek(${pa[0]} - .4)`);
      if (await until("!!document.querySelector('#gBody [data-act=resthold]')", 40000)) {
        await click('[data-act=resthold]', 200); // the rest waits for us
        girl = {seen: await until("!!(LAB.girl && LAB.girl.root.visible)", 60000), at: await ev("LAB.girl ? [LAB.girl.root.position.x, LAB.girl.root.position.z].map(v => +v.toFixed(2)).join(',') : ''")};
        if (girl.seen) await page.locator('#stage').screenshot({path: S + 'full-girl.png'}).catch(() => {});
        await click('#gBody .btn.go.wide[data-act=resume]', 300);
        girl.gone = await until("!LAB.girl || !LAB.girl.root.visible", 30000);
      }
    }
  }
  if (opt.rest) { // the timed rest: the count on the card, then either the bell by itself or "wait"
    const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => e.t + 2.3)");
    if (pa.length) {
      await ev(`LAB.seek(${pa[0]} - .4)`);
      if (await until("!!document.querySelector('#gBody [data-act=resume]') && !!document.querySelector('#gBody [data-restcd]')", 40000)) {
        const count = +(await ev("document.querySelector('#gBody [data-restcd]').textContent"));
        if (opt.rest === 'auto') {
          await click('[data-act=quick][data-v=press]', 300); const plan = await ev('JSON.stringify(GAME.fight().plan)');
          await ev('GAME.rest(1.5)'); // the bell in a second and a half instead of thirty
          const went = await until("!document.querySelector('#gBody [data-act=resume]') && GAME.fight() && GAME.fight().phase === 'live'", 15000);
          rest = {count, went, plan, used: await ev('JSON.stringify(GAME.fight().plans[1])')};
        } else {
          await click('[data-act=resthold]', 400); const gone = !await has('#gBody [data-restcd]') && !await has('[data-act=resthold]');
          await ev('GAME.rest(1)'); await wait(3500); // the count would be long over by now
          rest = {count, gone, still: await has('#gBody [data-act=resume]') && await ev("GAME.fight().phase === 'break'")};
          await click('#gBody .btn.go.wide[data-act=resume]', 300); rest.on = await ev("GAME.fight().phase === 'live'");
        }
      }
    }
  }
  await ev('GAME.save().skip = null'); // a fresh day's skips: the bot skips far more than a player may (section 7e checks the limit)
  await click('[data-act=skip]', 0);
  if (!await until("!!document.querySelector('#gBody [data-act=home]')", 90000)) return null;
  const r = await ev("({win: /ชนะ/.test(document.querySelector('#gBody h2').textContent), head: document.querySelector('#gBody h2').textContent, venue: '" + venue + "', specs: '" + specs + "'})");
  if (opt.ceremony) { await wait(opt.ceremony); await page.locator('#stage').screenshot({path: S + 'full-' + opt.shot + '.png'}); }
  await click('#gBody [data-act=home]', 1500);
  r.rest = rest; r.girl = girl; r.noGirl = noGirl; r.newsOff = newsOff;
  return r;
}
const strong = () => save("for (const k in S.stats) S.stats[k] = 96; S.fatigue = 0; S.mood = 4;");
const weak = () => save("for (const k in S.stats) S.stats[k] = 22; S.fatigue = 0;");

// ---- 1. creation
ok(await ev("document.getElementById('gNews').hidden"), 'the news strip is not shown on the creation screen');
ok(await has('[data-act=dlook][data-f=pattern][data-v=zigzag]') && !await has('[data-act=dlook][data-f=pattern][data-v=tiger]') && !await has('[data-act=dlook][data-f=pattern][data-v=spark]'), 'the creation screen offers the cheap patterns, not the dear ones');
await ev("document.getElementById('gName').value = 'ค ว ย จริง'"); await click('[data-act=create]', 600);
ok(await ev("!GAME.save() && /คำไม่สุภาพ/.test(document.getElementById('gCreateMsg').textContent)"), 'a name with a bad word (even spelled out) is refused, and the screen says why');
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
// the news strip: up as soon as there is something to tell (his own first line), and the same lines as a list on a tap
ok(await ev("GAME.news().some(x => /^หน้าใหม่: นักมวยหน้าใหม่ บอทเล่นครบ/.test(x))") && await until("!document.getElementById('gNews').hidden && document.querySelector('.app').classList.contains('has-news') && document.getElementById('gNewsRun').textContent.includes('บอทเล่นครบ')", 30000) /* a new line waits for the run on screen to end */, 'the news strip runs at the top with the new fighter\'s line', await ev('GAME.news().join(" | ")'));
await click('#gNews', 600); ok(await ev("document.querySelector('#gBody h2').textContent.startsWith('ข่าวจากทุกเวที') && document.querySelectorAll('#gBody .newsrow').length >= 1"), 'a tap on the strip opens the news as a list');
await click('[data-act=setback]', 400); ok(!await has('#gBody .newsrow'), 'and "back" closes it');
ok(await ev("document.getElementById('gChatBtn').hidden && document.getElementById('gOnline').hidden && document.getElementById('gChat').hidden"), 'no chat and no online count where the game has no server of its own');
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
r = await fight('l0', {plan: ['ag', 'attack'], round: true}); ok(!!r, 'local fight (easy) with a round break and a quick order', r && r.head); const restGo = !!r && r.noGirl != null; // it may end inside round 1: then no rest was had if (r && r.noGirl != null) ok(r.noGirl, 'the temple fair has no ring-card girl (her body is not even loaded)'); // an easy opponent still wins now and then: the result is not part of the check if (r) venues.add(r.venue); await sane('after a local fight');
r = await fight('l1'); ok(!!r, 'local fight (even)', r && r.head); await sane('after local fight 2');
await save('S.noBreak = true;'); r = await fight('l2', {plan: ['range', 'out']}); ok(!!r, 'local fight (hard), no stopping between rounds', r && r.head); await save('S.noBreak = false;'); await sane('after local fight 3');
await save('S.fatigue = 0;'); r = await fight('c'); ok(!!r && r.venue === 'chuek', 'rope-fist bout at the old ground', r && r.head + ' @' + r.venue); if (r) venues.add(r.venue); await sane('after the rope-fist bout');
await save('S.fatigue = 0;'); const rp0 = await ev('GAME.save().rp'); r = await fight('r'); ok(!!r && await ev('GAME.save().rp') !== rp0, 'ranked fight moves the ranking points', rp0 + ' → ' + await ev('GAME.save().rp')); if (r) venues.add(r.venue); await sane('after a ranked fight');
// the rest between rounds is timed: thirty seconds, then the next round by itself; "wait" stops the count.
// (a fight that ends in round one has no rest: the next opponent is tried)
const restOf = async kind => { for (let i = 0; i < 4; i++) { await save('S.fatigue = 0;'); const x = await fight('l' + (i % 3), {rest: kind}); if (x && x.rest) return x.rest; } return null; };
let rs = await restOf('auto');
ok(!!rs && rs.count > 20 && rs.count <= 30, 'a round break shows the count to the next round', rs && rs.count + ' s');
ok(!!rs && rs.went && rs.used === rs.plan, 'when the count runs out the next round starts by itself, with the plan on screen', rs && rs.used);
rs = await restOf('hold');
ok(!!rs && rs.gone && rs.still && rs.on, '"wait" stops the count: the rest lasts until "fight on" is pressed', JSON.stringify(rs)); await sane('after the timed rests');
// a draw (level on points): nobody wins, the purse is split, the record shows it, and the opponent is kept for a rematch.
// The fight on screen is handed a level result (a real one comes about once in 250 fights).
{ await save('S.fatigue = 0; S.rivals = [];'); await tab('fight'); await click('[data-act=pick][data-v=l1]', 800); await click('[data-act=startfight]', 0);
  await until("!!(window.LAB && LAB.fight && document.querySelector('.app.g-fight') && LAB.t > .2 && GAME.fight() && GAME.fight().phase === 'live')", 60000);
  const b4 = await ev("(S => ({m: S.money, w: S.rec.w, l: S.rec.l, d: S.rec.d || 0, purse: GAME.fight().opp.money, name: GAME.fight().opp.name}))(GAME.save())");
  await ev("MUAY.HOOK.onOver(Object.assign({}, LAB.fight.result, {w: -1, l: -1, how: 'เสมอ', pts: [48, 48], move: null}))");
  await until("!!document.querySelector('#gBody [data-act=home]')", 20000);
  const af = await ev("(S => ({m: S.money, w: S.rec.w, l: S.rec.l, d: S.rec.d || 0, riv: S.rivals[0] || {}, head: document.querySelector('#gBody h2').textContent, log: S.log[0]}))(GAME.save())");
  ok(/เสมอ/.test(af.head) && af.d === b4.d + 1 && af.w === b4.w && af.l === b4.l, 'a draw is a draw: one more on the record, no win and no loss', af.head + ' · ' + af.w + '-' + af.l + '-' + af.d);
  ok(af.m - b4.m === Math.round(b4.purse * .5) && af.log.d === true && !await has('[data-act=adr]'), 'a draw splits the purse', '+' + (af.m - b4.m) + ' of ' + b4.purse);
  ok(af.riv.name === b4.name && af.riv.draws === 1 && af.riv.losses === 0, 'the man he drew with is kept for a rematch', JSON.stringify({n: af.riv.name, d: af.riv.draws, l: af.riv.losses}));
  await click('#gBody [data-act=home]', 1500); await save('S.rematch = 1; S.fatigue = 0;'); await tab('fight');
  ok(await ev(`document.getElementById('gBody').innerText.includes('เสมอกัน 1 ครั้ง')`) && await has('[data-act=pick][data-v=v]'), 'the rematch after a draw is offered on the fight menu'); await sane('after a draw');
  await tab('rank'); ok(await ev(`[...document.querySelectorAll('#gBody .rk.me .wl')].some(e => /^\\d+-\\d+-[1-9]\\d*$/.test(e.textContent))`), 'the ranking shows wins, losses and the draw'); }
// a loss makes a rival; the rematch is on the menu and winning it clears him
await save('S.rivals = [];'); await strong(); r = await fight('l2', {before: weak});
const foe = await ev("(GAME.save().rivals[0] || {}).name || ''");
ok(r && !r.win && !!foe && await ev('GAME.save().rivals.length') === 1, 'a loss puts the opponent on the rivals list', r && r.head + ' · ' + r.specs + ' · rival: ' + foe); await sane('after a loss');
await strong(); await save('S.rematch = 1; for (const k in S.rivals[0].stats) S.rivals[0].stats[k] = 40;'); await tab('fight'); ok(await ev(`document.querySelector('#gBody').innerText.includes(${JSON.stringify('ไฟต์ล้างตา')})`) && await has('[data-act=pick][data-v=v]'), 'the rematch is offered on the fight menu');
r = await fight('v'); ok(r && r.newsOff && await ev("GAME.news().some(x => /^ล้างตา: \\S+ ล้างตาสำเร็จ ชนะ/.test(x))"), 'the strip is away during a fight, and the won rematch is on the news afterwards', await ev('GAME.news().slice(0, 2).join(" | ")'));
ok(r && r.win && await ev('GAME.save().rivals.length') === 0 && await ev('GAME.save().rematch') === 0, 'the rematch is won and the rival is cleared', r && r.head + ' · ' + r.specs); await sane('after the rematch');
// the title of his league, then its defence
await save("S.rp = 1045; S.title = 1; S.fatigue = 0; S.ranked = 2;"); await strong();
r = await fight('t', {ceremony: 24000, shot: 'belt'}); ok(r && r.win && await ev('GAME.save().belts.length') === 1, 'a title fight is won: the belt is his', r && r.head);
ok(await ev("GAME.news().some(x => /^เข็มขัด: \\S+ คว้าเข็มขัด/.test(x))"), 'the belt is on the news', await ev('GAME.news()[0]')); if (r) venues.add(r.venue); await sane('after the title fight');
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
  const dr = await ev(`(() => { const S = GAME.save(), me = GAME.uid(); S.chDay = null; const m0 = S.money, d0 = S.rec.d || 0, w0 = S.rec.w, l0 = S.rec.l; const note = GAME.match({from: 'x7', to: me, fromName: 'คู่ x7', toName: S.name, key: 'bot-draw'}, {w: -1, how: 'เสมอ', round: 3}); return {money: S.money - m0, d: (S.rec.d || 0) - d0, wl: S.rec.w - w0 + S.rec.l - l0, note, log: S.log[0]}; })()`);
  ok(dr.money === 250 && dr.d === 1 && dr.wl === 0 && /เสมอ/.test(dr.note) && dr.log.d === true, 'a drawn challenge match: a draw on the record and the draw purse', JSON.stringify(dr).slice(0, 160));
} else ok(false, 'the online store is connected (needed for the challenge reward check)');

// ---- 7c. what the player used is counted in his save (tools/tester-report.mjs reads it)
await tab('home'); await click('[data-act=sleep]', 900); // a save, so the seconds played are written
{ const u = await ev('JSON.parse(JSON.stringify(GAME.save().use))');
  ok(u.sess === 1 && u.days.length === 1 && /^\d{4}-\d\d-\d\d$/.test(u.days[0]) && u.first === u.days[0], 'usage: one visit, one day', JSON.stringify({sess: u.sess, days: u.days}));
  ok(u.secs > 60 && u.secs < 3600, 'usage: the time played is counted', u.secs + ' s');
  ok(['bag', 'banana', 'dummy', 'rope', 'spar', 'run', 'fun', 'rest'].every(k => u.a['train:' + k] >= 1) && u.a['tab:fight'] > 5 && u.a['plan:ag=attack'] >= 1 && u.a['look:beard'] >= 1, 'usage: presses are counted by action and choice', Object.keys(u.a).length + ' kinds');
  ok(u.f.local >= 3 && u.f.ranked >= 1 && u.f.chuek === 1 && u.f.rival === 1 && u.f.title === 1 && u.f.defense === 2 && u.f.tour === 3 && u.f.exhibition >= 1, 'usage: fights are counted by kind', JSON.stringify(u.f));
  ok(u.end.skip >= 10 && (!restGo || u.rest.go >= 1) && u.rest.auto === 1 && u.rest.held === 1, 'usage: skipped fights and the three ways a rest ends', JSON.stringify(u.end) + ' ' + JSON.stringify(u.rest));
  ok(Object.values(u.a).concat(Object.values(u.f), Object.values(u.end), Object.values(u.rest)).every(n => Number.isInteger(n) && n > 0), 'usage: every count is a whole number'); }

// ---- 7e. the shop, and the day's skips
await save('S.money = 400000; S.gym = 5; S.build = []; S.merit = 0; S.fatigue = 60; S.mood = 1; S.slots = 3; S.shopDay = null; S.staff = [];'); await tab('home');
ok(await ev("document.querySelectorAll('#gBody .shoprow').length") === 8, 'the camp screen has the shop: four buildings, two daily buys, an extra ranked fight, merit', await ev("document.querySelectorAll('#gBody .shoprow').length"));
{ const f0 = await ev('GAME.save().fame');
  for (const id of ['sauna', 'weights', 'ring', 'shrine']) await click(`[data-act=shop][data-v="build:${id}"]`, 300);
  ok(await ev("GAME.save().build.length === 4 && GAME.save().money === 400000 - 205000 && GAME.save().slots === 4"), 'the four buildings are built and paid for; the training ring gives a fourth session today', await ev("JSON.stringify([GAME.save().build, GAME.save().money, GAME.save().slots])"));
  ok(await ev("/จาก 4 ครั้ง/.test(document.getElementById('gBody').innerText) && !document.querySelector('[data-act=shop][data-v^=build]')"), 'the camp says four sessions a day; nothing is left to build');
  await click('[data-act=shop][data-v="daily:massage"]', 300); const fat = await ev('GAME.save().fatigue');
  await click('[data-act=shop][data-v="daily:massage"]', 300);
  ok(fat === 30 && await ev('GAME.save().fatigue') === 30 && !await has('[data-act=shop][data-v="daily:massage"]'), 'the paid massage takes 30 off, once a day', fat);
  await click('[data-act=shop][data-v="daily:meal"]', 300); ok(await ev('GAME.save().mood') === 2, 'the meal lifts his mood');
  const m0 = await ev('GAME.save().money'); await click('[data-act=shop][data-v=merit]', 300); const m1 = await ev('GAME.save().money'); await click('[data-act=shop][data-v=merit]', 300); const m2 = await ev('GAME.save().money');
  ok(m0 - m1 === 500 && m1 - m2 === 800 && await ev('GAME.save().merit') === 2 && await ev('GAME.save().fame') === f0 + 10, 'merit: 500, then 800; fame +5 each time', [m0 - m1, m1 - m2].join(' '));
  ok(await ev('GAME.save().mood') === 4, 'merit lifts his mood too (meal and two gifts: to the top)');
  await save('S.mood = 2;'); await click('[data-act=sleep]', 800); // a mood the shrine can lift
  ok(await ev("GAME.save().slots === 4 && GAME.save().fatigue === 0 && GAME.save().mood === 3"), 'the next morning: four sessions, the sauna\'s rest, the shrine\'s mood', await ev("JSON.stringify([GAME.save().slots, GAME.save().fatigue, GAME.save().mood])")); }
// the day's skips: none left, the button is shut and says so; another day's allowance opens it
await ev('GAME.skipLeft()'); await save('S.skip.n = 10; S.fatigue = 0;'); await tab('fight'); await click('[data-act=pick][data-v=l0]', 800);
{ const seen = await ev('window.LAB && LAB.fight ? LAB.cfg.seed : null'); await click('[data-act=startfight]', 0);
  if (await until(`!!(window.LAB && LAB.fight && LAB.cfg.seed !== ${seen} && document.querySelector('.app.g-fight') && LAB.t > .2)`, 60000)) {
    ok(await ev("(b => !!b && b.disabled)(document.querySelector('#gBody [data-act=skip]')) && /ข้ามไปดูผลได้วันละ 10 ไฟต์/.test(document.getElementById('gBody').innerText) && !document.querySelector('#gBody [data-act=adr]')"), 'out of skips: the button is shut, the screen says why (no advert on the web)');
    await ev("document.querySelector('#gBody [data-act=skip]').click()"); await wait(800); ok(await ev("GAME.fight() && GAME.fight().phase === 'live' && !GAME.fight().skipped"), 'and pressing it does nothing');
    await save('S.skip = null;'); await click('#gBody [data-act=nobreak]', 300); await click('#gBody [data-act=nobreak]', 300);
    ok(await ev("/เหลือ 10 ครั้งวันนี้/.test(document.querySelector('#gBody [data-act=skip]').innerText)"), 'a new day: ten skips, and the button says so');
    await click('#gBody [data-act=skip]', 0); ok(await until("!!document.querySelector('#gBody [data-act=home]')", 90000) && await ev('GAME.skipLeft()') === 9, 'a skip counts: nine left'); await click('#gBody [data-act=home]', 1200);
  } else ok(false, 'the fight for the skip check started'); }

// ---- 7f. titles
await save('S.money = 300000; S.belts = [0]; S.titles = []; S.tag = "";'); await tab('home');
ok(await ev("document.querySelectorAll('#gShop .ttlb').length") === 11, 'the shop lists eleven titles');
ok(await ev("(b => b.disabled && /เข็มขัด 2 เส้น/.test(b.innerText))(document.querySelector('[data-act=title][data-v=general]'))"), 'a title that needs two belts is shut while he holds one');
await click('[data-act=title][data-v=kick]', 400);
ok(await ev("GAME.save().tag === 'kick' && GAME.save().money === 295000 && /จอมเตะ/.test(document.getElementById('gTop').innerText)"), 'a title is bought, worn at once, and shown at the top', await ev("JSON.stringify([GAME.save().tag, GAME.save().money])"));
ok(await ev("GAME.news().some(x => /ได้รับฉายา \"จอมเตะ\"/.test(x))"), 'the news strip tells of it');
await tab('rank'); ok(await ev("/จอมเตะ/.test(document.querySelector('#gBody .rk.me').innerText)"), 'and it stands before his name in the ranking'); await tab('home');
await click('[data-act=title][data-v=mo]', 400); ok(await ev("GAME.save().tag === 'mo' && GAME.save().titles.length === 2 && GAME.save().money === 293000"), 'a second title is bought and worn in its place');
await click('[data-act=title][data-v=kick]', 400); ok(await ev("GAME.save().tag === 'kick' && GAME.save().money === 293000"), 'one he owns is worn again for nothing');
await click('[data-act=title][data-v=kick]', 400); ok(await ev("GAME.save().tag === ''"), 'and a tap on the one he wears takes it off');

// ---- 7g. dear shorts patterns, and more ranked fights bought for the day
await save('S.money = 100000; S.own.patterns = S.own.patterns.filter(k => k !== "tiger");'); await tab('dress');
await click('[data-act=look][data-f=pattern][data-v=tiger]', 800); ok(await has('[data-act=buy]') && await ev("/8,000/.test(document.querySelector('.buy').innerText)"), 'the tiger pattern is tried on, priced ฿ 8,000');
await click('[data-act=buy]', 800); ok(await ev("GAME.save().own.patterns.includes('tiger') && GAME.save().look.pattern === 'tiger' && GAME.save().money === 92000"), 'and bought: worn and paid for', await ev('GAME.save().money'));
await save('S.ranked = 0; S.rkBuy = null; S.money = 100000;'); await tab('fight');
ok(await has('#gBody [data-act=shop][data-v=extra]') && !await has('#gBody [data-act=pick][data-v=r]'), 'no ranked fights left today: the fight menu offers to buy one');
{ const m = [await ev('GAME.save().money')]; await click('#gBody [data-act=shop][data-v=extra]', 500); m.push(await ev('GAME.save().money'));
  ok(await ev('GAME.save().ranked') === 1 && await has('#gBody [data-act=pick][data-v=r]'), 'one bought from the fight menu: the ranked fight is there to fight');
  await tab('home'); for (let i = 0; i < 2; i++) { await click('#gShop [data-act=shop][data-v=extra]', 500); m.push(await ev('GAME.save().money')); }
  const d = [m[0] - m[1], m[1] - m[2], m[2] - m[3]];
  ok(d[0] > 0 && d[1] === 2 * d[0] && d[2] === 3 * d[0] && await ev('GAME.save().ranked') === 3, 'two more from the camp shop, each dearer (×1, ×2, ×3): three to fight', d.join(' '));
  ok(!await has('#gShop [data-act=shop][data-v=extra]') && /ครบ 3 ไฟต์/.test(await ev("document.getElementById('gShop').innerText")), 'no fourth: the shop says the day\'s three are bought'); }
await save('S.ranked = 2;');

// ---- 7d. a big hall: the ring-card girl between rounds. The last fight of the run.
await save('S.rp = 1450; S.ranked = 2; S.fatigue = 0;'); await strong();
r = await fight('r', {girl: true});
ok(!!r && r.venue === 'stadium' && !!r.girl && r.girl.seen && r.girl.gone, 'at the stadium the ring-card girl walks her lap between rounds and is gone when the round starts', r && JSON.stringify(r.girl));

// ---- 8. starting over
await tab('home'); await click('[data-act=reset]', 400); await click('[data-act=reset]', 1200);
ok(await has('#gName') && await ev('GAME.save() === null'), 'starting over returns to the creation screen');
const e = errs.splice(0); ok(!e.length, 'no script errors at the end', e.join(' | '));
console.log(bad ? `${bad} of ${steps} checks FAILED` : `PASS: ${steps} checks`);
await browser.close(); process.exit(bad ? 1 : 0);
