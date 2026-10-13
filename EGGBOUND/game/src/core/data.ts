// P0 game data: 6 starters + realm boss + 3 stages of "ทุ่งไข่ป่วน".
// All numbers are starting values for playtest (see GAME_CONFIG_v2.json).
import type { SpeciesDef, StageDef, Elem, Rarity, SkillDef } from './types';

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
  B07: {
    id: 'B07', art: 'monB07', name: 'คชสีห์', nameEn: 'Gajasimha', elem: 'light', role: 'Defender', rarity: 'epic',
    base: { hp: 1260, atk: 104, def: 94, spd: 101 },
    leader: { stat: 'def', value: 0.22, text: 'DEF ทั้งทีม +22%' },
    rarePassive: { kind: 'counter', chance: 0.3, value: 0.8, name: 'งาสวนกลับ', desc: 'ถูกโจมตี 30% สวนกลับด้วยสกิล 1 (พลัง 80%)' },
    skills: [
      { id: 'gaja_tusk', name: 'ตะปบงา', desc: 'ตะปบ 1 ตัว 60% ติดเครื่องหมายแสง', cd: 0, target: 'enemy', mult: 1.05, effects: [{ kind: 'mark', elem: 'light', chance: 0.6 }], anim: 'melee' },
      { id: 'gaja_roar', name: 'คำรามคชสีห์', desc: 'ทุกตัว 50% ลด ATK 2 เทิร์น', cd: 3, target: 'enemyAll', mult: 0.55, effects: [{ kind: 'status', status: 'atk_down', turns: 2, chance: 0.5 }], anim: 'volley' },
      { id: 'gaja_divine', name: 'งาเทวะ', desc: 'โล่ทั้งทีม 22% + เพิ่ม DEF 2 เทิร์น', cd: 4, target: 'allyAll', mult: 0, effects: [{ kind: 'shield', value: 0.22, turns: 2, to: 'allies' }, { kind: 'status', status: 'def_up', turns: 2, to: 'allies' }], anim: 'ult_starlight', ult: true },
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
  BOSS_ROOT: {
    id: 'BOSS_ROOT', name: 'อสูรรากไม้ยักษ์', nameEn: 'Giant Rootwalker', elem: 'earth', role: 'Defender', rarity: 'epic', boss: true, scale: 1.3, art: 'monA09',
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
      [{ sid: 'A03', lvl: 6, stars: 1 }, { sid: 'A02', lvl: 8, stars: 1 }, { sid: 'A04', lvl: 6, stars: 1 }],
    ] },
  { id: '1-3', name: 'รังรากไม้', desc: 'บอสอสูรรากไม้ยักษ์ ระวังรากรัดทำให้มึน', stamina: 6,
    reward: { gold: 800, exp: 340 },
    waves: [
      [{ sid: 'A06', lvl: 8, stars: 1 }, { sid: 'A06', lvl: 8, stars: 1 }, { sid: 'A04', lvl: 8, stars: 1 }],
      [{ sid: 'A04', lvl: 8, stars: 1 }, { sid: 'A05', lvl: 8, stars: 1 }, { sid: 'A01', lvl: 8, stars: 1 }],
      [{ sid: 'A06', lvl: 8, stars: 1 }, { sid: 'BOSS_ROOT', lvl: 14, stars: 1, hpMult: 5, atkMult: 0.95 }, { sid: 'A06', lvl: 8, stars: 1 }],
    ] },
];

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
export const GEM_PER_10MIN = 1; // rushing an egg: 1 gem per started 10 minutes left
// Power-up (เพิ่มเลเวล): feed up to FEED_MAX unwanted monsters; each gives EXP by its level and stars:
// FEED_K × (EXP it took to reach its level) + FEED_BASE × stars². Costs FEED_GOLD per food level.
export const FEED_MAX = 5, FEED_K = 0.8, FEED_BASE = 60, FEED_GOLD = 10;
export const cumExp = (lvl: number) => 40 * (lvl - 1) + 25 * (lvl - 1) * lvl / 2; // total EXP from Lv1 to lvl
// Evolution (อัปดาว): a max-level monster + `stars` food monsters of the same star grade (any species, any level) + gold.
export const EVO_GOLD = [0, 300, 1000, 3000, 8000, 20000]; // by current stars
// Skill levels: feeding a copy of the same species = +1 to a random skill that isn't maxed (a soul crystal works on anyone).
// Each level: +SKILL_STEP to damage multiplier and heal/shield/drain values; the max level of a cooldown skill also cuts 1 turn.
export const SKILL_MAX = [5, 4, 3];
export const SKILL_STEP = 0.1;
export function skillAt(k: SkillDef, lv: number, slot: number): SkillDef {
  if (!lv || lv <= 1) return k;
  const f = 1 + SKILL_STEP * (Math.min(lv, SKILL_MAX[slot]) - 1), max = lv >= SKILL_MAX[slot];
  return { ...k, mult: k.mult * f, cd: max && k.cd > 2 ? k.cd - 1 : k.cd,
    effects: k.effects.map(e => (e.kind === 'heal' || e.kind === 'shield' || e.kind === 'drain') && e.value ? { ...e, value: e.value * f } : e) };
}
export const NAT_STARS: Record<Rarity, number> = { common: 1, rare: 2, epic: 4, legendary: 5 }; // epic ★4 · legendary ★5 (decided 2026-10-13)
export const MAX_STARS = 6;
/** stars a monster hatches with: by rarity, +1 for the rare form (stronger, so it starts a grade higher), max ★6 */
export const natStars = (sid: string, rare = false) => Math.min(6, (NAT_STARS[SPECIES[sid]?.rarity] || 1) + (rare ? 1 : 0));

