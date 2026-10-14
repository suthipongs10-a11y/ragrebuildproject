// Runes (รูน) — chosen by the owner 2026-10-14 instead of worn equipment (gear on the sprite never looked right): no art
// needed, every icon is drawn in code. 4 slots per monster, sets, random sub stats, +0..+12 upgrades paid in gold (the
// game's main gold sink). Pure data + math: the save/drop/equip layer is game/runes.ts, battle reads `RuneBonus`.
import type { Unit } from './types';

export type RuneStat = 'atk' | 'hp' | 'def' | 'atkP' | 'hpP' | 'defP' | 'spd' | 'crit' | 'cdmg' | 'res' | 'acc';
export type RuneGrade = 'common' | 'rare' | 'epic' | 'legendary';
export type RuneSet = 'fang' | 'shell' | 'vital' | 'eye' | 'gale' | 'storm' | 'blood' | 'sigil';
export type RuneSlot = 1 | 2 | 3 | 4;
/** a rune: main stat value follows star + level (not stored), sub values are rolled and stored · on = monster uid */
export interface Rune { id: number; slot: RuneSlot; set: RuneSet; grade: RuneGrade; star: number; lvl: number; main: RuneStat; subs: { k: RuneStat; v: number }[]; on?: number }

/** values in display units (15 = 15%) · main = value at ★6 +12 · sub = one roll at ★6 · full SW-like strength (owner 2026-10-14:
 *  never weaken the monsters — harder content comes as new maps/stages instead) */
export const RUNE_STATS: Record<RuneStat, { name: string; pct: boolean; main: number; sub: [number, number] }> = {
  atk: { name: 'ATK', pct: false, main: 120, sub: [8, 16] },
  hp: { name: 'HP', pct: false, main: 1800, sub: [100, 200] },
  def: { name: 'DEF', pct: false, main: 120, sub: [8, 16] },
  atkP: { name: 'ATK', pct: true, main: 40, sub: [4, 8] },
  hpP: { name: 'HP', pct: true, main: 40, sub: [4, 8] },
  defP: { name: 'DEF', pct: true, main: 40, sub: [4, 8] },
  spd: { name: 'SPD', pct: false, main: 24, sub: [2, 5] },
  crit: { name: 'คริ', pct: true, main: 35, sub: [3, 6] },
  cdmg: { name: 'คริดาเมจ', pct: true, main: 50, sub: [4, 7] },
  res: { name: 'ต้านทาน', pct: true, main: 40, sub: [4, 8] },
  acc: { name: 'แม่นยำ', pct: true, main: 40, sub: [4, 8] },
};
/** slot 1 = flat ATK, slot 2 = flat HP, slots 3–4 roll their main stat */
export const SLOT_MAIN: Record<RuneSlot, RuneStat[]> = { 1: ['atk'], 2: ['hp'], 3: ['atkP', 'hpP', 'defP', 'spd'], 4: ['atkP', 'hpP', 'defP', 'crit', 'cdmg', 'res', 'acc'] };
export const SLOT_NAME: Record<RuneSlot, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
/** set bonus per completed set (n pieces; two pairs of the same 2-piece set count twice) · b in display units */
export const RUNE_SETS: Record<RuneSet, { name: string; n: 2 | 4; desc: string; col: string; b: Partial<Record<RuneStat | 'spdP' | 'react' | 'leech' | 'mark', number>> }> = {
  fang: { name: 'เขี้ยว', n: 2, desc: 'ATK +15%', col: '#ff6a4a', b: { atkP: 15 } },
  shell: { name: 'กระดอง', n: 2, desc: 'DEF +20%', col: '#3fc6c0', b: { defP: 20 } },
  vital: { name: 'ชีวา', n: 2, desc: 'HP +15%', col: '#66d17e', b: { hpP: 15 } },
  eye: { name: 'เนตร', n: 2, desc: 'คริ +12%', col: '#ffcc3a', b: { crit: 12 } },
  gale: { name: 'วายุ', n: 4, desc: 'SPD +20%', col: '#7fdcff', b: { spdP: 20 } },
  storm: { name: 'อสนี', n: 4, desc: 'ปฏิกิริยาธาตุที่ตัวนี้จุด แรงขึ้น 40%', col: '#b48cff', b: { react: 40 } },
  blood: { name: 'โลหิต', n: 4, desc: 'ดูดเลือด 20% ของดาเมจที่ทำ', col: '#e2405e', b: { leech: 20 } },
  sigil: { name: 'ตราธาตุ', n: 4, desc: 'โอกาสติดเครื่องหมายธาตุ +30% · แม่นยำ +10%', col: '#5d8cff', b: { mark: 30, acc: 10 } },
};
export const RUNE_SET_IDS = Object.keys(RUNE_SETS) as RuneSet[];
export const RUNE_GRADES: Record<RuneGrade, { name: string; subs: number; col: string }> = {
  common: { name: 'ธรรมดา', subs: 0, col: '#c9c2b0' }, rare: { name: 'หายาก', subs: 1, col: '#4aa8ff' },
  epic: { name: 'มหากาพย์', subs: 2, col: '#b76bff' }, legendary: { name: 'ตำนาน', subs: 3, col: '#ffb43a' },
};
export const RUNE_GRADE_ORDER: RuneGrade[] = ['common', 'rare', 'epic', 'legendary'];
/** a rune's star scales every number on it — flat ATK/HP/DEF follow the monsters' own star curve (a ★1 monster has ~a fifth
 *  of a ★6's ATK), so a low rune never doubles a young monster */
