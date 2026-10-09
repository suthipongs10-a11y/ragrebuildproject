import Phaser from 'phaser';
import { t } from '../i18n';

/** Top-left HP bar + zeny/EXP counters (UI kit art replaces the shapes in a later polish pass). */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly money: Phaser.GameObjects.Text;
  private shown = -1;
  private readonly bossG: Phaser.GameObjects.Graphics;
  private readonly bossName: Phaser.GameObjects.Text;
  private bossShown = '';

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(100);
    const f = { fontFamily: 'Itim', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 };
    this.hpText = scene.add.text(26, 70, '', { ...f, fontSize: '15px' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.money = scene.add.text(16, 90, '', { ...f, fontSize: '15px', color: '#ffd88a' }).setScrollFactor(0).setDepth(101);
    this.bossG = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.bossName = scene.add.text(scene.scale.width / 2, 16, '', { ...f, fontSize: '18px', color: '#ffd88a' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  }

  /** Big top-center HP bar for a mini-boss / MVP; pass null to hide. */
  boss(name: string | null, hp = 0, max = 1, mvp = false): void {
    const key = name ? `${name}|${Math.ceil(hp)}|${max}` : '';
    if (key === this.bossShown) return;
    this.bossShown = key;
    this.bossG.clear(); this.bossName.setText('');
    if (!name) return;
    const w = Math.min(420, this.bossName.scene.scale.width * 0.44), x = (this.bossName.scene.scale.width - w) / 2, y = 42, k = Math.max(0, hp) / max;
    this.bossG.fillStyle(0x140a05, 0.8).fillRoundedRect(x, y, w, 14, 6)
      .fillStyle(mvp ? 0xb03ad8 : 0xd8403a, 1).fillRoundedRect(x + 2, y + 2, Math.max(0, (w - 4) * k), 10, 5)
      .lineStyle(2, mvp ? 0xe2c2ff : 0xffd88a, 1).strokeRoundedRect(x, y, w, 14, 6);
    this.bossName.setText(`${mvp && !name.startsWith('MVP') ? 'MVP ' : ''}${name}  ${Math.ceil(Math.max(0, hp))}/${max}`);
  }

  update(hp: number, max: number, zeny: number, exp: number): void {
    const key = hp * 1e9 + max * 1e5 + zeny + exp * 7;
    if (key === this.shown) return;
    this.shown = key;
    const w = 200, x = 16, y = 62, k = Math.max(0, hp) / max;
    this.g.clear().fillStyle(0x140a05, 0.75).fillRoundedRect(x, y, w, 16, 6)
      .fillStyle(k > 0.3 ? 0xe8503a : 0xff2a2a, 1).fillRoundedRect(x + 2, y + 2, Math.max(0, (w - 4) * k), 12, 5)
      .lineStyle(2, 0xc99a4a, 1).strokeRoundedRect(x, y, w, 16, 6);
    this.hpText.setText(`${t('hud.hp')} ${Math.ceil(hp)}/${max}`);
    this.money.setText(`${zeny}${t('hud.zeny')} · ${exp} EXP`);
  }
}
