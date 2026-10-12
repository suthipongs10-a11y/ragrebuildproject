// Rare-form passives: direct scenario checks + every rare form through every stage (no crash, deterministic).
import { Battle, simulate } from '../src/core/battle';
import { SPECIES, STAGES } from '../src/core/data';
import type { MonsterRef } from '../src/core/types';

export function passiveTests(): number {
  let fail = 0;
  const ok = (c: boolean, msg: string) => { if (!c) { fail++; console.log('PASSIVE FAIL:', msg); } };
  const st = STAGES[0], mk = (team: MonsterRef[]) => new Battle(7, team, st) as any, R = (sid: string, rare = true): MonsterRef => ({ sid, lvl: 10, stars: 2, rare });
  ok(Object.values(SPECIES).filter(s => !s.boss).every(s => !!s.rarePassive), 'every species has a rare passive');

  { const b = mk([R('B01'), R('A02', false)]), u = b.units[0], ev: any[] = []; u.hp = 0;
    ok(b.endure(u, ev) && u.hp === 1 && u.statuses.some((x: any) => x.id === 'shield') && ev.some(e => e.t === 'passive'), 'endure saves once');
    u.hp = 0; ok(!b.endure(u, []), 'endure only once'); }
  { const b = mk([R('B01', false)]), u = b.units[0]; u.hp = 0; ok(!b.endure(u, []), 'normal form has no endure'); }
  { const b = mk([R('A08'), R('A01', false)]), fox = b.units[1], ev: any[] = []; b.kill(fox, ev);
    ok(fox.alive && fox.hp === Math.round(fox.maxHp * 0.3) && ev.some(e => e.t === 'passive'), 'revive brings the first fallen back');
    b.kill(fox, []); ok(!fox.alive, 'revive only once'); }
  { const b = mk([R('A05'), R('A02', false)]); ok(b.startEvents.some((e: any) => e.t === 'passive') && b.units.filter((u: any) => u.team === 0).every((u: any) => u.atb >= 20), 'start gauge passive'); }
  { const b = mk([R('C01'), R('A02', false)]); ok(b.units.filter((u: any) => u.team === 0).every((u: any) => u.statuses.some((x: any) => x.id === 'shield')), 'start shield passive'); }
  { const b = mk([R('B05')]), t = b.units[0], foe = b.units.find((u: any) => u.team === 1); foe.hp = 1; t.atb = 0;
    const r = b.act(t.uid, { si: 0, target: foe.uid }); ok(!foe.alive && t.atb === 100 && r.after.some((e: any) => e.t === 'passive'), 'kill grants another turn'); }
  { const b = mk([R('A09')]), me = b.units[0], foe = b.units.find((u: any) => u.team === 1), hp0 = foe.hp;
    b.act(foe.uid, { si: 0, target: me.uid }); ok(foe.hp < hp0, 'thorns reflect damage'); }
  { const b = mk([R('A04')]), me = b.units[0], foe = b.units.find((u: any) => u.team === 1), hp0 = me.hp;
    const b2 = mk([R('A04', false)]), me2 = b2.units[0], foe2 = b2.units.find((u: any) => u.team === 1);
    b.act(foe.uid, { si: 0, target: me.uid }); b2.act(foe2.uid, { si: 0, target: me2.uid }); ok(hp0 - me.hp < me2.maxHp - me2.hp, 'guard takes less damage'); }

  // every rare form in every stage: no crash, deterministic
  const sids = Object.keys(SPECIES).filter(id => !SPECIES[id].boss);
  for (let i = 0; i < sids.length; i += 4) {
    const team = sids.slice(i, i + 4).map(sid => ({ sid, lvl: 12, stars: 2, rare: true }));
    while (team.length < 4) team.push({ sid: 'A01', lvl: 12, stars: 2, rare: true });
    for (const stg of STAGES) for (let k = 0; k < 15; k++) {
      try { const a = simulate(500 + k, team, stg), c = simulate(500 + k, team, stg); if (a.rng !== c.rng || a.log.join() !== c.log.join()) ok(false, 'rare team non-deterministic ' + stg.id); }
      catch (e) { ok(false, `rare team crashed ${stg.id} ${team.map(t => t.sid)}: ${(e as Error).message}`); }
    }
  }
  // balance: the same team with and without rare forms on the boss stage
  { const boss = STAGES[STAGES.length - 1], N = 300;
    for (const ids of [['A01', 'A02', 'A03', 'A04'], ['B05', 'B04', 'B07', 'A08'], ['A05', 'C01', 'B01', 'A06']]) {
      const wr = (rare: boolean) => { let w = 0; for (let i = 0; i < N; i++) if (simulate(2000 + i, ids.map(sid => ({ sid, lvl: 10, stars: 1, rare })), boss).win) w++; return Math.round(w / N * 100); };
      console.log(`rare-form check ${boss.id} ${ids.join(',')} Lv10: normal ${wr(false)}% → rare ${wr(true)}%`);
    } }
  console.log(fail ? `passives: ${fail} FAILED` : 'passives OK');
  return fail;
}
