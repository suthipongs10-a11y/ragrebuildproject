// P0 game data: 6 starters + realm boss + 3 stages of "ทุ่งไข่ป่วน".
// All numbers are starting values for playtest (see GAME_CONFIG_v2.json).
import type { SpeciesDef, StageDef, ZoneDef, EnemyRef, Elem, Rarity, SkillDef } from './types';
import { kitBonus } from './runes';

export const ELEM_NAME: Record<Elem, string> = { fire: 'ไฟ', water: 'น้ำ', wind: 'ลม', earth: 'ดิน', light: 'แสง', dark: 'มืด' };
export const ROLE_NAME: Record<string, string> = { Attacker: 'จู่โจม', Defender: 'ป้องกัน', Support: 'สนับสนุน', Healer: 'ฟื้นฟู', Controller: 'ควบคุม' };
export const RARITY_NAME: Record<string, string> = { common: 'ธรรมดา', rare: 'หายาก', epic: 'มหากาพย์', legendary: 'ตำนาน' };

export const SPECIES: Record<string, SpeciesDef> = {
  A01: {
    id: 'A01', name: 'จิ้งจอกเพลิงอรุณ', nameEn: 'Dawnflame Fox', elem: 'fire', role: 'Attacker', rarity: 'common', art: 'mon001',
    base: { hp: 820, atk: 118, def: 50, spd: 108 },
    leader: { stat: 'atk', value: 0.15, text: 'ATK ทั้งทีม +15%' },
    rarePassive: { kind: 'hitStatusAtb', status: 'burn', chance: 0.3, value: 25, name: 'หางเพลิงที่เก้า', desc: 'ตีโดนศัตรูที่ติดเผาไหม้ 30% ได้เกจเทิร์น +25' },
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
    rarePassive: { kind: 'healCleanse', chance: 0.6, name: 'เมือกชำระ', desc: 'ทุกครั้งที่ฮีล 60% ล้างสถานะร้าย 1 อย่างของพวกที่ถูกฮีล' },
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
    rarePassive: { kind: 'hitAtbDrain', value: 12, name: 'ปีกพายุ', desc: 'ทุกการโจมตีลดเกจเทิร์นศัตรูเพิ่มอีก 12' },
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
    rarePassive: { kind: 'guard', value: 0.18, name: 'ศิลามรกตหุ้ม', desc: 'HP เกินครึ่ง รับดาเมจน้อยลง 18%' },
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
    rarePassive: { kind: 'startAtb', value: 20, name: 'แสงอรุณแรก', desc: 'เริ่มการต่อสู้ พวกเดียวกันทุกตัวได้เกจเทิร์น +20' },
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
    rarePassive: { kind: 'debuffExtend', value: 1, name: 'สปอร์ยืดเยื้อ', desc: 'สถานะร้ายที่ใส่ศัตรูอยู่นานขึ้น 1 เทิร์น' },
    skills: [
      { id: 'shroom_spore', name: 'สปอร์พิษ', desc: 'ใส่ 1 ตัว 60% ติดพิษ 2 เทิร์น', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'status', status: 'poison', turns: 2, chance: 0.6 }], anim: 'shot' },
      { id: 'shroom_mist', name: 'หมอกเงา', desc: 'ทุกตัว 50% ตาบอด 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.45, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.5 }], anim: 'volley' },
      { id: 'shroom_night', name: 'ราตรีหลับใหล', desc: 'ทุกตัว ติดเครื่องหมายมืด 45% หลับ 1 เทิร์น', cd: 4, target: 'enemyAll', mult: 0.65, effects: [{ kind: 'mark', elem: 'dark', chance: 1 }, { kind: 'status', status: 'sleep', turns: 1, chance: 0.45 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  // ---- BATCH07 (art delivered 2026-10-12, 11 of 18) — numbers are playtest starting values: rare ≈ +8%, epic ≈ +16% over common ----
  A07: {
    id: 'A07', art: 'monA07', name: 'ไข่ป่วน', nameEn: 'Eggling', elem: 'light', role: 'Support', rarity: 'rare',
    base: { hp: 940, atk: 100, def: 66, spd: 112 },
    leader: { stat: 'hp', value: 0.18, text: 'HP ทั้งทีม +18%' },
    rarePassive: { kind: 'deathGift', value: 0.25, name: 'เปลือกสุดท้าย', desc: 'เมื่อล้ม พวกเดียวกันฮีล 25% และได้เกจเทิร์น +30' },
    skills: [
      { id: 'eggling_roll', name: 'กระแทกกลิ้ง', desc: 'กลิ้งชน 1 ตัว 50% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'light', chance: 0.5 }], anim: 'melee' },
      { id: 'eggling_crack', name: 'ร้าวนิดๆ', desc: 'โล่ทั้งทีม 15% ของ HP สูงสุด 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.15, turns: 2, to: 'allies' }], anim: 'shield' },
      { id: 'eggling_hatch', name: 'ฟักปุ๊บ!', desc: 'ลูกเจี๊ยบแสงรุมตีทุกตัว + เติมเกจทีม 20', cd: 4, target: 'enemyAll', mult: 0.85, effects: [{ kind: 'mark', elem: 'light', chance: 1 }, { kind: 'atb', value: 20, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  A08: {
    id: 'A08', art: 'monA08', name: 'วิญญาณโคมลอย', nameEn: 'Lantern Wisp', elem: 'fire', role: 'Support', rarity: 'rare',
    base: { hp: 900, atk: 108, def: 60, spd: 118 },
    leader: { stat: 'spd', value: 0.12, text: 'SPD ทั้งทีม +12%' },
    rarePassive: { kind: 'revive', value: 0.3, name: 'โคมนำวิญญาณ', desc: 'ครั้งเดียวต่อการต่อสู้ พวกตัวแรกที่ล้มฟื้นกลับมาด้วย HP 30%' },
    skills: [
      { id: 'wisp_ember', name: 'สะเก็ดโคม', desc: 'สะเก็ดไฟใส่ 1 ตัว 60% ติดเครื่องหมายไฟ', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'fire', chance: 0.6 }], anim: 'shot' },
      { id: 'wisp_guide', name: 'โคมนำทาง', desc: 'เพิ่ม SPD ทั้งทีม 2 เทิร์น + เกจ 15', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'spd_up', turns: 2, to: 'allies' }, { kind: 'atb', value: 15, to: 'allies' }], anim: 'buff' },
      { id: 'wisp_thousand', name: 'โคมพันดวง', desc: 'ฮีลทั้งทีม 22% + ฟื้นฟูต่อเนื่อง 2 เทิร์น', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.22, to: 'allies' }, { kind: 'status', status: 'regen', turns: 2, to: 'allies' }], anim: 'ult_rain', ult: true },
    ],
  },
  A09: {
    id: 'A09', art: 'monA09', name: 'อสูรรากไม้บรรพ์', nameEn: 'Elder Rootwalker', elem: 'earth', role: 'Defender', rarity: 'epic',
    base: { hp: 1300, atk: 98, def: 96, spd: 98 },
    leader: { stat: 'def', value: 0.25, text: 'DEF ทั้งทีม +25%' },
    rarePassive: { kind: 'thorns', value: 0.2, name: 'หนามรากบรรพ์', desc: 'สะท้อนดาเมจที่ได้รับ 20% กลับใส่ผู้โจมตี' },
    skills: [
      { id: 'elder_lash', name: 'ฟาดราก', desc: 'ฟาด 1 ตัว 70% ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'earth', chance: 0.7 }], anim: 'melee' },
      { id: 'elder_bind', name: 'รากรัด', desc: 'ทุกตัว 40% มึน 1 เทิร์น + ลด SPD', cd: 3, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.4 }, { kind: 'status', status: 'spd_down', turns: 2, chance: 0.6 }], anim: 'volley' },
      { id: 'elder_devour', name: 'ป่ากลืนกิน', desc: 'รากโผล่ใต้ทุกตัว ดูดชีวิต 35% ของดาเมจ', cd: 4, target: 'enemyAll', mult: 1.05, effects: [{ kind: 'drain', value: 0.35, to: 'self' }], anim: 'ult_roots', ult: true },
    ],
  },
  B01: {
    id: 'B01', art: 'monB01', name: 'ควายธนู', nameEn: 'Talisman Buffalo', elem: 'earth', role: 'Defender', rarity: 'common',
    base: { hp: 1120, atk: 90, def: 82, spd: 96 },
    leader: { stat: 'res', value: 0.15, text: 'ต้านทานสถานะ ทั้งทีม +15%' },
    rarePassive: { kind: 'endure', value: 0.2, name: 'ยันต์คงกระพัน', desc: 'ครั้งเดียวต่อการต่อสู้ รอดการโจมตีถึงตายด้วย HP 1 และได้โล่ 20%' },
    skills: [
      { id: 'buffalo_gore', name: 'ขวิด', desc: 'ขวิด 1 ตัว 60% ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'earth', chance: 0.6 }], anim: 'melee' },
      { id: 'buffalo_yant', name: 'ยันต์คุ้มกาย', desc: 'โล่ทั้งทีม 15% + ล้างสถานะ', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.15, turns: 2, to: 'allies' }, { kind: 'cleanse', to: 'allies' }], anim: 'shield' },
      { id: 'buffalo_charge', name: 'วิ่งชนสะท้าน', desc: 'พุ่งชนทุกตัว 35% มึน 1 เทิร์น', cd: 4, target: 'enemyAll', mult: 1.0, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.35 }], anim: 'ult_dash', ult: true },
    ],
  },
  B02: {
    id: 'B02', art: 'monB02', name: 'หุ่นพยนต์ฟาง', nameEn: 'Straw Effigy', elem: 'dark', role: 'Controller', rarity: 'common',
    base: { hp: 850, atk: 102, def: 54, spd: 108 },
    leader: { stat: 'res', value: 0.15, text: 'ต้านทานสถานะ ทั้งทีม +15%' },
    rarePassive: { kind: 'curseOnHit', status: 'atk_down', chance: 0.35, name: 'หุ่นต้องคำสาป', desc: 'ถูกโจมตี 35% ผู้โจมตีติด ATK ลด 2 เทิร์น' },
    skills: [
      { id: 'effigy_needle', name: 'เข็มพยนต์', desc: 'แทง 1 ตัว 50% ลด ATK 2 เทิร์น', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }], anim: 'shot' },
      { id: 'effigy_shadow', name: 'ผูกเงา', desc: 'ทุกตัว 60% ลด SPD 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.5, effects: [{ kind: 'status', status: 'spd_down', turns: 2, chance: 0.6 }], anim: 'volley' },
      { id: 'effigy_curse', name: 'คำสาปหุ่น', desc: 'ทุกตัว ติดเครื่องหมายมืด + ลด DEF 2 เทิร์น', cd: 4, target: 'enemyAll', mult: 0.75, effects: [{ kind: 'mark', elem: 'dark', chance: 1 }, { kind: 'status', status: 'def_down', turns: 2, chance: 0.7 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  B03: {
    id: 'B03', art: 'monB03', name: 'หัสดีลิงค์น้อย', nameEn: 'Hatsadiling Chick', elem: 'wind', role: 'Attacker', rarity: 'common',
    base: { hp: 830, atk: 116, def: 50, spd: 114 },
    leader: { stat: 'spd', value: 0.10, text: 'SPD ทั้งทีม +10%' },
    rarePassive: { kind: 'hitStatusAtb', status: 'spd_down', chance: 0.35, value: 20, name: 'ลมงวงหัสดี', desc: 'ตีโดนศัตรูที่ติด SPD ลด 35% ได้เกจเทิร์น +20' },
    skills: [
      { id: 'hatsa_trunk', name: 'ฟาดงวง', desc: 'ฟาด 1 ตัว 50% ติดเครื่องหมายลม', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'wind', chance: 0.5 }], anim: 'melee' },
      { id: 'hatsa_gust', name: 'กระพือปีกพายุ', desc: 'ลมแรงใส่ 1 ตัว 60% ลด SPD 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.5, effects: [{ kind: 'status', status: 'spd_down', turns: 2, chance: 0.6 }], anim: 'shot' },
      { id: 'hatsa_storm', name: 'พายุหัสดี', desc: 'คลื่นลมกวาดทุกตัว ติดเครื่องหมายลม + ลดเกจ 15', cd: 5, target: 'enemyAll', mult: 1.15, effects: [{ kind: 'mark', elem: 'wind', chance: 1 }, { kind: 'atb', value: -15 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  B04: {
    id: 'B04', art: 'monB04', name: 'พรายตะเคียน', nameEn: 'Takhian Dryad', elem: 'earth', role: 'Healer', rarity: 'common',
    base: { hp: 940, atk: 88, def: 62, spd: 103 },
    leader: { stat: 'hp', value: 0.15, text: 'HP ทั้งทีม +15%' },
    rarePassive: { kind: 'turnHeal', value: 0.07, name: 'รากหยั่งลึก', desc: 'ทุกเทิร์นของตัวเอง ฮีลพวกที่ HP ต่ำสุด 7%' },
    skills: [
      { id: 'dryad_leaf', name: 'ใบตะเคียน', desc: 'ใบไม้คมใส่ 1 ตัว 50% ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'mark', elem: 'earth', chance: 0.5 }], anim: 'shot' },
      { id: 'dryad_sap', name: 'ยางไม้ชุบ', desc: 'ฮีลทั้งทีม 12% + ฟื้นฟูต่อเนื่อง 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.12, to: 'allies' }, { kind: 'status', status: 'regen', turns: 2, to: 'allies' }], anim: 'heal' },
      { id: 'dryad_thread', name: 'สายสิญจน์ป่า', desc: 'ฮีลทั้งทีม 28% + ล้างสถานะ', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.28, to: 'allies' }, { kind: 'cleanse', to: 'allies' }], anim: 'ult_rain', ult: true },
    ],
  },
  B05: {
    id: 'B05', art: 'monB05', name: 'เสือสมิง', nameEn: 'Saming Tiger', elem: 'dark', role: 'Attacker', rarity: 'rare',
    base: { hp: 870, atk: 130, def: 52, spd: 114 },
    leader: { stat: 'atk', value: 0.18, text: 'ATK ทั้งทีม +18%' },
    rarePassive: { kind: 'killTurn', name: 'ร่างราตรี', desc: 'ล้มศัตรูได้ ได้เทิร์นเพิ่มทันที' },
    skills: [
      { id: 'saming_claw', name: 'ตะปบเงา', desc: 'ตะปบ 1 ตัว 40% ติดเครื่องหมายมืด', cd: 0, target: 'enemy', mult: 1.1, effects: [{ kind: 'mark', elem: 'dark', chance: 0.4 }], anim: 'melee' },
      { id: 'saming_hunt', name: 'ล่ายามค่ำ', desc: 'ขย้ำ 1 ตัวแรง 60% ตาบอด 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.6, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.6 }], anim: 'melee' },
      { id: 'saming_form', name: 'แปลงร่างสมิง', desc: 'พุ่งทะลุทุกตัว ดูดชีวิต 30% ของดาเมจ', cd: 5, target: 'enemyAll', mult: 1.3, effects: [{ kind: 'drain', value: 0.3, to: 'self' }], anim: 'ult_dash', ult: true },
    ],
  },
  B06: {
    id: 'B06', art: 'monB06', name: 'กินรี', nameEn: 'Kinnari', elem: 'wind', role: 'Healer', rarity: 'rare',
    base: { hp: 960, atk: 92, def: 64, spd: 113 },
    leader: { stat: 'hp', value: 0.18, text: 'HP ทั้งทีม +18%' },
    rarePassive: { kind: 'healCleanse', chance: 0.7, name: 'ระบำชำระใจ', desc: 'ทุกครั้งที่ฮีล 70% ล้างสถานะร้าย 1 อย่างของพวกที่ถูกฮีล' },
    skills: [
      { id: 'kinnari_feather', name: 'ขนปีกกรีดลม', desc: 'ขนปีกคมใส่ 1 ตัว 50% ติดเครื่องหมายลม', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'mark', elem: 'wind', chance: 0.5 }], anim: 'shot' },
      { id: 'kinnari_dance', name: 'ระบำกินรี', desc: 'ฮีลทั้งทีม 15% + เพิ่ม SPD 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.15, to: 'allies' }, { kind: 'status', status: 'spd_up', turns: 2, to: 'allies' }], anim: 'heal' },
      { id: 'kinnari_heaven', name: 'ฟ้อนสวรรค์', desc: 'ฮีลทั้งทีม 28% + ล้างสถานะ + เกจ 15', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.28, to: 'allies' }, { kind: 'cleanse', to: 'allies' }, { kind: 'atb', value: 15, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  B07: {
    id: 'B07', art: 'monB07', name: 'คชสีห์', nameEn: 'Gajasimha', elem: 'light', role: 'Defender', rarity: 'epic',
    base: { hp: 1260, atk: 104, def: 94, spd: 101 },
    leader: { stat: 'def', value: 0.22, text: 'DEF ทั้งทีม +22%' },
    rarePassive: { kind: 'counter', chance: 0.25, value: 0.7, name: 'งาสวนกลับ', desc: 'ถูกโจมตี 25% สวนกลับด้วยสกิล 1 (พลัง 70%)' },
    skills: [
      { id: 'gaja_tusk', name: 'ตะปบงา', desc: 'ตะปบ 1 ตัว 60% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'light', chance: 0.6 }], anim: 'melee' },
      { id: 'gaja_roar', name: 'คำรามคชสีห์', desc: 'ทุกตัว 50% ลด ATK 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.55, effects: [{ kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }], anim: 'volley' },
      { id: 'gaja_divine', name: 'งาเทวะ', desc: 'โล่ทั้งทีม 22% + เพิ่ม DEF 2 เทิร์น', cd: 4, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.22, turns: 2, to: 'allies' }, { kind: 'status', status: 'def_up', turns: 2, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  B08: {
    id: 'B08', art: 'monB08', name: 'ครุฑน้อย', nameEn: 'Garuda Fledgling', elem: 'wind', role: 'Attacker', rarity: 'epic',
    base: { hp: 960, atk: 140, def: 58, spd: 117 },
    leader: { stat: 'atk', value: 0.22, text: 'ATK ทั้งทีม +22%' },
    rarePassive: { kind: 'hitAtbDrain', value: 15, name: 'ปีกพญาครุฑ', desc: 'ทุกการโจมตีลดเกจเทิร์นศัตรูเพิ่มอีก 15' },
    skills: [
      { id: 'garuda_talon', name: 'กรงเล็บครุฑ', desc: 'ตะปบ 1 ตัว 60% ติดเครื่องหมายลม', cd: 0, target: 'enemy', mult: 1.15, effects: [{ kind: 'mark', elem: 'wind', chance: 0.6 }], anim: 'melee' },
      { id: 'garuda_dive', name: 'โฉบล่าเหยื่อ', desc: 'โฉบใส่ 1 ตัวแรง 60% ลด DEF 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.75, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.6 }], anim: 'melee' },
      { id: 'garuda_tempest', name: 'พายุปีกครุฑ', desc: 'พุ่งทะลุทุกตัว ติดเครื่องหมายลม + ลดเกจ 25', cd: 5, target: 'enemyAll', mult: 1.4, effects: [{ kind: 'mark', elem: 'wind', chance: 1 }, { kind: 'atb', value: -25 }], anim: 'ult_dash', ult: true },
    ],
  },
  B09: {
    id: 'B09', art: 'monB09', name: 'พญานาคมณี', nameEn: 'Mani Naga Lord', elem: 'water', role: 'Attacker', rarity: 'legendary',
    base: { hp: 1010, atk: 146, def: 62, spd: 112 },
    leader: { stat: 'atk', value: 0.25, text: 'ATK ทั้งทีม +25%' },
    rarePassive: { kind: 'killTurn', name: 'มณีนาคราช', desc: 'ล้มศัตรูได้ ได้เทิร์นต่อทันที' },
    skills: [
      { id: 'naga_fang', name: 'เขี้ยวนาค', desc: 'ฉก 1 ตัว 60% ติดเครื่องหมายน้ำ', cd: 0, target: 'enemy', mult: 1.15, effects: [{ kind: 'mark', elem: 'water', chance: 0.6 }], anim: 'melee' },
      { id: 'naga_tide', name: 'กระแสมณี', desc: 'ทุกตัว 50% ลด SPD 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.75, effects: [{ kind: 'status', status: 'spd_down', turns: 2, chance: 0.5 }], anim: 'volley' },
      { id: 'naga_deluge', name: 'อุทกภัยนาคราช', desc: 'ทุกตัว 60% ลด DEF 2 เทิร์น + ลดเกจ 20', cd: 5, target: 'enemyAll', mult: 1.45, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.6 }, { kind: 'atb', value: -20 }], anim: 'ult_rain', ult: true },
    ],
  },
  C06: {
    id: 'C06', art: 'monC06', name: 'ราชาอสูรวัว', nameEn: 'Bull Demon King', elem: 'fire', role: 'Defender', rarity: 'rare',
    base: { hp: 1210, atk: 97, def: 88, spd: 97 },
    leader: { stat: 'hp', value: 0.18, text: 'HP ทั้งทีม +18%' },
    rarePassive: { kind: 'thorns', value: 0.25, name: 'ไฟโทสะ', desc: 'ถูกโจมตี สะท้อนดาเมจ 25% (สะท้อนจนศัตรูตายไม่ได้)' },
    skills: [
      { id: 'bull_club', name: 'กระบองเพลิง', desc: 'ทุบ 1 ตัว 40% เผาไหม้ 2 เทิร์น', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'status', status: 'burn', turns: 2, chance: 0.4 }], anim: 'melee' },
      { id: 'bull_roar', name: 'คำรามราชาอสูร', desc: 'เพิ่ม DEF ทั้งทีม 2 เทิร์น + โล่ตัวเอง 20%', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'def_up', turns: 2, to: 'allies' }, { kind: 'shield', value: 0.2, turns: 2, to: 'self' }], anim: 'buff' },
      { id: 'bull_quake', name: 'ทุบภูผาเพลิง', desc: 'ทุกตัว 30% มึน 1 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.1, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.3 }], anim: 'ult_quake', ult: true },
    ],
  },
  C01: {
    id: 'C01', art: 'monC01', name: 'ปี่เซียะ', nameEn: 'Pixiu', elem: 'earth', role: 'Support', rarity: 'common',
    base: { hp: 960, atk: 94, def: 66, spd: 102 },
    leader: { stat: 'def', value: 0.15, text: 'DEF ทั้งทีม +15%' },
    rarePassive: { kind: 'startShield', value: 0.12, name: 'ปราการทองคำ', desc: 'เริ่มการต่อสู้ พวกเดียวกันทุกตัวได้โล่ 12% 2 เทิร์น' },
    skills: [
      { id: 'pixiu_bite', name: 'งับทอง', desc: 'งับ 1 ตัว 50% ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'earth', chance: 0.5 }], anim: 'melee' },
      { id: 'pixiu_hoard', name: 'กลืนสมบัติ', desc: 'เพิ่ม ATK ทั้งทีม 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'atk_up', turns: 2, to: 'allies' }], anim: 'buff' },
      { id: 'pixiu_rampart', name: 'ปราการทอง', desc: 'โล่ทั้งทีม 20% + ศัตรูทุกตัวติดเครื่องหมายดิน', cd: 4, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.2, turns: 2, to: 'allies' }, { kind: 'mark', elem: 'earth', chance: 1, to: 'enemies' }], anim: 'ult_quake', ult: true },
    ],
  },
  C02: {
    id: 'C02', art: 'monC02', name: 'คางคกสามขา', nameEn: 'Jinchan Toad', elem: 'water', role: 'Support', rarity: 'common',
    base: { hp: 900, atk: 96, def: 60, spd: 104 },
    leader: { stat: 'crit', value: 0.10, text: 'อัตราคริ ทั้งทีม +10%' },
    rarePassive: { kind: 'critDebuff', status: 'def_down', name: 'ปากทอง', desc: 'ตีคริติคอลแล้วศัตรูติด DEF ลด 2 เทิร์น' },
    skills: [
      { id: 'toad_tongue', name: 'ลิ้นตวัด', desc: 'ตวัด 1 ตัว 60% ติดเครื่องหมายเปียก', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'water', chance: 0.6 }], anim: 'shot' },
      { id: 'toad_coins', name: 'พ่นเหรียญ', desc: 'ทุกตัว 60% ลด DEF 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.5, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.6 }], anim: 'volley' },
      { id: 'toad_fortune', name: 'โชคลาภ', desc: 'คริขึ้นทั้งทีม 2 เทิร์น + เกจ 20 + ศัตรูเปียก', cd: 4, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'crit_up', turns: 2, to: 'allies' }, { kind: 'atb', value: 20, to: 'allies' }, { kind: 'mark', elem: 'water', chance: 1, to: 'enemies' }], anim: 'ult_rain', ult: true },
    ],
  },
  C03: {
    id: 'C03', art: 'monC03', name: 'สิงโตผู้พิทักษ์', nameEn: 'Guardian Lion', elem: 'fire', role: 'Defender', rarity: 'common',
    base: { hp: 1080, atk: 88, def: 82, spd: 98 },
    leader: { stat: 'def', value: 0.15, text: 'DEF ทั้งทีม +15%' },
    rarePassive: { kind: 'counter', chance: 0.25, value: 0.7, name: 'สิงห์เฝ้าประตู', desc: 'ถูกโจมตี 25% สวนกลับด้วยสกิล 1 (พลัง 70%)' },
    skills: [
      { id: 'lion_bite', name: 'งับเพลิง', desc: 'งับ 1 ตัว 50% ติดเครื่องหมายไฟ', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'fire', chance: 0.5 }], anim: 'melee' },
      { id: 'lion_ball', name: 'ลูกแก้วพิทักษ์', desc: 'โล่ทั้งทีม 15% ของ HP สูงสุด 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.15, turns: 2, to: 'allies' }], anim: 'shield' },
      { id: 'lion_roar', name: 'คำรามสิงห์เพลิง', desc: 'ทุกตัว 60% ลด ATK 2 เทิร์น + เพิ่ม DEF ทั้งทีม', cd: 4, target: 'enemyAll', mult: 0.8, effects: [{ kind: 'status', status: 'atk_down', turns: 2, chance: 0.6 }, { kind: 'status', status: 'def_up', turns: 2, to: 'allies' }], anim: 'ult_quake', ult: true },
    ],
  },
  C04: {
    id: 'C04', art: 'monC04', name: 'กระต่ายหยก', nameEn: 'Jade Rabbit', elem: 'light', role: 'Healer', rarity: 'common',
    base: { hp: 900, atk: 90, def: 60, spd: 109 },
    leader: { stat: 'hp', value: 0.15, text: 'HP ทั้งทีม +15%' },
    rarePassive: { kind: 'overheal', value: 0.15, name: 'จันทร์ค้ำชีวิต', desc: 'ฮีลเกิน HP สูงสุดกลายเป็นโล่ (สูงสุด 15%)' },
    skills: [
      { id: 'rabbit_pestle', name: 'ตำยา', desc: 'ตำ 1 ตัว 40% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'mark', elem: 'light', chance: 0.4 }], anim: 'melee' },
      { id: 'rabbit_elixir', name: 'ยาอมฤต', desc: 'ฮีลทั้งทีม 18%', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.18, to: 'allies' }], anim: 'heal' },
      { id: 'rabbit_moon', name: 'จันทร์เพ็ญ', desc: 'ฮีลทั้งทีม 25% + ฟื้นฟูต่อเนื่อง 2 เทิร์น', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.25, to: 'allies' }, { kind: 'status', status: 'regen', turns: 2, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  C05: {
    id: 'C05', art: 'monC05', name: 'จิ้งจอกเก้าหาง', nameEn: 'Nine-tail Fox', elem: 'fire', role: 'Controller', rarity: 'rare',
    base: { hp: 880, atk: 110, def: 56, spd: 116 },
    leader: { stat: 'res', value: 0.18, text: 'ต้านทานสถานะ ทั้งทีม +18%' },
    rarePassive: { kind: 'curseOnHit', status: 'blind', chance: 0.3, name: 'ภาพลวงจิ้งจอก', desc: 'ถูกโจมตี 30% ผู้โจมตีติดตาบอด 2 เทิร์น' },
    skills: [
      { id: 'kitsune_flame', name: 'ไฟจิ้งจอก', desc: 'ไฟผีใส่ 1 ตัว 40% เผาไหม้ 2 เทิร์น', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'status', status: 'burn', turns: 2, chance: 0.4 }], anim: 'shot' },
      { id: 'kitsune_charm', name: 'เสน่ห์เก้าหาง', desc: 'ใส่ 1 ตัว 60% หลับ 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.2, effects: [{ kind: 'status', status: 'sleep', turns: 2, chance: 0.6 }], anim: 'shot' },
      { id: 'kitsune_ninefire', name: 'เพลิงเก้าหาง', desc: 'คลื่นไฟใส่ทุกตัว ติดเครื่องหมายไฟ 60% เผาไหม้ 2 เทิร์น', cd: 4, target: 'enemyAll', mult: 0.9, effects: [{ kind: 'mark', elem: 'fire', chance: 1 }, { kind: 'status', status: 'burn', turns: 2, chance: 0.6 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  // ---- BATCH21 (2026-10-14): new 1–3★ monsters, each with one signature mechanic from docs/SKILL_CATALOG_TH.md.
  // Art ships as separate files (assets_ext/, loaded on demand) — the single-file build is near its 16MB limit. ----
  E01: {
    id: 'E01', art: 'monE01', name: 'กริฟฟินน้อย', nameEn: 'Griffin Cub', elem: 'wind', role: 'Attacker', rarity: 'rare',
    base: { hp: 880, atk: 122, def: 54, spd: 118 },
    leader: { stat: 'spd', value: 0.12, text: 'SPD ทั้งทีม +12%' },
    rarePassive: { kind: 'killTurn', name: 'สายเลือดนักล่าฟ้า', desc: 'ล้มศัตรูได้ ได้เทิร์นต่อทันที' },
    skills: [
      { id: 'griffin_talon', name: 'กรงเล็บกริฟฟิน', desc: 'ตะปบ 1 ตัว 50% ติดเครื่องหมายลม', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'wind', chance: 0.5 }], anim: 'melee' },
      { id: 'griffin_dive', name: 'โฉบเหินลม', desc: 'โฉบใส่ 1 ตัว ยิ่ง SPD สูงยิ่งแรง + เกจเทิร์นตัวเอง +20', cd: 3, target: 'enemy', mult: 1.35, scale: 'spd', effects: [{ kind: 'atb', value: 20, to: 'self' }], anim: 'melee' },
      { id: 'griffin_tempest', name: 'พายุปีกกริฟฟิน', desc: 'โฉบทุกตัว ยิ่ง SPD สูงยิ่งแรง 70% ติดเครื่องหมายลม + SPD ทั้งทีมขึ้น 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.05, scale: 'spd', effects: [{ kind: 'mark', elem: 'wind', chance: 0.7 }, { kind: 'status', status: 'spd_up', turns: 2, to: 'allies' }], anim: 'ult_dash', ult: true },
    ],
  },
  E10: {
    id: 'E10', art: 'monE10', name: 'นักรบกระดูกเขี้ยวมังกร', nameEn: 'Dragontooth Skeleton', elem: 'dark', role: 'Attacker', rarity: 'common',
    base: { hp: 840, atk: 120, def: 54, spd: 106 },
    leader: { stat: 'atk', value: 0.15, text: 'ATK ทั้งทีม +15%' },
    rarePassive: { kind: 'endure', value: 0.15, name: 'กระดูกไม่ยอมล้ม', desc: 'ครั้งเดียวต่อการต่อสู้ รอดการโจมตีถึงตายด้วย HP 1 และได้โล่ 15%' },
    skills: [
      { id: 'spartoi_slash', name: 'ฟันดาบกระดูก', desc: 'ฟัน 1 ตัว 50% ติดเครื่องหมายมืด', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'dark', chance: 0.5 }], anim: 'melee' },
      { id: 'spartoi_reap', name: 'ดาบปลิดชีพ', desc: 'ฟัน 1 ตัวแรง เป้าหมาย HP ต่ำกว่าครึ่ง ดาเมจ +60%', cd: 3, target: 'enemy', mult: 1.45, execute: 0.6, effects: [], anim: 'melee' },
      { id: 'spartoi_legion', name: 'กองทัพเขี้ยวมังกร', desc: 'หมุนฟันทุกตัว ตัวที่ HP ต่ำกว่าครึ่ง +40% · 50% ลด DEF 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.1, execute: 0.4, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.5 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  F01: {
    id: 'F01', art: 'monF01', name: 'ปูเกราะปะการัง', nameEn: 'Coral Crab', elem: 'water', role: 'Defender', rarity: 'common',
    base: { hp: 1090, atk: 84, def: 86, spd: 96 },
    leader: { stat: 'def', value: 0.15, text: 'DEF ทั้งทีม +15%' },
    passive: { kind: 'counter', chance: 0.25, value: 0.75, name: 'ก้ามสวนกลับ', desc: 'ถูกโจมตี 25% สวนกลับด้วยสกิล 1 (พลัง 75%)' },
    rarePassive: { kind: 'thorns', value: 0.12, name: 'หนามปะการัง', desc: 'สะท้อนดาเมจที่ได้รับ 12% กลับใส่ผู้โจมตี' },
    skills: [
      { id: 'crab_snap', name: 'ก้ามหนีบ', desc: 'หนีบ 1 ตัว 60% ติดเครื่องหมายเปียก', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'water', chance: 0.6 }], anim: 'melee' },
      { id: 'crab_slam', name: 'กระแทกกระดองปะการัง', desc: 'กระแทก 1 ตัว ยิ่ง DEF สูงยิ่งแรง + DEF ตัวเองขึ้น 2 เทิร์น', cd: 3, target: 'enemy', mult: 0.9, scale: 'def', effects: [{ kind: 'status', status: 'def_up', turns: 2, to: 'self' }], anim: 'melee' },
      { id: 'crab_reef', name: 'ปราการแนวปะการัง', desc: 'ซัดทุกตัว ยิ่ง DEF สูงยิ่งแรง 70% ติดเครื่องหมายเปียก + โล่ทั้งทีม 15% 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 0.6, scale: 'def', effects: [{ kind: 'mark', elem: 'water', chance: 0.7 }, { kind: 'shield', value: 0.15, turns: 2, to: 'allies' }], anim: 'ult_quake', ult: true },
    ],
  },
  G01: {
    id: 'G01', art: 'monG01', name: 'แมวบาสเต็ตน้อย', nameEn: 'Bastet Kitten', elem: 'light', role: 'Attacker', rarity: 'common',
    base: { hp: 810, atk: 120, def: 50, spd: 112 },
    leader: { stat: 'crit', value: 0.1, text: 'คริติคอลทั้งทีม +10%' },
    passive: { kind: 'critTurn', chance: 0.5, name: 'จังหวะทองแมวเทพ', desc: 'ตีคริติคอลแล้ว 50% ได้เทิร์นต่อทันที' },
    rarePassive: { kind: 'critDebuff', status: 'def_down', name: 'คมเล็บราตรี', desc: 'ตีคริติคอลแล้วศัตรูติด DEF ลด 2 เทิร์น' },
    skills: [
      { id: 'bastet_claw', name: 'ข่วนแมวทอง', desc: 'ข่วน 1 ตัว 40% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 1.0, effects: [{ kind: 'mark', elem: 'light', chance: 0.4 }], anim: 'melee' },
      { id: 'bastet_pounce', name: 'ตะครุบจันทร์ทอง', desc: 'ตะครุบ 1 ตัวแรง + คริติคอลตัวเอง +20% 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.55, effects: [{ kind: 'status', status: 'crit_up', turns: 2, to: 'self' }], anim: 'melee' },
      { id: 'bastet_whirl', name: 'อุ้งเท้าเทพีหมุนวน', desc: 'หมุนตะปบทุกตัว + คริติคอลทั้งทีม +20% 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.2, effects: [{ kind: 'status', status: 'crit_up', turns: 2, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  H01: {
    id: 'H01', art: 'monH01', name: 'คัปปะ', nameEn: 'Kappa', elem: 'water', role: 'Attacker', rarity: 'common',
    base: { hp: 870, atk: 114, def: 56, spd: 105 },
    leader: { stat: 'hp', value: 0.15, text: 'HP ทั้งทีม +15%' },
    passive: { kind: 'bash', chance: 0.15, name: 'ฝ่ามือซูโม่', desc: 'ตีโดน 15% ทำให้มึน 1 เทิร์น' },
    rarePassive: { kind: 'hitStatusAtb', status: 'stun', chance: 0.5, value: 25, name: 'จานน้ำบนหัว', desc: 'ตีโดนศัตรูที่มึนอยู่ 50% ได้เกจเทิร์น +25' },
    skills: [
      { id: 'kappa_palm', name: 'ฝ่ามือคัปปะ', desc: 'ผลักฝ่ามือ 1 ตัว 50% ติดเครื่องหมายเปียก', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'water', chance: 0.5 }], anim: 'melee' },
      { id: 'kappa_stomp', name: 'กระทืบซูโม่', desc: 'กระทืบพื้นใส่ทุกตัว ลดเกจ 15 · 50% ติดเครื่องหมายเปียก', cd: 3, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'atb', value: -15 }, { kind: 'mark', elem: 'water', chance: 0.5 }], anim: 'volley' },
      { id: 'kappa_shell', name: 'กระดองถล่มธารา', desc: 'กระโดดกระแทก 1 ตัวแรงมาก 60% ลด DEF 2 เทิร์น', cd: 5, target: 'enemy', mult: 2.2, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.6 }], anim: 'ult_vortex', ult: true },
    ],
  },
  H04: {
    id: 'H04', art: 'monH04', name: 'บาคุ', nameEn: 'Baku', elem: 'dark', role: 'Healer', rarity: 'common',
    base: { hp: 940, atk: 86, def: 62, spd: 104 },
    leader: { stat: 'res', value: 0.15, text: 'ต้านทานทั้งทีม +15%' },
    rarePassive: { kind: 'turnHeal', value: 0.06, name: 'ฝันดีทุกคืน', desc: 'ทุกเทิร์นของตัวเอง ฮีลพวกที่ HP ต่ำสุด 6%' },
    skills: [
      { id: 'baku_trunk', name: 'ฟาดงวง', desc: 'ฟาดงวง 1 ตัว 50% ติดเครื่องหมายมืด', cd: 0, target: 'enemy', mult: 0.95, effects: [{ kind: 'mark', elem: 'dark', chance: 0.5 }], anim: 'melee' },
      { id: 'baku_dreameat', name: 'กินฝันร้าย', desc: 'ฮีลทั้งทีม 15% + กินสถานะร้ายทุกอย่าง ฮีลเพิ่ม 8% ต่ออย่างที่กิน', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.15, to: 'allies' }, { kind: 'dreamEat', value: 0.08, to: 'allies' }], anim: 'heal' },
      { id: 'baku_moon', name: 'นิทราจันทร์เพ็ญ', desc: 'ฮีลทั้งทีม 26% + ศัตรูทุกตัว 40% หลับ 1 เทิร์น', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.26, to: 'allies' }, { kind: 'status', status: 'sleep', turns: 1, chance: 0.4, to: 'enemies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  BOSS_NAGA: {
    id: 'BOSS_NAGA', name: 'พญานาคราชสระมณี', nameEn: 'Naga King of the Jewel Pool', elem: 'water', role: 'Attacker', rarity: 'legendary', boss: true, scale: 1.35, art: 'monB09',
    base: { hp: 1150, atk: 116, def: 78, spd: 104 },
    skills: [
      { id: 'nagab_fang', name: 'เขี้ยวนาคราช', desc: 'ฉก 1 ตัว ติดเครื่องหมายเปียก 70%', cd: 0, target: 'enemy', mult: 1.15, effects: [{ kind: 'mark', elem: 'water', chance: 0.7 }], anim: 'melee' },
      { id: 'nagab_coil', name: 'รัดเกลียวมณี', desc: 'ทุกตัว 60% ลด SPD 2 เทิร์น + ลดเกจ 15', cd: 3, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'spd_down', turns: 2, chance: 0.6 }, { kind: 'atb', value: -15 }], anim: 'volley' },
      { id: 'nagab_flood', name: 'อุทกภัยนาคราช', desc: 'คลื่นยักษ์ทุกตัว ติดเปียก + 50% ลด DEF 2 เทิร์น', cd: 4, target: 'enemyAll', mult: 1.05, effects: [{ kind: 'mark', elem: 'water', chance: 1 }, { kind: 'status', status: 'def_down', turns: 2, chance: 0.5 }], anim: 'ult_rain', ult: true },
    ],
  },
  BOSS_BULL: {
    id: 'BOSS_BULL', name: 'ราชาอสูรวัวเพลิงนรก', nameEn: 'Infernal Bull Demon King', elem: 'fire', role: 'Attacker', rarity: 'legendary', boss: true, scale: 1.35, art: 'monC06',
    base: { hp: 1250, atk: 114, def: 88, spd: 98 },
    skills: [
      { id: 'bullb_club', name: 'กระบองเพลิงนรก', desc: 'ทุบ 1 ตัว 50% เผาไหม้ 2 เทิร์น', cd: 0, target: 'enemy', mult: 1.2, effects: [{ kind: 'status', status: 'burn', turns: 2, chance: 0.5 }], anim: 'melee' },
      { id: 'bullb_roar', name: 'คำรามสะท้านภพ', desc: 'ทุกตัว 50% ลด ATK 2 เทิร์น + โล่ตัวเอง 15%', cd: 3, target: 'enemyAll', mult: 0.55, effects: [{ kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }, { kind: 'shield', value: 0.15, turns: 2, to: 'self' }], anim: 'volley' },
      { id: 'bullb_quake', name: 'ทุบภูผาเพลิงนรก', desc: 'ทุกตัว 25% มึน + 50% เผาไหม้ 2 เทิร์น', cd: 4, target: 'enemyAll', mult: 1.1, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.25 }, { kind: 'status', status: 'burn', turns: 2, chance: 0.5 }], anim: 'ult_quake', ult: true },
    ],
  },
  BOSS_ROOT: {
    id: 'BOSS_ROOT', name: 'อสูรรากไม้ยักษ์', nameEn: 'Giant Rootwalker', elem: 'earth', role: 'Defender', rarity: 'epic', boss: true, scale: 1.3, art: 'monA09',
    base: { hp: 1150, atk: 108, def: 78, spd: 100 },
    skills: [
      { id: 'root_lash', name: 'ฟาดราก', desc: 'ฟาด 1 ตัว ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.1, effects: [{ kind: 'mark', elem: 'earth', chance: 0.7 }], anim: 'melee' },
      { id: 'root_bind', name: 'รากรัด', desc: 'ทุกตัว 30% มึน', cd: 3, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.3 }], anim: 'volley' },
      { id: 'root_devour', name: 'ป่ากลืนกิน', desc: 'รากโผล่ใต้ทุกตัว ดูดชีวิต 30% ของดาเมจ', cd: 4, target: 'enemyAll', mult: 1.0, effects: [{ kind: 'drain', value: 0.3, to: 'self' }], anim: 'ult_roots', ult: true },
    ],
  },
  // ---- Starborn Legends (ตำนานดารา, BATCH10): legendary power, signature kits; zone bosses on the world map — their
  // shards (rare boss drop) build their egg. Art ships as separate files (assets_ext/, loaded on demand). ----
  S01: {
    id: 'S01', art: 'monS01', name: 'วาลคีร์ปีกพายุ', nameEn: 'Valkyr Stormwing', elem: 'light', role: 'Healer', rarity: 'legendary', starborn: true,
    base: { hp: 1060, atk: 112, def: 70, spd: 115 },
    passive: { kind: 'allyEndure', name: 'ปีกพิทักษ์วัลฮัลลา', desc: 'ครั้งเดียวต่อการต่อสู้ เพื่อนตัวแรกที่จะล้ม รอดด้วย HP 1' },
    leader: { stat: 'hp', value: 0.22, text: 'HP ทั้งทีม +22%' },
    skills: [
      { id: 'valk_spear', name: 'หอกดาวพายุ', desc: 'แทง 1 ตัว 60% ติดเครื่องหมายแสง + เกจตัวเอง 10', cd: 0, target: 'enemy', mult: 1.1, effects: [{ kind: 'mark', elem: 'light', chance: 0.6 }, { kind: 'atb', value: 10, to: 'self' }], anim: 'melee' },
      { id: 'valk_hymn', name: 'บทเพลงปีกสวรรค์', desc: 'ฮีลทั้งทีม 22% + ล้างสถานะทั้งทีม', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.22, to: 'allies' }, { kind: 'cleanse', to: 'allies' }], anim: 'heal' },
      { id: 'valk_valhalla', name: 'วัลฮัลลาเรียกวิญญาณ', desc: 'ชุบชีวิตเพื่อน 1 ตัว 40% + ทีมอมตะ 1 เทิร์น', cd: 6, target: 'allyAll', mult: 0, effects: [{ kind: 'revive', value: 0.4, n: 1, to: 'allies' }, { kind: 'status', status: 'invincible', turns: 1, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  S02: {
    id: 'S02', art: 'monS02', name: 'คิเมร่าราชันย์', nameEn: 'Chimera Rex', elem: 'fire', role: 'Attacker', rarity: 'legendary', starborn: true,
    base: { hp: 980, atk: 150, def: 60, spd: 114 },
    passive: { kind: 'leech', value: 0.2, name: 'กลืนชีพราชันย์', desc: 'ฮีลตัวเอง 20% ของดาเมจที่ทำ' },
    leader: { stat: 'atk', value: 0.25, text: 'ATK ทั้งทีม +25%' },
    skills: [
      { id: 'chim_claw', name: 'กรงเล็บราชันย์', desc: 'ตะปบ 1 ตัว 40% เผาไหม้ 2 เทิร์น', cd: 0, target: 'enemy', mult: 1.25, effects: [{ kind: 'status', status: 'burn', turns: 2, chance: 0.4 }], anim: 'melee' },
      { id: 'chim_breath', name: 'ลมหายใจไฟดารา', desc: 'ทุกตัว 70% ติดเครื่องหมายไฟ + 40% ลด DEF 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.85, effects: [{ kind: 'mark', elem: 'fire', chance: 0.7 }, { kind: 'status', status: 'def_down', turns: 2, chance: 0.4 }], anim: 'volley' },
      { id: 'chim_rex', name: 'ราชันย์อสูรดารา', desc: 'ขย้ำ 1 ตัวแรงมาก ไม่สนใจ DEF 30% + 35% มึน 1 เทิร์น', cd: 5, target: 'enemy', mult: 2.8, ignoreDef: 0.3, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.35 }], anim: 'ult_dash', ult: true },
    ],
  },
  S03: {
    id: 'S03', art: 'monS03', name: 'พญานาคปัญจเศียร', nameEn: 'Panchanaga', elem: 'water', role: 'Defender', rarity: 'legendary', starborn: true,
    base: { hp: 1320, atk: 102, def: 96, spd: 104 },
    passive: { kind: 'counter', chance: 0.3, value: 0.8, name: 'ห้าเศียรสวนกลับ', desc: 'ถูกโจมตี 30% สวนกลับด้วยสกิล 1 (พลัง 80%)' },
    leader: { stat: 'def', value: 0.25, text: 'DEF ทั้งทีม +25%' },
    skills: [
      { id: 'panch_bite', name: 'ห้าเศียรฉก', desc: 'ฉก 1 ตัว 70% ติดเครื่องหมายน้ำ', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'water', chance: 0.7 }], anim: 'melee' },
      { id: 'panch_hood', name: 'พังพานห้าเศียร', desc: 'โล่ทั้งทีม 20% + DEF ทั้งทีมขึ้น 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.2, to: 'allies' }, { kind: 'status', status: 'def_up', turns: 2, to: 'allies' }], anim: 'shield' },
      { id: 'panch_flood', name: 'มหาอุทกภัยปัญจนาค', desc: 'ทุกตัว ติดเปียก + 60% ลด SPD 2 เทิร์น + ลดเกจ 20', cd: 5, target: 'enemyAll', mult: 1.2, effects: [{ kind: 'mark', elem: 'water', chance: 1 }, { kind: 'status', status: 'spd_down', turns: 2, chance: 0.6 }, { kind: 'atb', value: -20 }], anim: 'ult_rain', ult: true },
    ],
  },
  S04: {
    id: 'S04', art: 'monS04', name: 'โอโรจิแปดหุบเขา', nameEn: 'Yamata Orochi', elem: 'dark', role: 'Controller', rarity: 'legendary', starborn: true,
    base: { hp: 1040, atk: 128, def: 66, spd: 110 },
    passive: { kind: 'hitStatus', status: 'confuse', chance: 0.2, name: 'สาเกแปดหุบเขา', desc: 'ตีโดน 20% ศัตรูสับสน 1 เทิร์น (ตีพวกเดียวกัน)' },
    leader: { stat: 'res', value: 0.25, text: 'ต้านทานทั้งทีม +25%' },
    skills: [
      { id: 'oro_fangs', name: 'แปดเขี้ยวพิษ', desc: 'กัด 1 ตัว 50% พิษ 2 เทิร์น + 50% ติดเครื่องหมายมืด', cd: 0, target: 'enemy', mult: 1.1, effects: [{ kind: 'status', status: 'poison', turns: 2, chance: 0.5 }, { kind: 'mark', elem: 'dark', chance: 0.5 }], anim: 'melee' },
      { id: 'oro_sake', name: 'สุราแปดไห', desc: 'ทุกตัว 35% หลับ 1 เทิร์น + 50% ลด ATK 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.5, effects: [{ kind: 'status', status: 'sleep', turns: 1, chance: 0.35 }, { kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }], anim: 'volley' },
      { id: 'oro_valleys', name: 'แปดหุบเขาพิโรธ', desc: 'ทุกตัว ลบบัฟ 1 อย่าง + 45% ผนึกสกิล 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.3, effects: [{ kind: 'strip', n: 1 }, { kind: 'status', status: 'silence', turns: 2, chance: 0.45 }], anim: 'ult_nightwave', ult: true },
    ],
  },
  // S05–S07 (owner 2026-10-14): zone bosses of the jade garden, the Pixiu palace and the Asura King's fire cave
  S05: {
    id: 'S05', art: 'monS05', name: 'กิเลนอสนีบาต', nameEn: 'Thunder Qilin', elem: 'wind', role: 'Support', rarity: 'legendary', starborn: true,
    base: { hp: 1010, atk: 116, def: 72, spd: 121 },
    passive: { kind: 'aura', stat: 'spd', value: 0.1, name: 'ฝีเท้าอสนี', desc: 'ยืนอยู่ในสนาม ทีม SPD +10%' },
    leader: { stat: 'spd', value: 0.15, text: 'SPD ทั้งทีม +15%' },
    skills: [
      { id: 'qilin_horn', name: 'เขาอสนี', desc: 'ขวิด 1 ตัว 60% ติดเครื่องหมายลม + ลดเกจ 10', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'wind', chance: 0.6 }, { kind: 'atb', value: -10 }], anim: 'melee' },
      { id: 'qilin_bless', name: 'พรกิเลนมงคล', desc: 'ทีม ATK และ SPD ขึ้น 2 เทิร์น + เกจทีม 15', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'atk_up', turns: 2, to: 'allies' }, { kind: 'status', status: 'spd_up', turns: 2, to: 'allies' }, { kind: 'atb', value: 15, to: 'allies' }], anim: 'heal' },
      { id: 'qilin_storm', name: 'พายุอสนีมงคล', desc: 'ฟ้าผ่าทุกตัว 70% ติดเครื่องหมายลม + ลดเกจ 25 + คูลดาวน์ทีม −1', cd: 5, target: 'enemyAll', mult: 1.15, effects: [{ kind: 'mark', elem: 'wind', chance: 0.7 }, { kind: 'atb', value: -25 }, { kind: 'cdTeam', value: 1, to: 'allies' }], anim: 'ult_starlight', ult: true },
    ],
  },
  S06: {
    id: 'S06', art: 'monS06', name: 'มังกรทองหวงหลง', nameEn: 'Huanglong Gold Dragon', elem: 'earth', role: 'Attacker', rarity: 'legendary', starborn: true,
    base: { hp: 1000, atk: 148, def: 66, spd: 110 },
    passive: { kind: 'aura', stat: 'def', value: 0.12, name: 'เกล็ดมังกรทอง', desc: 'ยืนอยู่ในสนาม ทีม DEF +12%' },
    leader: { stat: 'atk', value: 0.22, text: 'ATK ทั้งทีม +22%' },
    skills: [
      { id: 'huang_claw', name: 'กรงเล็บมังกรทอง', desc: 'ตะปบ 1 ตัว 60% ติดเครื่องหมายดิน', cd: 0, target: 'enemy', mult: 1.2, effects: [{ kind: 'mark', elem: 'earth', chance: 0.6 }], anim: 'melee' },
      { id: 'huang_pearl', name: 'มุกมังกรบดขยี้', desc: 'ฟาด 1 ตัวแรง ไม่สนใจ DEF 25% + 50% ลด DEF 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.9, ignoreDef: 0.25, effects: [{ kind: 'status', status: 'def_down', turns: 2, chance: 0.5 }], anim: 'melee' },
      { id: 'huang_quake', name: 'มังกรทองพลิกปฐพี', desc: 'ทุกตัว 70% ติดเครื่องหมายดิน + 30% มึน 1 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.5, effects: [{ kind: 'mark', elem: 'earth', chance: 0.7 }, { kind: 'status', status: 'stun', turns: 1, chance: 0.3 }], anim: 'ult_quake', ult: true },
    ],
  },
  S07: {
    id: 'S07', art: 'monS07', name: 'อสูรราชาตรีมุข', nameEn: 'Trimukha Asura King', elem: 'fire', role: 'Defender', rarity: 'legendary', starborn: true,
    base: { hp: 1340, atk: 106, def: 94, spd: 102 },
    passive: { kind: 'thorns', value: 0.18, name: 'เกราะเพลิงอสูร', desc: 'สะท้อนดาเมจที่ได้รับ 18% กลับใส่ผู้โจมตี' },
    leader: { stat: 'hp', value: 0.22, text: 'HP ทั้งทีม +22%' },
    skills: [
      { id: 'asura_strike', name: 'หกกรประหาร', desc: 'ตี 1 ตัว 50% ติดเครื่องหมายไฟ + 40% เผาไหม้ 2 เทิร์น', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'fire', chance: 0.5 }, { kind: 'status', status: 'burn', turns: 2, chance: 0.4 }], anim: 'melee' },
      { id: 'asura_guard', name: 'ตรีมุขพิทักษ์', desc: 'โล่ทั้งทีม 18% + DEF ทั้งทีมขึ้น 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.18, to: 'allies' }, { kind: 'status', status: 'def_up', turns: 2, to: 'allies' }], anim: 'shield' },
      { id: 'asura_wheel', name: 'จักรหกอาวุธ', desc: 'ทุกตัว 60% ติดเครื่องหมายไฟ + 40% ลด ATK 2 เทิร์น + โล่ทั้งทีม 12%', cd: 5, target: 'enemyAll', mult: 1.3, effects: [{ kind: 'mark', elem: 'fire', chance: 0.6 }, { kind: 'status', status: 'atk_down', turns: 2, chance: 0.4 }, { kind: 'shield', value: 0.12, to: 'allies' }], anim: 'ult_nightwave', ult: true },
    ],
  },
  // ---- special editions (ตัวพิเศษ, owner 2026-10-14): a few standout monsters get a new form with its own name, art and
  // story — +1 natural star, HP/ATK/DEF +10% of the base species, no rare form; only from a special egg built from shards
  // that the base species' zone boss drops (SPECIAL_SHARD_*). Art ships as separate files (assets_ext/). ----
  B05S: {
    id: 'B05S', art: 'monB05s', name: 'ขุนสมิงเผือก', nameEn: 'Khun Saming the White', elem: 'light', role: 'Attacker', rarity: 'rare', special: 'B05',
    base: { hp: 957, atk: 143, def: 57, spd: 114 },
    passive: { kind: 'enrage', value: 3, name: 'โทสะขุนสมิง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' },
    leader: { stat: 'atk', value: 0.2, text: 'ATK ทั้งทีม +20%' },
    skills: [
      { id: 'khun_axe', name: 'ขวานโลหิต', desc: 'ฟาดขวาน 1 ตัว 50% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 1.15, effects: [{ kind: 'mark', elem: 'light', chance: 0.5 }], anim: 'melee' },
      { id: 'khun_roar', name: 'คำรามขุนศึก', desc: 'ผ่าขวาน 1 ตัวแรง ไม่สนใจ DEF 40% + ตัวเองภูมิคุ้มกัน 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.7, ignoreDef: 0.4, effects: [{ kind: 'status', status: 'immunity', turns: 2, to: 'self' }], anim: 'melee' },
      { id: 'khun_sunaxe', name: 'ขวานสุริยันผ่าปฐพี', desc: 'ทุ่มขวานผ่าพื้นใส่ทุกตัว ไม่สนใจ DEF 30% + 35% มึน 1 เทิร์น', cd: 5, target: 'enemyAll', mult: 1.35, ignoreDef: 0.3, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.35 }], anim: 'ult_quake', ult: true },
    ],
  },
};
// ---- rare forms = light/dark monsters of their own (decided 2026-10-13): same name, element light or dark (a light species
// turns dark and a dark one turns light), skill 1 kept in the new element, its own skills 2 and 3 built around the light
// (protect & restore) or dark (break & curse) mechanics. Stats, leader skill and rare passive are unchanged. ----
// Tuned 2026-10-14 (owner: an all-rare team may win at most ~15% more, down from +20%): every rare ult cd +1, and
// the strongest forms toned down (B01 shield/stun, A09 provoke/drain, B04 unheal/heal/brand, B06 cd/revive/heal, B07 counter).
const AL = 'allies' as const, EN = 'enemies' as const, SF = 'self' as const;
const RARE_FORMS: Record<string, { elem: Elem; skills: [SkillDef, SkillDef] }> = {
  A01: { elem: 'light', skills: [
    { id: 'fox_l_fang', name: 'เขี้ยวแสงทะลวง', desc: 'กัด 1 ตัวแรง ไม่สนใจ DEF 50% (กัด 3 ครั้ง)', cd: 3, target: 'enemy', mult: 1.5, hits: 3, ignoreDef: 0.5, effects: [], anim: 'melee' },
    { id: 'fox_l_judge', name: 'อรุณพิพากษา', desc: 'พุ่งทะลุทุกตัว ไม่สนใจ DEF 30% + คูลดาวน์ทีม −1', cd: 6, target: 'enemyAll', mult: 1.15, ignoreDef: 0.3, effects: [{ kind: 'cdTeam', value: 1, to: AL }], anim: 'ult_dash', ult: true }] },
  A02: { elem: 'light', skills: [
    { id: 'slime_l_ward', name: 'ฟองภูมิคุ้มกัน', desc: 'ฮีลทั้งทีม 20% + ภูมิคุ้มกัน 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.2, to: AL }, { kind: 'status', status: 'immunity', turns: 2, to: AL }], anim: 'heal' },
    { id: 'slime_l_pearl', name: 'ธารามุกอมตะ', desc: 'ฮีลทั้งทีม 30% + อมตะทั้งทีม 1 เทิร์น + ศัตรูทุกตัวติดเครื่องหมายแสง', cd: 7, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.3, to: AL }, { kind: 'status', status: 'invincible', turns: 1, to: AL }, { kind: 'mark', elem: 'light', chance: 1, to: EN }], anim: 'ult_starlight', ult: true }] },
  A03: { elem: 'dark', skills: [
    { id: 'owl_d_curse', name: 'ขนนกต้องสาป', desc: 'ใส่ 1 ตัว ขโมยเกจ 40 + 60% หลับ 2 เทิร์น', cd: 3, target: 'enemy', mult: 0.9, effects: [{ kind: 'steal', value: 40 }, { kind: 'status', status: 'sleep', turns: 2, chance: 0.6 }], anim: 'shot' },
    { id: 'owl_d_silence', name: 'ราตรีไร้เสียง', desc: 'ทุกตัว 50% ผนึกสกิล 2 เทิร์น + ลดเกจ 20 · 25% สับสน', cd: 5, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'silence', turns: 2, chance: 0.5 }, { kind: 'atb', value: -20 }, { kind: 'status', status: 'confuse', turns: 1, chance: 0.25 }], anim: 'ult_nightwave', ult: true }] },
  A04: { elem: 'dark', skills: [
    { id: 'golem_d_brand', name: 'ศิลาตราบาป', desc: 'ทุบ 1 ตัว ติดตราบาป 2 เทิร์น + โล่ทั้งทีม 12% (ทุบ 2 ครั้ง)', cd: 3, target: 'enemy', mult: 1.0, hits: 2, effects: [{ kind: 'status', status: 'brand', turns: 2, chance: 1 }, { kind: 'shield', value: 0.12, turns: 2, to: AL }], anim: 'melee' },
    { id: 'golem_d_swallow', name: 'แผ่นดินกลืน', desc: 'ทุกตัว 50% ยั่วยุ 1 เทิร์น + 70% ลด DEF 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 0.8, effects: [{ kind: 'status', status: 'provoke', turns: 1, chance: 0.5 }, { kind: 'status', status: 'def_down', turns: 2, chance: 0.7 }], anim: 'ult_quake', ult: true }] },
  A05: { elem: 'dark', skills: [
    { id: 'sprite_d_bless', name: 'พรเงา', desc: 'เกจทีม +20 + ศัตรูทุกตัวติดตราบาป 1 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'atb', value: 20, to: AL }, { kind: 'status', status: 'brand', turns: 1, chance: 1, to: EN }], anim: 'buff' },
    { id: 'sprite_d_steal', name: 'ราตรีขโมยดาว', desc: 'ขโมยเกจศัตรูทุกตัว 25 แบ่งให้ทีม + 40% ผนึกสกิล 1 เทิร์น · 25% สับสน', cd: 5, target: 'enemyAll', mult: 0.5, effects: [{ kind: 'steal', value: 25 }, { kind: 'status', status: 'silence', turns: 1, chance: 0.4 }, { kind: 'status', status: 'confuse', turns: 1, chance: 0.25 }], anim: 'ult_nightwave', ult: true }] },
  A06: { elem: 'light', skills: [
    { id: 'shroom_l_ward', name: 'ละอองคุ้มภัย', desc: 'ทีมภูมิคุ้มกัน 1 เทิร์น + ศัตรูทุกตัว 50% ลด SPD 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'immunity', turns: 1, to: AL }, { kind: 'status', status: 'spd_down', turns: 2, chance: 0.5, to: EN }], anim: 'buff' },
    { id: 'shroom_l_moon', name: 'จันทร์ชำระ', desc: 'ทุกตัว ไม่สนใจ DEF 30% + 50% หลับ 1 เทิร์น', cd: 5, target: 'enemyAll', mult: 0.7, ignoreDef: 0.3, effects: [{ kind: 'status', status: 'sleep', turns: 1, chance: 0.5 }], anim: 'ult_starlight', ult: true }] },
  A07: { elem: 'dark', skills: [
    { id: 'eggling_d_bomb', name: 'เปลือกระเบิด', desc: 'ติดระเบิดเงาใส่ 1 ตัว (ครบ 2 เทิร์นระเบิด + มึน) + โล่ทั้งทีม 12% · เพื่อน 1 ตัวรุมตีด้วยสกิล 1 (40%)', cd: 3, target: 'enemy', mult: 0.6, effects: [{ kind: 'status', status: 'bomb', turns: 2, chance: 1, value: 1.2 }, { kind: 'shield', value: 0.12, turns: 2, to: AL }, { kind: 'assist', n: 1, value: 0.4 }], anim: 'shot' },
    { id: 'eggling_d_hell', name: 'ฟักนรก!', desc: 'ลูกเจี๊ยบเงารุมตีทุกตัว ติดเครื่องหมายมืด + 70% ตราบาป + ห้ามฮีล 2 เทิร์น', cd: 5, target: 'enemyAll', mult: 0.85, effects: [{ kind: 'mark', elem: 'dark', chance: 1 }, { kind: 'status', status: 'brand', turns: 2, chance: 0.7 }, { kind: 'status', status: 'unheal', turns: 2, chance: 0.7 }], anim: 'ult_nightwave', ult: true }] },
  A08: { elem: 'light', skills: [
    { id: 'wisp_l_ward', name: 'แสงโคมนำทาง', desc: 'ทีมภูมิคุ้มกัน 2 เทิร์น + เกจ 15', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'immunity', turns: 2, to: AL }, { kind: 'atb', value: 15, to: AL }], anim: 'buff' },
    { id: 'wisp_l_heaven', name: 'โคมสวรรค์', desc: 'ชุบชีวิตพวกที่ล้ม 1 ตัว HP 40% + ทีมอมตะ 1 เทิร์น', cd: 6, target: 'allyAll', mult: 0, effects: [{ kind: 'revive', value: 0.4, n: 1 }, { kind: 'status', status: 'invincible', turns: 1, to: AL }], anim: 'ult_starlight', ult: true }] },
  A09: { elem: 'dark', skills: [
    { id: 'root_d_poison', name: 'รากพิษ', desc: 'ทุกตัว 60% พิษ + ห้ามฮีล 2 เทิร์น · 25% สับสน', cd: 3, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'poison', turns: 2, chance: 0.6 }, { kind: 'status', status: 'unheal', turns: 2, chance: 0.6 }, { kind: 'status', status: 'confuse', turns: 1, chance: 0.25 }], anim: 'volley' },
    { id: 'root_d_abyss', name: 'ป่าอเวจี', desc: 'รากเงาใต้ทุกตัว 40% ยั่วยุ 1 เทิร์น + ดูดชีวิต 20%', cd: 6, target: 'enemyAll', mult: 1.0, effects: [{ kind: 'status', status: 'provoke', turns: 1, chance: 0.4 }, { kind: 'drain', value: 0.2, to: SF }], anim: 'ult_roots', ult: true }] },
  B01: { elem: 'light', skills: [
    { id: 'buffalo_l_ward', name: 'ยันต์อมตะ', desc: 'ตัวเองอมตะ 1 เทิร์น + โล่ทั้งทีม 10%', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'invincible', turns: 1, to: SF }, { kind: 'shield', value: 0.1, turns: 2, to: AL }], anim: 'shield' },
    { id: 'buffalo_l_horn', name: 'ขวิดศักดิ์สิทธิ์', desc: 'พุ่งชนทุกตัว ไม่สนใจ DEF 30% + 25% มึน 1 เทิร์น', cd: 6, target: 'enemyAll', mult: 0.9, ignoreDef: 0.3, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.25 }], anim: 'ult_dash', ult: true }] },
  B02: { elem: 'light', skills: [
    { id: 'effigy_l_thread', name: 'ด้ายผูกแสง', desc: 'ใส่ 1 ตัว ไม่สนใจ DEF 50% + 60% มึน 1 เทิร์น · ด้ายแสงกระโดดไปอีก 1 ตัว (70%)', cd: 3, target: 'enemy', mult: 1.0, chain: 1, ignoreDef: 0.5, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.6 }], anim: 'shot' },
    { id: 'effigy_l_charm', name: 'หุ่นมงคลรับเคราะห์', desc: 'ทีมภูมิคุ้มกัน 2 เทิร์น + ศัตรูทุกตัว 40% หลับ 1 เทิร์น + 50% ลด DEF 2 เทิร์น', cd: 5, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'immunity', turns: 2, to: AL }, { kind: 'status', status: 'sleep', turns: 1, chance: 0.4, to: EN }, { kind: 'status', status: 'def_down', turns: 2, chance: 0.5, to: EN }], anim: 'ult_starlight', ult: true }] },
  B03: { elem: 'light', skills: [
    { id: 'hatsa_l_rush', name: 'งวงเร่งลม', desc: 'ฟาด 1 ตัวแรง + คูลดาวน์ทีม −1 · เพื่อน 2 ตัวบุกตามด้วยสกิล 1 (40%)', cd: 3, target: 'enemy', mult: 1.3, effects: [{ kind: 'cdTeam', value: 1, to: AL }, { kind: 'assist', n: 2, value: 0.4 }], anim: 'melee' },
    { id: 'hatsa_l_sun', name: 'ปีกสุริยะ', desc: 'คลื่นแสงทุกตัว ไม่สนใจ DEF 30% + 50% ตาบอด 2 เทิร์น', cd: 6, target: 'enemyAll', mult: 0.95, ignoreDef: 0.3, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.5 }], anim: 'ult_nightwave', ult: true }] },
  B04: { elem: 'dark', skills: [
    { id: 'dryad_d_curse', name: 'สาปตะเคียน', desc: 'ศัตรูทุกตัว 50% ห้ามฮีล 2 เทิร์น + ทีมฟื้นฟู 2 เทิร์น · 25% สับสน', cd: 3, target: 'enemyAll', mult: 0.4, effects: [{ kind: 'status', status: 'unheal', turns: 2, chance: 0.5 }, { kind: 'status', status: 'regen', turns: 2, to: AL }, { kind: 'status', status: 'confuse', turns: 1, chance: 0.25 }], anim: 'volley' },
    { id: 'dryad_d_soul', name: 'วิญญาณคืนร่าง', desc: 'ชุบชีวิตพวกที่ล้ม 1 ตัว HP 30% + ฮีลทั้งทีม 15% + ศัตรูทุกตัว 60% ตราบาป', cd: 6, target: 'allyAll', mult: 0, effects: [{ kind: 'revive', value: 0.3, n: 1 }, { kind: 'heal', value: 0.15, to: AL }, { kind: 'status', status: 'brand', turns: 2, chance: 0.6, to: EN }], anim: 'ult_rain', ult: true }] },
  B05: { elem: 'light', skills: [
    { id: 'saming_l_claw', name: 'ตะปบทะลวง', desc: 'ขย้ำ 1 ตัวแรง ไม่สนใจ DEF 50% + 50% ตาบอด 2 เทิร์น (ตะปบ 2 ครั้ง)', cd: 3, target: 'enemy', mult: 1.5, hits: 2, ignoreDef: 0.5, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.5 }], anim: 'melee' },
    { id: 'saming_l_divine', name: 'พยัคฆ์เทวะ', desc: 'พุ่งทะลุทุกตัว + ตัวเองอมตะ 1 เทิร์น', cd: 6, target: 'enemyAll', mult: 1.3, effects: [{ kind: 'status', status: 'invincible', turns: 1, to: SF }], anim: 'ult_dash', ult: true }] },
  B06: { elem: 'light', skills: [
    { id: 'kinnari_l_gold', name: 'ระบำทอง', desc: 'ฮีลทั้งทีม 18% + คูลดาวน์ทีม −1', cd: 4, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.18, to: AL }, { kind: 'cdTeam', value: 1, to: AL }], anim: 'heal' },
    { id: 'kinnari_l_rebirth', name: 'ฟ้อนคืนชีวิต', desc: 'ชุบชีวิตพวกที่ล้มทุกตัว HP 25% + ฮีลทั้งทีม 15% + ล้างสถานะ', cd: 7, target: 'allyAll', mult: 0, effects: [{ kind: 'revive', value: 0.25 }, { kind: 'heal', value: 0.15, to: AL }, { kind: 'cleanse', to: AL }], anim: 'ult_starlight', ult: true }] },
  B07: { elem: 'dark', skills: [
    { id: 'gaja_d_roar', name: 'คำรามท้าทาย', desc: 'ทุกตัว 50% ยั่วยุ 1 เทิร์น + 50% ลด ATK 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.55, effects: [{ kind: 'status', status: 'provoke', turns: 1, chance: 0.5 }, { kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }], anim: 'volley' },
    { id: 'gaja_d_abyss', name: 'งาอเวจี', desc: 'ทุกตัว ลบบัฟทั้งหมด + โล่ตัวเอง 30% (กระทืบ 3 ครั้ง)', cd: 5, target: 'enemyAll', mult: 0.9, hits: 3, effects: [{ kind: 'strip' }, { kind: 'shield', value: 0.3, turns: 2, to: SF }], anim: 'ult_quake', ult: true }] },
  B08: { elem: 'light', skills: [
    { id: 'garuda_l_dive', name: 'โฉบสุริยะ', desc: 'โฉบ 1 ตัวแรง ไม่สนใจ DEF 50% + 60% ตาบอด 2 เทิร์น · แสงกระโดดไปอีก 1 ตัว (70%)', cd: 3, target: 'enemy', mult: 1.7, chain: 1, ignoreDef: 0.5, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.6 }], anim: 'melee' },
    { id: 'garuda_l_sunfire', name: 'เพลิงสุริยครุฑ', desc: 'ทุกตัวแรง ลดเกจ 20 + คูลดาวน์ทีม −1', cd: 6, target: 'enemyAll', mult: 1.4, effects: [{ kind: 'atb', value: -20 }, { kind: 'cdTeam', value: 1, to: AL }], anim: 'ult_dash', ult: true }] },
  B09: { elem: 'light', skills: [
    { id: 'naga_l_jewel', name: 'มณีส่องฟ้า', desc: 'ทุกตัว ไม่สนใจ DEF 30% + 50% ตาบอด 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.8, ignoreDef: 0.3, effects: [{ kind: 'status', status: 'blind', turns: 2, chance: 0.5 }], anim: 'volley' },
    { id: 'naga_l_avatar', name: 'นาคราชอวตาร', desc: 'ทุกตัวแรง + ทีมอมตะ 1 เทิร์น + เกจทีม 20', cd: 6, target: 'enemyAll', mult: 1.45, effects: [{ kind: 'status', status: 'invincible', turns: 1, to: AL }, { kind: 'atb', value: 20, to: AL }], anim: 'ult_starlight', ult: true }] },
  C01: { elem: 'light', skills: [
    { id: 'pixiu_l_absorb', name: 'กลืนเคราะห์', desc: 'ล้างสถานะทั้งทีม + ภูมิคุ้มกัน 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'cleanse', to: AL }, { kind: 'status', status: 'immunity', turns: 2, to: AL }], anim: 'buff' },
    { id: 'pixiu_l_rain', name: 'ฝนทองมงคล', desc: 'ATK และคริขึ้นทั้งทีม 2 เทิร์น + คูลดาวน์ทีม −1', cd: 6, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'atk_up', turns: 2, to: AL }, { kind: 'status', status: 'crit_up', turns: 2, to: AL }, { kind: 'cdTeam', value: 1, to: AL }], anim: 'ult_starlight', ult: true }] },
  C02: { elem: 'dark', skills: [
    { id: 'toad_d_coin', name: 'เหรียญต้องสาป', desc: 'ทุกตัว ลบบัฟ 1 อย่าง + 50% ลด ATK 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.5, effects: [{ kind: 'strip', n: 1 }, { kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }], anim: 'volley' },
    { id: 'toad_d_doom', name: 'เคราะห์มาเยือน', desc: 'ทุกตัว 80% ตราบาป 2 เทิร์น + ขโมยเกจ 20', cd: 5, target: 'enemyAll', mult: 0.6, effects: [{ kind: 'status', status: 'brand', turns: 2, chance: 0.8 }, { kind: 'steal', value: 20 }], anim: 'ult_nightwave', ult: true }] },
  C03: { elem: 'light', skills: [
    { id: 'lion_l_ward', name: 'ลูกแก้วปกป้อง', desc: 'ปกป้องทั้งทีม 2 เทิร์น + DEF ตัวเองขึ้น 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'status', status: 'protect', turns: 2, to: AL }, { kind: 'status', status: 'def_up', turns: 2, to: SF }], anim: 'shield' },
    { id: 'lion_l_roar', name: 'คำรามสิงห์ทอง', desc: 'ทุกตัว 40% มึน 1 เทิร์น + ทีมภูมิคุ้มกัน 2 เทิร์น', cd: 6, target: 'enemyAll', mult: 0.8, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.4 }, { kind: 'status', status: 'immunity', turns: 2, to: AL }], anim: 'ult_quake', ult: true }] },
  C04: { elem: 'dark', skills: [
    { id: 'rabbit_d_potion', name: 'ยาจันทร์ดับ', desc: 'ฮีลทั้งทีม 18% + ศัตรูทุกตัว 35% ห้ามฮีล 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.18, to: AL }, { kind: 'status', status: 'unheal', turns: 2, chance: 0.35, to: EN }], anim: 'heal' },
    { id: 'rabbit_d_eclipse', name: 'คืนจันทร์ดับ', desc: 'ฮีลทั้งทีม 25% + ศัตรูทุกตัวลบบัฟ 1 อย่าง + ขโมยเกจ 15 · ศัตรูทุกตัว 25% แช่แข็ง', cd: 6, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.25, to: AL }, { kind: 'strip', n: 1, to: EN }, { kind: 'steal', value: 15, to: EN }, { kind: 'status', status: 'freeze', turns: 1, chance: 0.25, to: EN }], anim: 'ult_starlight', ult: true }] },
  C05: { elem: 'dark', skills: [
    { id: 'kitsune_d_illusion', name: 'มนตร์ลวงตา', desc: 'ใส่ 1 ตัว ลบบัฟทั้งหมด + 60% หลับ 2 เทิร์น', cd: 3, target: 'enemy', mult: 1.0, effects: [{ kind: 'strip' }, { kind: 'status', status: 'sleep', turns: 2, chance: 0.6 }], anim: 'shot' },
    { id: 'kitsune_d_bomb', name: 'ระเบิดเก้าหาง', desc: 'ทุกตัว ติดเครื่องหมายมืด + 60% ติดระเบิดเงา (ครบ 2 เทิร์นระเบิด + มึน) · 25% สับสน', cd: 6, target: 'enemyAll', mult: 0.7, effects: [{ kind: 'mark', elem: 'dark', chance: 1 }, { kind: 'status', status: 'bomb', turns: 2, chance: 0.6, value: 0.9 }, { kind: 'status', status: 'confuse', turns: 1, chance: 0.25 }], anim: 'ult_nightwave', ult: true }] },
  C06: { elem: 'dark', skills: [
    { id: 'bull_d_taunt', name: 'โทสะท้าทาย', desc: 'ทุบ 1 ตัว ยั่วยุ 2 เทิร์น + โล่ตัวเอง 25% · เพื่อน 1 ตัวรุมตีด้วยสกิล 1 (40%)', cd: 3, target: 'enemy', mult: 1.0, effects: [{ kind: 'status', status: 'provoke', turns: 2, chance: 1 }, { kind: 'shield', value: 0.25, turns: 2, to: SF }, { kind: 'assist', n: 1, value: 0.4 }], anim: 'melee' },
    { id: 'bull_d_hell', name: 'ทุบนรก', desc: 'ทุกตัว 30% มึน + 60% ห้ามฮีล 2 เทิร์น + ดูดชีวิต 25%', cd: 6, target: 'enemyAll', mult: 1.1, effects: [{ kind: 'status', status: 'stun', turns: 1, chance: 0.3 }, { kind: 'status', status: 'unheal', turns: 2, chance: 0.6 }, { kind: 'drain', value: 0.25, to: SF }], anim: 'ult_quake', ult: true }] },
  // BATCH21: wind/dark → light, water/light → dark (three each)
  E01: { elem: 'light', skills: [
    { id: 'griffin_l_gold', name: 'กรงเล็บทองสุริยะ', desc: 'โฉบ 1 ตัว ไม่สนใจ DEF 40% ยิ่ง SPD สูงยิ่งแรง + เกจตัวเอง +20 (โฉบ 2 ครั้ง)', cd: 3, target: 'enemy', mult: 1.4, hits: 2, ignoreDef: 0.4, scale: 'spd', effects: [{ kind: 'atb', value: 20, to: SF }], anim: 'melee' },
    { id: 'griffin_l_sun', name: 'ปีกทองพิทักษ์ฟ้า', desc: 'โฉบทุกตัว ไม่สนใจ DEF 25% ยิ่ง SPD สูงยิ่งแรง + ภูมิคุ้มกันทั้งทีม 2 เทิร์น', cd: 6, target: 'enemyAll', mult: 1.1, ignoreDef: 0.25, scale: 'spd', effects: [{ kind: 'status', status: 'immunity', turns: 2, to: AL }], anim: 'ult_dash', ult: true }] },
  E10: { elem: 'light', skills: [
    { id: 'spartoi_l_pierce', name: 'ดาบแสงทะลวงเกราะ', desc: 'ฟัน 1 ตัว ไม่สนใจ DEF 40% · เป้าหมาย HP ต่ำกว่าครึ่ง +30% · ทัพกระดูก 2 ตัวบุกตามด้วยสกิล 1 (40%)', cd: 3, target: 'enemy', mult: 1.4, ignoreDef: 0.4, execute: 0.3, effects: [{ kind: 'assist', n: 2, value: 0.4 }], anim: 'melee' },
    { id: 'spartoi_l_oath', name: 'คำสาบานทัพศักดิ์สิทธิ์', desc: 'ฟันทุกตัว ตัวที่ HP ต่ำกว่าครึ่ง +30% + คูลดาวน์ทีม −1', cd: 6, target: 'enemyAll', mult: 1.05, execute: 0.3, effects: [{ kind: 'cdTeam', value: 1, to: AL }], anim: 'ult_starlight', ult: true }] },
  F01: { elem: 'dark', skills: [
    { id: 'crab_d_taunt', name: 'ก้ามท้าทายห้วงลึก', desc: 'กระแทก 1 ตัว ยิ่ง DEF สูงยิ่งแรง ยั่วยุ 2 เทิร์น + DEF ตัวเองขึ้น 2 เทิร์น (กระแทก 2 ครั้ง)', cd: 3, target: 'enemy', mult: 0.8, hits: 2, scale: 'def', effects: [{ kind: 'status', status: 'provoke', turns: 2, chance: 1 }, { kind: 'status', status: 'def_up', turns: 2, to: SF }], anim: 'melee' },
    { id: 'crab_d_abyss', name: 'วังวนห้วงทะเลลึก', desc: 'ซัดทุกตัว ยิ่ง DEF สูงยิ่งแรง ลบบัฟทุกอย่าง + 50% ห้ามฮีล 2 เทิร์น', cd: 6, target: 'enemyAll', mult: 0.55, scale: 'def', effects: [{ kind: 'strip' }, { kind: 'status', status: 'unheal', turns: 2, chance: 0.5 }], anim: 'ult_quake', ult: true }] },
  G01: { elem: 'dark', skills: [
    { id: 'bastet_d_shadow', name: 'เงาแมวขโมยจันทร์', desc: 'ตะครุบ 1 ตัว ขโมยเกจ 25 แบ่งให้ทีม', cd: 3, target: 'enemy', mult: 1.35, effects: [{ kind: 'steal', value: 25 }], anim: 'melee' },
    { id: 'bastet_d_night', name: 'คืนเทพีพิโรธ', desc: 'หมุนตะปบทุกตัว 50% ตราบาป 2 เทิร์น · 25% สับสน', cd: 6, target: 'enemyAll', mult: 1.1, effects: [{ kind: 'status', status: 'brand', turns: 2, chance: 0.5 }, { kind: 'status', status: 'confuse', turns: 1, chance: 0.25 }], anim: 'ult_nightwave', ult: true }] },
  H01: { elem: 'dark', skills: [
    { id: 'kappa_d_drown', name: 'ลากลงห้วงน้ำดำ', desc: 'ฟาด 1 ตัว 60% ผนึกสกิล 2 เทิร์น (ฟาด 2 ครั้ง)', cd: 3, target: 'enemy', mult: 1.35, hits: 2, effects: [{ kind: 'status', status: 'silence', turns: 2, chance: 0.6 }], anim: 'melee' },
    { id: 'kappa_d_whirl', name: 'วังน้ำวนคัปปะ', desc: 'กระแทก 1 ตัวแรงมาก ติดระเบิดเงา (ครบ 2 เทิร์นระเบิด + มึน)', cd: 6, target: 'enemy', mult: 1.9, effects: [{ kind: 'status', status: 'bomb', turns: 2, chance: 1, value: 1.0 }], anim: 'ult_vortex', ult: true }] },
  H04: { elem: 'light', skills: [
    { id: 'baku_l_ward', name: 'ม่านฝันดี', desc: 'กินสถานะร้ายทั้งทีม ฮีล 8% ต่ออย่างที่กิน + ภูมิคุ้มกัน 2 เทิร์น', cd: 3, target: 'allyAll', mult: 0, effects: [{ kind: 'dreamEat', value: 0.08, to: AL }, { kind: 'status', status: 'immunity', turns: 2, to: AL }], anim: 'heal' },
    { id: 'baku_l_dawn', name: 'ตื่นสู่อรุณ', desc: 'ฮีลทั้งทีม 22% + ชุบชีวิตพวกที่ล้ม 1 ตัว HP 25%', cd: 6, target: 'allyAll', mult: 0, effects: [{ kind: 'heal', value: 0.22, to: AL }, { kind: 'revive', value: 0.25, n: 1 }], anim: 'ult_starlight', ult: true }] },
};
for (const [id, f] of Object.entries(RARE_FORMS)) SPECIES[id].rareForm = f;
const MARK_TH: Partial<Record<Elem, string[]>> = { water: ['น้ำ', 'เปียก'] };
/** skill 1 moves to the rare form's element: its own-element marks (and their wording) follow */
function reElem(k: SkillDef, from: Elem, to: Elem): SkillDef {
  let desc = k.desc; for (const w of MARK_TH[from] || [ELEM_NAME[from]]) desc = desc.split('เครื่องหมาย' + w).join('เครื่องหมาย' + ELEM_NAME[to]);
  return { ...k, desc, elem: k.elem === from ? to : k.elem, effects: k.effects.map(e => e.kind === 'mark' && e.elem === from ? { ...e, elem: to } : e) };
}
const FORMS: Record<string, { elem: Elem; skills: SkillDef[] }> = {};
/** the battle form of a species: the rare form has its own element and skills (normal form = the species itself) */
export function formOf(sid: string, rare = false): { elem: Elem; skills: SkillDef[] } {
  const s = SPECIES[sid], f = rare ? s?.rareForm : undefined;
  if (!f) return s;
  return FORMS[sid] ||= { elem: f.elem, skills: [reElem(s.skills[0], s.elem, f.elem), ...f.skills] };
}
export const STARTERS = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'];

