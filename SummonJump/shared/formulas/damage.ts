import { elementMultiplier, type Element } from './elements';
import type { Rng } from '../rng';

export interface DamageInput {
  base: number;            // attacker ATK x skill multiplier
  attackElement: Element;
  defendElement: Element;
  defense: number;         // flat reduction
  critRate: number;        // percent
  dex: number;
  canCrit?: boolean;
}

export type DamageKind = 'normal' | 'crit' | 'weak' | 'resist';

export interface DamageResult {
  amount: number;
  crit: boolean;
  multiplier: number;
  kind: DamageKind;
}

export const CRIT_MULTIPLIER = 1.6;

/** Single source of truth for hero/spirit damage. Uses the seeded RNG. */
export function rollDamage(input: DamageInput, rng: Rng): DamageResult {
  const m = elementMultiplier(input.attackElement, input.defendElement);
  const variance = rng.range(0.92, 1.08) * (1 + Math.min(0.1, input.dex * 0.004));
  const crit = (input.canCrit ?? true) && rng.next() * 100 < input.critRate;
  let dmg = input.base * variance;
  dmg = crit ? dmg * CRIT_MULTIPLIER * Math.max(1, m) : dmg * m;
  dmg -= crit ? 0 : input.defense * 0.6; // crits pierce flat defense (RO style)
  const amount = Math.max(1, Math.round(dmg));
  const kind: DamageKind = crit ? 'crit' : m > 1 ? 'weak' : m < 1 ? 'resist' : 'normal';
  return { amount, crit, multiplier: m, kind };
}
