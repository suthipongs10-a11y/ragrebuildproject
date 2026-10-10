import type { ContentBundle } from '../content/types';
import type { HeroData, Derived } from '../progression/hero';
import { skillDef } from '../progression/hero';
import type { Body } from '../platformer';
import type { Enemy } from './enemy';
import { cooldownLeft, spCost, type SkillRuntime } from './skills';

/**
 * Auto battle (owner request): the player still walks; Auto faces the nearest monster, attacks when it is in reach
 * and fires the slotted skills — heal under 60 % HP, buffs when they ran out, attacks when a monster is close enough.
 */
export interface AutoPlan { face: 1 | -1 | 0; attack: boolean; skill: string | null }

/** How far (px, centre to centre) the auto looks for a target. */
export const AUTO_SIGHT = 420;
const MELEE = 70;
/** Rough reach per skill target type (centre to centre). */
const SKILL_REACH: Record<string, number> = { front: 110, aoe: 130, dash: 200, zone: 260 };

export interface AutoInput {
  content: ContentBundle; data: HeroData; rt: SkillRuntime; derived: Derived;
  hp: number; maxHp: number; hero: Body & { dir: 1 | -1 }; enemies: Enemy[];
}

export function autoPlan(a: AutoInput): AutoPlan {
  const hx = a.hero.x + a.hero.w / 2, hy = a.hero.y + a.hero.h / 2;
  let best: Enemy | null = null, bd = Infinity;
  for (const e of a.enemies) {
    if (e.dead) continue;
    const dx = Math.abs(e.x + e.w / 2 - hx), dy = Math.abs(e.y + e.h / 2 - hy);
    if (dx > AUTO_SIGHT || dy > 140) continue;
    if (dx < bd) { bd = dx; best = e; }
  }
  const face: 1 | -1 | 0 = best ? (best.x + best.w / 2 >= hx ? 1 : -1) : 0;
  const reach = (a.derived.ranged ? a.derived.range : MELEE) + (best ? best.w / 2 : 0) + a.hero.w / 2;
  const attack = !!best && bd <= reach;
  return { face, attack, skill: pickSkill(a, best ? bd : Infinity) };
}

function pickSkill(a: AutoInput, dist: number): string | null {
  if (a.rt.cast) return null;
  for (const id of a.data.slots) {
    if (!id) continue;
    const s = skillDef(a.content, id), lv = a.data.skills[id] ?? 0;
    if (!s || s.type !== 'active' || lv <= 0) continue;
    if (cooldownLeft(a.rt, id) > 0 || a.rt.sp < spCost(s, lv)) continue;
    if (s.target === 'heal') { if (a.hp < a.maxHp * 0.6) return id; continue; }
    if (s.target === 'buff') { if (dist < Infinity && !a.rt.buffs.some((b) => b.id === String(s.effects.buff))) return id; continue; }
    if (s.target === 'zone' && !s.power.match(/[1-9]/)) continue; // pneuma etc.: no damage, leave it to the player
    const reach = SKILL_REACH[s.target] ?? a.derived.range + 150;
    if (dist <= reach) return id;
  }
  return null;
}
