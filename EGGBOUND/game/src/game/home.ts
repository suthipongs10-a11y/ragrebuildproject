// Turtle home (เต่าบรรพกาล): buildings, upgrades, idle production, shrine buffs, relics.
import type { Elem, HomeMods, RelicId } from '../core/types';
import type { SaveData, EggSave } from './save';
import { EGG_TIERS } from '../core/data';

export type BId = 'castle' | 'gate' | 'hatchery' | 'mine' | 'shrine' | 'altar' | 'forge' | 'arena';
export interface BuildingDef { id: BId; name: string; desc: string; max: number; unlock: number; pos: [number, number]; r: number; soon?: string }

/** positions are on the shell top at castle stage 4 (world units); they scale with the turtle */
export const BUILDINGS: BuildingDef[] = [
  { id: 'castle', name: 'ป้อมพันธสัญญา', desc: 'บ้านของผู้พิทักษ์ไข่ อัปเลเวลแล้วเต่าจะโตขึ้น ปลดล็อกอาคารใหม่ และเพิ่มเพดานเลเวลอาคารอื่น', max: 4, unlock: 1, pos: [0, -78], r: 92 },
  { id: 'gate', name: 'ประตูภพ', desc: 'ประตูสู่ภพต่างๆ แตะเพื่อเลือกด่าน', max: 1, unlock: 1, pos: [-318, 30], r: 62 },
  { id: 'hatchery', name: 'รังฟักไข่', desc: 'ไข่ปริศนาลายทองขึ้นไปต้องบ่มที่นี่ก่อนฟัก อัปเลเวลเพื่อเพิ่มช่องบ่มและบ่มเร็วขึ้น', max: 3, unlock: 1, pos: [300, 38], r: 60 },
  { id: 'mine', name: 'เหมืองผลึกดาว', desc: 'ผลิตทองตลอดเวลาแม้ปิดเกม แตะเพื่อเก็บ อัปเลเวลเพื่อผลิตเร็วขึ้นและเก็บได้มากขึ้น', max: 5, unlock: 1, pos: [-150, 118], r: 58 },
  { id: 'shrine', name: 'ศาลหกธาตุ', desc: 'บูชาธาตุเพื่อรับพลังถาวร: มอนธาตุนั้น ATK เพิ่ม และปฏิกิริยาที่จุดด้วยธาตุนั้นแรงขึ้น', max: 1, unlock: 1, pos: [-232, -100], r: 62 },
  { id: 'altar', name: 'แท่นวัตถุศักดิ์สิทธิ์', desc: 'สร้างวัตถุศักดิ์สิทธิ์แล้วเลือกพกเข้าต่อสู้ได้ทีมละ 1 ชิ้น ทำงานเป็นสกิลติดตัวของทั้งทีม', max: 1, unlock: 1, pos: [228, -102], r: 58 },
  { id: 'forge', name: 'โรงตีอุปกรณ์', desc: 'สุ่มและตีบวกอุปกรณ์มอน', max: 1, unlock: 2, pos: [150, 126], r: 58, soon: 'มาใน P1 (ระบบอุปกรณ์มอน)' },
  { id: 'arena', name: 'ลานประลอง', desc: 'ประลองกับทีมของผู้เล่นอื่น (อารีน่า)', max: 1, unlock: 3, pos: [0, 168], r: 64, soon: 'มาใน P1 (อารีน่ากับบอท)' },
];
export const BDEF = Object.fromEntries(BUILDINGS.map(b => [b.id, b])) as Record<BId, BuildingDef>;

export const CASTLE_COST = [0, 0, 1500, 4000, 9000];          // cost to reach level n
export const TURTLE_SCALE = [0, 0.74, 0.84, 0.94, 1.04];       // turtle size per castle level
export const MINE_RATE = [0, 6, 10, 16, 24, 34];               // gold per minute
export const MINE_CAP_MIN = [0, 120, 150, 180, 240, 300];      // storage in minutes of production
export const MINE_COST = [0, 0, 600, 1400, 3000, 6000];
export const HATCH_COST = [0, 0, 1200, 3500];
export const HATCH_SPEED = [0, 1, 0.8, 0.65];                // incubation time multiplier per hatchery level (slots = level)
export const SHRINE_COST = [0, 300, 700, 1400, 2600, 4500];    // cost to reach level n
export const SHRINE_ATK = 0.03, SHRINE_REACT = 0.08;           // per level
export const ELEMS: Elem[] = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];

export interface RelicDef { id: RelicId; name: string; desc: string; cost: number; unlock: number }
export const RELICS: RelicDef[] = [
  { id: 'sun', name: 'ตราสุริยัน', desc: 'เริ่มต่อสู้ ทั้งทีมได้ ATK ขึ้น 2 เทิร์น', cost: 0, unlock: 1 },
  { id: 'feather', name: 'ขนนกวายุ', desc: 'เริ่มต่อสู้ ทั้งทีมได้เกจเทิร์น +30%', cost: 800, unlock: 1 },
  { id: 'shell', name: 'เกล็ดกระดองบรรพกาล', desc: 'เริ่มต่อสู้ ทั้งทีมได้โล่ 15% ของ HP', cost: 1500, unlock: 2 },
  { id: 'gourd', name: 'น้ำเต้าอมฤต', desc: 'ทุกครั้งที่เริ่มเวฟใหม่ ทั้งทีมฟื้น HP 10%', cost: 2500, unlock: 3 },
];