// ---- world map (decided 2026-10-13): 15 zones, one per battle location, five stages each — the fifth is the zone
// boss (an elite of the zone's signature monster, a map boss, or a Starborn Legend). Waves are generated from each zone's
// monster pool; the per-stage enemy levels (`lv`) are tuned with the starter-team sim (tests/sim.ts `ZONE_PLAN`). ----
export const ZONES: ZoneDef[] = [
  { id: 'meadow', realm: '1', loc: 'meadow', name: 'ทุ่งหญ้าไข่ป่วน', desc: 'ทุ่งบ้านเกิดของเผ่าไข่ป่วน มอนป่าซนๆ เหมาะลองจัดทีม' },
  { id: 'stream', realm: '1', loc: 'stream', name: 'ลำธารเปียกปอน', desc: 'ศัตรูเปียกง่าย ลองใช้ลมให้เกิดพายุฟ้าคะนอง' },
  { id: 'rootnest', realm: '1', loc: 'rootnest', name: 'รังรากไม้', desc: 'ป่าลึกใต้ต้นไม้ยักษ์ รากรัดทำให้มึน' },
  { id: 'goldforest', realm: '2', loc: 'goldforest', name: 'ป่าตะเคียนทอง', desc: 'พรายตะเคียนกับหุ่นฟางซุ่มในป่า ระวังคำสาปลด ATK' },
  { id: 'ricefield', realm: '2', loc: 'ricefield', name: 'ทุ่งควายธนู', desc: 'ควายธนูหนังเหนียว ใช้ไฟเผาไหม้หรือทำปฏิกิริยาลาวา' },
  { id: 'village', realm: '2', loc: 'village', name: 'หมู่บ้านหุ่นพยนต์', desc: 'หมู่บ้านยามค่ำ เสือสมิงออกล่า ตีแรงแต่ตัวบาง' },
  { id: 'kinnari', realm: '2', loc: 'kinnari', name: 'วิมานกินรี', desc: 'ศัตรูธาตุลมฮีลเก่ง ตีให้ไวหรือใช้ไฟ' },
  { id: 'temple', realm: '2', loc: 'temple', name: 'ลานคชสีห์', desc: 'คชสีห์เฝ้าลานปราสาท ป้องกันหนา · บอสตำนานดารา คิเมร่าราชันย์' },
  { id: 'nagapool', realm: '2', loc: 'nagapool', name: 'สระมณีนาคราช', desc: 'สระศักดิ์สิทธิ์ยามสนธยา · บอสตำนานดารา พญานาคปัญจเศียร' },
  { id: 'jade', realm: '3', loc: 'jade', name: 'สวนหยกจันทรา', desc: 'กระต่ายหยกกับคางคกทองเฝ้าสวน ฮีลกันเอง · บอสตำนานดารา กิเลนอสนีบาต' },
  { id: 'palace', realm: '3', loc: 'palace', name: 'ตำหนักปี่เซียะ', desc: 'สิงโตผู้พิทักษ์สวนกลับ ปี่เซียะให้โล่ทั้งทีม · บอสตำนานดารา มังกรทองหวงหลง' },
  { id: 'foxvalley', realm: '3', loc: 'foxvalley', name: 'หุบเขาจิ้งจอกเก้าหาง', desc: 'หุบเขาหิมะ ไฟจิ้งจอกลอยวน · บอสตำนานดารา โอโรจิแปดหุบเขา' },
  { id: 'toadbridge', realm: '3', loc: 'toadbridge', name: 'สะพานคางคกทอง', desc: 'คางคกพ่นเหรียญลด DEF จิ้งจอกเผาไหม้ทั้งทีม' },
  { id: 'heaven', realm: '3', loc: 'heaven', name: 'ประตูสวรรค์', desc: 'ประตูเหนือทะเลเมฆ · บอสตำนานดารา วาลคีร์ปีกพายุ' },
  { id: 'firecave', realm: '3', loc: 'firecave', name: 'ถ้ำเพลิงราชาอสูร', desc: 'ถ้ำลาวาใต้ภูเขาไฟ วัวอสูรเฝ้าทางเข้า · บอสตำนานดารา อสูรราชาตรีมุข' },
];
interface ZoneGen { pool: string[]; grade: number; k: [number, number, number, number, number]; boss: EnemyRef; bossDesc: string; rare?: boolean; duel?: boolean } // duel: the boss comes with one escort, not two
/** per-zone generator data · enemies sit at the recommended level (ZONE_PLAN); k = HP/ATK multiplier of stages 1–5
 *  (boss stage: its escorts) tuned by the starter-team sim · the boss: its own HP/ATK multipliers, level = plan + 3 */
