import type Phaser from 'phaser';
import { t } from '../i18n';

/** World rooms with their shown name and monster spawns (arena / test rooms left out). Used by the guide and expeditions. */
export interface RoomInfo { id: string; name: string; monsters: string[] }
interface LevelLike { id: string; name: string; test?: boolean; entities: { type: string; fields: Record<string, unknown> }[] }

const cache = new WeakMap<object, RoomInfo[]>();

export function worldRooms(scene: Phaser.Scene): RoomInfo[] {
  const levels = scene.registry.get('levels') as Map<string, LevelLike> | undefined;
  if (!levels) return [];
  let out = cache.get(levels);
  if (!out) {
    out = [...levels.values()].filter((l) => !l.test && l.id !== 'arena')
      .map((l) => ({ id: l.id, name: t(l.name), monsters: l.entities.filter((e) => e.type === 'Monster').map((e) => String(e.fields.monster)) }));
    cache.set(levels, out);
  }
  return out;
}
