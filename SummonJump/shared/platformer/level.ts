import { TILE, TileGrid } from './grid';
import type { Exits } from './motion';

/** Runtime level data parsed from an LDtk project (only the subset the game uses). */
export interface EntityData {
  id: string; type: string;
  /** bottom-center in room pixels */
  x: number; y: number; w: number; h: number;
  fields: Record<string, string | number | boolean | null>;
}
export interface LevelData {
  id: string; zone: string; name: string; water: boolean; test: boolean;
  /** background variation (b/c/d) from the P05 zone packs, null = original layers */
  variant: string | null;
  grid: TileGrid;
  exitTo: Partial<Record<'left' | 'right' | 'up' | 'down', string>>;
  safe: { x: number; y: number } | null;
  /** row of the walkable ground surface (parallax ground strip is aligned to it) */
  floorRow: number | null;
  entities: EntityData[];
}

interface LdtkField { __identifier: string; __value: unknown }
interface LdtkEntity { __identifier: string; iid: string; px: [number, number]; width: number; height: number; fieldInstances: LdtkField[] }
interface LdtkLayer { __identifier: string; __type: string; __cWid: number; __cHei: number; __gridSize: number; intGridCsv: number[]; entityInstances: LdtkEntity[] }
interface LdtkLevel { identifier: string; fieldInstances: LdtkField[]; layerInstances: LdtkLayer[] | null }
export interface LdtkProject { levels: LdtkLevel[] }

const fieldMap = (fs: LdtkField[]): Record<string, unknown> => Object.fromEntries(fs.map((f) => [f.__identifier, f.__value]));
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function parseLdtk(project: LdtkProject): Map<string, LevelData> {
  const out = new Map<string, LevelData>();
  for (const lv of project.levels) {
    const layers = lv.layerInstances ?? [];
    const col = layers.find((l) => l.__identifier === 'Collision');
    const ents = layers.find((l) => l.__identifier === 'Entities');
    if (!col) throw new Error(`level ${lv.identifier}: no Collision layer`);
    if (col.__gridSize !== TILE) throw new Error(`level ${lv.identifier}: grid size ${col.__gridSize} != ${TILE}`);
    const f = fieldMap(lv.fieldInstances);
    const grid = new TileGrid(col.__cWid, col.__cHei, col.intGridCsv);
    const exitTo: LevelData['exitTo'] = {};
    for (const [k, d] of [['exitLeft', 'left'], ['exitRight', 'right'], ['exitUp', 'up'], ['exitDown', 'down']] as const) {
      const v = str(f[k]); if (v) exitTo[d] = v;
    }
    const sx = f.safeX, sy = f.safeY;
    out.set(lv.identifier, {
      id: lv.identifier, zone: str(f.zone) ?? 'forest', variant: str(f.variant) ?? null, name: str(f.name) ?? lv.identifier, water: f.water === true, test: f.test === true, grid, exitTo,
      safe: typeof sx === 'number' && typeof sy === 'number' ? { x: sx, y: sy } : null,
      floorRow: findFloorRow(grid),
      entities: (ents?.entityInstances ?? []).map((e, i) => ({
        id: `${lv.identifier}#${i}`, type: e.__identifier, x: e.px[0], y: e.px[1], w: e.width, h: e.height,
        fields: Object.fromEntries(e.fieldInstances.map((fi) => [fi.__identifier, fi.__value as string | number | boolean | null])),
      })),
    });
  }
  return out;
}

/** Topmost row (below the room's upper third) that is mostly solid across the whole width = the ground. */
function findFloorRow(grid: TileGrid): number | null {
  for (let y = Math.floor(grid.h / 3); y < grid.h; y++) {
    let solid = 0;
    for (let x = 0; x < grid.w; x++) { const c = grid.get(x, y); if (c === 1 || c === 4) solid++; }
    if (solid >= grid.w * 0.9) return y;
  }
  return null;
}

export const exitsOf = (l: LevelData): Exits => ({ left: !!l.exitTo.left, right: !!l.exitTo.right, up: !!l.exitTo.up, down: !!l.exitTo.down });

/** Problems that would break the game (used by tests and a build-time check). Empty list = OK. */
export function validateLevels(levels: Map<string, LevelData>, knownMonsters: ReadonlySet<string>): string[] {
  const errs: string[] = [];
  for (const l of levels.values()) {
    const at = `level ${l.id}`;
    if (l.entities.filter((e) => e.type === 'Monster').some((e) => !knownMonsters.has(String(e.fields.monster)))) errs.push(`${at}: unknown monster`);
    for (const [dir, to] of Object.entries(l.exitTo)) {
      const t = levels.get(to as string);
      if (!t) { errs.push(`${at}: exit ${dir} -> missing level ${to}`); continue; }
      const back = ({ left: 'right', right: 'left', up: 'down', down: 'up' } as const)[dir as 'left'];
      if (t.exitTo[back] !== l.id) errs.push(`${at}: exit ${dir} -> ${to} has no matching return exit`);
      if (t.grid.h !== l.grid.h && (dir === 'left' || dir === 'right')) errs.push(`${at}: height differs from ${to} (side exits need equal height)`);
    }
    for (const e of l.entities) {
      if (e.type === 'Pipe') {
        const t = levels.get(String(e.fields.target));
        if (!t) errs.push(`${at}: pipe -> missing level ${e.fields.target}`);
        else if (!t.entities.some((o) => o.type === 'Pipe' && o.fields.target === l.id)) errs.push(`${at}: pipe -> ${t.id} has no return pipe`);
      }
      if (e.x < 0 || e.y < 0 || e.x > l.grid.pxW || e.y > l.grid.pxH + TILE) errs.push(`${at}: entity ${e.type} outside the room`);
    }
    if (!l.test && !Object.keys(l.exitTo).length && !l.entities.some((e) => e.type === 'Pipe')) errs.push(`${at}: unreachable (no exits)`);
  }
  return errs;
}
