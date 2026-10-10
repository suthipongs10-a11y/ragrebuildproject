import type { ContentBundle, DungeonDayDef, MonsterDef } from '../content/types';
import type { Rng } from '../rng';

/**
 * Offline arena modes (Phase 5 prototypes, server-checked from Phase 6):
 * - Daily dungeon: element of the weekday, 3 entries per day, 3 waves scaled to the hero's level → essences (+ rune chance).
 * - Tower: floors 1–20 from tower.csv, one wave per floor, first clear gives the floor reward once.
 */
export interface ArenaState { daily: { day: string; used: number }; tower: number }
export const emptyArena = (): ArenaState => ({ daily: { day: '', used: 0 }, tower: 0 });
export const DAILY_ENTRIES = 3;

export type ArenaRun = { mode: 'dungeon'; day: number; heroLv: number } | { mode: 'tower'; floor: number };
export interface WaveSpawn { id: string; scale: number }

/** Local calendar day key (the entry counter resets at local midnight). */
export const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dungeonOf(c: ContentBundle, weekday: number): DungeonDayDef | undefined { return c.dungeon.find((d) => d.day === weekday); }

export function dailyLeft(a: ArenaState, today: string): number { return a.daily.day === today ? Math.max(0, DAILY_ENTRIES - a.daily.used) : DAILY_ENTRIES; }

/** Spend one daily entry; false when none are left today. */
export function useDailyEntry(a: ArenaState, today: string): boolean {
  if (dailyLeft(a, today) <= 0) return false;
  if (a.daily.day !== today) a.daily = { day: today, used: 0 };
  a.daily.used++;
  return true;
}

/** Scale that brings a monster near the hero's level (bounded so low-level monsters still feel weak-ish). */
export function levelScale(m: MonsterDef, heroLv: number): number { return Math.max(0.7, Math.min(4, (heroLv + 2) / Math.max(1, m.level))); }

/** 3 waves (3, 4 and 5 monsters; the last one with an elite x2). Seeded so the server can replay the same run. */
export function dungeonWaves(c: ContentBundle, day: DungeonDayDef, heroLv: number, rng: Rng): WaveSpawn[][] {
  const pick = () => day.monsters[Math.floor(rng.next() * day.monsters.length) % day.monsters.length] as string;
  const spawn = (elite = false): WaveSpawn => {
    const id = pick(), m = c.monsters.find((x) => x.id === id) as MonsterDef;
    return { id, scale: levelScale(m, heroLv) * (elite ? 2 : 1) };
  };
  return [3, 4, 5].map((n, w) => Array.from({ length: n }, (_, i) => spawn(w === 2 && i === 0)));
}

export interface ArenaReward { items: Record<string, number>; zeny: number; runeStar: number | null }

export function dungeonReward(day: DungeonDayDef, heroLv: number, rng: Rng): ArenaReward {
  const items: Record<string, number> = { [day.essence]: 3 + Math.floor(heroLv / 5) };
  items.ess_magic = (items.ess_magic ?? 0) + 2 + Math.floor(heroLv / 10);
  return { items, zeny: 40 * heroLv, runeStar: rng.chance(0.5) ? Math.min(6, 1 + Math.floor(heroLv / 8)) : null };
}

export function towerWaves(c: ContentBundle, floor: number): WaveSpawn[][] {
  const f = c.tower.find((x) => x.floor === floor);
  return f ? [f.monsters.flatMap((m) => Array.from({ length: m.n }, () => ({ id: m.id, scale: f.scale })))] : [];
}

/** Clearing a floor: the reward only the first time (best floor moves up). */
export function clearTower(c: ContentBundle, a: ArenaState, floor: number): ArenaReward | null {
  const f = c.tower.find((x) => x.floor === floor);
  if (!f || floor !== a.tower + 1) return null;
  a.tower = floor;
  return { items: { ...f.reward }, zeny: f.zeny, runeStar: floor % 5 === 0 ? Math.min(6, 2 + floor / 5) : null };
}

export const canEnterTower = (c: ContentBundle, a: ArenaState, floor: number): boolean => floor >= 1 && floor <= Math.min(a.tower + 1, c.tower.length);

/** A monster definition scaled for an arena (HP / ATK / DEF / rewards). */
export function scaledDef(m: MonsterDef, scale: number): MonsterDef {
  if (scale === 1) return m;
  return { ...m, hp: Math.round(m.hp * scale), atk: Math.round(m.atk * Math.sqrt(scale)), def: Math.round(m.def * Math.sqrt(scale)), exp: Math.round(m.exp * scale), job_exp: Math.round(m.job_exp * scale) };
}
