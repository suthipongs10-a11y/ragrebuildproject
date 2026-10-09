/**
 * Writes levels/world.ldtk (LDtk project JSON) from tools/levels/rooms.ts and copies it to public/levels/.
 * Usage: npm run levels
 * The file follows the LDtk 1.5 JSON layout (IntGrid "Collision" + "Entities" layers + level fields).
 * Note: the generator is the source of truth until maps are hand-edited in the LDtk editor; then delete the generator.
 */
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOMS, type RoomSrc } from './rooms';

const ROOT = join(import.meta.dirname, '..', '..');
const GRID = 32;
const CELL: Record<string, number> = { '#': 1, '=': 1, P: 1, U: 1, c: 1, '-': 2, X: 3, T: 4 };

let uid = 100;
const nextUid = () => uid++;
const iid = (n: string) => `${n}-${(uid++).toString(16).padStart(8, '0')}`;

const ENTITY_DEFS = ['Sign', 'Monster', 'Item', 'SavePoint', 'Anvil', 'Altar', 'Chest', 'Pipe', 'Gate', 'Npc'].map((identifier) => ({ identifier, uid: nextUid(), width: GRID, height: GRID, color: '#E8B04A', pivotX: 0.5, pivotY: 1 }));
const defUid = (id: string) => ENTITY_DEFS.find((d) => d.identifier === id)?.uid ?? 0;
const COLLISION_UID = nextUid(), ENTITIES_UID = nextUid();
const LEVEL_FIELDS = ['zone', 'name', 'exitLeft', 'exitRight', 'exitUp', 'exitDown'].map((identifier) => ({ identifier, __type: 'String', uid: nextUid() }))
  .concat(['water', 'test'].map((identifier) => ({ identifier, __type: 'Bool', uid: nextUid() })))
  .concat(['safeX', 'safeY'].map((identifier) => ({ identifier, __type: 'Int', uid: nextUid() })));

const field = (identifier: string, type: string, value: unknown) => ({ __identifier: identifier, __type: type, __value: value, __tile: null, defUid: LEVEL_FIELDS.find((f) => f.identifier === identifier)?.uid ?? 0, realEditorValues: [] });

function level(r: RoomSrc, i: number) {
  const w = r.w ?? 30, h = r.h ?? 17;
  const csv = new Array<number>(w * h).fill(0);
  for (const [x1, y1, x2, y2, c] of r.fill) {
    const v = CELL[c];
    if (v === undefined) throw new Error(`room ${r.id}: unknown tile char ${c}`);
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) csv[y * w + x] = v;
  }
  const entities = r.entities.map((e) => {
    const ew = (e.w ?? 1) * GRID, eh = (e.h ?? 1) * GRID;
    const px = [Math.round(e.x * GRID + GRID / 2), Math.round((e.y + 1) * GRID)];
    return {
      __identifier: e.type, __grid: [Math.floor(e.x), Math.floor(e.y)], __pivot: [0.5, 1], __tags: [], __worldX: px[0], __worldY: px[1],
      iid: iid('ent'), width: ew, height: eh, defUid: defUid(e.type), px,
      fieldInstances: Object.entries(e.fields ?? {}).map(([k, v]) => ({ __identifier: k, __type: typeof v === 'number' ? 'Int' : typeof v === 'boolean' ? 'Bool' : 'String', __value: v, defUid: 0, realEditorValues: [] })),
    };
  });
  const ex = r.exits ?? {};
  return {
    identifier: r.id, iid: iid('lvl'), uid: nextUid(), worldX: (i % 4) * 3000, worldY: Math.floor(i / 4) * 1000, worldDepth: 0, pxWid: w * GRID, pxHei: h * GRID,
    __bgColor: '#696A79', bgRelPath: null, externalRelPath: null, fieldInstances: [
      field('zone', 'String', r.zone), field('name', 'String', r.name), field('water', 'Bool', !!r.water), field('test', 'Bool', !!r.test),
      field('exitLeft', 'String', ex.left ?? null), field('exitRight', 'String', ex.right ?? null), field('exitUp', 'String', ex.up ?? null), field('exitDown', 'String', ex.down ?? null),
      field('safeX', 'Int', r.safe?.[0] ?? null), field('safeY', 'Int', r.safe?.[1] ?? null),
    ],
    layerInstances: [
      { __identifier: 'Entities', __type: 'Entities', __cWid: w, __cHei: h, __gridSize: GRID, __opacity: 1, __pxTotalOffsetX: 0, __pxTotalOffsetY: 0, __tilesetDefUid: null, __tilesetRelPath: null, iid: iid('lay'), levelId: 0, layerDefUid: ENTITIES_UID, pxOffsetX: 0, pxOffsetY: 0, visible: true, optionalRules: [], intGridCsv: [], autoLayerTiles: [], seed: 1, overrideTilesetUid: null, gridTiles: [], entityInstances: entities },
      { __identifier: 'Collision', __type: 'IntGrid', __cWid: w, __cHei: h, __gridSize: GRID, __opacity: 1, __pxTotalOffsetX: 0, __pxTotalOffsetY: 0, __tilesetDefUid: null, __tilesetRelPath: null, iid: iid('lay'), levelId: 0, layerDefUid: COLLISION_UID, pxOffsetX: 0, pxOffsetY: 0, visible: true, optionalRules: [], intGridCsv: csv, autoLayerTiles: [], seed: 1, overrideTilesetUid: null, gridTiles: [], entityInstances: [] },
    ],
    __neighbours: [],
  };
}

