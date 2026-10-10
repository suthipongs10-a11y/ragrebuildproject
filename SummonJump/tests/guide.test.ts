import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { advanceQuest, currentQuest, isUnlocked, newUnlocks, questBase, questProgress, type ContentBundle, type QuestFacts, type QuestState } from '@shared/index';

const content = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', 'content', 'content.json'), 'utf8')) as ContentBundle;
const th = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'i18n', 'th.json'), 'utf8')) as Record<string, string>;
const facts = (): QuestFacts => ({ kills: {}, level: 1, spirits: 3, seen: {}, job: 'novice', tower: 0 });

describe('unlocks + guide quests', () => {
  it('features open by level', () => {
    expect(isUnlocked(content, 'summon', 4)).toBe(false);
    expect(isUnlocked(content, 'summon', 5)).toBe(true);
    expect(isUnlocked(content, 'unknown', 1)).toBe(true);
    expect(newUnlocks(content, 4, 12).map((u) => u.feature).sort()).toEqual(['dungeon', 'explore', 'runes', 'summon']);
  });

  it('every quest and unlock has text', () => {
    for (const q of content.quests) { expect(th[q.text_key], q.id).toBeTruthy(); expect(th[`${q.text_key}.hint`], q.id).toBeTruthy(); }
    for (const u of content.unlocks) expect(th[u.name_key], u.feature).toBeTruthy();
  });

  it('kills before the quest started do not count; the chain moves on', () => {
    const f = facts(); f.kills.poring = 10;
    const s: QuestState = { i: 0, base: 0 };
    s.base = questBase(currentQuest(content, s)!, f);
    expect(questProgress(currentQuest(content, s)!, s, f).have).toBe(0);
    expect(advanceQuest(content, s, f)).toBeNull();
    f.kills.poring = 15;
    expect(advanceQuest(content, s, f)?.id).toBe('q_poring');
    expect(currentQuest(content, s)?.id).toBe('q_lv5');
    f.level = 5;
    expect(advanceQuest(content, s, f)?.id).toBe('q_lv5');
    // summon counts spirits gained after the quest started
    expect(s.base).toBe(3);
    f.spirits = 4;
    expect(advanceQuest(content, s, f)?.id).toBe('q_summon');
  });

  it('the chain ends', () => {
    const s: QuestState = { i: content.quests.length, base: 0 };
    expect(currentQuest(content, s)).toBeUndefined();
    expect(advanceQuest(content, s, facts())).toBeNull();
  });
});
