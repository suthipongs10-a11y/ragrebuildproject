import type { Content } from '../data/content';
import { playRound } from './battle';
import { applyTile, upgradeCost } from './board';
import { offerReward } from './extras';
import { applyInstant, changeGold } from './instant';
import { critMultiplier, mod, rerollsPerLap } from './mods';
import type { Rng } from './rng';
import { freshTurn } from './run';
import { reviveTeam } from './team';
import type { GameEvent, Phase, RunState } from './types';
import { drawWave, spawnGate, spawnNextWave } from './waves';

const PERCENT = 100;

/** Sets the roll for this turn and fires the special face on that side of the die, if any. */
export function setRoll(content: Content, state: RunState, value: number, source: 'roll' | 'reroll' | 'forced' | 'warp', events: GameEvent[]): void {
  const { die } = content.rules;
  const natural = source === 'roll' || source === 'reroll';
  const faceId = natural ? (state.dieFaces[value - die.min] ?? null) : null;
  const face = faceId ? content.faces[faceId] : undefined;
  const turn = state.turnState;
  turn.roll = value;
  turn.face = face ? face.id : null;
  turn.warp = face?.effect.kind === 'warp';
  turn.crit = (natural || die.forcedDieCanCrit) && (value === die.critFace || face?.effect.kind === 'crit');
  turn.tileBoost = (turn.crit ? critMultiplier(content, state) : 1) * (face?.effect.kind === 'double_tile' ? 2 : 1);
  events.push({ type: 'DiceRolled', value, crit: turn.crit, source, face: turn.face });
  if (face?.effect.kind === 'instants') for (const instant of face.effect.instants) applyInstant(content, state, instant, 'effect', events);
}

export function rollDie(content: Content, state: RunState, rng: Rng, source: 'roll' | 'reroll', events: GameEvent[]): void {
  // A reroll starts the turn's modifiers over, so a discarded face leaves no buff behind.
  state.turnState = freshTurn();
  setRoll(content, state, rng.int(content.rules.die.min, content.rules.die.max), source, events);
}

function endRun(state: RunState, result: 'won' | 'lost', events: GameEvent[]): void {
  state.phase = 'ended';
  state.result = result;
  events.push({ type: 'RunEnded', result });
}

/** Team wiped: lose a heart (unless a relic takes the blow), then end the run or stand everyone back up. */
function loseHeart(content: Content, state: RunState, events: GameEvent[]): void {
  events.push({ type: 'TeamWiped' });
  if (state.wipeShields > 0) {
    state.wipeShields--;
    events.push({ type: 'WipePrevented', shieldsLeft: state.wipeShields });
  } else {
    state.hearts--;
    events.push({ type: 'HeartLost', hearts: state.hearts });
  }
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
  if (won) applyInstant(content, state, { kind: 'force_die', value: content.rules.forceDicePerGateWon + mod(content, state, 'forceDicePerGate') }, 'effect', events);
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
  state.rerollsLeft = rerollsPerLap(content, state);
  events.push({ type: 'LapStarted', lap: state.lap });
  const interest = Math.min(content.rules.lapInterestCap, Math.floor((state.gold * mod(content, state, 'lapInterestPct')) / PERCENT));
  changeGold(content, state, interest, 'interest', events, false);
  state.nextWave = drawWave(content, state, rng);
  spawnNextWave(content, state, rng, events);
  if (won) offerReward(content, state, rng, events);
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

/** Fight, clean up the turn, and hand control back (to the next roll, or to a reward choice). */
export function finishTurn(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  state.phase = 'roll';
  if (state.turnState.passedGate) fightGate(content, state, rng, events);
  else fightWave(content, state, rng, events);
  for (const unit of state.team) unit.shield = 0;
  state.shop = [];
  // The fights above may have ended the run; the assignment at the top hides that from the type checker.
  if ((state.phase as Phase) === 'ended') return;
  state.turnState = freshTurn();
  state.turn++;
}

/** After the tile (and any shopping): offer the upgrade if it is affordable, otherwise fight. */
export function afterTile(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  const cost = upgradeCost(content, state);
  if (cost !== null && state.gold >= cost) state.phase = 'upgrade';
  else finishTurn(content, state, rng, events);
}

export function movePawn(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  const steps = state.turnState.roll;
  if (steps === null) throw new Error('no roll to move with');
  const from = state.position;
  const size = state.board.length;
  state.turnState.passedGate = from + steps >= size;
  state.position = (from + steps) % size;
  events.push({ type: 'PawnMoved', from, to: state.position, steps, passedGate: state.turnState.passedGate });
  applyTile(content, state, rng, events);
  if (state.shop.length > 0) state.phase = 'shop';
  else afterTile(content, state, rng, events);
}
