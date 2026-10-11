import type { ContentBundle, MonsterDef, SpiritSkillDef } from '../content/types';
import type { Element } from '../formulas/elements';
import { cfg, familyOf, sskillOf, spiritStats, type RuneInst, type SpiritInst } from '../spirits/model';
import { scaledDef } from '../rules/arena';

/**
 * Turn battle (SW style, GDD §4.1): units and skills. Spirits keep their stats from runes / stars / levels; monsters
 * are converted from their field numbers with `spirit_config.csv` `tb_*` multipliers. Pure data, no Phaser.
 */
export type Side = 'ally' | 'enemy';

export interface TbSkill {
  id: string; name_key: string; kind: 'basic' | 'ult' | 'boss';
  target: 'one' | 'all';
  /** damage multiplier of ATK per target */
  power: number;
  /** turns to wait after use (0 = every turn) */
  cd: number;
  /** fraction of max HP: basic → the weakest ally, ult → every ally */
  heal: number; shield: number;
  /** stun chance per target, DEF removed (fraction, 2 turns), extra crit %, ignore 30 % DEF */
  stun: number; defDown: number; crit: number; pierce: boolean;
  vfx: string;
}

export interface TbUnit {
  key: string; side: Side; slot: number;
  /** spirit uid or monster id (pictures / rewards) */
  uid: number | null; id: string; name_key: string; awk: boolean; boss: boolean;
  el: Element; level: number; exp: number;
  maxHp: number; hp: number; atk: number; def: number; spd: number; crit: number; critDmg: number; lifesteal: number;
  /** attack bar 0–100: the unit acts when it is full */
  bar: number;
  skills: TbSkill[]; cd: number[];
  stun: number; defDown: number; defDownT: number; shield: number; shieldT: number;
  turns: number; phase: number; minion: string | null; dead: boolean;
}

/** `tb_*` config value (spirit_config.csv). */
export const tbc = (c: ContentBundle, key: string, dflt: number): number => cfg(c, `tb_${key}`, dflt);

function blank(): Omit<TbUnit, 'key' | 'side' | 'slot' | 'uid' | 'id' | 'name_key' | 'awk' | 'boss' | 'el' | 'level' | 'exp' | 'maxHp' | 'hp' | 'atk' | 'def' | 'spd' | 'crit' | 'critDmg' | 'lifesteal' | 'skills' | 'cd' | 'minion'> {
  return { bar: 0, stun: 0, defDown: 0, defDownT: 0, shield: 0, shieldT: 0, turns: 0, phase: 1, dead: false };
}

/** A spirit skill row → turn rules. Auto skill = skill 1 (every turn), ultimate = skill 2 (all enemies, cooldown). */
export function tbSkill(c: ContentBundle, d: SpiritSkillDef): TbSkill {
  const e = d.effects, ult = d.type === 'ult', aoe = d.target === 'aoe' || d.target === 'all';
  const support = ult ? 1 : tbc(c, 'heal_mult', 4);
  return {
    id: d.id, name_key: d.name_key, kind: ult ? 'ult' : 'basic', target: aoe || ult ? 'all' : 'one',
    power: ult ? d.power * Math.max(1, d.hits) * tbc(c, 'ult_mult', 0.6) : d.power * (aoe ? tbc(c, 'aoe_mult', 0.6) : 1),
    cd: ult ? tbc(c, 'ult_cd', 4) : 0,
    heal: (e.heal ?? 0) * support, shield: (e.shield ?? 0) * support,
    stun: Math.min(0.8, (e.stun ?? 0) * tbc(c, 'stun_mult', 0.6)), defDown: Math.min(0.7, (e.defdown ?? 0) * tbc(c, 'defdown_mult', 2)),
    crit: e.crit ?? 0, pierce: (e.pierce ?? 0) > 0, vfx: d.vfx,
  };
}

