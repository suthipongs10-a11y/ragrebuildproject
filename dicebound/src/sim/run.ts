import type { Content } from '../data/content';
import { rerollsPerLap } from './mods';
import { createRng, createRngState } from './rng';
import { gainUnitXp } from './team';
import type { GameEvent, RunState, StepResult, TurnState } from './types';
import { drawWave, spawnNextWave } from './waves';

export function freshTurn(): TurnState {
  return { roll: null, crit: false, face: null, tileBoost: 1, warp: false, teamAtkPct: 0, enemyAtkPct: 0, passedGate: false };
}

/** Starts a run. Everything random about it follows from `seed`. */
export function createRun(content: Content, seed: number, leaderId: string = content.rules.startingLeader): StepResult {
  const { rules } = content;
  const board = content.boards[rules.startingBoard];
  const leader = content.leaders[leaderId];
  if (!board) throw new Error(`unknown board "${rules.startingBoard}"`);
  if (!leader) throw new Error(`unknown leader "${leaderId}"`);
  const events: GameEvent[] = [{ type: 'RunStarted', seed }];
  const state: RunState = {
    seed,
    rng: createRngState(seed),
    leaderId,
    relics: [],
    dieFaces: Array.from({ length: rules.die.max - rules.die.min + 1 }, () => null),
    wipeShields: 0,
    rewardOptions: [],
    shop: [],
    pendingTile: null,
    pendingFace: null,
    phase: 'roll',
    result: null,
    lap: 1,
    turn: 1,
    hearts: rules.hearts,
    gold: rules.startGold,
    rerollsLeft: 0,
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
  state.rerollsLeft = rerollsPerLap(content, state);
  const rng = createRng(state.rng);
  for (const unitId of [...rules.startingUnits, ...leader.startingUnits]) gainUnitXp(content, state, unitId, 1, events);
  state.nextWave = drawWave(content, state, rng);
  spawnNextWave(content, state, rng, events);
  events.push({ type: 'LapStarted', lap: 1 });
  state.rng = rng.getState();
  return { state, events };
}
