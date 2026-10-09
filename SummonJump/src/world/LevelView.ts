import Phaser from 'phaser';
import { Cell, TILE, type EntityData, type LevelData, type TileGrid } from '@shared/platformer';
import type { ZoneId } from '../assets/packs';
import { buildZoneBackdrop, drawPlatform } from './Parallax';

const SOLID_COLOR: Record<string, number> = { forest: 0x5a4630, deep: 0x3d3a2a, town: 0x7a6248, sky: 0xd9e4ee, abyss: 0x2f4a5a, desert: 0xb88f55 };

export interface LevelVisuals {
  /** rock cell ("tx,ty") -> placeholder rectangle */
  rocks: Map<string, Phaser.GameObjects.GameObject>;
}

/**
 * Builds everything you see for a room: painted parallax backdrop, platform art, placeholder blocks
 * (rocks, pipes, walls — replaced by the P01 art pack later) and the water tint.
 */
export function buildLevelVisuals(scene: Phaser.Scene, level: LevelData, grid: TileGrid, viewW: number, viewH: number, roomName: (id: string) => string): LevelVisuals {
  const zone = level.zone as ZoneId;
  const floorY = level.floorRow === null ? null : level.floorRow * TILE;
  buildZoneBackdrop(scene, zone, grid.pxW, viewW, viewH, floorY);

  const rocks = new Map<string, Phaser.GameObjects.GameObject>();
  const g = scene.add.graphics().setDepth(5.5);
  const solid = SOLID_COLOR[level.zone] ?? 0x5a4630;
  for (let ty = 0; ty < grid.h; ty++) {
    for (let tx = 0; tx < grid.w; tx++) {
      const c = grid.get(tx, ty);
      if (c === Cell.OneWay) {
        let run = 1;
        while (grid.get(tx + run, ty) === Cell.OneWay) run++;
        drawPlatform(scene, zone, tx * TILE, ty * TILE, run * TILE);
        tx += run - 1;
      } else if (c === Cell.Rock) {
        const r = scene.add.rectangle(tx * TILE, ty * TILE, TILE, TILE, 0x8a8478).setOrigin(0, 0).setStrokeStyle(2, 0x4a443a).setDepth(6);
        rocks.set(`${tx},${ty}`, r);
      } else if ((c === Cell.Solid || c === Cell.PipeTop) && (level.floorRow === null || ty < level.floorRow)) {
        g.fillStyle(c === Cell.PipeTop ? 0x3fa66b : solid, 1).fillRect(tx * TILE, ty * TILE, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.25).strokeRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  for (const e of level.entities) if (e.type === 'Pipe') drawPipe(scene, e, level, roomName(String(e.fields.target)));
  drawExitHints(scene, level, grid, roomName);
  if (level.water) scene.add.rectangle(0, 0, grid.pxW, grid.pxH, 0x2a8fbf, 0.28).setOrigin(0, 0).setDepth(12);
  return { rocks };
}

function drawPipe(scene: Phaser.Scene, e: EntityData, level: LevelData, targetName: string): void {
  const left = e.x - e.w / 2, top = e.y - e.h;
  const g = scene.add.graphics().setDepth(6);
  if (e.fields.dir === 'down') {
    const bottom = (level.floorRow ?? 15) * TILE;
    g.fillStyle(0x2f8a58, 1).fillRect(left + 4, top + e.h, e.w - 8, bottom - top - e.h);
    g.fillStyle(0x3fa66b, 1).fillRoundedRect(left, top, e.w, e.h, 6).lineStyle(2, 0x1d5b3a, 1).strokeRoundedRect(left, top, e.w, e.h, 6);
  } else {
    g.fillStyle(0x3fa66b, 1).fillRoundedRect(left, top, e.w, e.h, 6).lineStyle(2, 0x1d5b3a, 1).strokeRoundedRect(left, top, e.w, e.h, 6);
  }
  const down = e.fields.dir === 'down';
  scene.add.text(e.x, down ? top - 40 : e.y + 70, `${down ? '▼' : '▲'} ${targetName}`, { fontFamily: 'Itim', fontSize: '20px', color: '#c8ffd8', stroke: '#0f2a1a', strokeThickness: 5 })
    .setOrigin(0.5).setDepth(40).setAlpha(0.9);
}

/** Arrow + destination name at every exit so players can see where to go. `ExitHint` entities override the spot. */
function drawExitHints(scene: Phaser.Scene, level: LevelData, grid: TileGrid, roomName: (id: string) => string): void {
  const groundY = level.floorRow === null ? grid.pxH / 2 : level.floorRow * TILE - 110;
  const spot: Record<string, [number, number, 0 | 0.5 | 1]> = {
    left: [12, groundY, 0], right: [grid.pxW - 12, groundY, 1], up: [grid.pxW / 2, 70, 0.5], down: [grid.pxW / 2, grid.pxH - 40, 0.5],
  };
  for (const e of level.entities) if (e.type === 'ExitHint') spot[String(e.fields.dir)] = [e.x, e.y - TILE / 2, 0.5];
  const arrow: Record<string, string> = { left: '◀', right: '▶', up: '▲', down: '▼' };
  for (const [dir, to] of Object.entries(level.exitTo)) {
    const p = spot[dir];
    if (!p || !to) continue;
    const label = dir === 'right' ? `${roomName(to)} ${arrow[dir]}` : `${arrow[dir]} ${roomName(to)}`;
    const tx = scene.add.text(p[0], p[1], label, { fontFamily: 'Itim', fontSize: '22px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 5 }).setOrigin(p[2], 0.5).setDepth(40).setAlpha(0.9);
    const dx = dir === 'left' ? -6 : dir === 'right' ? 6 : 0, dy = dir === 'up' ? -6 : dir === 'down' ? 6 : 0;
    scene.tweens.add({ targets: tx, x: p[0] + dx, y: p[1] + dy, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}
