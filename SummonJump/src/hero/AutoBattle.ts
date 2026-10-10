import { autoPlan, type HeroState } from '@shared/index';
import type { CombatController } from '../combat/CombatController';
import type { HeroSession } from './HeroSession';
import type { HeroRig } from '../rig/HeroRig';
import { castSkill } from './HeroPlay';

/** AUTO toggle (button next to ☰ / key T). Kept across rooms; stored per browser. */
const KEY = 'sj_auto';
let on = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
let skillT = 0;

export const autoOn = (): boolean => on;

export function setAuto(v: boolean): void {
  on = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ }
  document.getElementById('b_auto')?.classList.toggle('on', v);
}

/** Wire the button and the T key once (main.ts). */
export function bindAuto(): void {
  const b = document.getElementById('b_auto');
  b?.addEventListener('pointerup', (e) => { e.preventDefault(); setAuto(!on); });
  addEventListener('keydown', (e) => { if (e.code === 'KeyT' && !e.repeat && !(e.target instanceof HTMLInputElement)) setAuto(!on); });
  setAuto(on);
}

/**
 * One frame of Auto: face the nearest monster (only while the player isn't steering), and say whether to attack.
 * Skills fire at most every 0.25 s through the same path as the skill buttons.
 */
export function autoStep(session: HeroSession, combat: CombatController, hero: HeroState, rig: HeroRig, steering: boolean, dt: number): boolean {
  if (!on) return false;
  const plan = autoPlan({ content: session.content, data: session.data, rt: session.rt, derived: session.derived,
    hp: combat.combat.hp, maxHp: combat.maxHp, hero, enemies: combat.enemies });
  if (!steering && plan.face && combat.combat.atkT <= 0) hero.dir = plan.face;
  skillT -= dt;
  if (plan.skill && skillT <= 0 && (steering || !plan.face || hero.dir === plan.face)) { skillT = 0.25; castSkill(combat, hero, rig, plan.skill); }
  return plan.attack && hero.dir === plan.face;
}
