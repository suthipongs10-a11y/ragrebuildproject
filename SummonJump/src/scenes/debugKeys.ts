import type { WorldScene } from './WorldScene';
import type { Ability } from '../world/abilities';

/** Owner testing keys: 7/8/9 toggle double jump / dive / smash, Shift+K kills the room, H goes home. */
export function bindDebugKeys(s: WorldScene): void {
  const kb = s.input.keyboard;
  if (!kb) return;
  kb.removeAllListeners('keydown');
  kb.on('keydown', (e: KeyboardEvent) => {
    const map: Record<string, Ability> = { Digit7: 'double', Digit8: 'dive', Digit9: 'break' };
    const a = map[e.code];
    if (a) {
      const dbg = s.registry.get('abilDebug') as Set<Ability>;
      if (dbg.has(a)) dbg.delete(a); else dbg.add(a);
      s.refreshAbilities();
      s.toast(`${a}: ${s.abilities.has(a) ? 'ON' : 'off'}`);
    }
    if (e.code === 'KeyK' && e.shiftKey) s.debugKillAll();
    if (e.code === 'KeyH') s.goHome();
  });
}
