// Rare-form passives: direct scenario checks + every rare form through every stage (no crash, deterministic).
import { Battle, simulate } from '../src/core/battle';
import { SPECIES, STAGES, formOf } from '../src/core/data';
import type { MonsterRef } from '../src/core/types';

export function passiveTests(): number {
  let fail = 0;
  const ok = (c: boolean, msg: string) => { if (!c) { fail++; console.log('PASSIVE FAIL:', msg); } };
  const st = STAGES[0], mk = (team: MonsterRef[]) => new Battle(7, team, st) as any, R = (sid: string, rare = true): MonsterRef => ({ sid, lvl: 10, stars: 2, rare });
  ok(Object.values(SPECIES).filter(s => !s.boss && !s.starborn).every(s => !!s.rarePassive), 'every species has a rare passive (Starborn have none)');

  { const b = mk([R('B01'), R('A02', false)]), u = b.units[0], ev: any[] = []; u.hp = 0;
    ok(b.endure(u, ev) && u.hp === 1 && u.statuses.some((x: any) => x.id === 'shield') && ev.some(e => e.t === 'passive'), 'endure saves once');
    u.hp = 0; ok(!b.endure(u, []), 'endure only once'); }
  { const b = mk([R('B01', false)]), u = b.units[0]; u.hp = 0; ok(!b.endure(u, []), 'normal form has no endure'); }
  { const base = formOf('B09', true).skills[2], my = mk([R('B09')]).units[0].skills[2], nm = mk([R('B09', false)]).units[0].skills[2], ep = mk([R('A09')]).units[0].skills[2];
    ok(Math.abs(my.mult - base.mult * 1.2) < 1e-9 && my.cd === base.cd - 1 && nm.mult === SPECIES.B09.skills[2].mult && ep.mult === formOf('A09', true).skills[2].mult, 'mythic ult only for rare-form legendaries'); }
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

  // ---- light/dark rare forms (2026-10-13): own element + skills, and the 13 mechanics they use ----
  { const n = formOf('A02'), r = formOf('A02', true);
    ok(n.elem === 'water' && r.elem === 'light' && r.skills[0].effects.some(e => e.kind === 'mark' && e.elem === 'light') && r.skills[0].desc.includes('เครื่องหมายแสง') && r.skills[1].id !== n.skills[1].id && r.skills[2].id !== n.skills[2].id, 'rare form: light element, skill 1 re-elemented, own skills 2-3');
    ok(Object.values(SPECIES).filter(s => !s.boss && !s.starborn).every(s => s.rareForm && (s.rareForm.elem === 'light' || s.rareForm.elem === 'dark') && s.rareForm.elem !== s.elem), 'every species has a light/dark rare form of another element');
    ok(mk([R('A01')]).units[0].elem === 'light' && mk([R('A01', false)]).units[0].elem === 'fire', 'rare units fight in their rare element'); }
  const foe1 = (b: any) => b.units.find((u: any) => u.team === 1);
  { const b = mk([R('A01', false)]), me = b.units[0], foe = foe1(b); me.statuses.push({ id: 'invincible', turns: 1 }); const hp0 = me.hp;
    b.act(foe.uid, { si: 0, target: me.uid }); ok(me.hp === hp0, 'invincible takes no damage'); }
  { const b = mk([R('A01', false)]), me = b.units[0], foe = foe1(b); me.statuses.push({ id: 'immunity', turns: 2 });
    b.addStatus(foe, me, 'stun', 1, 1, [], true); ok(!b.has(me, 'stun'), 'immunity blocks harmful statuses'); }
  { const b = mk([R('A01', false), R('A04', false)]), [t, pr] = b.units, foe = foe1(b); t.statuses.push({ id: 'protect', turns: 2, value: pr.uid }); const h0 = pr.hp;
    b.act(foe.uid, { si: 0, target: t.uid }); ok(pr.hp < h0, 'protect: the protector takes part of the blow'); }
  { const b = mk([R('A01'), R('A02', false)]), fox = b.units[0], sl = b.units[1], foe = foe1(b); sl.cds = [0, 2, 3];
    b.act(fox.uid, { si: 2, target: foe.uid }); ok(sl.cds[1] === 1 && sl.cds[2] === 3 && fox.cds[2] === fox.skills[2].cd, 'team cooldown −1: not ultimates, not the skill just used'); }
  { const d = (o: any) => { const b = mk([R('A01', false)]), foe = foe1(b); foe.hp = foe.maxHp = 99999; foe.def = 300; return (b as any).hit(b.units[0], foe, 1, 'fire', [], { noCrit: true, ...o }).dmg; };
    ok(d({ ignoreDef: 0.5 }) > d({}), 'ignore DEF hits harder'); }
  { const d = (brand: boolean) => { const b = mk([R('A01', false)]), foe = foe1(b); foe.hp = foe.maxHp = 99999; if (brand) foe.statuses.push({ id: 'brand', turns: 2 }); return (b as any).hit(b.units[0], foe, 1, 'fire', [], { noCrit: true }).dmg; };
    ok(d(true) > d(false) * 1.2, 'brand: +25% damage taken'); }
  { const b = mk([R('A01', false)]), me = b.units[0], foe = foe1(b); foe.statuses.push({ id: 'atk_up', turns: 2 }, { id: 'def_up', turns: 2 }, { id: 'burn', turns: 2 });
    b.applyEffect(me, foe, { kind: 'strip', n: 1 }, [], 1); const one = foe.statuses.length; b.applyEffect(me, foe, { kind: 'strip' }, [], 1);
    ok(one === 2 && foe.statuses.length === 1 && foe.statuses[0].id === 'burn', 'strip removes buffs only (1, then all)'); }
  { const b = mk([R('A01', false)]), me = b.units[0], foe = foe1(b); me.statuses.push({ id: 'provoke', turns: 1, value: foe.uid });
    const r = b.act(me.uid, { si: 1, target: me.uid }); ok(r.skillIndex === 0 && r.targets[0] === foe.uid, 'provoke forces skill 1 on the provoker'); }
  { const b = mk([R('A01', false)]), me = b.units[0]; me.statuses.push({ id: 'silence', turns: 2 }); ok(!b.canUse(me, 1) && !b.canUse(me, 2) && b.canUse(me, 0), 'silence: skill 1 only'); }
  { const b = mk([R('A01', false)]), me = b.units[0]; me.hp = 10; me.statuses.push({ id: 'unheal', turns: 2 }); b.applyEffect(me, me, { kind: 'heal', value: 0.5 }, [], 1); ok(me.hp === 10, 'unheal blocks healing'); }
  { const b = mk([R('A01', false)]), foe = foe1(b), ev: any[] = []; foe.statuses.push({ id: 'bomb', turns: 1, value: 300 }); const h0 = foe.hp;
    b.endTurn(foe).forEach((e: any) => ev.push(e)); ok(foe.hp < h0 && ev.some(e => e.t === 'dot' && e.id === 'bomb') && (!foe.alive || b.has(foe, 'stun')), 'bomb explodes when it runs out: damage + stun'); }
  { const b = mk([R('A03'), R('A02', false)]), me = b.units[0], al = b.units[1], foe = foe1(b); foe.hp = foe.maxHp = 99999; foe.atb = 50; me.atb = 0; al.atb = 0; me.passive = undefined;
    b.act(me.uid, { si: 1, target: foe.uid }); ok(foe.atb === 10 && me.atb === 20 && al.atb === 20, 'steal: gauge taken and shared to the team'); }
  { const b = mk([R('A08'), R('A01', false)]), w = b.units[0], fox = b.units[1]; w.pUsed = true; b.kill(fox, []);
    const r = b.act(w.uid, { si: 2, target: w.uid }); ok(fox.alive && fox.hp === Math.round(fox.maxHp * 0.4) && Object.values(r.impacts).flat().some((e: any) => e.t === 'revive'), 'revive brings a fallen ally back'); }

  { const b = mk([R('A02'), R('A01', false)]), sl = b.units[0], fox = b.units[1], foe = foe1(b); foe.hp = foe.maxHp = 99999;
    b.applyEffect(sl, foe, { kind: 'mark', elem: 'light', chance: 1 }, [], 1); const ev: any[] = []; (b as any).tryReaction(fox, foe, 'fire', ev);
    const b2 = mk([R('A01'), R('A02', false)]), f2 = foe1(b2); f2.hp = f2.maxHp = 99999; b2.applyEffect(b2.units[1], f2, { kind: 'mark', elem: 'water', chance: 1 }, [], 1); const ev2: any[] = []; (b2 as any).tryReaction(b2.units[0], f2, 'light', ev2);
    ok(ev.some(e => e.t === 'reaction' && e.id === 'eclipse') && ev2.some(e => e.t === 'reaction' && e.id === 'eclipse'), 'light/dark rare forms are wild: eclipse with any other mark'); }

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
  { const boss = STAGES.find(s => s.id === 'rootnest-5')!, N = 300; // the map-1 boss: the rare-form baseline every check above was tuned on
    for (const ids of [['A01', 'A02', 'A03', 'A04'], ['B05', 'B04', 'B07', 'A08'], ['A05', 'C01', 'B01', 'A06']]) {
      const wr = (rare: boolean) => { let w = 0; for (let i = 0; i < N; i++) if (simulate(2000 + i, ids.map(sid => ({ sid, lvl: 10, stars: 1, rare })), boss).win) w++; return Math.round(w / N * 100); };
      console.log(`rare-form check ${boss.id} ${ids.join(',')} Lv10: normal ${wr(false)}% → rare ${wr(true)}%`);
    } }
  console.log(fail ? `passives: ${fail} FAILED` : 'passives OK');
  return fail;
}
