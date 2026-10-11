import Phaser from 'phaser';
import type { ContentBundle, TbUnit } from '@shared/index';
import { artSource, monsterKeys, monsterTint } from '../assets/packs';
import { ART } from '../assets/manifest.generated';
import { spiritTexture } from '../spirits/art';

/**
 * One fighter on the turn-battle stage: picture standing on a ring, HP bar (+ shield), attack bar, status icons.
 * Allies stand left facing right, monsters right facing left (their paintings already face left).
 */
const BAR_W = 92;
const ICON: Record<string, string> = { stun: '💫', shield: '🛡️', defdown: '⬇️' };

export class UnitView {
  readonly c: Phaser.GameObjects.Container;
  private readonly img: Phaser.GameObjects.Image;
  private readonly ring: Phaser.GameObjects.Ellipse;
  private readonly hpBar: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Text;
  private readonly baseKey: string;
  readonly h: number;
  private shownHp: number;

  constructor(private readonly scene: Phaser.Scene, content: ContentBundle, readonly u: TbUnit, readonly x: number, readonly y: number) {
    const ally = u.side === 'ally';
    this.h = u.boss ? 170 : ally ? 104 : 96;
    this.c = scene.add.container(x, y).setDepth(10 + y / 10);
    this.ring = scene.add.ellipse(0, 0, u.boss ? 150 : 100, u.boss ? 34 : 24, ally ? 0x3fd8c8 : 0xe0483c, 0.35).setStrokeStyle(2, ally ? 0x8ff0e6 : 0xff8a7a, 0.9);
    if (ally) {
      const tex = spiritTexture(scene, content, { id: u.id, el: u.el, awk: u.awk });
      this.baseKey = tex.key;
      this.img = scene.add.image(0, 0, tex.key).setOrigin(0.5, 0.92);
      if (tex.tint != null) this.img.setTint(tex.tint);
    } else {
      this.baseKey = monsterKeys(u.id)[0] ?? '__MISSING';
      this.img = scene.add.image(0, 0, this.baseKey).setOrigin(0.5, 0.95);
      const tint = monsterTint(u.id);
      if (tint != null) this.img.setTint(tint);
    }
    this.img.setScale(this.h / Math.max(1, this.img.height));
    this.hpBar = scene.add.graphics();
    this.icons = scene.add.text(0, -this.h - 38, '', { fontSize: '15px' }).setOrigin(0.5, 1);
    this.c.add([this.ring, this.img, this.hpBar, this.icons]);
    this.shownHp = u.hp;
    this.c.setAlpha(0);
    scene.tweens.add({ targets: this.c, alpha: 1, duration: 260 });
    this.draw();
  }

  /** Pose picture for monsters with painted poses (attack / hurt / skill), back to idle after `ms`. */
  pose(p: 'attack' | 'hurt' | 'skill', ms = 320): void {
    if (this.u.side === 'ally') return;
    const key = `mon_${artSource(this.u.id)}_${p}`;
    if (!ART[key] || !this.scene.textures.exists(key)) return;
    const s = this.img.scaleY;
    this.img.setTexture(key).setScale(s);
    this.scene.time.delayedCall(ms, () => { if (this.img.active) this.img.setTexture(this.baseKey).setScale(s); });
  }

  setTurn(on: boolean): void {
    this.ring.setFillStyle(on ? 0xffd23f : this.u.side === 'ally' ? 0x3fd8c8 : 0xe0483c, on ? 0.6 : 0.35);
    if (on) this.scene.tweens.add({ targets: this.img, y: -12, duration: 140, yoyo: true, ease: 'Quad.out' });
  }

  /** Redraw bars and icons from the unit (HP slides down smoothly). */
  draw(): void {
    const u = this.u, top = -this.h - 26;
    if (this.shownHp !== u.hp) this.scene.tweens.addCounter({ from: this.shownHp, to: u.hp, duration: 240, onUpdate: (tw) => { this.shownHp = tw.getValue() ?? u.hp; this.paint(top); } });
    this.paint(top);
    const st = [u.stun > 0 ? ICON.stun : '', u.shield > 0 ? ICON.shield : '', u.defDown > 0 ? ICON.defdown : ''].join('');
    this.icons.setText(st);
  }

  private paint(top: number): void {
    const u = this.u, g = this.hpBar, w = u.boss ? BAR_W * 1.5 : BAR_W, x0 = -w / 2;
    g.clear();
    g.fillStyle(0x1a120a, 0.85).fillRoundedRect(x0 - 2, top - 2, w + 4, 16, 4);
    g.fillStyle(u.side === 'ally' ? 0x4fd16a : 0xe04a3c, 1).fillRect(x0, top, w * Math.max(0, this.shownHp / u.maxHp), 8);
    if (u.shield > 0) g.fillStyle(0xffffff, 0.75).fillRect(x0, top, w * Math.min(1, u.shield / u.maxHp), 3);
    g.fillStyle(0x5ad8ff, 1).fillRect(x0, top + 10, w * Math.min(1, u.bar / 100), 3);
  }

  get headY(): number { return this.y - this.h; }
  get midY(): number { return this.y - this.h * 0.5; }

  flash(): void {
    this.img.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => { if (!this.img.active) return; this.img.clearTint(); const t = this.u.side === 'enemy' ? monsterTint(this.u.id) : null; if (t != null) this.img.setTint(t); });
    this.scene.tweens.add({ targets: this.img, x: this.u.side === 'ally' ? -8 : 8, duration: 60, yoyo: true });
  }

  /** Dash toward `tx` and back (melee look); resolves at the hit moment. */
  lunge(tx: number): Promise<void> {
    const dx = Math.max(-140, Math.min(140, (tx - this.x) * 0.45));
    return new Promise((res) => {
      this.scene.tweens.add({ targets: this.c, x: this.x + dx, duration: 150, ease: 'Quad.in', onComplete: () => { res(); this.scene.tweens.add({ targets: this.c, x: this.x, duration: 220, ease: 'Quad.out' }); } });
    });
  }

  die(): void {
    this.scene.tweens.add({ targets: this.c, alpha: 0, scaleX: 0.6, scaleY: 0.6, y: this.y + 20, duration: 420, ease: 'Quad.in', onComplete: () => this.c.destroy() });
  }

  destroy(): void { this.c.destroy(); }
}
