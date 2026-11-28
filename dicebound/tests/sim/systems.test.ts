import { describe, expect, it } from 'vitest';
import { legalActions } from '../../src/sim/apply';
import { upgradeCost } from '../../src/sim/board';
import { playRun, randomBot } from '../../src/sim/bots/randomBot';
import { smartBot } from '../../src/sim/bots/smartBot';
import { createRun } from '../../src/sim/run';
import type { EnemyState, GameEvent, RunState } from '../../src/sim/types';
import { content, eventsOf, forceMove, play, start } from './helpers';

const GOLD_TILE = 2;
const TRAP_TILE = 3;
const FATE_TILE = 9;
const BAZAAR_TILE = 14;
const RUNS = 1000;
const MAX_ACTIONS = 4000;

const dummy = (over: Partial<EnemyState> = {}): EnemyState => ({ uid: 900, monsterId: 'sand_wolf', hp: 9999, maxHp: 9999, atk: 0, armor: 0, age: 0, windingUp: false, ...over });
const calm = (state: RunState): RunState => ({ ...state, enemies: [dummy()] });
/** One huge fighter standing just before the gate: the next move wins the gate fight. */
const atGate = (state: RunState): RunState => ({ ...state, position: state.board.length - 1, team: [{ uid: 1, unitId: 'warrior', xp: 7, tier: 3, hp: 99999, shield: 0 }] });

describe('leaders', () => {
  it('the captain brings a knight, the gambler an extra reroll, the merchant cheaper upgrades', () => {
    expect(createRun(content, 1, 'captain').state.team.map((u) => u.unitId)).toEqual(['warrior', 'knight']);
    expect(createRun(content, 1, 'gambler').state.rerollsLeft).toBe(content.rules.rerollsPerLap + 1);
    const merchant = { ...createRun(content, 1, 'merchant').state, position: GOLD_TILE };
    expect(upgradeCost(content, merchant)).toBe(28);
    expect(upgradeCost(content, { ...start(), position: GOLD_TILE })).toBe(40);
  });
});

describe('relics', () => {
  it('raise team damage, crit multiplier and gold as their data says', () => {
    const base = calm(start());
    const hit = (state: RunState): number => eventsOf(forceMove(state, TRAP_TILE).events, 'UnitAttacked')[0]?.damage ?? 0;
    expect(hit({ ...base, relics: ['war_drum'] })).toBeGreaterThan(hit(base));
    const gold = (state: RunState): number => eventsOf(forceMove(state, GOLD_TILE).events, 'GoldChanged').find((e) => e.reason === 'tile')?.delta ?? 0;
    expect(gold({ ...base, relics: ['golden_horseshoe'] })).toBe(14);
    expect(gold({ ...base, relics: ['treasure_map'] })).toBe(20);
  });

  it('the phoenix feather absorbs one wipe', () => {
    const base = start();
    const doomed: RunState = { ...base, wipeShields: 1, team: base.team.map((u) => ({ ...u, hp: 1 })), enemies: [dummy({ atk: 500 })] };
    const { state, events } = forceMove(doomed, TRAP_TILE);
    expect(eventsOf(events, 'WipePrevented')).toHaveLength(1);
    expect(state.hearts).toBe(base.hearts);
    expect(state.wipeShields).toBe(0);
  });

  it('thorns hurt whoever hits the team', () => {
    const base = start();
    const { events } = forceMove({ ...base, relics: ['thorn_crown'], enemies: [dummy({ atk: 5, hp: 9999 })] }, TRAP_TILE);
    expect(eventsOf(events, 'ThornsDamage')[0]?.damage).toBe(3);
  });
});

describe('bazaar and fate deck', () => {
  it('opens a shop, sells an item once, then carries on with the turn', () => {
    const landed = forceMove(calm({ ...start(), gold: 500, position: BAZAAR_TILE - 1 }), 1);
    expect(landed.state.phase).toBe('shop');
    expect(eventsOf(landed.events, 'ShopOpened')[0]?.offers).toHaveLength(content.rules.shopOffers);
    const bought = play(landed.state, [{ type: 'buy', index: 0 }]);
    expect(bought.state.gold).toBe(500 - (landed.state.shop[0]?.cost ?? 0));
    expect(legalActions(content, bought.state)).not.toContainEqual({ type: 'buy', index: 0 });
    const left = play(bought.state, [{ type: 'leaveShop' }]).state;
    expect(['upgrade', 'roll']).toContain(left.phase);
    expect(left.shop).toEqual([]);
  });

  it('cannot buy what it cannot afford', () => {
    const landed = forceMove(calm({ ...start(), gold: 0, position: BAZAAR_TILE - 1 }), 1).state;
    expect(legalActions(content, landed)).toEqual([{ type: 'leaveShop' }]);
  });

  it('draws exactly one fate card', () => {
    const { events } = forceMove(calm({ ...start(), position: FATE_TILE - 1 }), 1);
    expect(eventsOf(events, 'FateDrawn')).toHaveLength(1);
  });
});

