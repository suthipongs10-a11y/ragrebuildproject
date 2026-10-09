import Phaser from 'phaser';
import { art, type ZoneId } from '../assets/packs';

/** Builds the painted 5-layer zone: far / mid / near backdrops + ground strip + returns the floor Y. */
export function buildZoneBackdrop(scene: Phaser.Scene, zone: ZoneId, roomW: number, viewW: number, viewH: number, floorY: number | null): void {
  // far: single image, barely moves
  const far = scene.add.image(0, 0, `zone_${zone}_far`).setOrigin(0, 0).setScrollFactor(0.12, 0);
  const farScale = (viewH / far.height) * 1.12;
  far.setScale(Math.max(farScale, ((viewW + (roomW - viewW) * 0.12) / far.width) * 1.02));
  far.y = viewH - far.displayHeight;

  // mid / near: tiled copies (alternating flip hides seams), different scroll speeds
  const tiled = (key: string, factor: number, alpha = 1) => {
    const probe = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const s = (viewH / probe.height) * 1.04;
    const w = probe.width * s;
    const needed = viewW + (roomW - viewW) * factor;
    for (let i = 0, x = 0; x < needed; i++, x += w) {
      scene.add.image(x, viewH, key).setOrigin(0, 1).setScale(s).setScrollFactor(factor, 0).setFlipX(i % 2 === 1).setAlpha(alpha);
    }
  };
  tiled(`zone_${zone}_mid`, 0.45);
  tiled(`zone_${zone}_near`, 0.75);

  if (floorY === null) return; // open-air room (no ground strip)
  // ground strip: one strip per screen width, painted surface aligned to floorY
  const groundKey = `zone_${zone}_ground`;
  const top = (art(groundKey).meta?.top as number | undefined) ?? 0.35;
  const g0 = scene.textures.get(groundKey).getSourceImage() as HTMLImageElement;
  const gs = viewW / g0.width;
  const gh = g0.height * gs;
  for (let i = 0, x = 0; x < roomW; i++, x += viewW) {
    scene.add.image(x, floorY - top * gh, groundKey).setOrigin(0, 0).setScale(gs).setFlipX(i % 2 === 1).setDepth(5);
  }
  // fill below the strip so nothing shows through on tall screens
  scene.add.rectangle(0, floorY - top * gh + gh - 2, roomW, viewH, 0x2a1d12).setOrigin(0, 0).setDepth(4);
}

/** Painted floating platform (visual only; collision comes from the level grid). `y` is the walkable top. */
export function drawPlatform(scene: Phaser.Scene, zone: ZoneId, x: number, y: number, width: number): void {
  const key = `zone_${zone}_plat`;
  const top = (art(key).meta?.top as number | undefined) ?? 0.25;
  const img = scene.add.image(x, y, key).setOrigin(0, 0).setDepth(6);
  img.setScale(width / img.width);
  img.y = y - top * img.displayHeight;
}
