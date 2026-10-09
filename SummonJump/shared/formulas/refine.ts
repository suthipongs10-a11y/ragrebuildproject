import type { Rng } from '../rng';

export const MAX_REFINE = 15;

/** Success chance to go from `level` to `level + 1`. */
const SUCCESS = [1, 1, 1, 1, 0.8, 0.6, 0.45, 0.3, 0.2, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03];

export function refineChance(level: number): number {
  return SUCCESS[level] ?? 0;
}

export function refineCost(level: number): number {
  return 50 * (level + 1) * (level >= 10 ? 4 : 1);
}

/** Weapon ATK added by refine level. */
export function refineAttackBonus(level: number): number {
  let b = 0;
  for (let i = 1; i <= level; i++) b += i <= 4 ? 3 : i <= 9 ? 6 : 10;
  return b;
}

export type RefineOutcome = 'success' | 'fail' | 'downgrade' | 'break';

/** +5..+9 failure drops one level; +10 and above failure breaks unless protected. */
export function rollRefine(level: number, rng: Rng, protectedFromBreak = false): { outcome: RefineOutcome; level: number } {
  if (level >= MAX_REFINE) return { outcome: 'fail', level };
  if (rng.next() < refineChance(level)) return { outcome: 'success', level: level + 1 };
  if (level >= 10 && !protectedFromBreak) return { outcome: 'break', level: 0 };
  if (level >= 5) return { outcome: 'downgrade', level: level - 1 };
  return { outcome: 'fail', level };
}
