import { describe, expect, it } from 'vitest';
import { playRound } from '../../src/sim/battle';
import { maxHp } from '../../src/sim/team';
import type { EnemyState, GameEvent, RunState, UnitState } from '../../src/sim/types';
import { content, eventsOf, forceMove, start } from './helpers';

const GOLD_TILE = 2;
/** Not upgradable, so the turn always runs straight through to the battle. */
const TRAP_TILE = 3;

function enemy(uid: number, monsterId: string, over: Partial<EnemyState> = {}): EnemyState {
  const def = content.monsters[monsterId];
  if (!def) throw new Error(monsterId);
  return { uid, monsterId, hp: def.hp, maxHp: def.hp, atk: def.atk, armor: def.armor, age: 0, windingUp: false, ...over };
}

/** A battle-ready copy of the state with the given team (full HP) and enemies. */
function arena(unitIds: string[], enemies: EnemyState[]): RunState {
  const state = structuredClone(start());
  state.team = unitIds.map((unitId, i): UnitState => ({ uid: i + 1, unitId, xp: 0, tier: 1, hp: 0, shield: 0 }));
  for (const unit of state.team) unit.hp = maxHp(content, state, unit);
  state.enemies = enemies;
  return state;
}

function round(state: RunState): GameEvent[] {
  const events: GameEvent[] = [];
  playRound(content, state, 1, events);
  return events;
}

describe('targeting', () => {
  it('melee hits the front enemy, archers the back one, mages everyone', () => {
    const state = arena(['warrior', 'archer', 'mage'], [enemy(10, 'cactus_brute'), enemy(11, 'cactus_brute')]);
    const hits = eventsOf(round(state), 'UnitAttacked').filter((e) => e.side === 'team');
    expect(hits.filter((e) => e.source === 1).map((e) => e.target)).toEqual([10]);
    expect(hits.filter((e) => e.source === 2).map((e) => e.target)).toEqual([11]);
    expect(hits.filter((e) => e.source === 3).map((e) => e.target)).toEqual([10, 11]);
  });

  it('ground monsters hit the front row, flying ones reach the back', () => {
    const state = arena(['knight', 'archer'], [enemy(10, 'sand_wolf', { hp: 999 }), enemy(11, 'vulture', { hp: 999 })]);
    const hits = eventsOf(round(state), 'UnitAttacked').filter((e) => e.side === 'enemy');
    expect(hits.find((e) => e.source === 10)?.target).toBe(1);
    expect(hits.find((e) => e.source === 11)?.target).toBe(2);
  });

  it('a cleric heals the most hurt ally instead of attacking', () => {
    const state = arena(['warrior', 'cleric'], [enemy(10, 'sand_wolf', { hp: 999, atk: 0 })]);
    const warrior = state.team[0] as UnitState;
    warrior.hp -= 30;
    const events = round(state);
    expect(eventsOf(events, 'UnitHealed')[0]).toMatchObject({ source: 2, target: 1, amount: 10 });
  });
});

describe('damage', () => {
  it('subtracts armor but always deals the minimum', () => {
    const state = arena(['cleric'], [enemy(10, 'scorpion', { hp: 999, atk: 0 })]);
    // Cleric attack 5 vs scorpion armor 4, nobody to heal.
    expect(eventsOf(round(state), 'UnitAttacked')[0]?.damage).toBe(1);
  });

  it('a shield soaks damage before HP', () => {
    const state = arena(['warrior'], [enemy(10, 'cactus_brute', { hp: 999 })]);
    const warrior = state.team[0] as UnitState;
    warrior.shield = 5;
    const hpBefore = warrior.hp;
    const hit = eventsOf(round(state), 'UnitAttacked').find((e) => e.side === 'enemy');
    // Brute 10 atk - warrior 1 armor = 9: 5 absorbed, 4 through.
    expect(hit).toMatchObject({ absorbed: 5, damage: 4 });
    expect(warrior.hp).toBe(hpBefore - 4);
  });

  it('a crit turn doubles team damage', () => {
    const state = arena(['warrior'], [enemy(10, 'cactus_brute', { hp: 999, atk: 0 })]);
    state.turnState.crit = true;
    // (12 atk x 2) - 1 armor.
    expect(eventsOf(round(state), 'UnitAttacked')[0]?.damage).toBe(23);
  });

  it('a thief steals gold when it lands a hit', () => {
    const state = arena(['knight'], [enemy(10, 'goblin_thief', { hp: 999 })]);
    state.gold = 3;
    const stolen = eventsOf(round(state), 'GoldChanged').find((e) => e.reason === 'stolen');
    expect(stolen?.delta).toBe(-3);
    expect(state.gold).toBe(0);
  });

  it('killing a monster pays its bounty', () => {
    const state = arena(['warrior'], [enemy(10, 'sand_wolf', { hp: 1 })]);
    const gold = state.gold;
    round(state);
    expect(state.gold).toBe(gold + 4);
  });
});

