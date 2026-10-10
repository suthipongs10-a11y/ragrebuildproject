import Phaser from 'phaser';
import type { ContentBundle } from '@shared/content/types';
import { isSpawnAlive, type DefeatedMap, type EntityData, type LevelData } from '@shared/platformer';
import { t } from '../i18n';

/** "⏳ King Poring returns in 12:34" over a defeated mini-boss / MVP spawn; spawns it when the timer runs out. */
export class BossTimers {
  private readonly items: { e: EntityData; text: Phaser.GameObjects.Text }[] = [];
  private shown = -1;

  constructor(scene: Phaser.Scene, level: LevelData, private readonly defeated: DefeatedMap, content: ContentBundle, private readonly spawn: (e: EntityData) => void) {
    const now = Date.now();
    for (const e of level.entities) {
      if (e.type !== 'Monster' || isSpawnAlive(defeated, e.id, now)) continue;
      const def = content.monsters.find((m) => m.id === String(e.fields.monster));
      if (!def || def.tier === 'normal') continue;
      const text = scene.add.text(e.x, e.y - 90, '', { fontFamily: 'Itim', fontSize: '20px', color: '#ffd88a', stroke: '#2a1a0a', strokeThickness: 5, align: 'center' })
        .setOrigin(0.5).setDepth(40);
      text.setData('name', t(def.name_key));
      this.items.push({ e, text });
    }
  }

  update(): void {
    const now = Date.now(), sec = Math.floor(now / 1000);
    if (sec === this.shown || !this.items.length) return;
    this.shown = sec;
    for (const it of [...this.items]) {
      const left = Math.ceil(((this.defeated[it.e.id] ?? now) - now) / 1000);
      if (left <= 0) { it.text.destroy(); this.items.splice(this.items.indexOf(it), 1); delete this.defeated[it.e.id]; this.spawn(it.e); continue; }
      const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
      it.text.setText(t('boss.respawn').replace('{name}', String(it.text.getData('name'))).replace('{t}', `${mm}:${ss}`));
    }
  }
}
