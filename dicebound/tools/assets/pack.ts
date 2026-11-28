import { CONFIG } from './config';
import type { Raster } from './pixels';

export interface PackItem {
  id: string;
  raster: Raster;
}

export interface Placement {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackedAtlas {
  pages: Raster[];
  placements: Placement[];
}

/** Shelf packer: tallest first, left to right, new shelf when the row is full. */
export function packAtlas(items: PackItem[]): PackedAtlas {
  const size = CONFIG.atlasSize;
  const pad = CONFIG.atlasPadding;
  const sorted = [...items].sort((a, b) => b.raster.height - a.raster.height || a.id.localeCompare(b.id));
  const pages: Raster[] = [];
  const placements: Placement[] = [];
  let x = pad;
  let y = pad;
  let shelf = 0;
  const newPage = (): Raster => {
    const page = { width: size, height: size, data: Buffer.alloc(size * size * 4) };
    pages.push(page);
    x = pad;
    y = pad;
    shelf = 0;
    return page;
  };
  let page = newPage();
  for (const item of sorted) {
    const { width, height } = item.raster;
    if (width + pad * 2 > size || height + pad * 2 > size) throw new Error(`${item.id} (${width}x${height}) does not fit a ${size}px atlas`);
    if (x + width + pad > size) {
      x = pad;
      y += shelf + pad;
      shelf = 0;
    }
    if (y + height + pad > size) page = newPage();
    for (let row = 0; row < height; row++) {
      item.raster.data.copy(page.data, ((y + row) * size + x) * 4, row * width * 4, (row + 1) * width * 4);
    }
    placements.push({ id: item.id, page: pages.length - 1, x, y, w: width, h: height });
    x += width + pad;
    shelf = Math.max(shelf, height);
  }
  return { pages: pages.map(cropToContent), placements };
}

/** Drops the unused bottom of a page so the last atlas page is not mostly empty. */
function cropToContent(page: Raster): Raster {
  let lastRow = 0;
  for (let y = page.height - 1; y >= 0 && lastRow === 0; y--) {
    for (let x = 0; x < page.width; x++) {
      if (page.data[(y * page.width + x) * 4 + 3]) {
        lastRow = y + 1;
        break;
      }
    }
  }
  const height = Math.min(page.height, lastRow + CONFIG.atlasPadding);
  return { width: page.width, height, data: page.data.subarray(0, page.width * height * 4) };
}
