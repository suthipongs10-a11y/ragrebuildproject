import type { Content } from '../data/content';
import { refreshSynergies, tileDef, upgradeTile } from './board';
import { buy, canBuy, gainRelic } from './extras';
import { createRng } from './rng';
import type { Action, GameEvent, RunState, StepResult } from './types';
import { afterTile, finishTurn, movePawn, rollDie, setRoll } from './turn';

export class IllegalActionError extends Error {}

/** Actions the player may take right now. Empty once the run has ended. */
export function legalActions(content: Content, state: RunState): Action[] {
  const { die } = content.rules;
  const faces = Array.from({ length: die.max - die.min + 1 }, (_, i) => die.min + i);
  switch (state.phase) {
    case 'roll':
      return [{ type: 'roll' }];
    case 'decide': {
      const actions: Action[] = [{ type: 'move' }];
      if (state.rerollsLeft > 0) actions.push({ type: 'reroll' });
      if (state.turnState.warp) for (const face of faces) actions.push({ type: 'warp', face });
      else if (state.forceDice > 0) for (const face of faces) actions.push({ type: 'forceDie', face });
      return actions;
    }
    case 'shop':
      return [...state.shop.flatMap((_, index): Action[] => (canBuy(state, index) ? [{ type: 'buy', index }] : [])), { type: 'leaveShop' }];
    case 'upgrade':
      return [{ type: 'upgrade' }, { type: 'skipUpgrade' }];
    case 'reward':
      return state.rewardOptions.map((_, index): Action => ({ type: 'chooseReward', index }));
    case 'placeTile':
      // Any slot but a gate can be rebuilt.
      return state.board.flatMap((tile, index): Action[] => (tileDef(content, tile).type === 'gate' ? [] : [{ type: 'placeTile', index }]));
    case 'placeFace':
      return faces.map((face): Action => ({ type: 'placeFace', face }));
    case 'ended':
      return [];
  }
}

function chooseReward(content: Content, state: RunState, index: number, events: GameEvent[]): void {
  const option = state.rewardOptions[index];
  if (!option) throw new IllegalActionError('no such reward');
  state.rewardOptions = [];
  state.phase = 'roll';
  if (option.kind === 'relic') gainRelic(content, state, option.relicId, events);
  else if (option.kind === 'tile') {
    state.pendingTile = option.tileId;
    state.phase = 'placeTile';
  } else {
    state.pendingFace = option.faceId;
    state.phase = 'placeFace';
  }
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
      events.push({ type: 'ForceDiceChanged', delta: -1, total: next.forceDice });
      setRoll(content, next, action.face, 'forced', events);
      movePawn(content, next, rng, events);
      break;
    case 'warp':
      setRoll(content, next, action.face, 'warp', events);
      movePawn(content, next, rng, events);
      break;
    case 'move':
      movePawn(content, next, rng, events);
      break;
    case 'buy':
      buy(content, next, action.index, events);
      break;
    case 'leaveShop':
      next.shop = [];
      afterTile(content, next, rng, events);
      break;
    case 'upgrade':
      upgradeTile(content, next, events);
      finishTurn(content, next, rng, events);
      break;
    case 'skipUpgrade':
      finishTurn(content, next, rng, events);
      break;
    case 'chooseReward':
      chooseReward(content, next, action.index, events);
      break;
    case 'placeTile': {
      const tileId = next.pendingTile;
      if (!tileId) throw new IllegalActionError('no tile to place');
      next.board[action.index] = { tileId, stars: 1 };
      next.pendingTile = null;
      next.phase = 'roll';
      events.push({ type: 'TilePlaced', index: action.index, tileId });
      refreshSynergies(content, next, events);
      break;
    }
    case 'placeFace': {
      const faceId = next.pendingFace;
      if (!faceId) throw new IllegalActionError('no face to place');
      next.dieFaces[action.face - content.rules.die.min] = faceId;
      next.pendingFace = null;
      next.phase = 'roll';
      events.push({ type: 'FacePlaced', face: action.face, faceId });
      break;
    }
  }
  next.rng = rng.getState();
  return { state: next, events };
}
