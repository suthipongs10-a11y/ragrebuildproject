import type Phaser from 'phaser';
import { itemDef } from '@shared/index';
import { ART } from '../assets/manifest.generated';
import { loadTextures } from '../assets/packs';
import type { HeroRig } from '../rig/HeroRig';
import type { HeroSession } from './HeroSession';
import { spiritArtKeys } from '../spirits/SpiritPlay';

/** Hero pictures: the job's painted parts + expression heads (P03 Jobs) and the equipped weapon's painting. */
const PARTS = ['head', 'torso', 'uarm', 'farm', 'thigh', 'shin', 'scarf', 'head_attack', 'head_hurt'];

function weapon(session: HeroSession): { subtype: string; icon: string | undefined } {
  const d = session.data, w = d.bag.find((b) => b.uid === d.equip.weapon), def = w ? itemDef(session.content, w.id) : undefined;
  return { subtype: def?.subtype ?? 'sword', icon: def?.icon };
}

export function heroArtKeys(session: HeroSession): string[] {
  const job = session.data.job, w = weapon(session);
  const keys = PARTS.map((p) => (ART[`job_${job}_head`] ? `job_${job}_${p}` : `hero_part_${p}`));
  if (w.icon) keys.push(w.icon);
  return keys.filter((k) => ART[k]);
}

/** Everything the player character and the team need in a room. */
export const sessionArtKeys = (session: HeroSession): string[] => [...spiritArtKeys(session), ...heroArtKeys(session)];

/** Dress the rig for the current job and weapon (fetching their pictures first if needed). */
export function applyHeroLook(scene: Phaser.Scene, session: HeroSession, rig: HeroRig): void {
  const set = () => { const w = weapon(session); rig.setLook(session.data.job, w.subtype, w.icon); };
  const need = heroArtKeys(session).filter((k) => !scene.textures.exists(k));
  set();
  if (need.length) loadTextures(scene, need, () => { if (scene.scene.isActive()) set(); });
}
