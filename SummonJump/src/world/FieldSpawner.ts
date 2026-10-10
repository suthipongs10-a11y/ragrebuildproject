import type { ContentBundle } from '@shared/content/types';
import { fieldDue, fieldSlots, type FieldSlot, type LevelData } from '@shared/platformer';

/**
 * Normal monsters of a room: `pack` per spawn point on entry, and each one comes back `respawn_sec` after it dies
 * (owner: "ฟาร์มมอนน้อยไป ให้มอนเกิดมาเองเรื่อยๆ"). Bosses stay with the persisted timers (BossTimers).
 */
export class FieldSpawner {
  private readonly slots: FieldSlot[];
  private readonly timers = new Map<string, number>();

  constructor(level: LevelData, content: ContentBundle, private readonly spawn: (s: FieldSlot, poof: boolean) => void, private readonly alive: (id: string) => boolean) {
    const spawns = level.entities.filter((e) => e.type === 'Monster').map((e) => ({ id: e.id, x: e.x, y: e.y, monster: String(e.fields.monster) }));
    this.slots = fieldSlots(spawns, (id) => content.monsters.find((m) => m.id === id));
    for (const s of this.slots) spawn(s, false);
  }

  /** Spawn ids this spawner owns (WorldScene leaves them alone). */
  owns(id: string): boolean { return this.slots.some((s) => s.id === id); }

  update(dt: number, heroX: number): void {
    for (const s of fieldDue(this.slots, this.timers, this.alive, heroX, dt)) this.spawn(s, true);
  }
}
