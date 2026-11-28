import type { Content } from '../data/content';
import type { TileDef } from '../data/gameSchema';
import { drawFate, openShop } from './extras';
import { applyInstant, changeGold } from './instant';
import { discounted, mod } from './mods';
import type { Rng } from './rng';
import { gainUnitXp, keepHpShare } from './team';
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
  const base = content.rules.upgradeCosts[tile.stars - 1];
  return base === undefined ? null : discounted(content, base, mod(content, state, 'upgradeDiscountPct'));
}

/** Applies the tile under the pawn. A crit roll doubles what the tile gives, never what it takes. */
export function applyTile(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  const tile = currentTile(state);
  const effect = tileDef(content, tile).effect;
  events.push({ type: 'TileLanded', index: state.position, tileId: tile.tileId, stars: tile.stars });
  if (effect.kind === 'none') return;
  const boost = state.turnState.tileBoost;
  const value = effect.values[tile.stars - 1] ?? 0;

  switch (effect.kind) {
    case 'recruit':
      gainUnitXp(content, state, effect.unit, Math.round(value * boost) + mod(content, state, 'xpBonus'), events);
      break;
    case 'gold':
      changeGold(content, state, value * boost + mod(content, state, 'tileGoldFlat'), 'tile', events);
      break;
    case 'damage_pct':
    case 'enemy_atk_pct':
      applyInstant(content, state, { kind: effect.kind, value }, 'tile', events);
      break;
    case 'heal_pct':
    case 'team_atk_pct':
    case 'team_shield':
    case 'xp_all':
    case 'force_die':
      applyInstant(content, state, { kind: effect.kind, value: value * boost }, 'tile', events);
      break;
    case 'shop':
      openShop(content, state, rng, tile.stars, events);
      break;
    case 'fate':
      drawFate(content, state, rng, tile.stars, events);
      break;
    case 'gamble': {
      const won = rng.next() < effect.winChance + mod(content, state, 'luckPct') / PERCENT;
      events.push({ type: 'GambleResolved', won });
      changeGold(content, state, won ? value * boost : -effect.loseGold, 'gamble', events);
      break;
    }
  }
}

/** Star level a tile id has reached anywhere on the board (best copy counts). */
function starsOf(state: RunState, tileId: string): number {
  return Math.max(0, ...state.board.filter((t) => t.tileId === tileId).map((t) => t.stars));
}

/** Re-derives active synergies after the board changed; announces the ones that switched on or grew. */
export function refreshSynergies(content: Content, state: RunState, events: GameEvent[]): void {
  keepHpShare(content, state, () => {
    for (const synergy of content.synergies) {
      // Both tiles at 2 stars = tier 1, both at 3 stars = tier 2.
      const tier = Math.max(0, Math.min(synergy.tiers.length, Math.min(...synergy.tiles.map((id) => starsOf(state, id))) - 1));
      const before = state.synergies[synergy.id] ?? 0;
      if (tier === before) continue;
      // Replacing a tile can also switch a synergy off again.
      if (tier === 0) delete state.synergies[synergy.id];
      else state.synergies[synergy.id] = tier;
      if (tier > before) events.push({ type: 'SynergyActivated', id: synergy.id, tier });
    }
  });
}

export function upgradeTile(content: Content, state: RunState, events: GameEvent[]): void {
  const cost = upgradeCost(content, state);
  if (cost === null || state.gold < cost) throw new Error('upgrade is not available');
  const tile = currentTile(state);
  changeGold(content, state, -cost, 'upgrade', events);
  tile.stars++;
  events.push({ type: 'TileUpgraded', index: state.position, stars: tile.stars });
  refreshSynergies(content, state, events);
}
