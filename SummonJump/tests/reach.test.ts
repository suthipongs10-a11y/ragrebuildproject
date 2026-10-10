import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Cell, TILE, checkExit, createHero, exitsOf, isSolidCell, parseLdtk, stepHero, type HeroState, type LdtkProject, type LevelData } from '@shared/platformer';

/**
 * Level-design guard: with the real hero physics (slowest Lv 1 walk speed, double jump), every exit of every
 * land room can be reached from every other exit. Explores standing spots by simulating walks and jumps.
 */
const root = join(import.meta.dirname, '..');
const levels = parseLdtk(JSON.parse(readFileSync(join(root, 'levels', 'world.ldtk'), 'utf8')) as LdtkProject);
type Dir = 'left' | 'right' | 'up' | 'down';

const standable = (l: LevelData, x: number, y: number) => {
  const g = l.grid, below = g.get(x, y + 1);
  return (isSolidCell(below) || below === Cell.OneWay) && !isSolidCell(g.get(x, y)) && !isSolidCell(g.get(x, y - 1));
};
const key = (s: HeroState) => `${Math.floor((s.x + s.w / 2) / TILE)},${Math.floor((s.y + s.h - 1) / TILE)}`;

function explore(l: LevelData, start: [number, number]): { spots: Set<string>; exits: Set<string> } {
  const env = { grid: l.grid, water: l.water, abilities: { double: true, dive: true }, moveSpeed: 112, exits: exitsOf(l) };
  const spots = new Set<string>(), exits = new Set<string>(), queue: [number, number][] = [start];
  spots.add(start.join(','));
  // walk / jump with different hold times / double jump early or at the apex — in both directions
  const plans: { dir: -1 | 0 | 1; hold: number; dbl: number }[] = [];
  for (const dir of [-1, 1, 0] as const) for (const hold of [0, 0.08, 0.2, 1]) for (const dbl of [-1, 0.25, 0.45]) if (!(hold === 0 && dbl >= 0)) plans.push({ dir, hold, dbl });
  while (queue.length) {
    const [tx, ty] = queue.shift() as [number, number];
    for (const p of plans) {
      const s = createHero(tx * TILE + (TILE - 24) / 2, (ty + 1) * TILE - 56);
      s.onGround = true;
      let left = false;
      for (let i = 0, t = 0; i < 100; i++, t += 1 / 30) {
        const press = (i === 0 && p.hold > 0) || (p.dbl >= 0 && Math.abs(t - p.dbl) < 1 / 60);
        stepHero(s, { dir: p.dir, jumpPressed: press, jumpHeld: t < p.hold || (p.dbl >= 0 && t >= p.dbl && t < p.dbl + 0.4), down: false }, env, 1 / 30);
        const ex = checkExit(s, env);
        if (ex === 'fall') break;
        if (ex) { exits.add(ex); break; }
        if (!s.onGround) left = true;
        // landed somewhere (or walked half a second along the floor)
        if (s.onGround && (left || t > 0.5)) {
          const k = key(s), [kx, ky] = k.split(',').map(Number) as [number, number];
          if (!spots.has(k) && standable(l, kx, ky)) { spots.add(k); queue.push([kx, ky]); }
          break;
        }
      }
    }
  }
  return { spots, exits };
}

/** Standing spot next to an exit (where the hero arrives from the neighbour room). */
function entry(l: LevelData, d: Dir): [number, number] | null {
  const xs = d === 'left' ? [0, 1, 2] : d === 'right' ? [l.grid.w - 1, l.grid.w - 2, l.grid.w - 3] : [...Array(l.grid.w).keys()];
  const ys = [...Array(l.grid.h).keys()];
  if (d === 'down') ys.reverse();
  for (const x of xs) for (const y of d === 'up' ? ys : [...ys].reverse()) if (standable(l, x, y)) return [x, y];
  return null;
}

describe('reachability (real physics, Lv 1 speed + double jump)', () => {
  for (const l of [...levels.values()].filter((x) => !x.water && !x.test)) {
    const dirs = (Object.keys(l.exitTo) as Dir[]).filter((d) => l.exitTo[d]);
    // town: east exit is behind the rock wall (tested in levels.test.ts); up = double jump gate (tested there too)
    const need = dirs.filter((d) => !(l.id === 'town' && d === 'right'));
    it(`${l.id}: every exit reachable from every entrance (${need.join(', ')})`, () => {
      for (const from of need.filter((d) => d !== 'up')) {
        const st = entry(l, from === 'down' ? 'down' : from);
        expect(st, `${l.id}: no standing spot near the ${from} exit`).not.toBeNull();
        const r = explore(l, st as [number, number]);
        for (const to of need) if (to !== from) expect(r.exits.has(to), `${l.id}: ${from} → ${to}`).toBe(true);
      }
    }, 60_000);
  }
});

describe('reachability guard catches broken rooms', () => {
  it('a wall too tall to jump makes the far exit unreachable', () => {
    const f = levels.get('forest2') as LevelData;
    const g = f.grid.clone();
    for (let y = 0; y < 15; y++) g.set(20, y, Cell.Solid);
    const r = explore({ ...f, grid: g }, entry(f, 'right') as [number, number]);
    expect(r.exits.has('left')).toBe(false);
    expect(explore(f, entry(f, 'right') as [number, number]).exits.has('left')).toBe(true);
  });
  it('a platform 6 tiles up is reachable only with the double jump', () => {
    const f = levels.get('deep2') as LevelData;
    const g = f.grid.clone();
    for (let x = 12; x < 17; x++) g.set(x, 8, Cell.OneWay); // floor stands at row 14 → 6 rows up
    const r = explore({ ...f, grid: g }, entry(f, 'right') as [number, number]);
    expect(r.spots.has('14,7')).toBe(true);
  });
});
