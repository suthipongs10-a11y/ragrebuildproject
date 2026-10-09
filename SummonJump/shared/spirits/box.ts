import type { ContentBundle, SpiritAbility } from '../content/types';
import type { Element } from '../formulas/elements';
import { addItem, countItem, removeItem, type HeroData } from '../progression/hero';
import {
  cfgList, familyOf, maxLevel, spiritExpToNext, spiritOf, sskillOf, MAX_STAR, TEAM_SIZE,
  type SpiritBox, type SpiritInst,
} from './model';

/** Collection rules: starter team, EXP, star-up with fodder, awakening, team + leader + exploration abilities. */

export function emptyBox(): SpiritBox {
  return { v: 1, spirits: [], runes: [], team: [null, null, null], nextUid: 1, pity: {}, gauge: 0 };
}

const parsePair = (s: string): [string, string] => { const [a = '', b = ''] = s.split(':'); return [a, b]; };

/** New save (or a save from before Phase 4): starter team + extra spirits from config, starter scrolls into the hero's bag. */
export function starterBox(c: ContentBundle, hero: HeroData | null): SpiritBox {
  const b = emptyBox();
  cfgList(c, 'starter_team').forEach((p, i) => { const [id, el] = parsePair(p); const s = addSpirit(b, c, id, el as Element); if (s && i < TEAM_SIZE) b.team[i] = s.uid; });
  for (const p of cfgList(c, 'starter_box')) { const [id, el] = parsePair(p); addSpirit(b, c, id, el as Element); }
  if (hero) for (const p of cfgList(c, 'starter_items')) { const [id, n] = parsePair(p); addItem(hero, c, id, Number(n) || 1); }
  return b;
}

export function addSpirit(b: SpiritBox, c: ContentBundle, id: string, el: Element, star?: number): SpiritInst | null {
  const f = familyOf(c, id);
  if (!f || !f.elements.includes(el)) return null;
  const s: SpiritInst = { uid: b.nextUid++, id, el, star: star ?? f.base_star, lv: 1, exp: 0, awk: false };
  b.spirits.push(s);
  return s;
}

// ───────────── EXP ─────────────
/** Give EXP to one spirit; returns levels gained. EXP stops at max level for its star. */
export function giveSpiritExp(s: SpiritInst, exp: number): number {
  const cap = maxLevel(s.star);
  if (s.lv >= cap) { s.exp = 0; return 0; }
  s.exp += exp;
  let ups = 0;
  while (s.lv < cap && s.exp >= spiritExpToNext(s.lv)) { s.exp -= spiritExpToNext(s.lv); s.lv++; ups++; }
  if (s.lv >= cap) s.exp = 0;
  return ups;
}

/** Team members share the kill EXP. Returns uids that levelled up. */
export function teamExp(b: SpiritBox, exp: number): number[] {
  const up: number[] = [];
  for (const uid of b.team) { const s = spiritOf(b, uid); if (s && giveSpiritExp(s, exp) > 0) up.push(s.uid); }
  return up;
}

// ───────────── star-up ─────────────
export const fodderNeeded = (s: SpiritInst): number => s.star;

/** null = ok, else a reason key (why.*). Fodder: `star` spirits of the same star, not in the team, not the target itself. */
export function canStarUp(b: SpiritBox, uid: number, fodder: readonly number[]): string | null {
  const s = spiritOf(b, uid);
  if (!s) return 'missing';
  if (s.star >= MAX_STAR) return 'maxStar';
  if (s.lv < maxLevel(s.star)) return 'notMaxLv';
  if (new Set(fodder).size !== fodder.length || fodder.length !== fodderNeeded(s)) return 'fodderCount';
  for (const f of fodder) {
    const x = spiritOf(b, f);
    if (!x || f === uid) return 'missing';
    if (x.star !== s.star) return 'fodderStar';
    if (b.team.includes(f)) return 'inTeam';
  }
  return null;
}

