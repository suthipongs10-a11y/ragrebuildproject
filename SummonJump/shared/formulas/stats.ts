/** Hero stat formulas (ported from the v3 prototype; tune via balance sheet later). */
export type StatKey = 'str' | 'agi' | 'vit' | 'int' | 'dex' | 'luk';
export type Stats = Record<StatKey, number>;

export interface HeroBuild {
  level: number;
  stats: Stats;          // base + bonuses already summed
  weaponAtk: number;     // weapon base atk + refine bonus
  bonusAtk: number;      // cards, accessories, passives
  bonusDef: number;
  bonusHp: number;
  bonusCrit: number;
  /** job multipliers (Phase 3); default 1 */
  hpFactor?: number; spFactor?: number; aspdFactor?: number;
  weaponMatk?: number; bonusMatk?: number; bonusSp?: number;
  /** fractions: 0.1 = 10 % faster */
  bonusAspd?: number; bonusSpeed?: number;
}

export const STAT_KEYS: readonly StatKey[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

export function maxHp(b: HeroBuild): number {
  return Math.round(90 + b.stats.vit * 10 + b.level * 10 * (b.hpFactor ?? 1) + b.bonusHp);
}

export function maxSp(b: HeroBuild): number {
  return Math.round(20 + b.stats.int * 4 + b.level * 2 * (b.spFactor ?? 1) + (b.bonusSp ?? 0));
}

export function attack(b: HeroBuild): number {
  return Math.round(8 + b.stats.str * 2 + Math.floor(b.stats.dex / 2) + b.level + b.weaponAtk + b.bonusAtk);
}

export function defense(b: HeroBuild): number {
  return Math.round(b.bonusDef + Math.floor(b.stats.vit / 2));
}

/** Percent, capped at 60. */
export function critRate(b: HeroBuild): number {
  return Math.min(60, 2 + b.stats.luk * 0.5 + b.bonusCrit);
}

/** Seconds between normal attacks. */
export function attackCooldown(b: HeroBuild): number {
  return (0.34 * (1 - Math.min(0.4, b.stats.agi * 0.012)) * (1 - Math.min(0.3, b.bonusAspd ?? 0))) / (b.aspdFactor ?? 1);
}

export function moveSpeed(b: HeroBuild): number {
  return (112 + Math.min(40, b.stats.agi * 0.8)) * (1 + (b.bonusSpeed ?? 0));
}

/** Base exp needed to go from `level` to `level + 1`. */
export function expToNext(level: number): number {
  return Math.floor(30 * Math.pow(level, 1.5));
}

export function statPointsForLevelUp(newLevel: number): number {
  return newLevel < 20 ? 3 : newLevel < 50 ? 4 : 5;
}

/** Magic attack (mage bolts, holy light). */
export function magicAttack(b: HeroBuild): number {
  return Math.round((b.weaponMatk ?? 0) + b.stats.int * 2 + Math.floor(b.stats.int / 5) ** 2 + (b.bonusMatk ?? 0) + b.level);
}

/** Job exp needed for the next job level (novice levels faster). */
export function jobExpToNext(jobLevel: number, tier: number): number {
  return Math.floor((tier === 0 ? 12 : 22) * Math.pow(jobLevel, 1.45));
}

/** RO-style cost to raise a stat from `value` to `value + 1`. */
export function statCost(value: number): number {
  return Math.floor((value - 1) / 10) + 2;
}

export const MAX_BASE_LEVEL = 99;
export const MAX_STAT = 99;