// ---- eggs (P1 M0) ----
// Mystery egg: species unknown until it hatches; only the shell pattern (tier) shows the rarity.
// Every hatch is a new monster at its natural stars (NAT_STARS by rarity); copies are food for skill-ups / evolution.
// incubateMin > 0 → must sit in a hatchery slot that long (scaled by hatchery speed) before it can hatch.
export type EggTier = 'common' | 'silver' | 'gold' | 'rainbow';
export interface EggTierDef { name: string; incubateMin: number; rareForm: number; rarityW: Partial<Record<Rarity, number>> }
export const EGG_TIER_ORDER: EggTier[] = ['common', 'silver', 'gold', 'rainbow'];
// rarityW = % chance of each monster rarity: every tier can roll every rarity — cheap shells low odds, rarer shells better odds.
// Tuned to an epic:legendary ratio of ~18:1 per egg (SW Mystical Scroll nat4:nat5 is 16:1); see `npm run rates`.
export const EGG_TIERS: Record<EggTier, EggTierDef> = {
  common: { name: 'ลายธรรมดา', incubateMin: 0, rareForm: 0.03, rarityW: { common: 90, rare: 8.5, epic: 1.45, legendary: 0.05 } },
  silver: { name: 'ลายเงิน', incubateMin: 0, rareForm: 0.04, rarityW: { common: 66, rare: 28, epic: 5.8, legendary: 0.2 } },
  gold: { name: 'ลายทอง', incubateMin: 120, rareForm: 0.05, rarityW: { common: 25, rare: 50, epic: 23.5, legendary: 1.5 } },
  rainbow: { name: 'ลายรุ้ง', incubateMin: 480, rareForm: 0.08, rarityW: { rare: 40, epic: 54, legendary: 6 } },
};
/** stage drop: one roll per win (first clear always drops). pity = the Nth mystery egg in a row without gold+ is forced gold+ */
export const EGG_DROP = { chance: 0.3, bossChance: 0.6, tierW: { common: 68, silver: 24, gold: 7, rainbow: 1 } as Record<EggTier, number>, pity: 20 };
/** named egg (crafted from fragments): species known, small chance of the rare form (special colour/aura, +1 trait slot later) */
export const NAMED_RARE_FORM = 0.04;

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
