import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Cell, TILE, TileGrid, createEnemy, createHero, createHeroCombat, createRng, rollKill, stepEnemy, stepHeroCombat, COMBO, type ContentBundle, type Enemy, type EnemyCtx, type HeroBuild, type MonsterDef, type Shot } from '@shared/index';
import { sampleClip, type Clip } from '../src/rig/clips';
import rig from '../src/rig/hero.rig.json';

const root = join(import.meta.dirname, '..');
// build content the same way the game does (npm run content writes public/content/content.json)
const content = JSON.parse(readFileSync(join(root, 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const def = (id: string) => content.monsters.find((m) => m.id === id) as MonsterDef;
const BUILD: HeroBuild = { level: 1, stats: { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 }, weaponAtk: 6, bonusAtk: 0, bonusDef: 0, bonusHp: 0, bonusCrit: 0 };

function floorGrid(): TileGrid { const g = new TileGrid(30, 17); for (let x = 0; x < 30; x++) { g.set(x, 15, Cell.Solid); g.set(x, 16, Cell.Solid); } return g; }
function ctxFor(grid: TileGrid, hero: { x: number; y: number; w: number; h: number }, enemies: Enemy[], shots: Shot[] = []): EnemyCtx {
  const rng = createRng(7);
  return { grid, rng, hero, water: false, shots, events: [], summon: (m, x, y) => enemies.push(createEnemy(`s${enemies.length}`, def(m), x, y, rng)), count: (m) => enemies.filter((e) => e.def.id === m).length };
}
const run = (e: Enemy, ctx: EnemyCtx, secs: number) => { for (let i = 0; i < secs * 120; i++) stepEnemy(e, ctx, 1 / 120); };

describe('enemy AI', () => {
  it('every monster in content has a working brain and stays inside the room', () => {
    for (const m of content.monsters) {
      const g = floorGrid(), list: Enemy[] = [];
      const e = createEnemy(m.id, m, 15 * TILE, 15 * TILE, createRng(1)); list.push(e);
      const ctx = ctxFor(g, { x: 10 * TILE, y: 15 * TILE - 56, w: 24, h: 56 }, list);
      run(e, ctx, 6);
      expect(Number.isFinite(e.x) && Number.isFinite(e.y), m.id).toBe(true);
      expect(e.x).toBeGreaterThanOrEqual(0); expect(e.x + e.w).toBeLessThanOrEqual(g.pxW);
      expect(e.y + e.h, `${m.id} fell out`).toBeLessThanOrEqual(15 * TILE + 24); // flyers bob a little
    }
  });
  it('walker telegraphs (windup) before lunging at a nearby hero', () => {
    const g = floorGrid(), e = createEnemy('m', def('mantis'), 15 * TILE, 15 * TILE, createRng(2)), ctx = ctxFor(g, { x: 13 * TILE, y: 15 * TILE - 56, w: 24, h: 56 }, [e]);
    const poses: string[] = [];
    for (let i = 0; i < 240; i++) { stepEnemy(e, ctx, 1 / 120); poses.push(e.pose); }
    const w = poses.indexOf('windup'), a = poses.indexOf('attack');
    expect(w).toBeGreaterThanOrEqual(0); expect(a).toBeGreaterThan(w);
  });
  it('poring king summons porings when enraged', () => {
    const g = floorGrid(), list: Enemy[] = [], e = createEnemy('k', def('king'), 15 * TILE, 15 * TILE, createRng(3)); list.push(e);
    e.hp = e.def.hp / 3;
    run(e, ctxFor(g, { x: 5 * TILE, y: 15 * TILE - 56, w: 24, h: 56 }, list), 8);
    expect(list.some((q) => q.def.id === 'poring')).toBe(true);
  });
});

describe('hero combat', () => {
  const setup = () => {
    const g = floorGrid(), hero = createHero(10 * TILE, 15 * TILE - 56); hero.onGround = true; hero.dir = 1;
    const e = createEnemy('p', def('mantis'), 11 * TILE + 20, 15 * TILE, createRng(4));
    return { g, hero, e, c: createHeroCombat(BUILD), rng: createRng(9) };
  };
  it('three presses chain attack1 → attack2 → attack3 and hit once per swing', () => {
    const { hero, e, c, rng } = setup(); e.def = { ...e.def, hp: 9999 }; e.hp = 9999; e.def.tier = 'mini';
    const clips: string[] = []; let hits = 0;
    for (let i = 0; i < 200; i++) {
      const ev = stepHeroCombat(c, hero, BUILD, [e], [], { attackPressed: i % 40 === 0, attackHeld: false, jumpHeld: false }, false, rng, 1 / 120);
      for (const x of ev) { if (x.kind === 'swing') clips.push(x.spec.clip); if (x.kind === 'hit') hits++; }
      hero.x = 10 * TILE; // ignore knockback for this test
    }
    expect(clips.slice(0, 3)).toEqual(['attack1', 'attack2', 'attack3']);
    expect(hits).toBe(clips.length);
  });
  it('contact hurts the hero once per i-frame window; stomp bounces instead', () => {
    const { hero, e, c, rng } = setup(); e.x = hero.x; e.y = hero.y + 10;
    const ev = stepHeroCombat(c, hero, BUILD, [e], [], { attackPressed: false, attackHeld: false, jumpHeld: false }, false, rng, 1 / 60);
    expect(ev.some((x) => x.kind === 'hurt')).toBe(true);
    const hp = c.hp;
    stepHeroCombat(c, hero, BUILD, [e], [], { attackPressed: false, attackHeld: false, jumpHeld: false }, false, rng, 1 / 60);
    expect(c.hp).toBe(hp);
    const p = createEnemy('q', def('poring'), 20 * TILE, 15 * TILE, createRng(5)); const h2 = createHero(p.x, p.y - 50); h2.vy = 300; h2.prevBottom = p.y;
    const c2 = createHeroCombat(BUILD);
    const ev2 = stepHeroCombat(c2, h2, BUILD, [p], [], { attackPressed: false, attackHeld: false, jumpHeld: true }, false, rng, 1 / 60);
    expect(ev2.some((x) => x.kind === 'hit' && x.stomp)).toBe(true);
    expect(h2.vy).toBeLessThan(0); expect(c2.hp).toBe(createHeroCombat(BUILD).hp);
  });
  it('hero dies at 0 HP', () => {
    const { hero, e, c, rng } = setup(); c.hp = 1; e.x = hero.x;
    const ev = stepHeroCombat(c, hero, BUILD, [e], [], { attackPressed: false, attackHeld: false, jumpHeld: false }, false, rng, 1 / 60);
    expect(ev.map((x) => x.kind)).toContain('died'); expect(c.dead).toBe(true);
  });
  it('combo table is ordered light → heavy', () => { expect(COMBO.map((s) => s.mult)).toEqual([...COMBO.map((s) => s.mult)].sort((a, b) => a - b)); });
});

describe('drops', () => {
  it('bosses always drop their card; rates converge for normal monsters', () => {
    const r = rollKill(def('king'), content.drops, createRng(1));
    expect(r.drops.some((d) => d.kind === 'card' && d.id === 'card_king')).toBe(true);
    const rng = createRng(42); let cards = 0; const N = 20000;
    for (let i = 0; i < N; i++) if (rollKill(def('poring'), content.drops, rng).drops.some((d) => d.kind === 'card')) cards++;
    expect(cards / N).toBeGreaterThan(0.007); expect(cards / N).toBeLessThan(0.013);
  });
  it('zeny stays within the monster range', () => {
    const m = def('mantis'), rng = createRng(3);
    for (let i = 0; i < 500; i++) { const z = rollKill(m, content.drops, rng).zeny; expect(z).toBeGreaterThanOrEqual(m.zeny_min); expect(z).toBeLessThanOrEqual(m.zeny_max); }
  });
});

describe('rig clips', () => {
  const clips = rig.clips as unknown as Record<string, Clip>;
  it('every clip samples finite joint values at any time', () => {
    for (const [name, c] of Object.entries(clips)) for (const tm of [0, 0.05, 0.13, 0.5, 3.7]) for (const v of Object.values(sampleClip(c, tm))) expect(Number.isFinite(v), name).toBe(true);
  });
  it('non-looping clips hold the last key; loops wrap', () => {
    const a = clips.attack1 as Clip, last = a.keys[a.keys.length - 1] as Record<string, number>;
    expect(sampleClip(a, 5).ua).toBeCloseTo(last.ua as number, 5);
    const run = clips.run as Clip;
    expect(sampleClip(run, 0).tf).toBeCloseTo(sampleClip(run, run.dur).tf as number, 5);
  });
});

describe('boss scripts (Phase 5)', () => {
  it('every mini-boss / MVP attacks, enters phase 2 under half HP and stays sane', () => {
    for (const m of content.monsters.filter((x) => x.tier !== 'normal')) {
      const g = floorGrid(), list: Enemy[] = [], shots: Shot[] = [];
      const e = createEnemy(m.id, m, 15 * TILE, 15 * TILE, createRng(3)); list.push(e);
      const ctx = ctxFor(g, { x: 11 * TILE, y: 15 * TILE - 56, w: 24, h: 56 }, list, shots);
      run(e, ctx, 5);
      e.hp = m.hp * 0.4;
      run(e, ctx, 10);
      expect(ctx.events.some((ev) => ev.kind === 'phase'), `${m.id} phase 2`).toBe(true);
      const acted = shots.length > 0 || list.length > 1 || ctx.events.some((ev) => ev.kind === 'slam') || e.pose !== 'idle';
      expect(acted, `${m.id} does something`).toBe(true);
      expect(Number.isFinite(e.x) && Number.isFinite(e.y), m.id).toBe(true);
      expect(e.phase).toBe(2);
    }
  });
});
