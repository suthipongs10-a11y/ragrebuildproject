import Phaser from 'phaser';
import type { HeroCombat, HeroState, SkillEvent } from '@shared/index';
import type { Controls, InputKey } from '../input/Controls';
import type { CombatController } from '../combat/CombatController';
import type { HeroSession } from './HeroSession';
import type { HeroClip, HeroRig } from '../rig/HeroRig';
import { burst, ring } from '../vfx/Effects';
import { t } from '../i18n';

const SLOT_KEYS: InputKey[] = ['sk1', 'sk2', 'sk3'];

/** Skill buttons S1–S3 → cast the skill in that slot; plays a rig clip and explains failures. */
export function handleSkillInput(c: Controls, session: HeroSession, combat: CombatController, hero: HeroState, rig: HeroRig, hint: (k: string, m: string) => void): void {
  SLOT_KEYS.forEach((k, i) => {
    if (!c.pressed(k)) return;
    const id = session.data.slots[i];
    if (!id) { hint('noskill', t('skill.empty')); return; }
    const ev = combat.cast(hero, id);
    for (const e of ev) {
      if (e.kind === 'fail') hint(`fail_${e.why}`, t(`skill.fail.${e.why}`));
      if (e.kind === 'cast_start') rig.play('cast', true);
      if (e.kind === 'cast') rig.play(clipFor(e), true);
    }
  });
}

function clipFor(e: Extract<SkillEvent, { kind: 'cast' }>): 'attack3' | 'attack1' | 'cast' {
  const tg = e.skill.target;
  return tg === 'front' || tg === 'dash' ? 'attack3' : tg === 'aoe' && !e.skill.effects.magic ? 'attack1' : 'cast';
}

/** Golden pillar + text for every level / job level gained this frame. */
export function playLevelUps(scene: Phaser.Scene, combat: CombatController, session: HeroSession, hero: HeroState, toast: (m: string) => void): void {
  while (combat.levelUps.length) {
    const lu = combat.levelUps.shift()!;
    const x = hero.x + hero.w / 2, y = hero.y + hero.h;
    const pillar = scene.add.rectangle(x, y, 60, 10, 0xffd88a, 0.75).setOrigin(0.5, 1).setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: pillar, height: 220, alpha: 0, duration: 1100, ease: 'Quad.out', onComplete: () => pillar.destroy() });
    ring(scene, x, y, 0xffd88a, 90, 600); burst(scene, x, y - 40, 0xffe2a0, 26, 320);
    const d = session.data;
    const parts = [];
    if (lu.base) parts.push(t('lvl.base').replace('{n}', String(d.baseLv)));
    if (lu.job) parts.push(t('lvl.job').replace('{n}', String(d.jobLv)));
    toast(`${parts.join(' · ')} ${t('lvl.points')}`);
    combat.heal();
  }
}

/** Which rig clip fits the hero right now (attacks/hurt are started by combat events and run to completion). */
export function pickClip(h: HeroState, cur: HeroClip, cb: HeroCombat, water: boolean): HeroClip {
  if (cur.startsWith('attack') && cb.atkT > 0) return cur;
  if (cur === 'hurt' && cb.inv > 0.75) return cur;
  if (!h.onGround && !water) return h.vy < 0 ? 'jump' : 'fall';
  if (cb.atkCd > 0.08 && cb.chainT > 0) return 'guard';
  return h.onGround && Math.abs(h.vx) > 30 ? 'run' : 'idle';
}
