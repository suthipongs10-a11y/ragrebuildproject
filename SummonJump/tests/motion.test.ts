import { describe, expect, it } from 'vitest';
import { Cell, TILE, TileGrid, checkExit, createHero, stepHero, type MotionEnv, type MotionInput } from '@shared/platformer';

const idle: MotionInput = { dir: 0, jumpPressed: false, jumpHeld: false, down: false };
const noExits = { left: false, right: false, up: false, down: false };

function room(fn?: (g: TileGrid) => void, w = 30, h = 17): TileGrid {
  const g = new TileGrid(w, h);
  for (let x = 0; x < w; x++) { g.set(x, h - 2, Cell.Solid); g.set(x, h - 1, Cell.Solid); }
  fn?.(g);
  return g;
}
const env = (grid: TileGrid, over: Partial<MotionEnv> = {}): MotionEnv => ({ grid, water: false, abilities: { double: false, dive: false }, moveSpeed: 120, exits: noExits, ...over });
const run = (s: ReturnType<typeof createHero>, inp: MotionInput, e: MotionEnv, secs: number, fps = 60) => {
  for (let i = 0; i < secs * fps; i++) stepHero(s, inp, e, 1 / fps);
};
const standOnFloor = (g: TileGrid) => createHero(100, (g.h - 2) * TILE - 56);

