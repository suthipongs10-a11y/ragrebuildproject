import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canEnterTower, clearTower, createRng, dailyLeft, dungeonOf, dungeonReward, dungeonWaves, emptyArena, scaledDef, towerWaves, useDailyEntry, type ContentBundle } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;

describe('daily dungeon', () => {
  it('3 entries a day, reset the next day', () => {
    const a = emptyArena();
    for (let i = 0; i < 3; i++) expect(useDailyEntry(a, '2026-10-10')).toBe(true);
    expect(useDailyEntry(a, '2026-10-10')).toBe(false);
    expect(dailyLeft(a, '2026-10-11')).toBe(3);
    expect(useDailyEntry(a, '2026-10-11')).toBe(true);
  });
  it('every weekday: 3 waves of the day monsters, elite in the last wave, essence reward grows with level', () => {
    for (let d = 0; d < 7; d++) {
      const day = dungeonOf(content, d)!;
      const w = dungeonWaves(content, day, 20, createRng(d));
      expect(w.map((x) => x.length)).toEqual([3, 4, 5]);
      for (const sp of w.flat()) expect(day.monsters).toContain(sp.id);
      expect(w[2]![0]!.scale).toBeGreaterThan(1);
      const lo = dungeonReward(day, 5, createRng(1)), hi = dungeonReward(day, 40, createRng(1));
      expect(hi.items[day.essence]!).toBeGreaterThan(lo.items[day.essence]!);
    }
  });
});

describe('tower', () => {
  it('20 floors, boss every 5th, first clear only once, floors unlock in order', () => {
    expect(content.tower).toHaveLength(20);
    for (const f of [5, 10, 15, 20]) expect(towerWaves(content, f)[0]!.some((s) => content.monsters.find((m) => m.id === s.id)!.tier !== 'normal')).toBe(true);
    const a = emptyArena();
    expect(canEnterTower(content, a, 2)).toBe(false);
    expect(clearTower(content, a, 1)).not.toBeNull();
    expect(clearTower(content, a, 1)).toBeNull();
    expect(canEnterTower(content, a, 2)).toBe(true);
    expect(canEnterTower(content, a, 1)).toBe(true);
  });
  it('scaled monsters get more HP and rewards', () => {
    const p = content.monsters.find((m) => m.id === 'poring')!, s = scaledDef(p, 3);
    expect(s.hp).toBe(p.hp * 3); expect(s.exp).toBe(p.exp * 3); expect(s.atk).toBeGreaterThan(p.atk);
  });
});
