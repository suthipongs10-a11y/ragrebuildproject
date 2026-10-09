import Phaser from 'phaser';
import { BootScene } from './boot/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { Controls } from './input/Controls';
import { t } from './i18n';
import { lockZoom } from './ui/noZoom';
import { Menu } from './ui/menu/Menu';

lockZoom();

export const GAME_W = 960;
export const GAME_H = 540;

const controls = new Controls();
(document.getElementById('b_atk') as HTMLElement).textContent = t('ui.attack');
(document.getElementById('b_jump') as HTMLElement).textContent = t('ui.jump');
(document.getElementById('rotate') as HTMLElement).textContent = t('ui.rotate');
(document.getElementById('keys') as HTMLElement).textContent = t('keys.desktop');

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#17120c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1400 }, debug: false, fixedStep: false } },
  render: { antialias: true, pixelArt: false },
  fps: { smoothStep: false },
  scene: [BootScene, WorldScene],
});
game.registry.set('controls', controls);
const menu = new Menu();
game.registry.set('menu', menu);
document.getElementById('b_menu')?.addEventListener('pointerup', (e) => { e.preventDefault(); if (menu.isOpen) menu.close(); else menu.open(); });

// expose for smoke tests / debugging
(window as unknown as { __game: Phaser.Game }).__game = game;