describe('hero motion', () => {
  it('lands and stays grounded', () => {
    const g = room(); const s = createHero(100, 100);
    run(s, idle, env(g), 2);
    expect(s.onGround).toBe(true);
    expect(s.y + s.h).toBeCloseTo((g.h - 2) * TILE, 3);
  });

  it('full jump rises about 4 tiles, short tap rises less', () => {
    const g = room(); const e = env(g);
    const a = standOnFloor(g); run(a, idle, e, 0.2);
    const floorY = a.y; let minA = a.y;
    stepHero(a, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
    for (let i = 0; i < 90; i++) { stepHero(a, { ...idle, jumpHeld: true }, e, 1 / 60); minA = Math.min(minA, a.y); }
    const b = standOnFloor(g); run(b, idle, e, 0.2); let minB = b.y;
    stepHero(b, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
    for (let i = 0; i < 90; i++) { stepHero(b, idle, e, 1 / 60); minB = Math.min(minB, b.y); }
    const hA = floorY - minA, hB = floorY - minB;
    expect(hA).toBeGreaterThan(3.6 * TILE); expect(hA).toBeLessThan(4.6 * TILE);
    expect(hB).toBeLessThan(hA * 0.6);
  });

  it('coyote time lets you jump just after leaving a ledge, not long after', () => {
    const g = room((gg) => { for (let x = 10; x < 30; x++) { gg.set(x, 15, Cell.Empty); gg.set(x, 16, Cell.Empty); } });
    // ledge: floor only for x<10 at row 15 -> hero walks off at x=10*32
    const e = env(g);
    for (const [wait, expectJump] of [[0.05, true], [0.2, false]] as const) {
      const s = createHero(10 * TILE - 30, 15 * TILE - 56); run(s, idle, e, 0.1);
      let guard = 0; while ((s.onGround || guard === 0) && guard++ < 400) stepHero(s, { ...idle, dir: 1 }, e, 1 / 60);
      run(s, idle, e, wait);
      const vy0 = s.vy;
      stepHero(s, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
      expect(s.vy < vy0 - 400).toBe(expectJump);
    }
  });

  it('jump buffer fires the jump on landing', () => {
    const g = room(); const e = env(g);
    const s = createHero(100, (g.h - 2) * TILE - 56 - 20); // 20 px above floor
    stepHero(s, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
    let jumped = false;
    for (let i = 0; i < 30; i++) { stepHero(s, { ...idle, jumpHeld: true }, e, 1 / 60); if (s.vy < -500) jumped = true; }
    expect(jumped).toBe(true);
  });

  it('double jump only with the ability', () => {
    const g = room(); const peak = (double: boolean) => {
      const s = standOnFloor(g); const e = env(g, { abilities: { double, dive: false } }); run(s, idle, e, 0.2);
      stepHero(s, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
      run(s, { ...idle, jumpHeld: true }, e, 0.35);
      stepHero(s, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
      let min = s.y; for (let i = 0; i < 90; i++) { stepHero(s, { ...idle, jumpHeld: true }, e, 1 / 60); min = Math.min(min, s.y); }
      return min;
    };
    expect(peak(true)).toBeLessThan(peak(false) - 2 * TILE);
  });

  it('one-way platform: land from above, pass through from below, drop with down+jump', () => {
    const g = room((gg) => { for (let x = 5; x < 12; x++) gg.set(x, 11, Cell.OneWay); });
    const e = env(g);
    const s = createHero(7 * TILE, (g.h - 2) * TILE - 56); run(s, idle, e, 0.2);
    stepHero(s, { ...idle, jumpPressed: true, jumpHeld: true }, e, 1 / 60);
    run(s, { ...idle, jumpHeld: true }, e, 1.2);
    expect(s.onGround).toBe(true);
    expect(s.y + s.h).toBeCloseTo(11 * TILE, 3); // landed on top (passed through from below)
    stepHero(s, { ...idle, jumpPressed: true, down: true }, e, 1 / 60);
    run(s, idle, e, 1);
    expect(s.y + s.h).toBeCloseTo((g.h - 2) * TILE, 3); // dropped to floor
  });

  it('never tunnels through a thin one-way platform or a wall at 20 fps', () => {
    const g = room((gg) => { for (let x = 0; x < 30; x++) gg.set(x, 8, Cell.OneWay); gg.set(20, 12, Cell.Solid); gg.set(20, 13, Cell.Solid); });
    const e = env(g);
    const s = createHero(100, 0); run(s, idle, e, 3, 20);
    expect(s.y + s.h).toBeCloseTo(8 * TILE, 3);
    const w = standOnFloor(g); w.x = 15 * TILE; w.y = 14 * TILE - 56 + 0; run(w, { ...idle, dir: 1 }, e, 3, 20);
    expect(w.x + w.w).toBeLessThanOrEqual(20 * TILE + 0.01);
  });

  it('breaks nothing: solid rock blocks, pipe top supports', () => {
    const g = room((gg) => { gg.set(10, 14, Cell.Rock); gg.set(10, 13, Cell.Rock); gg.set(20, 14, Cell.PipeTop); });
    const e = env(g); const s = standOnFloor(g); s.x = 8 * TILE; run(s, { ...idle, dir: 1 }, e, 2);
    expect(s.x + s.w).toBeLessThanOrEqual(10 * TILE + 0.01);
  });

  it('room edge without exit is a wall; with exit the hero can cross it', () => {
    const g = room(); const s = standOnFloor(g); s.x = 40;
    run(s, { ...idle, dir: -1 }, env(g), 2);
    expect(s.x).toBe(0);
    const s2 = standOnFloor(g); s2.x = 40; const e2 = env(g, { exits: { ...noExits, left: true } });
    let exit = null as ReturnType<typeof checkExit>;
    for (let i = 0; i < 180 && !exit; i++) { stepHero(s2, { ...idle, dir: -1 }, e2, 1 / 60); exit = checkExit(s2, e2); }
    expect(exit).toBe('left');
  });

  it('falling out the bottom: exit down or fall', () => {
    const g = new TileGrid(30, 17);
    const s = createHero(100, 100);
    let r = null as ReturnType<typeof checkExit>;
    for (let i = 0; i < 300 && !r; i++) { stepHero(s, idle, env(g), 1 / 60); r = checkExit(s, env(g)); }
    expect(r).toBe('fall');
    expect(checkExit({ ...s, y: g.pxH + 1 }, { grid: g, exits: { ...noExits, down: true } })).toBe('down');
  });

  it('water: slow fall, jump from ground, drowning without dive but not with', () => {
    const g = room(); const e = env(g, { water: true });
    const s = createHero(100, 50); const events: string[] = [];
    for (let i = 0; i < 60 * 8; i++) events.push(...stepHero(s, idle, e, 1 / 60));
    expect(events).toContain('drown');
    const d = createHero(100, 50); const ev2: string[] = []; const e2 = env(g, { water: true, abilities: { double: false, dive: true } });
    for (let i = 0; i < 60 * 8; i++) ev2.push(...stepHero(d, idle, e2, 1 / 60));
    expect(ev2).not.toContain('drown');
    const before = d.y; stepHero(d, { ...idle, jumpPressed: true, jumpHeld: true }, e2, 1 / 60);
    expect(d.vy).toBeLessThan(0); expect(d.y).toBeLessThanOrEqual(before + 1);
  });
});
