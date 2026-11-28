import type { Content } from '../../data/content';
import { maxHp } from '../team';
import type { Action, RunState } from '../types';
import type { Bot } from './randomBot';

/** How much the bot wants to land on a tile right now. Hand-tuned, only meant to be sensible. */
const WANT = { recruitNew: 5, recruitGrow: 3, gold: 2, buff: 2, shop: 2, fate: 1, gamble: 1, heal: 6, trap: -3, ambush: -2, gateWhenHurt: -3 };
const HURT_SHARE = 0.5;
const REROLL_BELOW = 1;
const FORCE_GAIN = 3;
const SHOP_PRIORITY = ['relic_crate', 'war_tome', 'force_die', 'potion', 'reroll_charm'];
/** Rotated by how many rewards were already taken, so a run builds relics, the board and the die. */
const REWARD_ORDERS = [
  ['relic', 'tile', 'face'],
  ['tile', 'face', 'relic'],
  ['face', 'relic', 'tile'],
];

function teamHealth(content: Content, state: RunState): number {
  const alive = state.team.filter((u) => u.hp > 0);
  if (alive.length === 0) return 0;
  return alive.reduce((sum, u) => sum + u.hp / maxHp(content, state, u), 0) / alive.length;
}

function landingScore(content: Content, state: RunState, steps: number): number {
  const landing = state.position + steps;
  const tile = state.board[landing % state.board.length];
  const effect = tile ? content.tiles[tile.tileId]?.effect : undefined;
  if (!tile || !effect) return 0;
  const health = teamHealth(content, state);
  let score = landing >= state.board.length && health < HURT_SHARE ? WANT.gateWhenHurt : 0;
  switch (effect.kind) {
    case 'recruit': {
      const owned = state.team.some((u) => u.unitId === effect.unit);
      const canGrow = state.team.some((u) => u.unitId === effect.unit && u.tier < content.rules.unitXpForTier.length);
      score += !owned && state.team.length < content.rules.teamMax ? WANT.recruitNew : canGrow ? WANT.recruitGrow : 0;
      break;
    }
    case 'xp_all':
      score += WANT.recruitGrow;
      break;
    case 'gold':
    case 'force_die':
      score += WANT.gold;
      break;
    case 'heal_pct':
      score += WANT.heal * (1 - health);
      break;
    case 'team_atk_pct':
    case 'team_shield':
      score += WANT.buff;
      break;
    case 'shop':
      score += WANT.shop;
      break;
    case 'fate':
      score += WANT.fate;
      break;
    case 'gamble':
      score += WANT.gamble;
      break;
    case 'damage_pct':
      score += WANT.trap;
      break;
    case 'enemy_atk_pct':
      score += WANT.ambush;
      break;
    case 'none':
      break;
  }
  return score;
}

/** A sensible player: aims rolls at useful tiles, upgrades, shops and takes rewards. Never random. */
export const smartBot: Bot = (content, state, actions) => {
  const first = actions[0];
  if (!first) throw new Error('no legal action');
  const of = <T extends Action['type']>(type: T): Array<Extract<Action, { type: T }>> =>
    actions.filter((a): a is Extract<Action, { type: T }> => a.type === type);

  switch (state.phase) {
    case 'decide': {
      const moveScore = landingScore(content, state, state.turnState.roll ?? 0);
      const picks = [...of('warp'), ...of('forceDie')];
      const best = picks.map((a) => ({ a, score: landingScore(content, state, a.face) })).sort((x, y) => y.score - x.score)[0];
      if (best && best.a.type === 'warp' && best.score > moveScore) return best.a;
      if (moveScore < REROLL_BELOW && of('reroll').length > 0) return { type: 'reroll' };
      if (best && best.score - moveScore >= FORCE_GAIN) return best.a;
      return { type: 'move' };
    }
    case 'shop': {
      const hurt = teamHealth(content, state) < HURT_SHARE;
      for (const itemId of SHOP_PRIORITY) {
        if (itemId === 'potion' && !hurt) continue;
        const buy = of('buy').find((a) => state.shop[a.index]?.itemId === itemId);
        if (buy) return buy;
      }
      return { type: 'leaveShop' };
    }
    case 'upgrade':
      return { type: 'upgrade' };
    case 'reward': {
      const taken = state.relics.length + state.dieFaces.filter((face) => face !== null).length;
      for (const kind of REWARD_ORDERS[taken % REWARD_ORDERS.length] ?? []) {
        const choice = of('chooseReward').find((a) => state.rewardOptions[a.index]?.kind === kind);
        if (choice) return choice;
      }
      return first;
    }
    case 'placeTile': {
      // Build over the worst tile: a trap first, then any other risk, then the least developed slot.
      const rank = (index: number): number => {
        const tile = state.board[index];
        const def = tile ? content.tiles[tile.tileId] : undefined;
        if (!tile || !def) return 0;
        return (def.type === 'risk' ? (def.upgradable ? 10 : 20) : 0) - tile.stars;
      };
      return of('placeTile').sort((a, b) => rank(b.index) - rank(a.index))[0] ?? first;
    }
    case 'placeFace':
      // Keep the natural six (the crit); fill empty sides from the lowest number up.
      return of('placeFace').find((a) => a.face !== content.rules.die.critFace && state.dieFaces[a.face - content.rules.die.min] === null) ?? first;
    default:
      return first;
  }
};
