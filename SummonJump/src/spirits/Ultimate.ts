import Phaser from 'phaser';
import type { ContentBundle } from '@shared/content/types';
import { spiritOf, type SpiritBox, type UltResult } from '@shared/index';
import type { CombatController } from '../combat/CombatController';
import { burst, ring, spark } from '../vfx/Effects';
import { popInfo, popNumber } from '../vfx/DamageText';
import { t } from '../i18n';
import { elementColor, spiritTexture } from './art';

const WAVE_MS = 190;

/**
 * Spirit ultimate cinematic: dim the screen, magic circle, the leader's big form, skill name (+ COMBO),
 * then the hits wave by wave with an effect per family (`vfx` in spirit_skills.csv). Calls `done` at the end.
 */
export function playUltimate(scene: Phaser.Scene, content: ContentBundle, box: SpiritBox, combat: CombatController, r: UltResult, hero: { x: number; y: number }, done: () => void): void {
  const { width: vw, height: vh } = scene.scale;
  const cam = scene.cameras.main;
  const s = spiritOf(box, r.leader.uid);
  const color = elementColor(content, r.leader.el);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { objs.push(o); return o; };
  combat.setSpiritsVisible(false);

  const dim = keep(scene.add.rectangle(0, 0, vw, vh, 0x05030a, 1).setOrigin(0).setScrollFactor(0).setDepth(190).setAlpha(0));
  scene.tweens.add({ targets: dim, alpha: 0.62, duration: 220 });

  // magic circle (P03 art when it arrives, else drawn rings)
  const cx = vw / 2, cy = vh * 0.5;
  const circle: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics = scene.textures.exists('vfx_magic_circle')
    ? keep(scene.add.image(cx, cy, 'vfx_magic_circle').setScrollFactor(0).setDepth(191).setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(0.1))
    : keep(drawCircle(scene, cx, cy, color));
  scene.tweens.add({ targets: circle, scale: circle instanceof Phaser.GameObjects.Image ? (vh * 0.9) / Math.max(1, circle.height) : 1, angle: 120, duration: 900, ease: 'Cubic.out' });

  if (s) {
    const tex = spiritTexture(scene, content, s, true);
    const big = keep(scene.add.image(cx, cy + 20, tex.key).setScrollFactor(0).setDepth(192).setAlpha(0));
    if (tex.tint !== null) big.setTint(tex.tint);
    const target = (vh * 0.62) / Math.max(1, big.height);
    big.setScale(target * 0.6);
    scene.tweens.add({ targets: big, alpha: 1, scale: target, y: cy, duration: 420, ease: 'Back.out' });
    scene.tweens.add({ targets: big, y: cy - 8, duration: 700, yoyo: true, repeat: 2, ease: 'Sine.inOut', delay: 420 });
  }
  const title = keep(scene.add.text(cx, vh * 0.16, t(r.skill.name_key), { fontFamily: 'Itim', fontSize: '42px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 7 })
    .setOrigin(0.5).setScrollFactor(0).setDepth(193).setAlpha(0));
  scene.tweens.add({ targets: title, alpha: 1, y: vh * 0.14, duration: 300, delay: 150 });
  if (r.combo) {
    const combo = keep(scene.add.text(cx, vh * 0.27, t('ult.combo'), { fontFamily: 'Itim', fontSize: '48px', color: '#ffd84a', stroke: '#8a1a0a', strokeThickness: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(193).setScale(2.2).setAlpha(0));
    scene.tweens.add({ targets: combo, alpha: 1, scale: 1, duration: 260, delay: 380, ease: 'Back.out' });
  }
  cam.flash(160, 255, 255, 255);

  // hits, wave by wave
  const start = 900, waves = r.skill.hits;
  scene.time.delayedCall(start - 120, () => scene.tweens.add({ targets: dim, alpha: 0.3, duration: 200 }));
  for (let w = 0; w < waves; w++) {
    scene.time.delayedCall(start + w * WAVE_MS, () => {
      if (r.skill.vfx === 'wave') sweep(scene, cam, color, w % 2 ? -1 : 1);
      for (const h of r.hits) {
        if (h.wave !== w || h.ev.kind !== 'hit') continue;
        hitFx(scene, r.skill.vfx, h.ev.x, h.ev.enemy.y + h.ev.enemy.h, h.ev.y, color);
        combat.ultHit(h.ev);
      }
      cam.shake(120, r.skill.vfx === 'slam' ? 0.012 : 0.006);
    });
  }
  const end = start + waves * WAVE_MS + 420;
  scene.time.delayedCall(end - 200, () => {
    if (r.heal) { popNumber(scene, hero.x, hero.y - 10, r.heal, 'heal'); burst(scene, hero.x, hero.y + 20, 0x7dff9a, 20, 200); }
    if (r.shield) { ring(scene, hero.x, hero.y + 20, 0x9ad8ff, 60, 500); popInfo(scene, hero.x, hero.y - 40, t('ult.shield'), '#9ad8ff'); }
  });
  scene.time.delayedCall(end, () => {
    scene.tweens.add({ targets: objs, alpha: 0, duration: 260, onComplete: () => { for (const o of objs) o.destroy(); combat.setSpiritsVisible(true); done(); } });
  });
}

function drawCircle(scene: Phaser.Scene, x: number, y: number, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y }).setScrollFactor(0).setDepth(191).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
  const R = scene.scale.height * 0.42;
  g.lineStyle(6, color, 0.9).strokeCircle(0, 0, R).lineStyle(3, 0xffffff, 0.7).strokeCircle(0, 0, R * 0.86).lineStyle(4, color, 0.7).strokeCircle(0, 0, R * 0.55);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, b = a + (Math.PI * 2) / 3;
    g.lineStyle(3, color, 0.8).lineBetween(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, Math.cos(b) * R * 0.86, Math.sin(b) * R * 0.86);
    g.fillStyle(0xffffff, 0.9).fillCircle(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93, 7);
  }
  return g;
}

/** A full-screen sweep (tidal wave, dragon breath). */
function sweep(scene: Phaser.Scene, cam: Phaser.Cameras.Scene2D.Camera, color: number, dir: number): void {
  const { width: vw, height: vh } = scene.scale;
  const band = scene.add.rectangle(dir > 0 ? -vw * 0.3 : vw * 1.3, vh * 0.55, vw * 0.35, vh * 0.75, color, 0.45).setScrollFactor(0).setDepth(189).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: band, x: dir > 0 ? vw * 1.3 : -vw * 0.3, duration: 360, ease: 'Sine.in', onComplete: () => band.destroy() });
  void cam;
}

