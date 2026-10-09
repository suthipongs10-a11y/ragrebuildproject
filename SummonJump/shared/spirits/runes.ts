import type { ContentBundle, RuneStatDef } from '../content/types';
import type { Rng } from '../rng';
import { spiritOf, MAX_RUNE_LV, RUNE_SLOTS, type RuneInst, type RuneStat, type SpiritBox } from './model';

/**
 * SW-style runes: slot 1/3/5 fixed flat main stat (ATK/DEF/HP), 2/4/6 random; up to 4 sub stats;
 * upgrade +1..+15 (zeny + success rate from rune_upgrade.csv), at +3/6/9/12 a sub stat is added (or one is raised).
 * Lower-star runes scale every value by STAR_SCALE.
 */
export const STAR_SCALE = [0.35, 0.5, 0.62, 0.75, 0.87, 1];
const scale = (star: number) => STAR_SCALE[Math.max(0, Math.min(5, star - 1))] as number;
const pick = <T>(list: readonly T[], rng: Rng): T => list[Math.floor(rng.next() * list.length) % list.length] as T;
const statDef = (c: ContentBundle, stat: string): RuneStatDef | undefined => c.runeStats.find((s) => s.stat === stat);

export function mainValue(c: ContentBundle, r: Pick<RuneInst, 'main' | 'star' | 'lv'>): number {
  const d = statDef(c, r.main.stat);
  if (!d) return 0;
  return Math.round((d.main_lo + ((d.main_hi - d.main_lo) * r.lv) / MAX_RUNE_LV) * scale(r.star));
}

function rollSub(c: ContentBundle, r: RuneInst, rng: Rng): RuneStat | null {
  const taken = new Set([r.main.stat, ...r.subs.map((s) => s.stat)]);
  const pool = c.runeStats.filter((s) => !taken.has(s.stat));
  if (!pool.length) return null;
  const d = pick(pool, rng);
  return { stat: d.stat, v: subRoll(d, r.star, rng) };
}
const subRoll = (d: RuneStatDef, star: number, rng: Rng): number => Math.max(1, Math.round((d.sub_lo + rng.next() * (d.sub_hi - d.sub_lo)) * scale(star)));

/** rarity 0..4 = number of starting sub stats (normal, magic, rare, hero, legend). */
export function rollRune(c: ContentBundle, rng: Rng, star: number, rarity: number, set?: string, slot?: number): RuneInst {
  const sl = slot ?? 1 + Math.floor(rng.next() * RUNE_SLOTS);
  const mains = c.runeStats.filter((s) => s.main_slots.includes(sl));
  const r: RuneInst = {
    uid: 0, set: set ?? pick(c.runeSets, rng).id, slot: sl, star, lv: 0,
    main: { stat: pick(mains, rng).stat, v: 0 }, subs: [], on: null,
  };
  r.main.v = mainValue(c, r);
  for (let i = 0; i < rarity; i++) { const s = rollSub(c, r, rng); if (s) r.subs.push(s); }
  return r;
}

export function addRune(b: SpiritBox, r: RuneInst): RuneInst {
  r.uid = b.nextUid++;
  b.runes.push(r);
  return r;
}

/** Monster kill: maybe drop a rune (chance/star/rarity per monster tier from rune_drop.csv). */
export function rollRuneDrop(c: ContentBundle, tier: string, rng: Rng, luck = 1): RuneInst | null {
  const d = c.runeDrop.find((x) => x.tier === tier);
  if (!d || !rng.chance(Math.min(1, d.chance * luck))) return null;
  const star = d.star_lo + Math.floor(rng.next() * (d.star_hi - d.star_lo + 1));
  const total = d.rarity.reduce((a, v) => a + v, 0);
  let roll = rng.next() * total, rarity = 0;
  for (let i = 0; i < d.rarity.length; i++) { roll -= d.rarity[i] as number; if (roll < 0) { rarity = i; break; } }
  return rollRune(c, rng, Math.min(6, star), rarity);
}

export const upgradeCost = (c: ContentBundle, r: RuneInst): number => {
  const u = c.runeUpgrade.find((x) => x.lv === r.lv + 1);
  return u ? Math.max(10, Math.round((u.zeny * r.star) / 6)) : 0;
};
export const upgradeRate = (c: ContentBundle, r: RuneInst): number => c.runeUpgrade.find((x) => x.lv === r.lv + 1)?.rate ?? 0;

/** One upgrade try. Caller pays `upgradeCost` first. Returns true on success. */
export function upgradeRune(c: ContentBundle, r: RuneInst, rng: Rng): boolean {
  if (r.lv >= MAX_RUNE_LV) return false;
  if (!rng.chance(upgradeRate(c, r))) return false;
  r.lv++;
  r.main.v = mainValue(c, r);
  if (r.lv % 3 === 0 && r.lv <= 12) {
    if (r.subs.length < 4) { const s = rollSub(c, r, rng); if (s) r.subs.push(s); }
    else { const s = pick(r.subs, rng); const d = statDef(c, s.stat); if (d) s.v += subRoll(d, r.star, rng); }
  }
  return true;
}

/** Equip a rune on a spirit; the rune that was in that slot goes back to the bag. */
export function equipRune(b: SpiritBox, runeUid: number, spiritUid: number): boolean {
  const r = b.runes.find((x) => x.uid === runeUid);
  if (!r || !spiritOf(b, spiritUid)) return false;
  for (const o of b.runes) if (o.on === spiritUid && o.slot === r.slot) o.on = null;
  r.on = spiritUid;
  return true;
}

export function unequipRune(b: SpiritBox, runeUid: number): void {
  const r = b.runes.find((x) => x.uid === runeUid);
  if (r) r.on = null;
}

export const runesOn = (b: SpiritBox, spiritUid: number): RuneInst[] => b.runes.filter((r) => r.on === spiritUid).sort((a, z) => a.slot - z.slot);

export function sellRune(b: SpiritBox, runeUid: number): number {
  const i = b.runes.findIndex((x) => x.uid === runeUid);
  if (i < 0) return 0;
  const r = b.runes[i] as RuneInst;
  b.runes.splice(i, 1);
  return 20 * r.star * (1 + r.subs.length) + 30 * r.lv;
}
