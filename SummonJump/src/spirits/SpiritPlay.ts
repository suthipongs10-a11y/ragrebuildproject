import type Phaser from 'phaser';
import { gaugeReady, teamAbilities, teamSpirits, type Enemy, type HeroState } from '@shared/index';
import type { CombatController } from '../combat/CombatController';
import type { HeroSession } from '../hero/HeroSession';
import { loadTextures } from '../assets/packs';
import type { Ability } from '../world/abilities';
import { t } from '../i18n';
import { teamArtKeys } from './art';
import { playUltimate } from './Ultimate';

/** Scene glue for spirits: abilities from the team, the ✦ button gauge, starting the ultimate. */

/** Team abilities + debug abilities (`?abil=`, keys 7/8/9). */
export function teamAbilitySet(session: HeroSession, debug: Set<Ability>): Set<Ability> {
  return new Set<Ability>([...debug, ...teamAbilities(session.box, session.content)]);
}

/** Texture keys the team needs in the world (small + big forms). */
export const spiritArtKeys = (session: HeroSession): string[] => teamArtKeys(session.content, teamSpirits(session.box));

/** After a team change: fetch the new members' pictures in the background (an orb shows until they arrive). */
export function loadTeamArt(scene: Phaser.Scene, session: HeroSession): void {
  const need = spiritArtKeys(session).filter((k) => !scene.textures.exists(k));
  if (need.length) loadTextures(scene, need, () => { /* views pick them up on the next frame */ });
}

/** ✦ button: conic fill = gauge, glows when ready. */
export class UltButton {
  private readonly el = document.querySelector<HTMLElement>('.pb.ult');
  private shown = -1;

  update(combat: CombatController): void {
    const w = combat.spirits;
    const k = w.actors.length ? Math.floor((100 * w.gauge) / w.gaugeMax) : 0;
    if (k === this.shown || !this.el) return;
    this.shown = k;
    this.el.style.setProperty('--g', String(k));
    this.el.classList.toggle('ready', k >= 100);
  }
}

export interface UltHost {
  scene: Phaser.Scene; session: HeroSession; combat: CombatController; hero: HeroState;
  setBusy(on: boolean): void; hint(key: string, msg: string): void; flush(): void;
}

/** ✦ / F: the leader's ultimate on every monster on screen. */
export function tryUltimate(h: UltHost): void {
  const w = h.combat.spirits;
  if (!w.actors.length) { h.hint('ult_team', t('ult.noTeam')); return; }
  if (!gaugeReady(w)) { h.hint('ult_wait', t('ult.notReady').replace('{n}', String(Math.floor((100 * w.gauge) / w.gaugeMax)))); return; }
  const view = h.scene.cameras.main.worldView;
  const targets = h.combat.enemies.filter((e: Enemy) => !e.dead && e.x + e.w > view.x - 40 && e.x < view.right + 40 && e.y + e.h > view.y - 40 && e.y < view.bottom + 40);
  if (!targets.length) { h.hint('ult_none', t('ult.noTarget')); return; }
  const r = h.combat.ultimate(targets);
  if (!r) return;
  h.setBusy(true);
  playUltimate(h.scene, h.session.content, h.session.box, h.combat, r, { x: h.hero.x + h.hero.w / 2, y: h.hero.y }, () => { h.setBusy(false); h.flush(); });
}

export function ultHost(s: { session: HeroSession; combat: CombatController; hero: HeroState; busy: boolean; hint(k: string, m: string): void; flush(): void } & Phaser.Scene): UltHost {
  return { scene: s, session: s.session, combat: s.combat, hero: s.hero, setBusy: (on) => { s.busy = on; }, hint: (k, m) => s.hint(k, m), flush: () => s.flush() };
}
