// Battle-core types. Pure data; no DOM / rendering.
export type Elem = 'fire' | 'water' | 'wind' | 'earth' | 'light' | 'dark';
export type Role = 'Attacker' | 'Defender' | 'Support' | 'Healer' | 'Controller';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type StatusId =
  | 'burn' | 'poison' | 'stun' | 'sleep' | 'blind' | 'def_down' | 'atk_down' | 'spd_down'
  | 'atk_up' | 'def_up' | 'spd_up' | 'crit_up' | 'shield' | 'regen';
export const NEGATIVE: StatusId[] = ['burn', 'poison', 'stun', 'sleep', 'blind', 'def_down', 'atk_down', 'spd_down'];
export type TargetKind = 'enemy' | 'enemyAll' | 'allyAll' | 'self';
export type AnimId =
  | 'melee' | 'shot' | 'volley' | 'heal' | 'buff' | 'shield'
  | 'ult_dash' | 'ult_rain' | 'ult_vortex' | 'ult_quake' | 'ult_starlight' | 'ult_nightwave' | 'ult_roots';

export interface SkillEffect {
  kind: 'mark' | 'status' | 'heal' | 'shield' | 'atb' | 'cleanse' | 'drain';
  elem?: Elem;
  status?: StatusId;
  turns?: number;
  chance?: number;      // 0..1, default 1
  value?: number;       // heal/shield pct of target max HP, atb delta, drain pct
  to?: 'target' | 'allies' | 'self' | 'enemies';
}
export interface SkillDef {
  id: string; name: string; desc: string;
  cd: number; target: TargetKind;
  mult: number;                 // 0 = no damage
  elem?: Elem;                  // defaults to caster element
  effects: SkillEffect[];
  anim: AnimId;
  ult?: boolean;
}
export interface LeaderSkill { stat: 'atk' | 'hp' | 'def' | 'spd' | 'crit' | 'res'; value: number; text: string }
export interface SpeciesDef {
  id: string; name: string; nameEn: string;
  elem: Elem; role: Role; rarity: Rarity;
  base: { hp: number; atk: number; def: number; spd: number };
  skills: [SkillDef, SkillDef, SkillDef];
  leader?: LeaderSkill;
  boss?: boolean;
  scale?: number;               // render scale multiplier
  art?: string;                 // sprite set key; absent → placeholder recolor
}
export interface MonsterRef { sid: string; lvl: number; stars: number; sk?: number[] }  // sk = skill levels (default 1)
export interface EnemyRef extends MonsterRef { hpMult?: number; atkMult?: number }
export interface StageDef {
  id: string; name: string; desc: string;
  waves: EnemyRef[][];
  reward: { gold: number; exp: number };
  stamina: number;
}

export interface Status { id: StatusId; turns: number; value?: number; fresh?: boolean }
export interface Mark { elem: Elem; turns: number; fresh?: boolean }
export interface Unit {
  uid: number; team: 0 | 1; slot: number;
  sid: string; name: string; elem: Elem; role: Role;
  lvl: number; stars: number; boss: boolean;
  maxHp: number; hp: number; atk: number; def: number; spd: number;
  crit: number; critDmg: number; res: number; acc: number;
  atb: number; cds: number[]; skills: SkillDef[];
  statuses: Status[]; marks: Mark[];
  alive: boolean; leader: boolean;
}

// ---- events ----
export type Ev =
  | { t: 'hit'; src: number; tgt: number; dmg: number; crit: boolean; em: number; miss?: boolean; hp: number; shieldAbs?: number }
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
