/** Respawn rules: normal monsters come back on every room entry; mini-bosses and MVPs wait out a timestamp. */
import type { MonsterTier } from '../content/types';

export interface DefeatedMap { [spawnId: string]: number }

/** `respawnSec` is the monster's own timer from content (ignored for normal monsters). */
export function markDefeated(d: DefeatedMap, spawnId: string, tier: MonsterTier, respawnSec: number, nowMs: number): void {
  if (tier === 'normal') return; // normal monsters are never persisted
  d[spawnId] = nowMs + Math.max(1, respawnSec) * 1000;
}

export function isSpawnAlive(d: DefeatedMap, spawnId: string, nowMs: number): boolean {
  const t = d[spawnId];
  return t === undefined || nowMs >= t;
}

/** Drop expired entries so the save stays small. */
export function pruneDefeated(d: DefeatedMap, nowMs: number): void {
  for (const k of Object.keys(d)) if ((d[k] as number) <= nowMs) delete d[k];
}

/** Room entry: which of the room's spawns are alive right now. Normal monsters: always. */
export function aliveSpawns<T extends { id: string }>(spawns: T[], d: DefeatedMap, nowMs: number): T[] {
  return spawns.filter((s) => isSpawnAlive(d, s.id, nowMs));
}
