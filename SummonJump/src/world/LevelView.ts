import Phaser from 'phaser';
import { Cell, TILE, type EntityData, type LevelData, type TileGrid } from '@shared/platformer';
import { zoneKey } from '../assets/packs';
import { buildZoneBackdrop, drawPlatform } from './Parallax';
import { t } from '../i18n';

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
  const layer = (l: string) => zoneKey(level.zone, level.variant, l);
  const floorY = level.floorRow === null ? null : level.floorRow * TILE;
  buildZoneBackdrop(scene, layer, grid.pxW, viewW, viewH, floorY);

  const rocks = new Map<string, Phaser.GameObjects.GameObject>();
  const g = scene.add.graphics().setDepth(5.5);
  const solid = SOLID_COLOR[level.zone] ?? 0x5a4630;
  for (let ty = 0; ty < grid.h; ty++) {
    for (let tx = 0; tx < grid.w; tx++) {
      const c = grid.get(tx, ty);
      if (c === Cell.OneWay) {
        let run = 1;
        while (grid.get(tx + run, ty) === Cell.OneWay) run++;
        drawPlatform(scene, layer('plat'), tx * TILE, ty * TILE, run * TILE);
        tx += run - 1;
      } else if (c === Cell.Rock) {
        if (rocks.has(`${tx},${ty}`)) continue;
        // painted boulder column (P03 env art) over the whole run of rock cells, else grey blocks
        let n = 1;
        while (grid.get(tx, ty + n) === Cell.Rock) n++;
        const r: Phaser.GameObjects.GameObject = scene.textures.exists('env_boulder')
          ? scene.add.image(tx * TILE + TILE / 2, (ty + n) * TILE + 4, 'env_boulder').setOrigin(0.5, 1).setDisplaySize(TILE * 1.9, n * TILE + 10).setDepth(6)
          : scene.add.rectangle(tx * TILE, ty * TILE, TILE, TILE * n, 0x8a8478).setOrigin(0, 0).setStrokeStyle(2, 0x4a443a).setDepth(6);
        for (let i = 0; i < n; i++) rocks.set(`${tx},${ty + i}`, r);
      } else if (level.zone === 'sky' && c === Cell.Solid && (level.floorRow === null || ty < level.floorRow)) {
        // cloud floors: painted platform on the top surface, soft cloud body below (no block grid)
        if (grid.get(tx, ty - 1) !== Cell.Solid) {
          let run = 1;
          while (grid.get(tx + run, ty) === Cell.Solid && grid.get(tx + run, ty - 1) !== Cell.Solid) run++;
          drawPlatform(scene, layer('plat'), tx * TILE, ty * TILE, run * TILE);
          tx += run - 1;
        } else g.fillStyle(0xf6efe2, 0.5).fillRect(tx * TILE, ty * TILE, TILE, TILE);
      } else if ((c === Cell.Solid || c === Cell.PipeTop) && (level.floorRow === null || ty < level.floorRow)) {
        g.fillStyle(c === Cell.PipeTop ? 0x3fa66b : solid, 1).fillRect(tx * TILE, ty * TILE, TILE, TILE);
        g.lineStyle(1, 0x000000, 0.25).strokeRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  for (const e of level.entities) if (e.type === 'Pipe') drawPipe(scene, e, level, roomName(String(e.fields.target)));
  drawExitHints(scene, level, grid, roomName);
  labelRocks(scene, rocks);
  if (level.water) scene.add.rectangle(0, 0, grid.pxW, grid.pxH, 0x2a8fbf, 0.28).setOrigin(0, 0).setDepth(12);
  return { rocks };
}

function drawPipe(scene: Phaser.Scene, e: EntityData, level: LevelData, targetName: string): void {
  const left = e.x - e.w / 2, top = e.y - e.h;
  const down = e.fields.dir === 'down';
  const label = () => scene.add.text(e.x, down ? top - 40 : e.y + 70, `${down ? '▼' : '▲'} ${targetName}`, { fontFamily: 'Itim', fontSize: '20px', color: '#c8ffd8', stroke: '#0f2a1a', strokeThickness: 5 })
    .setOrigin(0.5).setDepth(40).setAlpha(0.9);
  if (scene.textures.exists('env_pipe')) {
    // painted pipe: standing on the floor (down) or hanging from the ceiling (up)
    const y0 = down ? top : 0, y1 = down ? (level.floorRow ?? 15) * TILE : e.y;
    scene.add.image(e.x, y0, 'env_pipe').setOrigin(0.5, 0).setDisplaySize(e.w + 12, y1 - y0).setFlipY(!down).setDepth(6);
    label();
    return;
  }
  const g = scene.add.graphics().setDepth(6);
  if (down) {
    const bottom = (level.floorRow ?? 15) * TILE;
    g.fillStyle(0x2f8a58, 1).fillRect(left + 4, top + e.h, e.w - 8, bottom - top - e.h);
    g.fillStyle(0x3fa66b, 1).fillRoundedRect(left, top, e.w, e.h, 6).lineStyle(2, 0x1d5b3a, 1).strokeRoundedRect(left, top, e.w, e.h, 6);
  } else {
    g.fillStyle(0x3fa66b, 1).fillRoundedRect(left, top, e.w, e.h, 6).lineStyle(2, 0x1d5b3a, 1).strokeRoundedRect(left, top, e.w, e.h, 6);
  }
  label();
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
    const note = level.entities.find((e) => e.type === 'ExitHint' && e.fields.dir === dir)?.fields.note;
    const full = note ? `${label}\n${t(String(note))}` : label;
    const tx = scene.add.text(p[0], p[1], full, { fontFamily: 'Itim', fontSize: '22px', color: '#fff6e2', stroke: '#2a1a0a', strokeThickness: 5, align: 'center' }).setOrigin(p[2], 0.5).setDepth(40).setAlpha(0.9);
    p[0] = Phaser.Math.Clamp(p[0], tx.width * p[2] + 8, grid.pxW - tx.width * (1 - p[2]) - 8); // keep the label on screen
    tx.x = p[0];
    const dx = dir === 'left' ? -6 : dir === 'right' ? 6 : 0, dy = dir === 'up' ? -6 : dir === 'down' ? 6 : 0;
    scene.tweens.add({ targets: tx, x: p[0] + dx, y: p[1] + dy, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}

/** "smash me" label on a rock wall; stored with the rocks so it disappears when they break. */
function labelRocks(scene: Phaser.Scene, rocks: Map<string, Phaser.GameObjects.GameObject>): void {
  if (!rocks.size) return;
  let minX = Infinity, maxY = -Infinity;
  for (const k of rocks.keys()) { const [x, y] = k.split(',').map(Number) as [number, number]; minX = Math.min(minX, x); maxY = Math.max(maxY, y); }
  const lbl = scene.add.text(minX * TILE - 8, maxY * TILE - 30, t('hint.rock'), { fontFamily: 'Itim', fontSize: '20px', color: '#ffd0a0', stroke: '#2a1a0a', strokeThickness: 5 })
    .setOrigin(1, 0.5).setDepth(40);
  rocks.set('label', lbl);
}