export interface Incub { id: number; tier?: string; start: number; end: number }   // egg id, shell tier (for the nest drawing), timestamps (ms)
export interface HomeSave { castle: number; lv: Record<string, number>; shrine: Record<string, number>; relics: RelicId[]; relic: RelicId | null; mineAt: number; incub: Incub[] }
export function newHome(now = Date.now()): HomeSave {
  return { castle: 1, lv: { gate: 1, hatchery: 1, mine: 1, shrine: 1, altar: 1, forge: 0, arena: 0 }, shrine: Object.fromEntries(ELEMS.map(e => [e, 0])), relics: ['sun'], relic: 'sun', mineAt: now - 45 * 60000, incub: [] };
}
export function home(s: SaveData): HomeSave { const a = s as any; if (!a.home) a.home = newHome(); if (!a.home.incub) a.home.incub = []; return a.home; }

export const unlocked = (s: SaveData, id: BId) => home(s).castle >= BDEF[id].unlock;
export function maxLevelNow(s: SaveData, id: BId) { const h = home(s); return id === 'castle' ? 4 : Math.min(BDEF[id].max, h.castle + 1); }
export function upgradeCost(s: SaveData, id: BId): number | null {
  const h = home(s), lv = id === 'castle' ? h.castle : h.lv[id] || 0;
  if (lv >= BDEF[id].max) return null;
  if (id === 'castle') return CASTLE_COST[lv + 1];
  if (id === 'mine') return MINE_COST[lv + 1];
  if (id === 'hatchery') return HATCH_COST[lv + 1];
  return null;
}
export function upgrade(s: SaveData, id: BId): boolean {
  const h = home(s), c = upgradeCost(s, id);
  if (c == null || s.gold < c) return false;
  if (id !== 'castle' && (h.lv[id] || 0) >= maxLevelNow(s, id)) return false;
  if (id === 'mine') collectMine(s); // bank production at the old rate first
  s.gold -= c;
  if (id === 'castle') { h.castle++; for (const b of BUILDINGS) if (b.unlock === h.castle && !b.soon && !h.lv[b.id]) h.lv[b.id] = 1; }
  else h.lv[id] = (h.lv[id] || 0) + 1;
  return true;
}

// ---- mine ----
export function mineStored(s: SaveData, now = Date.now()) {
  const h = home(s), lv = h.lv.mine || 1, mins = Math.min(MINE_CAP_MIN[lv], Math.max(0, (now - h.mineAt) / 60000));
  return Math.floor(mins * MINE_RATE[lv]);
}
export const mineCap = (s: SaveData) => { const lv = home(s).lv.mine || 1; return MINE_RATE[lv] * MINE_CAP_MIN[lv]; };
export function collectMine(s: SaveData, now = Date.now()) { const g = mineStored(s, now); s.gold += g; home(s).mineAt = now; return g; }

// ---- shrine ----
export const shrineMax = (s: SaveData) => Math.min(5, home(s).castle + 1);
export function shrineCost(s: SaveData, e: Elem) { const l = home(s).shrine[e] || 0; return l >= 5 ? null : SHRINE_COST[l + 1]; }
export function shrineUp(s: SaveData, e: Elem) {
  const h = home(s), c = shrineCost(s, e);
  if (c == null || s.gold < c || (h.shrine[e] || 0) >= shrineMax(s)) return false;
  s.gold -= c; h.shrine[e] = (h.shrine[e] || 0) + 1; return true;
}

// ---- relics ----
export function buyRelic(s: SaveData, id: RelicId) {
  const h = home(s), r = RELICS.find(x => x.id === id)!;
  if (h.relics.includes(id) || h.castle < r.unlock || s.gold < r.cost) return false;
  s.gold -= r.cost; h.relics.push(id); h.relic = id; return true;
}
export function equipRelic(s: SaveData, id: RelicId | null) { const h = home(s); if (id && !h.relics.includes(id)) return false; h.relic = id; return true; }

/** modifiers handed to Battle. pvp=true halves shrine values (PvP rule from the design). */
export function homeMods(s: SaveData, pvp = false): HomeMods {
  const h = home(s), k = pvp ? 0.5 : 1, elemAtk: HomeMods['elemAtk'] = {}, react: HomeMods['react'] = {};
  for (const e of ELEMS) { const l = h.shrine[e] || 0; if (l) { elemAtk[e] = l * SHRINE_ATK * k; react[e] = l * SHRINE_REACT * k; } }
  return { elemAtk, react, relic: h.relic };
}

// ---- hatchery incubation (mystery eggs gold+) ----
export const needsIncub = (e: EggSave) => e.kind === 'mystery' && !!e.tier && EGG_TIERS[e.tier].incubateMin > 0;
export const incubSlots = (s: SaveData) => home(s).lv.hatchery || 1;
/** incubation length in ms for this egg at the current hatchery level */
export function incubMs(s: SaveData, e: EggSave) { return needsIncub(e) ? Math.round(EGG_TIERS[e.tier!].incubateMin * 60000 * HATCH_SPEED[incubSlots(s)]) : 0; }
export const incubOf = (s: SaveData, eggId: number) => home(s).incub.find(x => x.id === eggId) || null;
export function startIncub(s: SaveData, eggId: number, now = Date.now()) {
  const h = home(s), e = s.eggs.find(x => x.id === eggId);
  if (!e || !needsIncub(e) || incubOf(s, eggId) || h.incub.length >= incubSlots(s)) return false;
  h.incub.push({ id: eggId, tier: e.tier, start: now, end: now + incubMs(s, e) }); return true;
}
/** ms left (0 = ready) for an egg in a slot; null if it is not incubating */
export function incubLeft(s: SaveData, eggId: number, now = Date.now()) { const x = incubOf(s, eggId); return x ? Math.max(0, x.end - now) : null; }
export function canHatch(s: SaveData, e: EggSave, now = Date.now()) { return !needsIncub(e) || incubLeft(s, e.id, now) === 0; }
export function endIncub(s: SaveData, eggId: number) { const h = home(s); h.incub = h.incub.filter(x => x.id !== eggId); }
