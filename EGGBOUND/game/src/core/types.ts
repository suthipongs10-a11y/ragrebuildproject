// Battle-core types. Pure data; no DOM / rendering.
import type { RuneBonus } from './runes';
export type Elem = 'fire' | 'water' | 'wind' | 'earth' | 'light' | 'dark';
export type Role = 'Attacker' | 'Defender' | 'Support' | 'Healer' | 'Controller';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type StatusId =
  | 'burn' | 'poison' | 'stun' | 'sleep' | 'blind' | 'def_down' | 'atk_down' | 'spd_down'
  | 'atk_up' | 'def_up' | 'spd_up' | 'crit_up' | 'shield' | 'regen'
  // light/dark rare-form mechanics: invincible (no damage), immunity (no harmful status), protect (an ally takes half the
  // damage; value = protector uid) · provoke (must hit the provoker with skill 1; value = provoker uid), silence (skill 1
  // only), unheal (cannot be healed), brand (+25% damage taken), bomb (explodes when it runs out; value = raw damage)
  | 'invincible' | 'immunity' | 'protect'
  | 'provoke' | 'silence' | 'unheal' | 'brand' | 'bomb';
export const NEGATIVE: StatusId[] = ['burn', 'poison', 'stun', 'sleep', 'blind', 'def_down', 'atk_down', 'spd_down', 'provoke', 'silence', 'unheal', 'brand', 'bomb'];
export type TargetKind = 'enemy' | 'enemyAll' | 'allyAll' | 'self';
export type AnimId =
  | 'melee' | 'shot' | 'volley' | 'heal' | 'buff' | 'shield'
  | 'ult_dash' | 'ult_rain' | 'ult_vortex' | 'ult_quake' | 'ult_starlight' | 'ult_nightwave' | 'ult_roots';

export interface SkillEffect {
  // revive: fallen allies come back with `value` of max HP (`n` of them, 0 = all) · strip: remove `n` beneficial statuses
  // (0 = all) · cdTeam: allies' non-ultimate cooldowns −`value` · steal: take `value` turn gauge, shared out to the caster's team
  kind: 'mark' | 'status' | 'heal' | 'shield' | 'atb' | 'cleanse' | 'drain' | 'revive' | 'strip' | 'cdTeam' | 'steal';
  elem?: Elem;
  status?: StatusId;
  turns?: number;
  chance?: number;      // 0..1, default 1
  value?: number;       // heal/shield pct of target max HP, atb delta, drain pct, bomb power (× ATK like a skill mult)
  n?: number;           // revive / strip count (0 or absent = all)
  to?: 'target' | 'allies' | 'self' | 'enemies';
}
export interface SkillDef {
  id: string; name: string; desc: string;
  cd: number; target: TargetKind;
  mult: number;                 // 0 = no damage
  elem?: Elem;                  // defaults to caster element
  ignoreDef?: number;           // 0..1 share of the target's DEF ignored
  effects: SkillEffect[];
  anim: AnimId;
  ult?: boolean;
}
/** rare-form passive (สกิลร่างหายาก): the 4th skill only a rare-form monster has. Works on its own in battle. */
export type PassiveKind =
  | 'hitStatusAtb'   // hitting a target that has `status` → `chance` to gain `value` turn gauge
  | 'healCleanse'    // its heals also remove 1 negative status (`chance`)
  | 'hitAtbDrain'    // every hit lowers the target's turn gauge by `value`
  | 'guard'          // takes `value` less damage while above half HP
  | 'startAtb'       // battle start: all allies +`value` turn gauge
  | 'debuffExtend'   // negative statuses it inflicts last +`value` turn
  | 'deathGift'      // when it falls: allies heal `value` of max HP and +30 turn gauge
  | 'revive'         // once per battle the first ally to fall comes back with `value` HP
  | 'thorns'         // reflects `value` of damage taken to the attacker (cannot kill)
  | 'endure'         // once per battle survives a lethal blow at 1 HP and gains a `value` shield
  | 'curseOnHit'     // when hit: `chance` to give the attacker `status`
  | 'turnHeal'       // each of its turns: heals the weakest ally `value` of max HP
  | 'killTurn'       // defeating an enemy grants another turn right away
  | 'counter'        // when hit: `chance` to strike back with skill 1 at `value` power
  | 'startShield'    // battle start: all allies get a `value` shield for 2 turns
  | 'critDebuff'     // its critical hits inflict `status`
  | 'overheal';      // overflow from its heals becomes a shield (up to `value` of max HP)
