import type { Content } from '../data/content';
import type { ModKey } from '../data/gameSchema';
import type { RunState } from './types';

/** Total of one passive bonus from the leader, every relic and every active synergy tier. */
export function mod(content: Content, state: RunState, key: ModKey): number {
  let total = content.leaders[state.leaderId]?.mods[key] ?? 0;
  for (const relicId of state.relics) total += content.relics[relicId]?.mods[key] ?? 0;
  for (const synergy of content.synergies) {
    const tier = state.synergies[synergy.id];
    if (tier) total += synergy.tiers[tier - 1]?.[key] ?? 0;
  }
  return total;
}

const PERCENT = 100;

/** `base` raised (or cut, for negative bonuses) by a percentage. */
export function scaled(base: number, pct: number): number {
  return base * (1 + pct / PERCENT);
}

export function rerollsPerLap(content: Content, state: RunState): number {
  return content.rules.rerollsPerLap + mod(content, state, 'rerollsPerLap');
}

export function critMultiplier(content: Content, state: RunState): number {
  return content.rules.die.critMultiplier + mod(content, state, 'critMultiplierBonus');
}

/** Price after a discount, never below 1 and never past the global discount cap. */
export function discounted(content: Content, price: number, discountPct: number): number {
  const pct = Math.min(content.rules.maxDiscountPct, Math.max(0, discountPct));
  return Math.max(1, Math.round(price * (1 - pct / PERCENT)));
}
