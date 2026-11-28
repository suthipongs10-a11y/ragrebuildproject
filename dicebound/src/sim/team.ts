import type { Content } from '../data/content';
import type { UnitDef } from '../data/gameSchema';
import type { GameEvent, RunState, UnitState } from './types';

const PERCENT = 100;

export function unitDef(content: Content, unit: UnitState): UnitDef {
  const def = content.units[unit.unitId];
  if (!def) throw new Error(`unknown unit "${unit.unitId}"`);
  return def;
}

export function tierStats(content: Content, unit: UnitState): UnitDef['tiers'][number] {
  const stats = unitDef(content, unit).tiers[unit.tier - 1];
  if (!stats) throw new Error(`unit "${unit.unitId}" has no tier ${unit.tier}`);
  return stats;
}

/** Sum of one bonus across every active synergy. */
export function synergyBonus(content: Content, state: RunState, key: 'teamAtkPct' | 'teamHpPct' | 'healPct' | 'goldPct'): number {
  let total = 0;
  for (const synergy of content.synergies) {
    const tier = state.synergies[synergy.id];
    if (tier) total += synergy.tiers[tier - 1]?.[key] ?? 0;
  }
  return total;
}

export function maxHp(content: Content, state: RunState, unit: UnitState): number {
  return Math.round(tierStats(content, unit).hp * (1 + synergyBonus(content, state, 'teamHpPct') / PERCENT));
}

export function tierForXp(content: Content, xp: number): number {
  let tier = 1;
  content.rules.unitXpForTier.forEach((needed, i) => {
    if (xp >= needed) tier = i + 1;
  });
  return tier;
}

/** Living units, front row first. */
export function formation(content: Content, state: RunState): UnitState[] {
  return state.team
    .filter((unit) => unit.hp > 0)
    .sort((a, b) => unitDef(content, a).row - unitDef(content, b).row || a.uid - b.uid);
}

/**
 * Recruit tiles feed XP into one unit of their class: the weakest one that can still
 * grow, otherwise a new recruit if there is room. Mutates the draft state.
 */
export function gainUnitXp(content: Content, state: RunState, unitId: string, xp: number, events: GameEvent[]): void {
  const maxTier = content.rules.unitXpForTier.length;
  const growable = state.team.filter((u) => u.unitId === unitId && u.tier < maxTier).sort((a, b) => a.xp - b.xp || a.uid - b.uid);
  let unit = growable[0];
  if (!unit) {
    if (state.team.length >= content.rules.teamMax) return;
    unit = { uid: state.nextUid++, unitId, xp: 0, tier: 1, hp: 0, shield: 0 };
    state.team.push(unit);
    unit.hp = maxHp(content, state, unit);
    events.push({ type: 'UnitRecruited', uid: unit.uid, unitId });
    // The recruit itself is the first point of the tile's value.
    xp -= 1;
  }
  if (xp <= 0) return;
  const before = maxHp(content, state, unit);
  unit.xp += xp;
  events.push({ type: 'UnitXpGained', uid: unit.uid, xp });
  const tier = tierForXp(content, unit.xp);
  if (tier > unit.tier) {
    unit.tier = tier;
    // A tier-up keeps damage taken but grants the extra max HP.
    if (unit.hp > 0) unit.hp += maxHp(content, state, unit) - before;
    events.push({ type: 'UnitTierUp', uid: unit.uid, tier });
  }
}

export function healTeam(content: Content, state: RunState, share: number, events: GameEvent[]): void {
  const amounts: Array<{ uid: number; amount: number }> = [];
  for (const unit of state.team) {
    if (unit.hp <= 0) continue;
    const cap = maxHp(content, state, unit);
    const amount = Math.min(cap - unit.hp, Math.round(cap * share));
    if (amount > 0) {
      unit.hp += amount;
      amounts.push({ uid: unit.uid, amount });
    }
  }
  events.push({ type: 'TeamHealed', amounts });
}

export function reviveTeam(content: Content, state: RunState, events: GameEvent[]): void {
  for (const unit of state.team) unit.hp = maxHp(content, state, unit);
  events.push({ type: 'TeamRevived' });
}
