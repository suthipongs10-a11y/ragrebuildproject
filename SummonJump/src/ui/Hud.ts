import Phaser from 'phaser';
import { expToNext, jobExpToNext, type HeroData } from '@shared/index';
import { t } from '../i18n';

/** Top-left HP/SP bars, level + EXP bars, soul, cast bar; top-centre boss bar. */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly spText: Phaser.GameObjects.Text;
  private readonly lvText: Phaser.GameObjects.Text;
  private shown = '';
  private readonly bossG: Phaser.GameObjects.Graphics;
  private readonly bossName: Phaser.GameObjects.Text;
  private bossShown = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(100);
    const f = { fontFamily: 'Itim', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 };
    this.hpText = scene.add.text(24, 70, '', { ...f, fontSize: '14px' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.spText = scene.add.text(24, 88, '', { ...f, fontSize: '14px' }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.lvText = scene.add.text(16, 100, '', { ...f, fontSize: '14px', color: '#ffd88a' }).setScrollFactor(0).setDepth(101);
    this.bossG = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.bossName = scene.add.text(scene.scale.width / 2, 16, '', { ...f, fontSize: '18px', color: '#ffd88a' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(101);
  }

  update(hp: number, maxHp: number, sp: number, maxSp: number, h: HeroData, soul: number, cast: { t: number; total: number } | null): void {
    const key = `${Math.ceil(hp)}|${maxHp}|${Math.floor(sp)}|${maxSp}|${h.baseLv}|${h.jobLv}|${h.baseExp}|${h.jobExp}|${soul}|${h.job}|${cast ? Math.round((cast.t / cast.total) * 20) : -1}`;
    if (key === this.shown) return;
    this.shown = key;
    const bar = (y: number, k: number, color: number, w = 200, hgt = 14) => {
      this.g.fillStyle(0x140a05, 0.75).fillRoundedRect(16, y, w, hgt, 5)
        .fillStyle(color, 1).fillRoundedRect(18, y + 2, Math.max(0, (w - 4) * Math.min(1, k)), hgt - 4, 4)
        .lineStyle(2, 0xc99a4a, 1).strokeRoundedRect(16, y, w, hgt, 5);
    };
    this.g.clear();
    bar(63, hp / maxHp, hp / maxHp > 0.3 ? 0xe8503a : 0xff2a2a);
    bar(81, sp / maxSp, 0x3a7ae8);
    const ne = expToNext(h.baseLv), nj = jobExpToNext(h.jobLv, h.job === 'novice' ? 0 : 1);
    this.g.fillStyle(0x140a05, 0.75).fillRect(16, 118, 200, 4).fillStyle(0xffd88a, 1).fillRect(16, 118, 200 * Math.min(1, h.baseExp / ne), 4);
    this.g.fillStyle(0x140a05, 0.75).fillRect(16, 124, 200, 3).fillStyle(0x8ff0bf, 1).fillRect(16, 124, 200 * Math.min(1, h.jobExp / nj), 3);
    this.hpText.setText(`${t('hud.hp')} ${Math.ceil(hp)}/${maxHp}`);
    this.spText.setText(`${t('hud.sp')} ${Math.floor(sp)}/${maxSp}`);
    this.lvText.setText(`${t(`job.${h.job}`)} ${t('hud.lv')} ${h.baseLv} · ${t('hud.job')} ${h.jobLv} · ${soul}${t('hud.soul')}`);
    if (cast) {
      const x = this.scene.scale.width / 2 - 80, y = this.scene.scale.height - 120;
      this.g.fillStyle(0x140a05, 0.8).fillRoundedRect(x, y, 160, 10, 4).fillStyle(0xc9a6ff, 1).fillRoundedRect(x + 2, y + 2, 156 * (cast.t / cast.total), 6, 3);
    }
  }

  /** Big top-center HP bar for a mini-boss / MVP; pass null to hide. */
  boss(name: string | null, hp = 0, max = 1, mvp = false): void {
    const key = name ? `${name}|${Math.ceil(hp)}|${max}` : '';
    if (key === this.bossShown) return;
    this.bossShown = key;
    this.bossG.clear(); this.bossName.setText('');
    if (!name) return;
    const w = Math.min(420, this.scene.scale.width * 0.44), x = (this.scene.scale.width - w) / 2, y = 42, k = Math.max(0, hp) / max;
    this.bossG.fillStyle(0x140a05, 0.8).fillRoundedRect(x, y, w, 14, 6)
      .fillStyle(mvp ? 0xb03ad8 : 0xd8403a, 1).fillRoundedRect(x + 2, y + 2, Math.max(0, (w - 4) * k), 10, 5)
      .lineStyle(2, mvp ? 0xe2c2ff : 0xffd88a, 1).strokeRoundedRect(x, y, w, 14, 6);
    this.bossName.setText(`${mvp ? `${t('hud.mvp')} ` : ''}${name}  ${Math.ceil(Math.max(0, hp))}/${max}`);
  }
}
