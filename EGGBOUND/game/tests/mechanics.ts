// Mechanics catalog (2026-10-14, docs/SKILL_CATALOG_TH.md): signature passives on normal forms, new statuses, skill
// params and effects — direct scenario checks on throwaway test species, plus the "no two skills alike" rule.
import { Battle, simulate } from '../src/core/battle';
import { SPECIES, STAGES, formOf } from '../src/core/data';
import type { MonsterRef, PassiveDef, SkillDef, SpeciesDef } from '../src/core/types';

export function mechanicsTests(): number {
  let fail = 0;
  const ok = (c: boolean, msg: string) => { if (!c) { fail++; console.log('MECH FAIL:', msg); } };
  const made: string[] = [];
  /** a throwaway species cloned from `base` with a signature passive and/or replaced skills */
  const sp = (id: string, base: string, o: { passive?: PassiveDef; skills?: Partial<SkillDef>[] } = {}) => {
    const b = SPECIES[base], skills = b.skills.map((k, i) => ({ ...k, ...(o.skills?.[i] || {}) })) as SpeciesDef['skills'];
    SPECIES[id] = { ...b, id, art: undefined, skills, passive: o.passive, rarePassive: undefined, rareForm: undefined }; made.push(id); return id;
  };
  const st = STAGES[0], R = (sid: string): MonsterRef => ({ sid, lvl: 10, stars: 2 });
  const mk = (team: MonsterRef[], seed = 7) => new Battle(seed, team, st) as any;
  const foe1 = (b: any) => b.units.find((u: any) => u.team === 1);
  const evs = (r: any) => [...Object.values(r.impacts).flat(), ...r.after] as any[];

  // signature passive on a normal form; the rare form keeps its own passive as well
  { const id = sp('T_SIG', 'A02', { passive: { kind: 'leech', name: 'ดูดเลือด', desc: '', value: 0.3 } });
    const u = mk([R(id)]).units[0]; ok(u.passives.length === 1 && Math.abs(u.leech - 0.3) < 1e-9, 'signature passive on a normal form (leech)');
    SPECIES.T_SIG.rarePassive = SPECIES.A02.rarePassive; SPECIES.T_SIG.rareForm = SPECIES.A02.rareForm;
    const r = mk([{ ...R(id), rare: true }]).units[0]; ok(r.passives.length === 2, 'rare form has both passives'); }

  // ทุบสะท้าน (bash): a sure bash stuns the target
  { const id = sp('T_BASH', 'A01', { passive: { kind: 'bash', name: 'ทุบสะท้าน', desc: '', chance: 1 } });
    const b = mk([R(id)]), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999;
    const r = b.act(me.uid, { si: 0, target: foe.uid }); ok(foe.statuses.some((s: any) => s.id === 'stun') && evs(r).some(e => e.t === 'passive'), 'bash stuns'); }

  // ร่างเงาลม (evade): a sure dodge leaves the defender untouched
  { const id = sp('T_EVADE', 'A03', { passive: { kind: 'evade', name: 'ร่างเงาลม', desc: '', chance: 1 } });
    const b = mk([R(id)]), me = b.units[0], foe = foe1(b), hp0 = me.hp;
    const r = b.act(foe.uid, { si: 0, target: me.uid }); ok(me.hp === hp0 && evs(r).some(e => e.t === 'hit' && e.miss), 'evade dodges a single-target attack'); }

  // เกิดใหม่จากเถ้า (rebirth): rises once by itself
  { const id = sp('T_REB', 'A01', { passive: { kind: 'rebirth', name: 'เกิดใหม่จากเถ้า', desc: '', value: 0.5 } });
    const b = mk([R(id)]), me = b.units[0]; b.kill(me, []); ok(me.alive && me.hp === Math.round(me.maxHp * 0.5), 'rebirth brings itself back');
    b.kill(me, []); ok(!me.alive, 'rebirth only once'); }

  // ไฟอุ่นใจ (allyEndure): the first lethal blow on a teammate leaves it at 1 HP, once
  { const id = sp('T_WARD', 'A05', { passive: { kind: 'allyEndure', name: 'ไฟอุ่นใจ', desc: '' } });
    const b = mk([R(id), R('A01')]), fox = b.units[1]; fox.hp = 0; ok(b.endure(fox, []) && fox.hp === 1, 'ally endure saves a teammate');
    fox.hp = 0; ok(!b.endure(fox, []), 'ally endure only once'); }

  // จังหวะทอง (critTurn): a crit gives another turn
  { const id = sp('T_CRIT', 'A01', { passive: { kind: 'critTurn', name: 'จังหวะทอง', desc: '', chance: 1 } });
    let seen = false, good = true; // crit chance caps at 80%: try seeds until a crit lands
    for (let s = 1; s < 30 && !seen; s++) { const b = mk([R(id)], s), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999; me.crit = 1; me.atb = 0;
      const r = b.act(me.uid, { si: 0, target: foe.uid }), crit = evs(r).some(e => e.t === 'hit' && e.src === me.uid && e.crit); if (crit) { seen = true; good = me.atb === 100; } else if (me.atb === 100) good = false; }
    ok(seen && good, 'crit grants another turn (and only a crit)'); }

  // ออร่า (aura): team ATK while it stands
  { const id = sp('T_AURA', 'A05', { passive: { kind: 'aura', name: 'ออร่า', desc: '', stat: 'atk', value: 0.5 } });
    const dmg = (team: MonsterRef[]) => { const b = mk(team, 11), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999; me.crit = 0; const r = b.act(me.uid, { si: 0, target: foe.uid }); return evs(r).filter(e => e.t === 'hit' && e.src === me.uid).reduce((t, e) => t + e.dmg, 0); };
    ok(dmg([R('A01'), R(id)]) > dmg([R('A01'), R('A05')]) * 1.3, 'atk aura raises team damage'); }

  // ตีรัว (hits): several hits, effects roll on each
  { const id = sp('T_MULTI', 'A01', { skills: [{ hits: 3, effects: [{ kind: 'atb', value: -5 }] }] });
    const b = mk([R(id)]), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999; foe.atb = 50;
    const r = b.act(me.uid, { si: 0, target: foe.uid }); ok(evs(r).filter(e => e.t === 'hit' && e.src === me.uid).length === 3 && foe.atb === 35, 'multi-hit: 3 hits, effect on each'); }

  // พลังตามกาย (scale): HP-scaled damage grows with max HP
  { const id = sp('T_SCALE', 'A04', { skills: [{ scale: 'hp' }] });
    const dmg = (hp: number) => { const b = mk([R(id)], 13), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999; me.crit = 0; me.maxHp = hp; const r = b.act(me.uid, { si: 0, target: foe.uid }); return evs(r).filter(e => e.t === 'hit' && e.src === me.uid).reduce((t, e) => t + e.dmg, 0); };
    ok(dmg(20000) > dmg(2000) * 2, 'HP-scaled skill'); }

  // ประหาร (execute): more damage under half HP
  { const id = sp('T_EXEC', 'A01', { skills: [{ execute: 1 }] });
    const dmg = (frac: number) => { const b = mk([R(id)], 17), me = b.units[0], foe = foe1(b); foe.maxHp = 99999; foe.hp = Math.round(99999 * frac); me.crit = 0; const r = b.act(me.uid, { si: 0, target: foe.uid }); return evs(r).filter(e => e.t === 'hit' && e.src === me.uid).reduce((t, e) => t + e.dmg, 0); };
    ok(dmg(0.3) > dmg(0.9) * 1.6, 'execute bonus under half HP'); }

  // สายฟ้ากระโดด (chain): jumps to the other enemies
  { const id = sp('T_CHAIN', 'A03', { skills: [{ chain: 2 }] });
    const stage = { ...st, waves: [[{ sid: 'A02', lvl: 5, stars: 1 }, { sid: 'A06', lvl: 5, stars: 1 }, { sid: 'A04', lvl: 5, stars: 1 }]] };
    const b = new Battle(5, [R(id)], stage as any) as any, me = b.units[0], foes = b.units.filter((u: any) => u.team === 1);
    for (const f of foes) f.hp = f.maxHp = 99999;
    const r = b.act(me.uid, { si: 0, target: foes[0].uid }); ok(r.targets.length === 3 && foes.every((f: any) => f.hp < 99999), 'chain hits 3 enemies'); }

  // ร่วมรบ (assist): teammates strike the target
  { const id = sp('T_ASSIST', 'A05', { skills: [{}, { mult: 1, target: 'enemy', effects: [{ kind: 'assist', n: 2, value: 0.6 }] }] });
    const b = mk([R(id), R('A01'), R('A02')]), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999;
    const r = b.act(me.uid, { si: 1, target: foe.uid }); const srcs = new Set(evs(r).filter(e => e.t === 'hit' && e.tgt === foe.uid).map(e => e.src));
    ok(srcs.size === 3, 'assist: two teammates join the attack'); }

  // กินฝันร้าย (dreamEat): eats every harmful status and heals per status
  { const id = sp('T_DREAM', 'A05', { skills: [{}, { mult: 0, target: 'allyAll', effects: [{ kind: 'dreamEat', value: 0.1, to: 'allies' }] }] });
    const b = mk([R(id), R('A01')]), me = b.units[0], fox = b.units[1]; fox.hp = Math.round(fox.maxHp * 0.5);
    fox.statuses.push({ id: 'burn', turns: 2 }, { id: 'atk_down', turns: 2 });
    b.act(me.uid, { si: 1, target: fox.uid }); ok(!fox.statuses.some((s: any) => s.id === 'burn' || s.id === 'atk_down') && fox.hp === Math.round(fox.maxHp * 0.5) + Math.round(fox.maxHp * 0.2), 'dream eat cleanses and heals per status'); }

  // แช่แข็ง (freeze): loses its turn; the next enemy hit deals +30% and thaws it; bosses resist
  { const b = mk([R('A01')]), me = b.units[0], foe = foe1(b); foe.hp = foe.maxHp = 99999; foe.statuses.push({ id: 'freeze', turns: 2 });
    me.atb = 0; foe.atb = 99; const ts = b.nextTurn(); ok(ts.uid === foe.uid && ts.skip && ts.events.some((e: any) => e.t === 'skip' && e.reason === 'freeze'), 'freeze skips the turn');
    const b2 = mk([R('A01')], 21), m2 = b2.units[0], f2 = foe1(b2); f2.hp = f2.maxHp = 99999; m2.crit = 0;
    const b3 = mk([R('A01')], 21), m3 = b3.units[0], f3 = foe1(b3); f3.hp = f3.maxHp = 99999; m3.crit = 0; f3.statuses.push({ id: 'freeze', turns: 2 });
    b2.act(m2.uid, { si: 0, target: f2.uid }); b3.act(m3.uid, { si: 0, target: f3.uid });
    ok((99999 - f3.hp) > (99999 - f2.hp) * 1.2 && !f3.statuses.some((s: any) => s.id === 'freeze'), 'a hit shatters freeze for +30%');
    const b4 = mk([R('A01')]), m4 = b4.units[0], f4 = foe1(b4); f4.boss = true; const ev: any[] = []; b4.addStatus(m4, f4, 'freeze', 1, 1, ev, true); ok(!f4.statuses.some((s: any) => s.id === 'freeze'), 'bosses resist freeze'); }

  // สับสน (confuse): sometimes strikes a teammate, never lethally
  { let hitAlly = false, lethal = false;
    for (let s = 1; s < 40 && !hitAlly; s++) { const b = mk([R('A01'), R('A02')], s), me = b.units[0], al = b.units[1], foe = foe1(b); foe.hp = foe.maxHp = 99999; al.hp = 1;
      me.statuses.push({ id: 'confuse', turns: 2 }); const r = b.act(me.uid, { si: 0, target: foe.uid }); if (evs(r).some(e => e.t === 'confused')) { hitAlly = true; lethal = !al.alive || al.hp < 1; } }
    ok(hitAlly && !lethal, 'confused unit strikes a teammate without killing it'); }

  // determinism with every new mechanic in play
  { const team = ['T_BASH', 'T_MULTI', 'T_CHAIN', 'T_AURA'].map(R), a = simulate(31, team, STAGES[3]), b = simulate(31, team, STAGES[3]);
    ok(a.rng === b.rng && a.log.join() === b.log.join(), 'new mechanics stay deterministic'); }

  for (const id of made) delete SPECIES[id];

  // no two monsters share an identical skill 2 or 3 (two pairs predate the rule; keep the list from growing)
  { const LEGACY = new Set(['A05.2|C01.2', 'A07.2|C03.2']);
    const sig = (k: any) => JSON.stringify({ t: k.target, m: k.mult, cd: k.cd, i: k.ignoreDef || 0, h: k.hits || 1, s: k.scale || '', x: k.execute || 0, c: k.chain || 0, e: (k.effects || []).map((e: any) => [e.kind, e.status, e.elem, e.turns, e.chance, e.value, e.n, e.to].join()).sort() });
    const seen: Record<string, string[]> = {};
    for (const s of Object.values(SPECIES)) { if (s.boss) continue; for (const rare of s.rareForm ? [false, true] : [false]) { const f = formOf(s.id, rare); [1, 2].forEach(i => (seen[sig(f.skills[i])] ||= []).push(s.id + (rare ? 'r' : '') + '.' + (i + 1))); } }
    const dup = Object.values(seen).filter(v => v.length > 1 && !LEGACY.has(v.join('|')));
    ok(!dup.length, 'every skill 2 / 3 is unique: ' + JSON.stringify(dup)); }

  console.log(fail ? `mechanics: ${fail} FAILED` : 'mechanics OK');
  return fail;
}