export const RUNE_STAR_MULT = [0, 0.4, 0.5, 0.62, 0.74, 0.87, 1];
export const RUNE_FLAT_MULT = [0, 0.2, 0.28, 0.39, 0.54, 0.74, 1];
const starMult = (k: RuneStat, star: number) => (RUNE_STATS[k].pct || k === 'spd' ? RUNE_STAR_MULT : RUNE_FLAT_MULT)[star];
export const RUNE_MAX_LVL = 12;
/** success chance of the next level (index = current level) — a failure only costs the gold, the rune never breaks */
export const RUNE_UP_RATE = [1, 1, 1, 0.9, 0.85, 0.8, 0.7, 0.6, 0.55, 0.45, 0.35, 0.3];
/** gold per attempt = base[star] × (level + 1)^1.3 — ★6 +0→+12 ≈ 120k gold before failures */
export const RUNE_UP_BASE = [0, 100, 180, 300, 450, 620, 800];
export const RUNE_SELL = [0, 40, 80, 150, 260, 420, 650];
const GRADE_SELL: Record<RuneGrade, number> = { common: 1, rare: 1.4, epic: 2, legendary: 3 };
/** drops per win by difficulty (easy/normal/hard): chance, grade weights · star = realm base + 0..1 + difficulty */
export const RUNE_DROP = {
  chance: [0.4, 0.55, 0.7],
  gradeW: [{ common: 55, rare: 32, epic: 11, legendary: 2 }, { common: 35, rare: 40, epic: 20, legendary: 5 }, { common: 20, rare: 40, epic: 30, legendary: 10 }] as Record<RuneGrade, number>[],
  realmStar: { 1: 1, 2: 2, 3: 3 } as Record<string, number>,
};