export const ZONE_GEN: Record<string, ZoneGen> = {
  meadow: { pool: ['A02', 'A06', 'A03', 'A04'], grade: 1, k: [1.15, 1, 0.9, 0.9, 0.9], boss: { sid: 'A07', lvl: 0, stars: 1, boss: true, name: 'ไข่ป่วนยักษ์', scale: 1.45, hpMult: 6.64, atkMult: 0.86, bp: [{ kind: 'aura', stat: 'atk', value: 0.15, name: 'หัวหน้าเผ่าไข่ป่วน', desc: 'พวกเดียวกัน ATK +15%' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสไข่ป่วนยักษ์ หัวหน้าเผ่า ตัวใหญ่ HP หนา' },
  stream: { pool: ['A02', 'A03', 'A06', 'A01'], grade: 1, k: [0.85, 0.85, 0.9, 0.85, 0.9], boss: { sid: 'A02', lvl: 0, stars: 1, boss: true, name: 'ราชาสไลม์ธารา', scale: 1.5, hpMult: 2.05, atkMult: 0.95, bp: [{ kind: 'rebirth', value: 0.35, name: 'แยกร่างคืนชีพ', desc: 'ล้มแล้วฟื้นเองด้วย HP 35% (ครั้งเดียว)' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสราชาสไลม์ ฮีลตัวเองเก่ง ทำเปียกใส่ทั้งทีม' },
  rootnest: { pool: ['A06', 'A04', 'A05', 'A08'], grade: 1, k: [1.15, 1.15, 1, 1, 1], boss: { sid: 'BOSS_ROOT', lvl: 0, stars: 1, hpMult: 4.2, atkMult: 0.87, bp: [{ kind: 'thorns', value: 0.15, name: 'หนามรากบรรพ์', desc: 'สะท้อนดาเมจ 15%' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสอสูรรากไม้ยักษ์ ระวังรากรัดทำให้มึน' },
  goldforest: { pool: ['B04', 'B02', 'B03'], grade: 2, k: [1.3, 1.15, 1.15, 1.15, 1.15], boss: { sid: 'B04', lvl: 0, stars: 2, boss: true, name: 'แม่พรายตะเคียนทอง', scale: 1.4, hpMult: 4.34, atkMult: 0.78, bp: [{ kind: 'curseOnHit', status: 'confuse', chance: 0.15, name: 'เสียงกระซิบพราย', desc: 'ตีโดนนาง 15% ผู้ตีสับสน' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสแม่พรายตะเคียน ฮีลแรง สาปลด ATK' },
  ricefield: { pool: ['B04', 'B03', 'B01', 'F01'], grade: 2, k: [1.2, 1.05, 1.25, 1.11, 0.95], boss: { sid: 'B01', lvl: 0, stars: 2, boss: true, name: 'ควายธนูเขาทอง', scale: 1.4, hpMult: 6.25, atkMult: 0.87, bp: [{ kind: 'counter', chance: 0.35, value: 0.8, name: 'ขวิดสวน', desc: 'ถูกโจมตี 35% สวนกลับ' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสควายธนูเขาทอง หนังเหนียวมาก ใช้ไฟหรือลาวา' },
  village: { pool: ['B02', 'B04', 'B05', 'E10'], grade: 2, k: [1.25, 1.1, 0.9, 0.95, 0.85], boss: { sid: 'B05', lvl: 0, stars: 2, boss: true, name: 'เสือสมิงเฒ่า', scale: 1.4, hpMult: 2.77, atkMult: 0.86, bp: [{ kind: 'evade', chance: 0.2, name: 'เงาสมิงยามค่ำ', desc: 'หลบการตีเดี่ยว 20%' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสเสือสมิงเฒ่า ตีแรงมาก ทำให้ติดสถานะ' },
  kinnari: { pool: ['B03', 'B06', 'B08', 'E01'], grade: 2, k: [1, 0.95, 0.75, 0.81, 0.78], boss: { sid: 'B06', lvl: 0, stars: 2, boss: true, name: 'ราชินีกินรี', scale: 1.4, hpMult: 4.69, atkMult: 0.92, bp: [{ kind: 'allyEndure', name: 'ระบำปกป้อง', desc: 'พวกตัวแรกที่จะล้มรอดด้วย HP 1 (ครั้งเดียว)' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสราชินีกินรี ฮีลทั้งทีม ต้องตีให้ไว' },
  temple: { pool: ['B06', 'B05', 'B08', 'B07'], grade: 2, k: [0.8, 0.75, 0.8, 0.75, 0.8], boss: { sid: 'S02', lvl: 0, stars: 2, boss: true, scale: 1.3, hpMult: 1.17, atkMult: 0.85, bp: [{ kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา คิเมร่าราชันย์ ตะปบแรงไม่สนใจ DEF · มีโอกาสดรอปเศษไข่ดารา', duel: true },
  nagapool: { pool: ['B04', 'B06', 'B05', 'B08'], grade: 2, k: [1.35, 1.2, 1, 0.95, 1], boss: { sid: 'S03', lvl: 0, stars: 2, boss: true, scale: 1.3, hpMult: 2.72, atkMult: 0.85, bp: [{ kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา พญานาคปัญจเศียร โล่หนา คลื่นยักษ์ทำทุกตัวเปียก · มีโอกาสดรอปเศษไข่ดารา', duel: true },
  jade: { pool: ['C02', 'C01', 'C04', 'H04'], grade: 3, k: [1.55, 1.5, 1.35, 1.33, 1.45], boss: { sid: 'S05', lvl: 0, stars: 3, boss: true, scale: 1.3, hpMult: 0.88, atkMult: 0.51, bp: [{ kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา กิเลนอสนีบาต เร่งเกจทีม ลดเกจศัตรู · มีโอกาสดรอปเศษไข่ดารา', duel: true },
  palace: { pool: ['C01', 'C02', 'C03', 'G01'], grade: 3, k: [1.6, 1.25, 1.3, 1.08, 1.03], boss: { sid: 'S06', lvl: 0, stars: 3, boss: true, scale: 1.3, hpMult: 2.27, atkMult: 0.86, bp: [{ kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา มังกรทองหวงหลง ตีแรง ลด DEF มึนทั้งทีม · มีโอกาสดรอปเศษไข่ดารา', duel: true },
  foxvalley: { pool: ['C04', 'C03', 'C05', 'H01'], grade: 3, k: [1.25, 1.15, 1.05, 0.97, 1.01], boss: { sid: 'S04', lvl: 0, stars: 3, boss: true, scale: 1.3, hpMult: 5.24, atkMult: 0.86, bp: [{ kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา โอโรจิแปดหุบเขา ทำหลับ ผนึกสกิล ลบบัฟ · มีโอกาสดรอปเศษไข่ดารา', rare: true, duel: true },
  toadbridge: { pool: ['C01', 'C04', 'C02', 'C05'], grade: 3, k: [1.5, 1.5, 1.4, 1.3, 1.35], boss: { sid: 'C02', lvl: 0, stars: 3, boss: true, name: 'คางคกทองสามขายักษ์', scale: 1.5, hpMult: 2.05, atkMult: 0.95, bp: [{ kind: 'aura', stat: 'crit', value: 0.15, name: 'ทองนำโชค', desc: 'พวกเดียวกัน คริติคอล +15%' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสคางคกทองยักษ์ พ่นเหรียญลด DEF ทั้งทีม', duel: true },
  heaven: { pool: ['C04', 'C03', 'C05', 'C06'], grade: 3, k: [1.2, 1.15, 1, 0.95, 1], boss: { sid: 'S01', lvl: 0, stars: 3, boss: true, scale: 1.3, hpMult: 1.94, atkMult: 0.85, bp: [{ kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา วาลคีร์ปีกพายุ ชุบชีวิตลูกน้อง ทีมอมตะ · มีโอกาสดรอปเศษไข่ดารา', rare: true, duel: true },
  firecave: { pool: ['C02', 'C03', 'C05', 'C06'], grade: 3, k: [1.15, 1.2, 1.05, 1.05, 1.05], boss: { sid: 'S07', lvl: 0, stars: 3, boss: true, scale: 1.3, hpMult: 2.11, atkMult: 0.82, bp: [{ kind: 'counter', chance: 0.3, value: 0.8, name: 'สามพักตร์สวนกลับ', desc: 'ถูกโจมตี 30% สวนกลับ' }, { kind: 'enrage', value: 3, name: 'คลั่ง', desc: 'HP ต่ำกว่าครึ่งครั้งแรก ATK และ SPD ขึ้น 3 เทิร์น' }] }, bossDesc: 'บอสตำนานดารา อสูรราชาตรีมุข โล่ทั้งทีม เผาไหม้ ลด ATK · มีโอกาสดรอปเศษไข่ดารา', duel: true },
};
/** wave make-up for stages 1–5: indexes into the zone pool (weakest first, the zone's strongest last; wrapped for short
 *  pools) — later stages bring in the stronger monsters. The boss wave puts the boss between its two escorts. */
const WAVE_PAT = [
  [[0, 1], [0, 1, 0], [1, 0, 1]],
  [[0, 1], [1, 0, 1], [0, 2, 1]],
  [[0, 1, 0], [1, 2, 0], [0, 2, 1]],
  [[1, 0, 1], [0, 2, 1], [2, 3, 0]],
  [[0, 1, 2], [1, 3, 0], [0, 1]],
];
/** recommended team per zone for the stage list and the balance sim: [level at stage 1, level at stage 5, stars] —
 *  enemy levels (`lv`) are whatever makes the starter team at this level win ~85% (stage 1) → ~62% (boss) */
export const ZONE_PLAN: Record<string, [number, number, number]> = { meadow: [3, 5, 1], stream: [5, 8, 1], rootnest: [8, 10, 1], goldforest: [5, 7, 2], ricefield: [7, 9, 2], village: [9, 12, 2], kinnari: [12, 14, 2], temple: [14, 17, 2], nagapool: [17, 20, 2], jade: [5, 8, 3], palace: [8, 11, 3], foxvalley: [11, 14, 3], toadbridge: [14, 17, 3], heaven: [17, 21, 3], firecave: [21, 25, 3] };
/** recommended [level, stars] for a stage; harder difficulties move it up the same star grades as the enemies */
export const planOf = (st: StageDef): [number, number] => { const [a, b, s] = ZONE_PLAN[st.zone] || [5, 5, 1], lv = Math.round(a + (b - a) * (st.n - 1) / 4), k = DIFFS[st.diff || 0]?.stars || 0;
  return k ? [upLevel(lv, s, Math.min(6, s + k)), Math.min(6, s + k)] : [lv, s]; };
export function zoneStages(z: ZoneDef, zi: number): StageDef[] {
  const g = ZONE_GEN[z.id], out: StageDef[] = [], [p0, p1] = ZONE_PLAN[z.id];
  for (let n = 1; n <= 5; n++) {
    const waves: EnemyRef[][] = [], lv = Math.round(p0 + (p1 - p0) * (n - 1) / 4), k = g.k[n - 1], mult = k === 1 ? {} : { hpMult: k, atkMult: k };
    WAVE_PAT[n - 1].forEach((pat, w) => {
      const wave: EnemyRef[] = pat.map(i => ({ sid: g.pool[i % g.pool.length], lvl: lv + (w === 2 && n < 5 ? 1 : 0), stars: g.grade, ...mult }));
      if (g.rare && n === 4 && w === 2 && RARE_FORMS[wave[1].sid]) wave[1].rare = true; // a light/dark rare form guards the last wave
      if (n === 5 && w === 2) { if (g.duel) wave.length = 1; wave.splice(1, 0, { ...g.boss, lvl: lv + 3 }); }
      waves.push(wave);
    });
    const boss = n === 5, gold = Math.round((250 + 110 * zi + 35 * n) * (boss ? 1.6 : 1) / 10) * 10, exp = Math.round((120 + 50 * zi + 18 * n) * (boss ? 1.4 : 1));
    out.push({ id: `${z.id}-${n}`, zone: z.id, n, realm: z.realm, loc: z.loc, name: z.name, desc: boss ? g.bossDesc : z.desc, stamina: 3 + Math.floor(zi / 2) + (boss ? 2 : 0), reward: { gold, exp }, waves });
  }
  return out;
}
export const STAGES: StageDef[] = ZONES.flatMap(zoneStages);
/** pre-zone saves (2026-10-13 and before) used one stage per place: '1-1'..'3-6' → that place's zone */
export const LEGACY_STAGE_ZONE: Record<string, string> = { '1-1': 'meadow', '1-2': 'stream', '1-3': 'rootnest', '2-1': 'goldforest', '2-2': 'ricefield', '2-3': 'village', '2-4': 'kinnari', '2-5': 'temple', '2-6': 'nagapool', '3-1': 'jade', '3-2': 'palace', '3-3': 'foxvalley', '3-4': 'toadbridge', '3-5': 'heaven', '3-6': 'firecave' };
/** Energy (พลังงาน) — only AUTO battles spend it (manual play is free, owner 2026-10-13): AUTO costs the stage's
 *  `stamina`; refills 1 point every 5 minutes (full bar ≈ 5 h), offline too */
export const ENERGY_MAX = 60, ENERGY_REGEN_MS = 5 * 60 * 1000;
/** gem refill (owner 2026-10-13): +ENERGY_MAX per refill (may pass the cap, like SW), a few per local day */
export const ENERGY_REFILL_GEMS = 30, ENERGY_REFILL_DAILY = 3;
/** Starborn shards (เศษไข่ดารา): a Starborn zone boss drops one on the first clear, then STAR_SHARD_CHANCE per win;
 *  STAR_SHARDS_TO_CRAFT build the egg (owner's choice 2026-10-13: 5% · 40 — a long farm, ~800 wins on average) */
export const STAR_SHARD_CHANCE = 0.05, STAR_SHARDS_TO_CRAFT = 40;
/** the Starborn boss of a stage (only boss stages have one) */
export const starbornOf = (st: StageDef) => st.waves.flat().find(m => SPECIES[m.sid]?.starborn)?.sid;
/** special-edition shards (เศษไข่พิเศษ): the base species' zone boss drops one on the first clear of each difficulty,
 *  then SPECIAL_SHARD_CHANCE[difficulty] per win; SPECIAL_SHARDS_TO_CRAFT build the egg (owner 2026-10-14: a rare drop) */
export const SPECIAL_SHARD_CHANCE = [0.04, 0.06, 0.08, 0.12], SPECIAL_SHARDS_TO_CRAFT = 20;
export const specialOf = (st: StageDef) => { const b = st.waves.flat().find(m => m.boss && !SPECIES[m.sid]?.starborn); return b ? Object.values(SPECIES).find(x => x.special === b.sid)?.id : undefined; };
/** shard-only species (Starborn, special editions): never in mystery eggs, no fragments, no rare form */
export const shardOnly = (s?: { starborn?: boolean; special?: string }) => !!(s && (s.starborn || s.special));
export const shardsToCraft = (sid: string) => SPECIES[sid]?.special ? SPECIAL_SHARDS_TO_CRAFT : STAR_SHARDS_TO_CRAFT;

// Stats, Summoners-War style: each star grade has its own level cap; evolving (★+1) resets the level to 1 at a slightly
// lower multiplier than the previous grade's max, so a max-level evolve is always a big step up. ★6 max ≈ 8× ★1 Lv1.
export const STAR_CAP = [0, 15, 20, 25, 30, 35, 40];
export const STAR_MUL: [number, number][] = [[1, 1], [1, 1.6], [1.5, 2.3], [2.15, 3.2], [3, 4.4], [4.1, 6], [5.6, 8.2]];
export const levelCap = (stars: number) => STAR_CAP[Math.max(1, Math.min(6, stars))];
export function statMul(lvl: number, stars: number): number {
  const s = Math.max(1, Math.min(6, stars)), [lo, hi] = STAR_MUL[s], cap = STAR_CAP[s];
  return lo + (hi - lo) * (Math.min(lvl, cap) - 1) / (cap - 1);
}
export function statAt(base: number, lvl: number, stars: number): number { return Math.round(base * statMul(lvl, stars)); }
export function spdAt(base: number, lvl: number, stars: number): number {
  return base + (stars - 1) * 3 + Math.floor(lvl / 10);
}
export const expToNext = (lvl: number) => 40 + lvl * 25;
// Gems (เพชร, premium currency — given by the adventure book for now): buy a gold mystery egg, rush an incubating egg.
export const GEM_GOLD_EGG = 100;
// Rushing an incubating egg (เร่งบ่มไข่): each rush costs the tier's base × the day's step, so rushing many eggs in one day
// gets steadily dearer (anti-whale) — the ladder starts over at local midnight. A part-done egg pays the share of its
// incubation still left (rounded up, at least 1). Gold: 10 · 12 · 14 · 16 · 20 · 24 · 30 · 36 · 45 · 55 · 70 · 85 · 100 (cap).
export const RUSH_BASE: Record<string, number> = { gold: 10, rainbow: 30 };
export const RUSH_STEP = [1, 1.2, 1.4, 1.6, 2, 2.4, 3, 3.6, 4.5, 5.5, 7, 8.5, 10]; // 1st, 2nd, ... rush of the day; then stays
// Power-up (เพิ่มเลเวล): feed up to FEED_MAX unwanted monsters; each gives EXP by its level and stars:
// FEED_K × (EXP it took to reach its level) + FEED_BASE × stars². Costs FEED_GOLD per food level.
export const FEED_MAX = 5, FEED_K = 0.8, FEED_BASE = 60, FEED_GOLD = 10;
export const cumExp = (lvl: number) => 40 * (lvl - 1) + 25 * (lvl - 1) * lvl / 2; // total EXP from Lv1 to lvl
// Evolution (อัปดาว): a max-level monster + `stars` food monsters of the same star grade (any species, any level) + gold.
export const EVO_GOLD = [0, 600, 2000, 6000, 16000, 40000]; // by current stars · doubled 2026-10-14 (owner: evolving cost too little gold)
// Skill levels: feeding a copy of the same species = +1 to a random skill that isn't maxed (a soul crystal works on anyone).
// Each level: +SKILL_STEP to damage multiplier and heal/shield/drain values; the max level of a cooldown skill also cuts 1 turn.
export const SKILL_MAX = [5, 4, 3];
export const SKILL_STEP = 0.1;
/** a rare-form LEGENDARY (hatches ★6, the rarest unit) gets a mythic ultimate: more power, one turn less cooldown */
export const MYTHIC_ULT = { mult: 1.2, cd: -1 };
export const isMythic = (sid: string, rare: boolean) => rare && SPECIES[sid]?.rarity === 'legendary';
export function mythicUlt(k: SkillDef): SkillDef {
  return { ...k, mult: k.mult * MYTHIC_ULT.mult, cd: Math.max(2, k.cd + MYTHIC_ULT.cd),
    effects: k.effects.map(e => (e.kind === 'heal' || e.kind === 'shield' || e.kind === 'drain') && e.value ? { ...e, value: e.value * MYTHIC_ULT.mult } : e) };
}
export function skillAt(k: SkillDef, lv: number, slot: number): SkillDef {
  if (!lv || lv <= 1) return k;
  const f = 1 + SKILL_STEP * (Math.min(lv, SKILL_MAX[slot]) - 1), max = lv >= SKILL_MAX[slot];
  return { ...k, mult: k.mult * f, cd: max && k.cd > 2 ? k.cd - 1 : k.cd,
    effects: k.effects.map(e => (e.kind === 'heal' || e.kind === 'shield' || e.kind === 'drain') && e.value ? { ...e, value: e.value * f } : e) };
}
export const NAT_STARS: Record<Rarity, number> = { common: 1, rare: 2, epic: 4, legendary: 5 }; // epic ★4 · legendary ★5 (decided 2026-10-13)
export const MAX_STARS = 6;
/** stars a monster hatches with: by rarity, +1 for the rare form (stronger, so it starts a grade higher), max ★6 */
export const natStars = (sid: string, rare = false) => Math.min(6, (NAT_STARS[SPECIES[sid]?.rarity] || 1) + (rare ? 1 : 0) + (SPECIES[sid]?.special ? 1 : 0));
/** evolved-form names (owner 2026-10-14: odd Thai + foreign mixes), shown with the evolved art — add one when a species'
 *  evolved art (`mon<ID>e_*`) is imported, so a name never shows up on the old picture. Rare forms share it. */
export const EVO_NAME: Record<string, [string, string]> = {
  A01: ['อรุณโซลาริส', 'Arun Solaris'], A02: ['ควีนมุกธารา', 'Queen Mukthara'], A03: ['วายุเทมเปสต์', 'Vayu Tempest'],
  A04: ['มรกตโคลอสซัส', 'Morakot Colossus'], A05: ['นภาสเตลลาร์', 'Nabha Stellar'], A06: ['ไมโครากษส', 'Myco Raksha'],
  B05: ['พยัคฆ์เบอร์เซิร์ก', 'Phayak Berserk'],
};
/** raised past its natural stars to ★5+ = the evolved form (the same rule as the evolved art, `lookOf` in assets.ts) */
export const isEvolved = (sid: string, stars: number, rare = false) => stars >= 5 && stars > natStars(sid, rare);
export const monName = (sid: string, stars = 0, rare = false) => (isEvolved(sid, stars, rare) && EVO_NAME[sid]?.[0]) || SPECIES[sid].name;
/** hell enemies are awakened: the evolved name when the species has evolved art, else "<name> ทมิฬ" (deep-purple form) */
export const awakeName = (sid: string, title?: string) => EVO_NAME[sid]?.[0] || (title || SPECIES[sid].name) + ' ทมิฬ';

// ---- eggs (P1 M0) ----
// Mystery egg: species unknown until it hatches; only the shell pattern (tier) shows the rarity.
// Every hatch is a new monster at its natural stars (NAT_STARS by rarity); copies are food for skill-ups / evolution.
// incubateMin > 0 → must sit in a hatchery slot that long (scaled by hatchery speed) before it can hatch.
export type EggTier = 'common' | 'silver' | 'gold' | 'rainbow';
export interface EggTierDef { name: string; incubateMin: number; rareForm: number; rarityW: Partial<Record<Rarity, number>>; legendW: number } // legendW: % chance of a shard-only legend (Starborn / special)
export const EGG_TIER_ORDER: EggTier[] = ['common', 'silver', 'gold', 'rainbow'];
// rarityW = % chance of each monster rarity: every tier can roll every rarity — cheap shells low odds, rarer shells better odds.
// Tuned to an epic:legendary ratio of ~18:1 per egg (SW Mystical Scroll nat4:nat5 is 16:1); see `npm run rates`.
export const EGG_TIERS: Record<EggTier, EggTierDef> = {
  // owner 2026-10-14: EVERY mystery egg can hatch EVERY monster, the rarer ones very rarely — rainbow eggs now hold
  // commons too (5%), and Starborn legends / special editions (shard-only until now) hatch at `legendW` %
  common: { name: 'ลายธรรมดา', incubateMin: 0, rareForm: 0.03, rarityW: { common: 90, rare: 8.5, epic: 1.45, legendary: 0.05 }, legendW: 0.02 },
  silver: { name: 'ลายเงิน', incubateMin: 0, rareForm: 0.04, rarityW: { common: 66, rare: 28, epic: 5.8, legendary: 0.2 }, legendW: 0.06 },
  gold: { name: 'ลายทอง', incubateMin: 120, rareForm: 0.05, rarityW: { common: 25, rare: 50, epic: 23.5, legendary: 1.5 }, legendW: 0.4 },
  rainbow: { name: 'ลายรุ้ง', incubateMin: 480, rareForm: 0.08, rarityW: { common: 5, rare: 38, epic: 51, legendary: 6 }, legendW: 1.5 },
};
/** stage drop: one roll per win (first clear always drops). pity = the Nth mystery egg in a row without gold+ is forced gold+ */
export const EGG_DROP = { chance: 0.3, bossChance: 0.6, tierW: { common: 68, silver: 24, gold: 7, rainbow: 1 } as Record<EggTier, number>, pity: 20 };

// ---- Difficulty (ระดับ ง่าย · ปานกลาง · ยาก — owner 2026-10-14): every stage can be played at three difficulties with no
// new art. Easy = the base stage (old saves keep their progress). Normal/Hard are the same fight one/two star grades up:
// every enemy +stars and its level moved to the same place in the new grade's level range — so the recommended team is
// the easy plan +stars too and the sim win rates stay alike. A difficulty opens zone by zone: beat the zone boss one
// difficulty below. Rewards grow with it (gold, EXP, better mystery-egg shells, more fragments, Starborn shard chance).
export interface DiffDef { key: string; name: string; short: string; col: string; stars: number; gold: number; exp: number; stamina: number; frag: number; shard: number; tierW: Record<EggTier, number> }
export const DIFFS: DiffDef[] = [
  { key: '', name: 'ง่าย', short: 'ง่าย', col: '#6bdc8a', stars: 0, gold: 1, exp: 1, stamina: 0, frag: 0, shard: STAR_SHARD_CHANCE, tierW: EGG_DROP.tierW },
  { key: 'n', name: 'ปานกลาง', short: 'กลาง', col: '#ffcf5a', stars: 1, gold: 1.6, exp: 1.5, stamina: 2, frag: 1, shard: 0.075, tierW: { common: 50, silver: 34, gold: 13, rainbow: 3 } },
  { key: 'h', name: 'ยาก', short: 'ยาก', col: '#ff6b6b', stars: 2, gold: 2.4, exp: 2.2, stamina: 4, frag: 2, shard: 0.1, tierW: { common: 30, silver: 40, gold: 24, rainbow: 6 } },
  // นรก (owner 2026-10-14: "สุดโหด", at least 4 monsters every wave): ★+3, enemies wear runes (HELL_RUNES) — needs runed teams
  { key: 'x', name: 'นรก', short: 'นรก', col: '#c45cff', stars: 3, gold: 3.5, exp: 3, stamina: 6, frag: 3, shard: 0.15, tierW: { common: 15, silver: 40, gold: 33, rainbow: 12 } },
];
/** stage key for a difficulty: easy keeps the plain id (save compatible), others `<id>@n` / `<id>@h` */
export const stageKey = (id: string, d = 0) => d ? `${id}@${DIFFS[d].key}` : id;
export const parseStage = (key: string) => { const [id, k] = key.split('@'); const d = k ? DIFFS.findIndex(x => x.key === k) : 0; return { id, d: d < 0 ? 0 : d }; };
/** a level moved into a higher star grade, keeping its place in the grade's level range */
const upLevel = (lvl: number, s0: number, s1: number) => Math.max(1, Math.min(levelCap(s1), Math.round(lvl * levelCap(s1) / levelCap(s0))));
const scaleRef = (m: EnemyRef, k: number): EnemyRef => { if (!k) return m; const s0 = m.stars || 1, s1 = Math.min(6, s0 + k); return { ...m, stars: s1, lvl: upLevel(m.lvl, s0, s1) }; };
/** extra enemy HP/ATK per stage for [normal, hard, hell] (stages 1–5), tuned by sim so the recommended team (planOf) wins
 *  ~84% → ~74% → boss ~55% on normal and ~80% → ~70% → boss ~50% on hard. Needed because DEF reduces damage
 *  non-linearly (100/(100+DEF)): raising both sides by the same star grade does not keep a fight equally hard.
 *  Hell (made harder 2026-10-14, owner: "not hard enough" → awakened enemies): the recommended team wearing the BEST
 *  rune kit (★6 +12) wins only ~35% → ~20% → boss ~10% (the enemies' own kit ≈ 10–25%, no runes ≈ 0%); mostly below 1 in
 *  realms 2–3 because every hell wave has 4 runed monsters (12 per stage against our 4). */
export const DIFF_K: Record<string, number[][]> = {
  meadow: [[1.07, 1.01, 1.05, 1.12, 0.93], [1.08, 1.1, 1.1, 1.1, 0.92], [0.94, 1.08, 1.2, 1.33, 0.97]],
  stream: [[1.07, 1.07, 1.06, 1.05, 1.03], [1.07, 1.16, 1.06, 1.16, 1.03], [1.23, 1.25, 1.18, 1.39, 1.1]],
  rootnest: [[1.08, 1.04, 1.06, 1.02, 1.14], [1.2, 1.18, 1.16, 1.12, 1.15], [0.88, 0.98, 1.17, 0.92, 0.92]],
  goldforest: [[1.02, 1.08, 1.06, 1.1, 0.87], [1.04, 1.17, 1.12, 1.12, 0.78], [0.69, 0.84, 0.83, 0.88, 0.62]],
  ricefield: [[1.1, 1.17, 1.07, 1.11, 0.94], [1.25, 1.38, 1.06, 1.12, 0.85], [0.61, 0.79, 0.63, 0.63, 0.53]],
  village: [[1.03, 1.06, 1.07, 1.03, 1.12], [1.08, 1.17, 1.18, 1.13, 1.21], [0.67, 0.77, 0.92, 0.81, 0.94]],
  kinnari: [[1.11, 1.08, 1.13, 1.1, 0.91], [1.2, 1.21, 1.29, 1.28, 0.78], [0.94, 0.91, 1.23, 1.06, 0.81]],
  temple: [[1.12, 1.04, 1.06, 1.1, 1.1], [1.24, 1.25, 1.11, 1.14, 1.16], [0.65, 0.77, 0.83, 0.91, 0.77]],
  nagapool: [[0.84, 0.92, 1.03, 1.1, 0.95], [0.7, 0.84, 0.95, 1.05, 0.83], [0.36, 0.38, 0.53, 0.58, 0.41]],
  jade: [[0.99, 0.99, 0.95, 0.9, 0.97], [1.03, 0.95, 0.94, 0.78, 0.91], [0.27, 0.34, 0.36, 0.3, 0.29]],
  palace: [[0.99, 1.11, 1.02, 1.06, 1.12], [1.05, 1.13, 0.92, 1.14, 1.17], [0.37, 0.45, 0.33, 0.46, 0.44]],
  foxvalley: [[0.87, 0.96, 0.96, 1.04, 0.92], [0.7, 0.81, 0.86, 0.95, 0.77], [0.2, 0.22, 0.27, 0.4, 0.26]],
  toadbridge: [[0.93, 0.9, 0.91, 0.99, 0.98], [0.78, 0.76, 0.77, 0.85, 0.92], [0.26, 0.24, 0.29, 0.35, 0.34]],
  heaven: [[0.87, 0.94, 1.01, 0.98, 0.85], [0.7, 0.76, 0.83, 0.88, 0.66], [0.16, 0.18, 0.26, 0.25, 0.18]],
  firecave: [[0.99, 0.98, 1.02, 1.05, 0.9], [0.88, 0.92, 0.99, 0.95, 0.72], [0.21, 0.22, 0.31, 0.27, 0.21]]
};
const DCACHE: Record<string, StageDef> = {};
/** the stage behind a key (any difficulty) */
export function stageOf(key: string): StageDef | undefined {
  const { id, d } = parseStage(key), base = STAGES.find(x => x.id === id);
  if (!base || !d) return base;
  if (DCACHE[key]) return DCACHE[key];
  const D = DIFFS[d], hell = d === HELL, realm = Math.max(1, Math.min(3, +base.realm || 1));
  return (DCACHE[key] = { ...base, id: key, diff: d, stamina: base.stamina + D.stamina,
    reward: { gold: Math.round(base.reward.gold * D.gold / 10) * 10, exp: Math.round(base.reward.exp * D.exp) },
    waves: (hell ? hellWaves(base) : base.waves).map(w => w.map(m => { const r = scaleRef(m, D.stars), k = DIFF_K[base.zone]?.[d - 1]?.[base.n - 1] ?? 1, out = k === 1 ? r : { ...r, hpMult: (r.hpMult || 1) * k, atkMult: (r.atkMult || 1) * k };
      return hell ? { ...out, awake: true, rb: kitBonus(SPECIES[m.sid].role, HELL_RUNES.star[realm - 1], HELL_RUNES.lvl[realm - 1], !!(m.boss || SPECIES[m.sid].boss)) } : out; })) });
}
/** hell: every wave has at least HELL_MIN monsters (the zone's own pool fills the gaps, at the wave's level) */
export const HELL = 3, HELL_MIN = 4;
/** the runes hell enemies wear, by realm: rune star and level (epic, a role kit: see kitRunes in runes.ts) */
export const HELL_RUNES = { star: [4, 5, 6], lvl: [6, 9, 12] };
function hellWaves(base: StageDef): EnemyRef[][] {
  const g = ZONE_GEN[base.zone];
  return base.waves.map((w, wi) => { const out = [...w], t = w.find(m => !m.boss && !SPECIES[m.sid]?.boss) || w[0];
    for (let i = 0; out.length < HELL_MIN; i++) out.push({ sid: g.pool[(base.n + wi + i + 1) % g.pool.length], lvl: t.lvl, stars: g.grade, ...(t.hpMult ? { hpMult: t.hpMult, atkMult: t.atkMult } : {}) });
    return out; });
}
/** named egg (crafted from fragments): species known, and the best rare-form odds in the game — about twice the best
 *  mystery egg (rainbow 8%) before the species multiplier, so collecting a monster's fragments is the way to hunt its
 *  rare form (decided 2026-10-13): common 15% · rare 12% · epic 7.5% · legendary 3.75% */
export const NAMED_RARE_FORM = 0.15;
/** the rare form gets rarer the higher the species' rarity (a rare-form legendary hatches at ★6 — the rarest thing in the game).
 *  chance = egg's rareForm (or NAMED_RARE_FORM) × this; e.g. rainbow egg → legendary rare form = 6% × 8% × 0.25 ≈ 1 in 830 rainbow eggs */
export const RARE_FORM_MULT: Record<Rarity, number> = { common: 1, rare: 0.8, epic: 0.5, legendary: 0.25 };
export const rareFormChance = (base: number, sid: string) => base * (RARE_FORM_MULT[SPECIES[sid]?.rarity] ?? 1);

// ---- stage-end treasure chest: light colour = best item inside ----
export type LootGrade = 'common' | 'rare' | 'epic' | 'legendary';
export const LOOT_ORDER: LootGrade[] = ['common', 'rare', 'epic', 'legendary'];
export const LOOT_GRADES: Record<LootGrade, { name: string; col: string }> = {
  common: { name: 'ธรรมดา', col: '#fff0c8' },     // warm white — gold / egg shards only
  rare: { name: 'หายาก', col: '#5fb8ff' },        // blue — plain or silver mystery egg
  epic: { name: 'มหากาพย์', col: '#c27bff' },     // purple — gold mystery egg
  legendary: { name: 'ตำนาน', col: '#ffcf4a' },   // gold + rainbow — rainbow egg (monster cards in M4 go here too)
};
export const EGG_LOOT_GRADE: Record<EggTier, LootGrade> = { common: 'rare', silver: 'rare', gold: 'epic', rainbow: 'legendary' };