const levels = ROOMS.map(level);
const project = {
  __header__: { fileType: 'LDtk Project JSON', app: 'LDtk', doc: 'https://ldtk.io/json', schema: 'https://ldtk.io/files/JSON_SCHEMA.json', appAuthor: "Sebastien 'deepnight' Benard", appVersion: '1.5.3', url: 'https://ldtk.io' },
  iid: 'summon-jump-world-00000001', jsonVersion: '1.5.3', appBuildId: 0, nextUid: uid + 1000, identifierStyle: 'Capitalize', toc: [], worldLayout: 'Free', worldGridWidth: 256, worldGridHeight: 256,
  defaultLevelWidth: 960, defaultLevelHeight: 544, defaultPivotX: 0.5, defaultPivotY: 1, defaultGridSize: GRID, defaultEntityWidth: GRID, defaultEntityHeight: GRID, bgColor: '#40465B', defaultLevelBgColor: '#696A79',
  minifyJson: false, externalLevels: false, exportTiled: false, simplifiedExport: false, imageExportMode: 'None', exportLevelBg: false, pngFilePattern: null, backupOnSave: false, backupLimit: 10, levelNamePattern: '%world_%depth_%name', tutorialDesc: null, customCommands: [], flags: [], dummyWorldIid: 'summon-jump-dummy-world',
  defs: {
    layers: [
      { __type: 'Entities', identifier: 'Entities', type: 'Entities', uid: ENTITIES_UID, gridSize: GRID, displayOpacity: 1, intGridValues: [], intGridValuesGroups: [], autoRuleGroups: [], autoSourceLayerDefUid: null, tilesetDefUid: null, tilePivotX: 0, tilePivotY: 0 },
      { __type: 'IntGrid', identifier: 'Collision', type: 'IntGrid', uid: COLLISION_UID, gridSize: GRID, displayOpacity: 1, autoRuleGroups: [], autoSourceLayerDefUid: null, tilesetDefUid: null, tilePivotX: 0, tilePivotY: 0,
        intGridValues: [{ value: 1, identifier: 'Solid', color: '#7A5C3A', tile: null, groupUid: 0 }, { value: 2, identifier: 'OneWay', color: '#D9A441', tile: null, groupUid: 0 }, { value: 3, identifier: 'Rock', color: '#8A8A8A', tile: null, groupUid: 0 }, { value: 4, identifier: 'PipeTop', color: '#3FA66B', tile: null, groupUid: 0 }], intGridValuesGroups: [] },
    ],
    entities: ENTITY_DEFS, tilesets: [], enums: [], externalEnums: [], levelFields: LEVEL_FIELDS,
  },
  levels, worlds: [],
};

mkdirSync(join(ROOT, 'levels'), { recursive: true });
mkdirSync(join(ROOT, 'public', 'levels'), { recursive: true });
writeFileSync(join(ROOT, 'levels', 'world.ldtk'), JSON.stringify(project, null, 1) + '\n');
copyFileSync(join(ROOT, 'levels', 'world.ldtk'), join(ROOT, 'public', 'levels', 'world.ldtk'));
console.log(`levels: wrote ${levels.length} levels -> levels/world.ldtk`);
