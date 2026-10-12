// Rewards, levels, fragments, eggs, evolution (star-ups) and skill-ups.
import { STAGES, SPECIES, expToNext, levelCap, EGG_TIERS, EGG_DROP, NAMED_RARE_FORM, MAX_STARS, EVO_GOLD, SKILL_MAX, EGG_LOOT_GRADE, LOOT_ORDER } from '../core/data';
import type { EggTier, LootGrade } from '../core/data';
import type { Rarity } from '../core/types';
import type { SaveData, EggSave, MonSave } from './save';
import { newMon } from './save';
import { canHatch, endIncub } from './home';

export interface MonGain { uid: number; sid: string; fromLvl: number; toLvl: number; exp: number; capped: boolean }
export interface Reward { win: boolean; stars: number; firstClear: boolean; gold: number; gains: MonGain[]; frags: Record<string, number>; eggs: EggSave[] }
export const FRAGS_TO_CRAFT = 20;

export function stageUnlocked(s: SaveData, id: string): boolean {
  const i = STAGES.findIndex(x => x.id === id);
  return i === 0 || (s.stages[STAGES[i - 1].id] || 0) > 0;
}

export function grantRewards(s: SaveData, stageId: string, win: boolean, stars: number, seen: string[], seed: number): Reward {
  const st = STAGES.find(x => x.id === stageId)!;
  const first = win && !(s.stages[stageId] > 0);
  const r: Reward = { win, stars, firstClear: first, gold: 0, gains: [], frags: {}, eggs: [] };
  let rs = seed >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const expGain = win ? st.reward.exp : Math.round(st.reward.exp * 0.25);
  r.gold = win ? st.reward.gold + (first ? st.reward.gold : 0) : 0;
  s.gold += r.gold;
  for (const uid of s.team) {
    const m = monOf(s, uid); if (!m) continue;
    const g: MonGain = { uid, sid: m.sid, fromLvl: m.lvl, toLvl: m.lvl, exp: expGain, capped: false };
    m.exp += expGain;
    while (m.exp >= expToNext(m.lvl)) { if (m.lvl >= levelCap(m.stars)) { m.exp = 0; g.capped = true; break; } m.exp -= expToNext(m.lvl); m.lvl++; }
    g.toLvl = m.lvl; r.gains.push(g);
  }
  if (win) {
    const uniq = [...new Set(seen.filter(sid => SPECIES[sid] && !SPECIES[sid].boss))];
    for (const sid of uniq) { const n = 1 + (rnd() < .35 ? 1 : 0); r.frags[sid] = n; s.frags[sid] = (s.frags[sid] || 0) + n; }
    // mystery egg: one roll per win, boss stages drop more often, first clear always drops
    const boss = st.waves.some(w => w.some(m => SPECIES[m.sid]?.boss));
    if (first || rnd() < (boss ? EGG_DROP.bossChance : EGG_DROP.chance)) { const e = rollMysteryEgg(s, rnd); s.eggs.push(e); r.eggs.push(e); }
    s.stages[stageId] = Math.max(s.stages[stageId] || 0, stars);
  }
  return r;
}

export function craftEgg(s: SaveData, sid: string, rnd: () => number = Math.random): boolean {
  if ((s.frags[sid] || 0) < FRAGS_TO_CRAFT) return false;
  s.frags[sid] -= FRAGS_TO_CRAFT; s.eggs.push({ id: s.nextEggId++, sid, kind: 'named', rare: rnd() < NAMED_RARE_FORM }); return true;
}

// ---- mystery eggs ----
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
function pickW<K extends string>(w: Partial<Record<K, number>>, r: number): K {
  const ks = Object.keys(w) as K[], total = ks.reduce((a, k) => a + (w[k] || 0), 0);
  let x = r * total; for (const k of ks) { x -= w[k] || 0; if (x < 0) return k; } return ks[ks.length - 1];
}
/** a hatchable species of that rarity; if none exists yet, the nearest lower rarity, then the nearest higher */
export function rollSpecies(rarity: Rarity, rnd: () => number): string {
  const pool = Object.values(SPECIES).filter(x => !x.boss), i = RARITY_ORDER.indexOf(rarity);
  const order = [i, ...[0, 1, 2, 3].filter(k => k < i).reverse(), ...[0, 1, 2, 3].filter(k => k > i)];
  for (const k of order) { const ps = pool.filter(x => x.rarity === RARITY_ORDER[k]); if (ps.length) return ps[Math.floor(rnd() * ps.length)].id; }
  return pool[0].id;
}
/** shell tier of the next mystery egg, applying (and updating) the gold+ pity counter */
export function rollTier(s: SaveData, rnd: () => number): EggTier {
  const w = EGG_DROP.tierW, hi = (t: EggTier) => t === 'gold' || t === 'rainbow';
  let tier = pickW(w, rnd());
  if (!hi(tier) && (s.eggPity || 0) + 1 >= EGG_DROP.pity) tier = pickW({ gold: w.gold, rainbow: w.rainbow }, rnd());
  s.eggPity = hi(tier) ? 0 : (s.eggPity || 0) + 1;
  return tier;
}
export const rollRarity = (tier: EggTier, rnd: () => number) => pickW(EGG_TIERS[tier].rarityW, rnd()) as Rarity;
export function rollMysteryEgg(s: SaveData, rnd: () => number): EggSave {
  const tier = rollTier(s, rnd), T = EGG_TIERS[tier];
  return { id: s.nextEggId++, sid: rollSpecies(rollRarity(tier, rnd), rnd), kind: 'mystery', tier, rare: rnd() < T.rareForm };
}
/** disclosed odds of a mystery egg drop, per tier (0..1) */
export function eggOdds() {
  const w = EGG_DROP.tierW, total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total])) as Record<EggTier, number>;
}

