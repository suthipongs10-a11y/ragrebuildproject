/**
 * The 8 prototype rooms (reference/demo_v3_src/game1.js) ported to a compact source form.
 * Tile coordinates are prototype tiles (16 px); build-levels.ts writes them to LDtk at 32 px tiles (same grid, 2x art scale).
 * Chars: # solid · - one-way · = solid platform · P pipe body · T pipe top · X breakable rock · U pipe exit tube · c cloud floor
 */
export interface EntitySrc { type: string; x: number; y: number; w?: number; h?: number; fields?: Record<string, string | number | boolean> }
export interface RoomSrc {
  id: string; zone: string; name: string; w?: number; h?: number; water?: boolean;
  exits?: Partial<Record<'left' | 'right' | 'up' | 'down', string>>;
  safe?: [number, number]; floorRow?: number;
  fill: [number, number, number, number, string][];
  entities: EntitySrc[];
  test?: boolean;
}

const sign = (x: number, y: number, key: string): EntitySrc => ({ type: 'Sign', x, y, fields: { text: key } });
const mon = (monster: string, x: number, y: number): EntitySrc => ({ type: 'Monster', x, y, fields: { monster } });
const item = (x: number, y: number): EntitySrc => ({ type: 'Item', x, y, fields: { item: 'stone' } });

export const ROOMS: RoomSrc[] = [
  { id: 'town', zone: 'town', name: 'zone.town', exits: { left: 'forest', right: 'desert', up: 'sky1' },
    fill: [[0, 15, 29, 16, '#'], [3, 12, 7, 12, '-'], [8, 9, 12, 9, '-'], [3, 6, 7, 6, '-'], [19, 12, 20, 12, 'T'], [19, 13, 20, 14, 'P'], [28, 0, 29, 14, 'X']],
    entities: [
      { type: 'SavePoint', x: 1, y: 14 }, { type: 'Anvil', x: 10, y: 14 }, { type: 'ExitHint', x: 5, y: 3, fields: { dir: 'up' } }, { type: 'Altar', x: 14, y: 14 },
      sign(5, 14, 'sign.town.sky'), sign(17, 14, 'sign.town.pipe'), sign(25, 14, 'sign.town.rock'),
      { type: 'Pipe', x: 19.5, y: 12, w: 2, h: 1, fields: { dir: 'down', target: 'abyss1', tx: 20, ty: 2 } },
      { type: 'Gate', x: 5, y: 14, fields: { ability: 'double', text: 'gate.double' } },
      { type: 'Gate', x: 22, y: 14, fields: { ability: 'dive', text: 'gate.dive' } },
      { type: 'Npc', x: 11.5, y: 14, fields: { npc: 'smith' } }, { type: 'Npc', x: 15.5, y: 14, fields: { npc: 'priest' } },
      { type: 'Npc', x: 23, y: 14, fields: { npc: 'merchant' } }, { type: 'Npc', x: 3, y: 14, fields: { npc: 'guide' } },
    ] },
  { id: 'forest', zone: 'forest', name: 'zone.forest', exits: { left: 'deep', right: 'town' },
    fill: [[0, 15, 29, 16, '#'], [4, 12, 7, 12, '-'], [10, 9, 14, 9, '-'], [22, 12, 25, 12, '-'], [17, 13, 18, 14, '#']],
    entities: [sign(2, 14, 'sign.forest.deep'), mon('poring', 8, 14), mon('poring', 21, 14), mon('poring', 26, 14), mon('mantis', 13, 14), mon('poring', 12, 8), item(24, 11)] },
  { id: 'deep', zone: 'deep', name: 'zone.deep', exits: { right: 'forest' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 1, 14, '#'], [6, 11, 10, 11, '-'], [19, 11, 23, 11, '-']],
    entities: [mon('king', 14, 14), mon('poring', 24, 14), mon('mantis', 8, 14)] },
  { id: 'sky1', zone: 'sky', name: 'zone.sky', exits: { down: 'town', right: 'sky2' }, safe: [2, 13],
    fill: [[0, 14, 14, 14, '-'], [15, 11, 19, 11, '-'], [21, 8, 25, 8, '-'], [26, 7, 29, 7, '-'], [23, 13, 29, 13, '-']],
    entities: [mon('bird', 10, 9), mon('bird', 22, 4), mon('bird', 4, 10), item(17, 10)] },
  { id: 'sky2', zone: 'sky', name: 'zone.sky2', exits: { left: 'sky1' }, safe: [14, 12],
    fill: [[0, 13, 29, 16, 'c'], [4, 9, 8, 9, '-'], [21, 9, 25, 9, '-']],
    entities: [mon('harpy', 15, 5)] },
  { id: 'abyss1', zone: 'abyss', name: 'zone.abyss', water: true, exits: { right: 'abyss2' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 1, 14, '#'], [0, 0, 29, 0, '#'], [19, 0, 20, 1, 'U'], [6, 11, 9, 14, '#'], [13, 8, 16, 8, '='], [24, 12, 26, 14, '#']],
    entities: [
      { type: 'Pipe', x: 19.5, y: 1, w: 2, h: 2, fields: { dir: 'up', target: 'town', tx: 20, ty: 12 } },
      sign(3, 14, 'sign.abyss.pipe'),
      mon('fish', 11, 5), mon('fish', 22, 6), mon('fish', 4, 9), mon('fish', 18, 12), item(14, 7)] },
  { id: 'abyss2', zone: 'abyss', name: 'zone.abyss2', water: true, exits: { left: 'abyss1' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 29, 0, '#'], [28, 0, 29, 14, '#'], [4, 10, 8, 10, '='], [12, 7, 15, 7, '=']],
    entities: [mon('kraken', 21, 8)] },
  { id: 'desert', zone: 'desert', name: 'zone.desert', exits: { left: 'town' },
    fill: [[0, 15, 29, 16, '#'], [28, 0, 29, 14, '#'], [8, 14, 11, 14, '#'], [9, 13, 10, 13, '#'], [16, 11, 20, 11, '-']],
    entities: [sign(3, 14, 'sign.desert.pyramid'), { type: 'Chest', x: 24, y: 14 }, mon('scorpion', 14, 14), mon('scorpion', 21, 14), item(18, 10)] },
  // wide test room (not linked): exercises the scrolling camera
  { id: 'test_wide', zone: 'forest', name: 'zone.forest', w: 80, test: true, exits: {},
    fill: [[0, 15, 79, 16, '#'], [10, 12, 14, 12, '-'], [30, 9, 34, 9, '-'], [50, 12, 55, 12, '-'], [60, 13, 63, 14, '#'], [79, 0, 79, 14, '#']],
    entities: [sign(2, 14, 'sign.forest.deep'), mon('poring', 40, 14), mon('poring', 70, 14)] },
];
