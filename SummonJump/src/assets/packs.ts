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