describe('gate rewards', () => {
  const won = (): RunState => forceMove(atGate(start()), GOLD_TILE).state;

  it('offers a tile, a relic and a die face after a won gate', () => {
    const state = won();
    expect(state.phase).toBe('reward');
    expect(state.rewardOptions.map((o) => o.kind)).toEqual(['tile', 'relic', 'face']);
  });

  it('a relic is owned at once', () => {
    const state = play(won(), [{ type: 'chooseReward', index: 1 }]).state;
    expect(state.relics).toHaveLength(1);
    expect(state.phase).toBe('roll');
  });

  it('a tile is built over a chosen slot, but never over the gate', () => {
    const chosen = play(won(), [{ type: 'chooseReward', index: 0 }]).state;
    expect(chosen.phase).toBe('placeTile');
    expect(legalActions(content, chosen)).not.toContainEqual({ type: 'placeTile', index: 0 });
    const placed = play(chosen, [{ type: 'placeTile', index: TRAP_TILE }]).state;
    expect(placed.board[TRAP_TILE]).toEqual({ tileId: chosen.pendingTile, stars: 1 });
    expect(placed.phase).toBe('roll');
  });

  it('a special face is put on a chosen side of the die and fires when rolled', () => {
    const chosen = play(won(), [{ type: 'chooseReward', index: 2 }]).state;
    expect(chosen.phase).toBe('placeFace');
    const placed = play(chosen, [{ type: 'placeFace', face: 1 }]).state;
    expect(placed.dieFaces[0]).toBe(chosen.pendingFace);
    const golden: RunState = { ...calm(start()), dieFaces: start().dieFaces.map(() => 'gold') };
    const rolled = play(golden, [{ type: 'roll' }]);
    expect(eventsOf(rolled.events, 'DiceRolled')[0]?.face).toBe('gold');
    expect(rolled.state.gold).toBe(golden.gold + 15);
  });

  it('the warp face lets the roll become any face without spending a force die', () => {
    const warped: RunState = { ...calm(start()), forceDice: 0, dieFaces: start().dieFaces.map(() => 'warp') };
    const rolled = play(warped, [{ type: 'roll' }]).state;
    expect(legalActions(content, rolled).filter((a) => a.type === 'warp')).toHaveLength(6);
    const moved = play(rolled, [{ type: 'warp', face: GOLD_TILE }]);
    expect(eventsOf(moved.events, 'PawnMoved')[0]?.to).toBe(GOLD_TILE);
    expect(moved.state.forceDice).toBe(0);
  });
});

describe('bots across every system', () => {
  it(`the smart bot finishes ${RUNS} runs, touches every system, and beats the random bot`, () => {
    const seen = new Set<GameEvent['type']>();
    const wins = { smart: 0, random: 0 };
    const leaders = Object.keys(content.leaders);
    for (let seed = 1; seed <= RUNS; seed++) {
      const leader = leaders[seed % leaders.length];
      if (playRun(content, seed, smartBot, MAX_ACTIONS, (events) => events.forEach((e) => seen.add(e.type)), leader).result === 'won') wins.smart++;
      if (playRun(content, seed, randomBot, MAX_ACTIONS, undefined, leader).result === 'won') wins.random++;
    }
    for (const type of ['ShopOpened', 'ItemBought', 'FateDrawn', 'RewardOffered', 'RelicGained', 'TilePlaced', 'FacePlaced', 'SynergyActivated', 'TileUpgraded', 'UnitTierUp'] as const) {
      expect(seen, `no run ever produced ${type}`).toContain(type);
    }
    expect(wins.smart).toBeGreaterThan(wins.random);
  });
});
