import type { ContentBundle } from '../content/types';
import { spiritOf, type SpiritBox, type SpiritInst } from '../spirits/model';
import { tbc } from './units';
import type { TeamMember } from './turn';

/**
 * The turn-battle team: up to `tb_team` (4) spirits, chosen before each fight; slot 0 is the leader.
 * Spirits away on an expedition (`busy`) can't fight. Without a saved choice: the field team, then the strongest others.
 */
export const battleSize = (c: ContentBundle): number => Math.max(1, Math.round(tbc(c, 'team', 4)));

const power = (s: SpiritInst) => s.star * 100 + s.lv + (s.awk ? 50 : 0);

export function battleTeam(b: SpiritBox, c: ContentBundle, busy: readonly number[] = []): SpiritInst[] {
  const ok = (u: number | null | undefined): u is number => u != null && !!spiritOf(b, u) && !busy.includes(u);
  const picked = (b.battle ?? []).filter(ok);
  if (b.battle) return picked.slice(0, battleSize(c)).map((u) => spiritOf(b, u) as SpiritInst);
  const uids = [...b.team.filter(ok)];
  for (const s of [...b.spirits].sort((x, y) => power(y) - power(x))) if (uids.length < battleSize(c) && ok(s.uid) && !uids.includes(s.uid)) uids.push(s.uid);
  return uids.map((u) => spiritOf(b, u) as SpiritInst);
}

/** Tap a spirit in the picker: add it (if there is room) or take it out. Returns false when the team is full. */
export function toggleBattle(b: SpiritBox, c: ContentBundle, uid: number, busy: readonly number[] = []): boolean {
  const cur = battleTeam(b, c, busy).map((s) => s.uid);
  if (cur.includes(uid)) { b.battle = cur.filter((u) => u !== uid); return true; }
  if (cur.length >= battleSize(c) || busy.includes(uid) || !spiritOf(b, uid)) return false;
  b.battle = [...cur, uid];
  return true;
}

/** Make `uid` the leader (slot 0). */
export function leadBattle(b: SpiritBox, c: ContentBundle, uid: number, busy: readonly number[] = []): void {
  const cur = battleTeam(b, c, busy).map((s) => s.uid);
  if (cur.includes(uid)) b.battle = [uid, ...cur.filter((u) => u !== uid)];
}

export const battleMembers = (b: SpiritBox, team: readonly SpiritInst[]): TeamMember[] => team.map((s) => ({ s, runes: b.runes }));
