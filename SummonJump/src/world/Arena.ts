import { canEnterTower, dayKey, useDailyEntry, type ArenaRun } from '@shared/index';
import type { WorldScene } from '../scenes/WorldScene';
import { t } from '../i18n';

/**
 * Portal NPC: spend a daily entry / check the tower floor, then open the turn battle (spirits, SW style).
 * Returns a reason when refused.
 */
export function enterArena(s: WorldScene, run: ArenaRun): string | null {
  const a = s.session.arena;
  if (run.mode === 'dungeon' && !useDailyEntry(a, dayKey(new Date()))) return t('arena.noEntries');
  if (run.mode === 'tower' && !canEnterTower(s.session.content, a, run.floor)) return t('arena.locked');
  s.flush();
  // after the menu has closed and resumed the world (same tick), switch scenes
  setTimeout(() => s.scene.start('TurnBattle', { run }), 0);
  return null;
}
