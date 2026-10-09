/** Tile grid used for collision. Pure data, no Phaser. */
export const TILE = 32;

export const Cell = { Empty: 0, Solid: 1, OneWay: 2, Rock: 3, PipeTop: 4 } as const;
export type CellId = (typeof Cell)[keyof typeof Cell];

export const isSolidCell = (c: number): boolean => c === Cell.Solid || c === Cell.Rock || c === Cell.PipeTop;

export class TileGrid {
  readonly cells: Uint8Array;
  constructor(readonly w: number, readonly h: number, cells?: ArrayLike<number>) {
    this.cells = new Uint8Array(w * h);
    if (cells) this.cells.set(cells);
  }
  /** Out of range = empty (room edges are handled by exits / clamps). */
  get(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return Cell.Empty;
    return this.cells[ty * this.w + tx] as number;
  }
  set(tx: number, ty: number, c: number): void {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.cells[ty * this.w + tx] = c;
  }
  get pxW(): number { return this.w * TILE; }
  get pxH(): number { return this.h * TILE; }
  clone(): TileGrid { return new TileGrid(this.w, this.h, this.cells); }
}
