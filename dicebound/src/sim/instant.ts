import type { Content } from '../data/content';
import type { Instant } from '../data/gameSchema';
import { mod, scaled } from './mods';
import { addXp, healTeam, maxHp } from './team';
import type { GameEvent, RunState } from './types';

const PERCENT = 100;

export type GoldReason = Extract<GameEvent, { type: 'GoldChanged' }>['reason'];

/** Gold in or out. Gains are raised by gold bonuses; the purse never goes below zero. */
export function changeGold(content: Content, state: RunState, amount: number, reason: GoldReason, events: GameEvent[], bonus = true): void {
  const delta = amount >= 0 ? Math.round(bonus ? scaled(amount, mod(content, state, 'goldPct')) : amount) : -Math.min(state.gold, Math.round(-amount));
  if (delta === 0) return;
  state.gold += delta;
  events.push({ type: 'GoldChanged', delta, total: state.gold, reason });
}

/** One immediate effect. `reason` labels any gold movement for the log. */
export function applyInstant(content: Content, state: RunState, instant: Instant, reason: GoldReason, events: GameEvent[]): void {
  const { kind, value } = instant;
  switch (kind) {
    case 'gold':
      changeGold(content, state, value, reason, events);
      break;
    case 'heal_pct':
      healTeam(content, state, scaled(value, mod(content, state, 'healPct')) / PERCENT, events);
      break;
    case 'damage_pct': {
      const amounts: Array<{ uid: number; amount: number }> = [];
      for (const unit of state.team) {
        if (unit.hp <= 0) continue;
        // These hurt but never kill: only fights can wipe the team.
        const amount = Math.min(unit.hp - 1, Math.round((maxHp(content, state, unit) * value) / PERCENT));
        if (amount > 0) {
          unit.hp -= amount;
          amounts.push({ uid: unit.uid, amount });
        }
      }
      events.push({ type: 'TeamDamaged', amounts });
      break;
    }
    case 'team_atk_pct':
      state.turnState.teamAtkPct += value;
      events.push({ type: 'BuffApplied', kind, value });
      break;
    case 'enemy_atk_pct':
      state.turnState.enemyAtkPct += value;
      events.push({ type: 'BuffApplied', kind, value });
      break;
    case 'team_shield':
      for (const unit of state.team) if (unit.hp > 0) unit.shield += Math.round(value);
      events.push({ type: 'BuffApplied', kind, value: Math.round(value) });
      break;
    case 'force_die':
      state.forceDice += Math.round(value);
      events.push({ type: 'ForceDiceChanged', delta: Math.round(value), total: state.forceDice });
      break;
    case 'reroll':
      state.rerollsLeft += Math.round(value);
      events.push({ type: 'RerollsChanged', delta: Math.round(value), total: state.rerollsLeft });
      break;
    case 'xp_all':
      for (const unit of state.team) addXp(content, state, unit, Math.round(value), events);
      break;
  }
}
