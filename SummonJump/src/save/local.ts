import type { DefeatedMap } from '@shared/platformer';

/** Local (pre-server) save. Every storage access is wrapped: private windows / blocked storage must not break the game. */
export interface SaveData {
  v: 1;
  room: string;
  spawn: { room: string; x: number; y: number } | null;
  broken: Record<string, true>;
  defeated: DefeatedMap;
  items: Record<string, true>;
  chests: Record<string, true>;
  seen: Record<string, true>;
  hp: number | null;
  exp: number;
  zeny: number;
  inv: Record<string, number>;
  cards: Record<string, number>;
}

const KEY = 'summonjump-save-v1';
export const emptySave = (): SaveData => ({ v: 1, room: 'town', spawn: null, broken: {}, defeated: {}, items: {}, chests: {}, seen: {}, hp: null, exp: 0, zeny: 0, inv: {}, cards: {} });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.v !== 1) return emptySave();
    return { ...emptySave(), ...d };
  } catch { return emptySave(); }
}

export function writeSave(s: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: play on without saving */ }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