describe('boss', () => {
  it('telegraphs for one round, then hits the whole team', () => {
    const state = arena(['knight', 'archer'], [enemy(10, 'stone_golem', { hp: 99999 })]);
    const perRound = [1, 2, 3, 4].map(() => round(state));
    // period 4: rounds 1-2 normal, round 3 wind-up (no attack), round 4 special on everyone.
    expect(eventsOf(perRound[2] ?? [], 'BossWindup')).toHaveLength(1);
    expect(eventsOf(perRound[2] ?? [], 'UnitAttacked').filter((e) => e.side === 'enemy')).toHaveLength(0);
    expect(eventsOf(perRound[3] ?? [], 'BossSpecial')).toHaveLength(1);
    expect(eventsOf(perRound[3] ?? [], 'UnitAttacked').filter((e) => e.side === 'enemy' && e.area).map((e) => e.target)).toEqual([1, 2]);
  });
});

describe('wipes and gates', () => {
  it('a wiped team costs a heart and stands back up', () => {
    const base = start();
    const doomed: RunState = {
      ...base,
      team: base.team.map((u) => ({ ...u, hp: 1 })),
      enemies: [enemy(10, 'cactus_brute', { hp: 9999, atk: 500 })],
    };
    const { state, events } = forceMove(doomed, TRAP_TILE);
    expect(eventsOf(events, 'TeamWiped')).toHaveLength(1);
    expect(state.hearts).toBe(base.hearts - 1);
    expect(state.team.every((u) => u.hp > 0)).toBe(true);
  });

  it('losing the last heart ends the run', () => {
    const base = start();
    const doomed: RunState = { ...base, hearts: 1, team: base.team.map((u) => ({ ...u, hp: 1 })), enemies: [enemy(10, 'cactus_brute', { hp: 9999, atk: 500 })] };
    const { state } = forceMove(doomed, TRAP_TILE);
    expect(state).toMatchObject({ phase: 'ended', result: 'lost' });
  });

  it('crossing the gate fights the gate, then starts the next lap with fresh rerolls', () => {
    const base = start();
    const strong: RunState = {
      ...base,
      position: base.board.length - 1,
      rerollsLeft: 0,
      team: [{ uid: 1, unitId: 'warrior', xp: 7, tier: 3, hp: 99999, shield: 0 }],
    };
    const { state, events } = forceMove(strong, GOLD_TILE);
    expect(eventsOf(events, 'GateFightStarted')[0]?.kind).toBe('elite');
    expect(eventsOf(events, 'GateFightEnded')[0]?.won).toBe(true);
    expect(state.lap).toBe(2);
    expect(state.rerollsLeft).toBe(content.rules.rerollsPerLap);
    expect(state.forceDice).toBe(strong.forceDice + content.rules.forceDicePerGateWon);
  });

  it('beating the last gate wins the run', () => {
    const base = start();
    const strong: RunState = { ...base, lap: content.laps.length, position: base.board.length - 1, team: [{ uid: 1, unitId: 'warrior', xp: 7, tier: 3, hp: 99999, shield: 0 }] };
    const { state, events } = forceMove(strong, GOLD_TILE);
    expect(eventsOf(events, 'GateFightStarted')[0]?.kind).toBe('boss');
    expect(state).toMatchObject({ phase: 'ended', result: 'won' });
  });
});
