import type { Content } from '../data/content';
import { createRng, createRngState } from './rng';
import { gainUnitXp } from './team';
import type { GameEvent, RunState, StepResult, TurnState } from './types';
import { drawWave, spawnNextWave } from './waves';

export function freshTurn(): TurnState {
  return { roll: null, crit: false, teamAtkPct: 0, enemyAtkPct: 0, passedGate: false };
}

/** Starts a run. Everything random about it follows from `seed`. */
export function createRun(content: Content, seed: number): StepResult {
  const { rules } = content;
  const board = content.boards[rules.startingBoard];
  if (!board) throw new Error(`unknown board "${rules.startingBoard}"`);
  const events: GameEvent[] = [{ type: 'RunStarted', seed }];
  const state: RunState = {
    seed,
    rng: createRngState(seed),
    phase: 'roll',
    result: null,
    lap: 1,
    turn: 1,
    hearts: rules.hearts,
    gold: rules.startGold,
    rerollsLeft: rules.rerollsPerLap,
    forceDice: rules.startForceDice,
    position: 0,
    board: board.tiles.map((tileId) => ({ tileId, stars: 1 })),
    team: [],
    enemies: [],
    nextWave: [],
    synergies: {},
    turnState: freshTurn(),
    nextUid: 1,
  };
  const rng = createRng(state.rng);
  for (const unitId of rules.startingUnits) gainUnitXp(content, state, unitId, 1, events);
  state.nextWave = drawWave(content, state, rng);
  spawnNextWave(content, state, rng, events);
  events.push({ type: 'LapStarted', lap: 1 });
  state.rng = rng.getState();
  return { state, events };
}
