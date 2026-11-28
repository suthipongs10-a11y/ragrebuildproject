import { loadContent, parseContent, RAW_CONTENT, type Content } from '../../src/data/content';
import { applyAction } from '../../src/sim/apply';
import { createRun } from '../../src/sim/run';
import type { Action, GameEvent, RunState } from '../../src/sim/types';

export const content = loadContent();

/** Content with some raw files replaced, for testing rules in isolation. */
export function contentWith(overrides: Partial<typeof RAW_CONTENT>): Content {
  return parseContent({ ...RAW_CONTENT, ...overrides });
}

export function start(seed = 1, using: Content = content): RunState {
  return createRun(using, seed).state;
}

/** Applies actions in order and returns the final state plus every event. */
export function play(state: RunState, actions: Action[], using: Content = content): { state: RunState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  for (const action of actions) {
    const step = applyAction(using, current, action);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

export function eventsOf<T extends GameEvent['type']>(events: GameEvent[], type: T): Array<Extract<GameEvent, { type: T }>> {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

/** Rolls, then moves a chosen number of steps with a force die (so tests do not depend on luck). */
export function forceMove(state: RunState, face: number, using: Content = content): { state: RunState; events: GameEvent[] } {
  return play({ ...state, forceDice: state.forceDice + 1 }, [{ type: 'roll' }, { type: 'forceDie', face }], using);
}
