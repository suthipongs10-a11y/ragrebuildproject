import type { DefeatedMap } from '@shared/platformer';
import type { HeroData } from '@shared/progression/hero';
import type { SpiritBox } from '@shared/spirits/model';
import type { BookData } from '@shared/progression/book';
import type { ArenaState } from '@shared/rules/arena';
import type { QuestState } from '@shared/progression/guide';

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
  soul: number;
  inv: Record<string, number>;
  cards: Record<string, number>;
  /** Phase 3 hero (levels, job, skills, bag, equipment). null = create on first load (migrates exp/inv). */
  hero: HeroData | null;
  /** Phase 4 spirits (collection, runes, team, pity, gauge). null = starter box on next load. */
  spirits: SpiritBox | null;
  /** Phase 5 Adventure Book (kills, cards, spirit dex, claimed milestones). */
  book: BookData | null;
  /** Phase 5 daily dungeon entries + best tower floor. */
  arena: ArenaState | null;
  /** main quest chain position (quests.csv) */
  quest: QuestState | null;
}

/** `?hero=job:lv` test heroes use their own slot so they never overwrite the real save. */
const HERO_PARAM = new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get('hero');
const KEY = HERO_PARAM ? `summonjump-save-test-${HERO_PARAM.replace(/[^a-z0-9:]/gi, '')}` : 'summonjump-save-v1';
export const emptySave = (): SaveData => ({ v: 1, room: 'town', spawn: null, broken: {}, defeated: {}, items: {}, chests: {}, seen: {}, hp: null, exp: 0, soul: 0, inv: {}, cards: {}, hero: null, spirits: null, book: null, arena: null, quest: null });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const d = JSON.parse(raw) as Partial<SaveData> & { zeny?: number };
    if (d.v !== 1) return emptySave();
    // the old coin became soul stones (same amount)
    if (d.soul === undefined && typeof d.zeny === 'number') { d.soul = d.zeny; delete d.zeny; }
    return { ...emptySave(), ...d };
  } catch { return emptySave(); }
}

export function writeSave(s: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable: play on without saving */ }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
