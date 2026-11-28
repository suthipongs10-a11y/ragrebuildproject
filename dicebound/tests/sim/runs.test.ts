import { describe, expect, it } from 'vitest';
import { applyAction, legalActions } from '../../src/sim/apply';
import { playRun, randomBot } from '../../src/sim/bots/randomBot';
import { createRun } from '../../src/sim/run';
import type { GameEvent } from '../../src/sim/types';
import { content } from './helpers';

const RUNS = 1000;
const MAX_ACTIONS = 2000;

describe('whole runs with the random bot', () => {
  it(`plays ${RUNS} runs to the end without crashing or breaking an invariant`, () => {
    let won = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const summary = playRun(content, seed, randomBot, MAX_ACTIONS);
      if (summary.result === 'won') won++;
      const { state } = summary;
      expect(state.gold).toBeGreaterThanOrEqual(0);
      expect(state.team.length).toBeLessThanOrEqual(content.rules.teamMax);
      expect(state.hearts).toBeGreaterThanOrEqual(0);
      expect(state.board.every((t) => t.stars >= 1 && t.stars <= content.rules.maxStars)).toBe(true);
      expect(legalActions(content, state)).toEqual([]);
      if (summary.result === 'lost') expect(state.hearts === 0 || state.lap === content.laps.length).toBe(true);
    }
    // Not a balance target yet (that is M5) — just proof both endings are reachable.
    expect(won).toBeGreaterThan(0);
    expect(won).toBeLessThan(RUNS);
  });

  it('gives the same run, event for event, from the same seed', () => {
    const record = (): string => {
      const log: GameEvent[] = [];
      const summary = playRun(content, 20261128, randomBot, MAX_ACTIONS, (events) => log.push(...events));
      return JSON.stringify({ log, state: summary.state });
    };
    expect(record()).toBe(record());
  });

  it('gives different runs from different seeds', () => {
    expect(JSON.stringify(createRun(content, 1).state.nextWave) + playRun(content, 1, randomBot, MAX_ACTIONS).eventCount).not.toBe(
      JSON.stringify(createRun(content, 2).state.nextWave) + playRun(content, 2, randomBot, MAX_ACTIONS).eventCount,
    );
  });

  it('continues identically after a save/load in the middle of a run', () => {
    let live = createRun(content, 99).state;
    for (let i = 0; i < 25 && live.phase !== 'ended'; i++) live = applyAction(content, live, legalActions(content, live)[0] ?? { type: 'roll' }).state;
    let loaded = JSON.parse(JSON.stringify(live)) as typeof live;
    for (let i = 0; i < 40 && live.phase !== 'ended'; i++) {
      const action = legalActions(content, live)[0] ?? { type: 'roll' };
      live = applyAction(content, live, action).state;
      loaded = applyAction(content, loaded, action).state;
    }
    expect(loaded).toEqual(live);
  });
});
