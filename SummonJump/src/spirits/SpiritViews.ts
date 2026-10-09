import Phaser from 'phaser';
import type { ContentBundle } from '@shared/content/types';
import { spiritOf, type SpiritBox, type SpiritWorld } from '@shared/index';
import { elementColor, spiritTexture } from './art';

const SIZE = 46;

/** The team floating next to the hero: picture + soft element glow, a little pop when casting. */
export class SpiritViews {
  private readonly views = new Map<number, { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Ellipse; key: string }>();

  constructor(private readonly scene: Phaser.Scene, private readonly content: ContentBundle) {}

  sync(w: SpiritWorld, box: SpiritBox, heroDir: number): void {
    const alive = new Set<number>();
    for (const a of w.actors) {
      alive.add(a.uid);
      const s = spiritOf(box, a.uid);
      if (!s) continue;
      const tex = spiritTexture(this.scene, this.content, s);
      let v = this.views.get(a.uid);
      if (!v || v.key !== tex.key) {
        v?.img.destroy(); v?.glow.destroy();
        const glow = this.scene.add.ellipse(a.x, a.y, SIZE * 1.3, SIZE * 1.3, elementColor(this.content, s.el), 0.28).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
        const img = this.scene.add.image(a.x, a.y, tex.key).setDepth(12);
        img.setScale(SIZE / Math.max(img.width, img.height));
        if (tex.tint !== null) img.setTint(tex.tint);
        v = { img, glow, key: tex.key };
        this.views.set(a.uid, v);
      }
      const pop = a.flash > 0 ? 1 + a.flash * 0.8 : 1;
      v.img.setPosition(a.x, a.y).setFlipX(heroDir < 0);
      v.img.setScale((SIZE / Math.max(v.img.width, v.img.height)) * pop);
      v.glow.setPosition(a.x, a.y + 4).setAlpha(0.22 + (a.flash > 0 ? 0.3 : 0));
    }
    for (const [uid, v] of this.views) if (!alive.has(uid)) { v.img.destroy(); v.glow.destroy(); this.views.delete(uid); }
  }

  /** Hide during the ultimate (the big form takes over). */
  setVisible(on: boolean): void { for (const v of this.views.values()) { v.img.setVisible(on); v.glow.setVisible(on); } }
}
