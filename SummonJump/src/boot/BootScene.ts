import Phaser from 'phaser';
import { queueKeys, queueZone } from '../assets/packs';
import { t } from '../i18n';
import type { ContentBundle } from '@shared/content/types';

/** Loads content JSON + the starting zone pack, then hands off to the world. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2 - 24, t('ui.loading'), { fontFamily: 'Itim', fontSize: '28px', color: '#f6ecd8' }).setOrigin(0.5);
    const bar = this.add.rectangle(width / 2 - 200, height / 2 + 16, 0, 10, 0xf0a845).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2 + 16, 404, 14).setStrokeStyle(2, 0x4a3a26);
    this.load.on('progress', (v: number) => { bar.width = 400 * v; });
    this.load.on('complete', () => label.destroy());

    this.load.json('content', 'content/content.json');
    queueZone(this, 'forest');
    queueKeys(this, ['hero_design']);
  }

  create(): void {
    const content = this.cache.json.get('content') as ContentBundle | undefined;
    this.registry.set('content', content);
    this.scene.start('World', { zone: 'forest' });
  }
}