export function starUp(b: SpiritBox, uid: number, fodder: readonly number[]): boolean {
  if (canStarUp(b, uid, fodder) !== null) return false;
  for (const f of fodder) removeSpirit(b, f);
  const s = spiritOf(b, uid) as SpiritInst;
  s.star++; s.lv = 1; s.exp = 0;
  return true;
}

/** Spirits that can be used as fodder for `uid` right now. */
export function fodderCandidates(b: SpiritBox, uid: number): SpiritInst[] {
  const s = spiritOf(b, uid);
  return s ? b.spirits.filter((x) => x.uid !== uid && x.star === s.star && !b.team.includes(x.uid)) : [];
}

/** Remove a spirit; its runes go back to the rune bag. */
export function removeSpirit(b: SpiritBox, uid: number): void {
  const i = b.spirits.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  b.spirits.splice(i, 1);
  for (const r of b.runes) if (r.on === uid) r.on = null;
  b.team = b.team.map((t) => (t === uid ? null : t));
}

// ───────────── awaken ─────────────
export function awakenCost(c: ContentBundle, s: SpiritInst): { item: string; n: number }[] {
  const f = familyOf(c, s.id), e = c.spiritElements.find((x) => x.element === s.el);
  if (!f || !e) return [];
  return [{ item: e.essence, n: f.awk_ess }, { item: 'ess_magic', n: f.awk_magic }];
}

export function canAwaken(b: SpiritBox, c: ContentBundle, hero: HeroData, uid: number): string | null {
  const s = spiritOf(b, uid);
  if (!s) return 'missing';
  if (s.awk) return 'awakened';
  for (const k of awakenCost(c, s)) if (countItem(hero, k.item) < k.n) return 'essence';
  return null;
}

export function awaken(b: SpiritBox, c: ContentBundle, hero: HeroData, uid: number): boolean {
  if (canAwaken(b, c, hero, uid) !== null) return false;
  const s = spiritOf(b, uid) as SpiritInst;
  for (const k of awakenCost(c, s)) removeItem(hero, k.item, k.n);
  s.awk = true;
  return true;
}

// ───────────── team ─────────────
/** Put a spirit in a team slot (or null to clear). A spirit already in another slot moves (slots swap). */
export function setTeam(b: SpiritBox, slot: number, uid: number | null): boolean {
  if (slot < 0 || slot >= TEAM_SIZE) return false;
  if (uid !== null && !spiritOf(b, uid)) return false;
  const old = b.team[slot] ?? null;
  const at = uid === null ? -1 : b.team.indexOf(uid);
  if (at >= 0) b.team[at] = old;
  b.team[slot] = uid;
  return true;
}

export const teamSpirits = (b: SpiritBox): SpiritInst[] => b.team.map((u) => spiritOf(b, u)).filter((s): s is SpiritInst => !!s);
export const leaderOf = (b: SpiritBox): SpiritInst | undefined => spiritOf(b, b.team[0]);

/** Exploration abilities the current team gives (double jump, dive, smash rocks, cloud glide, reveal). */
export function teamAbilities(b: SpiritBox, c: ContentBundle): Set<Exclude<SpiritAbility, 'none'>> {
  const out = new Set<Exclude<SpiritAbility, 'none'>>();
  for (const s of teamSpirits(b)) { const a = familyOf(c, s.id)?.ability; if (a && a !== 'none') out.add(a); }
  return out;
}

/**
 * Leader skill as hero bonus keys (`derive()`): atk_p/def_p/hp_p in %, aspd/speed as fractions, crit flat %, gauge %.
 * The hero's weapon takes the leader's element when the weapon has none.
 */
export function leaderBonus(b: SpiritBox, c: ContentBundle): { element: Element | null; effects: Record<string, number> } {
  const s = leaderOf(b), f = s && familyOf(c, s.id), sk = f && sskillOf(c, f.leader);
  if (!s || !sk) return { element: null, effects: {} };
  const effects: Record<string, number> = {};
  for (const [k, v] of Object.entries(sk.effects)) effects[k] = k === 'aspd' || k === 'speed' ? v / 100 : v;
  return { element: s.el, effects };
}
