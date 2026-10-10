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
  /** RO: bows hit with DEX, everything else with STR */
  atkStat?: 'str' | 'dex';
  /** RO: staves raise MATK by a percentage (0.15 = +15 %) */
  staffMatk?: number;
}

export const STAT_KEYS: readonly StatKey[] = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

export function maxHp(b: HeroBuild): number {
  return Math.round(90 + b.stats.vit * 10 + b.level * 10 * (b.hpFactor ?? 1) + b.bonusHp);
}

export function maxSp(b: HeroBuild): number {
  return Math.round(20 + b.stats.int * 4 + b.level * 2 * (b.spFactor ?? 1) + (b.bonusSp ?? 0));
}

/**
 * Physical attack, RO pre-renewal style: the weapon's stat (STR for melee and staff shots, DEX for bows) counts double
 * plus a square bonus every 10 points; the other one and LUK add a fifth. So a mage / acolyte who never raises STR
 * hits weakly, an archer grows with DEX.
 */
export function attack(b: HeroBuild): number {
  const dexWeapon = b.atkStat === 'dex';
  const main = dexWeapon ? b.stats.dex : b.stats.str, side = dexWeapon ? b.stats.str : b.stats.dex;
  return Math.round(8 + b.level + main * 2 + Math.floor(main / 10) ** 2 + Math.floor(side / 5) + Math.floor(b.stats.luk / 5) + b.weaponAtk + b.bonusAtk);
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
  return Math.floor(12 * Math.pow(level, 1.35)); // Lv 10 ≈ 100 forest kills, tuned to monsters.csv exp
}

export function statPointsForLevelUp(newLevel: number): number {
  return newLevel < 20 ? 3 : newLevel < 50 ? 4 : 5;
}

/** Magic attack (mage bolts, heal, holy light): INT only (RO), plus the weapon's MATK; staves add a percentage on top. */
export function magicAttack(b: HeroBuild): number {
  return Math.round(((b.weaponMatk ?? 0) + b.stats.int * 2 + Math.floor(b.stats.int / 5) ** 2 + (b.bonusMatk ?? 0) + b.level) * (1 + (b.staffMatk ?? 0)));
}

/** RO staff MATK bonus. */
export const STAFF_MATK = 0.15;

/** Job exp needed for the next job level (novice levels faster). */
export function jobExpToNext(jobLevel: number, tier: number): number {
  return Math.floor(tier === 0 ? 3 * Math.pow(jobLevel, 1.2) : 10 * Math.pow(jobLevel, 1.4)); // novice job 10 ≈ 25 kills
}

/** RO-style cost to raise a stat from `value` to `value + 1`. */
export function statCost(value: number): number {
  return Math.floor((value - 1) / 10) + 2;
}

export const MAX_BASE_LEVEL = 99;
export const MAX_STAT = 99;
