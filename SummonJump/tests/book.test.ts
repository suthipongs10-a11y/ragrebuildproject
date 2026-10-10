import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookBonus, bookProgress, canClaimBook, claimBook, derive, emptyBook, maxHp, newHero, noteCard, noteDex, noteKill, starterBox, type ContentBundle } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const entry = (id: string) => content.book.find((e) => e.id === id)!;

describe('adventure book', () => {
  it('every zone 1–3 monster has a kill milestone; maps, cards and dex milestones exist', () => {
    for (const m of content.monsters.filter((x) => x.zone !== 'desert')) expect(content.book.some((e) => e.kind === 'kill' && e.target[0] === m.id), m.id).toBe(true);
    for (const k of ['map', 'card', 'spirit']) expect(content.book.some((e) => e.kind === k)).toBe(true);
  });

  it('kill milestone: progress, claim once, permanent bonus in derive()', () => {
    const b = emptyBook(), h = newHero(content);
    for (let i = 0; i < 49; i++) noteKill(b, 'poring');
    expect(canClaimBook(entry('kill_poring'), b, {})).toBe(false);
    noteKill(b, 'poring');
    expect(bookProgress(entry('kill_poring'), b, {})).toEqual({ have: 50, need: 50 });
    expect(claimBook(content, b, 'kill_poring', {})).toBe(true);
    expect(claimBook(content, b, 'kill_poring', {})).toBe(false);
    const base = maxHp(derive(h, content).build), withBook = maxHp(derive(h, content, [], 0, { element: null, effects: bookBonus(content, b) }).build);
    expect(withBook).toBe(base + 20);
  });

  it('cards, spirit dex and maps count distinct things', () => {
    const b = emptyBook();
    for (const c of ['card_poring', 'card_poring', 'card_bird', 'card_fish']) noteCard(b, c);
    expect(bookProgress(entry('cards_3'), b, {}).have).toBe(3);
    noteDex(b, starterBox(content, null));
    expect(Object.keys(b.dex).length).toBe(4);
    const seen = { forest: true, forest2: true, deep: true } as Record<string, true>;
    expect(bookProgress(entry('map_forest'), b, seen).have).toBe(3);
  });
});
