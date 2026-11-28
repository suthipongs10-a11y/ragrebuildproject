import type { Content } from '../data/content';
import { playRound } from './battle';
import { applyTile, upgradeCost, upgradeTile } from './board';
import { createRng, type Rng } from './rng';
import { freshTurn } from './run';
import { reviveTeam } from './team';
import type { Action, GameEvent, RunState, StepResult } from './types';
import { drawWave, spawnGate, spawnNextWave } from './waves';

export class IllegalActionError extends Error {}

/** Actions the player may take right now. Empty once the run has ended. */
export function legalActions(content: Content, state: RunState): Action[] {
  const { die } = content.rules;
  switch (state.phase) {
    case 'roll':
      return [{ type: 'roll' }];
    case 'decide': {
      const actions: Action[] = [{ type: 'move' }];
      if (state.rerollsLeft > 0) actions.push({ type: 'reroll' });
      if (state.forceDice > 0) for (let face = die.min; face <= die.max; face++) actions.push({ type: 'forceDie', face });
      return actions;
    }
    case 'upgrade':
      return [{ type: 'upgrade' }, { type: 'skipUpgrade' }];
    case 'ended':
      return [];
  }
}

function rollDie(content: Content, state: RunState, rng: Rng, source: 'roll' | 'reroll', events: GameEvent[]): void {
  const { die } = content.rules;
  const value = rng.int(die.min, die.max);
  state.turnState.roll = value;
  state.turnState.crit = value === die.critFace;
  events.push({ type: 'DiceRolled', value, crit: state.turnState.crit, source });
}

function endRun(state: RunState, result: 'won' | 'lost', events: GameEvent[]): void {
  state.phase = 'ended';
  state.result = result;
  events.push({ type: 'RunEnded', result });
}

/** Team wiped: lose a heart, and either end the run or stand everyone back up. */
function loseHeart(content: Content, state: RunState, events: GameEvent[]): void {
  events.push({ type: 'TeamWiped' });
  state.hearts--;
  events.push({ type: 'HeartLost', hearts: state.hearts });
  if (state.hearts <= 0) endRun(state, 'lost', events);
  else reviveTeam(content, state, events);
}

/** The fight at the gate runs to a result: this is the lap's exam. */
function fightGate(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  spawnGate(content, state, events);
  let won = false;
  for (let round = 1; round <= content.rules.gateMaxRounds; round++) {
    const outcome = playRound(content, state, round, events);
    if (outcome === 'ongoing') continue;
    won = outcome === 'enemiesDead';
    break;
  }
  events.push({ type: 'GateFightEnded', won });
  if (won) state.forceDice += content.rules.forceDicePerGateWon;
  else {
    loseHeart(content, state, events);
    if (state.phase === 'ended') return;
  }
  if (state.lap >= content.laps.length) {
    // A lost final gate still ends the run: there is no lap left to recover in.
    endRun(state, won ? 'won' : 'lost', events);
    return;
  }
  state.lap++;
  state.rerollsLeft = content.rules.rerollsPerLap;
  events.push({ type: 'LapStarted', lap: state.lap });
  state.nextWave = drawWave(content, state, rng);
  spawnNextWave(content, state, rng, events);
}

/** The auto-battle that closes every turn. */
function fightWave(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  for (let round = 1; round <= content.rules.battleRoundsPerTurn; round++) {
    const outcome = playRound(content, state, round, events);
    if (outcome === 'enemiesDead') {
      events.push({ type: 'WaveCleared' });
      spawnNextWave(content, state, rng, events);
      return;
    }
    if (outcome === 'teamDead') {
      loseHeart(content, state, events);
      return;
    }
  }
}

function finishTurn(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  if (state.turnState.passedGate) fightGate(content, state, rng, events);
  else fightWave(content, state, rng, events);
  for (const unit of state.team) unit.shield = 0;
  if (state.phase === 'ended') return;
  state.turnState = freshTurn();
  state.turn++;
  state.phase = 'roll';
}

function movePawn(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  const steps = state.turnState.roll;
  if (steps === null) throw new IllegalActionError('no roll to move with');
  const from = state.position;
  const size = state.board.length;
  state.turnState.passedGate = from + steps >= size;
  state.position = (from + steps) % size;
  events.push({ type: 'PawnMoved', from, to: state.position, steps, passedGate: state.turnState.passedGate });
  applyTile(content, state, rng, events);
  const cost = upgradeCost(content, state);
  if (cost !== null && state.gold >= cost) state.phase = 'upgrade';
  else finishTurn(content, state, rng, events);
}

/**
 * The one way the game state changes. Pure: `state` is never modified, and the
 * same state + action always gives the same result (all randomness is in state.rng).
 */
export function applyAction(content: Content, state: RunState, action: Action): StepResult {
  if (!legalActions(content, state).some((legal) => JSON.stringify(legal) === JSON.stringify(action))) {
    throw new IllegalActionError(`"${action.type}" is not allowed in phase "${state.phase}"`);
  }
  const next = structuredClone(state);
  const rng = createRng(next.rng);
  const events: GameEvent[] = [];
  switch (action.type) {
    case 'roll':
      rollDie(content, next, rng, 'roll', events);
      next.phase = 'decide';
      break;
    case 'reroll':
      next.rerollsLeft--;
      rollDie(content, next, rng, 'reroll', events);
      break;
    case 'forceDie':
      next.forceDice--;
      next.turnState.roll = action.face;
      next.turnState.crit = content.rules.die.forcedDieCanCrit && action.face === content.rules.die.critFace;
      events.push({ type: 'DiceRolled', value: action.face, crit: next.turnState.crit, source: 'forced' });
      movePawn(content, next, rng, events);
      break;
    case 'move':
      movePawn(content, next, rng, events);
      break;
    case 'upgrade':
      upgradeTile(content, next, events);
      finishTurn(content, next, rng, events);
      break;
    case 'skipUpgrade':
      finishTurn(content, next, rng, events);
      break;
  }
  next.rng = rng.getState();
  return { state: next, events };
}