/** Leader skill of the battle team's first spirit: % stats, crit, speed, starting attack bar. */
export function leaderEffects(c: ContentBundle, leader: SpiritInst | undefined): Record<string, number> {
  const f = leader && familyOf(c, leader.id), sk = f && sskillOf(c, f.leader);
  return sk ? { ...sk.effects } : {};
}

export function spiritUnit(c: ContentBundle, s: SpiritInst, runes: readonly RuneInst[], slot: number, lead: Record<string, number>): TbUnit {
  const f = familyOf(c, s.id), st = spiritStats(c, s, runes);
  const p = (k: string) => 1 + (lead[k] ?? 0) / 100;
  const skills = [f && sskillOf(c, s.awk ? f.awk_auto : f.auto), f && sskillOf(c, f.ult)].filter((d): d is SpiritSkillDef => !!d).map((d) => tbSkill(c, d));
  const hp = Math.round(st.hp * p('hp_p'));
  return {
    ...blank(), key: `a${slot}`, side: 'ally', slot, uid: s.uid, id: s.id, name_key: f?.name_key ?? s.id, awk: s.awk, boss: false,
    el: s.el, level: s.lv, exp: 0, maxHp: hp, hp, atk: Math.round(st.atk * p('atk_p')), def: Math.round(st.def * p('def_p')),
    spd: Math.round(st.spd * (1 + ((lead.speed ?? 0) + (lead.aspd ?? 0)) / 100)), crit: Math.min(90, st.crit + (lead.crit ?? 0)), critDmg: st.critDmg,
    lifesteal: st.lifesteal, bar: Math.min(90, st.gauge + (lead.gauge ?? 0)), skills, cd: skills.map(() => 0), minion: null,
  };
}

const BASIC: TbSkill = { id: 'mon_hit', name_key: 'tb.hit', kind: 'basic', target: 'one', power: 1, cd: 0, heal: 0, shield: 0, stun: 0, defDown: 0, crit: 0, pierce: false, vfx: '' };

/** Field monster → turn unit. Bosses get a whole-team attack on a cooldown and call their minions when hurt. */
export function monsterUnit(c: ContentBundle, base: MonsterDef, scale: number, slot: number, key: string): TbUnit {
  // daily dungeon scales monsters to the hero's level; spirits lag behind the hero, so only part of it counts here
  const m = scaledDef(base, 1 + (scale - 1) * tbc(c, 'scale', 0.6)), boss = m.tier !== 'normal';
  const skills: TbSkill[] = [BASIC];
  if (boss) skills.push({ ...BASIC, id: 'boss_wave', name_key: 'tb.bossSkill', kind: 'boss', target: 'all', power: tbc(c, 'boss_aoe', 0.7), cd: tbc(c, 'boss_cd', 3), stun: tbc(c, 'boss_stun', 0.25), vfx: 'slam' });
  // field HP / ATK grow faster with level than spirit stats: divide by a level factor so hits-to-kill rise gently
  const hpLv = 1 + m.level * tbc(c, 'hp_lv', 0.08), atkLv = 1 + m.level * tbc(c, 'atk_lv', 0.04);
  const hp = Math.max(1, Math.round((m.hp * tbc(c, boss ? 'boss_hp' : 'mon_hp', boss ? 0.15 : 0.5)) / hpLv));
  const minion = typeof m.ai_params.minion === 'string' ? m.ai_params.minion : null;
  return {
    ...blank(), key, side: 'enemy', slot, uid: null, id: m.id, name_key: m.name_key, awk: false, boss,
    el: m.element, level: m.level, exp: m.exp, maxHp: hp, hp, atk: Math.max(1, Math.round((m.atk * tbc(c, boss ? 'boss_atk' : 'mon_atk', 2)) / atkLv)), def: m.def,
    spd: Math.round(tbc(c, 'mon_spd', 90) + m.level + (boss ? tbc(c, 'boss_spd', 10) : 0)), crit: 5, critDmg: 50, lifesteal: 0,
    skills, cd: skills.map((s) => s.cd), minion, // the boss skill waits for its first cooldown
  };
}
