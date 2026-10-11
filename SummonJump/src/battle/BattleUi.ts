import Phaser from 'phaser';
import { ready, type TbUnit } from '@shared/index';
import { t } from '../i18n';
import { ART } from '../assets/manifest.generated';

/**
 * Turn-battle HUD (Phaser, scales with the canvas): title + wave, turn-order strip, AUTO / speed / leave buttons,
 * and the active spirit's two skill buttons (skill 2 shows its cooldown).
 */
export interface UiHooks { skill(i: number): void; auto(): void; speed(): void; leave(): void }

const FONT = "Itim, 'Pixelify Sans', sans-serif";

export class BattleUi {
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly strip: Phaser.GameObjects.Container;
  private readonly skills: Phaser.GameObjects.Container[] = [];
  private readonly autoBtn: Phaser.GameObjects.Text;
  private readonly speedBtn: Phaser.GameObjects.Text;
  private selected = 0;

  constructor(private readonly scene: Phaser.Scene, titleText: string, hooks: UiHooks) {
    const txt = (x: number, y: number, s: string, size = 20) => scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: '#fff6e0', stroke: '#2a1a0a', strokeThickness: 5 }).setDepth(80);
    this.title = txt(16, 12, titleText);
    this.hint = txt(480, 92, '', 18).setOrigin(0.5, 0).setColor('#ffe9a8');
    this.strip = scene.add.container(440, 34).setDepth(80);
    const btn = (x: number, label: string, f: () => void) => {
      const b = txt(x, 10, label, 20).setOrigin(1, 0).setPadding(16, 14, 16, 14).setBackgroundColor('#3a2a18cc').setInteractive({ useHandCursor: true });
      b.on('pointerup', f);
      return b;
    };
    btn(950, t('tb.leave'), () => hooks.leave());
    this.speedBtn = btn(862, '×1', () => hooks.speed());
    this.autoBtn = btn(788, 'AUTO', () => hooks.auto());
    for (let i = 0; i < 2; i++) {
      const x = 410 + i * 140, y = 478;
      const frameKey = i ? 'tb_btn_ult' : 'tb_btn_skill';
      const parts: Phaser.GameObjects.GameObject[] = [scene.add.circle(0, 0, 40, i ? 0x5a2f7a : 0x3a2a18, 0.95).setStrokeStyle(4, i ? 0xd9a8ff : 0xe8c069)];
      if (ART[frameKey] && scene.textures.exists(frameKey)) parts.push(scene.add.image(0, 0, frameKey).setDisplaySize(96, 96));
      const label = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: '#fff6e0', align: 'center', stroke: '#2a1a0a', strokeThickness: 4, wordWrap: { width: 120 } }).setOrigin(0.5);
      const cd = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
      const c = scene.add.container(x, y, [...parts, label, cd]).setDepth(80).setSize(96, 96).setInteractive({ useHandCursor: true });
      c.setData({ label, cd });
      c.on('pointerup', () => hooks.skill(i));
      this.skills.push(c);
    }
    this.showSkills(null);
  }

  setTitle(s: string): void { this.title.setText(s); }
  setHint(s: string): void { this.hint.setText(s); }
  setAuto(on: boolean): void { this.autoBtn.setBackgroundColor(on ? '#b8862acc' : '#3a2a18cc'); }
  setSpeed(n: number): void { this.speedBtn.setText(`×${n}`); }
  get skill(): number { return this.selected; }

  /** The active spirit's buttons (null = hide: monster turn / AUTO). */
  showSkills(u: TbUnit | null, selected = 0): void {
    this.selected = selected;
    this.skills.forEach((c, i) => {
      const sk = u?.skills[i];
      c.setVisible(!!sk);
      if (!u || !sk) return;
      const ok = ready(u, i);
      (c.getData('label') as Phaser.GameObjects.Text).setText(t(sk.name_key)).setAlpha(ok ? 1 : 0.45);
      (c.getData('cd') as Phaser.GameObjects.Text).setText(ok ? '' : String(u.cd[i]));
      c.setScale(i === selected ? 1.12 : 1).setAlpha(ok ? 1 : 0.7);
    });
  }

  /** Who acts next: small coloured dots with the unit's picture key. */
  showOrder(units: TbUnit[], textures: (u: TbUnit) => { key: string; tint: number | null }): void {
    this.strip.removeAll(true);
    units.forEach((u, i) => {
      const x = (i - (units.length - 1) / 2) * 46, r = i === 0 ? 21 : 17;
      const ring = this.scene.add.circle(x, 0, r, 0x1a120a, 0.85).setStrokeStyle(3, u.side === 'ally' ? 0x5ae0d0 : 0xff6a5a);
      const tex = textures(u);
      const img = this.scene.add.image(x, 0, tex.key);
      img.setScale((r * 1.7) / Math.max(img.width, img.height));
      if (tex.tint != null) img.setTint(tex.tint);
      this.strip.add([ring, img]);
    });
  }
}
