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
