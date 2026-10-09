import type { Element } from '../formulas/elements';

export type MonsterTier = 'normal' | 'mini' | 'mvp' | 'world';
export type MonsterAi = 'hopper' | 'walker' | 'charger' | 'flyer' | 'swimmer' | 'turret' | 'boss';

export interface MonsterDef {
  id: string; name_key: string; tier: MonsterTier; zone: string; level: number;
  hp: number; atk: number; def: number; element: Element; element_lv: number;
  size: 'small' | 'medium' | 'large'; ai: MonsterAi; ai_params: Record<string, unknown>;
  stompable: boolean; exp: number; job_exp: number; zeny_min: number; zeny_max: number;
  card_id: string; card_rate: number; respawn_sec: number; art_pack: string;
  hitbox: { w: number; h: number }; draw_h: number;
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
}

export interface CardDef { id: string; name_key: string; slot_type: string; effects: Record<string, unknown>; set_id: string | null; art: string }

export interface SpiritDef {
  id: string; family: string; name_key: string; element: Element; base_star: number;
  hp: number; atk: number; def: number; spd: number;
  auto_skill: string; ult_skill: string; leader_skill: string; ability: string;
  awaken_to: string | null; art_small: string; art_big: string;
}

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
}