export interface PassiveDef { kind: PassiveKind; name: string; desc: string; chance?: number; value?: number; status?: StatusId }
export interface LeaderSkill { stat: 'atk' | 'hp' | 'def' | 'spd' | 'crit' | 'res'; value: number; text: string }
export interface SpeciesDef {
  id: string; name: string; nameEn: string;
  elem: Elem; role: Role; rarity: Rarity;
  base: { hp: number; atk: number; def: number; spd: number };
  skills: [SkillDef, SkillDef, SkillDef];
  leader?: LeaderSkill;
  rarePassive?: PassiveDef;     // unlocked only by the rare form
  /** the rare form is a light/dark monster of its own: same name, new element, skill 1 kept (in the new element),
   *  its own skills 2 and 3 (decided 2026-10-13) */
  rareForm?: { elem: Elem; skills: [SkillDef, SkillDef] };
  boss?: boolean;
  /** Starborn Legends (ตำนานดารา): zone bosses whose shards (rare drop) build their egg; never in mystery eggs */
  starborn?: boolean;
  scale?: number;               // render scale multiplier
  art?: string;                 // sprite set key; absent → placeholder recolor
}
export interface MonsterRef { sid: string; lvl: number; stars: number; sk?: number[]; rare?: boolean; rb?: RuneBonus }  // sk = skill levels (default 1) · rb = its runes (core/runes.ts)
/** boss: this unit is a zone boss (bars, boss rules) even when its species is a normal monster · name/scale: elite title & size */
export interface EnemyRef extends MonsterRef { hpMult?: number; atkMult?: number; boss?: boolean; name?: string; scale?: number }
/** a zone (โซน) on the world map: one place with five stages, the fifth is its boss */
export interface ZoneDef { id: string; realm: string; name: string; desc: string; loc: string }
export interface StageDef {
  id: string; name: string; desc: string;
  zone: string; n: number; realm: string; // zone id, stage number in the zone (1..5, 5 = boss), realm id
  diff?: number; // difficulty (data.ts DIFFS): 0 easy = the base stage, 1 normal, 2 hard; id is then `<stage>@n|@h`
  loc?: string; // battle arena (render/locations.ts); none = the default meadow
  waves: EnemyRef[][];
  reward: { gold: number; exp: number };
  stamina: number;
}

export interface Status { id: StatusId; turns: number; value?: number; fresh?: boolean }
export interface Mark { elem: Elem; turns: number; fresh?: boolean; wild?: boolean } // wild: left by a light/dark rare form — any element sets it off
export interface Unit {
  uid: number; team: 0 | 1; slot: number;
  sid: string; name: string; elem: Elem; role: Role;
  lvl: number; stars: number; boss: boolean; scale?: number; // scale: elite boss size (render only)
  maxHp: number; hp: number; atk: number; def: number; spd: number;
  crit: number; critDmg: number; res: number; acc: number;
  atb: number; cds: number[]; skills: SkillDef[];
  statuses: Status[]; marks: Mark[];
  alive: boolean; leader: boolean;
  rare?: boolean; passive?: PassiveDef; pUsed?: boolean;
  runeReact?: number; leech?: number; markUp?: number; // rune sets: reaction damage, lifesteal, element-mark chance
}

// ---- events ----
export type Ev =
  | { t: 'hit'; src: number; tgt: number; dmg: number; crit: boolean; em: number; miss?: boolean; hp: number; shieldAbs?: number; inv?: boolean }
  | { t: 'revive'; tgt: number; hp: number }
  | { t: 'strip'; tgt: number }
  | { t: 'cd'; tgt: number; delta: number }
  | { t: 'heal'; tgt: number; amt: number; hp: number }
  | { t: 'status'; tgt: number; id: StatusId; add: boolean; turns?: number }
  | { t: 'resist'; tgt: number; id: StatusId }
  | { t: 'mark'; tgt: number; elem: Elem; add: boolean }
  | { t: 'shield'; tgt: number; amt: number }
  | { t: 'atb'; tgt: number; delta: number; atb: number }
  | { t: 'cleanse'; tgt: number }
  | { t: 'reaction'; id: ReactionId; src: number; tgt: number; sub: Ev[] }
  | { t: 'death'; uid: number }
  | { t: 'dot'; tgt: number; id: StatusId; dmg: number; hp: number }
  | { t: 'skip'; uid: number; reason: StatusId | 'dead' }
  | { t: 'wave'; wave: number; units: number[] }
  | { t: 'passive'; uid: number; name: string }
  | { t: 'end'; win: boolean };
export type ReactionId = 'wildfire' | 'storm' | 'steam' | 'lava' | 'eclipse';

export interface TurnStart { uid: number; events: Ev[]; skip: boolean }
export interface ActionResult {
  uid: number; skillIndex: number; skill: SkillDef; ult: boolean; perfect: boolean;
  targets: number[];
  impacts: Record<number, Ev[]>;   // per target, applied at the animation's impact moment
  after: Ev[];                       // wave changes / end, applied after the animation
}
export interface Command { si: number; target: number; perfect?: boolean }

// ---- home (turtle base) modifiers passed into a battle; PvE gets full value, PvP should pass halved values ----
export type RelicId = 'sun' | 'gourd' | 'feather' | 'shell';
export interface HomeMods { elemAtk?: Partial<Record<Elem, number>>; react?: Partial<Record<Elem, number>>; relic?: RelicId | null }
