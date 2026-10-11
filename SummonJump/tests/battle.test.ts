import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { act, alive, autoBattle, autoChoice, createBattle, createRng, dungeonWaves, nextTurn, splitWaves, towerWaves, turnOrder, unitOf, type ContentBundle, type SpiritInst } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const STARTER: [string, string][] = [['sylph', 'wind'], ['undine', 'water'], ['salamander', 'fire'], ['poring', 'water']];
const team = (lv: number, star: number) => STARTER.map(([id, el], i) => ({ s: { uid: i + 1, id, el, star: id === 'poring' ? Math.max(1, star - 2) : star, lv: id === 'poring' ? Math.min(lv, 15) : lv, exp: 0, awk: false } as SpiritInst, runes: [] }));
const winRate = (mk: (seed: number) => ReturnType<typeof createBattle>) => { let w = 0; for (let s = 1; s <= 20; s++) if (autoBattle(mk(s)).result === 'win') w++; return w / 20; };

describe('turn battle (SW style)', () => {
  it('is deterministic for the same team, waves and seed', () => {
    const run = () => { const b = autoBattle(createBattle(content, team(20, 3), towerWaves(content, 10), 42)); return [b.result, b.turnNo, b.units.map((u) => u.hp).join(',')]; };
    expect(run()).toEqual(run());
  });
  it('the fastest unit acts first and the turn strip matches the real order', () => {
    const b = createBattle(content, team(20, 3), towerWaves(content, 1), 1);
    const order = turnOrder(b, 4);
    nextTurn(b);
    expect(b.active?.key).toBe(order[0]);
    expect(b.active?.key).toBe('a0'); // sylph SPD 112 + no monster faster on floor 1
  });
  it('an ultimate waits its cooldown (every 4th turn of that spirit)', () => {
    const b = createBattle(content, team(25, 4), [[{ id: 'king', scale: 20 }]], 3); // a tanky target so the fight lasts
    const used: number[] = [];
    for (let i = 0; i < 80 && !b.result; i++) {
      nextTurn(b);
      const u = b.active; if (!u) continue;
      const ch = autoChoice(b, u);
      if (u.key === 'a0' && ch.skill === 1) used.push(u.turns);
      act(b, ch.skill, ch.target);
    }
    expect(used.length).toBeGreaterThan(2);
    for (let i = 1; i < used.length; i++) expect((used[i] as number) - (used[i - 1] as number)).toBe(4);
  });
  it('a stunned unit loses its turn', () => {
    const b = createBattle(content, team(20, 3), towerWaves(content, 3), 5);
    const e = b.units.find((u) => u.side === 'enemy')!;
    e.stun = 1; e.bar = 100; // its turn now, but it is stunned
    const ev = nextTurn(b);
    expect(ev[0]).toEqual({ kind: 'stunned', unit: e.key });
    expect(e.stun).toBe(0);
    expect(b.active?.key).not.toBe(e.key);
  });
  it('a boss rages under half HP and calls its minion (worth no EXP)', () => {
    const b = createBattle(content, team(28, 4), [[{ id: 'king', scale: 20 }]], 7); // tanky so one hit can't finish it
    const king = b.units.find((u) => u.boss)!;
    king.hp = Math.floor(king.maxHp / 2) + 1;
    const spd = king.spd;
    for (let i = 0; i < 40 && !b.result && king.phase === 1; i++) { nextTurn(b); const u = b.active; if (u) { const ch = autoChoice(b, u); act(b, ch.skill, ch.target); } }
    expect(king.phase).toBe(2);
    expect(king.spd).toBeGreaterThan(spd);
    const minion = b.units.find((u) => u.key.includes('_s'));
    expect(minion?.id).toBe('poring');
    expect(minion?.exp).toBe(0);
  });
  it('big tower floors are split into waves that fit the field; waves come one after another', () => {
    expect(splitWaves(towerWaves(content, 17)).map((w) => w.length)).toEqual([4, 3]);
    const b = autoBattle(createBattle(content, team(27, 4), towerWaves(content, 17), 2));
    expect(b.result).toBe('win');
    expect(b.wave).toBe(1);
    expect(b.exp).toBeGreaterThan(0);
  });
  it('leader skill buffs the whole team (undine leader: HP +15 %)', () => {
    const t = team(20, 3), withLead = createBattle(content, [t[1]!, t[0]!], towerWaves(content, 1), 1), without = createBattle(content, [t[0]!], towerWaves(content, 1), 1);
    expect(unitOf(withLead, 'a1')!.maxHp).toBe(Math.round(unitOf(without, 'a0')!.maxHp * 1.15));
  });
  it('balance: normal floors are easy, boss floors need upgraded spirits, the daily dungeon is fair on AUTO', () => {
    expect(winRate((s) => createBattle(content, team(15, 3), towerWaves(content, 1), s))).toBe(1);
    expect(winRate((s) => createBattle(content, team(21, 3), towerWaves(content, 12), s))).toBeGreaterThanOrEqual(0.9);
    expect(winRate((s) => createBattle(content, team(25, 3), towerWaves(content, 20), s))).toBeLessThanOrEqual(0.3);
    expect(winRate((s) => createBattle(content, team(28, 4), towerWaves(content, 20), s))).toBeGreaterThanOrEqual(0.8);
    const d = content.dungeon[0]!;
    expect(winRate((s) => createBattle(content, team(13, 3), dungeonWaves(content, d, 12, createRng(s)), s))).toBeGreaterThanOrEqual(0.6);
    expect(winRate((s) => createBattle(content, team(28, 4), dungeonWaves(content, d, 26, createRng(s)), s))).toBeGreaterThanOrEqual(0.9);
  });
  it('a lost fight ends when every spirit is down', () => {
    const b = autoBattle(createBattle(content, team(5, 1).slice(0, 1), towerWaves(content, 20), 1));
    expect(b.result).toBe('lose');
    expect(alive(b, 'ally')).toHaveLength(0);
  });
});
