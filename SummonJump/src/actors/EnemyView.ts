import Phaser from 'phaser';
import type { Enemy } from '@shared/sim/enemy';
import { isFlying } from '@shared/sim/enemy';
import { monsterKeys } from '../assets/packs';

/**
 * Draws one monster: pose swap (idle/windup/attack/hurt) + code tweens (squash, lunge, bob), hit flash,
 * HP bar for normal monsters, dissolve on death. Art faces LEFT.
 */
export class EnemyView {
  readonly img: Phaser.GameObjects.Image;
  private readonly hpBg: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly base: number;
  private readonly keys: Set<string>;
  private readonly fallback: string;
  private readonly fly: boolean;

  constructor(private readonly scene: Phaser.Scene, e: Enemy) {
    this.keys = new Set(monsterKeys(e.def.id));
    this.fallback = [...this.keys][0] as string;
    this.fly = isFlying(e.def);
    const idle = this.keys.has(`mon_${e.def.id}_idle`) ? `mon_${e.def.id}_idle` : this.fallback;
    this.img = scene.add.image(0, 0, idle).setOrigin(0.5, 1).setDepth(8);
    this.base = (e.def.draw_h * 2 * 1.15) / this.img.height;
    this.img.setScale(this.base);
    const boss = e.def.tier !== 'normal';
    this.hpBg = scene.add.rectangle(0, 0, 48, 6, 0x140a05, 0.7).setDepth(9).setVisible(false);
    this.hpFill = scene.add.rectangle(0, 0, 48, 6, 0xe8503a).setOrigin(0, 0.5).setDepth(9).setVisible(false);
    if (boss) { this.hpBg.destroy(); this.hpFill.destroy(); }
  }

  private texFor(e: Enemy, time: number): string {
    const id = e.def.id;
    let k = `mon_${id}_${e.pose}`;
    if (e.pose === 'idle' && this.keys.has(`mon_${id}_idle2`) && Math.sin(time * 14) > 0) k = `mon_${id}_idle2`; // wing flap
    if (!this.keys.has(k)) k = this.keys.has(`mon_${id}_idle`) ? `mon_${id}_idle` : this.fallback;
    return k;
  }

  sync(e: Enemy, time: number): void {
    const tex = this.texFor(e, time);
    if (this.img.texture.key !== tex) this.img.setTexture(tex);
    // art faces left: flip when moving/looking right
    this.img.setFlipX(e.dir > 0);
    let sx = 1, sy = 1, ox = 0;
    if (e.pose === 'windup') { sx = 1.12; sy = 0.88; }
    else if (e.pose === 'attack') { sx = 0.92; sy = 1.1; ox = e.dir * 10; }
    else if (e.pose === 'hurt') { sx = 1.08; sy = 0.92; ox = -e.dir * 6; }
    else if (!this.fly && e.onGround) { const b = Math.sin(time * 5 + e.ph) * 0.03; sx = 1 + b; sy = 1 - b; }
    this.img.setScale(this.base * sx, this.base * sy);
    this.img.setPosition(e.x + e.w / 2 + ox, e.y + e.h + (this.fly ? this.img.displayHeight * 0.3 : 0));
    if (e.flash > 0) this.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.img.clearTint();
    if (this.hpFill.active) {
      const show = e.hp < e.def.hp && !e.dead;
      const w = Math.max(40, e.w), x = e.x + e.w / 2 - w / 2, y = e.y - 14;
      this.hpBg.setVisible(show).setPosition(e.x + e.w / 2, y).setSize(w, 6);
      this.hpFill.setVisible(show).setPosition(x, y).setSize(w * Math.max(0, e.hp) / e.def.hp, 6);
    }
  }

  /** Flash white, swell and fade out. */
  die(): void {
    if (this.hpFill.active) { this.hpBg.destroy(); this.hpFill.destroy(); }
    const img = this.img;
    img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.tweens.add({ targets: img, alpha: 0, scaleX: img.scaleX * 1.25, scaleY: img.scaleY * 0.7, duration: 450, ease: 'Quad.out', onComplete: () => img.destroy() });
  }

  destroy(): void { this.img.destroy(); if (this.hpFill.active) { this.hpBg.destroy(); this.hpFill.destroy(); } }
}
