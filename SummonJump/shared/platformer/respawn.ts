/** Respawn rules: normal monsters come back on every room entry and in the room after `respawn_sec`; mini-bosses and MVPs wait out a timestamp. */
import type { MonsterDef, MonsterTier } from '../content/types';

export interface DefeatedMap { [spawnId: string]: number }

/** `respawnSec` is the monster's own timer from content (normal monsters are not persisted: they respawn in the room, see FieldSpawner). */
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

/** One normal-monster slot of a room: `pack` slots per spawn point, 40 px apart; `sec` = in-room respawn time. */
export interface FieldSlot { id: string; monster: string; x: number; y: number; sec: number }

/** Normal monsters only (bosses keep their persisted timers). The first slot keeps the spawn's own id. */
export function fieldSlots(spawns: { id: string; x: number; y: number; monster: string }[], def: (id: string) => MonsterDef | undefined): FieldSlot[] {
  const out: FieldSlot[] = [];
  for (const s of spawns) {
    const d = def(s.monster);
    if (!d || d.tier !== 'normal') continue;
    const n = Math.max(1, Math.round(d.pack || 1));
    for (let k = 0; k < n; k++) out.push({ id: k ? `${s.id}~${k}` : s.id, monster: s.monster, x: s.x + (k - (n - 1) / 2) * 40, y: s.y, sec: Math.max(1, d.respawn_sec || 12) });
  }
  return out;
}

/** Hero must be at least this far away (px) so a monster never pops up on top of them. */
export const FIELD_CLEAR = 260;

/**
 * In-room respawn (owner: "ให้มอนเกิดมาเองเรื่อยๆ"): a dead slot waits `sec`, then comes back once the hero is
 * FIELD_CLEAR away. `timers` holds seconds left per dead slot. Returns the slots to spawn now.
 */
export function fieldDue(slots: FieldSlot[], timers: Map<string, number>, alive: (id: string) => boolean, heroX: number, dt: number): FieldSlot[] {
  const due: FieldSlot[] = [];
  for (const s of slots) {
    if (alive(s.id)) { timers.delete(s.id); continue; }
    const left = (timers.get(s.id) ?? s.sec) - dt;
    if (left <= 0 && Math.abs(heroX - s.x) > FIELD_CLEAR) { timers.delete(s.id); due.push(s); } else timers.set(s.id, Math.max(0, left));
  }
  return due;
}
