import Phaser from 'phaser';
import type { DamageKind } from '@shared/formulas/damage';

/** RO-style floating numbers: big bold outlined digits that pop, arc and fade. */
export type NumberKind = DamageKind | 'taken' | 'heal';
const STYLE: Record<NumberKind, { fill: string; stroke: string; size: number }> = {
  normal: { fill: '#ffffff', stroke: '#3a2412', size: 30 },
  crit: { fill: '#fff21a', stroke: '#000000', size: 46 },
  weak: { fill: '#ff9a2e', stroke: '#3a1a05', size: 34 },
  resist: { fill: '#b9b4ac', stroke: '#2a2622', size: 26 },
  taken: { fill: '#ff8fb1', stroke: '#3a0a1a', size: 30 },
  heal: { fill: '#7dff9a', stroke: '#0a3a14', size: 30 },
};

export function popNumber(scene: Phaser.Scene, x: number, y: number, value: number | string, kind: NumberKind): void {
  if (kind === 'crit') { popCrit(scene, x, y, value); return; }
  const st = STYLE[kind];
  const txt = scene.add.text(x, y, String(value), {
    fontFamily: "'Pixelify Sans', Itim, monospace", fontStyle: '700', fontSize: `${st.size}px`,
    color: st.fill, stroke: st.stroke, strokeThickness: 6,
  }).setOrigin(0.5).setDepth(60).setScale(0.4);
  const vx = Phaser.Math.Between(-60, 60);
  scene.tweens.add({ targets: txt, scale: 1, duration: 110, ease: 'Back.out' });
  scene.tweens.add({ targets: txt, x: x + vx, duration: 900, ease: 'Linear' });
  scene.tweens.add({ targets: txt, y: y - 70, duration: 420, ease: 'Quad.out', yoyo: false,
    onComplete: () => scene.tweens.add({ targets: txt, y: txt.y + 30, alpha: 0, duration: 480, ease: 'Quad.in', onComplete: () => txt.destroy() }) });
}

/**
 * Critical hit (owner reference picture): a bold yellow number with a black outline on a spiky
 * orange-red burst (darker rim, lighter core, uneven spikes). Burst + number move as one:
 * slam in big, hang a moment, then float up and fade.
 */
function popCrit(scene: Phaser.Scene, x: number, y: number, value: number | string): void {
  const st = STYLE.crit;
  const txt = scene.add.text(0, 0, String(value), {
    fontFamily: "'Arial Black', Arial, sans-serif", fontStyle: '900', fontSize: `${st.size}px`, color: st.fill, stroke: st.stroke, strokeThickness: 7,
  }).setOrigin(0.5);
  // the burst hugs the number: wide for long numbers, spikes poke out around it
  const rx = txt.width * 0.5 + 16, ry = txt.height * 0.5 + 12;
  const n = 14, rot = Math.random() * Math.PI;
  const len = Array.from({ length: n }, () => 1 + Math.random() * 0.35); // uneven spikes
  const burst = (k: number, pad: number) => {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n * 2; i++) {
      const f = (i % 2 ? 1 : 1.55 * (len[i >> 1] ?? 1)) * k, a = rot + (i * Math.PI) / n;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * (rx * f + pad), Math.sin(a) * (ry * f + pad)));
    }
    return pts;
  };
  const g = scene.add.graphics();
  g.fillStyle(0x9c2414, 1).fillPoints(burst(1, 4), true);    // dark rim
  g.fillStyle(0xe2553a, 1).fillPoints(burst(1, 0), true);    // orange-red burst
  g.fillStyle(0xf08566, 1).fillPoints(burst(0.72, 0), true); // lighter core
  const box = scene.add.container(x, y - 6, [g, txt]).setDepth(61).setScale(1.5).setAngle(Phaser.Math.Between(-5, 5));
  scene.tweens.add({ targets: box, scale: 1, duration: 140, ease: 'Back.out' });
  scene.tweens.add({ targets: box, y: y - 60, delay: 380, duration: 520, ease: 'Quad.out' });
  scene.tweens.add({ targets: box, alpha: 0, delay: 650, duration: 300, onComplete: () => box.destroy() });
}

/** Small info text (EXP / soul / item). */
export function popInfo(scene: Phaser.Scene, x: number, y: number, s: string, color = '#ffd88a'): void {
  const txt = scene.add.text(x, y, s, { fontFamily: 'Itim', fontSize: '18px', color, stroke: '#2a1a0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(58);
  scene.tweens.add({ targets: txt, y: y - 50, alpha: 0, duration: 1300, ease: 'Quad.out', onComplete: () => txt.destroy() });
}
