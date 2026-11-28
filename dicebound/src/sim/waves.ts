import type { Content } from '../data/content';
import type { LapDef } from '../data/gameSchema';
import { mod, scaled } from './mods';
import type { Rng } from './rng';
import type { EnemyState, GameEvent, RunState } from './types';

export function lapDef(content: Content, state: RunState): LapDef {
  const lap = content.laps[state.lap - 1];
  if (!lap) throw new Error(`no data for lap ${state.lap}`);
  return lap;
}

function spawn(content: Content, state: RunState, monsterIds: string[]): EnemyState[] {
  const scale = lapDef(content, state).enemyScale;
  return monsterIds.map((monsterId) => {
    const def = content.monsters[monsterId];
    if (!def) throw new Error(`unknown monster "${monsterId}"`);
    const hp = Math.max(1, Math.round(scaled(def.hp * scale, mod(content, state, 'enemyHpPct'))));
    return { uid: state.nextUid++, monsterId, hp, maxHp: hp, atk: Math.max(1, Math.round(def.atk * scale)), armor: def.armor, age: 0, windingUp: false };
  });
}

export function drawWave(content: Content, state: RunState, rng: Rng): string[] {
  const pool = content.wavePools[lapDef(content, state).wavePool];
  if (!pool) throw new Error(`unknown wave pool for lap ${state.lap}`);
  const wave = pool.waves[rng.int(0, pool.waves.length - 1)];
  if (!wave) throw new Error('empty wave pool');
  return [...wave];
}

/** Brings the announced wave onto the field and announces the one after it. */
export function spawnNextWave(content: Content, state: RunState, rng: Rng, events: GameEvent[]): void {
  state.enemies = spawn(content, state, state.nextWave);
  state.nextWave = drawWave(content, state, rng);
  events.push({ type: 'WaveSpawned', enemies: state.enemies.map((e) => ({ uid: e.uid, monsterId: e.monsterId, hp: e.hp })), nextWave: [...state.nextWave] });
}

export function spawnGate(content: Content, state: RunState, events: GameEvent[]): void {
  const gate = lapDef(content, state).gate;
  state.enemies = spawn(content, state, gate.monsters);
  events.push({ type: 'GateFightStarted', kind: gate.kind, enemies: state.enemies.map((e) => ({ uid: e.uid, monsterId: e.monsterId, hp: e.hp })) });
}
