import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Cell, TILE, checkExit, createHero, exitsOf, parseLdtk, stepHero, validateLevels, aliveSpawns, isSpawnAlive, markDefeated, pruneDefeated, type LdtkProject, type LevelData, type MotionInput } from '@shared/platformer';

const root = join(import.meta.dirname, '..');
const levels = parseLdtk(JSON.parse(readFileSync(join(root, 'levels', 'world.ldtk'), 'utf8')) as LdtkProject);
const monsters = new Set(readFileSync(join(root, 'content', 'monsters.csv'), 'utf8').split('\n').slice(1).map((l) => l.split(',')[0] as string).filter(Boolean));

describe('LDtk world', () => {
  it('has the 8 prototype maps plus the wide test room', () => {
    expect([...levels.keys()].sort()).toEqual(['abyss1', 'abyss2', 'deep', 'desert', 'forest', 'sky1', 'sky2', 'test_wide', 'town']);
    expect(levels.get('test_wide')?.grid.w).toBe(80);
  });
  it('passes level validation (exits, pipes, monsters)', () => {
    expect(validateLevels(levels, monsters)).toEqual([]);
  });
  it('keeps the prototype layout: town rock wall, pipe, water rooms', () => {
    const town = levels.get('town') as LevelData;
    expect(town.grid.get(28, 4)).toBe(Cell.Rock);
    expect(town.grid.get(19, 12)).toBe(Cell.PipeTop);
    expect(town.grid.get(3, 12)).toBe(Cell.OneWay);
    expect(town.entities.filter((e) => e.type === 'Npc').length).toBe(4);
    expect(levels.get('abyss1')?.water).toBe(true);
    expect(levels.get('forest')?.water).toBe(false);
  });
  it('validation catches a broken exit', () => {
    const copy = new Map(levels); const f = { ...(levels.get('forest') as LevelData), exitTo: { left: 'nowhere' } };
    copy.set('forest', f);
    expect(validateLevels(copy, monsters).join('\n')).toContain('missing level nowhere');
  });
});

/** Walk a room along its floor, jumping whenever blocked or at a gap; fails if the hero snags. */
function walk(l: LevelData, dir: 1 | -1, abilities = { double: false, dive: false }): { reachedEdge: boolean; t: number } {
  const env = { grid: l.grid, water: l.water, abilities, moveSpeed: 120, exits: exitsOf(l) };
  const startX = dir > 0 ? 40 : l.grid.pxW - 70;
  let y = 0; for (let ty = 0; ty < l.grid.h; ty++) if (l.grid.get(Math.floor(startX / TILE), ty) === Cell.Solid) { y = ty * TILE - 56; break; }
  const s = createHero(startX, y);
  let jumpHeld = false;
  for (let i = 0; i < 60 * 60; i++) {
    const wantJump = s.onGround && (s.vx * dir < 20 && i % 30 === 0);
    const inp: MotionInput = { dir, jumpPressed: wantJump && !jumpHeld, jumpHeld: wantJump || (!s.onGround && s.vy < 0), down: false };
    jumpHeld = wantJump;
    stepHero(s, inp, env, 1 / 60);
    const ex = checkExit(s, env);
    if ((dir > 0 && ex === 'right') || (dir < 0 && ex === 'left')) return { reachedEdge: true, t: i / 60 };
    if (!l.exitTo.right && dir > 0 && s.x + s.w >= l.grid.pxW - 1) return { reachedEdge: true, t: i / 60 };
    if (!l.exitTo.left && dir < 0 && s.x <= 1) return { reachedEdge: true, t: i / 60 };
  }
  // stopped by a full-height wall (deep west, desert east, wide-room east) counts as "crossed the room"
  const col = Math.floor((dir > 0 ? s.x + s.w + 2 : s.x - 2) / TILE);
  let tall = true; for (let ty = 0; ty <= Math.floor((s.y + s.h - 1) / TILE); ty++) if (l.grid.get(col, ty) !== Cell.Solid) { tall = false; break; }
  return { reachedEdge: tall, t: 60 };
}

describe('walk-through (no collision snags)', () => {
  for (const id of ['forest', 'deep', 'desert', 'sky2', 'test_wide']) {
    it(`${id}: can cross left→right and back`, () => {
      const l = levels.get(id) as LevelData;
      // rooms with solid end-walls are crossed up to the wall: the walker only needs to reach the edge or exit
      expect(walk(l, 1).reachedEdge).toBe(true);
      expect(walk(l, -1).reachedEdge).toBe(true);
    });
  }
  it('town: rock wall blocks the east exit until smashed', () => {
    const l = levels.get('town') as LevelData;
    expect(walk(l, 1).reachedEdge).toBe(false);
    const broken = { ...l, grid: l.grid.clone() };
    for (let y = 0; y < broken.grid.h; y++) for (let x = 0; x < broken.grid.w; x++) if (broken.grid.get(x, y) === Cell.Rock) broken.grid.set(x, y, 0);
    expect(walk(broken, 1).reachedEdge).toBe(true);
  });
});

describe('respawn', () => {
  it('normal monsters always respawn; mini/mvp wait for their timer', () => {
    const d = {}; const now = 1_000_000;
    markDefeated(d, 'a', 'normal', 0, now); markDefeated(d, 'b', 'mini', 1200, now); markDefeated(d, 'c', 'mvp', 7200, now);
    const spawns = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(aliveSpawns(spawns, d, now + 1000).map((s) => s.id)).toEqual(['a']);
    expect(aliveSpawns(spawns, d, now + 1200_000).map((s) => s.id)).toEqual(['a', 'b']);
    expect(isSpawnAlive(d, 'c', now + 7200_000)).toBe(true);
    pruneDefeated(d, now + 1200_000);
    expect(Object.keys(d)).toEqual(['c']);
  });
});

describe('ability gates', () => {
  const tryUp = (double: boolean) => {
    const l = levels.get('town') as LevelData;
    const env = { grid: l.grid, water: false, abilities: { double, dive: false }, moveSpeed: 120, exits: exitsOf(l) };
    const s = createHero(5 * TILE, 6 * TILE - 56); // on the top wooden platform
    for (let i = 0; i < 20; i++) stepHero(s, { dir: 0, jumpPressed: false, jumpHeld: false, down: false }, env, 1 / 60);
    let exit: string | null = null;
    for (let i = 0; i < 120 && !exit; i++) {
      const press = i === 0 || (i === 24 && double);
      stepHero(s, { dir: 0, jumpPressed: press, jumpHeld: i < 40, down: false }, env, 1 / 60);
      exit = checkExit(s, env);
    }
    return exit;
  };
  it('town → sky1 needs the double jump', () => {
    expect(tryUp(false)).toBe(null);
    expect(tryUp(true)).toBe('up');
  });
  it('abyss without dive drowns, with dive does not (swim ability gate)', () => {
    const l = levels.get('abyss1') as LevelData;
    const run = (dive: boolean) => {
      const env = { grid: l.grid, water: true, abilities: { double: false, dive }, moveSpeed: 120, exits: exitsOf(l) };
      const s = createHero(3 * TILE, 5 * TILE); const ev: string[] = [];
      for (let i = 0; i < 60 * 9; i++) ev.push(...stepHero(s, { dir: 0, jumpPressed: false, jumpHeld: false, down: false }, env, 1 / 60));
      return ev.includes('drown');
    };
    expect(run(false)).toBe(true); expect(run(true)).toBe(false);
  });
});
