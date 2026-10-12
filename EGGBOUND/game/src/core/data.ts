// P0 game data: 6 starters + realm boss + 3 stages of "ทุ่งไข่ป่วน".
// All numbers are starting values for playtest (see GAME_CONFIG_v2.json).
import type { SpeciesDef, StageDef, Elem, Rarity } from './types';

export const ELEM_NAME: Record<Elem, string> = { fire: 'ไฟ', water: 'น้ำ', wind: 'ลม', earth: 'ดิน', light: 'แสง', dark: 'มืด' };
export const ROLE_NAME: Record<string, string> = { Attacker: 'จู่โจม', Defender: 'ป้องกัน', Support: 'สนับสนุน', Healer: 'ฟื้นฟู', Controller: 'ควบคุม' };
export const RARITY_NAME: Record<string, string> = { common: 'ธรรมดา', rare: 'หายาก', epic: 'มหากาพย์', legendary: 'ตำนาน' };

export const SPECIES: Record<string, SpeciesDef> = {
  A01: {
    id: 'A01', name: 'จิ้งจอกเพลิงอรุณ', nameEn: 'Dawnflame Fox', elem: 'fire', role: 'Attacker', rarity: 'common', art: 'mon001',
    base: { hp: 820, atk: 118, def: 50, spd: 108 },
    leader: { stat: 'atk', value: 0.15, text: 'ATK ทั้งทีม +15%' },
    skills: [
      { id: 'fox_bite', name: 'กัดพุ่ง', desc: 'กัดศัตรู 1 ตัว', cd: 0, target: 'enemy', mult: 1.0, effects: [], anim: 'melee' },
      { id: 'fox_fireball', name: 'ลูกไฟจิ้งจอก', desc: 'ลูกไฟใส่ทุกตัว 70% ติดเครื่องหมายไฟ', cd: 3, target: 'enemyAll', mult: 0.55, effects: [{ kind: 'mark', elem: 'fire', chance: 0.7 }], anim: 'volley' },
      { id: 'fox_dawn', name: 'อรุณเพลิงทะยาน', desc: 'พุ่งทะลุทุกตัว 60% เผาไหม้ 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.25, effects: [{ kind: 'status', status: 'burn', turns: 2, chance: 0.6 }], anim: 'ult_dash', ult: true },
    ],
  },
  A02: {
    id: 'A02', art: 'monA02', name: 'สไลม์ธาราคราม', nameEn: 'Tidejelly Slime', elem: 'water', role: 'Healer', rarity: 'common',
    base: { hp: 960, atk: 86, def: 62, spd: 101 },
    leader: { stat: 'hp', value: 0.15, text: 'HP ทั้งทีม +15%' },
    skills: [
      { id: 'slime_spit', name: 'พ่นเมือก', desc: 'พ่นใส่ 1 ตัว 70% ติดเครื่องหมายเปียก', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'mark', elem: 'water', chance: 0.7 }], anim: 'shot' },
      { id: 'slime_bubble', name: 'ฟองฟื้นฟู', desc: 'ฮีลทั้งทีม 20% ของ HP สูงสุด', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.2, to: 'allies' }], anim: 'heal' },
      { id: 'slime_rain', name: 'ฝนชุ่มฉ่ำ', desc: 'ฮีลทั้งทีม 25% ล้างสถานะ + ศัตรูทุกตัวเปียก', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.25, to: 'allies' }, { kind: 'cleanse', to: 'allies' }, { kind: 'status', status: 'regen', turns: 2, to: 'allies' }, { kind: 'mark', elem: 'water', chance: 1, to: 'enemies' }], anim: 'ult_rain', ult: true },
    ],
  },
  A03: {
    id: 'A03', art: 'monA03', name: 'นกฮูกวายุพฤกษ์', nameEn: 'Galeleaf Owl', elem: 'wind', role: 'Controller', rarity: 'common',
    base: { hp: 860, atk: 100, def: 55, spd: 112 },
    leader: { stat: 'spd', value: 0.10, text: 'SPD ทั้งทีม +10%' },
    skills: [
      { id: 'owl_blade', name: 'ใบมีดลม', desc: 'ใบมีดลมใส่ 1 ตัว', cd: 0, target: 'enemy', mult: 1.0, effects: [], anim: 'shot' },
      { id: 'owl_storm', name: 'พายุใบไม้', desc: 'ใส่ทุกตัว ลดเกจ 20', cd: 3, target: 'enemyAll', mult: 0.5, effects: [{ kind: 'atb', value: -20 }], anim: 'volley' },
      { id: 'owl_eye', name: 'ตาพายุ', desc: 'พายุหมุนใส่ 1 ตัว 70% หลับ 2 เทิร์น', cd: 4, target: 'enemy', mult: 1.7, effects: [{ kind: 'status', status: 'sleep', turns: 2, chance: 0.7 }], anim: 'ult_vortex', ult: true },
    ],
  },
  A04: {
    id: 'A04', art: 'monA04', name: 'โกเลมศิลามรกต', nameEn: 'Mossstone Golem', elem: 'earth', role: 'Defender', rarity: 'common',
    base: { hp: 1100, atk: 84, def: 84, spd: 97 },
    leader: { stat: 'def', value: 0.2, text: 'DEF ทั้งทีม +20%' },
    skills: [
      { id: 'golem_smash', name: 'ทุบหิน', desc: 'ทุบ 1 ตัว 60% ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'earth', chance: 0.6 }], anim: 'melee' },
      { id: 'golem_wall', name: 'กำแพงมอส', desc: 'โล่ทั้งทีม 18% ของ HP สูงสุด 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.18, turns: 2, to: 'allies' }], anim: 'shield' },
      { id: 'golem_quake', name: 'ทุบแผ่นดิน', desc: 'ทุกตัว 80% ลด DEF 2 เทิร์น', cd: 4, target: 'enemyAll', mult: 0.9, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.8 }], anim: 'ult_quake', ult: true },
    ],
  },
  A05: {
    id: 'A05', art: 'monA05', name: 'ภูตปีกแสงดารา', nameEn: 'Starwing Sprite', elem: 'light', role: 'Support', rarity: 'common',
    base: { hp: 880, atk: 96, def: 58, spd: 110 },
    leader: { stat: 'crit', value: 0.10, text: 'อัตราคริ ทั้งทีม +10%' },
    skills: [
      { id: 'sprite_beam', name: 'ลำแสงดาว', desc: 'ลำแสงใส่ 1 ตัว 40% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'light', chance: 0.4 }], anim: 'shot' },
      { id: 'sprite_bless', name: 'พรดารา', desc: 'เพิ่ม ATK ทั้งทีม 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'atk_up', turns: 2, to: 'allies' }], anim: 'buff' },
      { id: 'sprite_star', name: 'ประกายฟื้นใจ', desc: 'เติมเกจทั้งทีม 30 + ฮีล 10% + คริขึ้น', cd: 4, target: 'allyAll', mult: 0, effects: [{ kind: 'atb', value: 30, to: 'allies' }, { kind: 'heal', value: 0.1, to: 'allies' }, { kind: 'status', status: 'crit_up', turns: 2, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  A06: {
    id: 'A06', art: 'monA06', name: 'เห็ดเงาราตรี', nameEn: 'Duskcap Shroom', elem: 'dark', role: 'Controller', rarity: 'common',
    base: { hp: 870, atk: 98, def: 56, spd: 105 },
    leader: { stat: 'res', value: 0.15, text: 'ต้านทานสถานะ ทั้งทีม +15%' },
    skills: [
      { id: 'shroom_spore', name: 'สปอร์พิษ', desc: 'ใส่ 1 ตัว 60% ติดพิษ 2 เทิร์น', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'status', status: 'poison', turns: 2, chance: 0.6 }], anim: 'shot' },
      { id: 'shroom_mist', name: 'หมอกเงา', desc: 'ทุกตัว 50% ตาบอด 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.45, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.5 }], anim: 'volley' },
      { id: 'shroom_night', name: 'ราตรีหลับใหล', desc: 'ทุกตัว ติดเครื่องหมายมืด 45% หลับ 1 เทิร์น', cd: 4, target: 'enemyAll', mult: 0.65, effects: [{ kind: 'mark', elem: 'dark', chance: 1 }, { kind: 'status', status: 'sleep', turns: 1, chance: 0.45 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  BOSS_ROOT: {
    id: 'BOSS_ROOT', name: 'อสูรรากไม้ยักษ์', nameEn: 'Giant Rootwalker', elem: 'earth', role: 'Defender', rarity: 'epic', boss: true, scale: 1.55, art: 'monA04',
    base: { hp: 1150, atk: 108, def: 78, spd: 100 },
    skills: [
      { id: 'root_lash', name: 'ฟาดราก', desc: 'ฟาด 1 ตัว ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.1, effects: [{ kind: 'mark', elem: 'earth', chance: 0.7 }], anim: 'melee' },
      { id: 'root_bind', name: 'รากรัด', desc: 'ทุกตัว 30% มึน', cd: 3, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.3 }], anim: 'volley' },
      { id: 'root_devour', name: 'ป่ากลืนกิน', desc: 'รากโผล่ใต้ทุกตัว ดูดชีวิต 30% ของดาเมจ', cd: 4, target: 'enemyAll', mult: 1.0, effects: [{ kind: 'drain', value: 0.3, to: 'self' }], anim: 'ult_roots', ult: true },
    ],
  },
};
export const STARTERS = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'];

export const STAGES: StageDef[] = [
  { id: '1-1', name: 'ทุ่งหญ้าไข่ป่วน', desc: 'มอนป่ารอบทุ่ง เหมาะกับการลองจัดทีม', stamina: 3,
    reward: { gold: 320, exp: 140 },
    waves: [
      [{ sid: 'A02', lvl: 3, stars: 1 }, { sid: 'A06', lvl: 3, stars: 1 }],
      [{ sid: 'A03', lvl: 3, stars: 1 }, { sid: 'A02', lvl: 4, stars: 1 }, { sid: 'A06', lvl: 3, stars: 1 }],
      [{ sid: 'A04', lvl: 4, stars: 1 }, { sid: 'A03', lvl: 4, stars: 1 }, { sid: 'A05', lvl: 4, stars: 1 }],
    ] },
  { id: '1-2', name: 'ลำธารเปียกปอน', desc: 'ศัตรูเปียกง่าย ลองใช้ลมให้เกิดพายุฟ้าคะนอง', stamina: 4,
    reward: { gold: 480, exp: 220 },
    waves: [
      [{ sid: 'A02', lvl: 5, stars: 1 }, { sid: 'A02', lvl: 5, stars: 1 }, { sid: 'A06', lvl: 5, stars: 1 }],
      [{ sid: 'A03', lvl: 5, stars: 1 }, { sid: 'A02', lvl: 6, stars: 1 }, { sid: 'A01', lvl: 5, stars: 1 }],
      [{ sid: 'A03', lvl: 6, stars: 1 }, { sid: 'A02', lvl: 6, stars: 2 }, { sid: 'A04', lvl: 6, stars: 1 }],
    ] },
  { id: '1-3', name: 'รังรากไม้', desc: 'บอสอสูรรากไม้ยักษ์ ระวังรากรัดทำให้มึน', stamina: 6,
    reward: { gold: 800, exp: 340 },
    waves: [
      [{ sid: 'A06', lvl: 8, stars: 1 }, { sid: 'A06', lvl: 8, stars: 1 }, { sid: 'A04', lvl: 8, stars: 1 }],
      [{ sid: 'A04', lvl: 8, stars: 1 }, { sid: 'A05', lvl: 8, stars: 1 }, { sid: 'A01', lvl: 8, stars: 1 }],
      [{ sid: 'A06', lvl: 8, stars: 1 }, { sid: 'BOSS_ROOT', lvl: 11, stars: 2, hpMult: 5, atkMult: 0.95 }, { sid: 'A06', lvl: 8, stars: 1 }],
    ] },
];

export function statAt(base: number, lvl: number, stars: number): number {
  return Math.round(base * (1 + 0.065 * (lvl - 1)) * (1 + 0.07 * (stars - 1)));
}
export function spdAt(base: number, lvl: number, stars: number): number {
  return base + (stars - 1) * 2 + Math.floor(lvl / 10);
}
export const expToNext = (lvl: number) => 40 + lvl * 25;
export const levelCap = (stars: number) => [0, 20, 30, 40, 50, 60][stars] || 20;

// ---- eggs (P1 M0) ----
// Mystery egg: species unknown until it hatches; only the shell pattern (tier) shows the rarity.
// stars = hatch star grade for a new monster, and stars added on a duplicate (overflow past ★5 → DUP_OVERFLOW_GOLD each).
// incubateMin > 0 → must sit in a hatchery slot that long (scaled by hatchery speed) before it can hatch.
export type EggTier = 'common' | 'silver' | 'gold' | 'rainbow';
export interface EggTierDef { name: string; stars: number; incubateMin: number; rareForm: number; rarityW: Partial<Record<Rarity, number>> }
export const EGG_TIER_ORDER: EggTier[] = ['common', 'silver', 'gold', 'rainbow'];
export const EGG_TIERS: Record<EggTier, EggTierDef> = {
  common: { name: 'ลายธรรมดา', stars: 1, incubateMin: 0, rareForm: 0.03, rarityW: { common: 100 } },
  silver: { name: 'ลายเงิน', stars: 1, incubateMin: 0, rareForm: 0.04, rarityW: { common: 75, rare: 25 } },
  gold: { name: 'ลายทอง', stars: 2, incubateMin: 120, rareForm: 0.05, rarityW: { common: 35, rare: 50, epic: 15 } },
  rainbow: { name: 'ลายรุ้ง', stars: 3, incubateMin: 480, rareForm: 0.08, rarityW: { rare: 40, epic: 45, legendary: 15 } },
};
/** stage drop: one roll per win (first clear always drops). pity = the Nth mystery egg in a row without gold+ is forced gold+ */
export const EGG_DROP = { chance: 0.3, bossChance: 0.6, tierW: { common: 68, silver: 24, gold: 7, rainbow: 1 } as Record<EggTier, number>, pity: 20 };
/** named egg (crafted from fragments): species known, small chance of the rare form (special colour/aura, +1 trait slot later) */
export const NAMED_RARE_FORM = 0.04;
export const DUP_OVERFLOW_GOLD = 500;