const pick = <T,>(a: T[], rnd: () => number): T => a[Math.min(a.length - 1, Math.floor(rnd() * a.length))];
export const mainValue = (r: Pick<Rune, 'main' | 'star' | 'lvl'>, lvl = r.lvl) => { const v = RUNE_STATS[r.main].main * starMult(r.main, r.star) * (0.2 + 0.8 * lvl / RUNE_MAX_LVL); return Math.max(1, Math.round(v)); };
const subRoll = (k: RuneStat, star: number, rnd: () => number) => { const [a, b] = RUNE_STATS[k].sub; return Math.max(1, Math.round((a + (b - a) * rnd()) * starMult(k, star))); };
function newSub(r: Rune, rnd: () => number) {
  const pool = (Object.keys(RUNE_STATS) as RuneStat[]).filter(k => k !== r.main && !r.subs.some(s => s.k === k));
  const k = pick(pool, rnd); r.subs.push({ k, v: subRoll(k, r.star, rnd) }); return k;
}
export function rollRune(rnd: () => number, star: number, gradeW: Record<RuneGrade, number>, id = 0): Rune {
  const slot = (1 + Math.floor(rnd() * 4)) as RuneSlot, set = pick(RUNE_SET_IDS, rnd);
  let g = rnd() * RUNE_GRADE_ORDER.reduce((t, k) => t + (gradeW[k] || 0), 0), grade: RuneGrade = 'common';
  for (const k of RUNE_GRADE_ORDER) { g -= gradeW[k] || 0; if (g < 0) { grade = k; break; } }
  const r: Rune = { id, slot, set, grade, star: Math.max(1, Math.min(6, star)), lvl: 0, main: pick(SLOT_MAIN[slot], rnd), subs: [] };
  for (let i = 0; i < RUNE_GRADES[grade].subs; i++) newSub(r, rnd);
  return r;
}
export const runeUpCost = (r: Rune) => Math.round(RUNE_UP_BASE[r.star] * Math.pow(r.lvl + 1, 1.3) / 10) * 10;
export const runeUpRate = (r: Rune) => RUNE_UP_RATE[r.lvl] ?? 0;
export const runeSellPrice = (r: Rune) => Math.round(RUNE_SELL[r.star] * GRADE_SELL[r.grade] * (1 + r.lvl * 0.15) / 10) * 10;
/** one upgrade attempt (gold is paid by the caller): every +3 adds a sub stat, or boosts one once there are four */
export function upgradeRune(r: Rune, rnd: () => number): { ok: boolean; added?: RuneStat; boosted?: RuneStat } {
  if (r.lvl >= RUNE_MAX_LVL) return { ok: false };
  if (rnd() >= runeUpRate(r)) return { ok: false };
  r.lvl++;
  if (r.lvl % 3) return { ok: true };
  if (r.subs.length < 4) return { ok: true, added: newSub(r, rnd) };
  const s = pick(r.subs, rnd); s.v += subRoll(s.k, r.star, rnd); return { ok: true, boosted: s.k };
}

/** everything a monster's runes add, in display units (15 = 15%) */
export interface RuneBonus { atk: number; hp: number; def: number; atkP: number; hpP: number; defP: number; spd: number; spdP: number; crit: number; cdmg: number; res: number; acc: number; react: number; leech: number; mark: number; sets: RuneSet[] }
export function runeBonus(runes: Rune[]): RuneBonus {
  const b: RuneBonus = { atk: 0, hp: 0, def: 0, atkP: 0, hpP: 0, defP: 0, spd: 0, spdP: 0, crit: 0, cdmg: 0, res: 0, acc: 0, react: 0, leech: 0, mark: 0, sets: [] };
  const cnt: Partial<Record<RuneSet, number>> = {};
  for (const r of runes) { b[r.main] += mainValue(r); for (const s of r.subs) b[s.k] += s.v; cnt[r.set] = (cnt[r.set] || 0) + 1; }
  for (const id of RUNE_SET_IDS) { const S = RUNE_SETS[id]; for (let k = Math.floor((cnt[id] || 0) / S.n); k > 0; k--) { b.sets.push(id); for (const [stat, v] of Object.entries(S.b)) (b as any)[stat] += v; } }
  return b;
}
/** battle: fold a monster's runes into its unit (before the leader skill) */
export function applyRunes(u: Unit, b: RuneBonus) {
  u.maxHp = u.hp = Math.round(u.maxHp * (1 + b.hpP / 100) + b.hp);
  u.atk = Math.round(u.atk * (1 + b.atkP / 100) + b.atk);
  u.def = Math.round(u.def * (1 + b.defP / 100) + b.def);
  u.spd = Math.round(u.spd * (1 + b.spdP / 100) + b.spd);
  u.crit += b.crit / 100; u.critDmg += b.cdmg / 100; u.res += b.res / 100; u.acc += b.acc / 100;
  if (b.react) u.runeReact = b.react / 100;
  if (b.leech) u.leech = b.leech / 100;
  if (b.mark) u.markUp = b.mark / 100;
}
export const fmtStat = (k: RuneStat, v: number) => `${RUNE_STATS[k].name} +${v}${RUNE_STATS[k].pct ? '%' : ''}`;
