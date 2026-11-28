/** Where everything sits on the 1920x1080 design canvas: board left ~40%, battle right ~60%. */
export const LAYOUT = {
  board: { x: 44, y: 92, size: 680, sourceSize: 1024, firstCell: 142, pitch: 185, cells: 5, tileSize: 150, pawnSize: 96 },
  topBar: { x: 44, y: 22, heartSize: 52, heartGap: 60, goldX: 250, lapX: 470, iconSize: 48 },
  controls: { x: 44, y: 786, width: 680, buttonY: 198, buttonHeight: 80, buttonGap: 16, faceSize: 64, faceY: 122 },
  battle: { x: 800, y: 24, width: 1096, height: 660, ground: 590, centerX: 600, teamGap: 92, enemyGap: 128, frontOffset: 96, depthStep: 30, bossOffset: 250 },
  nextWave: { x: 800, y: 704, width: 540, height: 150, iconSize: 96, iconGap: 104 },
  status: { x: 1356, y: 704, width: 540, height: 150, iconSize: 64, iconGap: 76 },
  log: { x: 800, y: 870, width: 1096, height: 186, lines: 5, lineHeight: 32 },
  hpBar: { width: 84, height: 9, offsetY: 14, bossWidth: 260 },
  die: { size: 190 },
  banner: { y: 300 },
  panelPad: 18,
} as const;

export const TEXT = {
  small: 24,
  body: 28,
  label: 30,
  title: 40,
  big: 64,
  damage: 34,
} as const;

/** Centre of board slot `index` in board-local pixels (ring runs clockwise from the top-left gate). */
export function tileCenter(index: number, size: number): { x: number; y: number } {
  const { cells, firstCell, pitch, sourceSize } = LAYOUT.board;
  const side = cells - 1;
  const k = index % (side * 4);
  let col = 0;
  let row = 0;
  if (k < side) col = k;
  else if (k < side * 2) {
    col = side;
    row = k - side;
  } else if (k < side * 3) {
    col = side - (k - side * 2);
    row = side;
  } else row = side - (k - side * 3);
  const scale = size / sourceSize;
  return { x: (firstCell + pitch * col) * scale, y: (firstCell + pitch * row) * scale };
}
