import type { Element } from '../formulas/elements';

export type MonsterTier = 'normal' | 'mini' | 'mvp' | 'world';
export type MonsterAi = 'hopper' | 'walker' | 'charger' | 'flyer' | 'swimmer' | 'turret' | 'boss';

export interface MonsterDef {
  id: string; name_key: string; tier: MonsterTier; zone: string; level: number;
  hp: number; atk: number; def: number; element: Element; element_lv: number;
  size: 'small' | 'medium' | 'large'; ai: MonsterAi; ai_params: Record<string, unknown>;
  stompable: boolean; exp: number; job_exp: number; soul_min: number; soul_max: number;
  card_id: string; card_rate: number; respawn_sec: number; art_pack: string;
  /** normal monsters: how many spawn at each spawn point of a room */
  pack: number;
  hitbox: { w: number; h: number }; draw_h: number;
  /** look-alike until the monster's own art exists: another monster's id + a tint (RGB) */
  art: string | null; tint: number | null;
}

export interface DropDef { monster_id: string; item_id: string; rate: number; min: number; max: number }

export interface ItemDef {
  id: string; name_key: string; type: string; subtype: string; tier: string; job_mask: string[];
  level_req: number; atk: number; matk: number; def: number; hp: number; sp: number;
  str: number; agi: number; vit: number; int: number; dex: number; luk: number; crit: number;
  element: Element | null; slots: number; refineable: boolean; price: number; icon: string; rig_parts: string | null;
  /** consumables: {"heal":45,"sp":0} */
  use: Record<string, number> | null;
}

export type JobId = 'novice' | 'swordsman' | 'mage' | 'archer' | 'acolyte';
export interface JobDef {
  id: JobId; name_key: string; tier: number; from_job: JobId | null; job_lv_req: number; job_max: number;
  hp_factor: number; sp_factor: number; aspd_factor: number; weapons: string[]; starter_weapon: string; parts_set: string; skills: string[];
  /** job-change screen bars, 1–5: dmg, tank, range, support, ease */
  ratings: Record<string, number>;
}

export interface CardDef { id: string; name_key: string; slot_type: string; effects: Record<string, unknown>; set_id: string | null; art: string }

export type SpiritRole = 'attacker' | 'tank' | 'support' | 'healer';
export type SpiritAbility = 'double' | 'dive' | 'break' | 'cloud' | 'reveal' | 'none';

/** One spirit family (spirits.csv). Element variants come from `elements` (1-3★: 4 basic, 4-5★: + holy/dark). */
export interface SpiritDef {
  id: string; name_key: string; element: Element; elements: Element[]; base_star: number; role: SpiritRole;
  hp: number; atk: number; def: number; spd: number; crit: number;
  auto: string; awk_auto: string; ult: string; leader: string; ability: SpiritAbility;
  awk_ess: number; awk_magic: number;
  art_small: string; art_big: string; art_awk_small: string; art_awk_big: string;
}

/** spirit_skills.csv — auto (skill 1), ult (skill 3), leader. power = x spirit ATK per hit. */
export interface SpiritSkillDef {
  id: string; name_key: string; type: 'auto' | 'ult' | 'leader'; cd: number; target: 'bolt' | 'aoe' | 'all' | 'none';
  hits: number; power: number; effects: Record<string, number>; vfx: string;
}
export interface SpiritElementDef { element: Element; hp: number; atk: number; def: number; spd: number; essence: string; color: number }
export interface RuneSetDef { id: string; name_key: string; pieces: number; bonus: Record<string, number> }
export interface RuneStatDef { stat: string; name_key: string; flat: boolean; main_slots: number[]; main_lo: number; main_hi: number; sub_lo: number; sub_hi: number }
export interface RuneUpgradeDef { lv: number; rate: number; soul: number }
export interface RuneDropDef { tier: string; chance: number; star_lo: number; star_hi: number; rarity: number[] }
/** book.csv: Adventure Book milestones (permanent stat rewards). target: monster id, 'any', or room ids for maps. */
export interface BookEntryDef { id: string; kind: 'kill' | 'card' | 'spirit' | 'map'; target: string[]; count: number; reward: Record<string, number>; note: string; /** soul stones paid once on claim */ soul: number }

/** dungeon.csv: daily dungeon per weekday (0 = Sunday). */
export interface DungeonDayDef { day: number; element: string; essence: string; monsters: string[] }
/** tower.csv: one floor; monsters as id x count, stat scale, first-clear reward items. */
export interface TowerFloorDef { floor: number; monsters: { id: string; n: number }[]; scale: number; reward: Record<string, number>; soul: number }

/** unlocks.csv: features that open at a base level (so new players aren't buried in menus). */
export interface UnlockDef { feature: string; level: number; name_key: string }
/** quests.csv: the guided main-story chain. kind: kill / level / summon / visit / job / tower. reward: items + soul. */
export interface QuestDef { id: string; kind: string; target: string; count: number; reward: Record<string, number>; text_key: string }

/** summon.csv: rates[i] = chance of (i+1)★; elements 'pick' = player chooses. */
export interface SummonDef { id: string; item: string; name_key: string; elements: string[]; rates: number[]; pity_n: number; pity_star: number }

export interface SkillDef {
  id: string; owner: string; name_key: string; type: 'active' | 'passive' | 'ult' | 'leader';
  max_lv: number; sp: string; cd: number; cast: number; target: string; hit_count: number;
  power: string; element: string | null; effects: Record<string, unknown>; requires: Record<string, number>;
  icon: string; vfx: string | null;
}

export interface ContentBundle {
  contentVersion: string;
  monsters: MonsterDef[];
  drops: DropDef[];
  items: ItemDef[];
  cards: CardDef[];
  spirits: SpiritDef[];
  skills: SkillDef[];
  jobs: JobDef[];
  spiritSkills: SpiritSkillDef[];
  spiritElements: SpiritElementDef[];
  spiritConfig: Record<string, string>;
  summon: SummonDef[];
  runeSets: RuneSetDef[];
  runeStats: RuneStatDef[];
  runeUpgrade: RuneUpgradeDef[];
  runeDrop: RuneDropDef[];
  book: BookEntryDef[];
  dungeon: DungeonDayDef[];
  tower: TowerFloorDef[];
  unlocks: UnlockDef[];
  quests: QuestDef[];
}
