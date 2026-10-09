import Phaser from 'phaser';
import type { EntityData } from '@shared/platformer';
import { t } from '../i18n';
import type { SaveData } from '../save/local';
import type { Ability } from './abilities';
import type { WorldScene } from '../scenes/WorldScene';

export interface Interactable { e: EntityData; height: number; use: () => void }

const ICON: Record<string, { key: string; h: number }> = {
  Sign: { key: 'icon_sign', h: 54 }, Altar: { key: 'icon_altar', h: 70 }, Anvil: { key: 'icon_anvil', h: 52 },
  Chest: { key: 'icon_chest', h: 46 }, SavePoint: { key: 'icon_fountain', h: 84 },
};
const GATE_ICON: Record<string, string> = { double: 'icon_e_wind', dive: 'icon_e_water', break: 'icon_e_fire' };
const NPC_COLOR: Record<string, number> = { smith: 0xc2683a, priest: 0xe8e0c0, merchant: 0x6aa86a, guide: 0x6aa0d8 };

/**
 * Placeholder visuals for room objects (legacy icons / simple shapes until the P01 art pack arrives)
 * and the action each one does when the player presses ▲ next to it.
 */
export function spawnEntityView(scene: WorldScene, e: EntityData, save: SaveData, abilities: Set<Ability>): Interactable | null {
  const f = e.fields;
  switch (e.type) {
    case 'Sign': case 'Altar': case 'Anvil': case 'SavePoint': {
      const ic = ICON[e.type] as { key: string; h: number };
      const img = scene.add.image(e.x, e.y, ic.key).setOrigin(0.5, 1).setDepth(7);
      img.setScale(ic.h / img.height);
      const use = e.type === 'Sign' ? () => scene.openDialog('', [t(String(f.text))])
        : e.type === 'Altar' ? () => scene.openDialog('', [t('altar.soon')])
        : e.type === 'Anvil' ? () => scene.openDialog('', [t('anvil.soon')])
        : () => scene.setSpawn(e);
      return { e, height: ic.h, use };
    }
    case 'Chest': {
      const img = scene.add.image(e.x, e.y, 'icon_chest').setOrigin(0.5, 1).setDepth(7).setScale(46 / 104);
      if (save.chests[e.id]) img.setTint(0x888888);
      return { e, height: 46, use: () => {
        if (save.chests[e.id]) { scene.toast(t('chest.empty')); return; }
        save.chests[e.id] = true; scene.flush(); img.setTint(0x888888); scene.toast(t('chest.open'));
      } };
    }
    case 'Gate': {
      const ab = String(f.ability) as Ability;
      const img = scene.add.image(e.x, e.y - 4, GATE_ICON[ab] ?? 'icon_e_wind').setOrigin(0.5, 1).setDepth(7).setScale(34 / 128).setAlpha(abilities.has(ab) ? 1 : 0.55);
      scene.tweens.add({ targets: img, alpha: 1, duration: 900, yoyo: true, repeat: -1 });
      return { e, height: 38, use: () => scene.openDialog('', [t(String(f.text)) + (abilities.has(ab) ? ' ✓' : '')]) };
    }
    case 'Npc': {
      const id = String(f.npc);
      const body = scene.add.ellipse(e.x, e.y - 30, 34, 60, NPC_COLOR[id] ?? 0xcccccc).setStrokeStyle(3, 0x2a1a0a).setDepth(7);
      scene.add.circle(e.x, e.y - 68, 14, 0xf4d6b0).setStrokeStyle(3, 0x2a1a0a).setDepth(7);
      scene.add.text(e.x, e.y - 92, t(`npc.${id}.name`), { fontFamily: 'Itim', fontSize: '16px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(7);
      void body;
      return { e, height: 96, use: () => scene.openDialog(t(`npc.${id}.name`), [1, 2].map((n) => t(`npc.${id}.${n}`)).filter((x) => !x.startsWith('npc.'))) };
    }
    default: return null;
  }
}
