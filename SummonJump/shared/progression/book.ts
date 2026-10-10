import type { BookEntryDef, ContentBundle } from '../content/types';
import type { SpiritBox } from '../spirits/model';

/**
 * Adventure Book: kill counts, cards ever collected, spirit dex (family:element ever owned), maps discovered.
 * Milestones in book.csv give permanent stats once claimed. Pure so the server (Phase 6) can check claims.
 */
export interface BookData {
  kills: Record<string, number>;
  cards: Record<string, true>;
  dex: Record<string, true>;
  claimed: Record<string, true>;
}

export const emptyBook = (): BookData => ({ kills: {}, cards: {}, dex: {}, claimed: {} });

export function noteKill(b: BookData, monster: string): void { b.kills[monster] = (b.kills[monster] ?? 0) + 1; }
export function noteCard(b: BookData, card: string): void { b.cards[card] = true; }
/** Remember every spirit variant the player has owned (fodder used for star-ups still counts). */
export function noteDex(b: BookData, box: SpiritBox): void { for (const s of box.spirits) b.dex[`${s.id}:${s.el}`] = true; }

/** Progress towards one milestone. `seen` = rooms visited (save.seen). */
export function bookProgress(e: BookEntryDef, b: BookData, seen: Record<string, true>): { have: number; need: number } {
  const have = e.kind === 'kill' ? b.kills[e.target[0] ?? ''] ?? 0
    : e.kind === 'card' ? Object.keys(b.cards).length
    : e.kind === 'spirit' ? Object.keys(b.dex).length
    : e.target.filter((r) => seen[r]).length;
  return { have: Math.min(have, e.count), need: e.count };
}

export function canClaimBook(e: BookEntryDef, b: BookData, seen: Record<string, true>): boolean {
  const p = bookProgress(e, b, seen);
  return !b.claimed[e.id] && p.have >= p.need;
}

export function claimBook(c: ContentBundle, b: BookData, id: string, seen: Record<string, true>): boolean {
  const e = c.book.find((x) => x.id === id);
  if (!e || !canClaimBook(e, b, seen)) return false;
  b.claimed[id] = true;
  return true;
}

/** Sum of claimed rewards, as hero bonus keys for `derive()`. */
export function bookBonus(c: ContentBundle, b: BookData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of c.book) if (b.claimed[e.id]) for (const [k, v] of Object.entries(e.reward)) out[k] = (out[k] ?? 0) + v;
  return out;
}
