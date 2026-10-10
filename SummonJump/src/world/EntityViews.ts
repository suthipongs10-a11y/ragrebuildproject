import Phaser from 'phaser';
import type { EntityData } from '@shared/platformer';
import { t } from '../i18n';
import type { SaveData } from '../save/local';
import type { Ability } from './abilities';
import type { WorldScene } from '../scenes/WorldScene';
import { propLook, type PropLook } from '../assets/props';

export interface Interactable { e: EntityData; height: number; use: () => void; label: string }

/** Tapping the object itself also interacts (phones): hero must be close enough. */
function tappable(scene: WorldScene, obj: Phaser.GameObjects.GameObject, it: () => Interactable): void {
  obj.setInteractive({ useHandCursor: true });
  obj.on('pointerup', () => scene.tapInteract(it()));
}

const NPC_COLOR: Record<string, number> = { smith: 0xc2683a, priest: 0xe8e0c0, merchant: 0x6aa86a, guide: 0x6aa0d8, portal: 0x9a6ad8 };

/** Painted prop (P01 art or the legacy icon), feet on the entity's ground point. */
function propImage(scene: WorldScene, e: EntityData, look: PropLook, key = look.key): Phaser.GameObjects.Image {
  const img = scene.add.image(e.x, e.y, key).setOrigin(0.5, 1).setDepth(7);
  img.setScale(look.h / img.height);
  return img;
}

/** Show the alternate picture (talk pose, open chest, lit statue) — for `ms`, or for good when ms is 0. */
function swap(scene: WorldScene, img: Phaser.GameObjects.Image, look: PropLook, ms = 0): void {
  if (!look.alt) return;
  img.setTexture(look.alt).setScale(look.h / img.height);
  if (ms) scene.time.delayedCall(ms, () => { if (img.active) img.setTexture(look.key).setScale(look.h / img.height); });
}

/**
 * Room objects (P01 World Props / P05 portal art, legacy icons as fallback)
 * and the action each one does when the player presses ▲ next to it.
 */
export function spawnEntityView(scene: WorldScene, e: EntityData, save: SaveData, abilities: Set<Ability>): Interactable | null {
  const f = e.fields;
  const look = propLook(e.type, f);
  switch (e.type) {
    case 'Sign': case 'Altar': case 'Anvil': case 'SavePoint': {
      const lk = look as PropLook;
      const img = propImage(scene, e, lk);
      const here = save.spawn?.room === scene.level.id && Math.abs((save.spawn?.x ?? 0) - (e.x + 40)) < 2;
      if (e.type === 'SavePoint' && here) swap(scene, img, lk);
      const use = e.type === 'Sign' ? () => scene.openDialog('', [t(String(f.text))])
        : e.type === 'Altar' ? () => scene.openMenu('summon')
        : e.type === 'Anvil' ? () => scene.openMenu('refine')
        : () => { scene.setSpawn(e); swap(scene, img, lk); };
      const it: Interactable = { e, height: lk.h, use, label: t(e.type === 'Sign' ? 'act.read' : e.type === 'SavePoint' ? 'act.save' : e.type === 'Altar' ? 'act.summon' : 'act.use') };
      tappable(scene, img, () => it);
      return it;
    }
    case 'Chest': {
      const lk = look as PropLook;
      const img = propImage(scene, e, lk);
      const opened = () => { if (lk.alt) swap(scene, img, lk); else img.setTint(0x888888); };
      if (save.chests[e.id]) opened();
      const it: Interactable = { e, height: lk.h, label: t('act.open'), use: () => {
        if (save.chests[e.id]) { scene.toast(t('chest.empty')); return; }
        save.chests[e.id] = true; scene.flush(); opened(); scene.toast(t('chest.open'));
      } };
      tappable(scene, img, () => it);
      return it;
    }
    case 'Gate': {
      const ab = String(f.ability) as Ability, lk = look as PropLook;
      const img = propImage(scene, e, lk).setY(e.y + 4).setAlpha(abilities.has(ab) ? 1 : 0.55);
      if (lk.key.startsWith('prop_')) img.setDisplaySize(lk.h * 2.4, lk.h); // flat floor plate
      scene.tweens.add({ targets: img, alpha: 1, duration: 900, yoyo: true, repeat: -1 });
      const it: Interactable = { e, height: 38, label: t('act.read'), use: () => scene.openDialog('', [t(String(f.text)) + (abilities.has(ab) ? ' ✓' : '')]) };
      tappable(scene, img, () => it);
      return it;
    }
    case 'Npc': {
      const id = String(f.npc);
      const name = scene.add.text(e.x, e.y - (look ? look.h + 14 : 92), t(`npc.${id}.name`), { fontFamily: 'Itim', fontSize: '16px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 4 }).setOrigin(0.5).setDepth(7);
      let parts: Phaser.GameObjects.GameObject[];
      let img: Phaser.GameObjects.Image | null = null;
      if (look) {
        if (id === 'portal' && scene.textures.exists('prop_portal_gate')) {
          const gate = scene.add.image(e.x + 34, e.y + 2, 'prop_portal_gate').setOrigin(0.5, 1).setDepth(6.5);
          gate.setScale(130 / gate.height);
          scene.tweens.add({ targets: gate, alpha: 0.85, duration: 1200, yoyo: true, repeat: -1 });
        }
        img = propImage(scene, e, look);
        scene.tweens.add({ targets: img, scaleY: img.scaleY * 1.015, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' }); // breathing
        parts = [img, name];
      } else {
        const body = scene.add.ellipse(e.x, e.y - 30, 34, 60, NPC_COLOR[id] ?? 0xcccccc).setStrokeStyle(3, 0x2a1a0a).setDepth(7);
        const head = scene.add.circle(e.x, e.y - 68, 14, 0xf4d6b0).setStrokeStyle(3, 0x2a1a0a).setDepth(7);
        parts = [body, head, name];
      }
      const talk = () => scene.openDialog(t(`npc.${id}.name`), [1, 2].map((n) => t(`npc.${id}.${n}`)).filter((x) => !x.startsWith('npc.')));
      const act = id === 'smith' ? () => scene.openMenu('refine')
        : id === 'merchant' ? () => scene.openMenu('shop')
        : id === 'portal' ? () => scene.openMenu('arena')
        : id === 'priest' ? () => (scene.session.data.job === 'novice' ? scene.openMenu('job') : talk())
        : talk;
      const use = () => { if (img && look) swap(scene, img, look, 2500); act(); };
      const it: Interactable = { e, height: look?.h ?? 96, use, label: t(id === 'smith' ? 'act.refine' : id === 'merchant' ? 'act.shop' : id === 'portal' ? 'act.arena' : 'act.talk') };
      for (const o of parts) tappable(scene, o, () => it);
      return it;
    }
    default: return null;
  }
}
