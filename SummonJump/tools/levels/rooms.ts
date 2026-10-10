/**
 * World rooms in a compact source form (Phase 1 prototype rooms + Phase 5 zones 1–3).
 * Tile coordinates are prototype tiles (16 px); build-levels.ts writes them to LDtk at 32 px tiles (same grid, 2x art scale).
 * Chars: # solid · - one-way · = solid platform · P pipe body · T pipe top · X breakable rock · U pipe exit tube · c cloud floor
 */
export interface EntitySrc { type: string; x: number; y: number; w?: number; h?: number; fields?: Record<string, string | number | boolean> }
export interface RoomSrc {
  id: string; zone: string; name: string; w?: number; h?: number; water?: boolean;
  /** background variation b/c/d (P05 zone packs); default = the original layers */
  variant?: string;
  exits?: Partial<Record<'left' | 'right' | 'up' | 'down', string>>;
  safe?: [number, number]; floorRow?: number;
  fill: [number, number, number, number, string][];
  entities: EntitySrc[];
  test?: boolean;
}

const sign = (x: number, y: number, key: string): EntitySrc => ({ type: 'Sign', x, y, fields: { text: key } });
const mon = (monster: string, x: number, y: number): EntitySrc => ({ type: 'Monster', x, y, fields: { monster } });
const item = (x: number, y: number): EntitySrc => ({ type: 'Item', x, y, fields: { item: 'stone' } });
/** Only visible with a 'reveal' spirit (Pixie / Sage Owl) in the team. */
const hidden = (x: number, y: number, it: string): EntitySrc => ({ type: 'Item', x, y, fields: { item: it, hidden: true } });

