import type { Content } from '../../data/content';
import { applyAction, legalActions } from '../apply';
import { createRng } from '../rng';
import { createRun } from '../run';
import type { Action, GameEvent, RunState } from '../types';

/** Keeps the bot's choices on a different random stream than the game's dice. */
const BOT_STREAM_SALT = 0x5bd1e995;

export type Bot = (content: Content, state: RunState, actions: Action[], pick: (count: number) => number) => Action;

/** Picks any legal action with equal chance: the floor every real strategy must beat. */
export const randomBot: Bot = (_content, _state, actions, pick) => {
  const action = actions[pick(actions.length)];
  if (!action) throw new Error('no legal action');
  return action;
};

export interface RunSummary {
  seed: number;
  result: 'won' | 'lost';
  lap: number;
  turns: number;
  hearts: number;
  eventCount: number;
  /** Final state, for determinism checks and save tests. */
  state: RunState;
}

/** Plays one whole run. The bot draws from its own seeded stream so the game's dice stay untouched. */
export function playRun(
  content: Content,
  seed: number,
  bot: Bot,
  maxActions: number,
  onEvents?: (events: GameEvent[]) => void,
  leaderId?: string,
): RunSummary {
  const botRng = createRng(seed ^ BOT_STREAM_SALT);
  let { state, events } = createRun(content, seed, leaderId);
  let eventCount = events.length;
  onEvents?.(events);
  for (let i = 0; i < maxActions && state.phase !== 'ended'; i++) {
    const actions = legalActions(content, state);
    ({ state, events } = applyAction(content, state, bot(content, state, actions, (count) => botRng.int(0, count - 1))));
    eventCount += events.length;
    onEvents?.(events);
  }
  if (state.result === null) throw new Error(`run ${seed} did not finish within ${maxActions} actions`);
  return { seed, result: state.result, lap: state.lap, turns: state.turn, hearts: state.hearts, eventCount, state };
}