export const monOf = (s: SaveData, uid: number) => s.mons.find(m => m.uid === uid);
export const copiesOf = (s: SaveData, sid: string) => s.mons.filter(m => m.sid === sid).length;
/** team rule: one monster per species (a second copy of the same species can't join) */
export const teamHasSpecies = (s: SaveData, sid: string, except = -1) => s.team.some(u => u !== except && monOf(s, u)?.sid === sid);

export interface HatchResult { uid: number; sid: string; egg: EggSave; stars: number; copies: number; rare: boolean; newDex?: boolean }
/** hatch an egg: always a new monster at its natural stars (copies are separate units, used as food later).
 *  copies = how many of that species were owned before. Eggs still incubating can't hatch. */
export function hatchEgg(s: SaveData, eggId: number, now = Date.now()): HatchResult | null {
  const i = s.eggs.findIndex(e => e.id === eggId); if (i < 0 || !canHatch(s, s.eggs[i], now)) return null;
  const egg = s.eggs[i], { sid } = egg, rare = !!egg.rare, copies = copiesOf(s, sid);
  s.eggs.splice(i, 1); endIncub(s, eggId);
  const fresh = !s.dex.includes(sid), m = newMon(s.nextUid++, sid, 1, undefined, rare); s.mons.push(m); if (fresh) s.dex.push(sid);
  return { uid: m.uid, sid, egg, stars: m.stars, copies, rare, newDex: fresh };
}

// ---- evolution (อัปดาว) & skill-ups ----
export type EvoCheck = { ok: boolean; need: number; gold: number; why?: string };
/** can `target` evolve with these food uids? (max level, `stars` foods of the same star grade, not itself, gold) */
export function evoCheck(s: SaveData, uid: number, food: number[]): EvoCheck {
  const t = monOf(s, uid); if (!t) return { ok: false, need: 0, gold: 0, why: 'ไม่พบมอน' };
  const need = t.stars, gold = EVO_GOLD[t.stars] || 0;
  if (t.stars >= MAX_STARS) return { ok: false, need, gold, why: 'ดาวเต็มแล้ว' };
  if (t.lvl < levelCap(t.stars)) return { ok: false, need, gold, why: `ต้องเลเวลเต็ม (Lv.${levelCap(t.stars)})` };
  const fs = food.map(u => monOf(s, u));
  if (fs.length !== need || fs.some(f => !f || f.uid === uid || f.stars !== t.stars)) return { ok: false, need, gold, why: `ต้องใช้มอน ★${t.stars} อีก ${need} ตัว` };
  if (s.gold < gold) return { ok: false, need, gold, why: 'ทองไม่พอ' };
  return { ok: true, need, gold };
}
/** evolve: ★+1, level back to 1, food monsters are consumed (and leave the team) */
export function evolve(s: SaveData, uid: number, food: number[]): MonSave | null {
  if (!evoCheck(s, uid, food).ok) return null;
  const t = monOf(s, uid)!; s.gold -= EVO_GOLD[t.stars];
  s.mons = s.mons.filter(m => !food.includes(m.uid)); s.team = s.team.filter(u => !food.includes(u));
  t.stars++; t.lvl = 1; t.exp = 0; return t;
}
export const skillMaxed = (m: MonSave) => m.sk.every((l, i) => l >= SKILL_MAX[i]);
/** feed a copy of the same species (or a soul crystal when food is null): +1 to a random non-maxed skill. Returns the skill slot. */
export function skillUp(s: SaveData, uid: number, food: number | null, rnd: () => number = Math.random): number {
  const t = monOf(s, uid); if (!t || skillMaxed(t)) return -1;
  if (food == null) { if (s.items.soul < 1) return -1; s.items.soul--; }
  else { const f = monOf(s, food); if (!f || f.uid === uid || f.sid !== t.sid) return -1; s.mons = s.mons.filter(m => m.uid !== food); s.team = s.team.filter(u => u !== food); }
  const open = [0, 1, 2].filter(i => t.sk[i] < SKILL_MAX[i]), slot = open[Math.floor(rnd() * open.length)];
  t.sk[slot]++; return slot;
}

// ---- stage-end chest contents ----
export type LootItem = { kind: 'gold'; grade: LootGrade; qty: number; first: boolean }
  | { kind: 'frag'; grade: LootGrade; qty: number; sid: string }
  | { kind: 'egg'; grade: LootGrade; egg: EggSave };
/** chest items, worst first so the best one pops out last; chest grade = the best item's grade */
export function lootOf(r: Reward): { items: LootItem[]; grade: LootGrade } {
  const items: LootItem[] = [];
  if (r.gold) items.push({ kind: 'gold', grade: 'common', qty: r.gold, first: r.firstClear });
  for (const [sid, n] of Object.entries(r.frags)) items.push({ kind: 'frag', grade: 'common', qty: n, sid });
  for (const egg of r.eggs) items.push({ kind: 'egg', grade: egg.kind === 'mystery' && egg.tier ? EGG_LOOT_GRADE[egg.tier] : 'rare', egg });
  const rank = (g: LootGrade) => LOOT_ORDER.indexOf(g);
  items.sort((a, b) => rank(a.grade) - rank(b.grade));
  return { items, grade: items.length ? items[items.length - 1].grade : 'common' };
}
