import Phaser from 'phaser';
import type { EntityData } from '@shared/platformer';
import { t } from '../i18n';
import type { SaveData } from '../save/local';
import type { Ability } from './abilities';
import type { WorldScene } from '../scenes/WorldScene';

export interface Interactable { e: EntityData; height: number; use: () => void; label: string }

/** Tapping the object itself also interacts (phones): hero must be close enough. */
function tappable(scene: WorldScene, obj: Phaser.GameObjects.GameObject, it: () => Interactable): void {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerup', () => scene.tapInteract(it()));
}

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
        : e.type === 'Altar' ? () => scene.openMenu('summon')
        : e.type === 'Anvil' ? () => scene.openMenu('refine')
        : () => scene.setSpawn(e);
      const it: Interactable = { e, height: ic.h, use, label: t(e.type === 'Sign' ? 'act.read' : e.type === 'SavePoint' ? 'act.save' : e.type === 'Altar' ? 'act.summon' : 'act.use') };
      tappable(scene, img, () => it);
      return it;
    }
    case 'Chest': {
      const img = scene.add.image(e.x, e.y, 'icon_chest').setOrigin(0.5, 1).setDepth(7).setScale(46 / 104);
      if (save.chests[e.id]) img.setTint(0x888888);
      const it: Interactable = { e, height: 46, label: t('act.open'), use: () => {
        if (save.chests[e.id]) { scene.toast(t('chest.empty')); return; }
        save.chests[e.id] = true; scene.flush(); img.setTint(0x888888); scene.toast(t('chest.open'));
      } };
      tappable(scene, img, () => it);
      return it;
    }
    case 'Gate': {
      const ab = String(f.ability) as Ability;
      const img = scene.add.image(e.x, e.y - 4, GATE_ICON[ab] ?? 'icon_e_wind').setOrigin(0.5, 1).setDepth(7).setScale(34 / 128).setAlpha(abilities.has(ab) ? 1 : 0.55);
      scene.tweens.add({ targets: img, alpha: 1, duration: 900, yoyo: true, repeat: -1 });
      const it: Interactable = { e, height: 38, label: t('act.read'), use: () => scene.openDialog('', [t(String(f.text)) + (abilities.has(ab) ? ' ✓' : '')]) };
      tappable(scene, img, () => it);
      return it;
    }
    case 'Npc': {
      const id = String(f.npc);
      const body = scene.add.ellipse(e.x, e.y - 30, 34, 60, NPC_COLOR[id] ?? 0xcccccc).setStrokeStyle(3, 0x2a1a0a).setDepth(7);
      const head = scene.add.circle(e.x, e.y - 68, 14, 0xf4d6b0).setStrokeStyle(3, 0x2a1a0a).setDepth(7);
      const name = scene.add.text(e.x, e.y - 92, t(`npc.${id}.name`), { fontFamily: 'Itim', fontSize: '16px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(7);
      const talk = () => scene.openDialog(t(`npc.${id}.name`), [1, 2].map((n) => t(`npc.${id}.${n}`)).filter((x) => !x.startsWith('npc.')));
      const use = id === 'smith' ? () => scene.openMenu('refine')
        : id === 'merchant' ? () => scene.openMenu('shop')
        : id === 'priest' ? () => (scene.session.data.job === 'novice' ? scene.openMenu('job') : talk())
        : talk;
      const it: Interactable = { e, height: 96, use, label: t(id === 'smith' ? 'act.refine' : id === 'merchant' ? 'act.shop' : 'act.talk') };
      for (const o of [body, head, name]) tappable(scene, o, () => it);
      return it;
    }
    default: return null;
  }
}
