import Phaser from 'phaser';
import type { DamageKind } from '@shared/formulas/damage';
import { t } from '../i18n';

/** RO-style floating numbers: big bold outlined digits that pop, arc and fade. */
export type NumberKind = DamageKind | 'taken' | 'heal';
const STYLE: Record<NumberKind, { fill: string; stroke: string; size: number }> = {
  normal: { fill: '#ffffff', stroke: '#3a2412', size: 30 },
  crit: { fill: '#ff3a1f', stroke: '#ffd23f', size: 44 },
  weak: { fill: '#ff9a2e', stroke: '#3a1a05', size: 34 },
  resist: { fill: '#b9b4ac', stroke: '#2a2622', size: 26 },
  taken: { fill: '#ff8fb1', stroke: '#3a0a1a', size: 30 },
  heal: { fill: '#7dff9a', stroke: '#0a3a14', size: 30 },
};

export function popNumber(scene: Phaser.Scene, x: number, y: number, value: number | string, kind: NumberKind): void {
  const st = STYLE[kind];
  const txt = scene.add.text(x, y, String(value), {
    fontFamily: "'Pixelify Sans', Itim, monospace", fontStyle: '700', fontSize: `${st.size}px`,
    color: st.fill, stroke: st.stroke, strokeThickness: kind === 'crit' ? 8 : 6,
  }).setOrigin(0.5).setDepth(60).setScale(0.4);
  const vx = Phaser.Math.Between(-60, 60), rise = kind === 'crit' ? 90 : 70;
  scene.tweens.add({ targets: txt, scale: kind === 'crit' ? 1.25 : 1, duration: 110, ease: 'Back.out' });
  scene.tweens.add({ targets: txt, x: x + vx, duration: 900, ease: 'Linear' });
  scene.tweens.add({ targets: txt, y: y - rise, duration: 420, ease: 'Quad.out', yoyo: false,
    onComplete: () => scene.tweens.add({ targets: txt, y: txt.y + 30, alpha: 0, duration: 480, ease: 'Quad.in', onComplete: () => txt.destroy() }) });
  if (kind === 'crit') {
    const star = starburst(scene, x, y + 4);
    const lbl = scene.add.text(x, y - 34, t('combat.critical'), { fontFamily: "'Pixelify Sans', Itim, monospace", fontStyle: '700', fontSize: '16px', color: '#ffd23f', stroke: '#3a0500', strokeThickness: 4 })
      .setOrigin(0.5).setDepth(61);
    scene.tweens.add({ targets: lbl, y: y - 70, alpha: 0, delay: 250, duration: 500, onComplete: () => lbl.destroy() });
    scene.tweens.add({ targets: star, scale: 1.3, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => star.destroy() });
  }
}

/** Red/yellow 10-point star behind critical numbers (additive). */
export function starburst(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y }).setDepth(59).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
  const star = (n: number, r1: number, r2: number, rot: number, color: number) => {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n; pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
    g.fillStyle(color, 1).fillPoints(pts, true);
  };
  star(10, 44, 20, 0, 0xff3a1f); star(10, 28, 14, 0.3, 0xffd23f);
  return g;
}

/** Small info text (EXP / zeny / item). */
export function popInfo(scene: Phaser.Scene, x: number, y: number, s: string, color = '#ffd88a'): void {
  const txt = scene.add.text(x, y, s, { fontFamily: 'Itim', fontSize: '18px', color, stroke: '#2a1a0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(58);
  scene.tweens.add({ targets: txt, y: y - 50, alpha: 0, duration: 1300, ease: 'Quad.out', onComplete: () => txt.destroy() });
}
