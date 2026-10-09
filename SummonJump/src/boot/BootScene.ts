import Phaser from 'phaser';
import { queueKeys, queueZone, type ZoneId } from '../assets/packs';
import { parseLdtk, type LdtkProject, type LevelData } from '@shared/platformer';
import { loadSave } from '../save/local';
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
    this.load.json('world', 'levels/world.ldtk');
    queueKeys(this, ['hero_design', 'icon_sign', 'icon_altar', 'icon_anvil', 'icon_chest', 'icon_fountain', 'icon_crystal', 'icon_e_wind', 'icon_e_water', 'icon_e_fire',
      ...['poring', 'mantis', 'king', 'bird', 'harpy', 'fish', 'kraken', 'scorpion'].map((m) => `legacy_${m}`)]);
  }

  create(): void {
    const content = this.cache.json.get('content') as ContentBundle | undefined;
    this.registry.set('content', content);
    const levels = parseLdtk(this.cache.json.get('world') as LdtkProject);
    this.registry.set('levels', levels);
    // start room: ?map=<id> (debug) > saved room > town. Load its zone pack first.
    const wanted = new URLSearchParams(location.search).get('map') ?? loadSave().room;
    const start = levels.get(wanted) ?? (levels.get('town') as LevelData);
    this.registry.set('startRoom', start.id);
    const go = () => this.scene.start('World', {});
    if (queueZone(this, start.zone as ZoneId)) { this.load.once('complete', go); this.load.start(); } else go();
  }
}
