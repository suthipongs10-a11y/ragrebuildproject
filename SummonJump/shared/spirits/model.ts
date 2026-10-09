import type { ContentBundle, SpiritDef, SpiritSkillDef } from '../content/types';
import type { Element } from '../formulas/elements';

/**
 * Spirit collection data (SW style). Pure data + functions so the server (Phase 6) can validate the same rules.
 * A spirit instance = family (spirits.csv row) + element variant + star/level/awakening + up to 6 runes.
 */
export interface SpiritInst { uid: number; id: string; el: Element; star: number; lv: number; exp: number; awk: boolean }

export interface RuneStat { stat: string; v: number }
export interface RuneInst { uid: number; set: string; slot: number; star: number; lv: number; main: RuneStat; subs: RuneStat[]; on: number | null }

export interface SpiritBox {
  v: 1;
  spirits: SpiritInst[];
  runes: RuneInst[];
  /** spirit uids; slot 0 = leader */
  team: (number | null)[];
  nextUid: number;
  /** pulls since the last pity-star result, per summon id */
  pity: Record<string, number>;
  gauge: number;
}

export const TEAM_SIZE = 3;
export const MAX_STAR = 6;
export const RUNE_SLOTS = 6;
export const MAX_RUNE_LV = 15;

// ───────────── config (spirit_config.csv) ─────────────
export const cfg = (c: ContentBundle, key: string, dflt = 0): number => {
  const v = Number(c.spiritConfig[key]);
  return Number.isFinite(v) ? v : dflt;
};
export const cfgList = (c: ContentBundle, key: string): string[] => (c.spiritConfig[key] ?? '').split('|').filter(Boolean);

export const familyOf = (c: ContentBundle, id: string): SpiritDef | undefined => c.spirits.find((s) => s.id === id);
export const sskillOf = (c: ContentBundle, id: string): SpiritSkillDef | undefined => c.spiritSkills.find((s) => s.id === id);
export const spiritOf = (b: SpiritBox, uid: number | null | undefined): SpiritInst | undefined => (uid == null ? undefined : b.spirits.find((s) => s.uid === uid));

export function maxLevel(star: number): number { return 10 + 5 * star; }

/** EXP from `lv` to `lv + 1`. */
export function spiritExpToNext(lv: number): number { return Math.floor(20 * lv * (1 + lv * 0.1)); }

export function autoSkill(c: ContentBundle, s: SpiritInst): SpiritSkillDef | undefined {
  const f = familyOf(c, s.id);
  return f && sskillOf(c, s.awk ? f.awk_auto : f.auto);
}

// ───────────── stats ─────────────
export interface SpiritStats { hp: number; atk: number; def: number; spd: number; crit: number; critDmg: number; lifesteal: number; gauge: number }

/** Stats from family base (at its natural star, lv 1) x star x level x awakening x element, then runes (flat + % + set bonuses). */
export function spiritStats(c: ContentBundle, s: SpiritInst, runes: readonly RuneInst[] = []): SpiritStats {
  const f = familyOf(c, s.id);
  if (!f) return { hp: 1, atk: 1, def: 0, spd: 100, crit: 0, critDmg: 60, lifesteal: 0, gauge: 0 };
  const mul = cfgList(c, 'star_mul').map(Number);
  const starK = (mul[s.star - 1] ?? 1) / (mul[f.base_star - 1] ?? 1);
  const k = starK * (1 + cfg(c, 'level_growth', 0.06) * (s.lv - 1)) * (s.awk ? cfg(c, 'awaken_mult', 1.15) : 1);
  const e = c.spiritElements.find((x) => x.element === s.el);
  const b: Record<string, number> = {};
  const add = (key: string, v: number) => { b[key] = (b[key] ?? 0) + v; };
  const mine = runes.filter((r) => r.on === s.uid);
  for (const r of mine) for (const st of [r.main, ...r.subs]) add(st.stat, st.v);
  for (const [key, v] of Object.entries(runeSetBonus(c, mine))) add(key, v);
  const pct = (key: string) => 1 + (b[key] ?? 0) / 100;
  return {
    hp: Math.round(f.hp * k * (e?.hp ?? 1) * pct('hp_p') + (b.hp ?? 0)),
    atk: Math.round(f.atk * k * (e?.atk ?? 1) * pct('atk_p') + (b.atk ?? 0)),
    def: Math.round(f.def * k * (e?.def ?? 1) * pct('def_p') + (b.def ?? 0)),
    spd: Math.round(f.spd * (e?.spd ?? 1) * pct('spd')),
    crit: Math.min(80, f.crit + (b.crit ?? 0)),
    critDmg: 60 + (b.crit_dmg ?? 0),
    lifesteal: b.lifesteal ?? 0,
    gauge: b.gauge ?? 0,
  };
}

/** Completed rune sets on one spirit (a 2-set counts once per 2 pieces, a 4-set once). */
export function runeSetBonus(c: ContentBundle, runes: readonly RuneInst[]): Record<string, number> {
  const out: Record<string, number> = {};
  const count: Record<string, number> = {};
  for (const r of runes) count[r.set] = (count[r.set] ?? 0) + 1;
  for (const [set, n] of Object.entries(count)) {
    const d = c.runeSets.find((x) => x.id === set);
    if (!d) continue;
    const times = Math.floor(n / d.pieces);
    for (const [k, v] of Object.entries(d.bonus)) out[k] = (out[k] ?? 0) + v * times;
  }
  return out;
}

export function activeSets(c: ContentBundle, runes: readonly RuneInst[]): string[] {
  const count: Record<string, number> = {};
  for (const r of runes) count[r.set] = (count[r.set] ?? 0) + 1;
  const out: string[] = [];
  for (const [set, n] of Object.entries(count)) {
    const d = c.runeSets.find((x) => x.id === set);
    if (d) for (let i = 0; i < Math.floor(n / d.pieces); i++) out.push(set);
  }
  return out;
}
