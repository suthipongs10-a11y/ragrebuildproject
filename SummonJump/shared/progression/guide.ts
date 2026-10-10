import type { ContentBundle, QuestDef } from '../content/types';

/**
 * New-player guidance: features unlock by base level (unlocks.csv) and a short main-quest chain (quests.csv)
 * points to the next goal. Pure; the client passes in what it knows about the player.
 */
export const unlockLevel = (c: ContentBundle, feature: string): number => c.unlocks.find((u) => u.feature === feature)?.level ?? 1;
export const isUnlocked = (c: ContentBundle, feature: string, lv: number): boolean => lv >= unlockLevel(c, feature);
/** Features that open when going from level `from` to `to`. */
export const newUnlocks = (c: ContentBundle, from: number, to: number) => c.unlocks.filter((u) => u.level > from && u.level <= to);

/** What the quest checks look at. */
export interface QuestFacts { kills: Record<string, number>; level: number; spirits: number; seen: Record<string, true>; job: string; tower: number }
/** Saved chain position; `base` = the counter when the quest started (kills / spirits gained since then). */
export interface QuestState { i: number; base: number }

export const currentQuest = (c: ContentBundle, s: QuestState): QuestDef | undefined => c.quests[s.i];

/** Counter the quest starts from (so earlier kills don't count). */
export function questBase(q: QuestDef, f: QuestFacts): number {
  return q.kind === 'kill' ? f.kills[q.target] ?? 0 : q.kind === 'summon' ? f.spirits : 0;
}

export function questProgress(q: QuestDef, s: QuestState, f: QuestFacts): { have: number; need: number } {
  const have = q.kind === 'kill' ? (f.kills[q.target] ?? 0) - s.base
    : q.kind === 'summon' ? f.spirits - s.base
    : q.kind === 'level' ? f.level
    : q.kind === 'visit' ? (f.seen[q.target] ? 1 : 0)
    : q.kind === 'job' ? (f.job !== 'novice' ? 1 : 0)
    : f.tower;
  return { have: Math.max(0, Math.min(have, q.count)), need: q.count };
}

/** If the current quest is done: move to the next one and return the finished quest (caller gives the reward). */
export function advanceQuest(c: ContentBundle, s: QuestState, f: QuestFacts): QuestDef | null {
  const q = currentQuest(c, s);
  if (!q) return null;
  const p = questProgress(q, s, f);
  if (p.have < p.need) return null;
  s.i++;
  const next = currentQuest(c, s);
  s.base = next ? questBase(next, f) : 0;
  return q;
}
