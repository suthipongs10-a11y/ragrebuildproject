import type { ContentBundle } from '../content/types';
import { attack, critRate, defense, magicAttack, maxHp, statCost, MAX_STAT, type StatKey } from '../formulas/stats';
import { canEquip, canLearn, derive, equip, isEquipped, itemDef, jobOf, learnSkill, raiseStat, type HeroData } from './hero';

/**
 * "One tap" growth for players who don't want to plan builds (owner request): spend stat points by the job's
 * weights, learn skills in the job's plan order, and wear the strongest gear in the bag. Data: jobs.csv auto_stats / auto_skills.
 */

/** Spend every affordable stat point; the stat furthest below its weight share goes first. Returns points spent. */
export function autoStats(h: HeroData, c: ContentBundle): number {
  const w = jobOf(c, h.job).auto_stats;
  const keys = Object.keys(w).filter((k) => (w[k] ?? 0) > 0) as StatKey[];
  let spent = 0;
  for (let guard = 0; guard < 500; guard++) {
    const can = keys.filter((k) => h.stats[k] < MAX_STAT && statCost(h.stats[k]) <= h.statPoints);
    if (!can.length) break;
    const k = can.reduce((a, b) => (h.stats[a] / (w[a] as number) <= h.stats[b] / (w[b] as number) ? a : b));
    if (!raiseStat(h, k)) break;
    spent++;
  }
  return spent;
}

/** Learn skills along the job's plan (each step: raise that skill up to the target level). Returns levels learned. */
export function autoSkills(h: HeroData, c: ContentBundle): number {
  let learned = 0;
  for (const step of jobOf(c, h.job).auto_skills) {
    while (h.skillPoints > 0 && (h.skills[step.id] ?? 0) < step.lv && canLearn(h, c, step.id) === null) { learnSkill(h, c, step.id); learned++; }
    if (h.skillPoints <= 0) break;
  }
  return learned;
}

/** How strong the hero is for its job (main attack + toughness); used to compare gear. */
export function gearScore(h: HeroData, c: ContentBundle): number {
  const b = derive(h, c).build, caster = h.job === 'mage' || h.job === 'acolyte';
  return (caster ? magicAttack(b) * 1.1 + attack(b) * 0.25 : attack(b)) + defense(b) * 3 + maxHp(b) * 0.06 + critRate(b) * 1.5;
}

/** Score if `uid` were equipped (null = can't wear it). */
function scoreWith(h: HeroData, c: ContentBundle, uid: number): number | null {
  if (canEquip(h, c, uid) !== null) return null;
  const copy = JSON.parse(JSON.stringify(h)) as HeroData;
  return equip(copy, c, uid) ? gearScore(copy, c) : null;
}

/** True when wearing this bag item would make the hero stronger. */
export function isUpgrade(h: HeroData, c: ContentBundle, uid: number): boolean {
  if (isEquipped(h, uid) || itemDef(c, h.bag.find((x) => x.uid === uid)?.id ?? '')?.type === 'consumable') return false;
  const s = scoreWith(h, c, uid);
  return s !== null && s > gearScore(h, c) + 0.5;
}

/** Wear the best gear in the bag (greedy, a few passes). Returns how many items were put on. */
export function equipBest(h: HeroData, c: ContentBundle): number {
  let changed = 0;
  for (let pass = 0; pass < 8; pass++) {
    let best: { uid: number; score: number } | null = null;
    const now = gearScore(h, c);
    for (const it of h.bag) {
      if (isEquipped(h, it.uid)) continue;
      const s = scoreWith(h, c, it.uid);
      if (s !== null && s > now + 0.5 && (!best || s > best.score)) best = { uid: it.uid, score: s };
    }
    if (!best || !equip(h, c, best.uid)) break;
    changed++;
  }
  return changed;
}
