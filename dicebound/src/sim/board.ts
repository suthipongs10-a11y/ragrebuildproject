import type { Content } from '../data/content';
import type { TileDef } from '../data/gameSchema';
import type { Rng } from './rng';
import { gainUnitXp, healTeam, maxHp, synergyBonus } from './team';
import type { GameEvent, RunState, TileState } from './types';

const PERCENT = 100;

export function tileDef(content: Content, tile: TileState): TileDef {
  const def = content.tiles[tile.tileId];
  if (!def) throw new Error(`unknown tile "${tile.tileId}"`);
  return def;
}

export function currentTile(state: RunState): TileState {
  const tile = state.board[state.position];
  if (!tile) throw new Error(`pawn is off the board at ${state.position}`);
  return tile;
}

/** Gold needed to raise the tile under the pawn by one star, or null if it cannot be raised. */
export function upgradeCost(content: Content, state: RunState): number | null {
  const tile = currentTile(state);
  if (!tileDef(content, tile).upgradable || tile.stars >= content.rules.maxStars) return null;
  return content.rules.upgradeCosts[tile.stars - 1] ?? null;
}

function addGold(content: Content, state: RunState, base: number, reason: 'tile' | 'gamble', events: GameEvent[]): void {
  const delta = Math.round(base * (1 + synergyBonus(content, state, 'goldPct') / PERCENT));
  state.gold += delta;
  events.push({ type: 'GoldChanged', delta, total: state.gold, reason });
}

/** Applies the tile under the pawn. A crit roll doubles what the tile gives, never what it takes. */
export function applyTile(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  const tile = currentTile(state);
  const effect = tileDef(content, tile).effect;
  events.push({ type: 'TileLanded', index: state.position, tileId: tile.tileId, stars: tile.stars });
  if (effect.kind === 'none') return;
  const boost = state.turnState.crit ? content.rules.die.critMultiplier : 1;
  const value = effect.values[tile.stars - 1] ?? 0;

  switch (effect.kind) {
    case 'recruit':
      gainUnitXp(content, state, effect.unit, Math.round(value * boost), events);
      break;
    case 'gold':
      addGold(content, state, value * boost, 'tile', events);
      break;
    case 'heal_pct':
      healTeam(content, state, ((value * boost) / PERCENT) * (1 + synergyBonus(content, state, 'healPct') / PERCENT), events);
      break;
    case 'team_atk_pct':
      state.turnState.teamAtkPct += value * boost;
      events.push({ type: 'BuffApplied', kind: effect.kind, value: value * boost });
      break;
    case 'team_shield':
      for (const unit of state.team) if (unit.hp > 0) unit.shield += Math.round(value * boost);
      events.push({ type: 'BuffApplied', kind: effect.kind, value: Math.round(value * boost) });
      break;
    case 'enemy_atk_pct':
      state.turnState.enemyAtkPct += value;
      events.push({ type: 'BuffApplied', kind: effect.kind, value });
      break;
    case 'damage_pct': {
      const amounts: Array<{ uid: number; amount: number }> = [];
      for (const unit of state.team) {
        if (unit.hp <= 0) continue;
        // Traps hurt but never kill: only fights can wipe the team.
        const amount = Math.min(unit.hp - 1, Math.round((maxHp(content, state, unit) * value) / PERCENT));
        if (amount > 0) {
          unit.hp -= amount;
          amounts.push({ uid: unit.uid, amount });
        }
      }
      events.push({ type: 'TeamDamaged', amounts });
      break;
    }
    case 'gamble': {
      const won = rng.next() < effect.winChance;
      events.push({ type: 'GambleResolved', won });
      if (won) addGold(content, state, value * boost, 'gamble', events);
      else {
        const lost = Math.min(state.gold, effect.loseGold);
        state.gold -= lost;
        events.push({ type: 'GoldChanged', delta: -lost, total: state.gold, reason: 'gamble' });
      }
      break;
    }
  }
}

/** Star level a tile id has reached anywhere on the board (best copy counts). */
function starsOf(state: RunState, tileId: string): number {
  return Math.max(0, ...state.board.filter((t) => t.tileId === tileId).map((t) => t.stars));
}

/** Re-derives active synergies; announces the ones that just switched on or grew. */
export function refreshSynergies(content: Content, state: RunState, events: GameEvent[]): void {
  for (const synergy of content.synergies) {
    // Both tiles at 2 stars = tier 1, both at 3 stars = tier 2.
    const tier = Math.min(synergy.tiers.length, Math.min(...synergy.tiles.map((id) => starsOf(state, id))) - 1);
    const before = state.synergies[synergy.id] ?? 0;
    if (tier <= 0) continue;
    if (tier > before) {
      const hpBefore = state.team.map((unit) => maxHp(content, state, unit));
      state.synergies[synergy.id] = tier;
      // Extra max HP from a synergy is granted, not left as missing health.
      state.team.forEach((unit, i) => {
        if (unit.hp > 0) unit.hp += maxHp(content, state, unit) - (hpBefore[i] ?? 0);
      });
      events.push({ type: 'SynergyActivated', id: synergy.id, tier });
    }
  }
}

export function upgradeTile(content: Content, state: RunState, events: GameEvent[]): void {
  const cost = upgradeCost(content, state);
  if (cost === null || state.gold < cost) throw new Error('upgrade is not available');
  const tile = currentTile(state);
  state.gold -= cost;
  tile.stars++;
  events.push({ type: 'GoldChanged', delta: -cost, total: state.gold, reason: 'upgrade' });
  events.push({ type: 'TileUpgraded', index: state.position, stars: tile.stars });
  refreshSynergies(content, state, events);
}