/** Per-target effect: `x` centre, `foot` ground under the monster, `y` hit point. */
function hitFx(scene: Phaser.Scene, kind: string, x: number, foot: number, y: number, color: number): void {
  switch (kind) {
    case 'slam': ring(scene, x, foot, color, 110, 380); burst(scene, x, foot, 0xe8d6b0, 14, 300); break;
    case 'vortex': {
      const g = scene.add.graphics({ x, y }).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
      for (let i = 0; i < 3; i++) g.lineStyle(5, color, 0.85).beginPath().arc(0, 0, 26 + i * 14, i * 2, i * 2 + 2.4).strokePath();
      scene.tweens.add({ targets: g, angle: 540, scale: 1.6, alpha: 0, duration: 420, onComplete: () => g.destroy() });
      break;
    }
    case 'rain': {
      const l = scene.add.rectangle(x, y - 260, 10, 120, color, 0.9).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: l, y, duration: 150, ease: 'Quad.in', onComplete: () => { l.destroy(); burst(scene, x, y, color, 12, 260); } });
      break;
    }
    case 'pillar': {
      const p = scene.add.rectangle(x, foot, 54, 10, color, 0.75).setOrigin(0.5, 1).setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: p, height: 380, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => p.destroy() });
      spark(scene, x, y, 0xffffff, 1.6);
      break;
    }
    case 'wave': spark(scene, x, y, color, 1.4); break;
    default: burst(scene, x, y, color, 18, 340); ring(scene, x, y, 0xffffff, 60, 300);
  }
}
