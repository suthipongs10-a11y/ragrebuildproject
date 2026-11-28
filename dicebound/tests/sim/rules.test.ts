import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../../src/data/content';
import { applyAction, IllegalActionError, legalActions } from '../../src/sim/apply';
import type { RunState } from '../../src/sim/types';
import { content, contentWith, eventsOf, forceMove, play, start } from './helpers';

const WARRIOR_TILE = 1;
const GOLD_TILE = 2;
const TRAP_TILE = 3;
const KNIGHT_TILE = 4;

/** A copy of the state with the wave replaced by a harmless dummy that survives the turn. */
function withDummyWave(state: RunState): RunState {
  return { ...state, enemies: [{ uid: 900, monsterId: 'sand_wolf', hp: 9999, maxHp: 9999, atk: 0, armor: 0, age: 0, windingUp: false }] };
}

describe('turn flow', () => {
  it('starts with the starting unit, a wave on the field and the next wave announced', () => {
    const state = start();
    expect(state.team.map((u) => u.unitId)).toEqual(content.rules.startingUnits);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.nextWave.length).toBeGreaterThan(0);
    expect(legalActions(content, state)).toEqual([{ type: 'roll' }]);
  });

  it('rejects actions that are not legal in the current phase', () => {
    expect(() => applyAction(content, start(), { type: 'move' })).toThrow(IllegalActionError);
  });

  it('never modifies the state it is given', () => {
    const state = start(7);
    const frozen = JSON.stringify(state);
    forceMove(state, GOLD_TILE);
    expect(JSON.stringify(state)).toBe(frozen);
  });

  it('spends a reroll and offers none when they run out', () => {
    const rolled = play(start(), [{ type: 'roll' }]).state;
    const rerolled = play(rolled, [{ type: 'reroll' }]).state;
    expect(rerolled.rerollsLeft).toBe(content.rules.rerollsPerLap - 1);
    const spent = { ...rerolled, rerollsLeft: 0 };
    expect(legalActions(content, spent).some((a) => a.type === 'reroll')).toBe(false);
  });

  it('moves exactly the forced face and uses up the force die', () => {
    const before = start();
    const { state, events } = forceMove(before, GOLD_TILE);
    expect(eventsOf(events, 'PawnMoved')[0]).toMatchObject({ from: 0, to: GOLD_TILE, passedGate: false });
    expect(state.forceDice).toBe(before.forceDice);
  });
});

describe('tiles', () => {
  it('gives gold on an economy tile', () => {
    const { events } = forceMove(withDummyWave(start()), GOLD_TILE);
    expect(eventsOf(events, 'GoldChanged').find((e) => e.reason === 'tile')?.delta).toBe(12);
  });

  it('doubles what a tile gives on a crit roll, and a forced six is not a crit', () => {
    const rolled = play(withDummyWave(start()), [{ type: 'roll' }]).state;
    const crit: RunState = { ...rolled, turnState: { ...rolled.turnState, roll: GOLD_TILE, crit: true } };
    const { events } = play(crit, [{ type: 'move' }]);
    expect(eventsOf(events, 'GoldChanged').find((e) => e.reason === 'tile')?.delta).toBe(24);
    const forced = forceMove(start(), content.rules.die.critFace);
    expect(eventsOf(forced.events, 'DiceRolled').at(-1)).toMatchObject({ source: 'forced', crit: false });
  });

  it('recruits a new class, then feeds XP into it until it tiers up', () => {
    let state = withDummyWave(start());
    state = forceMove(state, KNIGHT_TILE).state;
    expect(state.team.map((u) => u.unitId)).toContain('knight');
    // Back onto the warrior tile three times: 1 starting XP + 3 = tier 2 at 3 XP.
    let tierUps = 0;
    for (let i = 0; i < 3; i++) {
      const step = forceMove(withDummyWave({ ...state, position: 0 }), WARRIOR_TILE);
      state = step.state;
      tierUps += eventsOf(step.events, 'UnitTierUp').length;
    }
    expect(tierUps).toBe(1);
    expect(state.team.find((u) => u.unitId === 'warrior')?.tier).toBe(2);
  });

  it('a trap hurts the team but cannot kill', () => {
    const base = withDummyWave(start());
    const weak: RunState = { ...base, team: base.team.map((u) => ({ ...u, hp: 2 })) };
    const { state } = forceMove(weak, TRAP_TILE);
    expect(state.team.every((u) => u.hp >= 1)).toBe(true);
  });

  it('offers an upgrade only when the tile can be raised and the gold is there', () => {
    const rich = forceMove(withDummyWave({ ...start(), gold: 500 }), GOLD_TILE).state;
    expect(rich.phase).toBe('upgrade');
    const upgraded = play(rich, [{ type: 'upgrade' }]);
    expect(upgraded.state.board[GOLD_TILE]?.stars).toBe(2);
    expect(upgraded.state.gold).toBe(500 + 12 - 40);
    const poor = forceMove(withDummyWave({ ...start(), gold: 0 }), GOLD_TILE).state;
    expect(poor.phase).toBe('roll');
    const trap = forceMove(withDummyWave({ ...start(), gold: 500 }), TRAP_TILE).state;
    expect(trap.phase).toBe('roll');
  });

  it('switches a synergy on when both of its tiles reach two stars', () => {
    const base = withDummyWave({ ...start(), gold: 500 });
    const board = base.board.map((tile, i) => (i === KNIGHT_TILE ? { ...tile, stars: 2 } : tile));
    const landed = forceMove({ ...base, board }, WARRIOR_TILE).state;
    const { state, events } = play(landed, [{ type: 'upgrade' }]);
    expect(eventsOf(events, 'SynergyActivated')).toEqual([{ type: 'SynergyActivated', id: 'vanguard', tier: 1 }]);
    expect(state.synergies).toEqual({ vanguard: 1 });
  });
});

describe('data validation', () => {
  it('names the file and the missing id when a reference is broken', () => {
    expect(() => contentWith({ boards: [{ id: 'classic', tiles: ['gate', 'no_such_tile', 'gold_mine', 'gold_mine', 'gold_mine', 'gold_mine', 'gold_mine'] }] })).toThrow(
      /boards\.json: unknown tile "no_such_tile"/,
    );
  });

  it('rejects duplicate ids', () => {
    const units = RAW_CONTENT.units as unknown[];
    expect(() => contentWith({ units: [...units, units[0]] })).toThrow(/duplicate id/);
  });
});
