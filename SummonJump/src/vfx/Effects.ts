import Phaser from 'phaser';

/** Code-drawn additive VFX (slash arcs, sparks, rings, particles). Replaced by P03 VFX art later. */
export const ELEMENT_COLOR: Record<string, number> = { neutral: 0xfff2cc, water: 0x7fd0ff, fire: 0xff8a3d, earth: 0xd9b36a, wind: 0x8ff0bf, holy: 0xfff3c0, dark: 0xb48cff };

export function slash(scene: Phaser.Scene, x: number, y: number, dir: number, color: number, heavy: boolean, flip: boolean): void {
  const g = scene.add.graphics({ x, y }).setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
  const R = heavy ? 64 : 46, life = heavy ? 260 : 180;
  const st = { k: 0 };
  scene.tweens.add({
    targets: st, k: 1, duration: life, ease: 'Linear',
    onUpdate: () => {
      g.clear();
      const k = st.k, a0 = flip ? 1.1 : -1.3, sweep = 2.5 * Math.min(1, k * 2.2), s = flip ? -1 : 1;
      for (let L = 0; L < 3; L++) {
        const lw = (heavy ? 18 : 12) * (1 - L * 0.3);
        g.lineStyle(lw, L === 2 ? 0xffffff : color, (L === 2 ? 0.9 : 0.45) * (1 - k));
        const st0 = a0, en = a0 + s * sweep;
        const [from, to] = dir > 0 ? [Math.min(st0, en), Math.max(st0, en)] : [Math.PI - Math.max(st0, en), Math.PI - Math.min(st0, en)];
        g.beginPath(); g.arc(0, 0, R - L * 4, from, to); g.strokePath();
      }
    },
    onComplete: () => g.destroy(),
  });
}

export function spark(scene: Phaser.Scene, x: number, y: number, color: number, size = 1): void {
  const g = scene.add.graphics({ x, y }).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 12; i++) { const r = i % 2 ? 6 : 28, a = (i * Math.PI) / 6; pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  g.fillStyle(color, 1).fillPoints(pts, true).fillStyle(0xffffff, 1).fillCircle(0, 0, 7);
  g.setScale(0.5 * size).setRotation(Math.random() * 3);
  scene.tweens.add({ targets: g, scale: 1.2 * size, alpha: 0, duration: 200, onComplete: () => g.destroy() });
}

export function ring(scene: Phaser.Scene, x: number, y: number, color: number, r: number, life = 350): void {
  const e = scene.add.ellipse(x, y, 8, 4).setStrokeStyle(4, color, 0.9).setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: e, width: r * 2, height: r * 0.9, alpha: 0, duration: life, ease: 'Quad.out', onComplete: () => e.destroy() });
}

/** Burst of glowing dots. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, n = 10, speed = 240): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    const c = scene.add.circle(x, y, 3 + Math.random() * 3, color, 1).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: c, x: x + Math.cos(a) * v * 0.5, y: y + Math.sin(a) * v * 0.5 + 30, alpha: 0, scale: 0.3, duration: 350 + Math.random() * 350, ease: 'Quad.out', onComplete: () => c.destroy() });
  }
}