export const ROOMS: RoomSrc[] = [
  { id: 'town', zone: 'town', name: 'zone.town', exits: { left: 'forest', right: 'desert', up: 'sky1' },
    fill: [[0, 15, 29, 16, '#'], [3, 12, 7, 12, '-'], [8, 9, 12, 9, '-'], [3, 6, 7, 6, '-'], [19, 12, 20, 12, 'T'], [19, 13, 20, 14, 'P'], [28, 0, 29, 14, 'X']],
    entities: [
      { type: 'SavePoint', x: 1, y: 14 }, { type: 'Anvil', x: 10, y: 14 }, { type: 'ExitHint', x: 18, y: 3, fields: { dir: 'up', note: 'hint.sky' } }, { type: 'Altar', x: 14, y: 14 },
      sign(5, 14, 'sign.town.sky'), sign(17, 14, 'sign.town.pipe'), sign(25, 14, 'sign.town.rock'),
      { type: 'Pipe', x: 19.5, y: 12, w: 2, h: 1, fields: { dir: 'down', target: 'abyss1', tx: 20, ty: 2 } },
      { type: 'Gate', x: 5, y: 14, fields: { ability: 'double', text: 'gate.double' } },
      { type: 'Gate', x: 22, y: 14, fields: { ability: 'dive', text: 'gate.dive' } },
      { type: 'Npc', x: 11.5, y: 14, fields: { npc: 'smith' } }, { type: 'Npc', x: 15.5, y: 14, fields: { npc: 'priest' } },
      { type: 'Npc', x: 23, y: 14, fields: { npc: 'merchant' } }, { type: 'Npc', x: 3, y: 14, fields: { npc: 'guide' } },
      { type: 'Npc', x: 7.5, y: 14, fields: { npc: 'portal' } },
    ] },
  // ───────── Zone 1: Forest (Lv 1–14) — town ← forest ← forest2 ← forest3 ← deep (King) ← forest4 ← deep2 (Spore Mother)
  { id: 'forest', zone: 'forest', name: 'zone.forest', exits: { left: 'forest2', right: 'town' },
    fill: [[0, 15, 29, 16, '#'], [4, 12, 7, 12, '-'], [10, 9, 14, 9, '-'], [22, 12, 25, 12, '-'], [17, 13, 18, 14, '#']],
    entities: [sign(2, 14, 'sign.forest.deep'), mon('poring', 8, 14), mon('rocker', 21, 14), mon('poring', 26, 14), mon('drops', 13, 14), mon('poring', 12, 8), item(24, 11), hidden(5, 11, 'scroll_mystic')] },
  { id: 'forest2', zone: 'forest', name: 'zone.forest2', variant: 'b', w: 48, exits: { left: 'forest3', right: 'forest' },
    fill: [[0, 15, 47, 16, '#'], [5, 12, 9, 12, '-'], [12, 9, 16, 9, '-'], [20, 12, 24, 12, '-'], [28, 12, 31, 14, '#'], [34, 9, 38, 9, '-'], [41, 12, 44, 12, '-']],
    entities: [mon('drops', 8, 14), mon('rocker', 14, 8), mon('mushroom', 18, 14), mon('drops', 25, 14), mon('mushroom', 34, 14), mon('poporing', 36, 8), mon('poporing', 43, 14), item(14, 8)] },
  { id: 'forest3', zone: 'forest', name: 'zone.forest3', variant: 'c', w: 48, exits: { left: 'deep', right: 'forest2' },
    fill: [[0, 15, 47, 16, '#'], [4, 12, 8, 12, '-'], [9, 9, 13, 9, '-'], [16, 6, 20, 6, '-'], [22, 12, 26, 12, '-'], [30, 13, 33, 14, '#'], [36, 10, 40, 10, '-'], [43, 12, 46, 12, '-']],
    entities: [mon('poporing', 6, 14), mon('wisp', 11, 6), mon('mantis', 16, 14), mon('mushroom', 24, 11), mon('wisp', 30, 8), mon('mantis', 38, 14), mon('poporing', 44, 11), hidden(18, 5, 'ess_magic')] },
  { id: 'deep', zone: 'deep', name: 'zone.deep', exits: { left: 'forest4', right: 'forest3' },
    fill: [[0, 15, 29, 16, '#'], [6, 11, 10, 11, '-'], [19, 11, 23, 11, '-']],
    entities: [mon('king', 14, 14), mon('poring', 24, 14), mon('mantis', 8, 14)] },
  { id: 'forest4', zone: 'forest', name: 'zone.forest4', variant: 'd', w: 48, exits: { left: 'deep2', right: 'deep' },
    fill: [[0, 15, 47, 16, '#'], [3, 12, 7, 12, '-'], [10, 9, 14, 9, '-'], [17, 12, 21, 14, '#'], [24, 9, 28, 9, '-'], [31, 12, 35, 12, '-'], [38, 13, 40, 14, '#'], [42, 10, 46, 10, '-']],
    entities: [mon('boar', 8, 14), mon('willow', 12, 8), mon('wisp', 22, 7), mon('boar', 28, 14), mon('mantis', 33, 14), mon('willow', 44, 9), mon('boar', 44, 14)] },
  { id: 'deep2', zone: 'deep', name: 'zone.deep2', variant: 'c', exits: { right: 'forest4' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 1, 14, '#'], [5, 11, 9, 11, '-'], [20, 11, 24, 11, '-']],
    entities: [mon('spore_mother', 14, 14), mon('mushroom', 6, 14), mon('mushroom', 24, 14)] },
  // ───────── Zone 2: Sky Isles (Lv 10–20) — town ↑ sky1 → sky2 → sky3 (Harpy) → sky4 → sky5 (Thunder Ram) → sky6 (Storm Roc MVP)
  // Sky rooms stand on solid cloud ground across the whole width (owner: no gaps to fall through); back to town by the cloud pipe
  { id: 'sky1', zone: 'sky', name: 'zone.sky', exits: { right: 'sky2' }, safe: [6, 13],
    fill: [[0, 14, 29, 16, 'c'], [2, 12, 3, 13, 'T'], [15, 11, 19, 11, '-'], [21, 8, 25, 8, '-'], [26, 7, 29, 7, '-']],
    entities: [
      { type: 'Pipe', x: 2.5, y: 12, w: 2, h: 1, fields: { dir: 'down', target: 'town', tx: 9, ty: 13 } },
      mon('bird', 10, 9), mon('bird', 22, 4), mon('sky_poring', 9, 13), mon('sky_poring', 26, 13), item(17, 10), hidden(27, 6, 'scroll_ld')] },
  { id: 'sky2', zone: 'sky', name: 'zone.sky2', variant: 'b', w: 48, exits: { left: 'sky1', right: 'sky3' }, safe: [2, 12],
    fill: [[0, 13, 47, 16, 'c'], [6, 10, 9, 10, '-'], [17, 9, 21, 9, '-'], [29, 9, 33, 9, '-'], [40, 10, 44, 10, '-']],
    entities: [mon('cloud_imp', 12, 8), mon('sky_snail', 18, 12), mon('sky_poring', 30, 12), mon('cloud_imp', 34, 6), mon('sky_snail', 42, 12), mon('bird', 24, 7)] },
  { id: 'sky3', zone: 'sky', name: 'zone.sky3', exits: { left: 'sky2', right: 'sky4' }, safe: [2, 12],
    fill: [[0, 13, 29, 16, 'c'], [4, 9, 8, 9, '-'], [21, 9, 25, 9, '-']],
    entities: [mon('harpy', 15, 5)] },
  { id: 'sky4', zone: 'sky', name: 'zone.sky4', variant: 'c', w: 48, exits: { left: 'sky3', right: 'sky5' }, safe: [2, 12],
    fill: [[0, 13, 47, 16, 'c'], [12, 12, 18, 12, '-'], [30, 10, 34, 10, '-'], [4, 9, 7, 9, '-'], [24, 9, 27, 9, '-'], [41, 9, 45, 9, '-']],
    entities: [mon('fire_hawk', 10, 7), mon('thunder_puff', 24, 12), mon('fire_hawk', 31, 6), mon('thunder_puff', 40, 12), mon('sky_poring', 44, 12), mon('cloud_imp', 20, 6)] },
  { id: 'sky5', zone: 'sky', name: 'zone.sky5', variant: 'b', w: 48, exits: { left: 'sky4', right: 'sky6' }, safe: [2, 12],
    fill: [[0, 13, 47, 16, 'c'], [5, 10, 9, 10, '-'], [20, 9, 24, 9, '-'], [29, 9, 33, 9, '-'], [42, 10, 45, 10, '-']],
    entities: [mon('griffin', 8, 7), mon('thunder_ram', 26, 12), mon('thunder_puff', 34, 12), mon('griffin', 43, 7), mon('fire_hawk', 38, 6)] },
  { id: 'sky6', zone: 'sky', name: 'zone.sky6', variant: 'd', w: 36, exits: { left: 'sky5' }, safe: [2, 12],
    fill: [[0, 13, 35, 16, 'c'], [5, 9, 9, 9, '-'], [26, 9, 30, 9, '-'], [35, 0, 35, 12, '#']],
    entities: [mon('storm_roc', 20, 5)] },
  // ───────── Zone 3: Abyss (Lv 15–26) — town pipe ↓ abyss1 → abyss2 → abyss3 (Siren) → abyss4 → abyss5 (Shark) → abyss6 (Kraken MVP)
  { id: 'abyss1', zone: 'abyss', name: 'zone.abyss', water: true, exits: { right: 'abyss2' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 1, 14, '#'], [0, 0, 29, 0, '#'], [19, 0, 20, 1, 'U'], [6, 11, 9, 14, '#'], [13, 8, 16, 8, '='], [24, 12, 26, 14, '#']],
    entities: [
      { type: 'Pipe', x: 19.5, y: 1, w: 2, h: 2, fields: { dir: 'up', target: 'town', tx: 20, ty: 12 } },
      sign(3, 14, 'sign.abyss.pipe'),
      { type: 'ExitHint', x: 27, y: 9, fields: { dir: 'right', note: 'hint.abyss2' } },
      mon('fish', 11, 5), mon('marin', 22, 14), mon('fish', 4, 9), mon('marin', 18, 14), item(14, 7)] },
  { id: 'abyss2', zone: 'abyss', name: 'zone.abyss2', variant: 'b', water: true, w: 48, exits: { left: 'abyss1', right: 'abyss3' },
    fill: [[0, 15, 47, 16, '#'], [0, 0, 47, 0, '#'], [8, 11, 10, 14, '#'], [16, 7, 20, 7, '='], [26, 12, 29, 14, '#'], [34, 5, 37, 5, '='], [40, 10, 42, 14, '#']],
    entities: [mon('jellyfish', 13, 6), mon('crab', 20, 14), mon('marin', 32, 14), mon('jellyfish', 30, 5), mon('crab', 44, 14), mon('fish', 38, 8), hidden(35, 4, 'scroll_element')] },
  { id: 'abyss3', zone: 'abyss', name: 'zone.abyss3', variant: 'c', water: true, exits: { left: 'abyss2', right: 'abyss4' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 29, 0, '#'], [4, 10, 8, 10, '='], [21, 10, 25, 10, '=']],
    entities: [mon('siren', 15, 7)] },
  { id: 'abyss4', zone: 'abyss', name: 'zone.abyss4', variant: 'c', water: true, w: 48, exits: { left: 'abyss3', right: 'abyss5' },
    fill: [[0, 15, 47, 16, '#'], [0, 0, 47, 0, '#'], [6, 1, 7, 6, '#'], [12, 10, 15, 14, '#'], [20, 6, 24, 6, '='], [30, 1, 31, 7, '#'], [34, 11, 37, 14, '#'], [42, 7, 45, 7, '=']],
    entities: [mon('eel', 10, 6), mon('urchin', 13, 9), mon('gold_fish', 22, 10), mon('eel', 28, 9), mon('urchin', 35, 10), mon('crab', 40, 14), mon('gold_fish', 44, 4)] },
  { id: 'abyss5', zone: 'abyss', name: 'zone.abyss5', variant: 'b', water: true, w: 48, exits: { left: 'abyss4', right: 'abyss6' },
    fill: [[0, 15, 47, 16, '#'], [0, 0, 47, 0, '#'], [8, 8, 11, 8, '='], [16, 12, 18, 14, '#'], [38, 8, 41, 8, '='], [44, 11, 46, 14, '#']],
    entities: [mon('angler', 9, 11), mon('eel', 14, 5), mon('shark', 27, 8), mon('angler', 36, 12), mon('urchin', 45, 10)] },
  { id: 'abyss6', zone: 'abyss', name: 'zone.abyss6', variant: 'd', water: true, exits: { left: 'abyss5' },
    fill: [[0, 15, 29, 16, '#'], [0, 0, 29, 0, '#'], [28, 0, 29, 14, '#'], [4, 10, 8, 10, '='], [12, 7, 15, 7, '=']],
    entities: [mon('kraken', 21, 8)] },
  { id: 'desert', zone: 'desert', name: 'zone.desert', exits: { left: 'town' },
    fill: [[0, 15, 29, 16, '#'], [28, 0, 29, 14, '#'], [8, 14, 11, 14, '#'], [9, 13, 10, 13, '#'], [16, 11, 20, 11, '-']],
    entities: [sign(3, 14, 'sign.desert.pyramid'), { type: 'Chest', x: 24, y: 14 }, mon('scorpion', 14, 14), mon('scorpion', 21, 14), item(18, 10)] },
  // arena for the daily dungeon and the tower (reached from the portal NPC in town, no exits)
  { id: 'arena', zone: 'town', name: 'zone.arena', exits: {},
    fill: [[0, 15, 29, 16, '#'], [4, 12, 8, 12, '-'], [21, 12, 25, 12, '-'], [12, 9, 17, 9, '-']],
    entities: [] },
  // wide test room (not linked): exercises the scrolling camera
  { id: 'test_wide', zone: 'forest', name: 'zone.forest', w: 80, test: true, exits: {},
    fill: [[0, 15, 79, 16, '#'], [10, 12, 14, 12, '-'], [30, 9, 34, 9, '-'], [50, 12, 55, 12, '-'], [60, 13, 63, 14, '#'], [79, 0, 79, 14, '#']],
    entities: [sign(2, 14, 'sign.forest.deep'), mon('poring', 40, 14), mon('poring', 70, 14)] },
];

/** Soul stones in each crystal pickup (map items with item 'stone'), by zone. */
const STONES: Record<string, number> = { town: 20, forest: 30, deep: 50, sky: 80, abyss: 120, desert: 60 };
for (const r of ROOMS) for (const e of r.entities) if (e.type === 'Item' && e.fields?.item === 'stone') e.fields.amount ??= STONES[r.zone] ?? 30;
