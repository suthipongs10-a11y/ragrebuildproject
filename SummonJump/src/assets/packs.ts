import type Phaser from 'phaser';
import { ART, type ArtEntry } from './manifest.generated';

export const ZONES = ['forest', 'deep', 'town', 'sky', 'abyss', 'desert'] as const;
export type ZoneId = (typeof ZONES)[number];
export const ZONE_LAYERS = ['far', 'mid', 'near', 'ground', 'plat'] as const;

export function art(key: string): ArtEntry {
  const e = ART[key];
  if (!e) throw new Error(`art key missing: ${key}`);
  return e;
}

/** Queue every image of a zone pack (lazy per zone). Returns true if anything was queued. */
export function queueZone(scene: Phaser.Scene, zone: ZoneId): boolean {
  let queued = false;
  for (const layer of ZONE_LAYERS) {
    const key = `zone_${zone}_${layer}`;
    if (!scene.textures.exists(key)) { scene.load.image(key, art(key).url); queued = true; }
  }
  return queued;
}

export function queueKeys(scene: Phaser.Scene, keys: string[]): void {
  for (const k of keys) if (!scene.textures.exists(k)) scene.load.image(k, art(k).url);
}

const SUMMONS: Record<string, string[]> = { king: ['poring'], kraken: ['fish'] };

/** Texture keys of a monster: P02 pose set when imported, else the legacy sprite. */
export function monsterKeys(id: string): string[] {
  const keys = (['idle', 'windup', 'attack', 'hurt', 'idle2'] as const).map((p) => `mon_${id}_${p}`).filter((k) => ART[k]);
  if (!keys.length) keys.push(ART[`boss_${id}_design`] ? `boss_${id}_design` : `legacy_${id}`);
  return keys;
}

/** Queue every monster texture a room needs (its spawns + boss summons). Returns true if anything was queued. */
export function queueMonsters(scene: Phaser.Scene, monsterIds: string[]): boolean {
  let queued = false;
  const all = new Set(monsterIds.flatMap((m) => [m, ...(SUMMONS[m] ?? [])]));
  for (const m of all) for (const k of monsterKeys(m)) if (!scene.textures.exists(k)) { scene.load.image(k, art(k).url); queued = true; }
  return queued;
}

/** Every texture a room needs: its zone's painted layers + its monsters (with boss summons). */
export function roomKeys(level: { zone: string; entities: { type: string; fields: Record<string, unknown> }[] }): string[] {
  const keys = ZONE_LAYERS.map((l) => `zone_${level.zone}_${l}`);
  const mons = new Set(level.entities.filter((e) => e.type === 'Monster').map((e) => String(e.fields.monster)));
  for (const m of [...mons]) for (const s of SUMMONS[m] ?? []) mons.add(s);
  for (const m of mons) keys.push(...monsterKeys(m));
  return keys.filter((k) => ART[k]);
}

/**
 * Load textures and retry the ones that failed (mobile networks drop requests). Calls `done` with the keys that are
 * still missing after `tries` attempts (empty = everything is ready).
 */
export function loadTextures(scene: Phaser.Scene, keys: string[], done: (missing: string[]) => void, tries = 3): void {
  const missing = () => keys.filter((k) => !scene.textures.exists(k));
  const attempt = (n: number) => {
    const m = missing();
    if (!m.length || n <= 0) { done(m); return; }
    for (const k of m) scene.load.image(k, n < tries ? `${art(k).url}?retry=${tries - n}` : art(k).url);
    scene.load.once('complete', () => attempt(n - 1));
    scene.load.start();
  };
  attempt(tries);
}
