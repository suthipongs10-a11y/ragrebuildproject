import { describe, expect, it } from 'vitest';
import { parseCsv, parseFinalSize, parseSlice } from '../../tools/assets/manifest';
import { labelComponents, type Raster } from '../../tools/assets/pixels';
import { sliceAlphaRow, sliceBlackRow, sliceGrid } from '../../tools/assets/slice';

const OPAQUE = 255;

/** Builds a raster from rows of text: '#' = solid white pixel, anything else = empty. */
function rasterFrom(rows: string[], background: 'alpha' | 'black'): Raster {
  const width = rows[0]?.length ?? 0;
  const data = Buffer.alloc(width * rows.length * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const p = (y * width + x) * 4;
      const lit = ch === '#';
      data[p] = data[p + 1] = data[p + 2] = lit ? OPAQUE : 0;
      data[p + 3] = lit || background === 'black' ? OPAQUE : 0;
    });
  });
  return { width, height: rows.length, data };
}

/** `count` solid blocks of `size` px in a row, `gap` px apart, on a transparent strip. */
function blocks(count: number, size: number, gap: number): string[] {
  const row = Array.from({ length: count }, () => '#'.repeat(size)).join('.'.repeat(gap));
  const padded = `..${row}..`;
  return [...Array<string>(2).fill('.'.repeat(padded.length)), ...Array<string>(size).fill(padded), ...Array<string>(2).fill('.'.repeat(padded.length))];
}

describe('manifest parsing', () => {
  it('reads quoted CSV fields that contain commas', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + 'a,b\n1,"x, y"\n')).toEqual([['a', 'b'], ['1', 'x, y']]);
  });

  it('understands every slice spec used by the packs', () => {
    expect(parseSlice('slice 4 cells left→right: idle, attack, hurt, victory')).toEqual({ kind: 'row', count: 4, names: ['idle', 'attack', 'hurt', 'victory'] });
    expect(parseSlice('slice 6 frames → additive blend')).toEqual({ kind: 'row', count: 6, names: null });
    expect(parseSlice('slice 3x2 → die_1..die_6')).toEqual({ kind: 'grid', cols: 3, rows: 2, names: ['die_1', 'die_2', 'die_3', 'die_4', 'die_5', 'die_6'] });
    expect(parseSlice('slice 3x3 → icon_<name>.png')).toEqual({ kind: 'grid', cols: 3, rows: 3, names: null });
    expect(parseSlice('slice 5 rows, tile horizontally')).toEqual({ kind: 'rows', count: 5 });
    expect(parseSlice('single image (ตรวจตัวสะกดก่อนใช้)')).toEqual({ kind: 'single' });
    expect(parseSlice('reference only')).toEqual({ kind: 'reference' });
  });

  it('treats approximate sizes as "keep native"', () => {
    expect(parseFinalSize('256x256 per cell')).toEqual({ width: 256, height: 256 });
    expect(parseFinalSize('1200 wide')).toEqual({ width: 1200, height: null });
    expect(parseFinalSize('per button ~420x110')).toBeNull();
    expect(parseFinalSize('varies')).toBeNull();
  });
});

describe('slicing', () => {
  it('labels diagonal neighbours as one component', () => {
    const raster = rasterFrom(['#..', '.#.', '..#'], 'alpha');
    const mask = Uint8Array.from({ length: 9 }, (_, i) => (raster.data[i * 4 + 3] ? 1 : 0));
    expect(labelComponents(mask, 3, 3).components).toHaveLength(1);
  });

  it('cuts separate poses left to right', () => {
    const cut = sliceAlphaRow(rasterFrom(blocks(3, 20, 6), 'alpha'), 3);
    expect(cut.failure).toBeNull();
    expect(cut.pieces.map((p) => p.raster.width)).toEqual([20, 20, 20]);
    expect(cut.pieces.map((p) => p.box.x0)).toEqual([2, 28, 54]);
  });

  it('separates poses joined by a thin bridge instead of guessing', () => {
    const rows = blocks(2, 20, 6);
    const bridged = rows.map((row, y) => (y === 10 ? row.replace('#......#', '########') : row));
    const cut = sliceAlphaRow(rasterFrom(bridged, 'alpha'), 2);
    expect(cut.failure).toBeNull();
    expect(cut.method).toContain('erosion');
    expect(cut.pieces).toHaveLength(2);
    // The bridge is shared out, so the two pieces together cover every artwork column once.
    expect(cut.pieces.reduce((sum, p) => sum + p.raster.width, 0)).toBe(46);
  });

  it('reports a sheet with fewer poses than the manifest expects', () => {
    const cut = sliceAlphaRow(rasterFrom(blocks(2, 20, 6), 'alpha'), 3);
    expect(cut.pieces).toHaveLength(0);
    expect(cut.failure).toContain('expected 3');
  });

  it('fuses scattered effect sparks into the expected frame count', () => {
    const row = '..##.#....##.#....##.#..';
    const cut = sliceBlackRow(rasterFrom(['.'.repeat(row.length), row, row, '.'.repeat(row.length)], 'black'), 3);
    expect(cut.failure).toBeNull();
    expect(cut.pieces.map((p) => p.raster.width)).toEqual([4, 4, 4]);
  });

  it('reports an empty grid cell', () => {
    const half = `${'#'.repeat(8)}${'.'.repeat(8)}`;
    const cut = sliceGrid(rasterFrom(Array<string>(8).fill(half), 'alpha'), 2, 1, 'alpha');
    expect(cut.failure).toContain('cell(s) 1');
  });
});
