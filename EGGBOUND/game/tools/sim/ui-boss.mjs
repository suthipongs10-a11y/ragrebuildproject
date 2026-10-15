import { chromium } from 'playwright';
import { serve } from './ui-server.mjs';
const OUT = 'tools/sim/out/';
const srv = serve(8863, 'none'), b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 780 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8863/'); await p.waitForFunction(() => window.__eb, null, { timeout: 60000 }); await p.waitForTimeout(1000);
await p.evaluate(() => { const S = window.__eb.S; for (const z of ['meadow','stream','rootnest','goldforest','ricefield','village','kinnari','temple','nagapool','jade','palace','foxvalley','toadbridge','heaven']) for (let n = 1; n <= 5; n++) S.stages[`${z}-${n}`] = 3; window.__eb.show('map'); });
await p.waitForTimeout(1200);
for (const [z, r] of [['meadow', 1], ['heaven', 3]]) {
  await p.evaluate(r => document.querySelector(`[data-realm="${r}"]`)?.click(), r); await p.waitForTimeout(500);
  await p.evaluate(z => document.querySelector(`[data-zone="${z}"]`).click(), z); await p.waitForTimeout(700);
  console.log(z, await p.evaluate(() => document.querySelector('.zbp')?.innerText.replace(/\n/g, ' | ')));
  await p.evaluate(() => document.querySelector('.zbp')?.scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + `zone_${z}.png` });
  await p.evaluate(() => document.querySelector('[data-zclose]')?.click()); await p.waitForTimeout(400);
}
// boss fight: watch for the enrage passive event
await p.evaluate(() => { const S = window.__eb.S; window.__eb.devTool('mons'); S.team = ['A01','A02','A03','A04'].map(sid => S.mons.find(x => x.sid === sid).uid); for (const m of S.mons) { m.stars = 3; m.lvl = 12; } S.settings.auto = true; S.settings.speed = 3; S.settings.skipUlt = true; window.__eb.startBattle('meadow-5'); });
let shot = false;
for (let i = 0; i < 240; i++) { await p.waitForTimeout(500);
  const st = await p.evaluate(() => { const V = window.__eb.battle; if (!V) return null; const B = V.b; const bs = B.units?.find(u => u.team === 1 && (u.boss || u.passives?.some(q => q.kind === "enrage"))); return { wave: B.wave, boss: bs ? [bs.hp, bs.maxHp, bs.statuses.map(s => s.id).join('+'), (bs.used || []).join('+')] : null, over: !!B.over || !!B.result }; });
  if (st?.boss && st.boss[3].includes('enrage') && !shot) { await p.waitForTimeout(150); await p.screenshot({ path: OUT + 'enrage.png' }); shot = true; console.log('enrage', JSON.stringify(st)); }
  if (st?.over || (shot && i > 0 && st === null)) break; }
console.log('errors', errs.length, errs.slice(0, 5).join(' || '));
await b.close(); srv.close();
