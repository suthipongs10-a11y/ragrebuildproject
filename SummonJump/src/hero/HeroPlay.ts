import Phaser from 'phaser';
import type { HeroCombat, HeroState, SkillEvent } from '@shared/index';
import type { Controls, InputKey } from '../input/Controls';
import type { CombatController } from '../combat/CombatController';
import type { HeroSession } from './HeroSession';
import type { HeroClip, HeroRig } from '../rig/HeroRig';
import { burst, ring } from '../vfx/Effects';
import { t } from '../i18n';
import { popNumber } from '../vfx/DamageText';

const SLOT_KEYS: InputKey[] = ['sk1', 'sk2', 'sk3'];

/** Skill buttons S1–S3 → cast the skill in that slot; plays a rig clip and explains failures. */
export function handleSkillInput(c: Controls, session: HeroSession, combat: CombatController, hero: HeroState, rig: HeroRig, hint: (k: string, m: string) => void): void {
  SLOT_KEYS.forEach((k, i) => {
    if (!c.pressed(k)) return;
    const id = session.data.slots[i];
    if (!id) { hint('noskill', t('skill.empty')); return; }
    castSkill(combat, hero, rig, id, hint);
  });
}

/** Cast one skill and start its rig clip (skill buttons and Auto). */
export function castSkill(combat: CombatController, hero: HeroState, rig: HeroRig, id: string, hint?: (k: string, m: string) => void): boolean {
  let ok = false;
  for (const e of combat.cast(hero, id)) {
    if (e.kind === 'fail') hint?.(`fail_${e.why}`, t(`skill.fail.${e.why}`));
    if (e.kind === 'cast_start') { rig.play('channel', true); ok = true; }
    if (e.kind === 'cast') { rig.play(clipFor(e), true); ok = true; }
  }
  return ok;
}

/** Skill animation by skills.csv `target` (moves.ts). */
function clipFor(e: Extract<SkillEvent, { kind: 'cast' }>): string {
  const tg = e.skill.target;
  if (tg === 'aoe' && e.skill.effects.magic) return 'skill_bolt';
  return ['front', 'aoe', 'bolt', 'rain', 'heal', 'buff', 'dash', 'zone'].includes(tg) ? `skill_${tg}` : 'skill_bolt';
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
export function pickClip(h: HeroState, cur: HeroClip, cb: HeroCombat, water: boolean, acting: boolean): HeroClip {
  // attacks, skills, hurt and landing play to the end (anticipation and follow-through are part of the move)
  if (acting && (cur.startsWith('attack') || cur.startsWith('skill') || cur === 'hurt' || (cur === 'land' && h.onGround))) return cur;
  if (!h.onGround && !water) return h.vy < 0 ? 'jump' : 'fall';
  if (cb.atkCd > 0.08 && cb.chainT > 0) return 'guard';
  return h.onGround && Math.abs(h.vx) > 30 ? 'run' : 'idle';
}

/** Potion from the bag: heal HP/SP with a green number. */
export function applyPotion(scene: Phaser.Scene, combat: CombatController, session: HeroSession, h: HeroState, fx: Record<string, number>): void {
  const cb = combat.combat;
  if (fx.heal) { cb.hp = Math.min(combat.maxHp, cb.hp + fx.heal); popNumber(scene, h.x + h.w / 2, h.y - 6, fx.heal, 'heal'); }
  if (fx.sp) session.rt.sp = Math.min(combat.maxSp, session.rt.sp + fx.sp);
}
