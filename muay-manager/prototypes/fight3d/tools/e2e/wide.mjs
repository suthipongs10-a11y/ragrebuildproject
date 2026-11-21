// The page on a wide screen (a computer, the desktop app, a tablet held sideways) and on a phone: two columns where
// there is room (the ring on the left kept in view, the menus on the right), one column on a phone exactly as before.
// Walks camp, a fight, the round break and the result at each size, checks the layout and keeps a picture of each.
// usage: node tools/e2e/wide.mjs      (needs the site: SITE=http://127.0.0.1:8788/ by default, server/server.mjs)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname, S = ROOT + 'dist/e2e/wide/'; mkdirSync(S, {recursive: true});
const URL0 = process.env.SITE || 'http://127.0.0.1:8788/', LANG = process.env.UI_LANG;
const SIZES = [[1280, 800, true], [1366, 768, true], [1920, 1080, true], [390, 844, false]];
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's';
let bad = 0, steps = 0;
const ok = (c, what, got) => { steps++; if (!c) bad++; console.log(T(), (c ? 'ok   ' : 'FAIL ') + what + (got !== undefined && got !== '' ? ' → ' + got : '')); return c; };
const browser = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const errs = [];
// where the ring is, and whether the page scrolls sideways
const BOX = `(() => { const r = document.getElementById('stage').getBoundingClientRect(), g = document.getElementById('gBody').getBoundingClientRect();
  return {top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), bodyLeft: Math.round(g.left), vh: innerHeight, vw: innerWidth,
    sideways: document.documentElement.scrollWidth > innerWidth + 1, scrollable: document.documentElement.scrollHeight > innerHeight + 40}; })()`;
for (const [w, h, wide] of SIZES) {
  const tag = w + '×' + h, page = await (await browser.newContext({viewport: {width: w, height: h}})).newPage();
  page.on('pageerror', e => errs.push(tag + ': ' + e.message));
  await page.goto(URL0 + (LANG ? '?lang=' + LANG : ''), {timeout: 120000}).catch(() => {});
  await page.waitForFunction("!!window.MUAY && !!document.getElementById('gName')", null, {timeout: 90000});
  const ev = js => page.evaluate(js), wait = ms => page.waitForTimeout(ms);
  const until = (js, ms) => page.waitForFunction(js, null, {timeout: ms || 30000, polling: 200}).then(() => true, () => false);
  const click = async (sel, pause) => { const done = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b || b.disabled) return false; b.click(); return true; })()`); await wait(pause == null ? 600 : pause); return done; };
  const shot = name => page.screenshot({path: S + w + 'x' + h + '-' + name + '.png'}).catch(() => {});
  await ev("document.getElementById('gName').value = 'จอกว้าง " + w + "'"); await click('[data-act=create]', 2500);
  // camp
  let b = await ev(BOX); await shot('1-camp');
  if (wide) {
    ok(b.right <= b.bodyLeft && b.w >= 560, tag + ': the ring on the left, the menus beside it', `ring ${b.left}–${b.right} (${b.w} wide), menus from ${b.bodyLeft}`);
    await click('[data-act=tab][data-v=train]', 700); await ev('scrollTo(0, 5000)'); await wait(400); b = await ev(BOX);
    ok(!b.scrollable || (b.top >= 0 && b.bottom <= b.vh), tag + ': the ring stays in view when the menus scroll', `ring ${b.top}–${b.bottom} of ${b.vh}`);
    await shot('2-train-scrolled'); await ev('scrollTo(0, 0)');
  } else {
    const order = await ev("['gTop', 'stage', 'gNav', 'gBody'].map(id => Math.round(document.getElementById(id).getBoundingClientRect().top))");
    ok(order.every((y, i) => !i || y > order[i - 1]) && b.w > w - 40, tag + ': one column on a phone: top bar, ring, menu buttons, page', order.join(' < '));
  }
  ok(!b.sideways, tag + ': nothing runs off the side');
  // a fight, its round break and its result
  await click('[data-act=tab][data-v=fight]', 700); await click('[data-act=pick][data-v=l0]', 900);
  const seen = await ev('window.LAB && LAB.fight ? LAB.cfg.seed : null'); await click('[data-act=startfight]', 0);
  if (await until(`!!(window.LAB && LAB.fight && LAB.cfg.seed !== ${seen} && document.querySelector('.app.g-fight') && LAB.t > .2)`, 60000)) {
    await wait(2500); b = await ev(BOX); await shot('3-fight');
    const bar = await ev("(() => { const r = document.querySelector('.board').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height)]; })()");
    if (wide) ok(bar[0] >= 0 && b.bottom <= b.vh, tag + ': in the fight the score bar and the whole ring fit the screen', `bar at ${bar[0]}, ring ${b.top}–${b.bottom} of ${b.vh}`);
    const pa = await ev("LAB.fight.events.filter(e => e.phase === 'rest').map(e => e.t + 2.3)");
    if (pa.length) {
      await ev(`LAB.seek(${pa[0]} - .4)`);
      if (await until("!!document.querySelector('#gBody [data-act=resume]')", 40000)) {
        await wait(1200); b = await ev(BOX); await shot('4-round-break');
        if (wide) { const plan = await ev("(() => { const r = document.querySelector('#gBody [data-act=resume]').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; })()");
          ok(plan[0] >= b.right && b.bottom <= b.vh, tag + ': at the break the plan sits beside the ring, the ring still in view', `plan button at x ${plan[0]}`); }
        await click('#gBody .btn.go.wide[data-act=resume]', 600);
      }
    }
    // full screen covers the whole window, the other column's bars included
    await click('#btnFull', 900);
    const full = await ev("(() => { const r = document.getElementById('arena').getBoundingClientRect(), x = document.elementFromPoint(innerWidth - 30, 40); return [Math.round(r.width), Math.round(r.height), !!(x && x.closest('#arena'))]; })()");
    ok(full[0] >= w - 2 && full[1] >= h - 2 && full[2], tag + ': the full-screen ring covers the window', full.join(' '));
    await click('#btnFull', 700);
    await ev('GAME.save().skip = null'); await click('#gBody [data-act=skip]', 0);
    if (await until("!!document.querySelector('#gBody [data-act=home]')", 90000)) { await wait(2000); await shot('5-result'); }
    await click('#gBody [data-act=home]', 1200);
  } else ok(false, tag + ': the fight started');
  await page.context().close();
}
ok(errs.length === 0, 'no script errors', errs.slice(0, 3).join(' | '));
await browser.close();
console.log(bad ? `${bad} of ${steps} checks FAILED` : `all ${steps} checks passed`);
process.exit(bad ? 1 : 0);
